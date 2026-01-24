"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// --- Schema Definitions ---

export type FileType = "solidity" | "javascript" | "json" | "markdown" | "rust";

export interface File {
    id: string;
    name: string;
    type: FileType;
    content: string;
}

export interface Folder {
    id: string;
    name: string;
    files: File[];
    folders: Folder[]; // Recursive for nested folders
}

export interface Project {
    name: string;
    root: Folder;
}

// --- Initial Data ---

const initialProject: Project = {
    name: "My Solidity Project",
    root: {
        id: "root",
        name: "src",
        files: [
            {
                id: "1",
                name: "MyContract.sol",
                type: "solidity",
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    uint256 public count;

    function increment() public {
        count += 1;
    }

    function get() public view returns (uint256) {
        return count;
    }
}`
            },
            {
                id: "2",
                name: "Deploy.s.sol",
                type: "solidity",
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./MyContract.sol";

contract DeployScript {
    function run() public {
        new MyContract();
    }
}`
            }
        ],
        folders: []
    }
};

// --- Context & Provider ---

interface ProjectContextType {
    project: Project;
    activeFileId: string | null;
    activeFile: File | null;
    setActiveFileId: (id: string) => void;
    updateFileContent: (id: string, content: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [project, setProject] = useState<Project>(initialProject);
    const [activeFileId, setActiveFileId] = useState<string | null>("1");

    // Helper to find file recursively
    const findFile = (folder: Folder, id: string): File | null => {
        for (const file of folder.files) {
            if (file.id === id) return file;
        }
        for (const sub of folder.folders) {
            const found = findFile(sub, id);
            if (found) return found;
        }
        return null;
    };

    const activeFile = activeFileId ? findFile(project.root, activeFileId) : null;

    const updateFileContent = (id: string, content: string) => {
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root)); // Deep copy for simplicity
            // Helper to update recursively
            const updateInFolder = (folder: Folder) => {
                for (const file of folder.files) {
                    if (file.id === id) {
                        file.content = content;
                        return;
                    }
                }
                for (const sub of folder.folders) {
                    updateInFolder(sub);
                }
            };
            updateInFolder(newRoot);
            return { ...prev, root: newRoot };
        });
    };

    const contextValue = {
        project,
        activeFileId,
        activeFile,
        setActiveFileId,
        updateFileContent,
    };

    return (
        <ProjectContext.Provider value= { contextValue } >
        { children }
        </ProjectContext.Provider>
  );
}

export function useProject() {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error("useProject must be used within a ProjectProvider");
    }
    return context;
}
