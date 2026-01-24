"use client";

import React from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useProject } from "./useProjectState";

export default function CodeEditor() {
    const { activeFile, updateFileContent } = useProject();
    const monaco = useMonaco();

    React.useEffect(() => {
        if (monaco) {
            // Basic solidity theme configuration if needed, or stick to vs-dark
            monaco.languages.register({ id: 'solidity' });
            // Logic to configure solidity language features would go here
        }
    }, [monaco]);

    if (!activeFile) {
        return (
            <div className="flex-1 bg-[#1a1a1a] flex items-center justify-center text-[#B0B0B0]">
                <div className="text-center opacity-50">
                    <p className="text-2xl mb-2 font-serif text-white">Select a File</p>
                    <p className="text-sm font-sans">Choose a file from the sidebar to start coding</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-hidden bg-[#1a1a1a]">
            {/* Custom file header */}
            <div className="h-9 bg-[#000000] border-b border-white/5 flex items-center px-4 gap-2">
                <span className="text-xs text-[#FFC800]">TYPE</span>
                <span className="text-xs text-[#B0B0B0] font-mono">{activeFile.name}</span>
            </div>

            <div className="h-[calc(100%-36px)]">
                <Editor
                    height="100%"
                    defaultLanguage="solidity"
                    language={activeFile.type === "solidity" ? "solidity" : "plaintext"}
                    theme="vs-dark"
                    path={activeFile.name}
                    value={activeFile.content}
                    onChange={(value) => updateFileContent(activeFile.id, value || "")}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        fontFamily: "'IBM Plex Mono', 'Menlo', 'Monaco', monospace",
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        lineNumbers: "on",
                        roundedSelection: false,
                        renderLineHighlight: "all",
                        backgroundColor: '#000000'
                    }}
                />
            </div>
        </div>
    );
}
