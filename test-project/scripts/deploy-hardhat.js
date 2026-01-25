/**
 * TVA Protocol - Hardhat Deploy Script
 *
 * Deploys Solidity contracts to TVA (which deploys to Stellar via Solang).
 * Uses standard Hardhat workflow: npx hardhat run scripts/deploy-hardhat.js --network tva
 */

import pkg from "hardhat";
const { ethers } = pkg;
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("=== TVA Protocol - Hardhat Deploy ===\n");

  const network = await ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (chainId: ${network.chainId})`);

  // Get the contract to deploy
  const contractName = process.env.CONTRACT || "SimpleStorage";
  const contractPath = path.resolve(__dirname, "..", "contracts", `${contractName}.sol`);

  console.log(`Contract: ${contractName}`);
  console.log(`Source:   ${contractPath}\n`);

  // Read source code
  const source = readFileSync(contractPath, "utf-8");

  // Generate ABI for TVA registration
  const abi = JSON.stringify([
    { type: "function", name: "get", inputs: [], outputs: [{ name: "", type: "uint64" }], stateMutability: "view" },
    { type: "function", name: "set", inputs: [{ name: "_value", type: "uint64" }], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "increment", inputs: [], outputs: [], stateMutability: "nonpayable" },
    { type: "function", name: "storedValue", inputs: [], outputs: [{ name: "", type: "uint64" }], stateMutability: "view" },
    { type: "event", name: "ValueChanged", inputs: [{ name: "oldValue", type: "uint64", indexed: false }, { name: "newValue", type: "uint64", indexed: false }] },
  ]);

  // Deploy via TVA's custom RPC method (compiles to Soroban WASM and deploys to Stellar)
  console.log("Deploying via TVA (EVM -> Stellar)...\n");

  const result = await ethers.provider.send("tva_deployContract", [
    source,
    `${contractName}.sol`,
    "{}",
    abi,
  ]);

  console.log("Deployed successfully!");
  console.log(`  EVM Address:      ${result.contractAddress}`);
  console.log(`  Stellar Contract: ${result.stellarContractId}`);
  console.log(`  WASM Size:        ${result.wasmSize} bytes\n`);

  // Get contract instance for interaction
  const Contract = await ethers.getContractFactory(contractName);
  const contract = Contract.attach(result.contractAddress);

  // Save deployment info
  const deployInfo = {
    contractName,
    contractAddress: result.contractAddress,
    stellarContractId: result.stellarContractId,
    wasmSize: result.wasmSize,
    network: "tva",
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
  };

  writeFileSync(
    path.join(__dirname, "..", "deployments.json"),
    JSON.stringify(deployInfo, null, 2)
  );

  console.log("Deployment saved to deployments.json\n");

  // Test basic interaction
  if (contractName === "SimpleStorage") {
    console.log("Testing contract interaction...");
    try {
      const value = await contract.get();
      console.log(`  Initial value: ${value}`);
    } catch (e) {
      console.log(`  Note: Contract read may require ABI registration`);
    }
  }

  console.log("\n=== Deploy Complete ===");
  console.log(`\nStellar Explorer: https://stellar.expert/explorer/testnet/contract/${result.stellarContractId}`);

  return contract;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
