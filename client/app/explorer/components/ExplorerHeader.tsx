"use client";

import { useState } from "react";
import Link from "next/link";
import { useLatestBlock } from "../hooks/useLatestBlock";
import { SearchBar } from "./SearchBar";
import { TVA_CHAIN_ID } from "../lib/constants";

export function ExplorerHeader() {
  const { data: latestBlock, isLoading } = useLatestBlock();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    setConnecting(true);
    try {
      // Add TVA network to MetaMask
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: `0x${TVA_CHAIN_ID.toString(16)}`,
            chainName: "TVA Testnet",
            nativeCurrency: { name: "XLM", symbol: "XLM", decimals: 18 },
            rpcUrls: [window.location.origin + "/api/rpc"],
            blockExplorerUrls: [window.location.origin + "/explorer"],
          }],
        });
      } catch { /* network may already exist */ }

      // Switch to TVA network
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: `0x${TVA_CHAIN_ID.toString(16)}` }],
        });
      } catch { /* user rejected switch */ }

      const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      if (accounts?.[0]) setWalletAddress(accounts[0]);
    } catch { /* user rejected */ }
    setConnecting(false);
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-black/5">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          {/* Logo & Title */}
          <Link href="/explorer" className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-sm font-mono">T</span>
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight">TVA Explorer</span>
              <span className="hidden sm:inline text-xs text-black/40 font-mono ml-2">
                Chain {TVA_CHAIN_ID}
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-xl hidden md:block">
            <SearchBar />
          </div>

          {/* Network Status & Wallet */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Latest Block */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-black/5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-mono text-black/60">
                {isLoading ? (
                  "..."
                ) : latestBlock ? (
                  <>
                    Block{" "}
                    <Link
                      href={`/explorer/blocks/${latestBlock}`}
                      className="text-[#0055ff] hover:underline"
                    >
                      {latestBlock.toLocaleString()}
                    </Link>
                  </>
                ) : (
                  "Connecting..."
                )}
              </span>
            </div>

            {/* Network Badge */}
            <div className="px-3 py-2 rounded-lg border border-[#0055ff]/20 bg-[#0055ff]/5">
              <span className="text-sm font-medium text-[#0055ff]">Testnet</span>
            </div>

            {/* Wallet Connect */}
            {walletAddress ? (
              <button
                onClick={() => setWalletAddress(null)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black text-white text-sm font-mono hover:bg-black/80 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-green-400" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </button>
            ) : (
              <button
                onClick={connectWallet}
                disabled={connecting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-sm font-medium hover:bg-black/80 transition-colors disabled:opacity-50"
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
          <SearchBar />
        </div>
      </div>
    </header>
  );
}
