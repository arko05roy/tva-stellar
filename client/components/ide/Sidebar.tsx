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
                    className="px-4 py-1 text-sm text-gray-400 font-medium select-none flex items-center gap-1"
                    style={{ paddingLeft: `${depth * 12 + 16}px` }}
                >
                    <span>📁</span> {folder.name}
                </div>
                {folder.files.map((file) => (
                    <div
                        key={file.id}
                        onClick={() => setActiveFileId(file.id)}
                        className={`px-4 py-1 text-sm cursor-pointer flex items-center gap-2 hover:bg-[#2d2d2d] transition-colors ${activeFileId === file.id ? "bg-[#37373d] text-white" : "text-gray-400"
                            }`}
                        style={{ paddingLeft: `${depth * 12 + 24}px` }}
                    >
                        <span className="text-xs">
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
        // Mock transaction
        console.log("Transaction sent: increment()");
    };

    const handleGet = () => {
        // Mock call
        setCountValue((prev) => (prev === null ? 1 : prev + 1));
    };

    return (
        <div className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col h-full">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-[#27272a]">
                <button
                    onClick={() => setActiveTab("explorer")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "explorer" ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    Files
                </button>
                <button
                    onClick={() => setActiveTab("deploy")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "deploy" ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    Deploy
                </button>
                <button
                    onClick={() => setActiveTab("interact")}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "interact" ? "text-white border-b-2 border-blue-500" : "text-gray-500 hover:text-gray-300"
                        }`}
                >
                    Interact
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto py-2">
                {activeTab === "explorer" && (
                    <div className="flex flex-col">
                        <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                            {project.name.toUpperCase()}
                        </div>
                        <RenderFolder folder={project.root} />
                    </div>
                )}

                {activeTab === "deploy" && (
                    <div className="p-4 flex flex-col gap-4">
                        <div className="bg-[#27272a] p-3 rounded-lg border border-[#3f3f46]">
                            <h3 className="text-sm font-semibold text-white mb-2">Deploy Configuration</h3>
                            <div className="flex flex-col gap-2">
                                <label className="text-xs text-gray-400">Environment</label>
                                <select className="bg-[#18181b] text-white text-xs p-2 rounded border border-[#3f3f46] outline-none">
                                    <option>Stellar Testnet (Futurenet)</option>
                                    <option>Local Network</option>
                                </select>

                                <label className="text-xs text-gray-400">Account</label>
                                <div className="bg-[#18181b] p-2 rounded border border-[#3f3f46] text-xs text-gray-300 truncate">
                                    0x123...abc
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleDeploy}
                            disabled={deployStatus === "deploying"}
                            className={`w-full py-2 rounded font-medium text-sm transition-all ${deployStatus === "deploying"
                                ? "bg-yellow-600 cursor-wait"
                                : deployStatus === "success"
                                    ? "bg-green-600 hover:bg-green-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                } text-white`}
                        >
                            {deployStatus === "idle" && "Deploy Contracts"}
                            {deployStatus === "deploying" && "Deploying..."}
                            {deployStatus === "success" && "Redeploy"}
                            {deployStatus === "error" && "Failed"}
                        </button>

                        {deployStatus === "success" && (
                            <div className="bg-[#1c291f] border border-green-800 p-3 rounded text-xs text-green-400">
                                <p>Last deployed at:</p>
                                <p className="font-mono mt-1">CDX...992A</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "interact" && (
                    <div className="p-4 flex flex-col gap-4">
                        {deployStatus !== "success" ? (
                            <div className="text-gray-500 text-sm italic text-center mt-10">
                                Deploy a contract first to interact with it.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div className="bg-[#27272a] p-3 rounded-lg border border-[#3f3f46]">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-white">MyContract</h3>
                                        <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.5 rounded">0x123...</span>
                                    </div>
                                    <div className="space-y-3">
                                        {/* Write Function */}
                                        <div>
                                            <button
                                                onClick={handleIncrement}
                                                className="w-full bg-orange-600 hover:bg-orange-700 text-white text-xs py-1.5 rounded font-medium transition-colors"
                                            >
                                                increment
                                            </button>
                                        </div>

                                        {/* Read Function */}
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={handleGet}
                                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded font-medium transition-colors"
                                            >
                                                get
                                            </button>
                                            {countValue !== null && (
                                                <span className="text-xs font-mono text-green-400">
                                                    uint256: {countValue}
                                                </span>
                                            )}
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
