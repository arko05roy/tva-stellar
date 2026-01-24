import "@nomicfoundation/hardhat-ethers";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: "0.8.19",
  networks: {
    tva: {
      type: "http",
      url: "http://localhost:8545",
      chainId: 1414676736,
      accounts: [
        // Test account - DO NOT use in production
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
      ],
    },
    tva_testnet: {
      type: "http",
      url: "https://rpc.testnet.tva-protocol.io",
      chainId: 1414676736,
      accounts: [],
    }
  }
};
