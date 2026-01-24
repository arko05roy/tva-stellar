"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

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
    folders: Folder[];
}

export interface Project {
    name: string;
    root: Folder;
}

export interface TerminalLog {
    type: "info" | "success" | "error" | "warning" | "building" | "verifying" | "deploying" | "system";
    msg: string;
    timestamp?: number;
}

export interface CompileResult {
    success: boolean;
    wasm?: string;
    abi?: object;
    errors?: string[];
    warnings?: string[];
    size?: number;
    hash?: string;
}

export interface VerifyResult {
    verified: boolean;
    hash: string;
    existingHash?: string;
    onChainHash?: string;
    hashMatch: boolean;
    onChainMatch?: boolean;
    size: number;
    errors?: string[];
}

export interface DeployResult {
    success: boolean;
    contractId?: string;
    explorerUrl?: string;
    error?: string;
}

export type BuildStatus = "idle" | "compiling" | "compiled" | "verifying" | "verified" | "deploying" | "deployed" | "error";

// --- Helper ---

function getFileType(name: string): FileType {
    if (name.endsWith(".sol")) return "solidity";
    if (name.endsWith(".js") || name.endsWith(".ts")) return "javascript";
    if (name.endsWith(".json")) return "json";
    if (name.endsWith(".md")) return "markdown";
    if (name.endsWith(".rs")) return "rust";
    return "solidity";
}

let fileCounter = 10;
function genId() {
    return `file-${Date.now()}-${fileCounter++}`;
}

// --- Initial Data ---

