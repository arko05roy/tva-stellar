"use client";

import React, { useState, Suspense } from "react";
import { motion } from "framer-motion";
import Sidebar from "../../components/ide/Sidebar";
import CodeEditor from "../../components/ide/Editor";
import Terminal from "../../components/ide/Terminal";
import StatusBar from "../../components/ide/StatusBar";
import { ProjectProvider } from "../../components/ide/useProjectState";
import dynamic from "next/dynamic";

// Dynamically import Three.js background to avoid SSR issues
const BackgroundEffect = dynamic(
    () => import("../../components/ide/BackgroundEffect"),
    { ssr: false }
);

// Loading fallback for the background
function BackgroundFallback() {
    return (
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 opacity-[0.02]"
                style={{
                    backgroundImage: `
                        linear-gradient(to right, #FFC800 1px, transparent 1px),
                        linear-gradient(to bottom, #FFC800 1px, transparent 1px)
                    `,
                    backgroundSize: '60px 60px'
                }}
            />
        </div>
    );
}

// Resizable panel divider
function ResizeHandle({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
    const [isDragging, setIsDragging] = useState(false);

    return (
        <motion.div
            className={`
                ${orientation === "vertical" ? "w-[1px] cursor-col-resize hover:w-[3px]" : "h-[1px] cursor-row-resize hover:h-[3px]"}
                bg-[#1a1a1a] hover:bg-[#FFC800]/50 transition-all duration-150 flex-shrink-0 relative group
            `}
            whileHover={{ scale: orientation === "vertical" ? [1, 1.5, 1] : 1 }}
            onMouseDown={() => setIsDragging(true)}
            onMouseUp={() => setIsDragging(false)}
        >
            {/* Invisible larger hit area */}
            <div className={`absolute ${orientation === "vertical" ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1"}`} />

            {/* Visual feedback on hover */}
            <div className={`
                absolute opacity-0 group-hover:opacity-100 transition-opacity
                ${orientation === "vertical"
                    ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-8"
                    : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1"
                }
                bg-[#FFC800]/30 rounded-full
            `} />
        </motion.div>
    );
}

export default function PlaygroundPage() {
    const [terminalHeight, setTerminalHeight] = useState(200);

    return (
        <ProjectProvider>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-screen w-full bg-[#000000] overflow-hidden font-sans relative"
            >
                {/* Subtle Three.js background */}
                <Suspense fallback={<BackgroundFallback />}>
                    <BackgroundEffect />
                </Suspense>

                {/* Gradient overlays for depth */}
                <div className="absolute inset-0 pointer-events-none">
                    {/* Top gradient */}
                    <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/50 to-transparent" />
                    {/* Bottom gradient */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/50 to-transparent" />
                    {/* Left gradient */}
                    <div className="absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-black/30 to-transparent" />
                    {/* Vignette corners */}
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />
                </div>

                {/* Main Workspace Area */}
                <div className="flex-1 flex flex-row overflow-hidden relative z-10">

                    {/* Side Panel (Now includes Files & Wallet/Build) */}
                    <Sidebar />

                    {/* Resize Handle */}
                    <ResizeHandle orientation="vertical" />

                    {/* Editor & Terminal Area (Right) */}
                    <div className="flex-1 flex flex-col min-w-0 relative">
                        {/* Editor Group */}
                        <motion.div
                            className="flex-1 flex flex-col relative min-h-0"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1, duration: 0.3 }}
                        >
                            <CodeEditor />
                        </motion.div>

                        {/* Resize Handle */}
                        <ResizeHandle orientation="horizontal" />

                        {/* Terminal Panel (Bottom) */}
                        <motion.div
                            className="flex-shrink-0"
                            style={{ height: terminalHeight }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2, duration: 0.3 }}
                        >
                            <Terminal />
                        </motion.div>
                    </div>
                </div>

                {/* Status Bar (Bottom Strip) */}
                <StatusBar />

                {/* Subtle noise texture overlay */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-[0.015] z-50"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                    }}
                />
            </motion.div>
        </ProjectProvider>
    );
}
