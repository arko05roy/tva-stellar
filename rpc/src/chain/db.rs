use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::sync::Mutex;
use tracing::info;

/// Block status lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BlockStatus {
    Produced,
    Submitted,
    Finalized,
    Failed,
}

impl BlockStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Produced => "produced",
            Self::Submitted => "submitted",
            Self::Finalized => "finalized",
            Self::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "produced" => Self::Produced,
            "submitted" => Self::Submitted,
            "finalized" => Self::Finalized,
            "failed" => Self::Failed,
            _ => Self::Produced,
        }
    }
}

/// Transaction status lifecycle
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TxStatus {
    Pending,
    Included,
    Submitted,
    Finalized,
    Failed,
}

impl TxStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Pending => "pending",
            Self::Included => "included",
            Self::Submitted => "submitted",
            Self::Finalized => "finalized",
            Self::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "pending" => Self::Pending,
            "included" => Self::Included,
            "submitted" => Self::Submitted,
            "finalized" => Self::Finalized,
            "failed" => Self::Failed,
            _ => Self::Pending,
        }
    }
}

/// Stored block record
#[derive(Debug, Clone)]
pub struct StoredBlock {
    pub number: u64,
    pub hash: String,
    pub parent_hash: String,
    pub timestamp: u64,
    pub tx_count: u32,
    pub gas_used: u64,
    pub status: BlockStatus,
    pub stellar_ledger: Option<u64>,
    pub created_at: u64,
}

/// Stored transaction record
#[derive(Debug, Clone)]
pub struct StoredTransaction {
    pub hash: String,
    pub block_number: Option<u64>,
    pub tx_index: u32,
    pub from_addr: String,
    pub to_addr: Option<String>,
    pub value: String,
    pub data: String,
    pub gas_limit: u64,
    pub gas_price: u64,
    pub nonce: u64,
    pub status: TxStatus,
    pub stellar_tx_hash: Option<String>,
    pub contract_address: Option<String>,
    pub gas_used: Option<u64>,
    pub logs_json: Option<String>,
    pub error: Option<String>,
    pub created_at: u64,
}

/// Stored account record
#[derive(Debug, Clone)]
pub struct StoredAccount {
    pub evm_address: String,
    pub stellar_address: String,
    pub stellar_public_key: String,
    pub nonce: u64,
    pub funded: bool,
    pub registered: bool,
    pub created_at: u64,
}

/// TVA chain state database backed by SQLite
pub struct ChainDb {
    conn: Mutex<Connection>,
}

