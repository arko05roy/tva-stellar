use anyhow::{anyhow, Result};
use serde_json::Value;
use sha3::{Digest, Keccak256};
use tracing::{debug, error, info};

use crate::chain::db::{ChainDb, StoredTransaction, TxStatus};
use crate::chain::mempool::{Mempool, PendingTx};
use crate::chain::wallet::WalletManager;
use crate::config::Config;
use crate::stellar::SorobanClient;
use crate::translator::tx::{
    decode_calldata, decode_raw_transaction, stroops_to_wei,
};
use crate::translator::AbiRegistry;

/// Handler for eth_chainId
pub async fn chain_id(config: &Config) -> Result<Value> {
    let id = format!("0x{:x}", config.tva_chain_id);
    debug!("eth_chainId -> {}", id);
    Ok(Value::String(id))
}

/// Handler for eth_blockNumber - returns TVA's latest block number
pub async fn block_number(db: &ChainDb) -> Result<Value> {
    let latest = db.get_latest_block_number()?;
    let hex = format!("0x{:x}", latest);
    debug!("eth_blockNumber -> {} (block #{})", hex, latest);
    Ok(Value::String(hex))
}

/// Handler for eth_getBlockByNumber - returns TVA block from local state
pub async fn get_block_by_number(
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let block_param = params
        .first()
        .and_then(|v| v.as_str())
        .unwrap_or("latest");

    let include_txs = params
        .get(1)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let latest = db.get_latest_block_number()?;
    let target_number = parse_block_number(block_param, latest);

    debug!(
        "eth_getBlockByNumber: param={}, target={}, include_txs={}",
        block_param, target_number, include_txs
    );

    let block = match db.get_block_by_number(target_number)? {
        Some(b) => b,
        None => return Ok(Value::Null),
    };

    let txs = db.get_transactions_by_block(target_number)?;
    Ok(format_block_response(&block, &txs, include_txs))
}

/// Handler for eth_getBlockByHash - lookup TVA block by hash
pub async fn get_block_by_hash(
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let hash = params
        .first()
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let include_txs = params
        .get(1)
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    debug!("eth_getBlockByHash: hash={}", hash);

    let block = match db.get_block_by_hash(hash)? {
        Some(b) => b,
        None => return Ok(Value::Null),
    };

    let txs = db.get_transactions_by_block(block.number)?;
    Ok(format_block_response(&block, &txs, include_txs))
}

/// Handler for eth_call (read-only contract invocation) - translates to Soroban simulation
pub async fn call(
    client: &SorobanClient,
    config: &Config,
    abi_registry: &AbiRegistry,
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let call_obj = params
        .first()
        .ok_or_else(|| anyhow!("eth_call requires call object parameter"))?;

    let to = call_obj["to"]
        .as_str()
        .ok_or_else(|| anyhow!("eth_call requires 'to' field"))?;

    let data = call_obj["data"]
        .as_str()
        .or_else(|| call_obj["input"].as_str())
        .unwrap_or("0x");

    let data_bytes = hex::decode(data.strip_prefix("0x").unwrap_or(data))
        .map_err(|e| anyhow!("Invalid calldata hex: {}", e))?;

    debug!("eth_call: to={}, data_len={}", to, data_bytes.len());

    if data_bytes.len() < 4 {
        return Ok(Value::String("0x".to_string()));
    }

    let decoded = decode_calldata(&data_bytes, to, abi_registry)?;

    let function_name = decoded
        .function_name
        .unwrap_or_else(|| format!("fn_{}", hex::encode(decoded.selector)));

    info!("eth_call: invoking {} on {}", function_name, to);

    let source_account = get_source_account_id(config)?;
    let sequence = client.get_account_sequence(&source_account).await.unwrap_or(0);

    // Look up the actual Stellar contract ID from the registry
    let contract_id = resolve_contract_id(db, to)?;

    let tx_xdr = crate::translator::tx::build_soroban_invoke_tx(
        &source_account,
        sequence + 1,
        &contract_id,
        &function_name,
        &decoded.scval_params,
        client.network_passphrase(),
        100,
    )?;

    let sim_result = client.simulate_transaction(&tx_xdr).await?;

    if let Some(error) = &sim_result.error {
        error!("eth_call simulation error: {}", error);
        return Err(anyhow!("Contract call reverted: {}", error));
    }

    if let Some(results) = &sim_result.results {
        if let Some(first_result) = results.first() {
            if let Some(xdr_result) = &first_result.xdr {
                let func_info = abi_registry.lookup_function(to, &decoded.selector);
                if let Some(info) = func_info {
                    let abi_bytes = crate::translator::scval::decode_scval_xdr_to_abi(
                        xdr_result,
                        &info.outputs,
                    )?;
                    return Ok(Value::String(format!("0x{}", hex::encode(&abi_bytes))));
                }
                let raw_bytes = base64::Engine::decode(
                    &base64::engine::general_purpose::STANDARD,
                    xdr_result,
                ).unwrap_or_default();
                return Ok(Value::String(format!("0x{}", hex::encode(&raw_bytes))));
            }
        }
    }

    Ok(Value::String("0x".to_string()))
}

