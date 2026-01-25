use anyhow::{Context, Result};
use std::env;

/// TVA RPC Server configuration loaded from environment variables.
#[derive(Debug, Clone)]
pub struct Config {
    /// Soroban RPC endpoint URL
    pub stellar_rpc_url: String,
    /// Stellar network passphrase
    pub stellar_network_passphrase: String,
    /// Stellar secret key for signing transactions
    pub stellar_secret_key: String,
    /// TVA chain ID (decimal)
    pub tva_chain_id: u64,
    /// RPC server port
    pub tva_rpc_port: u16,
    /// Log level
    pub log_level: String,
    /// Directory for TVA chain data (SQLite DB)
    pub tva_data_dir: String,
    /// Block production interval in milliseconds
    pub tva_block_interval_ms: u64,
    /// Stellar Friendbot URL for auto-funding mirror accounts
    pub stellar_friendbot_url: String,
    /// Master seed for deterministic wallet derivation
    pub tva_master_seed: Option<String>,
    /// Verification Registry contract ID on Stellar (optional)
    pub verification_registry_contract_id: Option<String>,
    /// Stellar account address (derived from secret key, for convenience)
    pub stellar_account_address: Option<String>,
    /// Stellar CLI identity name (for contract deployments)
    pub stellar_identity: String,
}

impl Config {
    /// Load configuration from environment variables.
    /// Call dotenvy::dotenv() before calling this.
    pub fn from_env() -> Result<Self> {
        let stellar_rpc_url = env::var("STELLAR_RPC_URL")
            .unwrap_or_else(|_| "https://soroban-testnet.stellar.org".to_string());

        let stellar_network_passphrase = env::var("STELLAR_NETWORK_PASSPHRASE")
            .unwrap_or_else(|_| "Test SDF Network ; September 2015".to_string());

        let stellar_secret_key = env::var("STELLAR_SECRET_KEY")
            .context("STELLAR_SECRET_KEY must be set in environment or .env file")?;

        let tva_chain_id: u64 = env::var("TVA_CHAIN_ID")
            .unwrap_or_else(|_| "1414676736".to_string())
            .parse()
            .context("TVA_CHAIN_ID must be a valid u64")?;

        let tva_rpc_port: u16 = env::var("TVA_RPC_PORT")
            .unwrap_or_else(|_| "8545".to_string())
            .parse()
            .context("TVA_RPC_PORT must be a valid u16")?;

        let log_level = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());

        let tva_data_dir = env::var("TVA_DATA_DIR")
            .unwrap_or_else(|_| "./tva_data".to_string());

        let tva_block_interval_ms: u64 = env::var("TVA_BLOCK_INTERVAL_MS")
            .unwrap_or_else(|_| "5000".to_string())
            .parse()
            .context("TVA_BLOCK_INTERVAL_MS must be a valid u64")?;

        let stellar_friendbot_url = env::var("STELLAR_FRIENDBOT_URL")
            .unwrap_or_else(|_| "https://friendbot.stellar.org".to_string());

        let tva_master_seed = env::var("TVA_MASTER_SEED").ok();

        let verification_registry_contract_id = env::var("VERIFICATION_REGISTRY_CONTRACT_ID").ok();
        let stellar_account_address = env::var("STELLAR_ACCOUNT_ADDRESS").ok();
        let stellar_identity = env::var("STELLAR_IDENTITY")
            .unwrap_or_else(|_| "tva-deployer".to_string());

        Ok(Config {
            stellar_rpc_url,
            stellar_network_passphrase,
            stellar_secret_key,
            tva_chain_id,
            tva_rpc_port,
            log_level,
            tva_data_dir,
            tva_block_interval_ms,
            stellar_friendbot_url,
            tva_master_seed,
            verification_registry_contract_id,
            stellar_account_address,
            stellar_identity,
        })
    }

    /// Return the chain ID as a hex string with 0x prefix
    pub fn chain_id_hex(&self) -> String {
        format!("0x{:x}", self.tva_chain_id)
    }
}