impl ChainDb {
    /// Open or create the database at the given path
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)
            .with_context(|| format!("Failed to open chain database at {}", path))?;

        // Enable WAL mode for better concurrent read performance
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;

        Self::init_schema(&conn)?;
        info!("Chain database opened at {}", path);

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    fn init_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS blocks (
                number INTEGER PRIMARY KEY,
                hash TEXT NOT NULL UNIQUE,
                parent_hash TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                tx_count INTEGER NOT NULL DEFAULT 0,
                gas_used INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'produced',
                stellar_ledger INTEGER,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS transactions (
                hash TEXT PRIMARY KEY,
                block_number INTEGER,
                tx_index INTEGER NOT NULL DEFAULT 0,
                from_addr TEXT NOT NULL,
                to_addr TEXT,
                value TEXT NOT NULL DEFAULT '0',
                data TEXT NOT NULL DEFAULT '',
                gas_limit INTEGER NOT NULL DEFAULT 21000,
                gas_price INTEGER NOT NULL DEFAULT 0,
                nonce INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pending',
                stellar_tx_hash TEXT,
                contract_address TEXT,
                gas_used INTEGER,
                logs_json TEXT,
                error TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS accounts (
                evm_address TEXT PRIMARY KEY,
                stellar_address TEXT NOT NULL,
                stellar_public_key TEXT NOT NULL,
                nonce INTEGER NOT NULL DEFAULT 0,
                funded INTEGER NOT NULL DEFAULT 0,
                registered INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS contracts (
                evm_address TEXT PRIMARY KEY,
                stellar_contract_id TEXT NOT NULL,
                contract_name TEXT,
                abi_json TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_tx_block ON transactions(block_number);
            CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
            CREATE INDEX IF NOT EXISTS idx_tx_from ON transactions(from_addr);
            CREATE INDEX IF NOT EXISTS idx_block_status ON blocks(status);
            CREATE INDEX IF NOT EXISTS idx_account_stellar ON accounts(stellar_address);
            CREATE INDEX IF NOT EXISTS idx_contract_stellar ON contracts(stellar_contract_id);
            ",
        )?;
        Ok(())
    }

    // --- Block operations ---

    pub fn insert_block(&self, block: &StoredBlock) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO blocks (number, hash, parent_hash, timestamp, tx_count, gas_used, status, stellar_ledger, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                block.number as i64,
                block.hash,
                block.parent_hash,
                block.timestamp as i64,
                block.tx_count as i64,
                block.gas_used as i64,
                block.status.as_str(),
                block.stellar_ledger.map(|l| l as i64),
                block.created_at as i64,
            ],
        )?;
        Ok(())
    }

    pub fn get_block_by_number(&self, number: u64) -> Result<Option<StoredBlock>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT number, hash, parent_hash, timestamp, tx_count, gas_used, status, stellar_ledger, created_at
             FROM blocks WHERE number = ?1",
        )?;
        let result = stmt
            .query_row(params![number as i64], |row| {
                Ok(StoredBlock {
                    number: row.get::<_, i64>(0)? as u64,
                    hash: row.get(1)?,
                    parent_hash: row.get(2)?,
                    timestamp: row.get::<_, i64>(3)? as u64,
                    tx_count: row.get::<_, i64>(4)? as u32,
                    gas_used: row.get::<_, i64>(5)? as u64,
                    status: BlockStatus::from_str(&row.get::<_, String>(6)?),
                    stellar_ledger: row.get::<_, Option<i64>>(7)?.map(|l| l as u64),
                    created_at: row.get::<_, i64>(8)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn get_block_by_hash(&self, hash: &str) -> Result<Option<StoredBlock>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT number, hash, parent_hash, timestamp, tx_count, gas_used, status, stellar_ledger, created_at
             FROM blocks WHERE hash = ?1",
        )?;
        let result = stmt
            .query_row(params![hash], |row| {
                Ok(StoredBlock {
                    number: row.get::<_, i64>(0)? as u64,
                    hash: row.get(1)?,
                    parent_hash: row.get(2)?,
                    timestamp: row.get::<_, i64>(3)? as u64,
                    tx_count: row.get::<_, i64>(4)? as u32,
                    gas_used: row.get::<_, i64>(5)? as u64,
                    status: BlockStatus::from_str(&row.get::<_, String>(6)?),
                    stellar_ledger: row.get::<_, Option<i64>>(7)?.map(|l| l as u64),
                    created_at: row.get::<_, i64>(8)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn get_latest_block_number(&self) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let result: i64 = conn
            .query_row("SELECT COALESCE(MAX(number), 0) FROM blocks", [], |row| {
                row.get(0)
            })?;
        Ok(result as u64)
    }

    pub fn update_block_status(
        &self,
        number: u64,
        status: BlockStatus,
        stellar_ledger: Option<u64>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE blocks SET status = ?1, stellar_ledger = ?2 WHERE number = ?3",
            params![
                status.as_str(),
                stellar_ledger.map(|l| l as i64),
                number as i64,
            ],
        )?;
        Ok(())
    }

    pub fn get_blocks_by_status(&self, status: BlockStatus) -> Result<Vec<StoredBlock>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT number, hash, parent_hash, timestamp, tx_count, gas_used, status, stellar_ledger, created_at
             FROM blocks WHERE status = ?1 ORDER BY number ASC",
        )?;
        let blocks = stmt
            .query_map(params![status.as_str()], |row| {
                Ok(StoredBlock {
                    number: row.get::<_, i64>(0)? as u64,
                    hash: row.get(1)?,
                    parent_hash: row.get(2)?,
                    timestamp: row.get::<_, i64>(3)? as u64,
                    tx_count: row.get::<_, i64>(4)? as u32,
                    gas_used: row.get::<_, i64>(5)? as u64,
                    status: BlockStatus::from_str(&row.get::<_, String>(6)?),
                    stellar_ledger: row.get::<_, Option<i64>>(7)?.map(|l| l as u64),
                    created_at: row.get::<_, i64>(8)? as u64,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(blocks)
    }

    // --- Transaction operations ---

    pub fn insert_transaction(&self, tx: &StoredTransaction) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO transactions
             (hash, block_number, tx_index, from_addr, to_addr, value, data, gas_limit, gas_price, nonce, status, stellar_tx_hash, contract_address, gas_used, logs_json, error, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)",
            params![
                tx.hash,
                tx.block_number.map(|n| n as i64),
                tx.tx_index as i64,
                tx.from_addr,
                tx.to_addr,
                tx.value,
                tx.data,
                tx.gas_limit as i64,
                tx.gas_price as i64,
                tx.nonce as i64,
                tx.status.as_str(),
                tx.stellar_tx_hash,
                tx.contract_address,
                tx.gas_used.map(|g| g as i64),
                tx.logs_json,
                tx.error,
                tx.created_at as i64,
            ],
        )?;
        Ok(())
    }

    pub fn get_transaction_by_hash(&self, hash: &str) -> Result<Option<StoredTransaction>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT hash, block_number, tx_index, from_addr, to_addr, value, data, gas_limit, gas_price, nonce, status, stellar_tx_hash, contract_address, gas_used, logs_json, error, created_at
             FROM transactions WHERE hash = ?1",
        )?;
        let result = stmt
            .query_row(params![hash], |row| {
                Ok(StoredTransaction {
                    hash: row.get(0)?,
                    block_number: row.get::<_, Option<i64>>(1)?.map(|n| n as u64),
                    tx_index: row.get::<_, i64>(2)? as u32,
                    from_addr: row.get(3)?,
                    to_addr: row.get(4)?,
                    value: row.get(5)?,
                    data: row.get(6)?,
                    gas_limit: row.get::<_, i64>(7)? as u64,
                    gas_price: row.get::<_, i64>(8)? as u64,
                    nonce: row.get::<_, i64>(9)? as u64,
                    status: TxStatus::from_str(&row.get::<_, String>(10)?),
                    stellar_tx_hash: row.get(11)?,
                    contract_address: row.get(12)?,
                    gas_used: row.get::<_, Option<i64>>(13)?.map(|g| g as u64),
                    logs_json: row.get(14)?,
                    error: row.get(15)?,
                    created_at: row.get::<_, i64>(16)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn get_transactions_by_block(&self, block_number: u64) -> Result<Vec<StoredTransaction>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT hash, block_number, tx_index, from_addr, to_addr, value, data, gas_limit, gas_price, nonce, status, stellar_tx_hash, contract_address, gas_used, logs_json, error, created_at
             FROM transactions WHERE block_number = ?1 ORDER BY tx_index ASC",
        )?;
        let txs = stmt
            .query_map(params![block_number as i64], |row| {
                Ok(StoredTransaction {
                    hash: row.get(0)?,
                    block_number: row.get::<_, Option<i64>>(1)?.map(|n| n as u64),
                    tx_index: row.get::<_, i64>(2)? as u32,
                    from_addr: row.get(3)?,
                    to_addr: row.get(4)?,
                    value: row.get(5)?,
                    data: row.get(6)?,
                    gas_limit: row.get::<_, i64>(7)? as u64,
                    gas_price: row.get::<_, i64>(8)? as u64,
                    nonce: row.get::<_, i64>(9)? as u64,
                    status: TxStatus::from_str(&row.get::<_, String>(10)?),
                    stellar_tx_hash: row.get(11)?,
                    contract_address: row.get(12)?,
                    gas_used: row.get::<_, Option<i64>>(13)?.map(|g| g as u64),
                    logs_json: row.get(14)?,
                    error: row.get(15)?,
                    created_at: row.get::<_, i64>(16)? as u64,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;
        Ok(txs)
    }

    pub fn get_transaction_by_block_and_index(&self, block_number: u64, tx_index: u32) -> Result<Option<StoredTransaction>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT hash, block_number, tx_index, from_addr, to_addr, value, data, gas_limit, gas_price, nonce, status, stellar_tx_hash, contract_address, gas_used, logs_json, error, created_at
             FROM transactions WHERE block_number = ?1 AND tx_index = ?2",
        )?;
        let result = stmt
            .query_row(params![block_number as i64, tx_index as i64], |row| {
                Ok(StoredTransaction {
                    hash: row.get(0)?,
                    block_number: row.get::<_, Option<i64>>(1)?.map(|n| n as u64),
                    tx_index: row.get::<_, i64>(2)? as u32,
                    from_addr: row.get(3)?,
                    to_addr: row.get(4)?,
                    value: row.get(5)?,
                    data: row.get(6)?,
                    gas_limit: row.get::<_, i64>(7)? as u64,
                    gas_price: row.get::<_, i64>(8)? as u64,
                    nonce: row.get::<_, i64>(9)? as u64,
                    status: TxStatus::from_str(&row.get::<_, String>(10)?),
                    stellar_tx_hash: row.get(11)?,
                    contract_address: row.get(12)?,
                    gas_used: row.get::<_, Option<i64>>(13)?.map(|g| g as u64),
                    logs_json: row.get(14)?,
                    error: row.get(15)?,
                    created_at: row.get::<_, i64>(16)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn get_block_transaction_count(&self, block_number: u64) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transactions WHERE block_number = ?1",
            params![block_number as i64],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }

    pub fn update_tx_status(
        &self,
        hash: &str,
        status: TxStatus,
        stellar_hash: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE transactions SET status = ?1, stellar_tx_hash = COALESCE(?2, stellar_tx_hash) WHERE hash = ?3",
            params![status.as_str(), stellar_hash, hash],
        )?;
        Ok(())
    }

    pub fn update_tx_included(&self, hash: &str, block_number: u64, tx_index: u32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE transactions SET status = 'included', block_number = ?1, tx_index = ?2 WHERE hash = ?3",
            params![block_number as i64, tx_index as i64, hash],
        )?;
        Ok(())
    }

    pub fn update_tx_receipt(
        &self,
        hash: &str,
        gas_used: u64,
        logs_json: &str,
        contract_address: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE transactions SET gas_used = ?1, logs_json = ?2, contract_address = COALESCE(?3, contract_address) WHERE hash = ?4",
            params![gas_used as i64, logs_json, contract_address, hash],
        )?;
        Ok(())
    }

    pub fn update_tx_error(&self, hash: &str, error: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE transactions SET error = ?1 WHERE hash = ?2",
            params![error, hash],
        )?;
        Ok(())
    }

    // --- Account operations ---

    pub fn insert_account(&self, account: &StoredAccount) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR IGNORE INTO accounts (evm_address, stellar_address, stellar_public_key, nonce, funded, registered, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                account.evm_address,
                account.stellar_address,
                account.stellar_public_key,
                account.nonce as i64,
                account.funded as i64,
                account.registered as i64,
                account.created_at as i64,
            ],
        )?;
        Ok(())
    }

    pub fn get_account(&self, evm_address: &str) -> Result<Option<StoredAccount>> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        let mut stmt = conn.prepare(
            "SELECT evm_address, stellar_address, stellar_public_key, nonce, funded, registered, created_at
             FROM accounts WHERE LOWER(evm_address) = ?1",
        )?;
        let result = stmt
            .query_row(params![normalized], |row| {
                Ok(StoredAccount {
                    evm_address: row.get(0)?,
                    stellar_address: row.get(1)?,
                    stellar_public_key: row.get(2)?,
                    nonce: row.get::<_, i64>(3)? as u64,
                    funded: row.get::<_, i64>(4)? != 0,
                    registered: row.get::<_, i64>(5)? != 0,
                    created_at: row.get::<_, i64>(6)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn get_account_by_stellar(&self, stellar_address: &str) -> Result<Option<StoredAccount>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT evm_address, stellar_address, stellar_public_key, nonce, funded, registered, created_at
             FROM accounts WHERE stellar_address = ?1",
        )?;
        let result = stmt
            .query_row(params![stellar_address], |row| {
                Ok(StoredAccount {
                    evm_address: row.get(0)?,
                    stellar_address: row.get(1)?,
                    stellar_public_key: row.get(2)?,
                    nonce: row.get::<_, i64>(3)? as u64,
                    funded: row.get::<_, i64>(4)? != 0,
                    registered: row.get::<_, i64>(5)? != 0,
                    created_at: row.get::<_, i64>(6)? as u64,
                })
            })
            .optional()?;
        Ok(result)
    }

    pub fn set_account_registered(&self, evm_address: &str, registered: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        conn.execute(
            "UPDATE accounts SET registered = ?1 WHERE LOWER(evm_address) = ?2",
            params![registered as i64, normalized],
        )?;
        Ok(())
    }

    pub fn get_registration_count(&self) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM accounts WHERE registered = 1",
            [],
            |row| row.get(0),
        )?;
        Ok(count as u64)
    }

    pub fn get_nonce(&self, evm_address: &str) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        let result: Option<i64> = conn
            .query_row(
                "SELECT nonce FROM accounts WHERE LOWER(evm_address) = ?1",
                params![normalized],
                |row| row.get(0),
            )
            .optional()?;
        Ok(result.unwrap_or(0) as u64)
    }

    pub fn increment_nonce(&self, evm_address: &str) -> Result<u64> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        conn.execute(
            "UPDATE accounts SET nonce = nonce + 1 WHERE LOWER(evm_address) = ?1",
            params![normalized],
        )?;
        let new_nonce: i64 = conn.query_row(
            "SELECT nonce FROM accounts WHERE LOWER(evm_address) = ?1",
            params![normalized],
            |row| row.get(0),
        )?;
        Ok(new_nonce as u64)
    }

    pub fn set_account_funded(&self, evm_address: &str, funded: bool) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        conn.execute(
            "UPDATE accounts SET funded = ?1 WHERE LOWER(evm_address) = ?2",
            params![funded as i64, normalized],
        )?;
        Ok(())
    }

    // --- Contract registry operations ---

    pub fn register_contract(
        &self,
        evm_address: &str,
        stellar_contract_id: &str,
        contract_name: Option<&str>,
        abi_json: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        conn.execute(
            "INSERT OR REPLACE INTO contracts (evm_address, stellar_contract_id, contract_name, abi_json, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                normalized,
                stellar_contract_id,
                contract_name,
                abi_json,
                chrono::Utc::now().timestamp() as i64,
            ],
        )?;
        info!(
            "Registered contract: {} -> {}",
            &normalized[..10],
            &stellar_contract_id[..10]
        );
        Ok(())
    }

    pub fn get_contract_id(&self, evm_address: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let normalized = evm_address.to_lowercase();
        let result: Option<String> = conn
            .query_row(
                "SELECT stellar_contract_id FROM contracts WHERE evm_address = ?1",
                params![normalized],
                |row| row.get(0),
            )
            .optional()?;
        Ok(result)
    }

    /// Get all contracts with their ABI JSON for loading into ABI registry
    pub fn get_all_contracts_with_abi(&self) -> Result<Vec<(String, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT evm_address, abi_json FROM contracts WHERE abi_json IS NOT NULL AND abi_json != '[]'"
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?;
        let mut contracts = Vec::new();
        for row in rows {
            contracts.push(row?);
        }
        Ok(contracts)
    }
}

/// rusqlite optional helper
trait OptionalExt<T> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for std::result::Result<T, rusqlite::Error> {
    fn optional(self) -> std::result::Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(val) => Ok(Some(val)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}
