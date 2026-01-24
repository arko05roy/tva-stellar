"use client";

import React from "react";

export default function StatusBar() {
    return (
        <div className="h-[24px] w-full bg-[#1e1e2e] text-[#B0B0B0] flex items-center justify-between px-3 text-[11px] font-sans select-none border-t border-[#2b2b3b]">
            {/* Left Side - Connection Status */}
            <div className="flex items-center gap-3 h-full">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="font-medium text-white">Connected to Stellar Wallet</span>
                </div>
                <span className="text-[#4A4A4A]">–</span>
                <span className="text-[#9B7FFF] font-medium">testnet</span>
            </div>

            {/* Right Side - Wallet Info */}
            <div className="flex items-center gap-3 h-full">
                <div className="flex items-center gap-1.5 hover:bg-white/5 px-2 rounded cursor-pointer h-full transition-colors">
                    <span className="font-mono text-white">GAXP...7K5Y</span>
                    <span className="text-[10px]">↗</span>
                </div>
                <span className="text-[#4A4A4A]">|</span>
                <div className="flex items-center gap-1 hover:bg-white/5 px-2 rounded cursor-pointer h-full transition-colors">
                    <span className="font-medium text-white">245.50</span>
                    <span className="text-[#FFC800] font-bold">XLM</span>
                </div>
            </div>
        </div>
    );
}
