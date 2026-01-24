# TVA Protocol

**EVM Compatibility Layer on Stellar via Compilation**

[![Status](https://img.shields.io/badge/Status-Phase%201%20Complete-green)]()
[![Solidity](https://img.shields.io/badge/Solidity-0.7+-blue)]()
[![Stellar](https://img.shields.io/badge/Stellar-Soroban-purple)]()
[![License](https://img.shields.io/badge/License-MIT-yellow)]()

TVA Protocol enables Ethereum developers to deploy **standard Solidity smart contracts** directly to Stellar's Soroban platform. No Rust. No new language. Just Solidity.

The TVA compiler translates Solidity source code to Soroban-compatible WebAssembly, while a stateless RPC layer makes Stellar indistinguishable from an EVM chain to existing tooling (Hardhat, Foundry, ethers.js, MetaMask).

**Write Solidity. Deploy to Stellar. Settle in 5 seconds.**

---

## Why TVA?

| Property | Ethereum L1 | Optimistic L2 | ZK L2 | **Stellar (TVA)** |
|----------|-------------|---------------|--------|-------------------|
| Finality | ~12 min (probabilistic) | 7-day challenge | Hours | **5 sec (deterministic)** |
| Tx Cost | $0.50 - $50+ | $0.01 - $1 | $0.01 - $0.50 | **< $0.001** |
| MEV Exposure | High | Moderate | Low | **None** |
| Reorg Risk | Non-zero | Inherited | Inherited | **Zero** |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPER INTERFACE                                │
│                                                                              │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌─────────┐          │
│   │Solidity │  │ Hardhat │  │ Foundry │  │ ethers.js│  │ MetaMask│          │
│   │  .sol   │  │         │  │         │  │   viem   │  │         │          │
│   └────┬────┘  └────┬────┘  └────┬────┘  └────┬─────┘  └────┬────┘          │
└────────┼────────────┼───────────┼────────────┼──────────────┼───────────────┘
         │            │           │            │              │
         ▼            └───────────┴────────────┴──────────────┘
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPILATION LAYER (TVA Compiler)                      │
│                                                                              │
│   Solidity ──► Frontend ──► Codegen ──► LLVM IR ──► Soroban WASM            │
│                                                                              │
│   Translations:                                                              │
│   • msg.sender    ──►  requireAuth()                                        │
│   • storage slots ──►  typed ScVal entries                                  │
│   • ABI encoding  ──►  ScVal encoding                                       │
│   • selectors     ──►  named WASM exports                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RPC TRANSLATION LAYER (Stateless)                       │
│                                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│   │  eth_call    │    │eth_sendRaw   │    │ eth_getLogs  │                  │
│   │  eth_block   │    │Transaction   │    │eth_subscribe │                  │
│   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                  │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│   ┌──────────────────────────────────────────────────────────┐              │
│   │              Stellar RPC (Horizon + Soroban)             │              │
│   └──────────────────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ACCOUNT MANAGEMENT LAYER                                │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                    AccountRegistry Contract                  │           │
│   ├─────────────────────────────────────────────────────────────┤           │
│   │  secp256k1 (EVM)  ◄──────────────────►  Ed25519 (Stellar)  │           │
│   │  0x742d35...      ◄──  bidirectional  ──►  GABC123...       │           │
│   └─────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SETTLEMENT LAYER (Stellar)                            │
│                                                                              │
│   ┌───────────┐  ┌───────────────┐  ┌────────────┐  ┌───────────┐          │
│   │ Soroban   │  │     SCP       │  │ Multi-Asset│  │    TTL    │          │
│   │    VM     │  │  (5s final)   │  │   Native   │  │  Archival │          │
│   └───────────┘  └───────────────┘  └────────────┘  └───────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Insight: Compilation over Emulation

Other solutions (Neon EVM, Aurora) run an EVM interpreter on-chain. TVA compiles Solidity directly to native Soroban WASM:

```
Emulation: Solidity → solc → EVM bytecode → EVM interpreter (on-chain) → execution
                                              ↑
                                    10,000+ lines of on-chain code

TVA:       Solidity → TVA Compiler → Soroban WASM → Soroban VM → execution
                          ↑
               Off-chain compiler (exhaustively testable)
```

**Result**: Zero additional on-chain trusted code. Native execution speed. Full Soroban VM security guarantees.

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust 1.88+ (for RPC layer)
- Stellar CLI

### Setup

```bash
# Clone the repository
git clone https://github.com/tva-protocol/tva-stellar.git
cd tva-stellar

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Set up Stellar testnet identity
stellar keys generate alice --network testnet
stellar keys fund alice --network testnet
```

### Compile & Deploy

```bash
# Compile Solidity to Soroban WASM
./scripts/compile.sh contracts/Counter.sol

# Deploy to Stellar testnet
./scripts/deploy.sh Counter.wasm alice

# Initialize the contract
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- init --_admin alice

# Interact with the contract
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source alice \
  --network testnet \
  -- increment
```

---

## Project Structure

```
tva-stellar/
├── contracts/                    # Solidity smart contracts
│   ├── Counter.sol                 # Basic counter with TTL management
│   ├── TVAToken.sol                # ERC20-compatible token
│   ├── AccountRegistry.sol         # EVM ↔ Stellar address mapping
│   └── test/                       # Test contracts
│
├── packages/                     # NPM packages (monorepo)
│   ├── sdk/                        # @tva-protocol/sdk - Core TypeScript SDK
│   ├── hardhat-plugin/             # Hardhat integration
│   ├── ethers-adapter/             # ethers.js adapter for Stellar
│   └── wallet-adapter/             # Wallet connection utilities
│
├── rpc/                          # RPC Translation Layer (Rust)
│   └── src/
│       ├── server.rs               # JSON-RPC server
│       ├── translator/             # EVM → Stellar translation
│       ├── methods/                # eth_* method implementations
│       └── stellar/                # Stellar client
│
├── client/                       # Frontend application (Next.js)
│
├── compiler/                     # TVA compiler configuration
│
├── scripts/                      # Build & deployment scripts
│   ├── compile.sh                  # Compile Solidity → WASM
│   ├── deploy.sh                   # Deploy to Stellar
│   └── test-e2e.sh                 # End-to-end tests
│
├── agent/                        # Development documentation
│   └── core-idea.md                # Technical specification
│
└── docs/                         # User documentation
```

---

## Soroban-Specific Solidity Extensions

TVA extends standard Solidity with custom syntax for Stellar-specific features:

### Storage Types

```solidity
contract Example {
    // Persistent storage - survives across invocations, TTL-managed
    uint64 public persistent count = 0;

    // Instance storage - tied to contract lifetime
    address public instance admin;

    // Temporary storage - deleted after invocation
    uint256 temporary scratchpad;
}
```

### Authorization (replaces msg.sender)

```solidity
function adminOnly() public {
    admin.requireAuth();  // Stellar-native authorization
    // ... admin logic
}
```

### TTL Management

```solidity
function extendStorage() public {
    // Extend TTL for a specific variable
    count.extendTtl(1000, 50000);  // (threshold, extend_to)

    // Extend TTL for entire contract instance
    extendInstanceTtl(1000, 50000);
}
```

---

## SDK Usage

### Installation

```bash
pnpm add @tva-protocol/sdk
```

### Basic Usage

```typescript
import { TVAProvider, TVAWallet, compileContract } from '@tva-protocol/sdk';

// Connect to TVA RPC
const provider = new TVAProvider('https://rpc.tva.stellar');

// Create wallet from mnemonic (generates both EVM + Stellar keys)
const wallet = TVAWallet.fromMnemonic('your mnemonic phrase...');

// Compile Solidity contract
const { wasm, spec } = await compileContract('./Counter.sol');

// Deploy to Stellar
const contractId = await wallet.deploy(wasm, provider);

// Interact using familiar ethers.js patterns
const counter = new Contract(contractId, abi, wallet);
await counter.increment();
const count = await counter.get();
```

---

## RPC Methods Supported

| Category | Methods |
|----------|---------|
| **Account** | `eth_getBalance`, `eth_getTransactionCount`, `eth_getCode` |
| **Transaction** | `eth_sendRawTransaction`, `eth_getTransactionByHash`, `eth_getTransactionReceipt`, `eth_estimateGas`, `eth_call` |
| **Block** | `eth_blockNumber`, `eth_getBlockByNumber`, `eth_getBlockByHash` |
| **Events** | `eth_getLogs`, `eth_subscribe` (WebSocket) |
| **Chain** | `eth_chainId`, `net_version`, `eth_gasPrice` |

---

## Security Model

### Trust Assumptions

1. **Stellar Consensus (SCP)** - Federated Byzantine Agreement provides safety and liveness
2. **Compiler Correctness** - The TVA compiler correctly translates Solidity semantics to Soroban
3. **Soroban VM** - Correct WASM execution within resource limits

**No additional assumptions**: No bridge operators, no DA committees, no fraud validators, no sequencer liveness.

### Trusted Computing Base Comparison

```
Emulation (Neon/Aurora):          TVA Protocol:
┌───────────────────────┐         ┌───────────────────────┐
│ EVM interpreter       │         │                       │
│ (~10,000+ LOC)        │         │   0 additional LOC    │
│ 150+ opcode impls     │         │   (only your compiled │
│ Gas metering          │         │    contract WASM)     │
│ Storage emulation     │         │                       │
│ Precompiles           │         │                       │
└───────────────────────┘         └───────────────────────┘
```

---

## Current Limitations

| Limitation | Status | Priority |
|------------|--------|----------|
| Event emission | In progress | Critical |
| bytes20/bytes32 mapping keys | Planned | High |
| msg.sender shimming | Planned | High |
| TTL scope (all types) | Planned | Medium |
| Inline assembly | Not supported | N/A |
| delegatecall | Not supported | N/A |

---

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm typecheck

# Linting
pnpm lint
```

### RPC Layer (Rust)

```bash
cd rpc
cargo build --release
cargo run
```

---

## Roadmap

- **Phase 1** - Core compilation pipeline (Solidity → Soroban WASM)
- **Phase 2** - Event emission, msg.sender shimming, extended type support
- **Phase 3** - Full RPC translation layer, WebSocket support
- **Phase 4** - Developer tooling (Hardhat plugin, Foundry support)
- **Phase 5** - Production hardening, security audits
- **Phase 6** - Mainnet deployment

---

## Documentation

- [Technical Specification](./agent/core-idea.md) - Full protocol design
- [Architecture Deep Dive](./TVA-PIVOT-ARCHITECTURE.md) - Detailed system architecture
- [Testing Guide](./scripts/TESTING.md) - E2E testing documentation

---

## Contributing

We welcome contributions. Please read our contributing guidelines before submitting PRs.

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## References

1. Mazieres, D. "The Stellar Consensus Protocol" - Stellar Development Foundation, 2015
2. [Soroban Documentation](https://soroban.stellar.org/) - Stellar Smart Contracts
3. [Ethereum JSON-RPC Specification](https://ethereum.org/en/developers/docs/apis/json-rpc/)

---

<p align="center">
  <strong>TVA Protocol</strong> - Bringing the EVM ecosystem to Stellar's superior settlement layer
</p>
