"use client";

import Link from "next/link";
import { formatRelativeTime, formatBlockNumberHex, truncateHash, formatGas } from "../lib/formatter";

interface BlockCardProps {
  block: {
    number: number;
    hash: string;
    timestamp: number;
    transactions: string[] | any[];
    gasUsed: bigint | string;
    gasLimit: bigint | string;
    miner?: string;
    txCount?: number;
    size?: number;
  };
  compact?: boolean;
  darkMode?: boolean;
}

export function BlockCard({ block, compact = false, darkMode = false }: BlockCardProps) {
  const txCount = block.txCount ?? block.transactions?.length ?? 0;
  const gasUsed = typeof block.gasUsed === "string" ? BigInt(block.gasUsed) : block.gasUsed;
  const gasLimit = typeof block.gasLimit === "string" ? BigInt(block.gasLimit) : block.gasLimit;

  if (compact) {
    if (darkMode) {
      return (
        <Link
          href={`/explorer/blocks/${block.number}`}
          className="flex items-center justify-between p-4 hover:bg-white/5 rounded-lg transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#9B7FFF]/10 border border-[#9B7FFF]/20 flex items-center justify-center group-hover:bg-[#9B7FFF]/20 transition-colors">
              <svg className="w-5 h-5 text-[#9B7FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="font-mono font-medium text-white">
                {block.number.toLocaleString()}
              </div>
              <div className="text-xs text-[#B0B0B0]">
                {formatRelativeTime(block.timestamp)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-white/80">
              {txCount} txn{txCount !== 1 ? "s" : ""}
            </div>
            <div className="text-xs text-[#B0B0B0] font-mono">
              {formatBlockNumberHex(block.number)}
            </div>
          </div>
        </Link>
      );
    }

    return (
      <Link
        href={`/explorer/blocks/${block.number}`}
        className="flex items-center justify-between p-4 hover:bg-black/5 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-black/5 flex items-center justify-center group-hover:bg-[#0055ff]/10 transition-colors">
            <svg className="w-5 h-5 text-black/40 group-hover:text-[#0055ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <div className="font-mono font-medium">
              {block.number.toLocaleString()}
            </div>
            <div className="text-xs text-black/40">
              {formatRelativeTime(block.timestamp)}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-black/60">
            {txCount} txn{txCount !== 1 ? "s" : ""}
          </div>
          <div className="text-xs text-black/40 font-mono">
            {formatBlockNumberHex(block.number)}
          </div>
        </div>
      </Link>
    );
  }

  // Full card view
  if (darkMode) {
    return (
      <Link
        href={`/explorer/blocks/${block.number}`}
        className="block p-5 border border-white/10 rounded-xl hover:border-white/20 hover:bg-white/5 transition-all group"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#9B7FFF]/10 border border-[#9B7FFF]/20 flex items-center justify-center group-hover:bg-[#9B7FFF]/20 transition-colors">
              <svg className="w-6 h-6 text-[#9B7FFF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <div className="font-mono font-semibold text-lg text-white">
                Block {block.number.toLocaleString()}
              </div>
              <div className="text-sm text-[#B0B0B0]">
                {formatRelativeTime(block.timestamp)}
              </div>
            </div>
          </div>
          <div className="px-2 py-1 rounded bg-white/10 text-xs font-mono text-[#B0B0B0]">
            {formatBlockNumberHex(block.number)}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/10">
          <div>
            <div className="text-xs text-[#B0B0B0] uppercase tracking-wider mb-1">Hash</div>
            <div className="font-mono text-sm text-white">{truncateHash(block.hash)}</div>
          </div>
          <div>
            <div className="text-xs text-[#B0B0B0] uppercase tracking-wider mb-1">Transactions</div>
            <div className="font-medium text-white">{txCount}</div>
          </div>
          <div>
            <div className="text-xs text-[#B0B0B0] uppercase tracking-wider mb-1">Gas Used</div>
            <div className="font-mono text-sm text-white">{formatGas(gasUsed)}</div>
          </div>
          <div>
            <div className="text-xs text-[#B0B0B0] uppercase tracking-wider mb-1">Gas Limit</div>
            <div className="font-mono text-sm text-white">{formatGas(gasLimit)}</div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/explorer/blocks/${block.number}`}
      className="block p-5 border border-black/10 rounded-xl hover:border-black/20 hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center group-hover:bg-[#0055ff]/10 transition-colors">
            <svg className="w-6 h-6 text-black/40 group-hover:text-[#0055ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <div className="font-mono font-semibold text-lg">
              Block {block.number.toLocaleString()}
            </div>
            <div className="text-sm text-black/40">
              {formatRelativeTime(block.timestamp)}
            </div>
          </div>
        </div>
        <div className="px-2 py-1 rounded bg-black/5 text-xs font-mono text-black/60">
          {formatBlockNumberHex(block.number)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-black/5">
        <div>
          <div className="text-xs text-black/40 uppercase tracking-wider mb-1">Hash</div>
          <div className="font-mono text-sm">{truncateHash(block.hash)}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 uppercase tracking-wider mb-1">Transactions</div>
          <div className="font-medium">{txCount}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 uppercase tracking-wider mb-1">Gas Used</div>
          <div className="font-mono text-sm">{formatGas(gasUsed)}</div>
        </div>
        <div>
          <div className="text-xs text-black/40 uppercase tracking-wider mb-1">Gas Limit</div>
          <div className="font-mono text-sm">{formatGas(gasLimit)}</div>
        </div>
      </div>
    </Link>
  );
}
