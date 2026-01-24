"use client";

import React, { useState } from "react";
import { Folder, useProject } from "./useProjectState";

export default function Sidebar() {
    const { project, setActiveFileId, activeFileId } = useProject();
    const [activeTab, setActiveTab] = useState<"explorer" | "deploy" | "interact">("explorer");
    const [deployStatus, setDeployStatus] = useState<"idle" | "deploying" | "success" | "error">("idle");
    const [countValue, setCountValue] = useState<number | null>(null);

    const RenderFolder = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        return (
            <div className="flex flex-col">
                <div
                    className="px-4 py-2 text-xs text-[#B0B0B0] font-sans font-medium uppercase tracking-wider select-none flex items-center gap-2 transition-colors hover:text-white"
                    style={{ paddingLeft: `${depth * 12 + 16}px` }}
                >
                    <span className="opacity-70">📁</span> {folder.name}
                </div>
                {folder.files.map((file) => (
                    <div
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={`group px-4 py-1.5 text-sm cursor-pointer flex items-center gap-3 transition-all font-mono
                            ${activeFileId === file.id 
                                ? "text-[#FFC800] bg-white/5 border-l-2 border-[#FFC800]" 
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5 border-l-2 border-transparent"
                            }`}
                        style={{ paddingLeft: `${depth * 12 + 24}px` }}
                    >
                        <span className={`text-xs ${activeFileId === file.id ? "opacity-100" : "opacity-50 group-hover:opacity-100"}`}>
                            {file.name.endsWith(".sol") ? "🔷" : "📄"}
                        </span>
                        {file.name}
                    </div>
                ))}
                {folder.folders.map((sub) => (
                    <RenderFolder key={sub.id} folder={sub} depth={depth + 1} />
                ))}
            </div>
        );
    };

    const handleDeploy = () => {
        setDeployStatus("deploying");
        setTimeout(() => {
            setDeployStatus("success");
            setActiveTab("interact");
        }, 2000);
    };

    const handleIncrement = () => {
        console.log("Transaction sent: increment()");
    };

    const handleGet = () => {
        setCountValue((prev) => (prev === null ? 1 : prev + 1));
    };

    return (
        <div className="w-72 bg-[#1a1a1a] flex flex-col h-full border-r border-white/5 font-sans">
            {/* Sidebar Tabs */}
            <div className="flex p-2 gap-1 bg-[#1a1a1a]">
                {["explorer", "deploy", "interact"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wide rounded-sm transition-all
                            ${activeTab === tab 
                                ? "bg-[#FFC800] text-black" 
                                : "text-[#B0B0B0] hover:bg-white/5 hover:text-white"
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-4">
                {activeTab === "explorer" && (
                    <div className="flex flex-col gap-2">
                        <div className="px-5 py-2">
                            <h2 className="text-xs font-bold text-white uppercase tracking-widest opacity-50 mb-4">
                                Project / {project.name}
                            </h2>
                            <div className="h-px w-full bg-gradient-to-r from-white/10 to-transparent mb-4" />
                        </div>
                        <RenderFolder folder={project.root} />
                    </div>
                )}

                {activeTab === "deploy" && (
                    <div className="p-5 flex flex-col gap-6 animate-in fade-in duration-300">
                        <div className="flex flex-col gap-4">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <span className="w-1 h-4 bg-[#FFC800] rounded-full"/>
                                Configuration
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs text-[#B0B0B0] font-medium">Environment</label>
                                    <div className="relative">
                                        <select className="w-full bg-[#000000] text-white text-xs p-3 rounded appearance-none border border-white/10 hover:border-white/20 transition-colors cursor-pointer outline-none focus:border-[#FFC800]">
                                            <option>Stellar Testnet (Futurenet)</option>
                                            <option>Local Network</option>
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#B0B0B0]">
                                            ▼
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs text-[#B0B0B0] font-medium">Account</label>
                                    <div className="bg-[#000000] p-3 rounded border border-white/10 text-xs text-white font-mono flex items-center justify-between group cursor-pointer hover:border-white/20 transition-colors">
                                        <span className="truncate">0x71C...92A</span>
                                        <span className="text-[#FFC800] opacity-0 group-hover:opacity-100 text-[10px] uppercase">Copy</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDeploy}
                            disabled={deployStatus === "deploying"}
                            className={`w-full py-3 rounded text-sm font-bold uppercase tracking-wider transition-all transform active:scale-[0.98]
                                ${deployStatus === "deploying"
                                    ? "bg-[#FFC800]/50 text-white/50 cursor-wait"
                                    : "bg-[#FFC800] text-black hover:bg-[#FFD633] hover:shadow-[0_0_20px_rgba(255,200,0,0.3)] build-button" // added custom class for generic targeting if needed
                                }`}
                        >
                            {deployStatus === "idle" && "Deploy Contracts"}
                            {deployStatus === "deploying" && "Deploying..."}
                            {deployStatus === "success" && "Redeploy"}
                            {deployStatus === "error" && "Failed"}
                        </button>

                        {deployStatus === "success" && (
                            <div className="bg-[#000000] border border-green-500/30 p-4 rounded text-xs">
                                <p className="text-green-400 font-medium mb-1">✓ Deployment Successful</p>
                                <p className="text-[#B0B0B0] mb-2">Contract deployed to:</p>
                                <p className="font-mono text-white break-all bg-white/5 p-2 rounded">CDX7...992A</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "interact" && (
                    <div className="p-5 flex flex-col gap-6 animate-in fade-in duration-300">
                        {deployStatus !== "success" ? (
                            <div className="text-[#B0B0B0] text-sm text-center mt-20 px-4">
                                <div className="mb-4 text-4xl opacity-20">⚡</div>
                                Deploy a contract to start interacting with the blockchain.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="border border-white/10 rounded overflow-hidden">
                                    <div className="bg-[#000000] p-3 border-b border-white/10 flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-white">MyContract</h3>
                                        <span className="text-[10px] font-mono text-[#B0B0B0] bg-white/5 px-2 py-1 rounded">0x123...</span>
                                    </div>
                                    
                                    <div className="p-4 bg-[#1a1a1a] space-y-4">
                                        {/* Write Function */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-wider text-[#B0B0B0] font-bold">Write</label>
                                            <button
                                                onClick={handleIncrement}
                                                className="w-full bg-[#333] hover:bg-[#444] text-white text-xs py-2 rounded font-medium transition-colors border border-white/5 flex items-center justify-center gap-2 group"
                                            >
                                                <span>increment()</span>
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[#FFC800]">→</span>
                                            </button>
                                        </div>

                                        <div className="h-px bg-white/5" />

                                        {/* Read Function */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] uppercase tracking-wider text-[#B0B0B0] font-bold">Read</label>
                                            <div className="flex gap-2 items-stretch">
                                                <button
                                                    onClick={handleGet}
                                                    className="flex-1 bg-[#333] hover:bg-[#444] text-white text-xs py-2 rounded font-medium transition-colors border border-white/5"
                                                >
                                                    get()
                                                </button>
                                                {countValue !== null && (
                                                    <div className="flex items-center px-3 bg-[#000000] border border-white/10 rounded min-w-[60px] justify-center">
                                                        <span className="text-xs font-mono text-[#FFC800]">
                                                            {countValue}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
