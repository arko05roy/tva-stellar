/**
 * Blockscout REST API v2 Client
 *
 * This client provides methods to fetch blockchain data from Blockscout.
 * No API key required - rate limited by IP.
 *
 * Documentation: https://docs.blockscout.com/devs/apis/rest
 */

// Blockscout API base URL - can be configured via environment variable
export const BLOCKSCOUT_API_URL = process.env.NEXT_PUBLIC_BLOCKSCOUT_API_URL || "";

// Check if Blockscout integration is enabled
export const isBlockscoutEnabled = (): boolean => {
  return !!BLOCKSCOUT_API_URL && BLOCKSCOUT_API_URL.length > 0;
};

// API response types based on Blockscout API v2 schema
export interface BlockscoutBlock {
  height: number;
  hash: string;
  parent_hash: string;
  timestamp: string;
  miner: {
    hash: string;
    name?: string;
    is_contract?: boolean;
    implementation_name?: string;
  };
  gas_used: string;
  gas_limit: string;
  tx_count: number;
  size: number;
  base_fee_per_gas?: string;
  burnt_fees?: string;
  priority_fee?: string;
  rewards?: Array<{
    type: string;
    reward: string;
  }>;
  total_difficulty?: string;
  nonce?: string;
  extra_data?: string;
}

export interface BlockscoutTransaction {
  hash: string;
  block: number | null;
  timestamp: string | null;
  from: {
    hash: string;
    name?: string;
    is_contract?: boolean;
    implementation_name?: string;
  };
  to: {
    hash: string;
    name?: string;
    is_contract?: boolean;
    implementation_name?: string;
  } | null;
  value: string;
  gas_limit: string;
  gas_price: string;
  gas_used: string;
  status: "ok" | "error" | null;
  method?: string;
  type: number;
  nonce: number;
  position: number | null;
  fee: {
    type: string;
    value: string;
  };
  confirmations?: number;
  result?: string;
  revert_reason?: string;
  raw_input?: string;
  decoded_input?: {
    method_call: string;
    method_id: string;
    parameters: Array<{
      name: string;
      type: string;
      value: string;
    }>;
  };
  token_transfers?: BlockscoutTokenTransfer[];
  tx_types?: string[];
  has_error_in_internal_txs?: boolean;
}

export interface BlockscoutAddress {
  hash: string;
  name?: string;
  is_contract: boolean;
  implementation_name?: string;
  creation_tx_hash?: string;
  creator_address_hash?: string;
  coin_balance: string | null;
  exchange_rate?: string;
  block_number_balance_updated_at?: number;
  token?: BlockscoutToken;
  ens_domain_name?: string;
  has_beacon_chain_withdrawals?: boolean;
  has_custom_methods_read?: boolean;
  has_custom_methods_write?: boolean;
  has_decompiled_code?: boolean;
  has_logs?: boolean;
  has_methods_read?: boolean;
  has_methods_read_proxy?: boolean;
  has_methods_write?: boolean;
  has_methods_write_proxy?: boolean;
  has_token_transfers?: boolean;
  has_tokens?: boolean;
  has_validated_blocks?: boolean;
}

export interface BlockscoutAddressCounters {
  transactions_count: string;
  token_transfers_count: string;
  gas_usage_count: string;
  validations_count: string;
}

export interface BlockscoutToken {
  address: string;
  name: string;
  symbol: string;
  decimals: string;
  type: "ERC-20" | "ERC-721" | "ERC-1155";
  holders?: string;
  total_supply?: string;
  exchange_rate?: string;
  icon_url?: string;
}

export interface BlockscoutTokenTransfer {
  block_hash: string;
  block_number: number;
  from: {
    hash: string;
    name?: string;
    is_contract?: boolean;
  };
  to: {
    hash: string;
    name?: string;
    is_contract?: boolean;
  };
  log_index: string;
  method?: string;
  timestamp: string;
  token: BlockscoutToken;
  total: {
    decimals: string;
    value: string;
  };
  tx_hash: string;
  type: string;
}

export interface BlockscoutLog {
  address: {
    hash: string;
    name?: string;
    is_contract?: boolean;
  };
  block_hash: string;
  block_number: number;
  data: string;
  decoded?: {
    method_call: string;
    method_id: string;
    parameters: Array<{
      indexed: boolean;
      name: string;
      type: string;
      value: string;
    }>;
  };
  index: number;
  smart_contract?: {
    name: string;
    verified: boolean;
  };
  topics: string[];
  tx_hash: string;
}

export interface BlockscoutStats {
  total_blocks: string;
  total_addresses: string;
  total_transactions: string;
  average_block_time: number;
  coin_price?: string;
  coin_price_change_percentage?: number;
  total_gas_used?: string;
  gas_prices?: {
    slow: number;
    average: number;
    fast: number;
  };
  gas_used_today?: string;
  transactions_today?: string;
  market_cap?: string;
  network_utilization_percentage?: number;
  static_gas_price?: string;
  tvl?: string;
}

export interface BlockscoutPaginatedResponse<T> {
  items: T[];
  next_page_params: {
    block_number?: number;
    index?: number;
    items_count?: number;
    transaction_index?: number;
  } | null;
}

