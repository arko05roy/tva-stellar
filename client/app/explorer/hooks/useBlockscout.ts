"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getBlockscoutClient,
  isBlockscoutEnabled,
  blockscoutBlockToEvmBlock,
  blockscoutTxToEvmTx,
  type BlockscoutBlock,
  type BlockscoutTransaction,
  type BlockscoutAddress,
  type BlockscoutStats,
  type BlockscoutLog,
  type BlockscoutAddressCounters,
} from "../lib/blockscout";
import { BLOCK_POLL_INTERVAL } from "../lib/constants";

/**
 * Hook to check if Blockscout is enabled
 */
export function useIsBlockscoutEnabled(): boolean {
  return isBlockscoutEnabled();
}

/**
 * Hook to fetch network stats from Blockscout
 */
export function useBlockscoutStats() {
  return useQuery({
    queryKey: ["blockscout", "stats"],
    queryFn: async (): Promise<BlockscoutStats | null> => {
      const client = getBlockscoutClient();
      if (!client) return null;
      return client.getStats();
    },
    enabled: isBlockscoutEnabled(),
    refetchInterval: BLOCK_POLL_INTERVAL,
  });
}

/**
 * Hook to fetch recent blocks from Blockscout (main page optimized)
 */
export function useBlockscoutRecentBlocks() {
  return useQuery({
    queryKey: ["blockscout", "mainPage", "blocks"],
    queryFn: async () => {
      const client = getBlockscoutClient();
      if (!client) return [];
      const blocks = await client.getMainPageBlocks();
      return blocks.map(blockscoutBlockToEvmBlock);
    },
    enabled: isBlockscoutEnabled(),
    refetchInterval: BLOCK_POLL_INTERVAL,
  });
}

/**
 * Hook to fetch blocks with pagination
 */
export function useBlockscoutBlocks() {
  return useQuery({
    queryKey: ["blockscout", "blocks"],
    queryFn: async () => {
      const client = getBlockscoutClient();
      if (!client) return { items: [], nextPageParams: null };
      const response = await client.getBlocks();
      return {
        items: response.items.map(blockscoutBlockToEvmBlock),
        nextPageParams: response.next_page_params,
      };
    },
    enabled: isBlockscoutEnabled(),
    refetchInterval: BLOCK_POLL_INTERVAL,
  });
}

/**
 * Hook to fetch a single block from Blockscout
 */
