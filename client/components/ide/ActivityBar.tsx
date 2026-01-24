"use client";

import React from "react";
import { motion } from "framer-motion";
import { useProject } from "./useProjectState";

interface ActivityBarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const FilesIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
        <path d="M13 2v7h7" />
    </svg>
);

const BuildIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
    </svg>
);

const WalletIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="6" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <circle cx="16" cy="14" r="2" />
    </svg>
);

const ExplorerIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
);

export default function ActivityBar({ activeTab, setActiveTab }: ActivityBarProps) {
    const { isWalletConnected, buildStatus } = useProject();

    const items = [
        { id: "explorer", icon: FilesIcon, label: "Files" },
        { id: "git", icon: BuildIcon, label: "Build & Deploy" },
        { id: "debug", icon: ExplorerIcon, label: "Explorer" },
        { id: "extensions", icon: WalletIcon, label: "Wallet", badge: isWalletConnected },
    ];

    const hasBuildActivity = ["compiling", "verifying", "deploying"].includes(buildStatus);

    return (
        <div className="w-[48px] h-full flex flex-col bg-[#000000] border-r border-[#111] justify-between">
            {/* Logo */}
            <div className="h-[48px] flex items-center justify-center">
                <div className="w-7 h-7 rounded-md bg-[#FFC800] flex items-center justify-center">
                    <span className="text-black font-black text-[10px] tracking-tight">TVA</span>
                </div>
            </div>

            {/* Nav Items */}
            <div className="flex-1 flex flex-col items-center pt-1">
                {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                        <motion.button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            title={item.label}
                            className={`relative w-full h-[44px] flex items-center justify-center transition-colors
                                ${isActive ? "text-white" : "text-[#444] hover:text-[#888]"}`}
                            whileTap={{ scale: 0.9 }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="activityIndicator"
                                    className="absolute left-0 top-[10px] bottom-[10px] w-[2px] bg-[#FFC800]"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <Icon />
                            {/* Build activity pulse */}
                            {item.id === "git" && hasBuildActivity && (
                                <motion.div
                                    className="absolute top-2 right-2.5 w-[5px] h-[5px] rounded-full bg-[#FFC800]"
                                    animate={{ opacity: [1, 0.3, 1] }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                />
                            )}
                            {/* Wallet connected indicator */}
                            {item.id === "extensions" && isWalletConnected && (
                                <div className="absolute top-2 right-2.5 w-[5px] h-[5px] rounded-full bg-[#22C55E]" />
                            )}
                        </motion.button>
                    );
                })}
            </div>

            {/* Bottom */}
            <div className="flex flex-col items-center pb-3">
                <button className="w-full h-[44px] flex items-center justify-center text-[#333] hover:text-[#666] transition-colors"
                    title="Settings">
                    <SettingsIcon />
                </button>
            </div>
        </div>
    );
}
