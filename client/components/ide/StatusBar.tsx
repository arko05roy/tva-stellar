"use client";

import React from "react";
import { motion } from "framer-motion";

const WalletIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M2 10h20" />
        <circle cx="17" cy="14" r="2" />
    </svg>
);

const NetworkIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
);

const BellIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
);

const GitBranchIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="6" y1="3" x2="6" y2="15" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
);

const CheckIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

export default function StatusBar() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="h-[28px] w-full bg-[#0a0a0a] text-[#808080] flex items-center justify-between px-3 text-[11px] font-sans select-none border-t border-[#1a1a1a]"
        >
            {/* Left Side */}
            <div className="flex items-center gap-2 h-full">
                {/* Connection Status */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors"
                    whileHover={{ scale: 1.02 }}
                >
                    <motion.div
                        className="w-2 h-2 rounded-full bg-[#22C55E]"
                        animate={{
                            boxShadow: ['0 0 0 0 rgba(34, 197, 94, 0.4)', '0 0 0 4px rgba(34, 197, 94, 0)', '0 0 0 0 rgba(34, 197, 94, 0)']
                        }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                    <span className="text-white font-medium">Connected</span>
                </motion.div>

                <span className="text-[#2a2a2a]">|</span>

                {/* Network */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors"
                    whileHover={{ scale: 1.02 }}
                >
                    <NetworkIcon />
                    <span className="text-[#FFC800] font-medium">Testnet</span>
                </motion.div>

                <span className="text-[#2a2a2a]">|</span>

                {/* Git Branch */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors"
                    whileHover={{ scale: 1.02 }}
                >
                    <GitBranchIcon />
                    <span>main</span>
                    <div className="flex items-center gap-0.5 text-[10px]">
                        <span className="text-[#22C55E]">✓</span>
                    </div>
                </motion.div>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-2 h-full">
                {/* Problems indicator */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors"
                    whileHover={{ scale: 1.02 }}
                >
                    <div className="flex items-center gap-1 text-[10px]">
                        <span className="flex items-center gap-0.5">
                            <span className="text-[#EF4444]">⊗</span> 0
                        </span>
                        <span className="flex items-center gap-0.5">
                            <span className="text-[#F59E0B]">⚠</span> 0
                        </span>
                    </div>
                </motion.div>

                <span className="text-[#2a2a2a]">|</span>

                {/* Wallet Address */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors group"
                    whileHover={{ scale: 1.02 }}
                >
                    <WalletIcon />
                    <span className="font-mono text-white">GAXP...7K5Y</span>
                    <span className="text-[10px] text-[#4a4a4a] group-hover:text-[#808080]">↗</span>
                </motion.div>

                <span className="text-[#2a2a2a]">|</span>

                {/* Balance */}
                <motion.div
                    className="flex items-center gap-1.5 px-2 h-full hover:bg-[#1a1a1a] rounded cursor-pointer transition-colors"
                    whileHover={{ scale: 1.02 }}
                >
                    <span className="font-medium text-white">245.50</span>
                    <span className="text-[#FFC800] font-bold">XLM</span>
                </motion.div>

                <span className="text-[#2a2a2a]">|</span>

                {/* Notifications */}
                <motion.button
                    className="flex items-center justify-center w-6 h-6 hover:bg-[#1a1a1a] rounded transition-colors relative"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <BellIcon />
                    {/* Notification dot */}
                    <motion.div
                        className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#FFC800]"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                    />
                </motion.button>
            </div>
        </motion.div>
    );
}
