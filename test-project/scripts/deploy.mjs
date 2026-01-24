/**
 * TVA Protocol - Standard Hardhat Deploy Script
 *
 * Usage: node scripts/deploy.mjs [contract-file]
 *
 * This script:
 * 1. Reads your Solidity source code
 * 2. Sends it to the TVA RPC node via tva_deployContract
 * 3. The TVA node compiles it to Soroban WASM and deploys to Stellar
 * 4. Returns the EVM-compatible address for use with ethers.js/MetaMask
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

async function main() {
  console.log('=== TVA Protocol Deploy ===\n');

  // Determine which contract to deploy
  const contractArg = process.argv[2] || 'contracts/SimpleStorage.sol';
  const contractPath = path.resolve(__dirname, '..', contractArg);
  const filename = path.basename(contractPath);
  const contractName = filename.replace('.sol', '');

  if (!existsSync(contractPath)) {
    console.error(`Error: Contract file not found: ${contractPath}`);
    process.exit(1);
  }

  console.log(`Contract: ${contractName}`);
  console.log(`Source:   ${contractPath}`);
  console.log(`RPC:      ${TVA_RPC_URL}\n`);

  // Step 1: Read the Solidity source
  const source = readFileSync(contractPath, 'utf-8');
  console.log(`1. Read source (${source.length} bytes)`);

  // Step 2: Connect to TVA RPC
  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  // Verify connection
  try {
    const chainId = await provider.send('eth_chainId', []);
    console.log(`2. Connected to TVA chain (chainId: ${chainId})`);
  } catch (e) {
    console.error(`Error: Cannot connect to TVA RPC at ${TVA_RPC_URL}`);
    console.error(`   Make sure the TVA node is running: cd rpc && cargo run`);
    process.exit(1);
  }

  // Step 3: Deploy via tva_deployContract RPC method
  // This compiles the Solidity to Soroban WASM and deploys to Stellar
  console.log(`3. Compiling & deploying to Stellar...`);

  try {
    const result = await provider.send('tva_deployContract', [
      source,     // Solidity source code
      filename,   // Filename (e.g., "SimpleStorage.sol")
      '{}',       // Constructor args (JSON)
      null,       // ABI (auto-generated)
    ]);

    console.log(`\n   Deployed successfully!`);
    console.log(`   EVM Address:        ${result.contractAddress}`);
    console.log(`   Stellar Contract:   ${result.stellarContractId}`);
    console.log(`   WASM Size:          ${result.wasmSize} bytes`);

    // Step 4: Save deployment info
    const deployInfo = {
      contractName,
      contractAddress: result.contractAddress,
      stellarContractId: result.stellarContractId,
      wasmSize: result.wasmSize,
      source: contractArg,
      deployedAt: new Date().toISOString(),
      network: result.network || 'testnet',
      chainId: TVA_CHAIN_ID,
      rpcUrl: TVA_RPC_URL,
    };

    const deployPath = path.join(__dirname, '..', 'deployments.json');
    writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
    console.log(`\n4. Deployment saved to: deployments.json`);

    console.log(`\n=== Deploy Complete ===`);
    console.log(`\nTo interact with the contract:`);
    console.log(`  node scripts/test.mjs`);
    console.log(`\nOr in your code:`);
    console.log(`  const provider = new ethers.JsonRpcProvider("${TVA_RPC_URL}");`);
    console.log(`  const contract = new ethers.Contract("${result.contractAddress}", abi, signer);`);
    console.log(`  const value = await contract.get();`);

    return deployInfo;
  } catch (e) {
    console.error(`\n   Deployment failed!`);
    if (e.info?.error?.message) {
      console.error(`   Error: ${e.info.error.message}`);
    } else {
      console.error(`   Error: ${e.message}`);
    }
    process.exit(1);
  }
}

main().catch(console.error);
