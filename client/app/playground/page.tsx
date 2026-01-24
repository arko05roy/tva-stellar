"use client";

import React, { useState } from "react";
import Sidebar from "../../components/ide/Sidebar";
import CodeEditor from "../../components/ide/Editor";
import Terminal from "../../components/ide/Terminal";
import ActivityBar from "../../components/ide/ActivityBar";
import StatusBar from "../../components/ide/StatusBar";
import { ProjectProvider } from "../../components/ide/useProjectState";

export default function PlaygroundPage() {
    const [activeSideView, setActiveSideView] = useState("explorer");

    return (
        <ProjectProvider>
            <div className="flex flex-col h-screen w-full bg-[#1e1e2e] overflow-hidden font-sans">

                {/* Main Workspace Area */}
                <div className="flex-1 flex flex-row overflow-hidden">
                    {/* Activity Bar (Far Left) */}
                    <ActivityBar activeTab={activeSideView} setActiveTab={setActiveSideView} />

                    {/* Side Panel */}
                    <Sidebar activeView={activeSideView as any} />

                    {/* Editor & Terminal Area (Right) */}
                    <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e2e]">
                        {/* Editor Group */}
                        <div className="flex-1 flex flex-col relative">
                            <CodeEditor />
                        </div>

                        {/* Terminal Panel (Bottom) */}
                        <div className="h-[200px] border-t border-[#2b2b3b]">
                            <Terminal />
                        </div>
                    </div>
                </div>

                {/* Status Bar (Bottom Strip) */}
                <StatusBar />
            </div>
        </ProjectProvider>
    );
}
