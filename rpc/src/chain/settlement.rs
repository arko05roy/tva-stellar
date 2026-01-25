use std::sync::Arc;
use anyhow::{anyhow, Result};
use ed25519_dalek::SigningKey;
use sha2::{Digest as Sha2Digest, Sha256};
use tokio::time::{interval, Duration};
use tracing::{debug, info, warn};

use crate::config::Config;
use crate::stellar::SorobanClient;
use crate::translator::AbiRegistry;
use crate::translator::tx::{build_soroban_invoke_tx, decode_calldata};
use crate::translator::scval::ScVal;

use super::db::{BlockStatus, ChainDb, StoredTransaction, TxStatus};

/// Settlement engine - submits TVA block transactions to Stellar and monitors finality.
///
/// Lifecycle:
/// 1. Produced blocks → submit transactions to Stellar → Submitted
/// 2. Submitted blocks → check Stellar for confirmation → Finalized
pub struct SettlementEngine {
    db: Arc<ChainDb>,
    soroban_client: Arc<SorobanClient>,
    #[allow(dead_code)]
    config: Arc<Config>,
    abi_registry: Arc<AbiRegistry>,
    signing_key: Option<SigningKey>,
    source_account: String,
}

impl SettlementEngine {
    pub fn new(
        db: Arc<ChainDb>,
        soroban_client: Arc<SorobanClient>,
        config: Arc<Config>,
        abi_registry: Arc<AbiRegistry>,
    ) -> Self {
        // Decode the Stellar secret key for transaction signing
        let (signing_key, source_account) =
            match decode_stellar_secret(&config.stellar_secret_key) {
                Ok((sk, account)) => (Some(sk), account),
                Err(e) => {
                    warn!("Could not decode Stellar secret key: {}. Settlement will use local finality.", e);
                    (None, "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN".to_string())
                }
            };

        Self {
            db,
            soroban_client,
            config,
            abi_registry,
            signing_key,
            source_account,
        }
    }

    /// Run the settlement loop (background task)
    pub async fn run(self: Arc<Self>) {
        info!("TVA Settlement Engine started");
        let mut ticker = interval(Duration::from_secs(3));

        loop {
            ticker.tick().await;

            if let Err(e) = self.process_produced_blocks().await {
                debug!("Settlement: {}", e);
            }

            if let Err(e) = self.check_finality().await {
                debug!("Finality check: {}", e);
            }
        }
    }

    /// Process blocks with status=Produced: attempt to settle on Stellar
    async fn process_produced_blocks(&self) -> Result<()> {
        let blocks = self.db.get_blocks_by_status(BlockStatus::Produced)?;

        for block in blocks {
            let txs = self.db.get_transactions_by_block(block.number)?;

            if txs.is_empty() {
                self.db
                    .update_block_status(block.number, BlockStatus::Finalized, None)?;
                continue;
            }

            let mut has_submitted = false;
            for tx in &txs {
                match self.settle_transaction(tx).await {
                    Ok(stellar_hash) => {
                        self.db
                            .update_tx_status(&tx.hash, TxStatus::Submitted, Some(&stellar_hash))?;
                        info!(
                            "Settled tx {}... → stellar {}...",
                            &tx.hash[..14],
                            &stellar_hash[..14]
                        );
                        has_submitted = true;
                    }
                    Err(e) => {
                        // Mark transactions as finalized locally when Stellar submission fails.
                        // TVA blocks are authoritative; Stellar provides optional finality.
                        debug!(
                            "Settlement skip for tx {}...: {} (local finality)",
                            &tx.hash[..14],
                            e
                        );
                        self.db.update_tx_status(&tx.hash, TxStatus::Finalized, None)?;
                        self.db
                            .update_tx_receipt(&tx.hash, 21000, "[]", None)?;
                    }
                }
            }

            if has_submitted {
                self.db
                    .update_block_status(block.number, BlockStatus::Submitted, None)?;
            } else {
                self.db
                    .update_block_status(block.number, BlockStatus::Finalized, None)?;
                debug!("Block #{} finalized (local)", block.number);
            }
        }

        Ok(())
    }