/// Handler for eth_sendRawTransaction - decode EVM tx and add to mempool
pub async fn send_raw_transaction(
    mempool: &Mempool,
    db: &ChainDb,
    wallet_manager: &WalletManager,
    params: &[Value],
) -> Result<Value> {
    let raw_tx_hex = params
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("eth_sendRawTransaction requires raw tx hex"))?;

    let raw_tx_bytes = hex::decode(raw_tx_hex.strip_prefix("0x").unwrap_or(raw_tx_hex))
        .map_err(|e| anyhow!("Invalid raw transaction hex: {}", e))?;

    info!(
        "eth_sendRawTransaction: received {} bytes",
        raw_tx_bytes.len()
    );

    // Decode the EVM transaction
    let decoded_tx = decode_raw_transaction(&raw_tx_bytes)?;

    // Recover sender address from signature
    let from_addr = recover_sender(&decoded_tx, &raw_tx_bytes);

    debug!(
        "Decoded EVM tx: from={}, nonce={}, to={:?}, value={}, data_len={}",
        from_addr,
        decoded_tx.nonce,
        decoded_tx.to.map(|a| format!("0x{}", hex::encode(a))),
        decoded_tx.value,
        decoded_tx.data.len()
    );

    // Ensure the sender has a mirror wallet on Stellar
    let _ = wallet_manager.ensure_account(&from_addr).await;

    // Compute transaction hash
    let tx_hash = format!("0x{}", hex::encode(decoded_tx.tx_hash));

    // Format to_addr
    let to_addr = decoded_tx.to.map(|a| format!("0x{}", hex::encode(a)));

    // Generate contract address for deployment transactions (to == null)
    let contract_address = if decoded_tx.to.is_none() && !decoded_tx.data.is_empty() {
        let addr = generate_contract_address(&from_addr, decoded_tx.nonce);
        info!("Contract creation tx: generated address {}", addr);
        Some(addr)
    } else {
        None
    };

    // Store transaction in DB
    let stored_tx = StoredTransaction {
        hash: tx_hash.clone(),
        block_number: None,
        tx_index: 0,
        from_addr: from_addr.clone(),
        to_addr: to_addr.clone(),
        value: format!("0x{:x}", decoded_tx.value),
        data: hex::encode(&decoded_tx.data),
        gas_limit: decoded_tx.gas_limit,
        gas_price: decoded_tx.gas_price,
        nonce: decoded_tx.nonce,
        status: TxStatus::Pending,
        stellar_tx_hash: None,
        contract_address: contract_address.clone(),
        gas_used: None,
        logs_json: None,
        error: None,
        created_at: chrono::Utc::now().timestamp() as u64,
    };

    db.insert_transaction(&stored_tx)?;

    // Increment account nonce
    db.increment_nonce(&from_addr)?;

    // Add to mempool for block inclusion
    let pending_tx = PendingTx {
        hash: tx_hash.clone(),
        from_addr,
        to_addr,
        value: format!("0x{:x}", decoded_tx.value),
        data: decoded_tx.data.clone(),
        gas_limit: decoded_tx.gas_limit,
        gas_price: decoded_tx.gas_price,
        nonce: decoded_tx.nonce,
        raw_tx: raw_tx_bytes,
        received_at: chrono::Utc::now().timestamp() as u64,
    };

    mempool.add_transaction(pending_tx).await?;

    info!("Transaction {} added to mempool", &tx_hash[..14]);
    Ok(Value::String(tx_hash))
}

/// Handler for eth_getTransactionReceipt - returns receipt from TVA DB
pub async fn get_transaction_receipt(
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let tx_hash = params
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("eth_getTransactionReceipt requires tx hash"))?;

    debug!("eth_getTransactionReceipt: hash={}", tx_hash);

    let tx = match db.get_transaction_by_hash(tx_hash)? {
        Some(t) => t,
        None => return Ok(Value::Null),
    };

    // Only return receipt if tx has been included in a block
    let block_number = match tx.block_number {
        Some(n) => n,
        None => return Ok(Value::Null), // Still in mempool
    };

    // Get the block hash for this block
    let block_hash = db
        .get_block_by_number(block_number)?
        .map(|b| b.hash)
        .unwrap_or_else(|| format!("0x{}", "0".repeat(64)));

    let status = match tx.status {
        TxStatus::Failed => "0x0",
        _ => "0x1",
    };

    let gas_used = tx.gas_used.unwrap_or(21000);

    let logs: Vec<Value> = tx
        .logs_json
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let receipt = serde_json::json!({
        "transactionHash": tx.hash,
        "transactionIndex": format!("0x{:x}", tx.tx_index),
        "blockNumber": format!("0x{:x}", block_number),
        "blockHash": block_hash,
        "from": tx.from_addr,
        "to": tx.to_addr,
        "gasUsed": format!("0x{:x}", gas_used),
        "cumulativeGasUsed": format!("0x{:x}", gas_used),
        "contractAddress": tx.contract_address,
        "logs": logs,
        "logsBloom": format!("0x{}", "0".repeat(512)),
        "status": status,
        "type": "0x0",
        "effectiveGasPrice": format!("0x{:x}", tx.gas_price.max(1000000000)),
    });

    Ok(receipt)
}

/// Handler for eth_getTransactionByHash - returns tx from TVA DB
pub async fn get_transaction_by_hash(
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let tx_hash = params
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("eth_getTransactionByHash requires tx hash"))?;

    debug!("eth_getTransactionByHash: hash={}", tx_hash);

    let tx = match db.get_transaction_by_hash(tx_hash)? {
        Some(t) => t,
        None => return Ok(Value::Null),
    };

    let block_hash = tx.block_number
        .and_then(|n| db.get_block_by_number(n).ok().flatten())
        .map(|b| b.hash)
        .unwrap_or_default();

    Ok(format_transaction_with_block_hash(&tx, &block_hash))
}

/// Handler for eth_getCode - checks Stellar for contract existence
pub async fn get_code(
    client: &SorobanClient,
    params: &[Value],
) -> Result<Value> {
    let address = params
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("eth_getCode requires address"))?;

    debug!("eth_getCode: address={}", address);

    let contract_id = evm_address_to_contract_id(address);
    let ledger_key = build_contract_instance_key(&contract_id);
    let entries = client.get_ledger_entries(vec![ledger_key]).await?;

    if let Some(entries_list) = entries.entries {
        if !entries_list.is_empty() {
            let code_hash = format!("0x{}", hex::encode(contract_id.as_bytes()));
            return Ok(Value::String(code_hash));
        }
    }

    Ok(Value::String("0x".to_string()))
}

/// Handler for eth_getBalance - looks up mirror wallet and queries Stellar
pub async fn get_balance(
    db: &ChainDb,
    client: &SorobanClient,
    params: &[Value],
) -> Result<Value> {
    let address = params
        .first()
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("eth_getBalance requires address"))?;

    debug!("eth_getBalance: address={}", address);

    let normalized = address.to_lowercase();

    // Look up mirror wallet in DB
    let stellar_address = match db.get_account(&normalized)? {
        Some(account) => account.stellar_address,
        None => {
            // No mirror wallet yet - return 0
            return Ok(Value::String("0x0".to_string()));
        }
    };

    // Query Stellar for XLM balance
    let balance_stroops = client.get_xlm_balance(&stellar_address).await.unwrap_or(0);
    let balance_wei = stroops_to_wei(balance_stroops);
    let hex_balance = format!("0x{:x}", balance_wei);

    debug!(
        "eth_getBalance: {} -> stellar {} -> {} stroops = {}",
        address, &stellar_address[..10], balance_stroops, hex_balance
    );

    Ok(Value::String(hex_balance))
}

/// Handler for eth_gasPrice
pub async fn gas_price(client: &SorobanClient) -> Result<Value> {
    let base_fee = client.get_base_fee().await.unwrap_or(100);
    let gas_price_wei = stroops_to_wei(base_fee);
    let hex_price = format!("0x{:x}", gas_price_wei);
    debug!("eth_gasPrice: base_fee={} stroops -> {}", base_fee, hex_price);
    Ok(Value::String(hex_price))
}

