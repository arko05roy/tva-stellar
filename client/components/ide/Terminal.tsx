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
        <div className="h-48 bg-[#18181b] border-t border-[#27272a] flex flex-col">
            <div className="flex items-center px-4 py-2 bg-[#1f1f23] border-b border-[#27272a] gap-4">
                <span className="text-xs font-semibold text-white uppercase border-b-2 border-blue-500 pb-2 -mb-2.5">Output</span>
                <span className="text-xs font-semibold text-gray-500 uppercase pb-2 -mb-2.5 hover:text-gray-300 cursor-pointer">Terminal</span>
                <span className="text-xs font-semibold text-gray-500 uppercase pb-2 -mb-2.5 hover:text-gray-300 cursor-pointer">Problems (0)</span>
            </div>
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm">
                {logs.map((log, i) => (
                    <div key={i} className="mb-1">
                        {log.type === 'info' && <span className="text-gray-300">{log.msg}</span>}
                        {log.type === 'success' && <span className="text-green-400">{log.msg}</span>}
                        {log.type === 'error' && <span className="text-red-400">{log.msg}</span>}
                    </div>
                ))}
                <div className="mt-2 text-gray-500">
                    $ <span className="animate-pulse">_</span>
                </div>
            </div>
        </div>
    );
}
