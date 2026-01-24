"use client";

import React from "react";
import Sidebar from "../../components/ide/Sidebar";
import CodeEditor from "../../components/ide/Editor";
import Terminal from "../../components/ide/Terminal";
import { ProjectProvider } from "../../components/ide/useProjectState";

export default function PlaygroundPage() {
    return (
        <ProjectProvider>
            <div className="flex h-screen w-full bg-[#1e1e1e] text-gray-300 overflow-hidden font-sans">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Header / Tabs */}
                    <div className="h-10 bg-[#1e1e1e] border-b border-[#27272a] flex items-center px-4">
                        <div className="px-3 py-1 bg-[#1e1e1e] text-white text-sm border-t-2 border-blue-500 cursor-default">
                            MyContract.sol
                        </div>
                    </div>

                    {/* Editor Area */}
                    <CodeEditor />

                    {/* Terminal Area */}
                    <Terminal />
                </div>
            </div>
        </ProjectProvider>
    );
}