/// Handler for eth_estimateGas - simulates on Stellar
pub async fn estimate_gas(
    client: &SorobanClient,
    config: &Config,
    abi_registry: &AbiRegistry,
    params: &[Value],
) -> Result<Value> {
    let call_obj = params
        .first()
        .ok_or_else(|| anyhow!("eth_estimateGas requires call object"))?;

    let to = call_obj["to"].as_str();
    let data = call_obj["data"]
        .as_str()
        .or_else(|| call_obj["input"].as_str())
        .unwrap_or("0x");

    debug!("eth_estimateGas: to={:?}, data_len={}", to, data.len());

    if let Some(to_addr) = to {
        let data_bytes = hex::decode(data.strip_prefix("0x").unwrap_or(data)).unwrap_or_default();

        if data_bytes.len() >= 4 {
            let decoded = decode_calldata(&data_bytes, to_addr, abi_registry)?;
            let function_name = decoded
                .function_name
                .unwrap_or_else(|| format!("fn_{}", hex::encode(decoded.selector)));

            let source_account = get_source_account_id(config)?;
            let sequence = client.get_account_sequence(&source_account).await.unwrap_or(0);
            let contract_id = evm_address_to_contract_id(to_addr);

            let tx_xdr = crate::translator::tx::build_soroban_invoke_tx(
                &source_account,
                sequence + 1,
                &contract_id,
                &function_name,
                &decoded.scval_params,
                client.network_passphrase(),
                100,
            )?;

            let sim_result = client.simulate_transaction(&tx_xdr).await?;

            if let Some(cost) = &sim_result.cost {
                let cpu_insns: u64 = cost
                    .cpu_insns
                    .as_ref()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);
                let mem_bytes: u64 = cost
                    .mem_bytes
                    .as_ref()
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0);

                let estimated_gas = (cpu_insns / 1000) + (mem_bytes / 100) + 21000;
                return Ok(Value::String(format!("0x{:x}", estimated_gas)));
            }

            if let Some(fee_str) = &sim_result.min_resource_fee {
                let fee: u64 = fee_str.parse().unwrap_or(21000);
                let gas = fee * 100 + 21000;
                return Ok(Value::String(format!("0x{:x}", gas)));
            }
        }
    }

    // Default gas estimate (standard transfer)
    Ok(Value::String("0x5208".to_string())) // 21000
}

/// Handler for eth_getTransactionCount (nonce) - from TVA DB
pub async fn get_transaction_count(
    db: &ChainDb,
    params: &[Value],
) -> Result<Value> {
    let address = params
        .first()
        .and_then(|v| v.as_str())
        .unwrap_or("0x0");

    debug!("eth_getTransactionCount: address={}", address);

    let nonce = db.get_nonce(&address.to_lowercase())?;
    Ok(Value::String(format!("0x{:x}", nonce)))
}

/// Handler for eth_getLogs - queries Soroban events
pub async fn get_logs(
    client: &SorobanClient,
    params: &[Value],
) -> Result<Value> {
    use crate::stellar::types::{EventFilter, EventPagination, GetEventsParams};

    let default_filter = Value::Object(Default::default());
    let filter = params.first().unwrap_or(&default_filter);

    let from_block = filter["fromBlock"].as_str().unwrap_or("latest");
    let to_block = filter["toBlock"].as_str().unwrap_or("latest");

    let latest = client.get_latest_ledger().await?;

    let start_ledger = parse_block_number(from_block, latest.sequence);
    let end_ledger = parse_block_number(to_block, latest.sequence);

    debug!(
        "eth_getLogs: from_ledger={}, to_ledger={}",
        start_ledger, end_ledger
    );

    let mut event_filters = Vec::new();

    if let Some(address) = filter["address"].as_str() {
        let contract_id = evm_address_to_contract_id(address);
        event_filters.push(EventFilter {
            event_type: "contract".to_string(),
            contract_ids: Some(vec![contract_id]),
            topics: None,
        });
    }

    let events_params = GetEventsParams {
        start_ledger,
        end_ledger: Some(end_ledger),
        filters: if event_filters.is_empty() {
            None
        } else {
            Some(event_filters)
        },
        pagination: Some(EventPagination {
            limit: 100,
            cursor: None,
        }),
    };

    let events_response = client.get_events(events_params).await?;

    let logs: Vec<Value> = if let Some(events) = events_response.events {
        let evm_logs = crate::emulator::logs::soroban_events_to_evm_logs(
            &events,
            &format!("0x{}", "0".repeat(64)),
        );
        evm_logs
            .iter()
            .map(|log| serde_json::to_value(log).unwrap_or(Value::Null))
            .collect()
    } else {
        Vec::new()
    };

    Ok(Value::Array(logs))
}

/// Handler for eth_accounts (return empty - no managed accounts)
pub async fn accounts() -> Result<Value> {
    Ok(Value::Array(Vec::new()))
}

/// Handler for eth_mining (always false)
pub async fn mining() -> Result<Value> {
    Ok(Value::Bool(false))
}

/// Handler for eth_hashrate (always 0)
pub async fn hashrate() -> Result<Value> {
    Ok(Value::String("0x0".to_string()))
}

/// Handler for eth_syncing (always false - TVA has instant finality)
pub async fn syncing() -> Result<Value> {
    Ok(Value::Bool(false))
}

/// Handler for eth_coinbase
pub async fn coinbase() -> Result<Value> {
    Ok(Value::String(format!("0x{}", "0".repeat(40))))
}

/// Handler for eth_getStorageAt
pub async fn get_storage_at(params: &[Value]) -> Result<Value> {
    let _address = params.first().and_then(|v| v.as_str()).unwrap_or("0x0");
    let _slot = params.get(1).and_then(|v| v.as_str()).unwrap_or("0x0");
    Ok(Value::String(format!("0x{}", "0".repeat(64))))
}

/// Handler for eth_getBlockTransactionCountByNumber
pub async fn get_block_transaction_count_by_number(db: &ChainDb, params: &[Value]) -> Result<Value> {
    let block_param = params.first().and_then(|v| v.as_str()).unwrap_or("latest");
    let latest = db.get_latest_block_number()?;
    let block_number = parse_block_number(block_param, latest);
    let count = db.get_block_transaction_count(block_number)?;
    Ok(Value::String(format!("0x{:x}", count)))
}

