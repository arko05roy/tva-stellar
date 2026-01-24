"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExplorerHeader } from "./components/ExplorerHeader";
import { BlockCard } from "./components/BlockCard";
import { TransactionCard } from "./components/TransactionCard";
import { useLatestBlock } from "./hooks/useLatestBlock";
import { useRecentBlocks } from "./hooks/useBlocks";
import { useRecentTransactions } from "./hooks/useTransactions";
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
  const { data: latestBlockNumber, isLoading: isLoadingLatest } = useLatestBlock();
  const { blocks, isLoading: isLoadingBlocks } = useRecentBlocks(
    latestBlockNumber,
    MAX_RECENT_BLOCKS
  );
  const { transactions, isLoading: isLoadingTransactions } = useRecentTransactions(
    latestBlockNumber,
    15
  );
  const { deployments, isLoading: isLoadingDeployments } = useDeployments();

  return (
    <div className="min-h-screen bg-white">
      <ExplorerHeader />

      {/* Network Statistics Cards */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-5 rounded-xl border border-black/10 bg-white">
            <div className="text-sm text-black/40 uppercase tracking-wider mb-1">Latest Block</div>
            <div className="text-2xl font-bold font-mono">
              {isLoadingLatest ? (
                <span className="animate-pulse bg-black/10 rounded w-24 h-8 inline-block" />
              ) : latestBlockNumber ? (
                <Link href={`/explorer/blocks/${latestBlockNumber}`} className="text-[#0055ff] hover:underline">
                  {latestBlockNumber.toLocaleString()}
                </Link>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-black/10 bg-white">
            <div className="text-sm text-black/40 uppercase tracking-wider mb-1">Chain ID</div>
            <div className="text-2xl font-bold font-mono">{TVA_CHAIN_ID}</div>
            <div className="text-xs text-black/40 font-mono mt-1">
              0x{TVA_CHAIN_ID.toString(16).toUpperCase()}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-black/10 bg-white">
            <div className="text-sm text-black/40 uppercase tracking-wider mb-1">Network</div>
            <div className="text-2xl font-bold">Testnet</div>
            <div className="text-xs text-black/40 mt-1">Stellar Test Network</div>
          </div>

          <div className="p-5 rounded-xl border border-black/10 bg-white">
            <div className="text-sm text-black/40 uppercase tracking-wider mb-1">Block Time</div>
            <div className="text-2xl font-bold">~5s</div>
            <div className="text-xs text-black/40 mt-1">Deterministic finality</div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Blocks and Transactions */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Latest Blocks - Left Column */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Latest Blocks</h2>
              <Link
                href="/explorer/blocks"
                className="text-sm text-[#0055ff] hover:underline flex items-center gap-1"
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
                  <div key={i} className="h-20 rounded-xl bg-black/5 animate-pulse" />
                ))}
              </div>
            ) : blocks.length === 0 ? (
              <div className="text-center py-12 text-black/40 bg-white rounded-xl border border-black/10">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p>No blocks found</p>
                <p className="text-sm mt-1">Make sure the TVA RPC server is running</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/5">
                {blocks.map((block) => (
                  <BlockCard key={block.number} block={block} compact />
                ))}
              </div>
            )}
          </div>

          {/* Latest Transactions - Right Column */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Latest Transactions</h2>
              <Link
                href="/explorer/tx"
                className="text-sm text-[#0055ff] hover:underline flex items-center gap-1"
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
                  <div key={i} className="h-20 rounded-xl bg-black/5 animate-pulse" />
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-12 text-black/40 bg-white rounded-xl border border-black/10">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <p>No transactions found</p>
                <p className="text-sm mt-1">Transactions will appear here as they are confirmed</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/5">
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
                    }} 
                    compact 
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
            <h2 className="text-xl font-bold">Deployed Contracts</h2>
            <span className="text-sm text-black/40">{deployments.length} contracts</span>
          </div>
          <div className="bg-white rounded-xl border border-black/10 divide-y divide-black/5">
            {deployments.slice(0, 10).map((dep, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-[#FFC800]/10 border border-[#FFC800]/20 flex items-center justify-center">
                    <span className="text-[#FFC800] text-xs font-bold">SOL</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">{dep.contractName}</div>
                    <div className="text-xs text-black/40 font-mono mt-0.5">
                      {dep.contractId.slice(0, 8)}...{dep.contractId.slice(-6)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-black/40">
                    {new Date(dep.timestamp).toLocaleDateString()}
                  </span>
                  {dep.explorerUrl ? (
                    <a href={dep.explorerUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#0055ff] hover:underline flex items-center gap-1">
                      View
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                      </svg>
                    </a>
                  ) : (
                    <a href={`https://stellar.expert/explorer/testnet/contract/${dep.contractId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#0055ff] hover:underline flex items-center gap-1">
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
    </div>
  );
}
