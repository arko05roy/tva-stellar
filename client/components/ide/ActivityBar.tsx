"use client";

import React from "react";
import { motion } from "framer-motion";

interface ActivityBarProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const FileIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" />
    </svg>
);

const ToolsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
);

const BuildIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2L2 7L12 12L22 7L12 2Z" />
        <path d="M2 17L12 22L22 17" />
        <path d="M2 12L12 17L22 12" />
    </svg>
);

const RocketIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4.5 16.5C3 18 3 21 3 21S6 21 7.5 19.5C8.5 18.5 8.5 17 7.5 16C6.5 15 5 15.5 4.5 16.5Z" />
        <path d="M14.5 4C14.5 4 18 4.5 20 6.5C22 8.5 22.5 12 22.5 12L18 13L14.5 16.5L13.5 18.5L11 16L8 13L10 10.5L11 6L14.5 4Z" />
        <path d="M9 9L4.5 13.5" />
        <path d="M10.5 14.5L15 19" />
    </svg>
);

const GitHubIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 0C5.37 0 0 5.37 0 12C0 17.31 3.435 21.795 8.205 23.385C8.805 23.49 9.03 23.13 9.03 22.815C9.03 22.53 9.015 21.585 9.015 20.58C6 21.135 5.22 19.845 4.98 19.17C4.845 18.825 4.26 17.76 3.75 17.475C3.33 17.25 2.73 16.695 3.735 16.68C4.68 16.665 5.355 17.55 5.58 17.91C6.66 19.725 8.385 19.215 9.075 18.9C9.18 18.12 9.495 17.595 9.84 17.295C7.17 16.995 4.38 15.96 4.38 11.37C4.38 10.065 4.845 8.985 5.61 8.145C5.49 7.845 5.07 6.615 5.73 4.965C5.73 4.965 6.735 4.65 9.03 6.195C9.99 5.925 11.01 5.79 12.03 5.79C13.05 5.79 14.07 5.925 15.03 6.195C17.325 4.635 18.33 4.965 18.33 4.965C18.99 6.615 18.57 7.845 18.45 8.145C19.215 8.985 19.68 10.05 19.68 11.37C19.68 15.975 16.875 16.995 14.205 17.295C14.64 17.67 15.015 18.39 15.015 19.515C15.015 21.12 15 22.41 15 22.815C15 23.13 15.225 23.505 15.825 23.385C20.565 21.795 24 17.295 24 12C24 5.37 18.63 0 12 0Z" />
    </svg>
);

const SettingsIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
);

export default function ActivityBar({ activeTab, setActiveTab }: ActivityBarProps) {
    const items = [
        { id: "explorer", icon: FileIcon, label: "Explorer" },
        { id: "search", icon: ToolsIcon, label: "Tools" },
        { id: "git", icon: BuildIcon, label: "Build" },
        { id: "debug", icon: RocketIcon, label: "Deploy" },
    ];

    return (
        <div className="w-[56px] h-full flex flex-col bg-[#0a0a0a] border-r border-[#1a1a1a] justify-between">
            {/* Logo */}
            <div className="h-[56px] flex items-center justify-center border-b border-[#1a1a1a]">
                <motion.div
                    className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FFC800] to-[#FFE066] flex items-center justify-center"
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <span className="text-black font-bold text-sm">S</span>
                </motion.div>
            </div>

            {/* Main Nav Items */}
            <div className="flex-1 flex flex-col pt-2">
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                        <motion.button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            title={item.label}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`relative w-full h-[48px] flex items-center justify-center transition-all duration-200 group
                                ${isActive
                                    ? "text-[#FFC800]"
                                    : "text-[#4a4a4a] hover:text-[#808080]"
                                }`}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <motion.div
                                    layoutId="activeIndicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 bg-[#FFC800] rounded-r-full"
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}

                            {/* Icon container with glow effect */}
                            <motion.div
                                className={`relative ${isActive ? "drop-shadow-[0_0_8px_rgba(255,200,0,0.4)]" : ""}`}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Icon />
                            </motion.div>

                            {/* Tooltip */}
                            <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#2a2a2a]">
                                {item.label}
                            </div>
                        </motion.button>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-col pb-3 border-t border-[#1a1a1a]">
                <motion.button
                    title="GitHub"
                    className="w-full h-[48px] flex items-center justify-center text-[#4a4a4a] hover:text-[#808080] transition-colors group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <GitHubIcon />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#2a2a2a]">
                        GitHub
                    </div>
                </motion.button>
                <motion.button
                    title="Settings"
                    className="w-full h-[48px] flex items-center justify-center text-[#4a4a4a] hover:text-[#808080] transition-colors group"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <SettingsIcon />
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#1a1a1a] text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 border border-[#2a2a2a]">
                        Settings
                    </div>
                </motion.button>
            </div>
        </div>
    );
}