/// Handler for eth_getBlockTransactionCountByHash
pub async fn get_block_transaction_count_by_hash(db: &ChainDb, params: &[Value]) -> Result<Value> {
    let block_hash = params.first().and_then(|v| v.as_str()).unwrap_or("");
    let block = db.get_block_by_hash(block_hash)?;
    match block {
        Some(b) => {
            let count = db.get_block_transaction_count(b.number)?;
            Ok(Value::String(format!("0x{:x}", count)))
        }
        None => Ok(Value::Null),
    }
}

/// Handler for eth_getTransactionByBlockNumberAndIndex
pub async fn get_transaction_by_block_number_and_index(db: &ChainDb, params: &[Value]) -> Result<Value> {
    let block_param = params.first().and_then(|v| v.as_str()).unwrap_or("latest");
    let index_param = params.get(1).and_then(|v| v.as_str()).unwrap_or("0x0");

    let latest = db.get_latest_block_number()?;
    let block_number = parse_block_number(block_param, latest);
    let tx_index = u32::from_str_radix(
        index_param.strip_prefix("0x").unwrap_or(index_param),
        16,
    ).unwrap_or(0);

    let tx = db.get_transaction_by_block_and_index(block_number, tx_index)?;
    match tx {
        Some(t) => {
            let block = db.get_block_by_number(block_number)?;
            let block_hash = block.map(|b| b.hash).unwrap_or_default();
            Ok(format_transaction_with_block_hash(&t, &block_hash))
        }
        None => Ok(Value::Null),
    }
}

/// Handler for eth_getTransactionByBlockHashAndIndex
pub async fn get_transaction_by_block_hash_and_index(db: &ChainDb, params: &[Value]) -> Result<Value> {
    let block_hash = params.first().and_then(|v| v.as_str()).unwrap_or("");
    let index_param = params.get(1).and_then(|v| v.as_str()).unwrap_or("0x0");

    let tx_index = u32::from_str_radix(
        index_param.strip_prefix("0x").unwrap_or(index_param),
        16,
    ).unwrap_or(0);

    let block = db.get_block_by_hash(block_hash)?;
    match block {
        Some(b) => {
            let tx = db.get_transaction_by_block_and_index(b.number, tx_index)?;
            match tx {
                Some(t) => Ok(format_transaction_with_block_hash(&t, &b.hash)),
                None => Ok(Value::Null),
            }
        }
        None => Ok(Value::Null),
    }
}

/// Handler for eth_getUncleCountByBlockNumber - TVA has no uncles
pub async fn get_uncle_count_by_block_number(_params: &[Value]) -> Result<Value> {
    Ok(Value::String("0x0".to_string()))
}

/// Handler for eth_getUncleCountByBlockHash - TVA has no uncles
pub async fn get_uncle_count_by_block_hash(_params: &[Value]) -> Result<Value> {
    Ok(Value::String("0x0".to_string()))
}

/// Handler for eth_getUncleByBlockHashAndIndex - TVA has no uncles
pub async fn get_uncle_by_block_hash_and_index(_params: &[Value]) -> Result<Value> {
    Ok(Value::Null)
}

/// Handler for eth_getUncleByBlockNumberAndIndex - TVA has no uncles
pub async fn get_uncle_by_block_number_and_index(_params: &[Value]) -> Result<Value> {
    Ok(Value::Null)
}

/// Handler for eth_getBlockReceipts - returns all receipts for a block
pub async fn get_block_receipts(db: &ChainDb, params: &[Value]) -> Result<Value> {
    let block_param = params.first().and_then(|v| v.as_str()).unwrap_or("latest");
    let latest = db.get_latest_block_number()?;
    let block_number = parse_block_number(block_param, latest);

    let block = db.get_block_by_number(block_number)?;
    let block_hash = block.as_ref().map(|b| b.hash.clone()).unwrap_or_default();

    let txs = db.get_transactions_by_block(block_number)?;
    let mut receipts = Vec::new();
    let mut cumulative_gas: u64 = 0;

    for tx in &txs {
        let gas_used = tx.gas_used.unwrap_or(21000);
        cumulative_gas += gas_used;
        let logs: Vec<Value> = tx.logs_json.as_ref()
            .and_then(|j| serde_json::from_str(j).ok())
            .unwrap_or_default();
        let status = match tx.status {
            TxStatus::Failed => "0x0",
            _ => "0x1",
        };

        receipts.push(serde_json::json!({
            "transactionHash": tx.hash,
            "transactionIndex": format!("0x{:x}", tx.tx_index),
            "blockNumber": format!("0x{:x}", block_number),
            "blockHash": block_hash,
            "from": tx.from_addr,
            "to": tx.to_addr,
            "gasUsed": format!("0x{:x}", gas_used),
            "cumulativeGasUsed": format!("0x{:x}", cumulative_gas),
            "contractAddress": tx.contract_address,
            "logs": logs,
            "logsBloom": format!("0x{}", "0".repeat(512)),
            "status": status,
            "type": "0x0",
            "effectiveGasPrice": format!("0x{:x}", tx.gas_price.max(1000000000)),
        }));
    }

    Ok(Value::Array(receipts))
}

// --- Helper functions ---

/// Parse a block number parameter (hex, "latest", "earliest", "pending")
fn parse_block_number(param: &str, latest: u64) -> u64 {
    match param {
        "latest" | "pending" | "safe" | "finalized" => latest,
        "earliest" => 0,
        hex_str => {
            let stripped = hex_str.strip_prefix("0x").unwrap_or(hex_str);
            u64::from_str_radix(stripped, 16).unwrap_or(latest)
        }
    }
}

/// Format a StoredBlock + transactions into an EVM-compatible block JSON response
fn format_block_response(
    block: &crate::chain::db::StoredBlock,
    txs: &[StoredTransaction],
    include_txs: bool,
) -> Value {
    let transactions: Vec<Value> = if include_txs {
        txs.iter().map(|tx| format_transaction_with_block_hash(tx, &block.hash)).collect()
    } else {
        txs.iter()
            .map(|tx| Value::String(tx.hash.clone()))
            .collect()
    };

    serde_json::json!({
        "number": format!("0x{:x}", block.number),
        "hash": block.hash,
        "parentHash": block.parent_hash,
        "timestamp": format!("0x{:x}", block.timestamp),
        "gasUsed": format!("0x{:x}", block.gas_used),
        "gasLimit": "0x1c9c380", // 30M gas limit
        "baseFeePerGas": "0x3b9aca00", // 1 gwei
        "difficulty": "0x0",
        "totalDifficulty": "0x0",
        "size": "0x200",
        "miner": format!("0x{}", "0".repeat(40)),
        "nonce": "0x0000000000000000",
        "extraData": "0x",
        "mixHash": format!("0x{}", "0".repeat(64)),
        "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
        "receiptsRoot": format!("0x{}", "0".repeat(64)),
        "stateRoot": format!("0x{}", "0".repeat(64)),
        "transactionsRoot": format!("0x{}", "0".repeat(64)),
        "logsBloom": format!("0x{}", "0".repeat(512)),
        "uncles": [],
        "transactions": transactions,
    })
}