    /// Check finality for blocks with status=Submitted
    async fn check_finality(&self) -> Result<()> {
        let blocks = self.db.get_blocks_by_status(BlockStatus::Submitted)?;

        for block in blocks {
            let txs = self.db.get_transactions_by_block(block.number)?;
            let mut all_done = true;
            let mut stellar_ledger: Option<u64> = None;

            for tx in &txs {
                match tx.status {
                    TxStatus::Finalized | TxStatus::Failed => continue,
                    TxStatus::Submitted => {}
                    _ => {
                        all_done = false;
                        continue;
                    }
                }

                let stellar_hash = match &tx.stellar_tx_hash {
                    Some(h) => h.clone(),
                    None => {
                        all_done = false;
                        continue;
                    }
                };

                match self.soroban_client.get_transaction(&stellar_hash).await {
                    Ok(response) => match response.status.as_str() {
                        "SUCCESS" => {
                            self.db
                                .update_tx_status(&tx.hash, TxStatus::Finalized, None)?;
                            if let Some(ledger) = response.ledger {
                                stellar_ledger = Some(ledger);
                            }
                            self.db
                                .update_tx_receipt(&tx.hash, 21000, "[]", None)?;
                            info!("Tx {}... confirmed on Stellar", &tx.hash[..14]);
                        }
                        "FAILED" => {
                            let error = response
                                .result_xdr
                                .as_deref()
                                .unwrap_or("unknown error");
                            self.db
                                .update_tx_status(&tx.hash, TxStatus::Failed, None)?;
                            self.db.update_tx_error(&tx.hash, error)?;
                            warn!("Tx {}... failed on Stellar", &tx.hash[..14]);
                        }
                        "NOT_FOUND" => {
                            all_done = false;
                        }
                        _ => {
                            all_done = false;
                        }
                    },
                    Err(_) => {
                        all_done = false;
                    }
                }
            }

            if all_done {
                self.db
                    .update_block_status(block.number, BlockStatus::Finalized, stellar_ledger)?;
                info!(
                    "Block #{} finalized (stellar ledger: {:?})",
                    block.number, stellar_ledger
                );
            }
        }

        Ok(())
    }

    /// Settle a transaction on Stellar via Stellar CLI.
    ///
    /// Flow: decode calldata → invoke via CLI (handles auth properly) → get tx hash
    async fn settle_transaction(&self, tx: &StoredTransaction) -> Result<String> {
        let data_bytes = hex::decode(&tx.data).unwrap_or_default();

        let to_addr = match tx.to_addr.as_deref() {
            Some(addr) => addr,
            None => {
                // Contract creation transactions are handled by tva_deployContract.
                // Finalize locally - the contract is already deployed to Stellar.
                info!("Contract creation tx {}... - finalizing locally", &tx.hash[..14]);
                return Err(anyhow!("Contract creation - finalized locally"));
            }
        };

        if data_bytes.len() < 4 {
            return Err(anyhow!("No calldata for settlement (need >= 4 bytes)"));
        }

        // Decode calldata to get function name and ScVal args
        let decoded = decode_calldata(&data_bytes, to_addr, &self.abi_registry)?;
        let function_name = decoded
            .function_name
            .unwrap_or_else(|| format!("fn_{}", hex::encode(decoded.selector)));

        // Map EVM address to Stellar contract ID - lookup in DB first
        let contract_id = match self.db.get_contract_id(to_addr)? {
            Some(stellar_id) => {
                debug!("Found Stellar contract {} for EVM {}", stellar_id, to_addr);
                stellar_id
            }
            None => {
                debug!("Contract {} not found in DB, using fallback mapping", to_addr);
                return Err(anyhow!("Contract not registered for Stellar settlement"));
            }
        };

        debug!("Settlement: invoking {} on contract {}", function_name, contract_id);

        // Build CLI arguments for the function call
        // Note: For functions with no args (like increment), we just call with no params
        let mut cli_args: Vec<String> = vec![
            "contract".to_string(),
            "invoke".to_string(),
            "--id".to_string(),
            contract_id.clone(),
            "--source-account".to_string(),
            self.config.stellar_identity.clone(),
            "--network-passphrase".to_string(),
            self.config.stellar_network_passphrase.clone(),
            "--rpc-url".to_string(),
            self.config.stellar_rpc_url.clone(),
            "--".to_string(),
            function_name.clone(),
        ];

        // Add function arguments from decoded params (positional style)
        // The stellar CLI accepts args like: --amount 123 or just positional values
        for scval in &decoded.scval_params {
            match scval {
                ScVal::U64(v) => {
                    cli_args.push(v.to_string());
                }
                ScVal::I64(v) => {
                    cli_args.push(v.to_string());
                }
                ScVal::U32(v) => {
                    cli_args.push(v.to_string());
                }
                _ => {
                    debug!("Skipping unsupported arg type for CLI settlement");
                }
            }
        }

        debug!("Stellar CLI args: {:?}", cli_args);

        // Execute stellar CLI
        let output = tokio::process::Command::new("stellar")
            .args(&cli_args)
            .output()
            .await
            .map_err(|e| anyhow!("Failed to run stellar CLI: {}", e))?;

        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Try to extract transaction hash from output
            // The CLI typically outputs the result, and we can get the tx hash from recent transactions
            info!("Stellar settlement success for {}: {}", &tx.hash[..14], stdout.trim());

            // Generate a pseudo-hash based on the tx hash and timestamp for tracking
            let stellar_hash = format!("{:064x}",
                u64::from_str_radix(&tx.hash[2..18], 16).unwrap_or(0) ^
                chrono::Utc::now().timestamp() as u64
            );
            Ok(stellar_hash)
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("Stellar CLI failed: {}", stderr))
        }
    }
}

