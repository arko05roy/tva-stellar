"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

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

export type SolidityTemplate = "blank" | "counter" | "greeter" | "erc20" | "erc721" | "erc1155" | "storage";

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
    uint64 private persistent count;

    function increment() public {
        count += 1;
    }

    function decrement() public {
        if (count == 0) {
            return;
        }
        count -= 1;
    }

    function get() public view returns (uint64) {
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
    string private persistent greeting;

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

// Soroban-compatible ERC20 Token
// Note: Events with indexed address and reading uninitialized
// mapping entries are not supported on Soroban.
contract Token {
    string public instance name;
    string public instance symbol;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
    }

    function mint(uint128 amount) public {
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        totalSupply -= amount;
        ownerBalance -= amount;
    }

    function getOwnerBalance() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    erc721: {
        name: "ERC721 NFT",
        description: "Basic NFT token implementation",
        defaultFileName: "NFT.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Soroban-compatible ERC721 NFT
// Simplified implementation for Soroban compatibility.
contract NFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalMinted;
    uint128 public persistent nextTokenId;

    // Track ownership count per address (simplified)
    uint128 public persistent ownerTokenCount;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalMinted = 0;
        nextTokenId = 1;
        ownerTokenCount = 0;
    }

    function mint() public returns (uint128) {
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalMinted += 1;
        ownerTokenCount += 1;
        return tokenId;
    }

    function burn(uint128 tokenId) public {
        if (ownerTokenCount == 0) {
            return;
        }
        totalMinted -= 1;
        ownerTokenCount -= 1;
    }

    function balanceOf() public view returns (uint128) {
        return ownerTokenCount;
    }

    function totalSupply() public view returns (uint128) {
        return totalMinted;
    }

    function getNextTokenId() public view returns (uint128) {
        return nextTokenId;
    }
}
`
    },
    erc1155: {
        name: "ERC1155 Multi-Token",
        description: "Multi-token standard implementation",
        defaultFileName: "MultiToken.sol",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

// Soroban-compatible ERC1155 Multi-Token
// Simplified implementation for Soroban compatibility.
contract MultiToken {
    string public instance name;
    address public instance owner;

    // Simplified balance tracking for token IDs 1, 2, 3
    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent balance3;

    constructor(string memory _name) {
        name = _name;
        owner = msg.sender;
        balance1 = 0;
        balance2 = 0;
        balance3 = 0;
    }

    function mint(uint128 tokenId, uint128 amount) public {
        if (tokenId == 1) {
            balance1 += amount;
        } else if (tokenId == 2) {
            balance2 += amount;
        } else if (tokenId == 3) {
            balance3 += amount;
        }
    }

    function burn(uint128 tokenId, uint128 amount) public {
        if (tokenId == 1 && balance1 >= amount) {
            balance1 -= amount;
        } else if (tokenId == 2 && balance2 >= amount) {
            balance2 -= amount;
        } else if (tokenId == 3 && balance3 >= amount) {
            balance3 -= amount;
        }
    }

    function balanceOf(uint128 tokenId) public view returns (uint128) {
        if (tokenId == 1) {
            return balance1;
        } else if (tokenId == 2) {
            return balance2;
        } else if (tokenId == 3) {
            return balance3;
        }
        return 0;
    }

    function mintBatch(uint128 amount1, uint128 amount2, uint128 amount3) public {
        balance1 += amount1;
        balance2 += amount2;
        balance3 += amount3;
    }

    function getTotalBalance() public view returns (uint128) {
        return balance1 + balance2 + balance3;
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
    uint128 private persistent value;

    event ValueChanged(uint128 newValue);

    function store(uint128 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function retrieve() public view returns (uint128) {
        return value;
    }
}
`
    }
};

// --- OpenZeppelin Templates ---

export type OpenZeppelinTemplate =
    // ERC20 Tokens
    | "oz-erc20"
    | "oz-erc20-burnable"
    | "oz-erc20-pausable"
    | "oz-erc20-capped"
    | "oz-erc20-snapshot"
    | "oz-erc20-votes"
    | "oz-erc20-flashmint"
    | "oz-erc20-wrapper"
    // ERC721 NFTs
    | "oz-erc721"
    | "oz-erc721-burnable"
    | "oz-erc721-enumerable"
    | "oz-erc721-uri"
    | "oz-erc721-royalty"
    | "oz-erc721-votes"
    // ERC1155 Multi-Token
    | "oz-erc1155"
    | "oz-erc1155-supply"
    | "oz-erc1155-uri"
    // ERC4626 Vault
    | "oz-erc4626"
    // Access Control
    | "oz-ownable"
    | "oz-ownable2step"
    | "oz-access-control"
    | "oz-access-enumerable"
    | "oz-governor"
    | "oz-votes"
    // Security
    | "oz-pausable"
    | "oz-reentrancy-guard"
    | "oz-timelock"
    | "oz-escrow"
    | "oz-pull-payment"
    // Finance
    | "oz-payment-splitter"
    | "oz-vesting"
    // Utilities
    | "oz-counters"
    | "oz-multicall"
    | "oz-minimal-forwarder";

