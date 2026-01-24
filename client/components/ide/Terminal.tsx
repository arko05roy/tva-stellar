"use client";

import React from "react";

export default function Terminal() {
    // Mock output matching Solana Playground style
    const logs = [
        { type: 'info', msg: 'Setup completed.' },
        { type: 'building', msg: 'Building...' },
        { type: 'success', msg: 'Build successful. Completed in 5.92s.' },
        { type: 'deploying', msg: 'Deploying... This could take a while depending on the program size and network conditions.' },
        { type: 'success', msg: 'Deployment successful. Completed in 9s.' },
    ];

    return (
        <div className="h-full bg-[#1e1e2e] flex flex-col font-mono text-[13px]">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 bg-[#1e1e2e] border-b border-[#2b2b3b] h-[32px] select-none">
                <div className="flex items-center gap-4">
                    <span className="text-[#B0B0B0] text-[11px] uppercase font-medium">Terminal</span>
                </div>
                <div className="flex items-center gap-1">
                    <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs">⎚</button>
                    <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs">⌃</button>
                    <button className="w-5 h-5 flex items-center justify-center text-[#B0B0B0] hover:text-white hover:bg-white/10 rounded text-xs">✕</button>
                </div>
            </div>

            {/* Terminal Content */}
            <div className="flex-1 p-3 overflow-y-auto leading-6 text-[#B0B0B0]">
                <div className="mb-2 text-[#6B7280]">
                    See the list of available crates and request new crates from{" "}
                    <span className="text-[#9B7FFF] cursor-pointer hover:underline">https://github.com/stellar/playground</span>
                </div>
                <div className="mb-3 text-[#6B7280]">Type <span className="text-white">help</span> to see all commands.</div>

                {logs.map((log, i) => (
                    <div key={i} className="mb-1">
                        {log.type === 'info' && <span className="text-green-400">{log.msg}</span>}
                        {log.type === 'building' && <span className="text-[#FFC800]">{log.msg}</span>}
                        {log.type === 'deploying' && <span className="text-[#FFC800]">{log.msg}</span>}
                        {log.type === 'success' && <span className="text-green-400">{log.msg}</span>}
                        {log.type === 'error' && <span className="text-red-400">{log.msg}</span>}
                    </div>
                ))}

                {/* Prompt */}
                <div className="flex items-center gap-2 mt-3">
                    <span className="text-[#9B7FFF]">$</span>
                    <span className="w-2 h-4 bg-[#9B7FFF] animate-pulse"></span>
                </div>
            </div>
        </div>
    );
}
