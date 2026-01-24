"use client";

import { useState } from "react";
import Link from "next/link";
import { useLatestBlock } from "../hooks/useLatestBlock";
import { useBlockscoutStats, useIsBlockscoutEnabled } from "../hooks/useBlockscout";
import { SearchBar } from "./SearchBar";
import { TVA_CHAIN_ID } from "../lib/constants";

export function ExplorerHeader() {
  const { data: latestBlock, isLoading } = useLatestBlock();
  const isBlockscoutEnabled = useIsBlockscoutEnabled();
  const { data: blockscoutStats } = useBlockscoutStats();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Use Blockscout stats for latest block if available
  const displayBlock = isBlockscoutEnabled && blockscoutStats?.total_blocks
    ? blockscoutStats.total_blocks
    : latestBlock?.toLocaleString();

  const connectWallet = async () => {
    setConnecting(true);
    try {
      const ethereum = typeof window !== "undefined" ? (window as any).ethereum : null;
      if (ethereum) {
        // Add TVA network to MetaMask
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: `0x${TVA_CHAIN_ID.toString(16)}`,
              chainName: "TVA Testnet",
              nativeCurrency: { name: "XLM", symbol: "XLM", decimals: 18 },
              rpcUrls: [process.env.NEXT_PUBLIC_TVA_RPC_URL || "http://localhost:8545"],
              blockExplorerUrls: [window.location.origin + "/explorer"],
            }],
          });
        } catch { /* network may already exist */ }

        // Switch to TVA network
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${TVA_CHAIN_ID.toString(16)}` }],
          });
        } catch { /* user rejected switch */ }

        const accounts = await ethereum.request({ method: "eth_requestAccounts" });
        if (accounts?.[0]) setWalletAddress(accounts[0]);
      } else {
        // Demo mode fallback
        const demoAddress = "0xTVA" + Array.from({ length: 36 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
        setWalletAddress(demoAddress);
      }
    } catch { /* user rejected */ }
    setConnecting(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Logo & Title */}
          <Link href="/explorer" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#FFC800] flex items-center justify-center">
              <span className="text-black font-bold text-sm font-mono">T</span>
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-white">TVA Explorer</span>
              <span className="hidden sm:inline text-xs text-[#B0B0B0] font-mono ml-2">
                Chain {TVA_CHAIN_ID}
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl hidden md:block">
            <SearchBar darkMode />
          </div>

          {/* Network Status & Wallet */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Latest Block */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-mono text-[#B0B0B0]">
                {isLoading ? (
                  "..."
                ) : displayBlock ? (
                  <>
                    Block{" "}
                    <Link
                      href={`/explorer/blocks/${latestBlock || displayBlock}`}
                      className="text-[#FFC800] hover:text-[#FFC800]/80"
                    >
                      {displayBlock}
                    </Link>
                  </>
                ) : (
                  "Connecting..."
                )}
              </span>
            </div>

            {/* Network Badge */}
            <div className="px-3 py-2 rounded-lg border border-[#9B7FFF]/30 bg-[#9B7FFF]/10">
              <span className="text-sm font-medium text-[#9B7FFF]">Testnet</span>
            </div>

            {/* Wallet Connect */}
            {walletAddress ? (
              <button
                onClick={() => setWalletAddress(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFC800] text-black text-sm font-mono hover:bg-[#FFC800]/90 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-600" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFC800] text-black text-sm font-medium hover:bg-[#FFC800]/90 transition-colors disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 5H3a1 1 0 00-1 1v12a1 1 0 001 1h18a1 1 0 001-1V6a1 1 0 00-1-1z" />
                  <circle cx="16" cy="12" r="2" fill="currentColor" />
                  <path d="M2 9h20" />
                </svg>
                {connecting ? "Connecting..." : "Connect"}
              </button>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="mt-4 md:hidden">
          <SearchBar darkMode />
        </div>
      </div>
    </header>
  );
}
