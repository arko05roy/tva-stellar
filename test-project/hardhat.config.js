import "@nomicfoundation/hardhat-ethers";

const TVA_CHAIN_ID = 1414676736; // 0x54564100 = "TVA\0" in ASCII
const TVA_RPC_URL = process.env.TVA_RPC_URL || "http://localhost:8545";

// Hardhat account #0 - DO NOT use in production
const TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    tva: {
      url: TVA_RPC_URL,
      chainId: TVA_CHAIN_ID,
      accounts: [TEST_PRIVATE_KEY],
      // TVA chain uses low fees (Stellar fee model)
      gasPrice: 1000000000, // 1 gwei
    },
    hardhat: {
      chainId: TVA_CHAIN_ID,
    },
  },
  paths: {
    sources: "./contracts",
    artifacts: "./artifacts",
  },
};
