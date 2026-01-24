"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ChevronDownIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const ClearIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
);

const MaximizeIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
);

type LogType = 'success' | 'command' | 'info' | 'warning' | 'error';

interface LogEntry {
    type: LogType;
    prefix: string;
    msg: string;
    timestamp?: string;
}

export default function Terminal() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [activeTab, setActiveTab] = useState<'output' | 'problems' | 'debug'>('output');

    const logs: LogEntry[] = [
        { type: 'success', prefix: '✓', msg: 'Initializing Stellar workspace... done', timestamp: '00:00:01' },
        { type: 'command', prefix: '$', msg: 'stellar build --network testnet', timestamp: '00:00:02' },
        { type: 'info', prefix: '→', msg: 'Fetching dependencies from stellar-sdk...', timestamp: '00:00:03' },
        { type: 'info', prefix: '→', msg: 'Compiling contract `counter` (0.8s)', timestamp: '00:00:04' },
        { type: 'info', prefix: '→', msg: 'Emitting WASM to build/counter.wasm', timestamp: '00:00:05' },
        { type: 'success', prefix: '✓', msg: 'Build pipeline ready. Ship your contracts!', timestamp: '00:00:06' },
    ];

    const getLogStyles = (type: LogType) => {
        switch (type) {
            case 'success':
                return { prefix: 'text-[#22C55E]', msg: 'text-[#22C55E]' };
            case 'command':
                return { prefix: 'text-[#FFC800]', msg: 'text-white' };
            case 'warning':
                return { prefix: 'text-[#F59E0B]', msg: 'text-[#F59E0B]' };
            case 'error':
                return { prefix: 'text-[#EF4444]', msg: 'text-[#EF4444]' };
            default:
                return { prefix: 'text-[#4a4a4a]', msg: 'text-[#808080]' };
        }
    };

    return (
        <motion.div
            className="h-full bg-[#050505] flex flex-col font-mono text-[13px] border-t border-[#1a1a1a]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* Terminal Header */}
            <div className="flex items-center justify-between h-[36px] px-3 border-b border-[#1a1a1a] bg-[#0a0a0a]">
                {/* Tabs */}
                <div className="flex items-center gap-1">
                    {[
                        { id: 'output', label: 'Output' },
                        { id: 'problems', label: 'Problems', badge: 0 },
                        { id: 'debug', label: 'Debug Console' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors flex items-center gap-1.5
                                ${activeTab === tab.id
                                    ? 'text-white bg-[#1a1a1a]'
                                    : 'text-[#4a4a4a] hover:text-[#808080]'
                                }`}
                        >
                            {tab.label}
                            {tab.badge !== undefined && (
                                <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${activeTab === tab.id ? 'bg-[#2a2a2a] text-[#808080]' : 'bg-[#1a1a1a] text-[#4a4a4a]'
                                    }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    <motion.button
                        className="p-1.5 rounded text-[#4a4a4a] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Clear"
                    >
                        <ClearIcon />
                    </motion.button>
                    <motion.button
                        className="p-1.5 rounded text-[#4a4a4a] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Maximize"
                    >
                        <MaximizeIcon />
                    </motion.button>
                    <motion.button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="p-1.5 rounded text-[#4a4a4a] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        animate={{ rotate: isCollapsed ? 180 : 0 }}
                        title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                        <ChevronDownIcon />
                    </motion.button>
                </div>
            </div>

            {/* Terminal Content */}
            <AnimatePresence>
                {!isCollapsed && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-hidden"
                    >
                        <div className="h-full overflow-y-auto p-3 space-y-0.5">
                            {logs.map((log, i) => {
                                const styles = getLogStyles(log.type);
                                return (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="flex items-start group hover:bg-[#0a0a0a] rounded px-2 py-0.5 -mx-2"
                                    >
                                        {/* Timestamp */}
                                        <span className="w-16 text-[10px] text-[#2a2a2a] group-hover:text-[#4a4a4a] transition-colors font-mono flex-shrink-0">
                                            {log.timestamp}
                                        </span>

                                        {/* Prefix */}
                                        <span className={`w-6 flex-shrink-0 font-bold ${styles.prefix}`}>
                                            {log.prefix}
                                        </span>

                                        {/* Message */}
                                        <span className={`flex-1 ${styles.msg}`}>
                                            {log.msg}
                                        </span>
                                    </motion.div>
                                );
                            })}

                            {/* Cursor Line */}
                            <motion.div
                                className="flex items-center mt-2"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.3 }}
                            >
                                <span className="w-16" />
                                <span className="text-[#FFC800] font-bold mr-2">$</span>
                                <motion.span
                                    className="w-2 h-4 bg-[#FFC800]"
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                />
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
