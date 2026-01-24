"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, File, useProject } from "./useProjectState";

interface SidebarProps {
    activeView: "explorer" | "search" | "git" | "debug" | "extensions";
}

// ─── ICONS ────────────────────────────────────────────────────────────────────

const ChevronIcon = ({ open, size = 10 }: { open: boolean; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
        style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}>
        <path d="M9 18l6-6-6-6" />
    </svg>
);

const FileTypeIcon = ({ name }: { name: string }) => {
    const ext = name.split(".").pop() || "";
    const config: Record<string, { color: string; label: string }> = {
        sol: { color: "#FFC800", label: "SOL" },
        rs: { color: "#DEA584", label: "RS" },
        ts: { color: "#3178C6", label: "TS" },
        js: { color: "#F7DF1E", label: "JS" },
        json: { color: "#6D6D6D", label: "{}" },
        md: { color: "#519ABA", label: "MD" },
    };
    const c = config[ext] || { color: "#4a4a4a", label: ext.slice(0, 2).toUpperCase() };
    return (
        <div className="w-[18px] h-[18px] rounded-[3px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${c.color}15`, border: `1px solid ${c.color}30` }}>
            <span style={{ color: c.color, fontSize: "7px", fontWeight: 700, letterSpacing: "-0.02em" }}>{c.label}</span>
        </div>
    );
};

const FolderGlyph = ({ open }: { open: boolean }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"
            fill={open ? "#FFC800" : "#3a3a3a"} opacity={open ? 1 : 0.7} />
    </svg>
);

const CopyIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const ExternalLinkIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
);

const WalletIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M21 5H3a1 1 0 00-1 1v12a1 1 0 001 1h18a1 1 0 001-1V6a1 1 0 00-1-1z" />
        <path d="M16 14a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
        <path d="M2 9h20" />
    </svg>
);

const DisconnectIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
);

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
    x: number;
    y: number;
    items: { label: string; action: () => void; danger?: boolean }[];
    onClose: () => void;
}

