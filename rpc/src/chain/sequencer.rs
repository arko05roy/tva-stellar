use std::sync::Arc;
use anyhow::Result;
use sha3::{Digest, Keccak256};
use tokio::time::{interval, Duration};
use tracing::{error, info};

use super::db::{BlockStatus, ChainDb, StoredBlock};
use super::mempool::Mempool;

/// Block producer - creates TVA blocks from pending mempool transactions
pub struct Sequencer {
    db: Arc<ChainDb>,
    mempool: Arc<Mempool>,
    block_interval: Duration,
}

impl Sequencer {
    pub fn new(db: Arc<ChainDb>, mempool: Arc<Mempool>, block_interval_ms: u64) -> Self {
        Self {
            db,
            mempool,
            block_interval: Duration::from_millis(block_interval_ms),
        }
    }

    /// Start the block production loop (runs forever as a background task)
    pub async fn run(self: Arc<Self>) {
        info!(
            "TVA Sequencer started (block interval: {:?})",
            self.block_interval
        );
        let mut ticker = interval(self.block_interval);

        loop {
            ticker.tick().await;
            if let Err(e) = self.produce_block().await {
                error!("Block production failed: {}", e);
            }
        }
    }

    /// Produce a single block (empty or with transactions)
    /// Blockscout and other indexers need a progressing block height
    async fn produce_block(&self) -> Result<()> {
        let pending_txs = self.mempool.drain_pending().await;

        let parent_number = self.db.get_latest_block_number()?;
        let new_number = parent_number + 1;

        let parent_hash = self
            .db
            .get_block_by_number(parent_number)?
            .map(|b| b.hash.clone())
            .unwrap_or_else(|| format!("0x{}", "0".repeat(64)));

        let timestamp = chrono::Utc::now().timestamp() as u64;
        let tx_count = pending_txs.len() as u32;
        let gas_used: u64 = pending_txs.iter().map(|tx| tx.gas_limit.min(100_000)).sum();

        let block_hash = generate_block_hash(new_number, &parent_hash, timestamp);

        let block = StoredBlock {
            number: new_number,
            hash: block_hash.clone(),
            parent_hash,
            timestamp,
            tx_count,
            gas_used,
            status: BlockStatus::Produced,
            stellar_ledger: None,
            created_at: timestamp,
        };

        self.db.insert_block(&block)?;

        // Assign each pending transaction to this block
        for (idx, pending_tx) in pending_txs.iter().enumerate() {
            self.db
                .update_tx_included(&pending_tx.hash, new_number, idx as u32)?;
        }

        info!(
            "Block #{} produced: {} txs, gas_used={}, hash={}...",
            new_number,
            tx_count,
            gas_used,
            &block_hash[..14]
        );

        Ok(())
    }
}

/// Create the genesis block (block 0)
pub fn create_genesis_block(db: &ChainDb) -> Result<()> {
    let timestamp = chrono::Utc::now().timestamp() as u64;
    let parent_hash = format!("0x{}", "0".repeat(64));
    let hash = generate_block_hash(0, &parent_hash, timestamp);

    let genesis = StoredBlock {
        number: 0,
        hash,
        parent_hash,
        timestamp,
        tx_count: 0,
        gas_used: 0,
        status: BlockStatus::Finalized,
        stellar_ledger: None,
        created_at: timestamp,
    };

    db.insert_block(&genesis)?;
    info!("Genesis block created");
    Ok(())
}

/// Generate a deterministic block hash from block properties
pub fn generate_block_hash(number: u64, parent_hash: &str, timestamp: u64) -> String {
    let mut hasher = Keccak256::new();
    hasher.update(b"TVA_BLOCK_");
    hasher.update(number.to_be_bytes());
    hasher.update(parent_hash.as_bytes());
    hasher.update(timestamp.to_be_bytes());
    format!("0x{}", hex::encode(hasher.finalize()))
}
