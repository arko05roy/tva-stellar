"use client";

import { useQueries } from "@tanstack/react-query";
import { getRpcClient } from "./useTvaRpc";
import type { EvmBlock } from "@tva-protocol/sdk/types";

/**
 * Hook to fetch recent transactions from recent blocks
 */
export function useRecentTransactions(latestBlockNumber: number | undefined, count: number = 15) {
  // Fetch the most recent blocks with transactions included
  const blockNumbers = latestBlockNumber
    ? Array.from({ length: Math.min(count, 10) }, (_, i) => latestBlockNumber - i).filter((n) => n >= 0)
    : [];

  const queries = useQueries({
    queries: blockNumbers.map((num) => ({
      queryKey: ["block", num, true], // include_txs = true
      queryFn: async () => {
        const rpc = getRpcClient();
        return rpc.getBlockByNumber(num, true);
      },
      staleTime: 10000, // Refresh every 10 seconds for recent blocks
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);
  
  // Extract all transactions from blocks
  const transactions = queries
    .map((q) => q.data)
    .filter((block): block is any => block !== null && block !== undefined)
    .flatMap((block: any) => {
      // Handle both array of hashes and array of transaction objects
      if (Array.isArray(block.transactions)) {
        return block.transactions
          .filter((tx: any) => typeof tx === "object" && tx !== null && tx.hash)
          .map((tx: any) => {
            const blockNum = typeof block.number === 'string' 
              ? (block.number.startsWith('0x') ? parseInt(block.number, 16) : parseInt(block.number))
              : block.number;
            const blockTime = typeof block.timestamp === 'string'
              ? (block.timestamp.startsWith('0x') ? parseInt(block.timestamp, 16) : parseInt(block.timestamp))
              : block.timestamp;
            return {
              ...tx,
              blockNumber: blockNum,
              timestamp: blockTime,
            };
          });
      }
      return [];
    })
    .slice(0, count); // Limit to requested count

  return { transactions, isLoading, isError };
}