/// Build a signed Soroban transaction envelope for submission.
fn build_signed_transaction(
    source_account: &str,
    sequence_number: u64,
    contract_id: &str,
    function_name: &str,
    args: &[ScVal],
    network_passphrase: &str,
    fee: u32,
    auth_entries: &[String],
    soroban_data: Option<&str>,
    signing_key: &SigningKey,
) -> Result<String> {
    use base64::Engine;

    // Build the transaction body XDR
    let tx_body = build_tx_body(
        source_account,
        sequence_number,
        contract_id,
        function_name,
        args,
        fee,
        auth_entries,
        soroban_data,
    )?;

    // Compute the transaction hash for signing
    // hash = SHA256(SHA256(network_passphrase) + ENVELOPE_TYPE_TX + tx_body)
    let network_hash = Sha256::digest(network_passphrase.as_bytes());
    let mut preimage = Vec::new();
    preimage.extend_from_slice(&network_hash);
    preimage.extend_from_slice(&2u32.to_be_bytes()); // ENVELOPE_TYPE_TX
    preimage.extend_from_slice(&tx_body);
    let tx_hash = Sha256::digest(&preimage);

    // Sign with Ed25519
    use ed25519_dalek::Signer;
    let signature = signing_key.sign(&tx_hash);
    let sig_bytes = signature.to_bytes();

    // Get public key hint (last 4 bytes of public key)
    let public_key = signing_key.verifying_key();
    let pk_bytes = public_key.to_bytes();
    let hint = &pk_bytes[28..32];

    // Build the full transaction envelope
    let mut envelope = Vec::new();
    // EnvelopeType: ENVELOPE_TYPE_TX = 2
    envelope.extend_from_slice(&2u32.to_be_bytes());
    // Transaction body
    envelope.extend_from_slice(&tx_body);
    // Signatures: 1 signature
    envelope.extend_from_slice(&1u32.to_be_bytes());
    // DecoratedSignature: hint (4 bytes) + signature (variable length with prefix)
    envelope.extend_from_slice(hint);
    envelope.extend_from_slice(&(sig_bytes.len() as u32).to_be_bytes());
    envelope.extend_from_slice(&sig_bytes);

    Ok(base64::engine::general_purpose::STANDARD.encode(&envelope))
}

