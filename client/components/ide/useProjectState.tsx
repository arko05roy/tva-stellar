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

export interface ABIInput {
    name: string;
    type: string;
}

export interface ABIFunction {
    name: string;
    type: "function" | "constructor" | "event";
    inputs: ABIInput[];
    outputs?: ABIInput[];
    stateMutability?: "pure" | "view" | "nonpayable" | "payable";
}

export interface FunctionCallResult {
    success: boolean;
    result?: any;
    error?: string;
    txHash?: string;
    gasUsed?: string;
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

// --- Solidity Templates ---

export type SolidityTemplate = "blank" | "counter" | "greeter" | "erc20" | "storage";

export const SOLIDITY_TEMPLATES: Record<SolidityTemplate, { name: string; description: string; defaultFileName: string; content: string }> = {
    blank: {
        name: "Blank Contract",
        description: "Empty contract scaffold",
        defaultFileName: "MyContract.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {

}
`
    },
    counter: {
        name: "Counter",
        description: "Simple counter with increment/decrement",
        defaultFileName: "Counter.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint256 private count;

    function increment() public {
        count += 1;
    }

    function decrement() public {
        require(count > 0, "Counter: cannot decrement below zero");
        count -= 1;
    }

    function get() public view returns (uint256) {
        return count;
    }
}
`
    },
    greeter: {
        name: "Greeter",
        description: "Store and retrieve a greeting message",
        defaultFileName: "Greeter.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Greeter {
    string private greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
}
`
    },
    erc20: {
        name: "ERC20 Token",
        description: "Basic ERC20 token implementation",
        defaultFileName: "Token.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * 10 ** decimals;
        balanceOf[msg.sender] = totalSupply;
    }

    function transfer(address to, uint256 amount) public returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) public returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        emit Transfer(from, to, amount);
        return true;
    }
}
`
    },
    storage: {
        name: "Simple Storage",
        description: "Store and retrieve a single value",
        defaultFileName: "Storage.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Storage {
    uint256 private value;

    event ValueChanged(uint256 newValue);

    function store(uint256 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function retrieve() public view returns (uint256) {
        return value;
    }
}
`
    }
};

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
    createFile: (name: string, parentFolderId?: string, template?: SolidityTemplate) => void;
    createSolidityFile: (template: SolidityTemplate, parentFolderId?: string) => void;
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
    // Contract Interaction
    callContractFunction: (functionName: string, args: Record<string, string>, isView: boolean) => Promise<FunctionCallResult>;
    getContractFunctions: () => ABIFunction[];
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

    const createFile = useCallback((name: string, parentFolderId?: string, template?: SolidityTemplate) => {
        let content = "";
        if (name.endsWith(".sol")) {
            if (template && SOLIDITY_TEMPLATES[template]) {
                content = SOLIDITY_TEMPLATES[template].content;
                // Replace contract name with the file name
                const contractName = name.replace(".sol", "");
                content = content.replace(/contract \w+/g, `contract ${contractName}`);
            } else {
                content = `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract ${name.replace(".sol", "")} {\n    \n}\n`;
            }
        }
        const newFile: File = {
            id: genId(),
            name,
            type: getFileType(name),
            content,
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

    const createSolidityFile = useCallback((template: SolidityTemplate, parentFolderId?: string) => {
        const templateData = SOLIDITY_TEMPLATES[template];
        createFile(templateData.defaultFileName, parentFolderId, template);
    }, [createFile]);

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
        const contractName = activeFile.name.replace(".sol", "");
        addLog({ type: "deploying", msg: `Deploying ${contractName} to Stellar testnet...` });

        try {
            // Extract constructor args from ABI
            const constructorArgs: Record<string, string> = {};
            if (compileResult.abi && Array.isArray(compileResult.abi)) {
                const constructorEntry = (compileResult.abi as Array<{ type: string; inputs?: Array<{ name: string; type: string }> }>)
                    .find((entry) => entry.type === "constructor");
                if (constructorEntry?.inputs) {
                    for (const input of constructorEntry.inputs) {
                        // Provide sensible defaults based on type
                        const paramName = input.name.startsWith("_") ? input.name : `_${input.name}`;
                        if (input.type === "string") {
                            constructorArgs[paramName] = `Hello from ${contractName}`;
                        } else if (input.type.startsWith("uint") || input.type.startsWith("int")) {
                            constructorArgs[paramName] = "0";
                        } else if (input.type === "bool") {
                            constructorArgs[paramName] = "false";
                        } else if (input.type === "address") {
                            constructorArgs[paramName] = "0x0000000000000000000000000000000000000000";
                        } else {
                            constructorArgs[paramName] = "0";
                        }
                    }
                    if (Object.keys(constructorArgs).length > 0) {
                        addLog({ type: "info", msg: `  Constructor args: ${Object.entries(constructorArgs).map(([k, v]) => `${k}=${v}`).join(", ")}` });
                    }
                }
            }

            const response = await fetch("/api/deploy", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    wasm: compileResult.wasm,
                    contractName,
                    ...(Object.keys(constructorArgs).length > 0 && { constructorArgs }),
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
            const ethereum = typeof window !== "undefined" ? (window as any).ethereum : null;
            if (ethereum) {
                // Add TVA network to MetaMask
                const TVA_CHAIN_ID_HEX = "0x54564100";
                try {
                    await ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: TVA_CHAIN_ID_HEX,
                            chainName: "TVA Testnet",
                            nativeCurrency: { name: "XLM", symbol: "XLM", decimals: 18 },
                            rpcUrls: [process.env.NEXT_PUBLIC_TVA_RPC_URL || "http://localhost:8545"],
                            blockExplorerUrls: [window.location.origin + "/explorer"],
                        }],
                    });
                } catch { /* network may already exist */ }

                // Switch to TVA network
                try {
                    await ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: TVA_CHAIN_ID_HEX }],
                    });
                } catch { /* user rejected switch */ }

                const accounts = await ethereum.request({ method: "eth_requestAccounts" });
                if (accounts && accounts.length > 0) {
                    setWalletAddress(accounts[0]);
                    // Get balance
                    try {
                        const balance = await ethereum.request({
                            method: "eth_getBalance",
                            params: [accounts[0], "latest"],
                        });
                        const balanceInEth = parseInt(balance, 16) / 1e18;
                        setWalletBalance(balanceInEth.toFixed(4));
                    } catch {
                        setWalletBalance("0.0000");
                    }
                    addLog({ type: "success", msg: `Wallet connected: ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}` });
                    addLog({ type: "info", msg: "Network: TVA Testnet (Stellar)" });
                }
            } else {
                // Demo mode: generate a deterministic demo address
                const demoAddress = "0xTVA" + Array.from({ length: 36 }, (_, i) => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
                setWalletAddress(demoAddress);
                setWalletBalance("1000.0000");
                addLog({ type: "success", msg: `Demo wallet connected: ${demoAddress.slice(0, 6)}...${demoAddress.slice(-4)}` });
                addLog({ type: "info", msg: "Network: TVA Testnet (Demo Mode - no MetaMask detected)" });
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

    // --- Contract Interaction ---

    const getContractFunctions = useCallback((): ABIFunction[] => {
        if (!compileResult?.abi || !Array.isArray(compileResult.abi)) return [];
        return (compileResult.abi as ABIFunction[]).filter(
            (entry) => entry.type === "function"
        );
    }, [compileResult]);

    const callContractFunction = useCallback(async (
        functionName: string,
        args: Record<string, string>,
        isView: boolean
    ): Promise<FunctionCallResult> => {
        if (!deployResult?.contractId) {
            return { success: false, error: "No contract deployed" };
        }

        const argsArray = Object.values(args);
        addLog({
            type: isView ? "info" : "system",
            msg: `Calling ${functionName}(${argsArray.join(", ")})...`
        });

        try {
            const response = await fetch("/api/call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contractId: deployResult.contractId,
                    functionName,
                    args: argsArray,
                    isView,
                }),
            });

            const result = await response.json();

            if (result.success) {
                if (isView) {
                    addLog({ type: "success", msg: `↳ ${functionName} returned: ${JSON.stringify(result.result)}` });
                } else {
                    addLog({ type: "success", msg: `↳ Transaction successful` });
                    if (result.txHash) {
                        addLog({ type: "info", msg: `  TX: ${result.txHash.slice(0, 16)}...` });
                    }
                }
                return result;
            } else {
                addLog({ type: "error", msg: `↳ ${functionName} failed: ${result.error}` });
                return result;
            }
        } catch (err) {
            const error = err instanceof Error ? err.message : "Network error";
            addLog({ type: "error", msg: `↳ Call failed: ${error}` });
            return { success: false, error };
        }
    }, [deployResult, addLog]);

    // --- Context ---

    const contextValue: ProjectContextType = {
        project,
        activeFileId,
        activeFile,
        setActiveFileId,
        updateFileContent,
        createFile,
        createSolidityFile,
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
        callContractFunction,
        getContractFunctions,
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
