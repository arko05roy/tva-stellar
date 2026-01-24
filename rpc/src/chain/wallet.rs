use std::sync::Arc;
use anyhow::Result;
use ed25519_dalek::SigningKey;
use sha2::{Digest, Sha256};
use tracing::{info, warn};

use super::db::{ChainDb, StoredAccount};

/// Manages wallet mirroring: EVM address → Stellar keypair
pub struct WalletManager {
    db: Arc<ChainDb>,
    http_client: reqwest::Client,
    friendbot_url: String,
    master_seed: Vec<u8>,
}

impl WalletManager {
    pub fn new(db: Arc<ChainDb>, friendbot_url: &str, master_seed: Option<&str>) -> Self {
        let seed = master_seed
            .map(|s| {
                let mut hasher = Sha256::new();
                hasher.update(s.as_bytes());
                hasher.finalize().to_vec()
            })
            .unwrap_or_else(|| {
                // Default deterministic seed
                let mut hasher = Sha256::new();
                hasher.update(b"tva-protocol-default-seed-v1");
                hasher.finalize().to_vec()
            });

        Self {
            db,
            http_client: reqwest::Client::new(),
            friendbot_url: friendbot_url.to_string(),
            master_seed: seed,
        }
    }

    /// Ensure an account exists for the given EVM address.
    /// Creates a mirrored Stellar wallet if this is a new address.
    pub async fn ensure_account(&self, evm_address: &str) -> Result<StoredAccount> {
        let normalized = evm_address.to_lowercase();

        // Check if already registered
        if let Some(account) = self.db.get_account(&normalized)? {
            return Ok(account);
        }

        // Derive Stellar keypair from EVM address
        let (public_key_hex, stellar_address) = self.derive_keypair(&normalized);

        let now = chrono::Utc::now().timestamp() as u64;
        let account = StoredAccount {
            evm_address: normalized.clone(),
            stellar_address: stellar_address.clone(),
            stellar_public_key: public_key_hex,
            nonce: 0,
            funded: false,
            registered: true,
            created_at: now,
        };

        self.db.insert_account(&account)?;
        info!(
            "Created mirror wallet: {} -> {}",
            &normalized[..10],
            &stellar_address[..10]
        );

        // Fund via friendbot (best-effort, don't block)
        let url = self.friendbot_url.clone();
        let addr = stellar_address.clone();
        let client = self.http_client.clone();
        let db = self.db.clone();
        let evm_addr = normalized.clone();
        tokio::spawn(async move {
            fund_account(&client, &url, &addr, &db, &evm_addr).await;
        });

        Ok(account)
    }

    /// Derive a Stellar Ed25519 keypair deterministically from an EVM address
    fn derive_keypair(&self, evm_address: &str) -> (String, String) {
        // HMAC-SHA256(master_seed, evm_address) → 32-byte private key seed
        let mut hasher = Sha256::new();
        hasher.update(&self.master_seed);
        hasher.update(evm_address.as_bytes());
        let seed_bytes = hasher.finalize();

        let seed_array: [u8; 32] = seed_bytes.into();
        let signing_key = SigningKey::from_bytes(&seed_array);
        let verifying_key = signing_key.verifying_key();
        let public_bytes = verifying_key.to_bytes();

        let public_key_hex = hex::encode(public_bytes);
        let stellar_address = encode_stellar_address(&public_bytes);

        (public_key_hex, stellar_address)
    }
}

/// Fund a Stellar account via Friendbot (testnet)
async fn fund_account(
    client: &reqwest::Client,
    friendbot_url: &str,
    stellar_address: &str,
    db: &ChainDb,
    evm_address: &str,
) {
    let url = format!("{}?addr={}", friendbot_url, stellar_address);
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            info!("Funded mirror wallet {} via friendbot", &stellar_address[..10]);
            let _ = db.set_account_funded(evm_address, true);
        }
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if body.contains("createAccountAlreadyExist") || body.contains("already exists") {
                info!("Mirror wallet {} already funded", &stellar_address[..10]);
                let _ = db.set_account_funded(evm_address, true);
            } else {
                warn!(
                    "Friendbot returned {} for {}: {}",
                    status,
                    &stellar_address[..10],
                    &body[..body.len().min(100)]
                );
            }
        }
        Err(e) => {
            warn!(
                "Failed to fund mirror wallet {} via friendbot: {}",
                &stellar_address[..10],
                e
            );
        }
    }
}

/// Encode a 32-byte Ed25519 public key as a Stellar G... address
fn encode_stellar_address(public_key: &[u8; 32]) -> String {
    // Stellar address format: version_byte + 32-byte key + 2-byte CRC16-XMODEM checksum
    // Version byte for ED25519_PUBLIC_KEY = 6 << 3 = 48
    let mut payload = Vec::with_capacity(35);
    payload.push(6 << 3); // 48 = G prefix in base32
    payload.extend_from_slice(public_key);

    // CRC16-XMODEM checksum over version + key
    let crc_algo = crc::Crc::<u16>::new(&crc::CRC_16_XMODEM);
    let checksum = crc_algo.checksum(&payload);
    payload.extend_from_slice(&checksum.to_le_bytes());

    // Encode as base32 (Stellar uses RFC 4648 base32 without padding)
    base32_encode(&payload)
}

/// RFC 4648 base32 encoding (uppercase, no padding)
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
