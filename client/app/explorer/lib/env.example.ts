/**
 * Environment Configuration Example for Blockscout Integration
 *
 * Copy these values to your .env.local file:
 *
 * # Blockscout API URL (No API key needed - rate limited by IP)
 * # Remove or leave empty to disable Blockscout and use TVA RPC directly
 *
 * # Ethereum Mainnet
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://eth.blockscout.com
 *
 * # Base Mainnet
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://base.blockscout.com
 *
 * # Optimism Mainnet
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://optimism.blockscout.com
 *
 * # Polygon Mainnet
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://polygon.blockscout.com
 *
 * # Gnosis Chain
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://gnosis.blockscout.com
 *
 * # Arbitrum One
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://arbitrum.blockscout.com
 *
 * # Custom/Self-hosted Blockscout
 * NEXT_PUBLIC_BLOCKSCOUT_API_URL=https://your-blockscout-instance.com
 *
 * # Data source preference (optional)
 * # - "auto": Use Blockscout when configured, fall back to RPC (default)
 * # - "blockscout": Always use Blockscout (will fail if not configured)
 * # - "rpc": Always use TVA RPC (ignores Blockscout config)
 * NEXT_PUBLIC_DATA_SOURCE=auto
 *
 * # TVA RPC URL (for direct RPC access)
 * NEXT_PUBLIC_TVA_RPC_URL=/api/rpc
 */

export const envConfigExample = {
  // Blockscout API URL examples
  blockscoutUrls: {
    ethereum: "https://eth.blockscout.com",
    base: "https://base.blockscout.com",
    optimism: "https://optimism.blockscout.com",
    polygon: "https://polygon.blockscout.com",
    gnosis: "https://gnosis.blockscout.com",
    arbitrum: "https://arbitrum.blockscout.com",
  },

  // Blockscout API v2 endpoints used
  endpoints: {
    stats: "/api/v2/stats",
    blocks: "/api/v2/blocks",
    blockByNumber: "/api/v2/blocks/{number_or_hash}",
    transactions: "/api/v2/transactions",
    transactionByHash: "/api/v2/transactions/{hash}",
    address: "/api/v2/addresses/{address}",
    addressTransactions: "/api/v2/addresses/{address}/transactions",
    mainPageBlocks: "/api/v2/main-page/blocks",
    mainPageTransactions: "/api/v2/main-page/transactions",
    search: "/api/v2/search?q={query}",
  },

  // Rate limits (varies by instance)
  rateLimits: {
    note: "Rate limited by IP address, no API key needed",
    typical: "~10-50 requests per second depending on instance",
  },
};
