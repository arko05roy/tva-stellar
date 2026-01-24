"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useProject } from "./useProjectState";

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

interface TerminalProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

export default function Terminal({ isCollapsed, onToggle }: TerminalProps) {
    const { logs, clearLogs } = useProject();
    const [activeTab, setActiveTab] = useState<'output' | 'problems' | 'debug'>('output');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const getLogStyles = (type: string) => {
        switch (type) {
            case 'success':
                return { prefix: 'text-[#22C55E]', msg: 'text-[#22C55E]' };
            case 'error':
                return { prefix: 'text-[#EF4444]', msg: 'text-[#EF4444]' };
            case 'warning':
                return { prefix: 'text-[#F59E0B]', msg: 'text-[#F59E0B]' };
            case 'building':
                return { prefix: 'text-[#FFC800]', msg: 'text-[#FFC800]' };
            case 'verifying':
                return { prefix: 'text-[#9B7FFF]', msg: 'text-[#9B7FFF]' };
            case 'deploying':
                return { prefix: 'text-[#3B82F6]', msg: 'text-[#3B82F6]' };
            case 'system':
                return { prefix: 'text-[#FFC800]', msg: 'text-[#808080]' };
            case 'info':
            default:
                return { prefix: 'text-[#333]', msg: 'text-[#666]' };
        }
    };

    const getLogPrefix = (type: string) => {
        switch (type) {
            case 'success': return '[ok]';
            case 'error': return '[!!]';
            case 'warning': return '[--]';
            case 'building': return '[>>]';
            case 'verifying': return '[??]';
            case 'deploying': return '[=>]';
            case 'system': return '[tv]';
            case 'info':
            default: return '   ';
        }
    };

    const errorCount = logs.filter(l => l.type === 'error').length;

    return (
        <motion.div
            className="h-full bg-[#050505] flex flex-col font-mono text-[11px] border-t border-[#141414]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* Terminal Header */}
            <div className="flex items-center justify-between h-[30px] px-3 border-b border-[#141414] bg-[#080808] shrink-0">
                {/* Tabs */}
                <div className="flex items-center gap-1">
                    {[
                        { id: 'output', label: 'Output' },
                        { id: 'problems', label: 'Problems', badge: errorCount },
                        { id: 'debug', label: 'Debug Console' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as typeof activeTab)}
                            className={`px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase rounded transition-colors flex items-center gap-1.5
                                ${activeTab === tab.id
                                    ? 'text-white bg-[#141414]'
                                    : 'text-[#444] hover:text-[#888]'
                                }`}
                        >
                            {tab.label}
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className={`px-1.5 py-0.5 text-[9px] rounded-full ${activeTab === tab.id ? 'bg-red-900/50 text-red-400' : 'bg-[#1a1a1a] text-[#4a4a4a]'
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
                        onClick={clearLogs}
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
                        onClick={onToggle}
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
            {!isCollapsed && (
                <div className="flex-1 overflow-hidden">
                    <div ref={scrollRef} className="h-full overflow-y-auto p-3 space-y-0.5">
                        {activeTab === 'output' && logs.map((log, i) => {
                            const styles = getLogStyles(log.type);
                            return (
                                <div
                                    key={i}
                                    className="flex items-start group hover:bg-[#0a0a0a] rounded px-2 py-0.5 -mx-2"
                                >
                                    <span className={`w-8 flex-shrink-0 ${styles.prefix}`}>
                                        {getLogPrefix(log.type)}
                                    </span>
                                    <span className={`flex-1 whitespace-pre-wrap break-all ${styles.msg}`}>
                                        {log.msg}
                                    </span>
                                </div>
                            );
                        })}

                        {activeTab === 'problems' && (
                            logs.filter(l => l.type === 'error' || l.type === 'warning').length === 0
                                ? <div className="text-[#4a4a4a] text-center py-4">No problems detected</div>
                                : logs.filter(l => l.type === 'error' || l.type === 'warning').map((log, i) => {
                                    const styles = getLogStyles(log.type);
                                    return (
                                        <div key={i} className="flex items-start px-2 py-0.5">
                                            <span className={`w-8 flex-shrink-0 ${styles.prefix}`}>
                                                {getLogPrefix(log.type)}
                                            </span>
                                            <span className={`flex-1 ${styles.msg}`}>{log.msg}</span>
                                        </div>
                                    );
                                })
                        )}

                        {activeTab === 'debug' && (
                            <div className="text-[#4a4a4a] text-center py-4">Debug console</div>
                        )}

                        {/* Cursor Line */}
                        {activeTab === 'output' && (
                            <div className="flex items-center mt-2">
                                <span className="text-[#FFC800] font-bold mr-2">$</span>
                                <motion.span
                                    className="w-2 h-4 bg-[#FFC800]"
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
