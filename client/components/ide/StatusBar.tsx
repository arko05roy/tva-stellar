"use client";

import React from "react";
import { motion } from "framer-motion";
import { useProject } from "./useProjectState";

export default function StatusBar() {
    const { buildStatus, activeFile, isWalletConnected, walletAddress, walletBalance, logs } = useProject();

    const errorCount = logs.filter(l => l.type === "error").length;
    const warningCount = logs.filter(l => l.type === "warning").length;

    const getStatusColor = () => {
        switch (buildStatus) {
            case "compiling": case "verifying": case "deploying": return "#FFC800";
            case "compiled": case "verified": case "deployed": return "#22C55E";
            case "error": return "#EF4444";
            default: return "#3a3a3a";
        }
    };

    const getStatusLabel = () => {
        switch (buildStatus) {
            case "compiling": return "Compiling...";
            case "compiled": return "Build Ready";
            case "verifying": return "Verifying...";
            case "verified": return "Verified";
            case "deploying": return "Deploying...";
            case "deployed": return "Deployed";
            case "error": return "Error";
            default: return "Ready";
        }
    };

    return (
        <div className="h-[24px] w-full bg-[#080808] text-[#666] flex items-center justify-between px-2 text-[10px] font-mono select-none border-t border-[#141414] shrink-0 relative z-20">
            {/* Left Side */}
            <div className="flex items-center gap-0 h-full">
                {/* Build Status */}
                <div className="flex items-center gap-1.5 px-2 h-full">
                    <motion.div
                        className="w-[5px] h-[5px] rounded-full"
                        style={{ backgroundColor: getStatusColor() }}
                        animate={["compiling", "verifying", "deploying"].includes(buildStatus)
                            ? { opacity: [1, 0.4, 1] }
                            : {}}
                        transition={{ repeat: Infinity, duration: 1 }}
                    />
                    <span style={{ color: getStatusColor() }}>{getStatusLabel()}</span>
                </div>

                <span className="text-[#1a1a1a]">|</span>

                {/* Active File */}
                <div className="flex items-center gap-1 px-2 h-full">
                    <span className="text-[#555]">{activeFile?.name || "No file"}</span>
                </div>

                <span className="text-[#1a1a1a]">|</span>

                {/* Problems */}
                <div className="flex items-center gap-2 px-2 h-full">
                    <span className="flex items-center gap-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={errorCount > 0 ? "#EF4444" : "#333"} strokeWidth="2">
                            <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                        </svg>
                        <span style={{ color: errorCount > 0 ? "#EF4444" : "#333" }}>{errorCount}</span>
                    </span>
                    <span className="flex items-center gap-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={warningCount > 0 ? "#F59E0B" : "#333"} strokeWidth="2">
                            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        <span style={{ color: warningCount > 0 ? "#F59E0B" : "#333" }}>{warningCount}</span>
                    </span>
                </div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-0 h-full">
                {/* Network */}
                <div className="flex items-center gap-1.5 px-2 h-full">
                    <div className="w-[5px] h-[5px] rounded-full bg-[#22C55E]" />
                    <span className="text-[#555]">Stellar Testnet</span>
                </div>

                <span className="text-[#1a1a1a]">|</span>

                {/* Wallet */}
                <div className="flex items-center gap-1.5 px-2 h-full">
                    {isWalletConnected ? (
                        <>
                            <span className="text-[#808080]">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                            <span className="text-[#FFC800]">{walletBalance} XLM</span>
                        </>
                    ) : (
                        <span className="text-[#333]">No wallet</span>
                    )}
                </div>

                <span className="text-[#1a1a1a]">|</span>

                {/* Compiler */}
                <div className="flex items-center gap-1 px-2 h-full">
                    <span className="text-[#444]">Solang v0.3.4</span>
                </div>
            </div>
        </div>
    );
}
