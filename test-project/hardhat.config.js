import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const TVA_CHAIN_ID = 1414676736;
const TVA_RPC_URL = "http://localhost:8545";

// Test private key (Hardhat account #0) - DO NOT use in production
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.19",
  networks: {
    tva: {
      type: "http",
      url: TVA_RPC_URL,
      chainId: TVA_CHAIN_ID,
      accounts: [TEST_PRIVATE_KEY],
    }
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  }
};