export function useBlockscoutBlock(blockNumberOrHash: number | string | null) {
  return useQuery({
    queryKey: ["blockscout", "block", blockNumberOrHash],
    queryFn: async () => {
      if (!blockNumberOrHash) return null;
      const client = getBlockscoutClient();
      if (!client) return null;
      const block = await client.getBlock(blockNumberOrHash);
      return blockscoutBlockToEvmBlock(block);
    },
    enabled: isBlockscoutEnabled() && blockNumberOrHash !== null,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch block transactions from Blockscout
 */
export function useBlockscoutBlockTransactions(blockNumberOrHash: number | string | null) {
  return useQuery({
    queryKey: ["blockscout", "block", blockNumberOrHash, "transactions"],
    queryFn: async () => {
      if (!blockNumberOrHash) return { items: [], nextPageParams: null };
      const client = getBlockscoutClient();
      if (!client) return { items: [], nextPageParams: null };
      const response = await client.getBlockTransactions(blockNumberOrHash);
      return {
        items: response.items.map(blockscoutTxToEvmTx),
        nextPageParams: response.next_page_params,
      };
    },
    enabled: isBlockscoutEnabled() && blockNumberOrHash !== null,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch recent transactions from Blockscout (main page optimized)
 */
export function useBlockscoutRecentTransactions() {
  return useQuery({
    queryKey: ["blockscout", "mainPage", "transactions"],
    queryFn: async () => {
      const client = getBlockscoutClient();
      if (!client) return [];
      const transactions = await client.getMainPageTransactions();
      return transactions.map(blockscoutTxToEvmTx);
    },
    enabled: isBlockscoutEnabled(),
    refetchInterval: BLOCK_POLL_INTERVAL,
  });
}

/**
 * Hook to fetch transactions with pagination
 */
export function useBlockscoutTransactions(filter?: "pending" | "validated") {
  return useQuery({
    queryKey: ["blockscout", "transactions", filter],
    queryFn: async () => {
      const client = getBlockscoutClient();
      if (!client) return { items: [], nextPageParams: null };
      const response = await client.getTransactions(filter);
      return {
        items: response.items.map(blockscoutTxToEvmTx),
        nextPageParams: response.next_page_params,
      };
    },
    enabled: isBlockscoutEnabled(),
    refetchInterval: BLOCK_POLL_INTERVAL,
  });
}

/**
 * Hook to fetch a single transaction from Blockscout
 */
export function useBlockscoutTransaction(hash: string | null) {
  return useQuery({
    queryKey: ["blockscout", "transaction", hash],
    queryFn: async () => {
      if (!hash) return null;
      const client = getBlockscoutClient();
      if (!client) return null;
      const tx = await client.getTransaction(hash);
      return blockscoutTxToEvmTx(tx);
    },
    enabled: isBlockscoutEnabled() && !!hash,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch transaction with raw response (for full details)
 */
export function useBlockscoutTransactionRaw(hash: string | null) {
  return useQuery({
    queryKey: ["blockscout", "transactionRaw", hash],
    queryFn: async (): Promise<BlockscoutTransaction | null> => {
      if (!hash) return null;
      const client = getBlockscoutClient();
      if (!client) return null;
      return client.getTransaction(hash);
    },
    enabled: isBlockscoutEnabled() && !!hash,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch transaction logs from Blockscout
 */
export function useBlockscoutTransactionLogs(hash: string | null) {
  return useQuery({
    queryKey: ["blockscout", "transaction", hash, "logs"],
    queryFn: async (): Promise<BlockscoutLog[]> => {
      if (!hash) return [];
      const client = getBlockscoutClient();
      if (!client) return [];
      const response = await client.getTransactionLogs(hash);
      return response.items;
    },
    enabled: isBlockscoutEnabled() && !!hash,
    staleTime: Infinity,
  });
}

/**
 * Hook to fetch address from Blockscout
 */
export function useBlockscoutAddress(address: string | null) {
  return useQuery({
    queryKey: ["blockscout", "address", address],
    queryFn: async (): Promise<BlockscoutAddress | null> => {
      if (!address) return null;
      const client = getBlockscoutClient();
      if (!client) return null;
      return client.getAddress(address);
    },
    enabled: isBlockscoutEnabled() && !!address,
  });
}

/**
 * Hook to fetch address counters from Blockscout
 */
export function useBlockscoutAddressCounters(address: string | null) {
  return useQuery({
    queryKey: ["blockscout", "address", address, "counters"],
    queryFn: async (): Promise<BlockscoutAddressCounters | null> => {
      if (!address) return null;
      const client = getBlockscoutClient();
      if (!client) return null;
      return client.getAddressCounters(address);
    },
    enabled: isBlockscoutEnabled() && !!address,
  });
}

/**
 * Hook to fetch address transactions from Blockscout
 */
export function useBlockscoutAddressTransactions(
  address: string | null,
  filter?: "to" | "from"
) {
  return useQuery({
    queryKey: ["blockscout", "address", address, "transactions", filter],
    queryFn: async () => {
      if (!address) return { items: [], nextPageParams: null };
      const client = getBlockscoutClient();
      if (!client) return { items: [], nextPageParams: null };
      const response = await client.getAddressTransactions(address, filter);
      return {
        items: response.items.map(blockscoutTxToEvmTx),
        nextPageParams: response.next_page_params,
      };
    },
    enabled: isBlockscoutEnabled() && !!address,
  });
}

/**
 * Hook to search Blockscout
 */
export function useBlockscoutSearch(query: string | null) {
  return useQuery({
    queryKey: ["blockscout", "search", query],
    queryFn: async () => {
      if (!query || query.length < 2) return { items: [] };
      const client = getBlockscoutClient();
      if (!client) return { items: [] };
      return client.search(query);
    },
    enabled: isBlockscoutEnabled() && !!query && query.length >= 2,
  });
}