function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9999] py-1 min-w-[140px] bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-2xl shadow-black/50"
            style={{ top: y, left: x }}
        >
            {items.map((item, i) => (
                <button key={i} onClick={() => { item.action(); onClose(); }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${item.danger
                        ? "text-[#EF4444] hover:bg-[#EF4444]/10"
                        : "text-[#b0b0b0] hover:bg-[#252525] hover:text-white"
                        }`}>
                    {item.label}
                </button>
            ))}
        </motion.div>
    );
}

// ─── INLINE INPUT ─────────────────────────────────────────────────────────────

function InlineInput({ initial, onSubmit, onCancel }: { initial: string; onSubmit: (v: string) => void; onCancel: () => void }) {
    const [value, setValue] = useState(initial);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
    return (
        <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
                if (e.key === "Escape") onCancel();
            }}
            onBlur={() => { if (value.trim()) onSubmit(value.trim()); else onCancel(); }}
            className="w-full bg-[#0a0a0a] border border-[#FFC800]/50 rounded px-1.5 py-0.5 text-[12px] text-white outline-none"
            spellCheck={false}
        />
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Sidebar({ activeView }: SidebarProps) {
    const {
        project, activeFileId, setActiveFileId,
        createFile, renameFile, deleteFile, createFolder, deleteFolder,
        buildStatus, compileResult, verifyResult, deployResult,
        compile, verify, deploy,
        walletAddress, walletBalance, isWalletConnected, connectWallet, disconnectWallet,
    } = useProject();

    const [activeTab, setActiveTab] = useState<"files" | "build">("files");
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
    const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
    const [creatingFile, setCreatingFile] = useState<string | null>(null); // parent folder ID
    const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const toggleFolder = (id: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    // ─── FILE TREE ────────────────────────────────────────────────────────────

    const RenderFile = ({ file, depth }: { file: File; depth: number }) => {
        const isActive = activeFileId === file.id;
        const isRenaming = renamingId === file.id;

        return (
            <div
                className={`group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer transition-all text-[12px] ${isActive
                    ? "bg-[#FFC800]/8 text-[#FFC800]"
                    : "text-[#808080] hover:text-[#c0c0c0] hover:bg-[#ffffff06]"
                    }`}
                style={{ paddingLeft: `${depth * 14 + 16}px` }}
                onClick={() => !isRenaming && setActiveFileId(file.id)}
                onDoubleClick={() => setRenamingId(file.id)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                        x: e.clientX, y: e.clientY, onClose: () => setContextMenu(null),
                        items: [
                            { label: "Rename", action: () => setRenamingId(file.id) },
                            { label: "Delete", action: () => deleteFile(file.id), danger: true },
                        ]
                    });
                }}
            >
                {isActive && <div className="absolute left-0 w-[2px] h-4 bg-[#FFC800] rounded-r" />}
                <FileTypeIcon name={file.name} />
                {isRenaming ? (
                    <InlineInput
                        initial={file.name}
                        onSubmit={(v) => { renameFile(file.id, v); setRenamingId(null); }}
                        onCancel={() => setRenamingId(null)}
                    />
                ) : (
                    <span className="truncate select-none">{file.name}</span>
                )}
            </div>
        );
    };

    const RenderFolder = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        const isExpanded = expandedFolders.has(folder.id);
        return (
            <div>
                {depth > 0 && (
                    <div
                        className="group flex items-center gap-1.5 py-[3px] pr-2 cursor-pointer text-[12px] text-[#808080] hover:text-[#c0c0c0] hover:bg-[#ffffff06] transition-all"
                        style={{ paddingLeft: `${depth * 14 + 16}px` }}
                        onClick={() => toggleFolder(folder.id)}
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({
                                x: e.clientX, y: e.clientY, onClose: () => setContextMenu(null),
                                items: [
                                    { label: "New File", action: () => setCreatingFile(folder.id) },
                                    { label: "New Folder", action: () => setCreatingFolder(folder.id) },
                                    { label: "Delete Folder", action: () => deleteFolder(folder.id), danger: true },
                                ]
                            });
                        }}
                    >
                        <ChevronIcon open={isExpanded} />
                        <FolderGlyph open={isExpanded} />
                        <span className="truncate select-none font-medium">{folder.name}</span>
                    </div>
                )}
                <AnimatePresence>
                    {(depth === 0 || isExpanded) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.12 }}
                            className="overflow-hidden"
                        >
                            {folder.folders.map((sub) => (
                                <RenderFolder key={sub.id} folder={sub} depth={(depth || 0) + 1} />
                            ))}
                            {folder.files.map((file) => (
                                <RenderFile key={file.id} file={file} depth={(depth || 0) + 1} />
                            ))}
                            {creatingFile === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 14 + 16}px` }} className="py-1 pr-2">
                                    <InlineInput
                                        initial="NewContract.sol"
                                        onSubmit={(v) => { createFile(v, folder.id); setCreatingFile(null); }}
                                        onCancel={() => setCreatingFile(null)}
                                    />
                                </div>
                            )}
                            {creatingFolder === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 14 + 16}px` }} className="py-1 pr-2">
                                    <InlineInput
                                        initial="new-folder"
                                        onSubmit={(v) => { createFolder(v, folder.id); setCreatingFolder(null); }}
                                        onCancel={() => setCreatingFolder(null)}
                                    />
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ─── PIPELINE STATUS ──────────────────────────────────────────────────────

    const PipelineStep = ({ label, status, step }: { label: string; status: "idle" | "active" | "done" | "error"; step: number }) => {
        const colors = { idle: "#3a3a3a", active: "#FFC800", done: "#22C55E", error: "#EF4444" };
        return (
            <div className="flex items-center gap-2">
                <div className="relative flex items-center justify-center w-5 h-5">
                    {status === "active" ? (
                        <motion.div
                            className="w-full h-full rounded-full border-2"
                            style={{ borderColor: colors[status], borderTopColor: "transparent" }}
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                        />
                    ) : (
                        <div className="w-full h-full rounded-full border-2 flex items-center justify-center"
                            style={{ borderColor: colors[status] }}>
                            {status === "done" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.done} strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                            {status === "error" && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={colors.error} strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                            {status === "idle" && <span className="text-[8px] text-[#3a3a3a] font-bold">{step}</span>}
                        </div>
                    )}
                </div>
                <span className={`text-[11px] font-medium ${status === "active" ? "text-[#FFC800]" : status === "done" ? "text-[#22C55E]" : status === "error" ? "text-[#EF4444]" : "text-[#555]"}`}>
                    {label}
                </span>
            </div>
        );
    };

    const getStepStatus = (step: "compile" | "verify" | "deploy") => {
        if (step === "compile") {
            if (buildStatus === "compiling") return "active" as const;
            if (["compiled", "verified", "deployed", "verifying", "deploying"].includes(buildStatus)) return "done" as const;
            if (buildStatus === "error" && !compileResult?.success) return "error" as const;
            return "idle" as const;
        }
        if (step === "verify") {
            if (buildStatus === "verifying") return "active" as const;
            if (["verified", "deployed"].includes(buildStatus)) return "done" as const;
            if (buildStatus === "error" && compileResult?.success && verifyResult && !verifyResult.verified) return "error" as const;
            return "idle" as const;
        }
        if (step === "deploy") {
            if (buildStatus === "deploying") return "active" as const;
            if (buildStatus === "deployed") return "done" as const;
            if (buildStatus === "error" && compileResult?.success && deployResult && !deployResult.success) return "error" as const;
            return "idle" as const;
        }
        return "idle" as const;
    };

    // ─── WALLET VIEW ─────────────────────────────────────────────────────────

    if (activeView === "extensions") {
        return (
            <div className="w-[272px] bg-[#000000] flex flex-col h-full border-r border-[#111] select-none">
                <div className="h-9 px-3 flex items-center text-[10px] font-semibold text-[#555] uppercase tracking-[0.12em] border-b border-[#111]">
                    Wallet
                </div>
                <div className="flex-1 flex flex-col p-4">
                    {isWalletConnected ? (
                        <div className="space-y-4">
                            {/* Connected status */}
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-[#22C55E] shadow-[0_0_6px_#22C55E]" />
                                <span className="text-[11px] text-[#22C55E] font-medium">Connected</span>
                            </div>

                            {/* Address card */}
                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
                                <div className="text-[9px] text-[#444] uppercase tracking-wider font-semibold">Address</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono text-[#808080] truncate flex-1">
                                        {walletAddress}
                                    </span>
                                    <button onClick={() => handleCopy(walletAddress || "")}
                                        className="text-[#444] hover:text-white transition-colors shrink-0">
                                        <CopyIcon />
                                    </button>
                                </div>
                            </div>

                            {/* Balance */}
                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                                <div className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-1">Balance</div>
                                <div className="text-[20px] font-mono text-[#FFC800] font-bold">{walletBalance} <span className="text-[11px] text-[#666]">XLM</span></div>
                            </div>

                            {/* Network */}
                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a]">
                                <div className="text-[9px] text-[#444] uppercase tracking-wider font-semibold mb-1">Network</div>
                                <div className="flex items-center gap-2">
                                    <div className="w-[6px] h-[6px] rounded-full bg-[#22C55E]" />
                                    <span className="text-[11px] text-[#808080]">Stellar Testnet</span>
                                    <span className="ml-auto text-[9px] text-[#333] font-mono">Chain 0x5448D640</span>
                                </div>
                            </div>

                            {/* Disconnect */}
                            <motion.button onClick={disconnectWallet}
                                className="w-full h-9 text-[11px] font-semibold text-[#666] border border-[#222] rounded-md hover:border-[#EF4444]/40 hover:text-[#EF4444] transition-all"
                                whileTap={{ scale: 0.98 }}>
                                Disconnect
                            </motion.button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-6">
                            {/* Big wallet icon */}
                            <div className="w-16 h-16 rounded-2xl bg-[#FFC800]/10 border border-[#FFC800]/20 flex items-center justify-center">
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFC800" strokeWidth="1.5">
                                    <rect x="2" y="6" width="20" height="14" rx="2" />
                                    <path d="M2 10h20" />
                                    <circle cx="16" cy="14" r="2" />
                                </svg>
                            </div>

                            <div className="text-center space-y-1">
                                <div className="text-[13px] text-white font-medium">Connect Wallet</div>
                                <div className="text-[11px] text-[#555] leading-relaxed max-w-[180px]">
                                    Connect MetaMask to deploy contracts and interact with Stellar testnet
                                </div>
                            </div>

                            {/* Prominent connect button */}
                            <motion.button onClick={connectWallet}
                                className="w-full h-11 text-[12px] font-bold text-black bg-[#FFC800] rounded-lg shadow-[0_0_20px_rgba(255,200,0,0.15)] hover:shadow-[0_0_30px_rgba(255,200,0,0.25)] transition-shadow"
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                                Connect MetaMask
                            </motion.button>

                            <div className="text-[9px] text-[#333] text-center">
                                TVA Chain ID: 1414676736
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── EXPLORER VIEW ────────────────────────────────────────────────────────

    if (activeView === "debug") {
        return (
            <div className="w-[272px] bg-[#000000] flex flex-col h-full border-r border-[#111] select-none">
                <div className="h-9 px-3 flex items-center text-[10px] font-semibold text-[#555] uppercase tracking-[0.12em] border-b border-[#111]">
                    Explorer
                </div>
                <div className="flex-1 p-4 space-y-3">
                    {/* Deployed contracts */}
                    {deployResult?.success ? (
                        <div className="space-y-3">
                            <div className="text-[9px] text-[#444] uppercase tracking-wider font-semibold">Deployed Contracts</div>
                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
                                <div className="text-[11px] text-white font-medium">{deployResult.contractId?.slice(0, 8)}...{deployResult.contractId?.slice(-4)}</div>
                                {deployResult.explorerUrl && (
                                    <a href={deployResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 text-[10px] text-[#3B82F6] hover:text-[#60a5fa] transition-colors">
                                        <ExternalLinkIcon />
                                        <span>View on Stellar Expert</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 opacity-50">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
                            </svg>
                            <span className="text-[11px] text-[#444]">No deployed contracts yet</span>
                            <span className="text-[10px] text-[#333]">Build and deploy to see transactions</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ─── SEARCH VIEW ──────────────────────────────────────────────────────────

    if (activeView === "search") {
        return (
            <div className="w-[272px] bg-[#000000] flex flex-col h-full border-r border-[#111] select-none">
                <div className="h-9 px-3 flex items-center text-[10px] font-semibold text-[#555] uppercase tracking-[0.12em] border-b border-[#111]">
                    Search
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-[11px] text-[#333]">Not available</span>
                </div>
            </div>
        );
    }

    // ─── FILES / BUILD (main views) ──────────────────────────────────────────

    // Determine which internal tab based on activeView
    const resolvedTab = activeView === "git" ? "build" : "files";
    if (resolvedTab !== activeTab) {
        // Sync internal tab with activity bar
        if (resolvedTab === "build" && activeTab !== "build") setActiveTab("build");
        if (resolvedTab === "files" && activeTab !== "files") setActiveTab("files");
    }

    return (
        <div className="w-[272px] bg-[#000000] flex flex-col h-full border-r border-[#111] select-none">

            {/* ── HEADER ── */}
            <div className="h-9 px-3 flex items-center text-[10px] font-semibold text-[#555] uppercase tracking-[0.12em] border-b border-[#111] shrink-0">
                {activeTab === "files" ? "Files" : "Build & Deploy"}
            </div>

            {/* ── CONTENT ── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <AnimatePresence mode="wait">
                    {activeTab === "files" && (
                        <motion.div key="files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                            {/* File tree header */}
                            <div className="flex items-center justify-between px-3 h-7 border-b border-[#141414]">
                                <span className="text-[10px] text-[#555] font-medium tracking-wide">WORKSPACE</span>
                                <div className="flex items-center gap-0.5">
                                    <button onClick={() => setCreatingFile("root")}
                                        className="w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                                        title="New file">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                            <path d="M14 2v6h6M12 18v-6M9 15h6" />
                                        </svg>
                                    </button>
                                    <button onClick={() => setCreatingFolder("root")}
                                        className="w-5 h-5 flex items-center justify-center rounded text-[#555] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                                        title="New folder">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                            <path d="M12 11v6M9 14h6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {/* Tree */}
                            <div className="py-1"
                                onContextMenu={(e) => {
                                    if (e.target === e.currentTarget) {
                                        e.preventDefault();
                                        setContextMenu({
                                            x: e.clientX, y: e.clientY, onClose: () => setContextMenu(null),
                                            items: [
                                                { label: "New File", action: () => setCreatingFile("root") },
                                                { label: "New Folder", action: () => setCreatingFolder("root") },
                                            ]
                                        });
                                    }
                                }}>
                                <RenderFolder folder={project.root} depth={0} />
                            </div>
                        </motion.div>
                    )}

                    {activeTab === "build" && (
                        <motion.div key="build" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}
                            className="p-3 space-y-3">

                            {/* Network */}
                            <div className="flex items-center gap-2 px-2 py-1.5 bg-[#060606] rounded border border-[#1a1a1a]">
                                <div className="w-[6px] h-[6px] rounded-full bg-[#22C55E] shadow-[0_0_4px_#22C55E]" />
                                <span className="text-[10px] text-[#808080] font-medium">Stellar Testnet</span>
                                <span className="ml-auto text-[9px] text-[#333] font-mono">0x5448D640</span>
                            </div>

                            {/* Pipeline */}
                            <div className="p-3 bg-[#060606] rounded border border-[#1a1a1a] space-y-2">
                                <div className="text-[9px] text-[#444] uppercase tracking-[0.15em] font-semibold mb-2">Pipeline</div>
                                <PipelineStep label="Compile" status={getStepStatus("compile")} step={1} />
                                <div className="ml-[9px] w-[2px] h-2 bg-[#1a1a1a]" />
                                <PipelineStep label="Verify" status={getStepStatus("verify")} step={2} />
                                <div className="ml-[9px] w-[2px] h-2 bg-[#1a1a1a]" />
                                <PipelineStep label="Deploy" status={getStepStatus("deploy")} step={3} />
                            </div>

                            {/* Action Buttons */}
                            <div className="space-y-1.5">
                                <motion.button onClick={() => compile()}
                                    disabled={buildStatus === "compiling"}
                                    className="w-full h-8 text-[11px] font-semibold rounded bg-[#22C55E] text-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 relative overflow-hidden"
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                    {buildStatus === "compiling" && (
                                        <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                            animate={{ x: ["-100%", "100%"] }}
                                            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }} />
                                    )}
                                    <span className="relative">{buildStatus === "compiling" ? "Compiling..." : "Compile"}</span>
                                </motion.button>

                                <motion.button onClick={() => verify()}
                                    disabled={buildStatus === "verifying" || !compileResult?.hash}
                                    className="w-full h-8 text-[11px] font-semibold rounded bg-[#9B7FFF] text-black disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                    {buildStatus === "verifying" ? "Verifying..." : "Verify"}
                                </motion.button>

                                <motion.button onClick={() => deploy()}
                                    disabled={buildStatus === "deploying" || !compileResult?.wasm}
                                    className="w-full h-8 text-[11px] font-semibold rounded bg-[#3B82F6] text-white disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                    {buildStatus === "deploying" ? "Deploying..." : "Deploy to Testnet"}
                                </motion.button>
                            </div>

                            {/* Compile Output */}
                            {compileResult?.success && (
                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    className="p-2.5 bg-[#060606] rounded border border-[#22C55E]/15 space-y-1.5">
                                    <div className="text-[9px] text-[#444] uppercase tracking-[0.15em] font-semibold">Artifact</div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[#666]">WASM</span>
                                        <span className="text-white font-mono text-[10px]">{compileResult.size} B</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] items-center">
                                        <span className="text-[#666]">Hash</span>
                                        <span className="text-[#FFC800] font-mono text-[9px]">{compileResult.hash?.slice(0, 20)}...</span>
                                    </div>
                                    {compileResult.abi && (
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[#666]">ABI</span>
                                            <span className="text-[#22C55E] text-[10px]">Ready</span>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Verify Result */}
                            {verifyResult && (
                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    className={`p-2.5 bg-[#060606] rounded border space-y-1 ${verifyResult.verified ? "border-[#22C55E]/15" : "border-[#EF4444]/15"}`}>
                                    <div className="text-[9px] text-[#444] uppercase tracking-[0.15em] font-semibold">Verification</div>
                                    <div className="flex justify-between text-[11px]">
                                        <span className="text-[#666]">Deterministic</span>
                                        <span className={verifyResult.hashMatch ? "text-[#22C55E]" : "text-[#EF4444]"}>
                                            {verifyResult.hashMatch ? "PASS" : "FAIL"}
                                        </span>
                                    </div>
                                    {verifyResult.onChainMatch !== undefined && (
                                        <div className="flex justify-between text-[11px]">
                                            <span className="text-[#666]">On-chain</span>
                                            <span className={verifyResult.onChainMatch ? "text-[#22C55E]" : "text-[#EF4444]"}>
                                                {verifyResult.onChainMatch ? "MATCH" : "DIFFER"}
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Deploy Result */}
                            {deployResult?.success && (
                                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                                    className="p-2.5 bg-[#060606] rounded border border-[#3B82F6]/15 space-y-2">
                                    <div className="text-[9px] text-[#444] uppercase tracking-[0.15em] font-semibold">Deployed</div>
                                    <div className="space-y-1">
                                        <div className="text-[9px] text-[#555]">Contract ID</div>
                                        <div className="flex items-center gap-1 bg-[#111] rounded px-2 py-1 border border-[#1a1a1a]">
                                            <span className="text-[9px] text-[#3B82F6] font-mono truncate flex-1">
                                                {deployResult.contractId}
                                            </span>
                                            <button onClick={() => handleCopy(deployResult.contractId || "")}
                                                className="text-[#555] hover:text-white transition-colors shrink-0"
                                                title="Copy">
                                                {copied ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2"><path d="M5 12l5 5L20 7" /></svg> : <CopyIcon />}
                                            </button>
                                        </div>
                                    </div>
                                    {deployResult.explorerUrl && (
                                        <a href={deployResult.explorerUrl} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 text-[10px] text-[#3B82F6] hover:text-[#60a5fa] transition-colors">
                                            <ExternalLinkIcon />
                                            <span>View on Explorer</span>
                                        </a>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Context Menu ── */}
            <AnimatePresence>
                {contextMenu && <ContextMenu {...contextMenu} />}
            </AnimatePresence>
        </div>
    );
}