const initialProject: Project = {
    name: "TVA Project",
    root: {
        id: "root",
        name: "src",
        files: [
            {
                id: "1",
                name: "Counter.sol",
                type: "solidity",
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 persistent count;

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
                name: "Greeter.sol",
                type: "solidity",
                content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Greeter {
    string persistent greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
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
    // File management
    createFile: (name: string, parentFolderId?: string) => void;
    renameFile: (id: string, newName: string) => void;
    deleteFile: (id: string) => void;
    createFolder: (name: string, parentFolderId?: string) => void;
    deleteFolder: (id: string) => void;
    // Terminal
    logs: TerminalLog[];
    addLog: (log: TerminalLog) => void;
    clearLogs: () => void;
    // Compilation
    buildStatus: BuildStatus;
    compileResult: CompileResult | null;
    verifyResult: VerifyResult | null;
    deployResult: DeployResult | null;
    compile: () => Promise<void>;
    verify: () => Promise<void>;
    deploy: () => Promise<void>;
    // Wallet
    walletAddress: string | null;
    walletBalance: string | null;
    isWalletConnected: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
    const [project, setProject] = useState<Project>(initialProject);
    const [activeFileId, setActiveFileId] = useState<string | null>("1");
    const [logs, setLogs] = useState<TerminalLog[]>([
        { type: "system", msg: "TVA Playground v0.1.0 — Solidity to Soroban Compiler" },
        { type: "info", msg: "Write Solidity code and click Build to compile to Soroban WASM." },
        { type: "info", msg: "Use Verify to check integrity, Deploy to push to Stellar testnet." },
    ]);
    const [buildStatus, setBuildStatus] = useState<BuildStatus>("idle");
    const [compileResult, setCompileResult] = useState<CompileResult | null>(null);
    const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
    const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [walletBalance, setWalletBalance] = useState<string | null>(null);

    const isWalletConnected = walletAddress !== null;

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
            const newRoot = JSON.parse(JSON.stringify(prev.root));
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

    // --- File Management ---

    const createFile = useCallback((name: string, parentFolderId?: string) => {
        const newFile: File = {
            id: genId(),
            name,
            type: getFileType(name),
            content: name.endsWith(".sol")
                ? `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract ${name.replace(".sol", "")} {\n    \n}\n`
                : "",
        };
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root));
            const addToFolder = (folder: Folder): boolean => {
                if (folder.id === (parentFolderId || "root")) {
                    folder.files.push(newFile);
                    return true;
                }
                for (const sub of folder.folders) {
                    if (addToFolder(sub)) return true;
                }
                return false;
            };
            addToFolder(newRoot);
            return { ...prev, root: newRoot };
        });
        setActiveFileId(newFile.id);
    }, []);

    const renameFile = useCallback((id: string, newName: string) => {
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root));
            const renameInFolder = (folder: Folder) => {
                for (const file of folder.files) {
                    if (file.id === id) {
                        file.name = newName;
                        file.type = getFileType(newName);
                        return;
                    }
                }
                for (const sub of folder.folders) {
                    renameInFolder(sub);
                }
            };
            renameInFolder(newRoot);
            return { ...prev, root: newRoot };
        });
    }, []);

    const deleteFile = useCallback((id: string) => {
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root));
            const deleteFromFolder = (folder: Folder) => {
                folder.files = folder.files.filter((f: File) => f.id !== id);
                for (const sub of folder.folders) {
                    deleteFromFolder(sub);
                }
            };
            deleteFromFolder(newRoot);
            return { ...prev, root: newRoot };
        });
        if (activeFileId === id) {
            setActiveFileId(null);
        }
    }, [activeFileId]);

    const createFolder = useCallback((name: string, parentFolderId?: string) => {
        const newFolder: Folder = {
            id: genId(),
            name,
            files: [],
            folders: [],
        };
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root));
            const addToFolder = (folder: Folder): boolean => {
                if (folder.id === (parentFolderId || "root")) {
                    folder.folders.push(newFolder);
                    return true;
                }
                for (const sub of folder.folders) {
                    if (addToFolder(sub)) return true;
                }
                return false;
            };
            addToFolder(newRoot);
            return { ...prev, root: newRoot };
        });
    }, []);

    const deleteFolder = useCallback((id: string) => {
        setProject((prev) => {
            const newRoot = JSON.parse(JSON.stringify(prev.root));
            const deleteFromFolder = (folder: Folder) => {
                folder.folders = folder.folders.filter((f: Folder) => f.id !== id);
                for (const sub of folder.folders) {
                    deleteFromFolder(sub);
                }
            };
            deleteFromFolder(newRoot);
            return { ...prev, root: newRoot };
        });
    }, []);

    // --- Terminal ---

    const addLog = useCallback((log: TerminalLog) => {
        setLogs((prev) => [...prev, { ...log, timestamp: Date.now() }]);
    }, []);

    const clearLogs = useCallback(() => {
        setLogs([]);
    }, []);

    // --- Compilation ---

    const compile = useCallback(async () => {
        if (!activeFile) {
            addLog({ type: "error", msg: "No file selected for compilation." });
            return;
        }
        if (!activeFile.name.endsWith(".sol")) {
            addLog({ type: "error", msg: "Only .sol files can be compiled." });
            return;
        }

        setBuildStatus("compiling");
        setCompileResult(null);
        setVerifyResult(null);
        setDeployResult(null);
        addLog({ type: "building", msg: `Compiling ${activeFile.name}...` });

        try {
            const response = await fetch("/api/compile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ source: activeFile.content, filename: activeFile.name }),
            });
            const result: CompileResult = await response.json();
            setCompileResult(result);

            if (result.success) {
                setBuildStatus("compiled");
                addLog({ type: "success", msg: `Build successful!` });
                addLog({ type: "info", msg: `  WASM: ${result.size} bytes | SHA256: ${result.hash?.slice(0, 16)}...` });
                if (result.abi) {
                    addLog({ type: "info", msg: `  ABI generated (${JSON.stringify(result.abi).length} bytes)` });
                }
                if (result.warnings?.length) {
                    result.warnings.forEach((w) => addLog({ type: "warning", msg: `  ${w}` }));
                }
            } else {
                setBuildStatus("error");
                addLog({ type: "error", msg: "Build failed:" });
                result.errors?.forEach((e) => addLog({ type: "error", msg: `  ${e}` }));
            }
        } catch (err) {
            setBuildStatus("error");
            addLog({ type: "error", msg: `Build request failed: ${err instanceof Error ? err.message : "Network error"}` });
        }
    }, [activeFile, addLog]);

    // --- Verification ---

    const verify = useCallback(async () => {
        if (!activeFile) {
            addLog({ type: "error", msg: "No file selected." });
            return;
        }
        if (!compileResult?.hash) {
            addLog({ type: "warning", msg: "Build the contract first before verifying." });
            return;
        }

        setBuildStatus("verifying");
        setVerifyResult(null);
        addLog({ type: "verifying", msg: `Verifying ${activeFile.name}...` });

        try {
            const response = await fetch("/api/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    source: activeFile.content,
                    filename: activeFile.name,
                    existingHash: compileResult.hash,
                    contractId: deployResult?.contractId,
                }),
            });
            const result: VerifyResult = await response.json();
            setVerifyResult(result);

            if (result.verified) {
                setBuildStatus("verified");
                addLog({ type: "success", msg: "Verification passed!" });
                addLog({ type: "info", msg: `  Deterministic build confirmed: ${result.hash.slice(0, 16)}...` });
                if (result.onChainMatch !== undefined) {
                    addLog({ type: result.onChainMatch ? "success" : "warning", msg: `  On-chain: ${result.onChainMatch ? "matches" : "mismatch"}` });
                }
            } else {
                setBuildStatus("error");
                addLog({ type: "error", msg: "Verification failed:" });
                result.errors?.forEach((e) => addLog({ type: "error", msg: `  ${e}` }));
            }
        } catch (err) {
            setBuildStatus("error");
            addLog({ type: "error", msg: `Verify request failed: ${err instanceof Error ? err.message : "Network error"}` });
        }
    }, [activeFile, compileResult, deployResult, addLog]);

    // --- Deploy ---

    const deploy = useCallback(async () => {
        if (!compileResult?.wasm) {
            addLog({ type: "warning", msg: "Build the contract first before deploying." });
            return;
        }
        if (!activeFile) {
            addLog({ type: "error", msg: "No file selected." });
            return;
        }

        setBuildStatus("deploying");
        setDeployResult(null);
        addLog({ type: "deploying", msg: `Deploying ${activeFile.name.replace(".sol", "")} to Stellar testnet...` });

        try {
            const response = await fetch("/api/deploy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wasm: compileResult.wasm,
                    contractName: activeFile.name.replace(".sol", ""),
                }),
            });
            const result: DeployResult = await response.json();
            setDeployResult(result);

            if (result.success) {
                setBuildStatus("deployed");
                addLog({ type: "success", msg: `Deployed successfully!` });
                addLog({ type: "info", msg: `  Contract ID: ${result.contractId}` });
                addLog({ type: "info", msg: `  Explorer: ${result.explorerUrl}` });
            } else {
                setBuildStatus("error");
                addLog({ type: "error", msg: `Deployment failed: ${result.error}` });
            }
        } catch (err) {
            setBuildStatus("error");
            addLog({ type: "error", msg: `Deploy request failed: ${err instanceof Error ? err.message : "Network error"}` });
        }
    }, [activeFile, compileResult, addLog]);

    // --- Wallet ---

    const connectWallet = useCallback(async () => {
        addLog({ type: "system", msg: "Connecting wallet..." });
        try {
            if (typeof window !== "undefined" && (window as any).ethereum) {
                // Add TVA network to MetaMask
                const TVA_CHAIN_ID_HEX = "0x54564100";
                try {
                    await (window as any).ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: TVA_CHAIN_ID_HEX,
                            chainName: "TVA Testnet",
                            nativeCurrency: { name: "XLM", symbol: "XLM", decimals: 18 },
                            rpcUrls: [window.location.origin + "/api/rpc"],
                            blockExplorerUrls: [window.location.origin + "/explorer"],
                        }],
                    });
                } catch { /* network may already exist */ }

                // Switch to TVA network
                try {
                    await (window as any).ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: TVA_CHAIN_ID_HEX }],
                    });
                } catch { /* user rejected switch */ }

                const accounts = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
                if (accounts && accounts.length > 0) {
                    setWalletAddress(accounts[0]);
                    // Get balance
                    const balance = await (window as any).ethereum.request({
                        method: "eth_getBalance",
                        params: [accounts[0], "latest"],
                    });
                    const balanceInEth = parseInt(balance, 16) / 1e18;
                    setWalletBalance(balanceInEth.toFixed(4));
                    addLog({ type: "success", msg: `Wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}` });
                    addLog({ type: "info", msg: "Network: TVA Testnet (Stellar)" });
                }
            } else {
                addLog({ type: "warning", msg: "No wallet detected. Install MetaMask or a compatible wallet." });
            }
        } catch (err) {
            addLog({ type: "error", msg: `Wallet connection failed: ${err instanceof Error ? err.message : "Unknown error"}` });
        }
    }, [addLog]);

    const disconnectWallet = useCallback(() => {
        setWalletAddress(null);
        setWalletBalance(null);
        addLog({ type: "system", msg: "Wallet disconnected." });
    }, [addLog]);

    // --- Context ---

    const contextValue: ProjectContextType = {
        project,
        activeFileId,
        activeFile,
        setActiveFileId,
        updateFileContent,
        createFile,
        renameFile,
        deleteFile,
        createFolder,
        deleteFolder,
        logs,
        addLog,
        clearLogs,
        buildStatus,
        compileResult,
        verifyResult,
        deployResult,
        compile,
        verify,
        deploy,
        walletAddress,
        walletBalance,
        isWalletConnected,
        connectWallet,
        disconnectWallet,
    };

    return (
        <ProjectContext.Provider value={contextValue}>
            {children}
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
