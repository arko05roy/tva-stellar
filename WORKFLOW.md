# TVA Protocol - User Workflow

Deploy Solidity smart contracts to Stellar using standard Hardhat/MetaMask tooling.

## Architecture Overview

```
[Solidity Code] --> [TVA RPC Node] --> [Solang Compiler] --> [Soroban WASM] --> [Stellar Network]
                        ^
                        |
         [Hardhat / ethers.js / MetaMask]
         (standard EVM tooling, chain ID: 1414676736)
```

The TVA RPC node acts as a translation layer:
- Accepts standard Ethereum JSON-RPC calls
- Compiles Solidity to Soroban WASM using Solang
- Deploys contracts to Stellar
- Translates `eth_call` and `eth_sendRawTransaction` to Soroban invocations
- Reports blocks, transactions, and receipts in EVM format

---

## Prerequisites

- **Rust** 1.75+ (for the TVA RPC node)
- **Node.js** 18+ and **npm/pnpm**
- **Stellar testnet account** (free, created via Friendbot)

---

## Step 1: Set Up the TVA Node

### 1.1 Create a Stellar Account

```bash
# Generate a keypair (or use the tooling binary)
./tooling/bin/stellar keys generate tva-deployer --network testnet

# Fund it via Friendbot
./tooling/bin/stellar keys fund tva-deployer --network testnet

# Get the secret key
./tooling/bin/stellar keys show tva-deployer
```

### 1.2 Configure Environment

Create a `.env` file in the project root:

```env
# Stellar testnet credentials
STELLAR_SECRET_KEY=S...YOUR_SECRET_KEY_HERE...
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# TVA chain settings
TVA_CHAIN_ID=1414676736
TVA_RPC_PORT=8545
TVA_BLOCK_INTERVAL_MS=5000

# Optional
RUST_LOG=info
TVA_DATA_DIR=./tva_data
```

### 1.3 Start the TVA Node

```bash
cd rpc
cargo run
```

You should see:
```
TVA Node Ready
RPC endpoint: http://0.0.0.0:8545
Block interval: 5000ms
Compatible with MetaMask, Hardhat, ethers.js, Blockscout
```

---

## Step 2: Configure MetaMask (Optional)

Add TVA as a custom network in MetaMask:

| Field            | Value                          |
|------------------|-------------------------------|
| Network Name     | TVA Protocol (Testnet)        |
| RPC URL          | http://localhost:8545          |
| Chain ID         | 1414676736                    |
| Currency Symbol  | XLM                           |
| Block Explorer   | http://localhost:4000 (optional, if running Blockscout) |

---

## Step 3: Create Your Hardhat Project

### 3.1 Project Setup

```bash
mkdir my-tva-project && cd my-tva-project
npm init -y
npm install ethers
```

### 3.2 Hardhat Config

Create `hardhat.config.js`:

```javascript
const TVA_CHAIN_ID = 1414676736;
const TVA_RPC_URL = "http://localhost:8545";

export default {
  solidity: "0.8.19",
  networks: {
    tva: {
      url: TVA_RPC_URL,
      chainId: TVA_CHAIN_ID,
      accounts: ["0xYOUR_PRIVATE_KEY_HERE"],
      gasPrice: 1000000000,
    }
  }
};
```

### 3.3 Write Your Contract

Create `contracts/MyContract.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    uint64 public value;

    function set(uint64 _value) public {
        value = _value;
    }

    function get() public view returns (uint64) {
        return value;
    }
}
```

**Solidity Support Notes:**
- Use `uint64` instead of `uint256` for storage variables (Soroban native size)
- `msg.sender` is automatically transformed for Soroban compatibility
- Events are supported and emitted as Soroban contract events
- Mappings use Soroban persistent storage

---

## Step 4: Deploy to Stellar

### 4.1 Deploy Script

Create `scripts/deploy.mjs`:

```javascript
import { readFileSync, writeFileSync } from 'fs';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

async function main() {
  // Read your Solidity source
  const source = readFileSync(
    path.resolve(__dirname, '../contracts/MyContract.sol'),
    'utf-8'
  );

  // Connect to TVA RPC
  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  // Deploy: compiles to WASM + deploys to Stellar in one step
  const result = await provider.send('tva_deployContract', [
    source,              // Solidity source code
    'MyContract.sol',    // Filename
    '{}',               // Constructor args (JSON)
    null,               // ABI (auto-generated)
  ]);

  console.log('Deployed!');
  console.log('EVM Address:', result.contractAddress);
  console.log('Stellar ID:', result.stellarContractId);
  console.log('WASM Size:', result.wasmSize, 'bytes');

  // Save deployment info
  writeFileSync('deployments.json', JSON.stringify(result, null, 2));
}

main().catch(console.error);
```

