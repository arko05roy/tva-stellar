"use client";

import React from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { useProject } from "./useProjectState";

export default function CodeEditor() {
    const { activeFile, updateFileContent } = useProject();
    const monaco = useMonaco();

    React.useEffect(() => {
        if (monaco) {
            monaco.languages.register({ id: 'solidity' });
        }
    }, [monaco]);

    if (!activeFile) {
        return (
            <div className="flex-1 bg-[#1e1e2e] flex items-center justify-center text-[#4A4A4A]">
                <div className="text-center">
                    <p className="text-lg mb-2 font-medium text-[#B0B0B0]">Select a file to start editing</p>
                    <p className="text-sm">Choose a file from the explorer</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-hidden bg-[#1e1e2e] flex flex-col">
            {/* Tab Bar */}
            <div className="h-[35px] bg-[#1e1e2e] flex items-end overflow-x-auto select-none border-b border-[#2b2b3b]">
                <div className="h-[35px] px-3 max-w-[200px] min-w-[120px] bg-[#252535] text-white text-[13px] flex items-center justify-between gap-2 border-t-2 border-[#9B7FFF]">
                    <span className="flex items-center gap-2 truncate">
                        <span className="text-[#FFC800] text-xs">📄</span> {activeFile.name}
                    </span>
                    <span className="opacity-0 hover:opacity-100 cursor-pointer rounded-sm hover:bg-white/20 p-0.5 text-xs" title="Close">✕</span>
                </div>
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    defaultLanguage="solidity"
                    language={activeFile.type === "solidity" ? "solidity" : "plaintext"}
                    theme="vs-dark"
                    path={activeFile.name}
                    value={activeFile.content}
                    onChange={(value) => updateFileContent(activeFile.id, value || "")}
                    options={{
                        minimap: { enabled: true, scale: 0.75, renderCharacters: false },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', monospace",
                        scrollBeyondLastLine: false,
                        padding: { top: 10, bottom: 10 },
                        lineNumbers: "on",
                        glyphMargin: true,
                        folding: true,
                        lineDecorationsWidth: 10,
                        lineNumbersMinChars: 3,
                        roundedSelection: false,
                        renderLineHighlight: "line",
                        overviewRulerBorder: false,
                        hideCursorInOverviewRuler: true,
                    }}
                />
            </div>
        </div>
    );
}