/// Format a transaction response with the correct block hash
fn format_transaction_with_block_hash(tx: &StoredTransaction, block_hash: &str) -> Value {
    serde_json::json!({
        "hash": tx.hash,
        "nonce": format!("0x{:x}", tx.nonce),
        "blockHash": if block_hash.is_empty() { Value::Null } else { Value::String(block_hash.to_string()) },
        "blockNumber": tx.block_number.map(|n| format!("0x{:x}", n)),
        "transactionIndex": format!("0x{:x}", tx.tx_index),
        "from": tx.from_addr,
        "to": tx.to_addr,
        "value": tx.value,
        "gas": format!("0x{:x}", tx.gas_limit),
        "gasPrice": format!("0x{:x}", tx.gas_price.max(1000000000)),
        "input": format!("0x{}", tx.data),
        "type": "0x0",
        "v": "0x1b",
        "r": format!("0x{}", "0".repeat(64)),
        "s": format!("0x{}", "0".repeat(64)),
    })
}

/// Recover the sender address from a decoded EVM transaction.
/// Uses secp256k1 ECDSA recovery when possible, falls back to deterministic derivation.
fn recover_sender(
    tx: &crate::translator::tx::DecodedEvmTransaction,
    raw_tx: &[u8],
) -> String {
    // Try ECDSA recovery using k256
    if let Some(addr) = try_ecrecover(tx, raw_tx) {
        return addr;
    }

    // Fallback: derive a deterministic address from the signature
    // This ensures the same signer always gets the same address
    let mut hasher = Keccak256::new();
    hasher.update(b"TVA_SENDER_");
    hasher.update(&tx.r);
    hasher.update(&tx.s);
    hasher.update(&tx.v.to_be_bytes());
    let hash = hasher.finalize();
    format!("0x{}", hex::encode(&hash[12..32]))
}

/// Attempt proper ECDSA recovery of the sender address
fn try_ecrecover(
    tx: &crate::translator::tx::DecodedEvmTransaction,
    raw_tx: &[u8],
) -> Option<String> {
    use k256::ecdsa::{RecoveryId, Signature, VerifyingKey};

    // Detect transaction type from raw bytes
    let is_typed = !raw_tx.is_empty() && raw_tx[0] < 0x7f;
    let tx_type = if is_typed { raw_tx[0] } else { 0 };

    // Determine the recovery ID from v
    let recovery_id = if is_typed {
        // EIP-2930 (Type 1) and EIP-1559 (Type 2): v is just 0 or 1 (parity)
        RecoveryId::new(tx.v as u8 != 0, false)
    } else if let Some(chain_id) = tx.chain_id {
        // EIP-155: v = chain_id * 2 + 35 + recovery_id
        let rid = tx.v.checked_sub(chain_id * 2 + 35)?;
        RecoveryId::new(rid as u8 != 0, false)
    } else {
        // Legacy: v = 27 + recovery_id
        let rid = tx.v.checked_sub(27)?;
        RecoveryId::new(rid as u8 != 0, false)
    };

    // Build the signing hash
    let signing_hash = compute_signing_hash(tx, tx_type)?;

    // Construct the signature from r and s
    let r_bytes = pad_to_32(&tx.r);
    let s_bytes = pad_to_32(&tx.s);

    let mut sig_bytes = [0u8; 64];
    sig_bytes[..32].copy_from_slice(&r_bytes);
    sig_bytes[32..].copy_from_slice(&s_bytes);

    let signature = Signature::from_bytes((&sig_bytes).into()).ok()?;

    // Recover the public key
    let recovered_key = VerifyingKey::recover_from_prehash(
        &signing_hash,
        &signature,
        recovery_id,
    ).ok()?;

    // Public key to address: keccak256(uncompressed_pubkey[1..]) → last 20 bytes
    let pubkey_bytes = recovered_key.to_encoded_point(false);
    let pubkey_uncompressed = pubkey_bytes.as_bytes();

    // Skip the 0x04 prefix byte
    let mut hasher = Keccak256::new();
    hasher.update(&pubkey_uncompressed[1..]);
    let hash = hasher.finalize();

    Some(format!("0x{}", hex::encode(&hash[12..32])))
}

/// Compute the signing hash for a transaction based on its type
fn compute_signing_hash(
    tx: &crate::translator::tx::DecodedEvmTransaction,
    tx_type: u8,
) -> Option<Vec<u8>> {
    use rlp::RlpStream;

    match tx_type {
        1 => {
            // EIP-2930: keccak256(0x01 || rlp([chain_id, nonce, gas_price, gas_limit, to, value, data, access_list]))
            let mut stream = RlpStream::new_list(8);
            stream.append(&tx.chain_id.unwrap_or(0));
            stream.append(&tx.nonce);
            stream.append(&tx.gas_price);
            stream.append(&tx.gas_limit);
            match &tx.to {
                Some(addr) => stream.append(&addr.as_ref()),
                None => stream.append(&""),
            };
            let value_bytes = to_minimal_be_bytes(tx.value);
            stream.append(&value_bytes.as_slice());
            stream.append(&tx.data.as_slice());
            // Empty access list
            stream.begin_list(0);

            let rlp_encoded = stream.out();
            let mut prefixed = vec![0x01u8];
            prefixed.extend_from_slice(&rlp_encoded);
            let hash = Keccak256::digest(&prefixed);
            Some(hash.to_vec())
        }
        2 => {
            // EIP-1559: keccak256(0x02 || rlp([chain_id, nonce, max_priority_fee, max_fee, gas_limit, to, value, data, access_list]))
            let mut stream = RlpStream::new_list(9);
            stream.append(&tx.chain_id.unwrap_or(0));
            stream.append(&tx.nonce);
            stream.append(&0u64); // max_priority_fee (stored as gas_price in our struct)
            stream.append(&tx.gas_price); // max_fee
            stream.append(&tx.gas_limit);
            match &tx.to {
                Some(addr) => stream.append(&addr.as_ref()),
                None => stream.append(&""),
            };
            let value_bytes = to_minimal_be_bytes(tx.value);
            stream.append(&value_bytes.as_slice());
            stream.append(&tx.data.as_slice());
            // Empty access list
            stream.begin_list(0);

            let rlp_encoded = stream.out();
            let mut prefixed = vec![0x02u8];
            prefixed.extend_from_slice(&rlp_encoded);
            let hash = Keccak256::digest(&prefixed);
            Some(hash.to_vec())
        }
        _ => {
            // Legacy/EIP-155: rlp([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0])
            let mut stream = RlpStream::new_list(if tx.chain_id.is_some() { 9 } else { 6 });
            stream.append(&tx.nonce);
            stream.append(&tx.gas_price);
            stream.append(&tx.gas_limit);
            match &tx.to {
                Some(addr) => stream.append(&addr.as_ref()),
                None => stream.append(&""),
            };
            let value_bytes = to_minimal_be_bytes(tx.value);
            stream.append(&value_bytes.as_slice());
            stream.append(&tx.data.as_slice());
            if let Some(chain_id) = tx.chain_id {
                stream.append(&chain_id);
                stream.append(&0u8);
                stream.append(&0u8);
            }
            let encoded = stream.out();
            let hash = Keccak256::digest(&encoded);
            Some(hash.to_vec())
        }
    }
}

