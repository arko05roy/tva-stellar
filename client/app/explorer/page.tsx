"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExplorerHeader } from "./components/ExplorerHeader";
import { BlockCard } from "./components/BlockCard";
import { TransactionCard } from "./components/TransactionCard";
import { useLatestBlock } from "./hooks/useLatestBlock";
import { useRecentBlocks } from "./hooks/useBlocks";
import { useRecentTransactions } from "./hooks/useTransactions";
import {
  useBlockscoutStats,
  useBlockscoutRecentBlocks,
  useBlockscoutRecentTransactions,
  useIsBlockscoutEnabled,
} from "./hooks/useBlockscout";
import { TVA_CHAIN_ID, MAX_RECENT_BLOCKS } from "./lib/constants";

interface Deployment {
  timestamp: string;
  contractName: string;
  contractId: string;
  explorerUrl?: string;
}

function useDeployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deployments")
      .then((r) => r.json())
      .then((data) => { setDeployments(data.deployments || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, []);

  return { deployments, isLoading };
}

export default function ExplorerHome() {
  const isBlockscoutEnabled = useIsBlockscoutEnabled();

  // TVA RPC data (fallback)
  const { data: latestBlockNumber, isLoading: isLoadingLatest } = useLatestBlock();
  const { blocks: rpcBlocks, isLoading: isLoadingRpcBlocks } = useRecentBlocks(
    latestBlockNumber,
    MAX_RECENT_BLOCKS
  );
  const { transactions: rpcTransactions, isLoading: isLoadingRpcTransactions } = useRecentTransactions(
    latestBlockNumber,
    15
  );

  // Blockscout data (primary when enabled)
  const { data: blockscoutStats, isLoading: isLoadingStats } = useBlockscoutStats();
  const { data: blockscoutBlocks, isLoading: isLoadingBlockscoutBlocks } = useBlockscoutRecentBlocks();
  const { data: blockscoutTransactions, isLoading: isLoadingBlockscoutTxs } = useBlockscoutRecentTransactions();

  const { deployments, isLoading: isLoadingDeployments } = useDeployments();

  // Use Blockscout data if available, otherwise fall back to RPC
  const blocks = isBlockscoutEnabled && blockscoutBlocks?.length
    ? blockscoutBlocks.slice(0, MAX_RECENT_BLOCKS)
    : rpcBlocks;
  const transactions = isBlockscoutEnabled && blockscoutTransactions?.length
    ? blockscoutTransactions.slice(0, 15)
    : rpcTransactions;
  const isLoadingBlocks = isBlockscoutEnabled ? isLoadingBlockscoutBlocks : isLoadingRpcBlocks;
  const isLoadingTransactions = isBlockscoutEnabled ? isLoadingBlockscoutTxs : isLoadingRpcTransactions;

  // Stats from Blockscout or derived from RPC
  const totalBlocks = blockscoutStats?.total_blocks || latestBlockNumber?.toLocaleString() || "—";
  const totalTransactions = blockscoutStats?.total_transactions || "—";
  const totalAddresses = blockscoutStats?.total_addresses || "—";
  const avgBlockTime = blockscoutStats?.average_block_time
    ? `${blockscoutStats.average_block_time.toFixed(1)}s`
    : "~5s";

  return (
    <div className="min-h-screen bg-black">
      <ExplorerHeader />

      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-semibold text-white mb-4">
            Blockchain Explorer
          </h1>
          <p className="text-[#B0B0B0] text-lg max-w-2xl">
            Explore blocks, transactions, and addresses on the network.
            {isBlockscoutEnabled && (
              <span className="inline-flex items-center gap-2 ml-2 px-2 py-0.5 bg-[#FFC800]/10 text-[#FFC800] rounded text-sm">
                Powered by Blockscout
              </span>
            )}
          </p>
        </div>

        {/* Network Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="text-sm text-[#B0B0B0] uppercase tracking-wider mb-1">Total Blocks</div>
            <div className="text-2xl font-bold text-white font-mono">
              {isLoadingLatest && isLoadingStats ? (
                <span className="animate-pulse bg-white/10 rounded w-24 h-8 inline-block" />
              ) : (
                totalBlocks
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="text-sm text-[#B0B0B0] uppercase tracking-wider mb-1">Total Transactions</div>
            <div className="text-2xl font-bold text-white font-mono">{totalTransactions}</div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="text-sm text-[#B0B0B0] uppercase tracking-wider mb-1">Total Addresses</div>
            <div className="text-2xl font-bold text-white font-mono">{totalAddresses}</div>
          </div>

          <div className="p-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
            <div className="text-sm text-[#B0B0B0] uppercase tracking-wider mb-1">Block Time</div>
            <div className="text-2xl font-bold text-white">{avgBlockTime}</div>
            <div className="text-xs text-[#B0B0B0] mt-1">Average</div>
          </div>
        </div>

        {/* Chain Info Badge */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#9B7FFF]/10 border border-[#9B7FFF]/20">
            <div className="w-2 h-2 rounded-full bg-[#9B7FFF] animate-pulse" />
            <span className="text-sm text-[#9B7FFF] font-medium">Chain ID: {TVA_CHAIN_ID}</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#FFC800]/10 border border-[#FFC800]/20">
            <span className="text-sm text-[#FFC800] font-medium font-mono">
              0x{TVA_CHAIN_ID.toString(16).toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Blocks and Transactions */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Latest Blocks - Left Column */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Latest Blocks</h2>
              <Link
                href="/explorer/blocks"
                className="text-sm text-[#FFC800] hover:text-[#FFC800]/80 flex items-center gap-1 transition-colors"
              >
                View all blocks
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {isLoadingBlocks ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : blocks.length === 0 ? (
              <div className="text-center py-12 text-[#B0B0B0] bg-white/5 rounded-xl border border-white/10">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p>No blocks found</p>
                <p className="text-sm mt-1">
                  {isBlockscoutEnabled
                    ? "Check your Blockscout API connection"
                    : "Make sure the TVA RPC server is running"}
                </p>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
                {blocks.map((block: any) => (
                  <BlockCard key={block.number || block.hash} block={block} compact darkMode />
                ))}
              </div>
            )}
          </div>

          {/* Latest Transactions - Right Column */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Latest Transactions</h2>
              <Link
                href="/explorer/tx"
                className="text-sm text-[#FFC800] hover:text-[#FFC800]/80 flex items-center gap-1 transition-colors"
              >
                View all transactions
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            {isLoadingTransactions ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-[#B0B0B0] bg-white/5 rounded-xl border border-white/10">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <p>No transactions found</p>
                <p className="text-sm mt-1">Transactions will appear here as they are confirmed</p>
              </div>
            ) : (
              <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
                {transactions.map((tx: any, idx: number) => (
                  <TransactionCard
                    key={tx.hash || idx}
                    tx={{
                      hash: tx.hash || tx.transactionHash || "",
                      from: tx.from || "0x0",
                      to: tx.to || null,
                      value: tx.value || "0x0",
                      blockNumber: tx.blockNumber || 0,
                      timestamp: tx.timestamp,
                      method: tx.method,
                      status: tx.status,
                    }}
                    compact
                    darkMode
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deployed Contracts Section */}
      {deployments.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Deployed Contracts</h2>
            <span className="text-sm text-[#B0B0B0]">{deployments.length} contracts</span>
          </div>
          <div className="bg-white/5 rounded-xl border border-white/10 divide-y divide-white/5">
            {deployments.slice(0, 10).map((dep, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[#FFC800]/10 border border-[#FFC800]/20 flex items-center justify-center">
                    <span className="text-[#FFC800] text-xs font-bold">SOL</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm text-white">{dep.contractName}</div>
                    <div className="text-xs text-[#B0B0B0] font-mono mt-0.5">
                      {dep.contractId.slice(0, 8)}...{dep.contractId.slice(-6)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-[#B0B0B0]">
                    {new Date(dep.timestamp).toLocaleDateString()}
                  </span>
                  {dep.explorerUrl ? (
                    <a href={dep.explorerUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#FFC800] hover:text-[#FFC800]/80 flex items-center gap-1">
                      View
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </a>
                  ) : (
                    <a href={`https://stellar.expert/explorer/testnet/contract/${dep.contractId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#FFC800] hover:text-[#FFC800]/80 flex items-center gap-1">
                      View
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-8 border-t border-white/10">
        <div className="flex items-center justify-between text-sm text-[#B0B0B0]">
          <div>Stellar Network Explorer</div>
          {isBlockscoutEnabled && (
            <div className="flex items-center gap-2">
              <span>Data provided by</span>
              <a
                href="https://blockscout.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#FFC800] hover:underline"
              >
                Blockscout
              </a>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
