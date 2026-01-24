"use client";

import React from "react";

export default function Terminal() {
    // Mock output for now
    const logs = [
        { type: 'info', msg: '> tva compile' },
        { type: 'success', msg: 'Compiling 2 files with Solang...' },
        { type: 'info', msg: 'Generating WASM artifacts...' },
        { type: 'success', msg: 'Build successful! Artifacts written to /out.' },
    ];

    return (
        <div className="h-64 bg-[#050505] border-t border-white/10 flex flex-col font-mono">
            <div className="flex items-center px-4 bg-[#0a0a0a] border-b border-white/5 gap-6">
                <span className="text-[10px] font-bold text-[#FFC800] uppercase tracking-wider py-2 border-b border-[#FFC800]">Output</span>
                <span className="text-[10px] font-bold text-[#B0B0B0] uppercase tracking-wider py-2 hover:text-white cursor-pointer transition-colors opacity-50 hover:opacity-100">Terminal</span>
                <span className="text-[10px] font-bold text-[#B0B0B0] uppercase tracking-wider py-2 hover:text-white cursor-pointer transition-colors opacity-50 hover:opacity-100">Problems (0)</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto text-sm scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {logs.map((log, i) => (
                    <div key={i} className="mb-2 font-mono leading-relaxed">
                        {log.type === 'info' && <span className="text-[#B0B0B0]">{log.msg}</span>}
                        {log.type === 'success' && (
                            <span className="text-green-400 flex items-center gap-2">
                                <span className="text-[10px]">✓</span> {log.msg}
                            </span>
                        )}
                        {log.type === 'error' && <span className="text-red-400">{log.msg}</span>}
                    </div>
                ))}
                <div className="mt-2 text-[#FFC800] flex items-center gap-2">
                    <span className="opacity-50">❯</span> <span className="animate-pulse">_</span>
                </div>
            </div>
        </div>
    );
}