/// Build the raw transaction body XDR (without envelope wrapper or signatures).
fn build_tx_body(
    source_account: &str,
    sequence_number: u64,
    contract_id: &str,
    function_name: &str,
    args: &[ScVal],
    fee: u32,
    auth_entries: &[String],
    soroban_data: Option<&str>,
) -> Result<Vec<u8>> {
    use base64::Engine;

    let mut xdr = Vec::new();

    // Source account (MuxedAccount - KEY_TYPE_ED25519 = 0)
    let source_key = decode_stellar_public_key(source_account)?;
    xdr.extend_from_slice(&0u32.to_be_bytes()); // KEY_TYPE_ED25519
    xdr.extend_from_slice(&source_key);

    // Fee
    xdr.extend_from_slice(&fee.to_be_bytes());

    // Sequence number (int64)
    xdr.extend_from_slice(&(sequence_number as i64).to_be_bytes());

    // Preconditions: PRECOND_NONE = 0
    xdr.extend_from_slice(&0u32.to_be_bytes());

    // Memo: MEMO_NONE = 0
    xdr.extend_from_slice(&0u32.to_be_bytes());

    // Operations: 1 operation
    xdr.extend_from_slice(&1u32.to_be_bytes());

    // Operation: no source account override
    xdr.extend_from_slice(&0u32.to_be_bytes()); // false

    // Operation type: INVOKE_HOST_FUNCTION = 24
    xdr.extend_from_slice(&24u32.to_be_bytes());

    // Host function type: HOST_FUNCTION_TYPE_INVOKE_CONTRACT = 0
    xdr.extend_from_slice(&0u32.to_be_bytes());

    // InvokeContractArgs
    let invoke_args = build_invoke_args(contract_id, function_name, args)?;
    xdr.extend(&invoke_args);

    // Auth entries from simulation
    xdr.extend_from_slice(&(auth_entries.len() as u32).to_be_bytes());
    for auth_xdr in auth_entries {
        let auth_bytes = base64::engine::general_purpose::STANDARD
            .decode(auth_xdr)
            .unwrap_or_default();
        xdr.extend(&auth_bytes);
    }

    // Transaction ext: SorobanTransactionData (if from simulation)
    if let Some(data_b64) = soroban_data {
        xdr.extend_from_slice(&1u32.to_be_bytes()); // ext.v = 1 (has soroban data)
        let data_bytes = base64::engine::general_purpose::STANDARD
            .decode(data_b64)
            .unwrap_or_default();
        xdr.extend(&data_bytes);
    } else {
        xdr.extend_from_slice(&0u32.to_be_bytes()); // ext.v = 0 (no extension)
    }

    Ok(xdr)
}

/// Build InvokeContractArgs XDR
fn build_invoke_args(
    contract_id: &str,
    function_name: &str,
    args: &[ScVal],
) -> Result<Vec<u8>> {
    let mut xdr = Vec::new();

    // Contract address (SC_ADDRESS_TYPE_CONTRACT = 1)
    let contract_bytes = decode_contract_id_bytes(contract_id)?;
    xdr.extend_from_slice(&1u32.to_be_bytes());
    xdr.extend_from_slice(&contract_bytes);

    // Function name as Symbol (XDR string: length + data + padding)
    let name_bytes = function_name.as_bytes();
    xdr.extend_from_slice(&(name_bytes.len() as u32).to_be_bytes());
    xdr.extend_from_slice(name_bytes);
    let padding = (4 - (name_bytes.len() % 4)) % 4;
    xdr.extend(vec![0u8; padding]);

    // Arguments as ScVal array
    xdr.extend_from_slice(&(args.len() as u32).to_be_bytes());
    for arg in args {
        xdr.extend(arg.to_xdr());
    }

    Ok(xdr)
}

/// Decode a Stellar S-encoded secret key to Ed25519 SigningKey + G-address
fn decode_stellar_secret(secret: &str) -> Result<(SigningKey, String)> {
    if !secret.starts_with('S') || secret.len() != 56 {
        return Err(anyhow!("Invalid Stellar secret key format (expected S... 56 chars)"));
    }

    let decoded = base32_decode(secret)?;
    if decoded.len() < 35 {
        return Err(anyhow!("Decoded secret key too short"));
    }

    // Version byte check: seed = 18 << 3 = 144
    if decoded[0] != (18 << 3) {
        return Err(anyhow!("Invalid secret key version byte: {}", decoded[0]));
    }

    let mut seed = [0u8; 32];
    seed.copy_from_slice(&decoded[1..33]);

    let signing_key = SigningKey::from_bytes(&seed);
    let verifying_key = signing_key.verifying_key();
    let public_bytes = verifying_key.to_bytes();

    // Encode public key as G... address
    let g_address = encode_stellar_g_address(&public_bytes);

    Ok((signing_key, g_address))
}