/// Convert u128 to minimal big-endian byte representation
fn to_minimal_be_bytes(val: u128) -> Vec<u8> {
    if val == 0 {
        return vec![];
    }
    let bytes = val.to_be_bytes();
    let start = bytes.iter().position(|&b| b != 0).unwrap_or(bytes.len());
    bytes[start..].to_vec()
}

/// Pad a byte slice to 32 bytes (left-padded with zeros)
fn pad_to_32(bytes: &[u8]) -> [u8; 32] {
    let mut padded = [0u8; 32];
    let start = 32usize.saturating_sub(bytes.len());
    let src_start = bytes.len().saturating_sub(32);
    padded[start..].copy_from_slice(&bytes[src_start..]);
    padded
}

/// Resolve the Stellar contract ID for an EVM address.
/// First checks the contracts table in the DB, falls back to deterministic mapping.
fn resolve_contract_id(db: &ChainDb, evm_address: &str) -> Result<String> {
    let normalized = evm_address.to_lowercase();
    if let Some(stellar_id) = db.get_contract_id(&normalized)? {
        return Ok(stellar_id);
    }
    // Fallback: deterministic mapping (pad 20-byte address to 64-char hex)
    Ok(evm_address_to_contract_id(evm_address))
}

/// Convert EVM address to Stellar contract ID string.
fn evm_address_to_contract_id(evm_address: &str) -> String {
    let addr_hex = evm_address.strip_prefix("0x").unwrap_or(evm_address);
    format!("{:0>64}", addr_hex)
}

/// Build a ledger key XDR for a contract instance (base64 encoded).
fn build_contract_instance_key(contract_id: &str) -> String {
    let contract_bytes = hex::decode(contract_id).unwrap_or_else(|_| vec![0u8; 32]);
    let mut key_xdr = Vec::new();

    key_xdr.extend_from_slice(&6u32.to_be_bytes());
    key_xdr.extend_from_slice(&1u32.to_be_bytes());
    if contract_bytes.len() >= 32 {
        key_xdr.extend_from_slice(&contract_bytes[..32]);
    } else {
        key_xdr.extend_from_slice(&contract_bytes);
        key_xdr.extend(vec![0u8; 32 - contract_bytes.len()]);
    }
    key_xdr.extend_from_slice(&20u32.to_be_bytes());
    key_xdr.extend_from_slice(&1u32.to_be_bytes());

    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &key_xdr)
}

/// Get the source account ID from the config (derive from secret key).
fn get_source_account_id(config: &Config) -> Result<String> {
    // First try the explicit address from config
    if let Some(addr) = &config.stellar_account_address {
        if addr.starts_with('G') && addr.len() == 56 {
            return Ok(addr.clone());
        }
    }
    
    // Try to get address from stellar CLI
    use std::process::Command;
    let project_root = std::env::current_dir()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    
    let stellar_bin = project_root.join("tooling").join("bin").join("stellar");
    if stellar_bin.exists() {
        let output = Command::new(&stellar_bin)
            .args(&["keys", "address", "tva-deployer"])
            .output();
        
        if let Ok(output) = output {
            if output.status.success() {
                let addr = String::from_utf8_lossy(&output.stdout)
                    .trim()
                    .to_string();
                if addr.starts_with('G') && addr.len() == 56 {
                    return Ok(addr);
                }
            }
        }
    }
    
    // Fallback: return error with instructions
    Err(anyhow!("Could not determine Stellar account address. Set STELLAR_ACCOUNT_ADDRESS environment variable or ensure 'tva-deployer' key exists"))
}

/// Handler for tva_verifyContract - submit source code hash to VerificationRegistry on Stellar
pub async fn verify_contract(
    client: &SorobanClient,
    config: &Config,
    params: &[Value],
) -> Result<Value> {
    let contract_addr = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("tva_verifyContract requires contract address"))?;

    let source = params
        .get(1)
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("tva_verifyContract requires source code"))?;

    let _compiler_version = params
        .get(2)
        .and_then(|v| v.as_str())
        .unwrap_or("0.3.0");

    let _compiler_flags = params
        .get(3)
        .and_then(|v| v.as_str())
        .unwrap_or("--target soroban");

    let metadata = params
        .get(4)
        .and_then(|v| v.as_str())
        .unwrap_or("{}");

    let registry_id = config
        .verification_registry_contract_id
        .as_ref()
        .ok_or_else(|| anyhow!("VERIFICATION_REGISTRY_CONTRACT_ID not configured"))?;

    info!(
        "tva_verifyContract: contract={}, registry={}",
        &contract_addr[..10],
        &registry_id[..10]
    );

    // Compute hashes
    use sha3::{Digest, Keccak256};
    let source_hash = Keccak256::digest(source.as_bytes());
    let metadata_hash = Keccak256::digest(metadata.as_bytes());
    
    let source_hash_bytes: [u8; 32] = source_hash.into();
    let metadata_hash_bytes: [u8; 32] = metadata_hash.into();

    // Convert EVM address to Stellar contract address format
    let contract_addr_bytes = hex::decode(contract_addr.strip_prefix("0x").unwrap_or(contract_addr))
        .map_err(|e| anyhow!("Invalid contract address hex: {}", e))?;

    if contract_addr_bytes.len() != 20 {
        return Err(anyhow!("Contract address must be 20 bytes"));
    }

    let mut stellar_addr = [0u8; 32];
    stellar_addr[12..32].copy_from_slice(&contract_addr_bytes);

    use crate::translator::scval::{ScVal, StellarAddress};
    let args = vec![
        ScVal::Address(StellarAddress::Contract(stellar_addr)),
        ScVal::Bytes(source_hash_bytes.to_vec()),
        ScVal::Bytes(metadata_hash_bytes.to_vec()),
    ];

    let source_account = get_source_account_id(config)?;
    let sequence = client.get_account_sequence(&source_account).await.unwrap_or(0);

    let tx_xdr = crate::translator::tx::build_soroban_invoke_tx(
        &source_account,
        sequence + 1,
        registry_id,
        "verify",
        &args,
        client.network_passphrase(),
        10000, // Higher fee for storage operations
    )?;

    // Submit transaction (not simulate - this writes to chain)
    let result = client.send_transaction(&tx_xdr).await?;

    // TODO: Store full source in RPC DB for querying
    // For now, just return success

    Ok(serde_json::json!({
        "verified": true,
        "txHash": result.hash,
        "contractAddress": contract_addr,
        "sourceHash": format!("0x{}", hex::encode(source_hash_bytes))
    }))
}

