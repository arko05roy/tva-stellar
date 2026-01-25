use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::{anyhow, Result};
use jsonrpsee::server::{RpcModule, Server};
use tower::ServiceBuilder;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tracing::{info, warn};

use crate::chain::{ChainDb, ChainState, Mempool, Sequencer, SettlementEngine, WalletManager};
use crate::chain::sequencer::create_genesis_block;
use crate::config::Config;
use crate::methods::{eth, net, web3};
use crate::stellar::SorobanClient;
use crate::translator::AbiRegistry;

/// Shared state for the RPC server.
pub struct RpcState {
    pub config: Config,
    pub soroban_client: SorobanClient,
    pub abi_registry: Arc<AbiRegistry>,
    pub chain: ChainState,
}

/// Start the JSON-RPC server.
pub async fn start_server(config: Config) -> Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], config.tva_rpc_port));

    info!("Starting TVA Node on {}", addr);
    info!("Chain ID: {} (0x{:x})", config.tva_chain_id, config.tva_chain_id);
    info!("Stellar RPC: {}", config.stellar_rpc_url);
    info!("Data directory: {}", config.tva_data_dir);

    // Initialize Soroban client
    let soroban_client = SorobanClient::new(
        &config.stellar_rpc_url,
        &config.stellar_network_passphrase,
    );

    // Check Soroban RPC health
    match soroban_client.get_health().await {
        Ok(health) => {
            info!("Stellar RPC health: status={}", health.status);
            if let Some(latest) = health.latest_ledger {
                info!("Stellar latest ledger: {}", latest);
            }
        }
        Err(e) => {
            warn!("Could not reach Stellar RPC (will retry on requests): {}", e);
        }
    }

    // Initialize ABI registry
    let abi_registry = Arc::new(AbiRegistry::new());

    // --- Initialize TVA Chain Components ---

    // Create data directory
    std::fs::create_dir_all(&config.tva_data_dir)?;
    let db_path = format!("{}/tva_chain.db", config.tva_data_dir);

    // Open chain database
    let db = Arc::new(ChainDb::open(&db_path)?);

    // Create genesis block if this is a fresh database
    if db.get_latest_block_number()? == 0 {
        create_genesis_block(&db)?;
    } else {
        let latest = db.get_latest_block_number()?;
        info!("Resuming from block #{}", latest);
    }

    // Load existing contract ABIs from database into the registry
    match db.get_all_contracts_with_abi() {
        Ok(contracts) => {
            for (evm_address, abi_json) in contracts {
                if let Ok(abi_entries) = serde_json::from_str::<Vec<crate::translator::abi::AbiEntry>>(&abi_json) {
                    if let Err(e) = abi_registry.register_contract(&evm_address, &abi_entries) {
                        warn!("Failed to load ABI for {}: {}", evm_address, e);
                    } else {
                        let func_count = abi_entries.iter().filter(|e| e.entry_type == "function").count();
                        info!("Loaded ABI with {} functions for {}", func_count, &evm_address[..14]);
                    }
                }
            }
        }
        Err(e) => warn!("Failed to load contract ABIs: {}", e),
    }

    // Initialize mempool
    let mempool = Arc::new(Mempool::new(10_000));

    // Initialize wallet manager
    let wallet_manager = Arc::new(WalletManager::new(
        db.clone(),
        &config.stellar_friendbot_url,
        config.tva_master_seed.as_deref(),
    ));

    // Create chain state
    let chain = ChainState {
        db: db.clone(),
        mempool: mempool.clone(),
        wallet_manager: wallet_manager.clone(),
    };

    // Create shared RPC state
    let state = Arc::new(RpcState {
        config: config.clone(),
        soroban_client: soroban_client.clone(),
        abi_registry: abi_registry.clone(),
        chain,
    });

    // --- Spawn Background Tasks ---

    // Sequencer: produces blocks every N ms
    let sequencer = Arc::new(Sequencer::new(
        db.clone(),
        mempool.clone(),
        config.tva_block_interval_ms,
    ));
    let seq_handle = sequencer.clone();
    tokio::spawn(async move { seq_handle.run().await });

    // Settlement engine: submits to Stellar and monitors finality
    let settlement = Arc::new(SettlementEngine::new(
        db.clone(),
        Arc::new(soroban_client.clone()),
        Arc::new(config.clone()),
        abi_registry.clone(),
    ));
    let settle_handle = settlement.clone();
    tokio::spawn(async move { settle_handle.run().await });

    // --- Start RPC Server ---

    // Build the RPC module
    let mut module = RpcModule::new(state.clone());
    register_methods(&mut module)?;

    // CORS middleware
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::any())
        .allow_methods(Any)
        .allow_headers(Any);

    let middleware = ServiceBuilder::new().layer(cors);

    let server = Server::builder()
        .set_http_middleware(middleware)
        .build(addr)
        .await
        .map_err(|e| anyhow!("Failed to bind server to {}: {}", addr, e))?;

    info!("=== TVA Node Ready ===");
    info!("RPC endpoint: http://{}", addr);
    info!("Block interval: {}ms", config.tva_block_interval_ms);
    info!("Compatible with MetaMask, Hardhat, ethers.js, Blockscout");

    let handle = server.start(module);
    handle.stopped().await;

    info!("TVA Node stopped");
    Ok(())
}