// API client class
class BlockscoutClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Accept": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockscout API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Stats
  async getStats(): Promise<BlockscoutStats> {
    return this.fetch("/api/v2/stats");
  }

  // Blocks
  async getBlocks(type: "block" | "uncle" | "reorg" = "block"): Promise<BlockscoutPaginatedResponse<BlockscoutBlock>> {
    return this.fetch(`/api/v2/blocks?type=${type}`);
  }

  async getBlock(blockNumberOrHash: number | string): Promise<BlockscoutBlock> {
    return this.fetch(`/api/v2/blocks/${blockNumberOrHash}`);
  }

  async getBlockTransactions(blockNumberOrHash: number | string): Promise<BlockscoutPaginatedResponse<BlockscoutTransaction>> {
    return this.fetch(`/api/v2/blocks/${blockNumberOrHash}/transactions`);
  }

  // Transactions
  async getTransactions(filter?: "pending" | "validated"): Promise<BlockscoutPaginatedResponse<BlockscoutTransaction>> {
    const params = filter ? `?filter=${filter}` : "";
    return this.fetch(`/api/v2/transactions${params}`);
  }

  async getTransaction(hash: string): Promise<BlockscoutTransaction> {
    return this.fetch(`/api/v2/transactions/${hash}`);
  }

  async getTransactionLogs(hash: string): Promise<BlockscoutPaginatedResponse<BlockscoutLog>> {
    return this.fetch(`/api/v2/transactions/${hash}/logs`);
  }

  async getTransactionTokenTransfers(hash: string): Promise<BlockscoutPaginatedResponse<BlockscoutTokenTransfer>> {
    return this.fetch(`/api/v2/transactions/${hash}/token-transfers`);
  }

  // Addresses
  async getAddress(hash: string): Promise<BlockscoutAddress> {
    return this.fetch(`/api/v2/addresses/${hash}`);
  }

  async getAddressCounters(hash: string): Promise<BlockscoutAddressCounters> {
    return this.fetch(`/api/v2/addresses/${hash}/counters`);
  }

  async getAddressTransactions(
    hash: string,
    filter?: "to" | "from"
  ): Promise<BlockscoutPaginatedResponse<BlockscoutTransaction>> {
    const params = filter ? `?filter=${filter}` : "";
    return this.fetch(`/api/v2/addresses/${hash}/transactions${params}`);
  }

  async getAddressTokenTransfers(
    hash: string,
    type?: string,
    filter?: "to" | "from"
  ): Promise<BlockscoutPaginatedResponse<BlockscoutTokenTransfer>> {
    const params = new URLSearchParams();
    if (type) params.append("type", type);
    if (filter) params.append("filter", filter);
    const queryString = params.toString() ? `?${params.toString()}` : "";
    return this.fetch(`/api/v2/addresses/${hash}/token-transfers${queryString}`);
  }

  async getAddressTokenBalances(hash: string): Promise<{ items: Array<{ token: BlockscoutToken; value: string }> }> {
    return this.fetch(`/api/v2/addresses/${hash}/token-balances`);
  }

  // Main page data (optimized endpoints for homepage)
  async getMainPageBlocks(): Promise<BlockscoutBlock[]> {
    const response = await this.fetch<{ items: BlockscoutBlock[] }>("/api/v2/main-page/blocks");
    return response.items || [];
  }

  async getMainPageTransactions(): Promise<BlockscoutTransaction[]> {
    const response = await this.fetch<{ items: BlockscoutTransaction[] }>("/api/v2/main-page/transactions");
    return response.items || [];
  }

  // Search
  async search(query: string): Promise<{ items: Array<{ type: string; address?: string; block_hash?: string; tx_hash?: string }> }> {
    return this.fetch(`/api/v2/search?q=${encodeURIComponent(query)}`);
  }
}

// Singleton client instance
let clientInstance: BlockscoutClient | null = null;

export function getBlockscoutClient(): BlockscoutClient | null {
  if (!isBlockscoutEnabled()) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = new BlockscoutClient(BLOCKSCOUT_API_URL);
  }

  return clientInstance;
}

// Helper to convert Blockscout block to EVM-compatible format
export function blockscoutBlockToEvmBlock(block: BlockscoutBlock): {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  miner: string;
  gasLimit: bigint;
  gasUsed: bigint;
  transactions: string[];
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  logsBloom: string;
  nonce: string;
  extraData: string;
  difficulty: bigint;
  totalDifficulty: bigint;
  txCount: number;
  size: number;
} {
  return {
    number: block.height,
    hash: block.hash,
    parentHash: block.parent_hash,
    timestamp: Math.floor(new Date(block.timestamp).getTime() / 1000),
    miner: block.miner.hash,
    gasLimit: BigInt(block.gas_limit),
    gasUsed: BigInt(block.gas_used),
    transactions: [],
    transactionsRoot: "",
    stateRoot: "",
    receiptsRoot: "",
    logsBloom: "",
    nonce: block.nonce || "0x0",
    extraData: block.extra_data || "0x",
    difficulty: BigInt(0),
    totalDifficulty: BigInt(block.total_difficulty || "0"),
    txCount: block.tx_count,
    size: block.size,
  };
}

// Helper to convert Blockscout transaction to EVM-compatible format
export function blockscoutTxToEvmTx(tx: BlockscoutTransaction): {
  hash: string;
  blockNumber: number | null;
  timestamp: number | null;
  from: string;
  to: string | null;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  nonce: number;
  input: string;
  status: number | null;
  method: string | undefined;
  type: number;
  confirmations: number | undefined;
  fee: string;
} {
  return {
    hash: tx.hash,
    blockNumber: tx.block,
    timestamp: tx.timestamp ? Math.floor(new Date(tx.timestamp).getTime() / 1000) : null,
    from: tx.from.hash,
    to: tx.to?.hash || null,
    value: tx.value,
    gas: tx.gas_limit,
    gasPrice: tx.gas_price,
    gasUsed: tx.gas_used,
    nonce: tx.nonce,
    input: tx.raw_input || "0x",
    status: tx.status === "ok" ? 1 : tx.status === "error" ? 0 : null,
    method: tx.method,
    type: tx.type,
    confirmations: tx.confirmations,
    fee: tx.fee.value,
  };
}
