"use client";

import React from "react";
import Editor, { useMonaco } from "@monaco-editor/react";
import { motion } from "framer-motion";
import { useProject } from "./useProjectState";

const CloseIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6L6 18M6 6l12 12" />
    </svg>
);

const StellarIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="opacity-20">
        <circle cx="12" cy="12" r="10" stroke="#FFC800" strokeWidth="1" />
        <circle cx="12" cy="12" r="6" stroke="#FFC800" strokeWidth="1" />
        <circle cx="12" cy="12" r="2" fill="#FFC800" />
    </svg>
);

export default function CodeEditor() {
    const { activeFile, updateFileContent } = useProject();
    const monaco = useMonaco();

    React.useEffect(() => {
        if (monaco) {
            // Register Solidity language
            monaco.languages.register({ id: 'solidity' });

            // Define custom theme matching Stellar
            monaco.editor.defineTheme('stellar-dark', {
                base: 'vs-dark',
                inherit: true,
                rules: [
                    { token: 'comment', foreground: '4a4a4a', fontStyle: 'italic' },
                    { token: 'keyword', foreground: 'FFC800' },
                    { token: 'string', foreground: '22C55E' },
                    { token: 'number', foreground: '3B82F6' },
                    { token: 'type', foreground: 'FFC800' },
                    { token: 'function', foreground: 'FFFFFF' },
                    { token: 'variable', foreground: 'E0E0E0' },
                    { token: 'operator', foreground: '808080' },
                ],
                colors: {
                    'editor.background': '#0a0a0a',
                    'editor.foreground': '#e0e0e0',
                    'editor.lineHighlightBackground': '#1a1a1a',
                    'editor.selectionBackground': '#FFC80030',
                    'editor.inactiveSelectionBackground': '#FFC80015',
                    'editorLineNumber.foreground': '#4a4a4a',
                    'editorLineNumber.activeForeground': '#FFC800',
                    'editorCursor.foreground': '#FFC800',
                    'editor.wordHighlightBackground': '#FFC80020',
                    'editorBracketMatch.background': '#FFC80030',
                    'editorBracketMatch.border': '#FFC80050',
                    'scrollbarSlider.background': '#2a2a2a80',
                    'scrollbarSlider.hoverBackground': '#3a3a3a80',
                    'scrollbarSlider.activeBackground': '#4a4a4a80',
                    'minimap.background': '#050505',
                    'editorGutter.background': '#0a0a0a',
                    'editorIndentGuide.background': '#1a1a1a',
                    'editorIndentGuide.activeBackground': '#2a2a2a',
                }
            });
        }
    }, [monaco]);

    if (!activeFile) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex-1 bg-[#0a0a0a] flex items-center justify-center relative overflow-hidden"
            >
                {/* Background grid pattern */}
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, #FFC800 1px, transparent 1px),
                            linear-gradient(to bottom, #FFC800 1px, transparent 1px)
                        `,
                        backgroundSize: '40px 40px'
                    }}
                />

                {/* Glowing orb */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-[#FFC800]/5 blur-[100px]" />

                <motion.div
                    className="text-center relative z-10"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    <motion.div
                        className="mb-6"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    >
                        <StellarIcon />
                    </motion.div>
                    <h3 className="text-xl font-semibold text-white mb-2">Select a file to start editing</h3>
                    <p className="text-sm text-[#4a4a4a]">Choose a file from the explorer on the left</p>

                    {/* Keyboard shortcuts hint */}
                    <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-[#4a4a4a]">
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">Cmd</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">P</kbd>
                            <span className="ml-1">Quick Open</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">Cmd</kbd>
                            <span>+</span>
                            <kbd className="px-1.5 py-0.5 bg-[#1a1a1a] rounded border border-[#2a2a2a] text-[#808080]">S</kbd>
                            <span className="ml-1">Save</span>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        );
    }

    const getFileExtColor = (name: string) => {
        const ext = name.split('.').pop();
        const colors: Record<string, string> = {
            sol: "#FFC800",
            rs: "#DEA584",
            ts: "#3178C6",
            js: "#F7DF1E",
            json: "#6D6D6D",
            md: "#519ABA",
        };
        return colors[ext || ''] || '#808080';
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 h-full overflow-hidden bg-[#0a0a0a] flex flex-col"
        >
            {/* Tab Bar */}
            <div className="h-[40px] bg-[#050505] flex items-end overflow-x-auto select-none border-b border-[#1a1a1a]">
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-[40px] px-4 min-w-[140px] max-w-[220px] bg-[#0a0a0a] text-white text-[13px] flex items-center justify-between gap-3 border-t-2 border-[#FFC800] border-r border-r-[#1a1a1a] group"
                >
                    <span className="flex items-center gap-2 truncate">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getFileExtColor(activeFile.name) }}
                        />
                        <span className="truncate font-medium">{activeFile.name}</span>
                    </span>
                    <motion.button
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-[#4a4a4a] hover:text-white transition-all"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <CloseIcon />
                    </motion.button>
                </motion.div>

                {/* Empty tab space for visual balance */}
                <div className="flex-1 h-full border-b border-[#1a1a1a]" />
            </div>

            {/* Breadcrumb */}
            <div className="h-[28px] bg-[#0a0a0a] flex items-center px-4 text-[12px] text-[#4a4a4a] border-b border-[#111111] gap-1">
                <span className="hover:text-[#808080] cursor-pointer transition-colors">src</span>
                <span>/</span>
                <span className="text-[#808080]">{activeFile.name}</span>
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
                <Editor
                    height="100%"
                    defaultLanguage="solidity"
                    language={activeFile.type === "solidity" ? "solidity" : "plaintext"}
                    theme="stellar-dark"
                    path={activeFile.name}
                    value={activeFile.content}
                    onChange={(value) => updateFileContent(activeFile.id, value || "")}
                    options={{
                        minimap: {
                            enabled: true,
                            scale: 1,
                            renderCharacters: false,
                            showSlider: "mouseover",
                            side: "right",
                        },
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace",
                        fontLigatures: true,
                        scrollBeyondLastLine: false,
                        padding: { top: 16, bottom: 16 },
                        lineNumbers: "on",
                        glyphMargin: true,
                        folding: true,
                        lineDecorationsWidth: 8,
                        lineNumbersMinChars: 4,
                        roundedSelection: true,
                        renderLineHighlight: "line",
                        overviewRulerBorder: false,
                        hideCursorInOverviewRuler: true,
                        cursorBlinking: "smooth",
                        cursorSmoothCaretAnimation: "on",
                        smoothScrolling: true,
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        guides: {
                            indentation: true,
                            bracketPairs: true,
                        },
                        scrollbar: {
                            vertical: "auto",
                            horizontal: "auto",
                            useShadows: false,
                            verticalScrollbarSize: 10,
                            horizontalScrollbarSize: 10,
                        },
                    }}
                    loading={
                        <div className="flex-1 bg-[#0a0a0a] flex items-center justify-center">
                            <motion.div
                                className="w-8 h-8 rounded-full border-2 border-[#FFC800] border-t-transparent"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            />
                        </div>
                    }
                />
            </div>
        </motion.div>
    );
}