/// Handler for tva_getVerifiedSource - query VerificationRegistry for verified source
pub async fn get_verified_source(
    client: &SorobanClient,
    config: &Config,
    params: &[Value],
) -> Result<Value> {
    let contract_addr = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("tva_getVerifiedSource requires contract address"))?;

    let registry_id = config
        .verification_registry_contract_id
        .as_ref()
        .ok_or_else(|| anyhow!("VERIFICATION_REGISTRY_CONTRACT_ID not configured"))?;

    debug!("tva_getVerifiedSource: contract={}", contract_addr);

    // Convert EVM address to Stellar contract address format
    let contract_addr_bytes = hex::decode(contract_addr.strip_prefix("0x").unwrap_or(contract_addr))
        .map_err(|e| anyhow!("Invalid contract address hex: {}", e))?;

    if contract_addr_bytes.len() != 20 {
        return Err(anyhow!("Contract address must be 20 bytes"));
    }

    let mut stellar_addr = [0u8; 32];
    stellar_addr[12..32].copy_from_slice(&contract_addr_bytes);

    use crate::translator::scval::{ScVal, StellarAddress};
    let args = vec![ScVal::Address(StellarAddress::Contract(stellar_addr))];

    let source_account = get_source_account_id(config)?;
    let sequence = client.get_account_sequence(&source_account).await.unwrap_or(0);

    let tx_xdr = crate::translator::tx::build_soroban_invoke_tx(
        &source_account,
        sequence,
        registry_id,
        "getSource",
        &args,
        client.network_passphrase(),
        100,
    )?;

    // Simulate (read-only)
    let sim_result = client.simulate_transaction(&tx_xdr).await?;

    if let Some(error) = &sim_result.error {
        return Err(anyhow!("Contract call error: {}", error));
    }

    // Decode the result (bytes32 hash)
    let verified = if let Some(results) = &sim_result.results {
        if let Some(first_result) = results.first() {
            if let Some(xdr) = &first_result.xdr {
                // Decode bytes32 from XDR
                // For now, just check if result exists (non-zero means verified)
                !xdr.is_empty()
            } else {
                false
            }
        } else {
            false
        }
    } else {
        false
    };

    // TODO: Query RPC DB for full source code if verified
    Ok(serde_json::json!({
        "verified": verified,
        "contractAddress": contract_addr,
        "note": verified.then_some("Contract is verified on Stellar")
    }))
}

/// Generate a deterministic contract address from sender and nonce (EVM-compatible).
fn generate_contract_address(sender: &str, nonce: u64) -> String {
    use rlp::RlpStream;
    let addr_bytes = hex::decode(sender.strip_prefix("0x").unwrap_or(sender)).unwrap_or_default();
    let mut stream = RlpStream::new_list(2);
    stream.append(&addr_bytes.as_slice());
    stream.append(&nonce);
    let hash = Keccak256::digest(stream.out().as_ref());
    format!("0x{}", hex::encode(&hash[12..32]))
}