/// Register all JSON-RPC methods on the module.
fn register_methods(module: &mut RpcModule<Arc<RpcState>>) -> Result<()> {
    // --- eth_* methods ---

    module.register_async_method("eth_chainId", |params, ctx, _| async move {
        let _ = params;
        eth::chain_id(&ctx.config)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_blockNumber", |params, ctx, _| async move {
        let _ = params;
        eth::block_number(&ctx.chain.db)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getBlockByNumber", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_block_by_number(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getBlockByHash", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_block_by_hash(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_call", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::call(&ctx.soroban_client, &ctx.config, &ctx.abi_registry, &ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_sendRawTransaction", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::send_raw_transaction(
            &ctx.chain.mempool,
            &ctx.chain.db,
            &ctx.chain.wallet_manager,
            &p,
        )
        .await
        .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getTransactionReceipt", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_transaction_receipt(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getTransactionByHash", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_transaction_by_hash(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getCode", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_code(&ctx.soroban_client, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getBalance", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_balance(&ctx.chain.db, &ctx.soroban_client, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_gasPrice", |params, ctx, _| async move {
        let _ = params;
        eth::gas_price(&ctx.soroban_client)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_estimateGas", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::estimate_gas(&ctx.soroban_client, &ctx.config, &ctx.abi_registry, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getTransactionCount", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_transaction_count(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getLogs", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_logs(&ctx.soroban_client, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_accounts", |_params, _ctx, _| async move {
        eth::accounts()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_mining", |_params, _ctx, _| async move {
        eth::mining()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_hashrate", |_params, _ctx, _| async move {
        eth::hashrate()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_syncing", |_params, _ctx, _| async move {
        eth::syncing()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_coinbase", |_params, _ctx, _| async move {
        eth::coinbase()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getStorageAt", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_storage_at(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    // --- Blockscout-required methods ---

    module.register_async_method("eth_getBlockTransactionCountByNumber", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_block_transaction_count_by_number(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getBlockTransactionCountByHash", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_block_transaction_count_by_hash(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getTransactionByBlockNumberAndIndex", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_transaction_by_block_number_and_index(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getTransactionByBlockHashAndIndex", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_transaction_by_block_hash_and_index(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getUncleCountByBlockNumber", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_uncle_count_by_block_number(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getUncleCountByBlockHash", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_uncle_count_by_block_hash(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getUncleByBlockHashAndIndex", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_uncle_by_block_hash_and_index(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getUncleByBlockNumberAndIndex", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_uncle_by_block_number_and_index(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("eth_getBlockReceipts", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_block_receipts(&ctx.chain.db, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    // --- debug_* methods (stubs for Blockscout compatibility) ---

    module.register_async_method("debug_traceTransaction", |_params, _ctx, _| async move {
        // TVA doesn't support transaction tracing - return empty trace
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!({
            "gas": 21000,
            "failed": false,
            "returnValue": "",
            "structLogs": []
        }))
    })?;

    module.register_async_method("debug_traceBlockByNumber", |_params, _ctx, _| async move {
        // TVA doesn't support block tracing - return empty traces
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!([]))
    })?;

    module.register_async_method("debug_traceBlockByHash", |_params, _ctx, _| async move {
        // TVA doesn't support block tracing - return empty traces
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!([]))
    })?;

    module.register_async_method("trace_block", |_params, _ctx, _| async move {
        // TVA doesn't support trace_block - return empty array
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!([]))
    })?;

    module.register_async_method("trace_replayTransaction", |_params, _ctx, _| async move {
        // TVA doesn't support trace replay - return empty trace
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!({
            "output": "0x",
            "stateDiff": null,
            "trace": [],
            "vmTrace": null
        }))
    })?;

    module.register_async_method("trace_replayBlockTransactions", |_params, _ctx, _| async move {
        // TVA doesn't support trace replay - return empty array
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(serde_json::json!([]))
    })?;

    // --- net_* methods ---

    module.register_async_method("net_version", |_params, ctx, _| async move {
        net::version(&ctx.config)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("net_listening", |_params, _ctx, _| async move {
        net::listening()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("net_peerCount", |_params, _ctx, _| async move {
        net::peer_count()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    // --- web3_* methods ---

    module.register_async_method("web3_clientVersion", |_params, _ctx, _| async move {
        web3::client_version()
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("web3_sha3", |params, _ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        web3::sha3(&p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    // --- tva_* methods (TVA-specific) ---

    module.register_async_method("tva_verifyContract", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::verify_contract(&ctx.soroban_client, &ctx.config, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("tva_getVerifiedSource", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::get_verified_source(&ctx.soroban_client, &ctx.config, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("tva_deployContract", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        eth::deploy_contract(&ctx.chain.db, &ctx.config, &ctx.abi_registry, &p)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))
    })?;

    module.register_async_method("tva_getContractInfo", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        let evm_address = p.first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| jsonrpsee_error("Missing evm_address parameter"))?;

        // Look up contract in database
        let stellar_id = ctx.chain.db.get_contract_id(evm_address)
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;

        let result = match stellar_id {
            Some(id) => {
                serde_json::json!({
                    "evmAddress": evm_address,
                    "stellarContractId": id,
                    "stellarExplorerUrl": format!("https://stellar.expert/explorer/testnet/contract/{}", id),
                    "network": "stellar-testnet"
                })
            }
            None => {
                serde_json::json!({
                    "evmAddress": evm_address,
                    "stellarContractId": null,
                    "error": "Contract not found in TVA registry"
                })
            }
        };
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(result)
    })?;

    module.register_async_method("tva_getTransactionInfo", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        let tx_hash = p.first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| jsonrpsee_error("Missing tx_hash parameter"))?;

        // Look up transaction in database
        let tx = ctx.chain.db.get_transaction_by_hash(tx_hash)
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;

        let result = match tx {
            Some(t) => {
                let stellar_url = t.stellar_tx_hash.as_ref().map(|h| {
                    format!("https://stellar.expert/explorer/testnet/tx/{}", h)
                });
                serde_json::json!({
                    "evmTxHash": t.hash,
                    "stellarTxHash": t.stellar_tx_hash,
                    "stellarExplorerUrl": stellar_url,
                    "status": t.status.as_str(),
                    "blockNumber": t.block_number
                })
            }
            None => {
                serde_json::json!({
                    "evmTxHash": tx_hash,
                    "error": "Transaction not found"
                })
            }
        };
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObject<'static>>(result)
    })?;

    // --- tva_account* methods (Account Registry) ---

    module.register_async_method("tva_getAccount", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        let evm_address = p.first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| jsonrpsee_error("Missing evm_address parameter"))?;
        let account = ctx.chain.db.get_account(evm_address)
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;
        let result = match account {
            Some(acc) => serde_json::json!({
                "evmAddress": acc.evm_address,
                "stellarAddress": acc.stellar_address,
                "nonce": format!("0x{:x}", acc.nonce),
                "funded": acc.funded,
                "registered": acc.registered,
                "createdAt": acc.created_at,
            }),
            None => serde_json::Value::Null,
        };
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(result)
    })?;

    module.register_async_method("tva_getAccountByStellar", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        let stellar_address = p.first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| jsonrpsee_error("Missing stellar_address parameter"))?;
        let account = ctx.chain.db.get_account_by_stellar(stellar_address)
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;
        let result = match account {
            Some(acc) => serde_json::json!({
                "evmAddress": acc.evm_address,
                "stellarAddress": acc.stellar_address,
                "nonce": format!("0x{:x}", acc.nonce),
                "funded": acc.funded,
                "registered": acc.registered,
                "createdAt": acc.created_at,
            }),
            None => serde_json::Value::Null,
        };
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(result)
    })?;

    module.register_async_method("tva_registerAccount", |params, ctx, _| async move {
        let p: Vec<serde_json::Value> = params.parse().unwrap_or_default();
        let evm_address = p.first()
            .and_then(|v| v.as_str())
            .ok_or_else(|| jsonrpsee_error("Missing evm_address parameter"))?;

        // Create mirror account (derives Stellar keypair, stores in DB)
        let account = ctx.chain.wallet_manager.ensure_account(evm_address)
            .await
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;

        // Mark as explicitly registered
        ctx.chain.db.set_account_registered(evm_address, true)
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;

        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(serde_json::json!({
            "evmAddress": account.evm_address,
            "stellarAddress": account.stellar_address,
            "registered": true,
        }))
    })?;

    module.register_async_method("tva_getRegistrationCount", |_params, ctx, _| async move {
        let count = ctx.chain.db.get_registration_count()
            .map_err(|e| jsonrpsee_error(&e.to_string()))?;
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(serde_json::json!({
            "count": count,
            "countHex": format!("0x{:x}", count),
        }))
    })?;

    // --- Additional compatibility methods ---

    module.register_async_method("eth_protocolVersion", |_params, _ctx, _| async move {
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(
            serde_json::Value::String("0x41".to_string()),
        )
    })?;

    module.register_async_method("eth_maxPriorityFeePerGas", |_params, _ctx, _| async move {
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(
            serde_json::Value::String("0x3b9aca00".to_string()),
        )
    })?;

    module.register_async_method("eth_feeHistory", |_params, _ctx, _| async move {
        let response = serde_json::json!({
            "baseFeePerGas": ["0x3b9aca00"],
            "gasUsedRatio": [0.5],
            "oldestBlock": "0x1",
            "reward": [["0x3b9aca00"]]
        });
        Ok::<serde_json::Value, jsonrpsee::types::ErrorObjectOwned>(response)
    })?;

    info!("Registered all RPC methods");
    Ok(())
}

/// Create a jsonrpsee error from a string message.
fn jsonrpsee_error(message: &str) -> jsonrpsee::types::ErrorObjectOwned {
    jsonrpsee::types::ErrorObjectOwned::owned(
        -32603,
        message.to_string(),
        None::<()>,
    )
}
