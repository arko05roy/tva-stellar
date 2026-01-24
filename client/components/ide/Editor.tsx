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
            <div className="flex-1 bg-[#1e1e1e] flex items-center justify-center text-gray-500">
                <div className="text-center">
                    <p className="text-lg mb-2">No file selected</p>
                    <p className="text-sm">Select a file from the explorer to start editing</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-hidden bg-[#1e1e1e]">
            <Editor
                height="100%"
                defaultLanguage="solidity"
                language={activeFile.type === "solidity" ? "solidity" : "plaintext"}
                theme="vs-dark"
                path={activeFile.name} // This helps Monaco preserve state per file
                value={activeFile.content}
                onChange={(value) => updateFileContent(activeFile.id, value || "")}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'Menlo', 'Monaco', 'Courier New', monospace",
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    lineNumbers: "on",
                    roundedSelection: false,
                    renderLineHighlight: "all",
                }}
            />
        </div>
    );
}
