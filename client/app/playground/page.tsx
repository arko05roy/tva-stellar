"use client";

import React from "react";
import Sidebar from "../../components/ide/Sidebar";
import CodeEditor from "../../components/ide/Editor";
import Terminal from "../../components/ide/Terminal";
import { ProjectProvider } from "../../components/ide/useProjectState";

export default function PlaygroundPage() {
    return (
        <ProjectProvider>
            <div className="flex h-screen w-full bg-[#000000] text-[#B0B0B0] overflow-hidden font-sans">
                {/* Sidebar */}
                <Sidebar />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
                    {/* Editor Area */}
                    <div className="flex-1 relative">
                        <CodeEditor />
                    </div>

                    {/* Terminal Area */}
                    <Terminal />
                </div>
            </div>
        </ProjectProvider>
    );
}

