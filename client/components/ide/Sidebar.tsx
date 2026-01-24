"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Folder, File, useProject, SOLIDITY_TEMPLATES, SolidityTemplate, ABIFunction, FunctionCallResult } from "./useProjectState";

// ─── ICONS (Larger sizes) ─────────────────────────────────────────────────────

const ChevronIcon = ({ open }: { open: boolean }) => (
    <motion.svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        initial={false}
        animate={{ rotate: open ? 90 : 0 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        className="shrink-0 text-[#606060]"
    >
        <path d="M9 18l6-6-6-6" />
    </motion.svg>
);

const FileTypeIcon = ({ name, isActive }: { name: string; isActive?: boolean }) => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const isMoveFile = ext === "move" || ext === "toml";

    return (
        <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="shrink-0"
        >
            <path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
                fill={isActive ? "#FFC800" : "#4a4a4a"}
                fillOpacity={isActive ? 0.15 : 0.1}
                stroke={isActive ? "#FFC800" : "#606060"}
                strokeWidth="1.5"
            />
            <path
                d="M14 2v6h6"
                stroke={isActive ? "#FFC800" : "#606060"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
};

const FolderGlyph = ({ open }: { open: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path
            d="M3 7V17C3 18.1 3.9 19 5 19H19C20.1 19 21 18.1 21 17V9C21 7.9 20.1 7 19 7H13L11 5H5C3.9 5 3 5.9 3 7Z"
            fill={open ? "#606060" : "#4a4a4a"}
            fillOpacity={open ? 0.3 : 0.2}
            stroke={open ? "#808080" : "#606060"}
            strokeWidth="1.5"
        />
    </svg>
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

// ─── CONTRACT FUNCTION CARD ───────────────────────────────────────────────────

interface FunctionCardProps {
    fn: ABIFunction;
    onCall: (functionName: string, args: Record<string, string>, isView: boolean) => Promise<FunctionCallResult>;
}

function FunctionCard({ fn, onCall }: FunctionCardProps) {
    const [args, setArgs] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<FunctionCallResult | null>(null);
    const [isExpanded, setIsExpanded] = useState(false);

    const isView = fn.stateMutability === "view" || fn.stateMutability === "pure";
    const hasInputs = fn.inputs && fn.inputs.length > 0;
    const hasOutputs = fn.outputs && fn.outputs.length > 0;

    const handleCall = async () => {
        setIsLoading(true);
        setResult(null);
        try {
            const res = await onCall(fn.name, args, isView);
            setResult(res);
        } finally {
            setIsLoading(false);
        }
    };

    const getTypeColor = (type: string) => {
        if (type.startsWith("uint") || type.startsWith("int")) return "#3B82F6";
        if (type === "string") return "#22C55E";
        if (type === "bool") return "#A855F7";
        if (type === "address") return "#F59E0B";
        if (type.includes("[]")) return "#EC4899";
        return "#6B7280";
    };

    return (
        <motion.div
            className="rounded-lg border border-[#1a1a1a] bg-[#080808] overflow-hidden"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
        >
            {/* Function Header */}
            <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                    isView ? "hover:bg-[#3B82F6]/5" : "hover:bg-[#F59E0B]/5"
                }`}
                onClick={() => hasInputs && setIsExpanded(!isExpanded)}
            >
                {/* Function type badge */}
                <div
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                        isView
                            ? "bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/20"
                            : "bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/20"
                    }`}
                >
                    {isView ? "view" : "write"}
                </div>

                {/* Function name */}
                <span className="text-[12px] font-mono font-medium text-[#e0e0e0] flex-1">
                    {fn.name}
                </span>

                {/* Expand indicator if has inputs */}
                {hasInputs && (
                    <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-[#404040]"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18l6-6-6-6" />
                        </svg>
                    </motion.div>
                )}

                {/* Quick call button for no-arg functions */}
                {!hasInputs && (
                    <motion.button
                        onClick={(e) => { e.stopPropagation(); handleCall(); }}
                        disabled={isLoading}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
                            isView
                                ? "bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                                : "bg-[#F59E0B] hover:bg-[#D97706] text-black"
                        } disabled:opacity-50`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {isLoading ? (
                            <motion.div
                                className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                            />
                        ) : (
                            "Call"
                        )}
                    </motion.button>
                )}
            </div>

            {/* Expanded inputs section */}
            <AnimatePresence>
                {(isExpanded || !hasInputs) && hasInputs && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3 space-y-2 border-t border-[#111]">
                            <div className="pt-2 space-y-2">
                                {fn.inputs.map((input, idx) => (
                                    <div key={idx} className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-[#606060]">{input.name || `arg${idx}`}</span>
                                            <span
                                                className="text-[9px] font-mono px-1 py-0.5 rounded"
                                                style={{
                                                    color: getTypeColor(input.type),
                                                    backgroundColor: getTypeColor(input.type) + "15"
                                                }}
                                            >
                                                {input.type}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            placeholder={`Enter ${input.type}...`}
                                            value={args[input.name || `arg${idx}`] || ""}
                                            onChange={(e) => setArgs({ ...args, [input.name || `arg${idx}`]: e.target.value })}
                                            className="w-full px-2 py-1.5 text-[11px] font-mono bg-[#0a0a0a] border border-[#222] rounded-md text-white placeholder:text-[#404040] focus:border-[#FFC800]/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>

                            <motion.button
                                onClick={handleCall}
                                disabled={isLoading}
                                className={`w-full py-2 rounded-md text-[11px] font-semibold transition-colors flex items-center justify-center gap-2 ${
                                    isView
                                        ? "bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                                        : "bg-[#F59E0B] hover:bg-[#D97706] text-black"
                                } disabled:opacity-50`}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {isLoading && (
                                    <motion.div
                                        className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full"
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 0.6, ease: "linear" }}
                                    />
                                )}
                                {isView ? "Query" : "Transact"}
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Result display */}
            <AnimatePresence>
                {result && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className={`px-3 py-2 border-t text-[11px] font-mono ${
                            result.success
                                ? "border-[#22C55E]/20 bg-[#22C55E]/5 text-[#22C55E]"
                                : "border-[#EF4444]/20 bg-[#EF4444]/5 text-[#EF4444]"
                        }`}>
                            {result.success ? (
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px] opacity-60">↳</span>
                                    <span className="break-all">{JSON.stringify(result.result)}</span>
                                </div>
                            ) : (
                                <div className="flex items-start gap-2">
                                    <span className="text-[10px]">✗</span>
                                    <span>{result.error}</span>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─── TEMPLATE SELECTOR ────────────────────────────────────────────────────────

interface TemplateSelectorProps {
    onSelect: (template: SolidityTemplate) => void;
    onClose: () => void;
}

function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose]);

    const templates = Object.entries(SOLIDITY_TEMPLATES) as [SolidityTemplate, typeof SOLIDITY_TEMPLATES[SolidityTemplate]][];

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-[220px] z-[100] bg-[#0a0a0a] border border-[#222] rounded-xl shadow-2xl shadow-black/60 overflow-hidden"
        >
            <div className="px-3 py-2 border-b border-[#1a1a1a] bg-[#050505]">
                <span className="text-[10px] text-[#606060] uppercase tracking-wider font-semibold">New Solidity Contract</span>
            </div>
            <div className="max-h-[280px] overflow-y-auto py-1">
                {templates.map(([key, template]) => (
                    <motion.button
                        key={key}
                        onClick={() => { onSelect(key); onClose(); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-[#FFC800]/5 transition-colors"
                        whileHover={{ x: 2 }}
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#FFC800]/10 border border-[#FFC800]/20 flex items-center justify-center shrink-0">
                                <span className="text-[#FFC800] text-[11px] font-bold">◆</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[12px] text-[#c0c0c0] font-medium">{template.name}</div>
                                <div className="text-[10px] text-[#505050]">{template.description}</div>
                            </div>
                        </div>
                    </motion.button>
                ))}
            </div>
        </motion.div>
    );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function Sidebar() {
    const {
        project, activeFileId, setActiveFileId,
        createFile, createSolidityFile, renameFile, deleteFile, createFolder, deleteFolder,
        buildStatus, compileResult, verifyResult, deployResult,
        compile, verify, deploy,
        walletAddress, walletBalance, isWalletConnected, connectWallet, disconnectWallet,
        callContractFunction, getContractFunctions,
    } = useProject();

    const contractFunctions = getContractFunctions();

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["root"]));
    const [contextMenu, setContextMenu] = useState<ContextMenuProps | null>(null);
    const [creatingFile, setCreatingFile] = useState<string | null>(null);
    const [creatingFolder, setCreatingFolder] = useState<string | null>(null);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [showTemplateSelector, setShowTemplateSelector] = useState(false);

    // Split View State
    const [bottomPanelHeight, setBottomPanelHeight] = useState("45%");

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

    // ─── FILE TREE RENDERERS ────────────────────────────────────────────────

    const RenderFile = ({ file, depth, isLast }: { file: File; depth: number; isLast: boolean }) => {
        const isActive = activeFileId === file.id;
        const isRenaming = renamingId === file.id;

        return (
            <motion.div
                className={`group flex items-center py-1.5 pr-4 cursor-pointer relative ${isActive
                    ? "text-[#FFC800]"
                    : "text-[#707070] hover:text-[#b0b0b0]"
                    }`}
                style={{ paddingLeft: `${depth * 24 + 16}px` }}
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
                {/* Tree connector line */}
                {depth > 0 && (
                    <div className="absolute flex items-center" style={{ left: `${(depth - 1) * 24 + 28}px`, top: 0, bottom: isLast ? '50%' : 0 }}>
                        <div className="w-[1px] h-full bg-[#2a2a2a]" />
                    </div>
                )}
                {depth > 0 && (
                    <div className="absolute" style={{ left: `${(depth - 1) * 24 + 28}px`, top: '50%', width: '12px', height: '1px', background: '#2a2a2a' }} />
                )}

                <div className="flex items-center gap-2.5 ml-1 flex-1 min-w-0">
                    <FileTypeIcon name={file.name} isActive={isActive} />
                    {isRenaming ? (
                        <InlineInput
                            initial={file.name}
                            onSubmit={(v) => { renameFile(file.id, v); setRenamingId(null); }}
                            onCancel={() => setRenamingId(null)}
                        />
                    ) : (
                        <span
                            className="truncate select-none text-[13px] font-medium"
                            style={{ textShadow: isActive ? '0 0 16px rgba(255, 200, 0, 0.4)' : 'none' }}
                        >
                            {file.name}
                        </span>
                    )}
                </div>

                {/* Delete button on hover */}
                {!isRenaming && (
                    <motion.button
                        onClick={(e) => {
                            e.stopPropagation();
                            deleteFile(file.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#EF4444]/20 text-[#505050] hover:text-[#EF4444] transition-all"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        title="Delete file"
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                    </motion.button>
                )}
            </motion.div>
        );
    };

    const RenderFolder = ({ folder, depth = 0, isLast = false }: { folder: Folder; depth?: number; isLast?: boolean }) => {
        const isExpanded = expandedFolders.has(folder.id);
        const totalChildren = folder.folders.length + folder.files.length;

        return (
            <div className="relative">
                {/* Vertical continuation line for parent */}
                {depth > 1 && !isLast && (
                    <div
                        className="absolute top-0 bottom-0 w-[1px] bg-[#2a2a2a]"
                        style={{ left: `${(depth - 2) * 24 + 28}px` }}
                    />
                )}

                {depth > 0 && (
                    <motion.div
                        className="group flex items-center py-1.5 pr-4 cursor-pointer text-[#707070] hover:text-[#a0a0a0] relative"
                        style={{ paddingLeft: `${depth * 24 + 16}px` }}
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
                        {/* Tree connector line - vertical */}
                        {depth > 0 && (
                            <div className="absolute" style={{ left: `${(depth - 1) * 24 + 28}px`, top: 0, bottom: isLast ? '50%' : 0 }}>
                                <div className="w-[1px] h-full bg-[#2a2a2a]" />
                            </div>
                        )}
                        {/* Tree connector line - horizontal */}
                        {depth > 0 && (
                            <div className="absolute" style={{ left: `${(depth - 1) * 24 + 28}px`, top: '50%', width: '12px', height: '1px', background: '#2a2a2a' }} />
                        )}

                        <div className="flex items-center gap-2 ml-1 flex-1 min-w-0">
                            <ChevronIcon open={isExpanded} />
                            <FolderGlyph open={isExpanded} />
                            <span className="truncate select-none text-[13px] font-semibold">{folder.name}</span>
                        </div>

                        {/* Delete button on hover */}
                        <motion.button
                            onClick={(e) => {
                                e.stopPropagation();
                                deleteFolder(folder.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#EF4444]/20 text-[#505050] hover:text-[#EF4444] transition-all"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            title="Delete folder"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            </svg>
                        </motion.button>
                    </motion.div>
                )}
                <AnimatePresence>
                    {(depth === 0 || isExpanded) && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                            className="overflow-hidden relative"
                        >
                            {/* Vertical line for children */}
                            {depth > 0 && totalChildren > 0 && (
                                <div
                                    className="absolute w-[1px] bg-[#2a2a2a]"
                                    style={{ left: `${(depth) * 24 + 4}px`, top: 0, bottom: '12px' }}
                                />
                            )}

                            {folder.folders.map((sub, idx) => {
                                const isLastChild = idx === folder.folders.length - 1 && folder.files.length === 0;
                                return (
                                    <RenderFolder key={sub.id} folder={sub} depth={(depth || 0) + 1} isLast={isLastChild} />
                                );
                            })}
                            {folder.files.map((file, idx) => (
                                <RenderFile key={file.id} file={file} depth={(depth || 0) + 1} isLast={idx === folder.files.length - 1} />
                            ))}
                            {creatingFile === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 24 + 16}px` }} className="py-1.5 pr-4">
                                    <InlineInput
                                        initial="NewContract.sol"
                                        onSubmit={(v) => { createFile(v, folder.id); setCreatingFile(null); }}
                                        onCancel={() => setCreatingFile(null)}
                                    />
                                </div>
                            )}
                            {creatingFolder === folder.id && (
                                <div style={{ paddingLeft: `${((depth || 0) + 1) * 24 + 16}px` }} className="py-1.5 pr-4">
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
        const colors = { idle: "#2a2a2a", active: "#FFC800", done: "#22C55E", error: "#EF4444" };
        return (
            <div className="flex flex-col items-center gap-1.5 flex-1">
                <div className="relative flex items-center justify-center w-6 h-6">
                    {status === "active" ? (
                        <motion.div
                            className="w-full h-full rounded-full border-2"
                            style={{ borderColor: colors[status], borderTopColor: "transparent" }}
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                        />
                    ) : (
                        <div
                            className="w-full h-full rounded-full flex items-center justify-center transition-colors"
                            style={{
                                backgroundColor: status === "done" ? colors.done + "15" : status === "error" ? colors.error + "15" : colors.idle,
                                border: `1.5px solid ${colors[status]}`
                            }}
                        >
                            {status === "done" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.done} strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
                            {status === "error" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={colors.error} strokeWidth="3"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                            {status === "idle" && <span className="text-[9px] text-[#404040] font-bold">{step}</span>}
                        </div>
                    )}
                </div>
                <span className={`text-[9px] uppercase tracking-wide font-semibold ${status === "active" ? "text-[#FFC800]" : status === "done" ? "text-[#22C55E]" : status === "error" ? "text-[#EF4444]" : "text-[#404040]"}`}>
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

    // ─── WORKSPACE VIEW (Files + Build combined) ──────────────────────────────

    return (
        <motion.div
            className="w-[300px] flex flex-col h-full select-none relative overflow-hidden"
            style={{ background: 'linear-gradient(180deg, #050505 0%, #000000 100%)' }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
        >
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute -top-20 -left-20 w-48 h-48 bg-[#FFC800]/[0.03] rounded-full blur-3xl" />
                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-[#FFC800]/15 via-[#1a1a1a] to-transparent" />
            </div>

            {/* ─── TOP SECTION: FILES ────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-b from-[#050505] to-[#020202] z-10" style={{ height: `calc(100% - ${bottomPanelHeight})` }}>
                {/* Files Header */}
                <div className="relative h-14 flex items-center justify-between px-4 border-b border-[#151515] shrink-0">
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#FFC800]/20 to-transparent" />
                    <span className="text-[12px] font-semibold text-[#606060] uppercase tracking-[0.15em]">
                        Files
                    </span>
                    <div className="flex items-center gap-1">
                        {/* New Solidity Contract */}
                        <div className="relative">
                            <motion.button
                                onClick={() => setShowTemplateSelector(!showTemplateSelector)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-[#FFC800] bg-[#FFC800]/10 hover:bg-[#FFC800]/20 transition-colors"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                title="New Solidity Contract"
                            >
                                <span className="text-[12px] font-bold">◆</span>
                            </motion.button>
                            <AnimatePresence>
                                {showTemplateSelector && (
                                    <TemplateSelector
                                        onSelect={(template) => createSolidityFile(template, "root")}
                                        onClose={() => setShowTemplateSelector(false)}
                                    />
                                )}
                            </AnimatePresence>
                        </div>
                        <motion.button
                            onClick={() => setCreatingFile("root")}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="New file"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <path d="M14 2v6h6M12 18v-6M9 15h6" />
                            </svg>
                        </motion.button>
                        <motion.button
                            onClick={() => setCreatingFolder("root")}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#505050] hover:text-[#FFC800] hover:bg-[#FFC800]/10 transition-colors"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            title="New folder"
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                                <path d="M12 11v6M9 14h6" />
                            </svg>
                        </motion.button>
                    </div>
                </div>

                {/* File Tree Content */}
                <div
                    className="flex-1 overflow-y-auto py-2 custom-scrollbar"
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

            {/* ─── RESIZE HANDLE / DIVIDER ───────────────────────────────────── */}
            <div className="h-[1px] bg-[#1a1a1a] shrink-0 relative z-20">
                <div className="absolute inset-x-0 -top-1 -bottom-1 cursor-row-resize z-30" />
            </div>

            {/* ─── BOTTOM SECTION: WALLET & DEPLOY ───────────────────────────── */}
            <div className="flex flex-col min-h-0 bg-[#020202] z-10" style={{ height: bottomPanelHeight }}>
                {/* Header */}
                <div className="relative h-10 flex items-center px-4 border-b border-[#151515] shrink-0 bg-[#050505]">
                    <span className="text-[11px] font-semibold text-[#606060] uppercase tracking-[0.15em]">
                        Blockchain & Deploy
                    </span>
                    {/* Connection Status Dot */}
                    <div className={`ml-auto w-2 h-2 rounded-full ${isWalletConnected ? 'bg-[#22C55E] shadow-[0_0_8px_#22C55E]' : 'bg-[#333]'}`} />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* 1. Wallet Connection */}
                    <div className="space-y-3">
                        {isWalletConnected ? (
                            <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-[#505050] font-medium uppercase tracking-wider">Account</span>
                                    <motion.button onClick={disconnectWallet} className="text-[10px] text-[#EF4444] hover:underline">Disconnect</motion.button>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-mono text-[#808080] truncate flex-1">{walletAddress}</span>
                                    <motion.button onClick={() => handleCopy(walletAddress || "")} className="p-1 hover:text-[#FFC800] text-[#505050]"><CopyIcon size={12} /></motion.button>
                                </div>
                                <div className="pt-2 border-t border-[#151515] flex justify-between items-end">
                                    <span className="text-[10px] text-[#505050]">Balance</span>
                                    <span className="text-[14px] text-[#FFC800] font-mono">{walletBalance} <span className="text-[#505050] text-[10px]">XLM</span></span>
                                </div>
                            </div>
                        ) : (
                            <motion.button
                                onClick={connectWallet}
                                className="w-full py-3 px-4 rounded-lg bg-[#FFC800]/10 border border-[#FFC800]/20 hover:bg-[#FFC800]/20 hover:border-[#FFC800]/40 transition-all flex items-center justify-center gap-2 group"
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="w-2 h-2 rounded-full bg-[#FFC800] group-hover:shadow-[0_0_8px_#FFC800]" />
                                <span className="text-[12px] font-semibold text-[#FFC800]">Connect Wallet</span>
                            </motion.button>
                        )}
                    </div>

                    {/* 2. Build Pipeline */}
                    <div className="space-y-3">
                        <div className="text-[11px] text-[#505050] font-medium uppercase tracking-wider">Build Pipeline</div>

                        {/* Steps Visualization */}
                        <div className="flex items-center justify-between px-2 py-2">
                            <PipelineStep label="Compile" status={getStepStatus("compile")} step={1} />
                            <div className="w-4 h-[1px] bg-[#222] mt-[-10px]" />
                            <PipelineStep label="Verify" status={getStepStatus("verify")} step={2} />
                            <div className="w-4 h-[1px] bg-[#222] mt-[-10px]" />
                            <PipelineStep label="Deploy" status={getStepStatus("deploy")} step={3} />
                        </div>

                        {/* Action Button */}
                        <motion.button
                            onClick={() => {
                                if (!compileResult?.success) compile();
                                else if (!verifyResult?.verified) verify();
                                else deploy();
                            }}
                            disabled={buildStatus === "compiling" || buildStatus === "verifying" || buildStatus === "deploying"}
                            className="w-full h-10 text-[12px] font-bold text-black bg-[#FFC800] rounded-md shadow-lg shadow-[#FFC800]/10 hover:shadow-[#FFC800]/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {/* Loading spinner */}
                            {(buildStatus === "compiling" || buildStatus === "verifying" || buildStatus === "deploying") && (
                                <motion.div
                                    className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full"
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                />
                            )}
                            <span className="relative z-10">
                                {buildStatus === "compiling" ? "Compiling..." :
                                    buildStatus === "verifying" ? "Verifying..." :
                                        buildStatus === "deploying" ? "Deploying..." :
                                            !compileResult?.success ? "Compile Contract" :
                                                !verifyResult?.verified ? "Verify & Build" : "Deploy to Testnet"}
                            </span>
                        </motion.button>

                    </div>

                    {/* 3. Output / Results */}
                    <AnimatePresence>
                        {compileResult?.success && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-2 overflow-hidden"
                            >
                                <div className="text-[11px] text-[#505050] font-medium uppercase tracking-wider">Artifacts</div>
                                <div className="p-3 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] space-y-2">
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-[#606060]">Size</span>
                                        <span className="text-[#a0a0a0] font-mono">{compileResult.size} bytes</span>
                                    </div>
                                    <div className="flex justify-between items-center text-[11px]">
                                        <span className="text-[#606060]">Hash</span>
                                        <span className="text-[#FFC800] font-mono opacity-80">{compileResult.hash?.slice(0, 10)}...</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Deployed Contract */}
                    {deployResult?.success && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-lg bg-[#22C55E]/5 border border-[#22C55E]/20 space-y-2"
                        >
                            <div className="flex items-center gap-2 text-[#22C55E] text-[11px] font-bold uppercase tracking-wider">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                                Deployed
                            </div>
                            <div className="text-[11px] text-[#22C55E] font-mono break-all opacity-80">
                                {deployResult.contractId}
                            </div>
                            {deployResult.explorerUrl && (
                                <a
                                    href={deployResult.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[10px] text-[#22C55E]/70 hover:text-[#22C55E] hover:underline"
                                >
                                    <ExternalLinkIcon size={10} />
                                    View in Explorer
                                </a>
                            )}
                        </motion.div>
                    )}

                    {/* Contract Interaction */}
                    {deployResult?.success && contractFunctions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-[11px] text-[#505050] font-medium uppercase tracking-wider">
                                    Interact
                                </div>
                                <div className="flex items-center gap-2 text-[9px]">
                                    <span className="flex items-center gap-1 text-[#3B82F6]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                                        Read
                                    </span>
                                    <span className="flex items-center gap-1 text-[#F59E0B]">
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                                        Write
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {contractFunctions.map((fn, idx) => (
                                    <FunctionCard
                                        key={`${fn.name}-${idx}`}
                                        fn={fn}
                                        onCall={callContractFunction}
                                    />
                                ))}
                            </div>
                        </motion.div>
                    )}

                </div>
            </div>

            {/* Context Menu */}
            <AnimatePresence>
                {contextMenu && <ContextMenu {...contextMenu} />}
            </AnimatePresence>
        </motion.div>
    );
}
