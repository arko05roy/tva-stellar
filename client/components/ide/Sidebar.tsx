"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, File, useProject } from "./useProjectState";

interface SidebarProps {
    activeView: "explorer" | "search" | "git" | "debug" | "extensions";
}

// ─── ICONS (Larger sizes) ─────────────────────────────────────────────────────

const ChevronIcon = ({ open }: { open: boolean }) => (
    <motion.svg
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        initial={false}
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="shrink-0"
    >
        <path d="M9 18l6-6-6-6" />
    </motion.svg>
);

const FileTypeIcon = ({ name, isActive }: { name: string; isActive?: boolean }) => {
    const ext = name.split(".").pop() || "";
    const config: Record<string, { color: string; label: string; glow?: string }> = {
        sol: { color: "#FFC800", label: "◆", glow: "rgba(255, 200, 0, 0.5)" },
        rs: { color: "#DEA584", label: "RS", glow: "rgba(222, 165, 132, 0.4)" },
        ts: { color: "#3178C6", label: "TS", glow: "rgba(49, 120, 198, 0.4)" },
        js: { color: "#F7DF1E", label: "JS", glow: "rgba(247, 223, 30, 0.4)" },
        json: { color: "#9B7FFF", label: "{}", glow: "rgba(155, 127, 255, 0.4)" },
        md: { color: "#519ABA", label: "◇", glow: "rgba(81, 154, 186, 0.4)" },
    };
    const c = config[ext] || { color: "#4a4a4a", label: ext.slice(0, 2).toUpperCase() };
    return (
        <motion.div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 relative"
            style={{
                background: `linear-gradient(135deg, ${c.color}10 0%, ${c.color}20 100%)`,
                border: `1px solid ${c.color}30`,
                boxShadow: isActive ? `0 0 16px ${c.glow || c.color + '40'}` : 'none'
            }}
            whileHover={{
                scale: 1.08,
                boxShadow: `0 0 12px ${c.glow || c.color + '30'}`
            }}
            transition={{ duration: 0.15 }}
        >
            <span style={{
                color: c.color,
                fontSize: ext === 'sol' || ext === 'md' ? "14px" : "10px",
                fontWeight: 700,
                textShadow: isActive ? `0 0 8px ${c.color}` : 'none'
            }}>{c.label}</span>
        </motion.div>
    );
};

const FolderGlyph = ({ open }: { open: boolean }) => (
    <motion.div
        className="relative shrink-0"
        animate={{ scale: open ? 1.05 : 1 }}
        transition={{ duration: 0.15 }}
    >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <defs>
                <linearGradient id="folderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={open ? "#FFC800" : "#3a3a3a"} />
                    <stop offset="100%" stopColor={open ? "#E5B400" : "#2a2a2a"} />
                </linearGradient>
            </defs>
            <path
                d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"
                fill="url(#folderGrad)"
                opacity={open ? 1 : 0.6}
            />
        </svg>
        {open && (
            <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ boxShadow: '0 0 12px rgba(255, 200, 0, 0.4)' }}
            />
        )}
    </motion.div>
);

const CopyIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
);

const ExternalLinkIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
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
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[9999] py-2 min-w-[160px] bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl shadow-black/60"
            style={{ top: y, left: x }}
        >
            {items.map((item, i) => (
                <button key={i} onClick={() => { item.action(); onClose(); }}
                    className={`w-full text-left px-4 py-2.5 text-[14px] font-medium transition-colors ${item.danger
                        ? "text-[#EF4444] hover:bg-[#EF4444]/10"
                        : "text-[#909090] hover:bg-[#1a1a1a] hover:text-white"
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
            className="w-full bg-[#0a0a0a] border border-[#FFC800]/50 rounded-lg px-3 py-1.5 text-[14px] text-white outline-none focus:border-[#FFC800] transition-colors"
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

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
    const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
    const [creatingFile, setCreatingFile] = useState<string | null>(null);
    const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [buildExpanded, setBuildExpanded] = useState(true);

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
            <motion.div
                className={`group flex items-center gap-3 py-2 pr-4 cursor-pointer relative ${isActive
                    ? "text-[#FFC800]"
                    : "text-[#707070] hover:text-[#b0b0b0]"
                    }`}
                style={{ paddingLeft: `${depth * 20 + 24}px` }}
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
                initial={false}
                animate={{
                    backgroundColor: isActive ? "rgba(255, 200, 0, 0.08)" : "transparent"
                }}
                whileHover={{
                    backgroundColor: isActive ? "rgba(255, 200, 0, 0.12)" : "rgba(255, 255, 255, 0.03)"
                }}
                transition={{ duration: 0.15 }}
            >
                {/* Active indicator */}
                <AnimatePresence>
                    {isActive && (
                        <motion.div
                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
                            style={{
                                background: 'linear-gradient(180deg, #FFC800 0%, #E5B400 100%)',
                                boxShadow: '0 0 12px rgba(255, 200, 0, 0.6)'
                            }}
                            initial={{ scaleY: 0, opacity: 0 }}
                            animate={{ scaleY: 1, opacity: 1 }}
                            exit={{ scaleY: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        />
                    )}
                </AnimatePresence>

                <FileTypeIcon name={file.name} isActive={isActive} />
                {isRenaming ? (
                    <InlineInput
                        initial={file.name}
                        onSubmit={(v) => { renameFile(file.id, v); setRenamingId(null); }}
                        onCancel={() => setRenamingId(null)}
                    />
                ) : (
                    <span
                        className="truncate select-none text-[14px] font-medium"
                        style={{ textShadow: isActive ? '0 0 16px rgba(255, 200, 0, 0.4)' : 'none' }}
                    >
                        {file.name}
                    </span>
                )}
            </motion.div>
        );
    };

    const RenderFolder = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        const isExpanded = expandedFolders.has(folder.id);
        return (
            <div className="relative">
                {depth > 0 && (
                    <motion.div
                        className="group flex items-center gap-3 py-2 pr-4 cursor-pointer text-[#606060] hover:text-[#a0a0a0] relative"
                        style={{ paddingLeft: `${depth * 20 + 24}px` }}
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
                        whileHover={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                    >
                        <ChevronIcon open={isExpanded} />
                        <FolderGlyph open={isExpanded} />
                        <span className="truncate select-none text-[14px] font-semibold">{folder.name}</span>
                    </motion.div>
                )}
                <AnimatePresence>
                    {(depth === 0 || isExpanded) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden"
                        >
                            {folder.folders.map((sub) => (
                                <RenderFolder key={sub.id} folder={sub} depth={(depth || 0) + 1} />
                            ))}
                            {folder.files.map((file) => (
                                <RenderFile key={file.id} file={file} depth={(depth || 0) + 1} />
                            ))}
                            {creatingFile === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 20 + 24}px` }} className="py-2 pr-4">
                                    <InlineInput
                                        initial="NewContract.sol"
                                        onSubmit={(v) => { createFile(v, folder.id); setCreatingFile(null); }}
                                        onCancel={() => setCreatingFile(null)}
                                    />
                                </div>
                            )}
                            {creatingFolder === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 20 + 24}px` }} className="py-2 pr-4">
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
            <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-7 h-7">
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
                            {status === "done" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.done} strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                            {status === "error" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.error} strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                            {status === "idle" && <span className="text-[11px] text-[#3a3a3a] font-bold">{step}</span>}
                        </div>
                    )}
                </div>
                <span className={`text-[14px] font-medium ${status === "active" ? "text-[#FFC800]" : status === "done" ? "text-[#22C55E]" : status === "error" ? "text-[#EF4444]" : "text-[#555]"}`}>
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

    // ─── BLOCKCHAIN VIEW (Wallet + Explorer combined) ─────────────────────────

    if (activeView === "extensions" || activeView === "debug") {
        return (
            <motion.div
                className="w-[300px] flex flex-col h-full select-none relative overflow-hidden"
                style={{ background: 'linear-gradient(180deg, #050505 0%, #000000 100%)' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
            >
                {/* Background effects */}
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute -top-20 -left-20 w-48 h-48 bg-[#FFC800]/[0.03] rounded-full blur-3xl" />
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#FFC800]/15 via-[#1a1a1a] to-transparent" />
                </div>

                {/* Header */}
                <div className="relative h-14 flex items-center px-5 border-b border-[#151515] shrink-0">
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFC800]/20 to-transparent" />
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC800" strokeWidth="1.5" className="mr-3 opacity-70">
                        <rect x="2" y="6" width="20" height="14" rx="2" />
                        <path d="M2 10h20" />
                        <circle cx="16" cy="14" r="2" />
                    </svg>
                    <span className="text-[13px] font-semibold text-[#505050] uppercase tracking-[0.15em]">
                        Blockchain
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5 relative z-10">
                    {/* Wallet Section */}
                    <div className="space-y-4">
                        <div className="text-[11px] text-[#404040] uppercase tracking-[0.2em] font-semibold">Wallet</div>

                        {isWalletConnected ? (
                            <div className="space-y-4">
                                {/* Status */}
                                <div className="flex items-center gap-3">
                                    <div className="w-3 h-3 rounded-full bg-[#22C55E] shadow-[0_0_10px_#22C55E]" />
                                    <span className="text-[14px] text-[#22C55E] font-medium">Connected</span>
                                </div>

                                {/* Address */}
                                <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
                                    <div className="text-[11px] text-[#404040] uppercase tracking-wider font-semibold">Address</div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[13px] font-mono text-[#707070] truncate flex-1">
                                            {walletAddress}
                                        </span>
                                        <motion.button
                                            onClick={() => handleCopy(walletAddress || "")}
                                            className="text-[#505050] hover:text-[#FFC800] transition-colors p-1"
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                        >
                                            <CopyIcon />
                                        </motion.button>
                                    </div>
                                </div>

                                {/* Balance */}
                                <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                                    <div className="text-[11px] text-[#404040] uppercase tracking-wider font-semibold mb-2">Balance</div>
                                    <div className="text-[28px] font-mono text-[#FFC800] font-bold">
                                        {walletBalance}
                                        <span className="text-[14px] text-[#505050] ml-2">XLM</span>
                                    </div>
                                </div>

                                {/* Network */}
                                <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a]">
                                    <div className="text-[11px] text-[#404040] uppercase tracking-wider font-semibold mb-2">Network</div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
                                        <span className="text-[14px] text-[#808080]">Stellar Testnet</span>
                                    </div>
                                </div>

                                {/* Disconnect */}
                                <motion.button
                                    onClick={disconnectWallet}
                                    className="w-full h-12 text-[14px] font-semibold text-[#606060] border border-[#252525] rounded-xl hover:border-[#EF4444]/50 hover:text-[#EF4444] transition-all"
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Disconnect Wallet
                                </motion.button>
                            </div>
                        ) : (
                            <div className="py-8 flex flex-col items-center gap-5">
                                <div className="w-20 h-20 rounded-2xl bg-[#FFC800]/10 border border-[#FFC800]/20 flex items-center justify-center">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FFC800" strokeWidth="1.5">
                                        <rect x="2" y="6" width="20" height="14" rx="2" />
                                        <path d="M2 10h20" />
                                        <circle cx="16" cy="14" r="2" />
                                    </svg>
                                </div>
                                <div className="text-center space-y-2">
                                    <div className="text-[16px] text-white font-medium">Connect Wallet</div>
                                    <div className="text-[13px] text-[#505050] leading-relaxed max-w-[200px]">
                                        Connect to deploy contracts on Stellar testnet
                                    </div>
                                </div>
                                <motion.button
                                    onClick={connectWallet}
                                    className="w-full h-14 text-[15px] font-bold text-black bg-[#FFC800] rounded-xl shadow-[0_0_30px_rgba(255,200,0,0.2)]"
                                    whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(255, 200, 0, 0.3)' }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    Connect MetaMask
                                </motion.button>
                            </div>
                        )}
                    </div>

                    {/* Deployed Contracts Section */}
                    {deployResult?.success && (
                        <div className="space-y-4 pt-4 border-t border-[#151515]">
                            <div className="text-[11px] text-[#404040] uppercase tracking-[0.2em] font-semibold">Deployed Contracts</div>
                            <div className="p-4 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] space-y-3">
                                <div className="text-[14px] text-white font-medium">
                                    {deployResult.contractId?.slice(0, 12)}...{deployResult.contractId?.slice(-6)}
                                </div>
                                {deployResult.explorerUrl && (
                                    <a
                                        href={deployResult.explorerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-[13px] text-[#3B82F6] hover:text-[#60a5fa] transition-colors"
                                    >
                                        <ExternalLinkIcon />
                                        <span>View on Explorer</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    }

    // ─── SEARCH VIEW (minimal) ────────────────────────────────────────────────

    if (activeView === "search") {
        return (
            <motion.div
                className="w-[300px] flex flex-col h-full select-none relative overflow-hidden"
                style={{ background: 'linear-gradient(180deg, #050505 0%, #000000 100%)' }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
            >
                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#FFC800]/15 via-[#1a1a1a] to-transparent" />
                <div className="h-14 flex items-center px-5 border-b border-[#151515]">
                    <span className="text-[13px] font-semibold text-[#505050] uppercase tracking-[0.15em]">Search</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                    <span className="text-[14px] text-[#303030]">Coming soon</span>
                </div>
            </motion.div>
        );
    }

    // ─── WORKSPACE VIEW (Files + Build combined) ──────────────────────────────

    return (
        <motion.div
            className="w-[300px] flex flex-col h-full select-none relative overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #050505 0%, #000000 100%)' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute -top-20 -left-20 w-48 h-48 bg-[#FFC800]/[0.03] rounded-full blur-3xl" />
                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#FFC800]/15 via-[#1a1a1a] to-transparent" />
            </div>

            {/* Header */}
            <div className="relative h-14 flex items-center justify-between px-5 border-b border-[#151515] shrink-0">
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFC800]/20 to-transparent" />
                <div className="flex items-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFC800" strokeWidth="1.5" className="mr-3 opacity-70">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                    </svg>
                    <span className="text-[13px] font-semibold text-[#505050] uppercase tracking-[0.15em]">
                        Workspace
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <motion.button
                        onClick={() => setCreatingFile("root")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="New file"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <path d="M14 2v6h6M12 18v-6M9 15h6" />
                        </svg>
                    </motion.button>
                    <motion.button
                        onClick={() => setCreatingFolder("root")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        title="New folder"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                            <path d="M12 11v6M9 14h6" />
                        </svg>
                    </motion.button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto relative z-10">
                {/* Files Section */}
                <div className="border-b border-[#111]">
                    <div className="px-5 py-3 flex items-center justify-between">
                        <span className="text-[11px] text-[#404040] uppercase tracking-[0.2em] font-semibold">Files</span>
                    </div>
                    <div
                        className="pb-3"
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
                        }}
                    >
                        <RenderFolder folder={project.root} depth={0} />
                    </div>
                </div>

                {/* Build Section */}
                {(activeView === "explorer" || activeView === "git") && (
                    <div className="p-5 space-y-4">
                        {/* Build Header */}
                        <motion.button
                            onClick={() => setBuildExpanded(!buildExpanded)}
                            className="flex items-center gap-2 w-full text-left"
                        >
                            <ChevronIcon open={buildExpanded} />
                            <span className="text-[11px] text-[#404040] uppercase tracking-[0.2em] font-semibold">Build & Deploy</span>
                        </motion.button>

                        <AnimatePresence>
                            {buildExpanded && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="space-y-4 overflow-hidden"
                                >
                                    {/* Network indicator */}
                                    <div className="flex items-center gap-3 px-4 py-3 bg-[#080808] rounded-xl border border-[#1a1a1a]">
                                        <div className="w-2.5 h-2.5 rounded-full bg-[#22C55E] shadow-[0_0_6px_#22C55E]" />
                                        <span className="text-[13px] text-[#707070] font-medium">Stellar Testnet</span>
                                    </div>

                                    {/* Pipeline */}
                                    <div className="p-4 bg-[#080808] rounded-xl border border-[#1a1a1a] space-y-3">
                                        <PipelineStep label="Compile" status={getStepStatus("compile")} step={1} />
                                        <div className="ml-3 w-[2px] h-3 bg-[#1a1a1a]" />
                                        <PipelineStep label="Verify" status={getStepStatus("verify")} step={2} />
                                        <div className="ml-3 w-[2px] h-3 bg-[#1a1a1a]" />
                                        <PipelineStep label="Deploy" status={getStepStatus("deploy")} step={3} />
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-2">
                                        <motion.button
                                            onClick={() => compile()}
                                            disabled={buildStatus === "compiling"}
                                            className="w-full h-12 text-[14px] font-bold rounded-xl bg-[#22C55E] text-black disabled:opacity-40 disabled:cursor-not-allowed"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            {buildStatus === "compiling" ? "Compiling..." : "Compile"}
                                        </motion.button>

                                        <motion.button
                                            onClick={() => verify()}
                                            disabled={buildStatus === "verifying" || !compileResult?.hash}
                                            className="w-full h-12 text-[14px] font-bold rounded-xl bg-[#9B7FFF] text-black disabled:opacity-25 disabled:cursor-not-allowed"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            {buildStatus === "verifying" ? "Verifying..." : "Verify"}
                                        </motion.button>

                                        <motion.button
                                            onClick={() => deploy()}
                                            disabled={buildStatus === "deploying" || !compileResult?.wasm}
                                            className="w-full h-12 text-[14px] font-bold rounded-xl bg-[#3B82F6] text-white disabled:opacity-25 disabled:cursor-not-allowed"
                                            whileHover={{ scale: 1.01 }}
                                            whileTap={{ scale: 0.99 }}
                                        >
                                            {buildStatus === "deploying" ? "Deploying..." : "Deploy"}
                                        </motion.button>
                                    </div>

                                    {/* Compile Output */}
                                    {compileResult?.success && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="p-4 bg-[#080808] rounded-xl border border-[#22C55E]/20 space-y-2"
                                        >
                                            <div className="text-[11px] text-[#404040] uppercase tracking-wider font-semibold">Artifact</div>
                                            <div className="flex justify-between text-[13px]">
                                                <span className="text-[#606060]">WASM</span>
                                                <span className="text-white font-mono">{compileResult.size} B</span>
                                            </div>
                                            <div className="flex justify-between text-[13px] items-center">
                                                <span className="text-[#606060]">Hash</span>
                                                <span className="text-[#FFC800] font-mono text-[11px]">{compileResult.hash?.slice(0, 16)}...</span>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && <ContextMenu {...contextMenu} />}
            </AnimatePresence>
        </motion.div>
    );
}