/// Handler for tva_deployContract - compile Solidity source and deploy to Stellar.
///
/// Params: [source_code, filename, constructor_args_json?, abi_json?]
/// Returns: { contractAddress, stellarContractId, txHash }
pub async fn deploy_contract(
    db: &ChainDb,
    config: &Config,
    params: &[Value],
) -> Result<Value> {
    let source = params
        .get(0)
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("tva_deployContract requires source code"))?;

    let filename = params
        .get(1)
        .and_then(|v| v.as_str())
        .unwrap_or("Contract.sol");

    let abi_json = params
        .get(3)
        .and_then(|v| v.as_str());

    info!("tva_deployContract: filename={}", filename);

    // Step 1: Preprocess msg.sender patterns
    let processed_source = preprocess_msg_sender(source);

    // Step 2: Write source to temp file and compile with Solang
    let tmp_dir = std::env::temp_dir().join(format!("tva-deploy-{}", chrono::Utc::now().timestamp_millis()));
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| anyhow!("Failed to create temp dir: {}", e))?;

    let source_path = tmp_dir.join(filename);
    std::fs::write(&source_path, &processed_source)
        .map_err(|e| anyhow!("Failed to write source: {}", e))?;

    let output_dir = tmp_dir.join("output");
    std::fs::create_dir_all(&output_dir)
        .map_err(|e| anyhow!("Failed to create output dir: {}", e))?;

    // Find Solang binary
    let project_root = find_project_root();
    let solang_bin = project_root.join("tooling").join("bin").join("solang");
    if !solang_bin.exists() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
        return Err(anyhow!("Solang compiler not found at {:?}", solang_bin));
    }

    let compile_result = std::process::Command::new(&solang_bin)
        .args(&[
            "compile",
            source_path.to_str().unwrap(),
            "--target", "soroban",
            "-o", output_dir.to_str().unwrap(),
        ])
        .output();

    match compile_result {
        Ok(output) => {
            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                // Check if WASM was still produced despite warnings
                let wasm_name = filename.replace(".sol", ".wasm");
                let wasm_path = output_dir.join(&wasm_name);
                if !wasm_path.exists() {
                    let _ = std::fs::remove_dir_all(&tmp_dir);
                    return Err(anyhow!("Solang compilation failed: {}", stderr));
                }
            }
        }
        Err(e) => {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            return Err(anyhow!("Failed to run Solang: {}", e));
        }
    }

    // Find the compiled WASM
    let wasm_name = filename.replace(".sol", ".wasm");
    let wasm_path = output_dir.join(&wasm_name);
    if !wasm_path.exists() {
        // Try to find any .wasm file
        let entries = std::fs::read_dir(&output_dir).ok();
        let found_wasm = entries.and_then(|mut e| {
            e.find_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension().map(|e| e == "wasm").unwrap_or(false) {
                    Some(path)
                } else {
                    None
                }
            })
        });
        if found_wasm.is_none() {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            return Err(anyhow!("No WASM output produced by compiler"));
        }
    }

    let wasm_path = if wasm_path.exists() {
        wasm_path
    } else {
        let entries = std::fs::read_dir(&output_dir).ok();
        entries.and_then(|mut e| {
            e.find_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension().map(|e| e == "wasm").unwrap_or(false) {
                    Some(path)
                } else {
                    None
                }
            })
        }).ok_or_else(|| anyhow!("No WASM found"))?
    };

    let wasm_bytes = std::fs::read(&wasm_path)
        .map_err(|e| anyhow!("Failed to read WASM: {}", e))?;
    let wasm_size = wasm_bytes.len();
    info!("Compiled WASM: {} bytes", wasm_size);

    // Step 3: Deploy to Stellar using Stellar CLI
    let stellar_bin = project_root.join("tooling").join("bin").join("stellar");
    if !stellar_bin.exists() {
        let _ = std::fs::remove_dir_all(&tmp_dir);
        return Err(anyhow!("Stellar CLI not found at {:?}", stellar_bin));
    }

    let contract_name = filename.replace(".sol", "").to_lowercase();

    let deploy_result = std::process::Command::new(&stellar_bin)
        .args(&[
            "contract", "deploy",
            "--wasm", wasm_path.to_str().unwrap(),
            "--source", &config.stellar_secret_key,
            "--rpc-url", &config.stellar_rpc_url,
            "--network-passphrase", &config.stellar_network_passphrase,
            "--alias", &contract_name,
        ])
        .output();

    let stellar_contract_id = match deploy_result {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

            // Try to find contract ID (C-prefixed 56 chars) in output
            let combined = format!("{}\n{}", stdout, stderr);
            let contract_id = combined
                .lines()
                .find_map(|line| {
                    let trimmed = line.trim();
                    if trimmed.starts_with('C') && trimmed.len() == 56 && trimmed.chars().all(|c| c.is_ascii_alphanumeric()) {
                        Some(trimmed.to_string())
                    } else {
                        None
                    }
                });

            match contract_id {
                Some(id) => id,
                None => {
                    if !stdout.is_empty() && stdout.len() <= 56 {
                        stdout
                    } else {
                        let _ = std::fs::remove_dir_all(&tmp_dir);
                        return Err(anyhow!("Stellar deploy failed: {}", combined));
                    }
                }
            }
        }
        Err(e) => {
            let _ = std::fs::remove_dir_all(&tmp_dir);
            return Err(anyhow!("Failed to run Stellar CLI: {}", e));
        }
    };

    info!("Deployed to Stellar: {}", stellar_contract_id);

    // Step 4: Generate EVM address and register in DB
    let evm_address = stellar_contract_id_to_evm_address(&stellar_contract_id);
    info!("EVM address: {}", evm_address);

    db.register_contract(
        &evm_address,
        &stellar_contract_id,
        Some(&contract_name),
        abi_json,
    )?;

    // Cleanup temp dir
    let _ = std::fs::remove_dir_all(&tmp_dir);

    Ok(serde_json::json!({
        "contractAddress": evm_address,
        "stellarContractId": stellar_contract_id,
        "wasmSize": wasm_size,
        "contractName": contract_name,
        "network": "testnet",
    }))
}

/// Preprocess Solidity source to handle msg.sender for Soroban compatibility.
fn preprocess_msg_sender(source: &str) -> String {
    let mut result = source.to_string();

    // Replace msg.sender in constructors with _caller parameter
    // Add address _caller to constructor if msg.sender is used in constructor
    if result.contains("msg.sender") {
        // Simple preprocessing: replace msg.sender usage patterns
        // In constructor context, add _caller parameter
        if let Some(constructor_pos) = result.find("constructor(") {
            let after_paren = constructor_pos + "constructor(".len();
            let params_end = result[after_paren..].find(')').map(|p| after_paren + p);
            if let Some(end) = params_end {
                let existing_params = result[after_paren..end].trim();
                let new_params = if existing_params.is_empty() {
                    "address _caller".to_string()
                } else {
                    format!("{}, address _caller", existing_params)
                };
                result = format!(
                    "{}constructor({}{}",
                    &result[..constructor_pos],
                    new_params,
                    &result[end..]
                );
            }
        }

        // Replace msg.sender with _caller in the constructor body
        // This is a simplified version - production would use AST manipulation
        result = result.replace("msg.sender", "address(this)");
    }

    result
}

/// Convert a Stellar contract ID (C...) to an EVM-compatible address (0x...).
fn stellar_contract_id_to_evm_address(contract_id: &str) -> String {
    // Decode the C-strkey to get 32 raw bytes, take last 20 bytes as EVM address
    let decoded = decode_strkey_to_bytes(contract_id);
    let addr_bytes = &decoded[12..32]; // last 20 bytes
    format!("0x{}", hex::encode(addr_bytes))
}

/// Decode a Stellar strkey (C... or G...) to 32 raw bytes.
fn decode_strkey_to_bytes(strkey: &str) -> [u8; 32] {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let mut bits = String::new();
    for ch in strkey.bytes() {
        if let Some(pos) = ALPHABET.iter().position(|&c| c == ch) {
            bits.push_str(&format!("{:05b}", pos));
        }
    }

    let mut bytes = Vec::new();
    let mut i = 0;
    while i + 8 <= bits.len() {
        let byte = u8::from_str_radix(&bits[i..i+8], 2).unwrap_or(0);
        bytes.push(byte);
        i += 8;
    }

    // Skip version byte (first byte) and checksum (last 2 bytes)
    let payload = if bytes.len() >= 35 {
        &bytes[1..33]
    } else if bytes.len() > 1 {
        &bytes[1..bytes.len().min(33)]
    } else {
        &bytes[..]
    };

    let mut result = [0u8; 32];
    let copy_len = payload.len().min(32);
    result[..copy_len].copy_from_slice(&payload[..copy_len]);
    result
}

/// Find the project root directory (containing tooling/bin/).
fn find_project_root() -> std::path::PathBuf {
    // Try current working directory first
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("tooling").join("bin").exists() {
            return cwd;
        }
        // Try parent
        if let Some(parent) = cwd.parent() {
            if parent.join("tooling").join("bin").exists() {
                return parent.to_path_buf();
            }
        }
    }
    // Fallback
    std::path::PathBuf::from(".")
}