export const OPENZEPPELIN_TEMPLATES: Record<OpenZeppelinTemplate, { name: string; description: string; defaultFileName: string; category: string; content: string }> = {
    "oz-erc20": {
        name: "ERC20",
        description: "Standard fungible token",
        defaultFileName: "MyToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Token (Soroban-compatible)
/// @notice OpenZeppelin-style ERC20 adapted for Soroban
/// @dev No mappings, no indexed events, explicit storage only
contract MyToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function transfer(uint128 amount) public returns (bool) {
        if (ownerBalance < amount) {
            return false;
        }
        ownerBalance -= amount;
        return true;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        ownerBalance -= amount;
        totalSupply -= amount;
    }
}
`
    },
    "oz-erc20-burnable": {
        name: "ERC20 Burnable",
        description: "ERC20 with burn functionality",
        defaultFileName: "BurnableToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Burnable (Soroban-compatible)
/// @notice Fungible token with burn and burnFrom functionality
/// @dev No mappings, no indexed events, explicit storage only
contract BurnableToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;
    uint128 public persistent totalBurned;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        totalBurned = 0;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        ownerBalance -= amount;
        totalSupply -= amount;
        totalBurned += amount;
    }

    function getTotalBurned() public view returns (uint128) {
        return totalBurned;
    }
}
`
    },
    "oz-erc20-pausable": {
        name: "ERC20 Pausable",
        description: "ERC20 with pause functionality",
        defaultFileName: "PausableToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Pausable (Soroban-compatible)
/// @notice Fungible token with emergency pause functionality
/// @dev No mappings, no indexed events, explicit storage only
contract PausableToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;
    bool public instance paused;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        paused = false;
    }

    function pause() public {
        if (msg.sender != owner) {
            return;
        }
        paused = true;
    }

    function unpause() public {
        if (msg.sender != owner) {
            return;
        }
        paused = false;
    }

    function transfer(uint128 amount) public returns (bool) {
        if (paused) {
            return false;
        }
        if (ownerBalance < amount) {
            return false;
        }
        ownerBalance -= amount;
        return true;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        if (paused) {
            return;
        }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc721": {
        name: "ERC721",
        description: "Standard NFT token",
        defaultFileName: "MyNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 NFT (Soroban-compatible)
/// @notice OpenZeppelin-style NFT adapted for Soroban
/// @dev No mappings, no indexed events, explicit storage only
contract MyNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;
    string private instance baseURI;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
    }

    function setBaseURI(string memory _baseURI) public {
        if (msg.sender != owner) {
            return;
        }
        baseURI = _baseURI;
    }

    function getBaseURI() public view returns (string memory) {
        return baseURI;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc721-burnable": {
        name: "ERC721 Burnable",
        description: "NFT with burn functionality",
        defaultFileName: "BurnableNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 Burnable (Soroban-compatible)
/// @notice NFT with burn functionality
/// @dev No mappings, no indexed events, explicit storage only
contract BurnableNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;
    uint128 public persistent burnedCount;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
        burnedCount = 0;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function burn() public {
        if (ownerBalance == 0) {
            return;
        }
        ownerBalance -= 1;
        totalSupply -= 1;
        burnedCount += 1;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function getBurnedCount() public view returns (uint128) {
        return burnedCount;
    }
}
`
    },
    "oz-erc721-enumerable": {
        name: "ERC721 Enumerable",
        description: "NFT with enumeration support",
        defaultFileName: "EnumerableNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 Enumerable (Soroban-compatible)
/// @notice NFT with token enumeration support
/// @dev No mappings, explicit token slots for enumeration
contract EnumerableNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;

    // Explicit token slots (max 5 tokens for demo)
    uint128 public persistent token0;
    uint128 public persistent token1;
    uint128 public persistent token2;
    uint128 public persistent token3;
    uint128 public persistent token4;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
        token0 = 0;
        token1 = 0;
        token2 = 0;
        token3 = 0;
        token4 = 0;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        if (totalSupply >= 5) {
            return 0;
        }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;

        if (totalSupply == 0) token0 = tokenId;
        else if (totalSupply == 1) token1 = tokenId;
        else if (totalSupply == 2) token2 = tokenId;
        else if (totalSupply == 3) token3 = tokenId;
        else if (totalSupply == 4) token4 = tokenId;

        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function tokenByIndex(uint128 index) public view returns (uint128) {
        if (index >= totalSupply) {
            return 0;
        }
        if (index == 0) return token0;
        if (index == 1) return token1;
        if (index == 2) return token2;
        if (index == 3) return token3;
        if (index == 4) return token4;
        return 0;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc1155": {
        name: "ERC1155",
        description: "Multi-token standard",
        defaultFileName: "MyMultiToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC1155 Multi-Token (Soroban-compatible)
/// @notice Multi-token standard with multiple token types
/// @dev No mappings, explicit balance slots for each token ID
contract MyMultiToken {
    string public instance name;
    string public instance uri;
    address public instance owner;

    // Explicit balance slots for token IDs 0-4
    uint128 public persistent balance0;
    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent balance3;
    uint128 public persistent balance4;

    constructor(string memory _uri) {
        name = "MyMultiToken";
        uri = _uri;
        owner = msg.sender;
        balance0 = 0;
        balance1 = 0;
        balance2 = 0;
        balance3 = 0;
        balance4 = 0;
    }

    function setURI(string memory _uri) public {
        if (msg.sender != owner) {
            return;
        }
        uri = _uri;
    }

    function mint(uint128 id, uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        if (id == 0) balance0 += amount;
        else if (id == 1) balance1 += amount;
        else if (id == 2) balance2 += amount;
        else if (id == 3) balance3 += amount;
        else if (id == 4) balance4 += amount;
    }

    function burn(uint128 id, uint128 amount) public {
        if (id == 0 && balance0 >= amount) balance0 -= amount;
        else if (id == 1 && balance1 >= amount) balance1 -= amount;
        else if (id == 2 && balance2 >= amount) balance2 -= amount;
        else if (id == 3 && balance3 >= amount) balance3 -= amount;
        else if (id == 4 && balance4 >= amount) balance4 -= amount;
    }

    function balanceOf(uint128 id) public view returns (uint128) {
        if (id == 0) return balance0;
        if (id == 1) return balance1;
        if (id == 2) return balance2;
        if (id == 3) return balance3;
        if (id == 4) return balance4;
        return 0;
    }

    function getTotalBalance() public view returns (uint128) {
        return balance0 + balance1 + balance2 + balance3 + balance4;
    }
}
`
    },
    "oz-erc1155-supply": {
        name: "ERC1155 Supply",
        description: "ERC1155 with supply tracking",
        defaultFileName: "SupplyToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC1155 with Supply Tracking (Soroban-compatible)
/// @notice Multi-token with per-token and total supply tracking
/// @dev No mappings, explicit slots for balances and supplies
contract SupplyToken {
    string public instance name;
    string public instance uri;
    address public instance owner;

    // Balances and supplies for token IDs 0-2
    uint128 public persistent balance0;
    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent supply0;
    uint128 public persistent supply1;
    uint128 public persistent supply2;
    uint128 public persistent totalSupplyAll;

    constructor(string memory _uri) {
        name = "SupplyToken";
        uri = _uri;
        owner = msg.sender;
        balance0 = 0;
        balance1 = 0;
        balance2 = 0;
        supply0 = 0;
        supply1 = 0;
        supply2 = 0;
        totalSupplyAll = 0;
    }

    function mint(uint128 id, uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        if (id == 0) { balance0 += amount; supply0 += amount; }
        else if (id == 1) { balance1 += amount; supply1 += amount; }
        else if (id == 2) { balance2 += amount; supply2 += amount; }
        totalSupplyAll += amount;
    }

    function burn(uint128 id, uint128 amount) public {
        if (id == 0 && balance0 >= amount) {
            balance0 -= amount;
            supply0 -= amount;
            totalSupplyAll -= amount;
        } else if (id == 1 && balance1 >= amount) {
            balance1 -= amount;
            supply1 -= amount;
            totalSupplyAll -= amount;
        } else if (id == 2 && balance2 >= amount) {
            balance2 -= amount;
            supply2 -= amount;
            totalSupplyAll -= amount;
        }
    }

    function balanceOf(uint128 id) public view returns (uint128) {
        if (id == 0) return balance0;
        if (id == 1) return balance1;
        if (id == 2) return balance2;
        return 0;
    }

    function totalSupply(uint128 id) public view returns (uint128) {
        if (id == 0) return supply0;
        if (id == 1) return supply1;
        if (id == 2) return supply2;
        return 0;
    }

    function exists(uint128 id) public view returns (bool) {
        if (id == 0) return supply0 > 0;
        if (id == 1) return supply1 > 0;
        if (id == 2) return supply2 > 0;
        return false;
    }
}
`
    },
    "oz-ownable": {
        name: "Ownable",
        description: "Basic access control",
        defaultFileName: "OwnableContract.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Ownable (Soroban-compatible)
/// @notice Basic ownership management with two-step transfer
/// @dev No require statements, uses if/return pattern
contract OwnableContract {
    address public instance owner;
    address public instance pendingOwner;
    bool public instance hasPendingOwner;

    constructor() {
        owner = msg.sender;
        pendingOwner = address(0);
        hasPendingOwner = false;
    }

    function transferOwnership(address newOwner) public {
        if (msg.sender != owner) {
            return;
        }
        pendingOwner = newOwner;
        hasPendingOwner = true;
    }

    function acceptOwnership() public {
        if (!hasPendingOwner) {
            return;
        }
        if (msg.sender != pendingOwner) {
            return;
        }
        owner = pendingOwner;
        pendingOwner = address(0);
        hasPendingOwner = false;
    }

    function renounceOwnership() public {
        if (msg.sender != owner) {
            return;
        }
        owner = address(0);
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function isOwner() public view returns (bool) {
        return msg.sender == owner;
    }
}
`
    },
    "oz-access-control": {
        name: "Access Control",
        description: "Role-based access control",
        defaultFileName: "AccessControlled.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Access Control (Soroban-compatible)
/// @notice Role-based permissions with admin, minter, pauser roles
/// @dev No mappings, explicit role tracking
contract AccessControlled {
    address public instance admin;
    address public instance minter;
    address public instance pauser;
    bool public instance minterSet;
    bool public instance pauserSet;

    constructor() {
        admin = msg.sender;
        minter = address(0);
        pauser = address(0);
        minterSet = false;
        pauserSet = false;
    }

    function grantMinterRole(address account) public {
        if (msg.sender != admin) {
            return;
        }
        minter = account;
        minterSet = true;
    }

    function grantPauserRole(address account) public {
        if (msg.sender != admin) {
            return;
        }
        pauser = account;
        pauserSet = true;
    }

    function revokeMinterRole() public {
        if (msg.sender != admin) {
            return;
        }
        minter = address(0);
        minterSet = false;
    }

    function revokePauserRole() public {
        if (msg.sender != admin) {
            return;
        }
        pauser = address(0);
        pauserSet = false;
    }

    function hasMinterRole(address account) public view returns (bool) {
        if (!minterSet) {
            return false;
        }
        if (minter == account) {
            return true;
        }
        return false;
    }

    function hasPauserRole(address account) public view returns (bool) {
        if (!pauserSet) {
            return false;
        }
        if (pauser == account) {
            return true;
        }
        return false;
    }

    function hasAdminRole(address account) public view returns (bool) {
        if (admin == account) {
            return true;
        }
        return false;
    }
}
`
    },
    "oz-pausable": {
        name: "Pausable",
        description: "Emergency stop mechanism",
        defaultFileName: "PausableContract.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Pausable (Soroban-compatible)
/// @notice Emergency pause mechanism for contract operations
/// @dev No require statements, uses if/return pattern
contract PausableContract {
    address public instance owner;
    bool public instance paused;
    uint128 public persistent value;

    constructor() {
        owner = msg.sender;
        paused = false;
        value = 0;
    }

    function pause() public {
        if (msg.sender != owner) {
            return;
        }
        if (paused) {
            return;
        }
        paused = true;
    }

    function unpause() public {
        if (msg.sender != owner) {
            return;
        }
        if (!paused) {
            return;
        }
        paused = false;
    }

    function isPaused() public view returns (bool) {
        return paused;
    }

    function setValue(uint128 _value) public {
        if (paused) {
            return;
        }
        value = _value;
    }

    function getValue() public view returns (uint128) {
        return value;
    }
}
`
    },
    "oz-reentrancy-guard": {
        name: "Reentrancy Guard",
        description: "Prevent reentrancy attacks",
        defaultFileName: "SecureContract.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Reentrancy Guard (Soroban-compatible)
/// @notice Prevents reentrant calls to protected functions
/// @dev Uses lock flag pattern instead of modifier
contract SecureContract {
    address public instance owner;
    uint128 public persistent balance;
    bool public instance locked;

    constructor() {
        owner = msg.sender;
        balance = 0;
        locked = false;
    }

    function deposit(uint128 amount) public {
        if (locked) {
            return;
        }
        locked = true;
        balance += amount;
        locked = false;
    }

    function withdraw(uint128 amount) public {
        if (locked) {
            return;
        }
        if (balance < amount) {
            return;
        }
        locked = true;
        balance -= amount;
        locked = false;
    }

    function getBalance() public view returns (uint128) {
        return balance;
    }

    function isLocked() public view returns (bool) {
        return locked;
    }
}
`
    },
    "oz-erc20-capped": {
        name: "ERC20 Capped",
        description: "ERC20 with max supply cap",
        defaultFileName: "CappedToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Capped (Soroban-compatible)
/// @notice Fungible token with maximum supply cap
/// @dev No mappings, explicit storage, cap enforcement
contract CappedToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    uint128 public instance cap;
    address public instance owner;
    uint128 public persistent ownerBalance;

    constructor(string memory _name, string memory _symbol, uint128 _cap) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        cap = _cap;
        totalSupply = 0;
        owner = msg.sender;
        ownerBalance = 0;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        if (totalSupply + amount > cap) {
            return;
        }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        ownerBalance -= amount;
        totalSupply -= amount;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function remainingCap() public view returns (uint128) {
        return cap - totalSupply;
    }

    function getCap() public view returns (uint128) {
        return cap;
    }
}
`
    },
    "oz-erc721-uri": {
        name: "ERC721 URI Storage",
        description: "NFT with per-token URIs",
        defaultFileName: "URIStorageNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 URI Storage (Soroban-compatible)
/// @notice NFT with individual token URI storage
/// @dev Explicit URI slots for first 5 tokens
contract URIStorageNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;

    // Per-token URIs (slots for tokens 1-5)
    string public instance uri1;
    string public instance uri2;
    string public instance uri3;
    string public instance uri4;
    string public instance uri5;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
        uri1 = "";
        uri2 = "";
        uri3 = "";
        uri4 = "";
        uri5 = "";
    }

    function mint(string memory _uri) public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        if (nextTokenId > 5) {
            return 0;
        }
        uint128 tokenId = nextTokenId;

        if (tokenId == 1) uri1 = _uri;
        else if (tokenId == 2) uri2 = _uri;
        else if (tokenId == 3) uri3 = _uri;
        else if (tokenId == 4) uri4 = _uri;
        else if (tokenId == 5) uri5 = _uri;

        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function tokenURI(uint128 tokenId) public view returns (string memory) {
        if (tokenId == 1) return uri1;
        if (tokenId == 2) return uri2;
        if (tokenId == 3) return uri3;
        if (tokenId == 4) return uri4;
        if (tokenId == 5) return uri5;
        return "";
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-timelock": {
        name: "Timelock",
        description: "Time-delayed execution",
        defaultFileName: "Timelock.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Timelock (Soroban-compatible)
/// @notice Time-delayed value changes for governance
/// @dev Uses block timestamp for delays
contract Timelock {
    address public instance owner;
    uint128 public instance delay;
    uint128 public persistent pendingValue;
    uint128 public persistent currentValue;
    uint128 public persistent unlockTime;
    bool public instance hasPending;

    constructor(uint128 _delay) {
        owner = msg.sender;
        delay = _delay;
        pendingValue = 0;
        currentValue = 0;
        unlockTime = 0;
        hasPending = false;
    }

    function queueValue(uint128 _value, uint128 currentTime) public {
        if (msg.sender != owner) {
            return;
        }
        pendingValue = _value;
        unlockTime = currentTime + delay;
        hasPending = true;
    }

    function executeValue(uint128 currentTime) public {
        if (msg.sender != owner) {
            return;
        }
        if (!hasPending) {
            return;
        }
        if (currentTime < unlockTime) {
            return;
        }
        currentValue = pendingValue;
        hasPending = false;
    }

    function cancelPending() public {
        if (msg.sender != owner) {
            return;
        }
        hasPending = false;
        pendingValue = 0;
    }

    function getValue() public view returns (uint128) {
        return currentValue;
    }

    function getTimeRemaining(uint128 currentTime) public view returns (uint128) {
        if (!hasPending) {
            return 0;
        }
        if (currentTime >= unlockTime) {
            return 0;
        }
        return unlockTime - currentTime;
    }
}
`
    },
    "oz-escrow": {
        name: "Escrow",
        description: "Secure fund holding",
        defaultFileName: "Escrow.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Escrow (Soroban-compatible)
/// @notice Holds funds until conditions are met
/// @dev Simplified escrow with single beneficiary
contract Escrow {
    address public instance owner;
    address public instance beneficiary;
    uint128 public persistent depositAmount;
    bool public instance isDeposited;
    bool public instance isReleased;
    bool public instance isRefunded;

    constructor(address _beneficiary) {
        owner = msg.sender;
        beneficiary = _beneficiary;
        depositAmount = 0;
        isDeposited = false;
        isReleased = false;
        isRefunded = false;
    }

    function deposit(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        if (isDeposited) {
            return;
        }
        depositAmount = amount;
        isDeposited = true;
    }

    function release() public {
        if (msg.sender != owner) {
            return;
        }
        if (!isDeposited) {
            return;
        }
        if (isReleased || isRefunded) {
            return;
        }
        isReleased = true;
    }

    function refund() public {
        if (msg.sender != owner) {
            return;
        }
        if (!isDeposited) {
            return;
        }
        if (isReleased || isRefunded) {
            return;
        }
        isRefunded = true;
    }

    function getStatus() public view returns (string memory) {
        if (isReleased) return "released";
        if (isRefunded) return "refunded";
        if (isDeposited) return "deposited";
        return "empty";
    }

    function getAmount() public view returns (uint128) {
        return depositAmount;
    }
}
`
    },
    "oz-payment-splitter": {
        name: "Payment Splitter",
        description: "Split payments among payees",
        defaultFileName: "PaymentSplitter.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Payment Splitter (Soroban-compatible)
/// @notice Split payments among multiple recipients
/// @dev Supports up to 3 payees with configurable shares
contract PaymentSplitter {
    address public instance owner;
    address public instance payee1;
    address public instance payee2;
    address public instance payee3;
    uint128 public instance shares1;
    uint128 public instance shares2;
    uint128 public instance shares3;
    uint128 public instance totalShares;
    uint128 public persistent totalReceived;
    uint128 public persistent released1;
    uint128 public persistent released2;
    uint128 public persistent released3;

    constructor(
        address _payee1, uint128 _shares1,
        address _payee2, uint128 _shares2,
        address _payee3, uint128 _shares3
    ) {
        owner = msg.sender;
        payee1 = _payee1;
        payee2 = _payee2;
        payee3 = _payee3;
        shares1 = _shares1;
        shares2 = _shares2;
        shares3 = _shares3;
        totalShares = _shares1 + _shares2 + _shares3;
        totalReceived = 0;
        released1 = 0;
        released2 = 0;
        released3 = 0;
    }

    function receivePayment(uint128 amount) public {
        totalReceived += amount;
    }

    function releasable(uint128 payeeNum) public view returns (uint128) {
        uint128 shares;
        uint128 released;
        if (payeeNum == 1) { shares = shares1; released = released1; }
        else if (payeeNum == 2) { shares = shares2; released = released2; }
        else if (payeeNum == 3) { shares = shares3; released = released3; }
        else { return 0; }

        uint128 totalDue = (totalReceived * shares) / totalShares;
        if (totalDue <= released) {
            return 0;
        }
        return totalDue - released;
    }

    function release(uint128 payeeNum) public {
        uint128 amount = releasable(payeeNum);
        if (amount == 0) {
            return;
        }
        if (payeeNum == 1) released1 += amount;
        else if (payeeNum == 2) released2 += amount;
        else if (payeeNum == 3) released3 += amount;
    }

    function getTotalReleased() public view returns (uint128) {
        return released1 + released2 + released3;
    }
}
`
    },
    "oz-vesting": {
        name: "Vesting Wallet",
        description: "Token vesting schedule",
        defaultFileName: "VestingWallet.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Vesting Wallet (Soroban-compatible)
/// @notice Linear token vesting over time
/// @dev Uses block timestamp for vesting calculation
contract VestingWallet {
    address public instance owner;
    address public instance beneficiary;
    uint128 public instance start;
    uint128 public instance duration;
    uint128 public instance totalAmount;
    uint128 public persistent released;

    constructor(address _beneficiary, uint128 _startTime, uint128 _duration, uint128 _amount) {
        owner = msg.sender;
        beneficiary = _beneficiary;
        start = _startTime;
        duration = _duration;
        totalAmount = _amount;
        released = 0;
    }

    function vestedAmount(uint128 currentTime) public view returns (uint128) {
        if (currentTime < start) {
            return 0;
        }
        uint128 elapsed = currentTime - start;
        if (elapsed >= duration) {
            return totalAmount;
        }
        return (totalAmount * elapsed) / duration;
    }

    function releasable(uint128 currentTime) public view returns (uint128) {
        uint128 vested = vestedAmount(currentTime);
        if (vested <= released) {
            return 0;
        }
        return vested - released;
    }

    function release(uint128 currentTime) public {
        uint128 amount = releasable(currentTime);
        if (amount == 0) {
            return;
        }
        released += amount;
    }

    function getReleased() public view returns (uint128) {
        return released;
    }

    function getRemaining() public view returns (uint128) {
        return totalAmount - released;
    }

    function getProgress() public view returns (uint128) {
        if (totalAmount == 0) {
            return 0;
        }
        return (released * 100) / totalAmount;
    }
}
`
    },
    "oz-governor": {
        name: "Governor",
        description: "Simple governance voting",
        defaultFileName: "SimpleGovernor.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Simple Governor (Soroban-compatible)
/// @notice Basic proposal and voting system
/// @dev Supports single active proposal at a time
contract SimpleGovernor {
    address public instance owner;
    uint128 public persistent proposalCount;
    uint128 public instance votingPeriod;

    // Current proposal
    uint128 public persistent currentProposalId;
    string public instance proposalDescription;
    uint128 public persistent forVotes;
    uint128 public persistent againstVotes;
    uint128 public persistent proposalEnd;
    bool public instance proposalActive;
    bool public instance proposalExecuted;

    constructor(uint128 _votingPeriod) {
        owner = msg.sender;
        proposalCount = 0;
        votingPeriod = _votingPeriod;
        currentProposalId = 0;
        proposalDescription = "";
        forVotes = 0;
        againstVotes = 0;
        proposalEnd = 0;
        proposalActive = false;
        proposalExecuted = false;
    }

    function propose(string memory description, uint128 currentTime) public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        if (proposalActive) {
            return 0;
        }
        proposalCount += 1;
        currentProposalId = proposalCount;
        proposalDescription = description;
        forVotes = 0;
        againstVotes = 0;
        proposalEnd = currentTime + votingPeriod;
        proposalActive = true;
        proposalExecuted = false;
        return currentProposalId;
    }

    function voteFor(uint128 weight, uint128 currentTime) public {
        if (!proposalActive) {
            return;
        }
        if (currentTime >= proposalEnd) {
            return;
        }
        forVotes += weight;
    }

    function voteAgainst(uint128 weight, uint128 currentTime) public {
        if (!proposalActive) {
            return;
        }
        if (currentTime >= proposalEnd) {
            return;
        }
        againstVotes += weight;
    }

    function execute(uint128 currentTime) public {
        if (msg.sender != owner) {
            return;
        }
        if (!proposalActive) {
            return;
        }
        if (currentTime < proposalEnd) {
            return;
        }
        if (forVotes <= againstVotes) {
            return;
        }
        proposalActive = false;
        proposalExecuted = true;
    }

    function getProposalState(uint128 currentTime) public view returns (string memory) {
        if (!proposalActive && !proposalExecuted) return "none";
        if (proposalActive && currentTime < proposalEnd) return "active";
        if (proposalActive && currentTime >= proposalEnd) return "ended";
        if (proposalExecuted) return "executed";
        return "unknown";
    }
}
`
    },
    "oz-erc20-snapshot": {
        name: "ERC20 Snapshot",
        description: "Token with balance snapshots",
        defaultFileName: "SnapshotToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Snapshot (Soroban-compatible)
/// @notice Token with historical balance snapshots
/// @dev Stores up to 5 snapshots of balances
contract SnapshotToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    // Snapshot storage (up to 5 snapshots)
    uint128 public persistent snapshotCount;
    uint128 public persistent snapshot1Balance;
    uint128 public persistent snapshot2Balance;
    uint128 public persistent snapshot3Balance;
    uint128 public persistent snapshot4Balance;
    uint128 public persistent snapshot5Balance;
    uint128 public persistent snapshot1Id;
    uint128 public persistent snapshot2Id;
    uint128 public persistent snapshot3Id;
    uint128 public persistent snapshot4Id;
    uint128 public persistent snapshot5Id;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        snapshotCount = 0;
    }

    function snapshot() public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        if (snapshotCount >= 5) {
            return 0;
        }
        snapshotCount += 1;
        if (snapshotCount == 1) { snapshot1Balance = ownerBalance; snapshot1Id = snapshotCount; }
        else if (snapshotCount == 2) { snapshot2Balance = ownerBalance; snapshot2Id = snapshotCount; }
        else if (snapshotCount == 3) { snapshot3Balance = ownerBalance; snapshot3Id = snapshotCount; }
        else if (snapshotCount == 4) { snapshot4Balance = ownerBalance; snapshot4Id = snapshotCount; }
        else if (snapshotCount == 5) { snapshot5Balance = ownerBalance; snapshot5Id = snapshotCount; }
        return snapshotCount;
    }

    function balanceOfAt(uint128 snapshotId) public view returns (uint128) {
        if (snapshotId == 1) return snapshot1Balance;
        if (snapshotId == 2) return snapshot2Balance;
        if (snapshotId == 3) return snapshot3Balance;
        if (snapshotId == 4) return snapshot4Balance;
        if (snapshotId == 5) return snapshot5Balance;
        return 0;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) { return; }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) { return; }
        ownerBalance -= amount;
        totalSupply -= amount;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc20-votes": {
        name: "ERC20 Votes",
        description: "Token with voting power",
        defaultFileName: "VotesToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Votes (Soroban-compatible)
/// @notice Token with delegatable voting power
/// @dev Simplified delegation model
contract VotesToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    // Voting power tracking
    address public instance ownerDelegate;
    uint128 public persistent ownerVotingPower;
    bool public instance hasDelegated;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        ownerDelegate = msg.sender;
        ownerVotingPower = _initialSupply;
        hasDelegated = false;
    }

    function delegate(address delegatee) public {
        ownerDelegate = delegatee;
        hasDelegated = true;
    }

    function getVotes() public view returns (uint128) {
        return ownerVotingPower;
    }

    function delegates() public view returns (address) {
        return ownerDelegate;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) { return; }
        totalSupply += amount;
        ownerBalance += amount;
        ownerVotingPower += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) { return; }
        ownerBalance -= amount;
        totalSupply -= amount;
        if (ownerVotingPower >= amount) {
            ownerVotingPower -= amount;
        }
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc20-flashmint": {
        name: "ERC20 Flash Mint",
        description: "Token with flash loan support",
        defaultFileName: "FlashToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Flash Mint (Soroban-compatible)
/// @notice Token supporting flash loans
/// @dev Simplified flash loan mechanism
contract FlashToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    // Flash loan state
    uint128 public instance flashFee;
    uint128 public persistent maxFlashLoan;
    bool public instance flashLoanActive;
    uint128 public persistent totalFlashLoaned;
    uint128 public persistent totalFeesCollected;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply, uint128 _fee) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        flashFee = _fee;
        maxFlashLoan = _initialSupply;
        flashLoanActive = false;
        totalFlashLoaned = 0;
        totalFeesCollected = 0;
    }

    function getMaxFlashLoan() public view returns (uint128) {
        return maxFlashLoan;
    }

    function getFlashFee(uint128 amount) public view returns (uint128) {
        return (amount * flashFee) / 10000;
    }

    function initiateFlashLoan(uint128 amount) public returns (bool) {
        if (flashLoanActive) { return false; }
        if (amount > maxFlashLoan) { return false; }
        flashLoanActive = true;
        totalFlashLoaned += amount;
        return true;
    }

    function repayFlashLoan(uint128 amount, uint128 fee) public returns (bool) {
        if (!flashLoanActive) { return false; }
        flashLoanActive = false;
        totalFeesCollected += fee;
        ownerBalance += fee;
        totalSupply += fee;
        return true;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) { return; }
        totalSupply += amount;
        ownerBalance += amount;
        maxFlashLoan = totalSupply;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc20-wrapper": {
        name: "ERC20 Wrapper",
        description: "Wrapped token standard",
        defaultFileName: "WrappedToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC20 Wrapper (Soroban-compatible)
/// @notice Wraps underlying token 1:1
/// @dev Simplified wrapper without actual transfer
contract WrappedToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    // Wrapper state
    string public instance underlyingName;
    uint128 public persistent totalDeposited;
    uint128 public persistent totalWithdrawn;

    constructor(string memory _name, string memory _symbol, string memory _underlyingName) {
        name = _name;
        symbol = _symbol;
        underlyingName = _underlyingName;
        decimals = 7;
        totalSupply = 0;
        owner = msg.sender;
        ownerBalance = 0;
        totalDeposited = 0;
        totalWithdrawn = 0;
    }

    function depositFor(uint128 amount) public returns (bool) {
        totalSupply += amount;
        ownerBalance += amount;
        totalDeposited += amount;
        return true;
    }

    function withdrawTo(uint128 amount) public returns (bool) {
        if (ownerBalance < amount) { return false; }
        ownerBalance -= amount;
        totalSupply -= amount;
        totalWithdrawn += amount;
        return true;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function getUnderlying() public view returns (string memory) {
        return underlyingName;
    }
}
`
    },
    "oz-erc721-royalty": {
        name: "ERC721 Royalty",
        description: "NFT with EIP-2981 royalties",
        defaultFileName: "RoyaltyNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 Royalty (Soroban-compatible)
/// @notice NFT with EIP-2981 royalty support
/// @dev Default royalty for all tokens
contract RoyaltyNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;

    // Royalty info (basis points, e.g., 250 = 2.5%)
    address public instance royaltyReceiver;
    uint128 public instance royaltyBps;

    constructor(string memory _name, string memory _symbol, uint128 _royaltyBps) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        royaltyReceiver = msg.sender;
        royaltyBps = _royaltyBps;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) { return 0; }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function getRoyaltyAmount(uint128 salePrice) public view returns (uint128) {
        return (salePrice * royaltyBps) / 10000;
    }

    function getRoyaltyReceiver() public view returns (address) {
        return royaltyReceiver;
    }

    function setRoyaltyInfo(address receiver, uint128 bps) public {
        if (msg.sender != owner) { return; }
        royaltyReceiver = receiver;
        royaltyBps = bps;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function supportsInterface() public pure returns (bool) {
        return true; // Supports EIP-2981
    }
}
`
    },
    "oz-erc721-votes": {
        name: "ERC721 Votes",
        description: "NFT with voting power",
        defaultFileName: "VotingNFT.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC721 Votes (Soroban-compatible)
/// @notice NFT with delegatable voting power
/// @dev Each NFT = 1 vote
contract VotingNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;

    // Voting
    address public instance ownerDelegate;
    uint128 public persistent ownerVotingPower;
    bool public instance hasDelegated;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
        ownerDelegate = msg.sender;
        ownerVotingPower = 0;
        hasDelegated = false;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) { return 0; }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        ownerVotingPower += 1;
        return tokenId;
    }

    function delegate(address delegatee) public {
        ownerDelegate = delegatee;
        hasDelegated = true;
    }

    function getVotes() public view returns (uint128) {
        return ownerVotingPower;
    }

    function delegates() public view returns (address) {
        return ownerDelegate;
    }

    function burn() public {
        if (ownerBalance == 0) { return; }
        ownerBalance -= 1;
        totalSupply -= 1;
        if (ownerVotingPower > 0) {
            ownerVotingPower -= 1;
        }
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
`
    },
    "oz-erc1155-uri": {
        name: "ERC1155 URI Storage",
        description: "Multi-token with per-token URIs",
        defaultFileName: "URIMultiToken.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC1155 URI Storage (Soroban-compatible)
/// @notice Multi-token with per-token URI storage
/// @dev Explicit URI slots for token types 0-4
contract URIMultiToken {
    string public instance name;
    address public instance owner;

    // Balances
    uint128 public persistent balance0;
    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent balance3;
    uint128 public persistent balance4;

    // URIs
    string public instance uri0;
    string public instance uri1;
    string public instance uri2;
    string public instance uri3;
    string public instance uri4;

    constructor(string memory _name) {
        name = _name;
        owner = msg.sender;
        balance0 = 0;
        balance1 = 0;
        balance2 = 0;
        balance3 = 0;
        balance4 = 0;
        uri0 = "";
        uri1 = "";
        uri2 = "";
        uri3 = "";
        uri4 = "";
    }

    function setURI(uint128 id, string memory _uri) public {
        if (msg.sender != owner) { return; }
        if (id == 0) uri0 = _uri;
        else if (id == 1) uri1 = _uri;
        else if (id == 2) uri2 = _uri;
        else if (id == 3) uri3 = _uri;
        else if (id == 4) uri4 = _uri;
    }

    function uri(uint128 id) public view returns (string memory) {
        if (id == 0) return uri0;
        if (id == 1) return uri1;
        if (id == 2) return uri2;
        if (id == 3) return uri3;
        if (id == 4) return uri4;
        return "";
    }

    function mint(uint128 id, uint128 amount) public {
        if (msg.sender != owner) { return; }
        if (id == 0) balance0 += amount;
        else if (id == 1) balance1 += amount;
        else if (id == 2) balance2 += amount;
        else if (id == 3) balance3 += amount;
        else if (id == 4) balance4 += amount;
    }

    function balanceOf(uint128 id) public view returns (uint128) {
        if (id == 0) return balance0;
        if (id == 1) return balance1;
        if (id == 2) return balance2;
        if (id == 3) return balance3;
        if (id == 4) return balance4;
        return 0;
    }
}
`
    },
    "oz-erc4626": {
        name: "ERC4626 Vault",
        description: "Tokenized vault standard",
        defaultFileName: "TokenVault.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title ERC4626 Vault (Soroban-compatible)
/// @notice Tokenized vault for yield strategies
/// @dev Simplified vault with share/asset conversion
contract TokenVault {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    address public instance owner;

    // Vault state
    uint128 public persistent totalAssets;
    uint128 public persistent totalShares;
    uint128 public persistent ownerShares;
    uint128 public persistent ownerAssets;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        owner = msg.sender;
        totalAssets = 0;
        totalShares = 0;
        ownerShares = 0;
        ownerAssets = 0;
    }

    function deposit(uint128 assets) public returns (uint128 shares) {
        if (totalShares == 0) {
            shares = assets;
        } else {
            shares = (assets * totalShares) / totalAssets;
        }
        totalAssets += assets;
        totalShares += shares;
        ownerShares += shares;
        ownerAssets += assets;
        return shares;
    }

    function withdraw(uint128 assets) public returns (uint128 shares) {
        if (totalAssets == 0) { return 0; }
        shares = (assets * totalShares) / totalAssets;
        if (ownerShares < shares) { return 0; }
        if (ownerAssets < assets) { return 0; }
        totalAssets -= assets;
        totalShares -= shares;
        ownerShares -= shares;
        ownerAssets -= assets;
        return shares;
    }

    function redeem(uint128 shares) public returns (uint128 assets) {
        if (totalShares == 0) { return 0; }
        if (ownerShares < shares) { return 0; }
        assets = (shares * totalAssets) / totalShares;
        totalAssets -= assets;
        totalShares -= shares;
        ownerShares -= shares;
        ownerAssets -= assets;
        return assets;
    }

    function convertToShares(uint128 assets) public view returns (uint128) {
        if (totalAssets == 0) { return assets; }
        return (assets * totalShares) / totalAssets;
    }

    function convertToAssets(uint128 shares) public view returns (uint128) {
        if (totalShares == 0) { return shares; }
        return (shares * totalAssets) / totalShares;
    }

    function balanceOf() public view returns (uint128) {
        return ownerShares;
    }

    function maxDeposit() public pure returns (uint128) {
        return type(uint128).max;
    }
}
`
    },
    "oz-ownable2step": {
        name: "Ownable 2-Step",
        description: "Two-step ownership transfer",
        defaultFileName: "Ownable2Step.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Ownable 2-Step (Soroban-compatible)
/// @notice Ownership with pending acceptance
/// @dev Prevents accidental ownership transfers
contract Ownable2Step {
    address public instance owner;
    address public instance pendingOwner;

    constructor() {
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function transferOwnership(address newOwner) public {
        if (msg.sender != owner) { return; }
        pendingOwner = newOwner;
    }

    function acceptOwnership() public {
        if (msg.sender != pendingOwner) { return; }
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function renounceOwnership() public {
        if (msg.sender != owner) { return; }
        owner = address(0);
        pendingOwner = address(0);
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function getPendingOwner() public view returns (address) {
        return pendingOwner;
    }
}
`
    },
    "oz-access-enumerable": {
        name: "Access Enumerable",
        description: "Enumerable role members",
        defaultFileName: "EnumerableAccess.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Access Control Enumerable (Soroban-compatible)
/// @notice Role-based access with member enumeration
/// @dev Tracks up to 3 members per role
contract EnumerableAccess {
    address public instance admin;

    // Admin role members
    address public instance adminMember0;
    address public instance adminMember1;
    address public instance adminMember2;
    uint128 public persistent adminCount;

    // Minter role members
    address public instance minterMember0;
    address public instance minterMember1;
    address public instance minterMember2;
    uint128 public persistent minterCount;

    constructor() {
        admin = msg.sender;
        adminMember0 = msg.sender;
        adminCount = 1;
        minterCount = 0;
    }

    function grantAdminRole(address account) public {
        if (msg.sender != admin) { return; }
        if (adminCount >= 3) { return; }
        if (adminCount == 0) adminMember0 = account;
        else if (adminCount == 1) adminMember1 = account;
        else if (adminCount == 2) adminMember2 = account;
        adminCount += 1;
    }

    function grantMinterRole(address account) public {
        if (msg.sender != admin) { return; }
        if (minterCount >= 3) { return; }
        if (minterCount == 0) minterMember0 = account;
        else if (minterCount == 1) minterMember1 = account;
        else if (minterCount == 2) minterMember2 = account;
        minterCount += 1;
    }

    function getAdminMember(uint128 index) public view returns (address) {
        if (index == 0) return adminMember0;
        if (index == 1) return adminMember1;
        if (index == 2) return adminMember2;
        return address(0);
    }

    function getMinterMember(uint128 index) public view returns (address) {
        if (index == 0) return minterMember0;
        if (index == 1) return minterMember1;
        if (index == 2) return minterMember2;
        return address(0);
    }

    function getAdminCount() public view returns (uint128) {
        return adminCount;
    }

    function getMinterCount() public view returns (uint128) {
        return minterCount;
    }
}
`
    },
    "oz-votes": {
        name: "Votes",
        description: "Voting weight tracking",
        defaultFileName: "Votes.sol",
        category: "Access",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Votes (Soroban-compatible)
/// @notice Abstract voting weight with checkpoints
/// @dev Simplified checkpoint system
contract Votes {
    address public instance owner;

    // Current voting state
    uint128 public persistent totalVotingPower;
    address public instance delegate1;
    address public instance delegate2;
    address public instance delegate3;
    uint128 public persistent power1;
    uint128 public persistent power2;
    uint128 public persistent power3;

    // Checkpoints (simplified - 3 historical values)
    uint128 public persistent checkpoint1Block;
    uint128 public persistent checkpoint1Power;
    uint128 public persistent checkpoint2Block;
    uint128 public persistent checkpoint2Power;
    uint128 public persistent checkpoint3Block;
    uint128 public persistent checkpoint3Power;
    uint128 public persistent checkpointCount;

    constructor() {
        owner = msg.sender;
        totalVotingPower = 0;
        checkpointCount = 0;
    }

    function delegate(address delegatee, uint128 power) public {
        if (msg.sender != owner) { return; }
        if (power1 == 0) { delegate1 = delegatee; power1 = power; }
        else if (power2 == 0) { delegate2 = delegatee; power2 = power; }
        else if (power3 == 0) { delegate3 = delegatee; power3 = power; }
        totalVotingPower += power;
    }

    function createCheckpoint(uint128 currentBlock) public {
        if (msg.sender != owner) { return; }
        if (checkpointCount >= 3) { return; }
        checkpointCount += 1;
        if (checkpointCount == 1) {
            checkpoint1Block = currentBlock;
            checkpoint1Power = totalVotingPower;
        } else if (checkpointCount == 2) {
            checkpoint2Block = currentBlock;
            checkpoint2Power = totalVotingPower;
        } else if (checkpointCount == 3) {
            checkpoint3Block = currentBlock;
            checkpoint3Power = totalVotingPower;
        }
    }

    function getPastVotes(uint128 blockNumber) public view returns (uint128) {
        if (checkpointCount >= 3 && blockNumber >= checkpoint3Block) return checkpoint3Power;
        if (checkpointCount >= 2 && blockNumber >= checkpoint2Block) return checkpoint2Power;
        if (checkpointCount >= 1 && blockNumber >= checkpoint1Block) return checkpoint1Power;
        return 0;
    }

    function getVotes(address account) public view returns (uint128) {
        if (account == delegate1) return power1;
        if (account == delegate2) return power2;
        if (account == delegate3) return power3;
        return 0;
    }
}
`
    },
    "oz-pull-payment": {
        name: "Pull Payment",
        description: "Async pull payment pattern",
        defaultFileName: "PullPayment.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Pull Payment (Soroban-compatible)
/// @notice Async payment withdrawal pattern
/// @dev Payees withdraw rather than receive
contract PullPayment {
    address public instance owner;

    // Escrow balances for up to 5 payees
    address public instance payee0;
    address public instance payee1;
    address public instance payee2;
    address public instance payee3;
    address public instance payee4;
    uint128 public persistent owed0;
    uint128 public persistent owed1;
    uint128 public persistent owed2;
    uint128 public persistent owed3;
    uint128 public persistent owed4;
    uint128 public persistent totalOwed;

    constructor() {
        owner = msg.sender;
        totalOwed = 0;
    }

    function asyncTransfer(address dest, uint128 amount) public {
        if (msg.sender != owner) { return; }
        if (owed0 == 0 && payee0 == address(0)) { payee0 = dest; owed0 = amount; }
        else if (payee0 == dest) { owed0 += amount; }
        else if (owed1 == 0 && payee1 == address(0)) { payee1 = dest; owed1 = amount; }
        else if (payee1 == dest) { owed1 += amount; }
        else if (owed2 == 0 && payee2 == address(0)) { payee2 = dest; owed2 = amount; }
        else if (payee2 == dest) { owed2 += amount; }
        else if (owed3 == 0 && payee3 == address(0)) { payee3 = dest; owed3 = amount; }
        else if (payee3 == dest) { owed3 += amount; }
        else if (owed4 == 0 && payee4 == address(0)) { payee4 = dest; owed4 = amount; }
        else if (payee4 == dest) { owed4 += amount; }
        totalOwed += amount;
    }

    function withdrawPayments(address payee) public returns (uint128) {
        uint128 amount = 0;
        if (payee == payee0) { amount = owed0; owed0 = 0; }
        else if (payee == payee1) { amount = owed1; owed1 = 0; }
        else if (payee == payee2) { amount = owed2; owed2 = 0; }
        else if (payee == payee3) { amount = owed3; owed3 = 0; }
        else if (payee == payee4) { amount = owed4; owed4 = 0; }
        totalOwed -= amount;
        return amount;
    }

    function payments(address payee) public view returns (uint128) {
        if (payee == payee0) return owed0;
        if (payee == payee1) return owed1;
        if (payee == payee2) return owed2;
        if (payee == payee3) return owed3;
        if (payee == payee4) return owed4;
        return 0;
    }
}
`
    },
    "oz-counters": {
        name: "Counters",
        description: "Incrementing ID generator",
        defaultFileName: "Counters.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Counters (Soroban-compatible)
/// @notice Simple incrementing counters for IDs
/// @dev Multiple named counters
contract Counters {
    address public instance owner;

    // Multiple counters
    uint128 public persistent counter1;
    uint128 public persistent counter2;
    uint128 public persistent counter3;
    string public instance counter1Name;
    string public instance counter2Name;
    string public instance counter3Name;

    constructor() {
        owner = msg.sender;
        counter1 = 0;
        counter2 = 0;
        counter3 = 0;
        counter1Name = "default";
        counter2Name = "";
        counter3Name = "";
    }

    function setCounterName(uint128 counterId, string memory name) public {
        if (msg.sender != owner) { return; }
        if (counterId == 1) counter1Name = name;
        else if (counterId == 2) counter2Name = name;
        else if (counterId == 3) counter3Name = name;
    }

    function current(uint128 counterId) public view returns (uint128) {
        if (counterId == 1) return counter1;
        if (counterId == 2) return counter2;
        if (counterId == 3) return counter3;
        return 0;
    }

    function increment(uint128 counterId) public returns (uint128) {
        if (counterId == 1) { counter1 += 1; return counter1; }
        if (counterId == 2) { counter2 += 1; return counter2; }
        if (counterId == 3) { counter3 += 1; return counter3; }
        return 0;
    }

    function decrement(uint128 counterId) public returns (uint128) {
        if (counterId == 1 && counter1 > 0) { counter1 -= 1; return counter1; }
        if (counterId == 2 && counter2 > 0) { counter2 -= 1; return counter2; }
        if (counterId == 3 && counter3 > 0) { counter3 -= 1; return counter3; }
        return 0;
    }

    function reset(uint128 counterId) public {
        if (msg.sender != owner) { return; }
        if (counterId == 1) counter1 = 0;
        else if (counterId == 2) counter2 = 0;
        else if (counterId == 3) counter3 = 0;
    }
}
`
    },
    "oz-multicall": {
        name: "Multicall",
        description: "Batch multiple calls",
        defaultFileName: "Multicall.sol",
        category: "Tokens",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Multicall (Soroban-compatible)
/// @notice Batch multiple operations in one call
/// @dev Simplified multicall with preset operations
contract Multicall {
    address public instance owner;

    // State that can be modified in batch
    uint128 public persistent value1;
    uint128 public persistent value2;
    uint128 public persistent value3;
    string public instance message;
    bool public instance flag;

    constructor() {
        owner = msg.sender;
        value1 = 0;
        value2 = 0;
        value3 = 0;
        message = "";
        flag = false;
    }

    function setValue1(uint128 v) public {
        value1 = v;
    }

    function setValue2(uint128 v) public {
        value2 = v;
    }

    function setValue3(uint128 v) public {
        value3 = v;
    }

    function setMessage(string memory m) public {
        message = m;
    }

    function setFlag(bool f) public {
        flag = f;
    }

    // Batch operations
    function batchSetValues(uint128 v1, uint128 v2, uint128 v3) public {
        value1 = v1;
        value2 = v2;
        value3 = v3;
    }

    function batchSetAll(uint128 v1, uint128 v2, uint128 v3, string memory m, bool f) public {
        value1 = v1;
        value2 = v2;
        value3 = v3;
        message = m;
        flag = f;
    }

    function incrementAll(uint128 amount) public {
        value1 += amount;
        value2 += amount;
        value3 += amount;
    }

    function resetAll() public {
        if (msg.sender != owner) { return; }
        value1 = 0;
        value2 = 0;
        value3 = 0;
        message = "";
        flag = false;
    }

    function getValue1() public view returns (uint128) {
        return value1;
    }

    function getValue2() public view returns (uint128) {
        return value2;
    }

    function getValue3() public view returns (uint128) {
        return value3;
    }

    function getMessage() public view returns (string memory) {
        return message;
    }

    function getFlag() public view returns (bool) {
        return flag;
    }
}
`
    },
    "oz-minimal-forwarder": {
        name: "Minimal Forwarder",
        description: "Meta-transaction forwarder",
        defaultFileName: "MinimalForwarder.sol",
        category: "Security",
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/// @title Minimal Forwarder (Soroban-compatible)
/// @notice Forward meta-transactions
/// @dev Simplified forwarder with nonce tracking
contract MinimalForwarder {
    address public instance owner;

    // Nonce tracking for up to 5 addresses
    address public instance user0;
    address public instance user1;
    address public instance user2;
    address public instance user3;
    address public instance user4;
    uint128 public persistent nonce0;
    uint128 public persistent nonce1;
    uint128 public persistent nonce2;
    uint128 public persistent nonce3;
    uint128 public persistent nonce4;

    // Forwarded call tracking
    uint128 public persistent totalForwarded;
    uint128 public persistent totalSuccessful;
    uint128 public persistent totalFailed;

    constructor() {
        owner = msg.sender;
        totalForwarded = 0;
        totalSuccessful = 0;
        totalFailed = 0;
    }

    function getNonce(address from) public view returns (uint128) {
        if (from == user0) return nonce0;
        if (from == user1) return nonce1;
        if (from == user2) return nonce2;
        if (from == user3) return nonce3;
        if (from == user4) return nonce4;
        return 0;
    }

    function registerUser(address user) public {
        if (msg.sender != owner) { return; }
        if (user0 == address(0)) { user0 = user; return; }
        if (user1 == address(0)) { user1 = user; return; }
        if (user2 == address(0)) { user2 = user; return; }
        if (user3 == address(0)) { user3 = user; return; }
        if (user4 == address(0)) { user4 = user; return; }
    }

    function execute(address from, uint128 providedNonce) public returns (bool) {
        uint128 currentNonce = getNonce(from);
        if (providedNonce != currentNonce) {
            totalFailed += 1;
            return false;
        }

        // Increment nonce
        if (from == user0) nonce0 += 1;
        else if (from == user1) nonce1 += 1;
        else if (from == user2) nonce2 += 1;
        else if (from == user3) nonce3 += 1;
        else if (from == user4) nonce4 += 1;

        totalForwarded += 1;
        totalSuccessful += 1;
        return true;
    }

    function verify(address from, uint128 providedNonce) public view returns (bool) {
        return getNonce(from) == providedNonce;
    }

    function getTotalForwarded() public view returns (uint128) {
        return totalForwarded;
    }

    function getTotalSuccessful() public view returns (uint128) {
        return totalSuccessful;
    }

    function getTotalFailed() public view returns (uint128) {
        return totalFailed;
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
    createOpenZeppelinFile: (template: OpenZeppelinTemplate, parentFolderId?: string) => void;
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
    constructorArgs: Record<string, string>;
    setConstructorArgs: (args: Record<string, string>) => void;
    constructorInputs: ABIInput[];
    // Wallet
    walletAddress: string | null;
    walletBalance: string | null;
    isWalletConnected: boolean;
    connectWallet: () => Promise<void>;
    disconnectWallet: () => void;
    // Contract Interaction
    callContractFunction: (functionName: string, args: Record<string, string>, isView: boolean) => Promise<FunctionCallResult>;
    getContractFunctions: () => ABIFunction[];
    resetDeployment: () => void;
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
    const [constructorArgs, setConstructorArgs] = useState<Record<string, string>>({});

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

    // Reset build state when switching files
    const handleSetActiveFileId = useCallback((id: string) => {
        if (id !== activeFileId) {
            // Reset build state for the new file
            setBuildStatus("idle");
            setCompileResult(null);
            setVerifyResult(null);
            setDeployResult(null);
        }
        setActiveFileId(id);
    }, [activeFileId]);

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

        // Reset build state for new file
        setBuildStatus("idle");
        setCompileResult(null);
        setVerifyResult(null);
        setDeployResult(null);

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

    const createOpenZeppelinFile = useCallback((template: OpenZeppelinTemplate, parentFolderId?: string) => {
        const templateData = OPENZEPPELIN_TEMPLATES[template];
        const newFile: File = {
            id: genId(),
            name: templateData.defaultFileName,
            type: "solidity" as FileType,
            content: templateData.content,
        };

        // Reset build state for new file
        setBuildStatus("idle");
        setCompileResult(null);
        setVerifyResult(null);
        setDeployResult(null);

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
                    // Populate constructor args with defaults
                    const ctor = (result.abi as Array<{ type: string; inputs?: ABIInput[] }>)
                        .find(e => e.type === "constructor");
                    if (ctor?.inputs) {
                        const defaults: Record<string, string> = {};
                        const contractName = activeFile.name.replace(".sol", "");
                        for (const input of ctor.inputs) {
                            if (input.name === "_caller" || input.name === "caller") continue;
                            const key = input.name.startsWith("_") ? input.name : `_${input.name}`;
                            if (input.type === "string") defaults[key] = `Hello from ${contractName}`;
                            else if (input.type.startsWith("uint") || input.type.startsWith("int")) defaults[key] = "0";
                            else if (input.type === "bool") defaults[key] = "false";
                            else if (input.type === "address") defaults[key] = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
                            else defaults[key] = "0";
                        }
                        setConstructorArgs(defaults);
                    } else {
                        setConstructorArgs({});
                    }
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
            if (Object.keys(constructorArgs).length > 0) {
                addLog({ type: "info", msg: `  Constructor args: ${Object.entries(constructorArgs).map(([k, v]) => `${k}=${v}`).join(", ")}` });
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
    }, [activeFile, compileResult, constructorArgs, addLog]);

    // --- Constructor Inputs (derived from ABI) ---

    const constructorInputs: ABIInput[] = useMemo(() => {
        if (!compileResult?.abi || !Array.isArray(compileResult.abi)) return [];
        const ctor = (compileResult.abi as Array<{ type: string; inputs?: ABIInput[] }>)
            .find(e => e.type === "constructor");
        if (!ctor?.inputs) return [];
        return ctor.inputs.filter(i => i.name !== "_caller" && i.name !== "caller");
    }, [compileResult]);

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

        const argsDisplay = Object.entries(args).map(([, v]) => v).join(", ");
        addLog({
            type: isView ? "info" : "system",
            msg: `Calling ${functionName}(${argsDisplay})...`
        });

        try {
            const response = await fetch("/api/call", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contractId: deployResult.contractId,
                    functionName,
                    namedArgs: args,
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

    const resetDeployment = useCallback(() => {
        setBuildStatus("idle");
        setCompileResult(null);
        setVerifyResult(null);
        setDeployResult(null);
        addLog({ type: "system", msg: "Ready for new deployment." });
    }, [addLog]);

    // --- Context ---

    const contextValue: ProjectContextType = {
        project,
        activeFileId,
        activeFile,
        setActiveFileId: handleSetActiveFileId,
        updateFileContent,
        createFile,
        createSolidityFile,
        createOpenZeppelinFile,
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
        constructorArgs,
        setConstructorArgs,
        constructorInputs,
        walletAddress,
        walletBalance,
        isWalletConnected,
        connectWallet,
        disconnectWallet,
        callContractFunction,
        getContractFunctions,
        resetDeployment,
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
