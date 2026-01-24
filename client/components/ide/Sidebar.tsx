"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, useProject } from "./useProjectState";

interface SidebarProps {
    activeView: "explorer" | "search" | "git" | "debug" | "extensions";
}

// Icons
const ChevronDown = ({ className = "" }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M6 9l6 6 6-6" />
    </svg>
);

const ChevronRight = ({ className = "" }: { className?: string }) => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const FileIcon = ({ name }: { name: string }) => {
    const ext = name.split('.').pop();
    const colors: Record<string, string> = {
        sol: "#FFC800",
        rs: "#DEA584",
        ts: "#3178C6",
        js: "#F7DF1E",
        json: "#6D6D6D",
        md: "#519ABA",
    };
    return (
        <div
            className="w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold"
            style={{ backgroundColor: `${colors[ext || ''] || '#4a4a4a'}20`, color: colors[ext || ''] || '#808080' }}
        >
            {ext?.slice(0, 2).toUpperCase()}
        </div>
    );
};

const FolderIcon = ({ open }: { open: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={open ? "#FFC800" : "#4a4a4a"} className="transition-colors">
        <path d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H13L11 5H5C3.89543 5 3 5.89543 3 7Z" />
    </svg>
);

const PlusIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

export default function Sidebar({ activeView }: SidebarProps) {
    const { project, setActiveFileId, activeFileId } = useProject();
    const [activeTab, setActiveTab] = useState<"program" | "build" | "deploy">("program");
    const [deployStatus, setDeployStatus] = useState<"idle" | "building" | "deploying" | "success" | "error">("idle");
    const [programId] = useState<string>("GAXP7K5Y...8xmNtMm1BkqKjehkM7Hv5n3fRo6k");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root", "src"]));

    const toggleFolder = (id: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // File Tree Renderer
    const RenderFolder = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        const isExpanded = expandedFolders.has(folder.id);

        return (
            <div className="flex flex-col">
                {/* Folder header */}
                {depth > 0 && (
                    <motion.div
                        onClick={() => toggleFolder(folder.id)}
                        className="group cursor-pointer flex items-center gap-1.5 px-2 py-1 transition-all text-[13px] text-[#808080] hover:text-white hover:bg-[#1a1a1a]"
                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                        whileHover={{ x: 2 }}
                    >
                        {isExpanded ? <ChevronDown className="text-[#4a4a4a]" /> : <ChevronRight className="text-[#4a4a4a]" />}
                        <FolderIcon open={isExpanded} />
                        <span className="truncate font-medium">{folder.name}</span>
                    </motion.div>
                )}

                <AnimatePresence>
                    {(depth === 0 || isExpanded) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            {folder.files.map((file, index) => (
                                <motion.div
                                    key={file.id}
                                    onClick={() => setActiveFileId(file.id)}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className={`group cursor-pointer flex items-center gap-2 px-2 py-1 transition-all text-[13px]
                                        ${activeFileId === file.id
                                            ? "bg-[#FFC800]/10 text-[#FFC800] border-l-2 border-[#FFC800]"
                                            : "text-[#808080] hover:text-white hover:bg-[#1a1a1a] border-l-2 border-transparent"
                                        }`}
                                    style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}
                                    whileHover={{ x: 2 }}
                                >
                                    <FileIcon name={file.name} />
                                    <span className="truncate">{file.name}</span>
                                </motion.div>
                            ))}
                            {folder.folders.map((sub) => (
                                <RenderFolder key={sub.id} folder={sub} depth={depth + 1} />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    const handleBuild = () => {
        setDeployStatus("building");
        setTimeout(() => setDeployStatus("idle"), 2000);
    };

    const handleDeploy = () => {
        setDeployStatus("deploying");
        setTimeout(() => setDeployStatus("success"), 3000);
    };

    if (activeView !== "explorer" && activeView !== "debug") {
        return (
            <div className="w-[280px] bg-[#0a0a0a] flex flex-col h-full border-r border-[#1a1a1a]">
                <div className="h-10 px-4 flex items-center text-[11px] font-semibold text-[#808080] uppercase tracking-widest border-b border-[#1a1a1a]">
                    {activeView === "git" ? "Build" : activeView === "search" ? "Tools" : "Extensions"}
                </div>
                <div className="flex-1 flex items-center justify-center text-[#4a4a4a] text-xs">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-[#1a1a1a] mx-auto flex items-center justify-center">
                            <span className="text-2xl opacity-50">🚧</span>
                        </div>
                        <p>Coming Soon</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-[280px] bg-[#0a0a0a] flex flex-col h-full border-r border-[#1a1a1a]">
            {/* Header */}
            <div className="h-10 px-4 flex items-center justify-between text-[11px] font-semibold text-[#808080] uppercase tracking-widest border-b border-[#1a1a1a]">
                <span>Explorer</span>
                <div className="flex items-center gap-1">
                    <motion.button
                        className="p-1 rounded hover:bg-[#1a1a1a] text-[#4a4a4a] hover:text-[#FFC800] transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <PlusIcon />
                    </motion.button>
                    <motion.button
                        className="p-1 rounded hover:bg-[#1a1a1a] text-[#4a4a4a] hover:text-white transition-colors"
                        whileHover={{ scale: 1.1, rotate: 180 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <RefreshIcon />
                    </motion.button>
                </div>
            </div>

            {/* Project Section */}
            <div className="border-b border-[#1a1a1a]">
                {/* Project Selector */}
                <div className="px-3 py-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#111111] rounded-lg border border-[#1a1a1a] hover:border-[#FFC800]/30 transition-colors cursor-pointer group">
                        <div className="w-6 h-6 rounded bg-gradient-to-br from-[#FFC800] to-[#FFE066] flex items-center justify-center">
                            <span className="text-black text-[10px] font-bold">S</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-white font-medium truncate">{project.name}</div>
                            <div className="text-[10px] text-[#4a4a4a]">Stellar Smart Contract</div>
                        </div>
                        <ChevronDown className="text-[#4a4a4a] group-hover:text-[#FFC800] transition-colors" />
                    </div>
                </div>

                {/* Action Tabs */}
                <div className="flex items-center px-3 pb-3 gap-1">
                    {[
                        { id: "program", label: "Program", color: "#FFC800" },
                        { id: "build", label: "Build", color: "#22C55E", action: handleBuild },
                        { id: "deploy", label: "Deploy", color: "#3B82F6", action: handleDeploy },
                    ].map((tab) => (
                        <motion.button
                            key={tab.id}
                            onClick={() => {
                                setActiveTab(tab.id as any);
                                tab.action?.();
                            }}
                            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all relative overflow-hidden
                                ${activeTab === tab.id
                                    ? "text-black"
                                    : "text-[#808080] hover:text-white bg-[#111111] border border-[#1a1a1a] hover:border-[#2a2a2a]"
                                }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {activeTab === tab.id && (
                                <motion.div
                                    layoutId="activeTabBg"
                                    className="absolute inset-0 rounded-md"
                                    style={{ backgroundColor: tab.color }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center justify-center gap-1">
                                {(deployStatus === "building" && tab.id === "build") ||
                                (deployStatus === "deploying" && tab.id === "deploy") ? (
                                    <motion.span
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    >
                                        ⟳
                                    </motion.span>
                                ) : null}
                                {tab.label}
                            </span>
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* File Tree / Content */}
            <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
                <AnimatePresence mode="wait">
                    {activeTab === "program" && (
                        <motion.div
                            key="program"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                        >
                            {/* src folder */}
                            <motion.div
                                onClick={() => toggleFolder("src")}
                                className="group cursor-pointer flex items-center gap-1.5 px-3 py-1 transition-all text-[13px] text-[#808080] hover:text-white hover:bg-[#1a1a1a]"
                                whileHover={{ x: 2 }}
                            >
                                {expandedFolders.has("src") ? <ChevronDown className="text-[#4a4a4a]" /> : <ChevronRight className="text-[#4a4a4a]" />}
                                <FolderIcon open={expandedFolders.has("src")} />
                                <span className="truncate font-medium">src</span>
                            </motion.div>
                            <RenderFolder folder={project.root} depth={1} />
                        </motion.div>
                    )}

                    {activeTab === "build" && (
                        <motion.div
                            key="build"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="px-3 py-3 space-y-3"
                        >
                            <div className="p-3 rounded-lg bg-[#111111] border border-[#1a1a1a]">
                                <div className="text-[11px] text-[#4a4a4a] uppercase tracking-wider mb-2">Build Status</div>
                                {deployStatus === "building" ? (
                                    <div className="flex items-center gap-2">
                                        <motion.div
                                            className="w-2 h-2 rounded-full bg-[#FFC800]"
                                            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.5, 1] }}
                                            transition={{ repeat: Infinity, duration: 1 }}
                                        />
                                        <span className="text-[#FFC800] text-sm">Building...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
                                        <span className="text-[#22C55E] text-sm">Ready to build</span>
                                    </div>
                                )}
                            </div>
                            <p className="text-[12px] text-[#4a4a4a] leading-relaxed">
                                Build your program to generate the WASM binary for deployment to the Stellar network.
                            </p>
                        </motion.div>
                    )}

                    {activeTab === "deploy" && (
                        <motion.div
                            key="deploy"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="px-3 py-3 space-y-3"
                        >
                            {/* Program ID */}
                            <div className="p-3 rounded-lg bg-[#111111] border border-[#1a1a1a]">
                                <div className="text-[11px] text-[#4a4a4a] uppercase tracking-wider mb-2">Program ID</div>
                                <div className="flex items-center gap-2 bg-black rounded px-2 py-1.5 border border-[#1a1a1a]">
                                    <span className="text-[11px] text-[#FFC800] font-mono truncate flex-1">{programId}</span>
                                    <motion.button
                                        className="text-[#4a4a4a] hover:text-white transition-colors"
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="9" y="9" width="13" height="13" rx="2" />
                                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                        </svg>
                                    </motion.button>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                                {["New", "Import", "Export"].map((action) => (
                                    <motion.button
                                        key={action}
                                        className="flex-1 py-1.5 text-[10px] font-semibold bg-[#111111] text-[#808080] rounded border border-[#1a1a1a] hover:border-[#FFC800]/50 hover:text-[#FFC800] transition-colors"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        {action}
                                    </motion.button>
                                ))}
                            </div>

                            {/* Status */}
                            {deployStatus === "deploying" && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex items-center gap-2 text-[#3B82F6] text-sm"
                                >
                                    <motion.span
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                                    >
                                        ⟳
                                    </motion.span>
                                    Deploying to Testnet...
                                </motion.div>
                            )}
                            {deployStatus === "success" && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 text-[#22C55E] text-sm"
                                >
                                    <span>✓</span> Deployed successfully
                                </motion.div>
                            )}

                            {/* Warning */}
                            <div className="flex items-start gap-2 p-2 rounded bg-[#FFC800]/5 border border-[#FFC800]/20">
                                <span className="text-[#FFC800]">⚠</span>
                                <span className="text-[10px] text-[#FFC800]/80 leading-relaxed">
                                    You need authority to upgrade this program after deployment.
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Client Section */}
            <div className="border-t border-[#1a1a1a] py-2">
                <div className="px-3 py-1 text-[10px] text-[#4a4a4a] uppercase tracking-wider font-semibold">Client</div>
                {["client", "tests"].map((folder) => (
                    <motion.div
                        key={folder}
                        className="group cursor-pointer flex items-center gap-1.5 px-3 py-1 transition-all text-[13px] text-[#808080] hover:text-white hover:bg-[#1a1a1a]"
                        whileHover={{ x: 2 }}
                    >
                        <ChevronRight className="text-[#4a4a4a]" />
                        <FolderIcon open={false} />
                        <span className="truncate">{folder}</span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