### 4.2 Run Deployment

```bash
node scripts/deploy.mjs
```

---

## Step 5: Interact with Your Contract

After deployment, interact using standard ethers.js:

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('http://localhost:8545', {
  chainId: 1414676736,
  name: 'TVA Protocol',
}, { staticNetwork: true });

const wallet = new ethers.Wallet('0xYOUR_PRIVATE_KEY', provider);

const ABI = [
  "function get() view returns (uint64)",
  "function set(uint64 _value)",
];

const contract = new ethers.Contract('0xCONTRACT_ADDRESS', ABI, wallet);

// Read (eth_call -> Soroban simulateTransaction)
const value = await contract.get();
console.log('Value:', value);

// Write (eth_sendRawTransaction -> Soroban invokeHostFunction)
const tx = await wallet.sendTransaction({
  to: '0xCONTRACT_ADDRESS',
  data: contract.interface.encodeFunctionData('set', [42]),
  gasLimit: 100000,
  gasPrice: ethers.parseUnits('1', 'gwei'),
});
console.log('TX:', tx.hash);
```

---

## Step 6: Verify Your Contract

```javascript
const source = readFileSync('contracts/MyContract.sol', 'utf-8');

const result = await provider.send('tva_verifyContract', [
  '0xCONTRACT_ADDRESS',  // EVM address
  source,                 // Source code
  '0.3.0',              // Compiler version
  '--target soroban',    // Compiler flags
  '{}'                   // Metadata
]);

console.log('Verified:', result.verified);
```

---

## Quick Reference: RPC Methods

### Standard Ethereum (fully supported)
| Method | Description |
|--------|-------------|
| `eth_chainId` | Returns `0x54564100` (1414676736) |
| `eth_blockNumber` | Latest TVA block number |
| `eth_getBlockByNumber` | Block details |
| `eth_sendRawTransaction` | Submit signed transaction |
| `eth_getTransactionReceipt` | Transaction receipt |
| `eth_call` | Read-only contract call |
| `eth_estimateGas` | Gas estimation |
| `eth_getBalance` | XLM balance (in wei format) |
| `eth_gasPrice` | Current gas price |
| `eth_getCode` | Contract existence check |

### TVA-specific
| Method | Description |
|--------|-------------|
| `tva_deployContract` | Compile + deploy Solidity to Stellar |
| `tva_verifyContract` | Verify contract source code |
| `tva_getVerifiedSource` | Check verification status |
| `tva_registerAccount` | Create mirror Stellar account |
| `tva_getAccount` | Get account info |

---

## Running the Test Project

The repository includes a working example:

```bash
cd test-project
npm install
npm run deploy    # Deploys SimpleStorage.sol to Stellar
npm run test      # Runs integration tests
```

---

## Blockscout Explorer (Optional)

The TVA node is fully compatible with Blockscout. To run:

```bash
cd blockscout
docker-compose up -d
```

Access at `http://localhost:4000`. It will index TVA blocks, transactions, and addresses.

---

## Transaction Flow

```
1. User signs tx with MetaMask/ethers.js
2. eth_sendRawTransaction -> TVA RPC
3. TVA decodes EVM tx, adds to mempool
4. Sequencer includes tx in next block (every 5s)
5. Settlement engine translates to Soroban tx
6. Submits to Stellar network
7. Monitors for Stellar confirmation
8. Block marked as Finalized
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to TVA RPC" | Ensure the RPC node is running: `cd rpc && cargo run` |
| "Solang compiler not found" | Check `tooling/bin/solang` exists and is executable |
| "Stellar deploy failed" | Ensure your Stellar account is funded: `stellar keys fund tva-deployer --network testnet` |
| "STELLAR_SECRET_KEY must be set" | Create `.env` file with your Stellar secret key |
| Verification mismatch | Ensure you're verifying the exact same source that was deployed |
| Block not progressing | Check TVA node logs for errors, ensure Stellar RPC is reachable |
