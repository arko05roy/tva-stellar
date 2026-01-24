use std::collections::VecDeque;
use tokio::sync::Mutex;
use anyhow::{anyhow, Result};

/// A pending transaction waiting to be included in a block
#[derive(Debug, Clone)]
pub struct PendingTx {
    pub hash: String,
    pub from_addr: String,
    pub to_addr: Option<String>,
    pub value: String,
    pub data: Vec<u8>,
    pub gas_limit: u64,
    pub gas_price: u64,
    pub nonce: u64,
    pub raw_tx: Vec<u8>,
    pub received_at: u64,
}

/// Transaction mempool - holds pending transactions before block inclusion
pub struct Mempool {
    pending: Mutex<VecDeque<PendingTx>>,
    max_size: usize,
}

impl Mempool {
    pub fn new(max_size: usize) -> Self {
        Self {
            pending: Mutex::new(VecDeque::new()),
            max_size,
        }
    }

    /// Add a transaction to the mempool
    pub async fn add_transaction(&self, tx: PendingTx) -> Result<()> {
        let mut pool = self.pending.lock().await;
        if pool.len() >= self.max_size {
            return Err(anyhow!("Mempool full ({} transactions)", self.max_size));
        }
        // Check for duplicates
        if pool.iter().any(|p| p.hash == tx.hash) {
            return Err(anyhow!("Transaction {} already in mempool", &tx.hash[..10]));
        }
        pool.push_back(tx);
        Ok(())
    }

    /// Drain all pending transactions for block production
    pub async fn drain_pending(&self) -> Vec<PendingTx> {
        let mut pool = self.pending.lock().await;
        pool.drain(..).collect()
    }

    /// Get current mempool size
    pub async fn size(&self) -> usize {
        let pool = self.pending.lock().await;
        pool.len()
    }

    /// Check if a transaction hash exists in the mempool
    pub async fn contains(&self, hash: &str) -> bool {
        let pool = self.pending.lock().await;
        pool.iter().any(|tx| tx.hash == hash)
    }

    /// Remove a specific transaction by hash
    pub async fn remove(&self, hash: &str) -> Option<PendingTx> {
        let mut pool = self.pending.lock().await;
        if let Some(pos) = pool.iter().position(|tx| tx.hash == hash) {
            pool.remove(pos)
        } else {
            None
        }
    }
}