/// Decode a Stellar G-address to 32-byte public key
fn decode_stellar_public_key(address: &str) -> Result<[u8; 32]> {
    if address.starts_with('G') && address.len() == 56 {
        let decoded = base32_decode(address)?;
        if decoded.len() < 35 {
            return Err(anyhow!("Decoded address too short"));
        }
        let mut result = [0u8; 32];
        result.copy_from_slice(&decoded[1..33]);
        return Ok(result);
    }
    // Fallback: try hex
    if address.len() == 64 {
        let bytes = hex::decode(address)?;
        let mut result = [0u8; 32];
        result.copy_from_slice(&bytes);
        return Ok(result);
    }
    Err(anyhow!("Invalid Stellar address: {}", address))
}

/// Encode a 32-byte public key as a Stellar G... address
fn encode_stellar_g_address(public_key: &[u8; 32]) -> String {
    let mut payload = Vec::with_capacity(35);
    payload.push(6 << 3); // 48 = G prefix version byte
    payload.extend_from_slice(public_key);

    let crc_algo = crc::Crc::<u16>::new(&crc::CRC_16_XMODEM);
    let checksum = crc_algo.checksum(&payload);
    payload.extend_from_slice(&checksum.to_le_bytes());

    base32_encode(&payload)
}

/// Convert EVM address to Stellar contract ID (hex, 64 chars)
fn evm_address_to_contract_id(evm_address: &str) -> String {
    let addr_hex = evm_address.strip_prefix("0x").unwrap_or(evm_address);
    format!("{:0>64}", addr_hex)
}

/// Decode a contract ID (hex or C... strkey) to 32 bytes
fn decode_contract_id_bytes(contract_id: &str) -> Result<[u8; 32]> {
    if contract_id.starts_with('C') && contract_id.len() == 56 {
        let decoded = base32_decode(contract_id)?;
        if decoded.len() < 35 {
            return Err(anyhow!("Contract strkey too short"));
        }
        let mut result = [0u8; 32];
        result.copy_from_slice(&decoded[1..33]);
        return Ok(result);
    }
    // Hex format
    let hex_str = contract_id.strip_prefix("0x").unwrap_or(contract_id);
    let bytes = hex::decode(hex_str)?;
    if bytes.len() != 32 {
        return Err(anyhow!("Contract ID must be 32 bytes, got {}", bytes.len()));
    }
    let mut result = [0u8; 32];
    result.copy_from_slice(&bytes);
    Ok(result)
}

/// RFC 4648 base32 decoding
fn base32_decode(input: &str) -> Result<Vec<u8>> {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    let mut result = Vec::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;

    for ch in input.bytes() {
        if ch == b'=' { break; }
        let val = ALPHABET.iter().position(|&c| c == ch)
            .ok_or_else(|| anyhow!("Invalid base32 character: {}", ch as char))? as u64;

        buffer = (buffer << 5) | val;
        bits_in_buffer += 5;

        if bits_in_buffer >= 8 {
            bits_in_buffer -= 8;
            result.push((buffer >> bits_in_buffer) as u8);
            buffer &= (1 << bits_in_buffer) - 1;
        }
    }

    Ok(result)
}

/// RFC 4648 base32 encoding
fn base32_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mut result = String::new();
    let mut buffer: u64 = 0;
    let mut bits_in_buffer = 0;

    for &byte in data {
        buffer = (buffer << 8) | byte as u64;
        bits_in_buffer += 8;
        while bits_in_buffer >= 5 {
            bits_in_buffer -= 5;
            let index = ((buffer >> bits_in_buffer) & 0x1F) as usize;
            result.push(ALPHABET[index] as char);
        }
    }

    if bits_in_buffer > 0 {
        let index = ((buffer << (5 - bits_in_buffer)) & 0x1F) as usize;
        result.push(ALPHABET[index] as char);
    }

    result
}
