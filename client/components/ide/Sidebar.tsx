"use client";

import React, { useState } from "react";
import { Folder, useProject } from "./useProjectState";

interface SidebarProps {
    activeView: "explorer" | "search" | "git" | "debug" | "extensions";
}

export default function Sidebar({ activeView }: SidebarProps) {
    const { project, setActiveFileId, activeFileId } = useProject();
    const [activeTab, setActiveTab] = useState<"program" | "build" | "deploy">("program");
    const [clientTab, setClientTab] = useState<"client" | "run" | "test">("client");
    const [deployStatus, setDeployStatus] = useState<"idle" | "building" | "deploying" | "success" | "error">("idle");
    const [programId, setProgramId] = useState<string>("8xmNtMm1BkqKjehkM7Hv5n3fRo6k");

    // File Tree Renderer
    const RenderFolder = ({ folder, depth = 0 }: { folder: Folder; depth?: number }) => {
        return (
            <div className="flex flex-col">
                {folder.files.map((file) => (
                    <div
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={`group cursor-pointer flex items-center px-2 py-0.5 transition-all text-[13px]
                            ${activeFileId === file.id
                                ? "bg-[#37373d] text-white"
                                : "text-[#B0B0B0] hover:text-white hover:bg-[#2a2d2e]"
                            }`}
                        style={{ paddingLeft: `${depth * 12 + 24}px` }}
                    >
                        <span className="w-4 flex items-center justify-center text-xs mr-1.5 opacity-70">
                            {file.name.endsWith(".sol") ? "📄" : "📄"}
                        </span>
                        <span className="truncate">{file.name}</span>
                    </div>
                ))}
                {folder.folders.map((sub) => (
                    <div key={sub.id}>
                        <div
                            className="flex items-center px-2 py-0.5 text-[13px] text-[#B0B0B0] hover:text-white hover:bg-[#2a2d2e] cursor-pointer"
                            style={{ paddingLeft: `${depth * 12 + 12}px` }}
                        >
                            <span className="mr-1 text-[10px]">▼</span>
                            <span className="truncate">{sub.name}</span>
                        </div>
                        <RenderFolder folder={sub} depth={depth + 1} />
                    </div>
                ))}
            </div>
        );
    };

    const handleBuild = () => {
        setDeployStatus("building");
        setTimeout(() => {
            setDeployStatus("idle");
        }, 2000);
    };

    const handleDeploy = () => {
        setDeployStatus("deploying");
        setTimeout(() => {
            setDeployStatus("success");
        }, 3000);
    };

    if (activeView !== "explorer" && activeView !== "debug") {
        return (
            <div className="w-[280px] bg-[#1e1e2e] flex flex-col h-full border-r border-[#2b2b3b]">
                <div className="h-8 px-4 flex items-center text-[11px] font-semibold text-[#B0B0B0] uppercase tracking-wider border-b border-[#2b2b3b]">
                    {activeView === "git" ? "Source Control" : activeView === "search" ? "Search" : "Extensions"}
                </div>
                <div className="flex-1 flex items-center justify-center text-[#4A4A4A] text-xs">
                    Not implemented
                </div>
            </div>
        );
    }

    return (
        <div className="w-[280px] bg-[#1e1e2e] flex flex-col h-full border-r border-[#2b2b3b]">
            {/* Header */}
            <div className="h-8 px-4 flex items-center justify-between text-[11px] font-semibold text-[#B0B0B0] uppercase tracking-wider border-b border-[#2b2b3b]">
                <span>Explorer</span>
            </div>

            {/* Projects Section */}
            <div className="border-b border-[#2b2b3b]">
                <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[11px] text-[#B0B0B0] font-semibold uppercase tracking-wider">Projects</span>
                    <div className="flex items-center gap-1">
                        <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs" title="New File">+</button>
                        <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs" title="New Folder">📁</button>
                        <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs" title="Refresh">↻</button>
                    </div>
                </div>

                {/* Project Dropdown */}
                <div className="px-3 pb-2">
                    <select className="w-full bg-[#2b2b3b] text-white text-[13px] px-2 py-1 rounded border border-[#3b3b4b] focus:border-[#9B7FFF] outline-none cursor-pointer">
                        <option>{project.name}</option>
                    </select>
                </div>

                {/* Action Tabs: Program | Build | Deploy */}
                <div className="flex items-center px-3 py-1.5 gap-1">
                    <button
                        onClick={() => setActiveTab("program")}
                        className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors ${activeTab === "program"
                                ? "bg-[#9B7FFF]/20 text-[#9B7FFF]"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        Program
                    </button>
                    <button
                        onClick={() => { setActiveTab("build"); handleBuild(); }}
                        className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${activeTab === "build"
                                ? "bg-[#9B7FFF]/20 text-[#9B7FFF]"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {deployStatus === "building" && <span className="animate-spin">↻</span>}
                        Build
                    </button>
                    <button
                        onClick={() => { setActiveTab("deploy"); handleDeploy(); }}
                        className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors flex items-center justify-center gap-1 ${activeTab === "deploy"
                                ? "bg-[#FFC800]/20 text-[#FFC800]"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        {deployStatus === "deploying" && <span className="animate-spin">↻</span>}
                        Deploy
                    </button>
                </div>
            </div>

            {/* File Tree / Program Content */}
            <div className="flex-1 overflow-y-auto py-1">
                {activeTab === "program" && (
                    <>
                        {/* src folder */}
                        <div className="flex items-center px-3 py-0.5 text-[13px] text-[#B0B0B0] hover:text-white hover:bg-[#2a2d2e] cursor-pointer">
                            <span className="mr-1 text-[10px]">▼</span>
                            <span>src</span>
                        </div>
                        <RenderFolder folder={project.root} depth={1} />
                    </>
                )}

                {activeTab === "build" && (
                    <div className="px-3 py-2 text-[12px] text-[#B0B0B0]">
                        <p className="mb-2">Build the program first or import a program from <span className="text-[#9B7FFF]">Program binary</span>.</p>
                        {deployStatus === "building" ? (
                            <div className="flex items-center gap-2 text-[#FFC800]">
                                <span className="animate-spin">↻</span> Building...
                            </div>
                        ) : (
                            <p className="text-green-400">Ready to build</p>
                        )}
                    </div>
                )}

                {activeTab === "deploy" && (
                    <div className="px-3 py-2 text-[12px]">
                        {/* Program ID Section */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] text-[#B0B0B0] font-semibold">▼ Program ID</span>
                            </div>
                            <p className="text-[11px] text-[#B0B0B0] mb-2">Import/export program keypair or input a public key for the program.</p>
                            <div className="flex gap-1 mb-2">
                                <button className="px-2 py-1 bg-[#2b2b3b] text-white text-[10px] rounded border border-[#3b3b4b] hover:border-[#9B7FFF]">New</button>
                                <button className="px-2 py-1 bg-[#2b2b3b] text-white text-[10px] rounded border border-[#3b3b4b] hover:border-[#9B7FFF]">Import</button>
                                <button className="px-2 py-1 bg-[#2b2b3b] text-white text-[10px] rounded border border-[#3b3b4b] hover:border-[#9B7FFF]">Export</button>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] text-[#B0B0B0]">Program ID:</span>
                                <div className="flex-1 flex items-center bg-[#2b2b3b] rounded px-2 py-1 border border-[#3b3b4b]">
                                    <span className="text-[11px] text-white font-mono truncate">{programId}</span>
                                    <button className="ml-1 text-[#B0B0B0] hover:text-white text-xs">📋</button>
                                </div>
                            </div>
                            <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">⚠ Note: You need authority to upgrade.</p>
                        </div>

                        {/* Status */}
                        {deployStatus === "deploying" && (
                            <div className="flex items-center gap-2 text-[#FFC800]">
                                <span className="animate-spin">↻</span> Deploying...
                            </div>
                        )}
                        {deployStatus === "success" && (
                            <div className="text-green-400 text-[11px]">
                                ✓ Deployed successfully
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Client Section */}
            <div className="border-t border-[#2b2b3b]">
                <div className="flex items-center px-3 py-1.5 gap-1">
                    <button
                        onClick={() => setClientTab("client")}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${clientTab === "client"
                                ? "bg-[#9B7FFF]/20 text-[#9B7FFF]"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        Client
                    </button>
                    <button
                        onClick={() => setClientTab("run")}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1 ${clientTab === "run"
                                ? "bg-green-500/20 text-green-400"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        ▶ Run
                    </button>
                    <button
                        onClick={() => setClientTab("test")}
                        className={`px-2 py-1 text-[11px] font-medium rounded transition-colors flex items-center gap-1 ${clientTab === "test"
                                ? "bg-[#9B7FFF]/20 text-[#9B7FFF]"
                                : "text-[#B0B0B0] hover:text-white hover:bg-white/5"
                            }`}
                    >
                        🧪 Test
                    </button>
                </div>

                {/* Client Folders */}
                <div className="py-1">
                    <div className="flex items-center px-3 py-0.5 text-[13px] text-[#B0B0B0] hover:text-white hover:bg-[#2a2d2e] cursor-pointer">
                        <span className="mr-1 text-[10px]">▷</span>
                        <span>client</span>
                    </div>
                    <div className="flex items-center px-3 py-0.5 text-[13px] text-[#B0B0B0] hover:text-white hover:bg-[#2a2d2e] cursor-pointer">
                        <span className="mr-1 text-[10px]">▷</span>
                        <span>tests</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
