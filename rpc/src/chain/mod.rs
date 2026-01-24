//! TVA Chain - Thin execution layer with Stellar settlement
//!
//! This module implements TVA's own block production, state management,
//! and settlement on Stellar. Transaction lifecycle:
//!
//! 1. Transaction enters mempool via eth_sendRawTransaction
//! 2. Sequencer produces blocks every 5s from pending transactions
//! 3. Settlement engine submits block transactions to Stellar
//! 4. Finality monitor confirms transactions on Stellar
//! 5. Block status: produced → submitted → finalized

pub mod db;
pub mod mempool;
pub mod sequencer;
pub mod settlement;
pub mod wallet;

use std::sync::Arc;

pub use db::ChainDb;
pub use mempool::Mempool;
pub use sequencer::Sequencer;
pub use settlement::SettlementEngine;
pub use wallet::WalletManager;

/// Shared chain state accessible from RPC handlers
pub struct ChainState {
    pub db: Arc<ChainDb>,
    pub mempool: Arc<Mempool>,
    pub wallet_manager: Arc<WalletManager>,
}
