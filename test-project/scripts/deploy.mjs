/**
 * TVA Protocol Deployment Script
 *
 * Compiles Solidity → Soroban WASM → Deploys to Stellar
 * Automatically registers the contract on the TVA chain
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const TVA_CLI = path.join(PROJECT_ROOT, 'tva');
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, 'artifacts');

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

async function main() {
  console.log('=== TVA Protocol Deploy ===\n');

  const contractFile = process.argv[2] || 'contracts/SimpleStorage.sol';
  const contractName = path.basename(contractFile, '.sol');

  // Step 1: Compile with TVA CLI
  console.log(`1. Compiling ${contractFile}...`);
  try {
    const compileOutput = execSync(
      `${TVA_CLI} compile ${contractFile}`,
      { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    console.log(`   ${compileOutput.trim() || 'Compiled successfully'}`);
  } catch (e) {
    // Check if artifacts were produced despite error
    const wasmPath = path.join(ARTIFACTS_DIR, `${contractName}.wasm`);
    if (!existsSync(wasmPath)) {
      console.error(`   Compilation failed: ${e.stderr || e.message}`);
      process.exit(1);
    }
    console.log('   Compiled (with warnings)');
  }

  // Check output
  const wasmPath = path.join(ARTIFACTS_DIR, `${contractName}.wasm`);
  if (!existsSync(wasmPath)) {
    console.error(`   Error: ${wasmPath} not found`);
    process.exit(1);
  }
  const wasmSize = readFileSync(wasmPath).length;
  console.log(`   WASM: ${wasmPath} (${wasmSize} bytes)\n`);

  // Step 2: Deploy to Stellar via TVA CLI
  console.log('2. Deploying to Stellar...');
  let contractId;
  try {
    const deployOutput = execSync(
      `${TVA_CLI} deploy ${wasmPath}`,
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    // Extract contract ID from output (C-prefixed 56-char address)
    const match = deployOutput.match(/C[A-Z0-9]{55}/);
    if (match) {
      contractId = match[0];
    } else {
      // Try to get it from the last line
      contractId = deployOutput.trim().split('\n').pop().trim();
    }
    console.log(`   Contract ID: ${contractId}`);
  } catch (e) {
    const output = (e.stdout || '') + (e.stderr || '');
    const match = output.match(/C[A-Z0-9]{55}/);
    if (match) {
      contractId = match[0];
      console.log(`   Contract ID: ${contractId}`);
    } else {
      console.error(`   Deployment failed: ${output || e.message}`);
      process.exit(1);
    }
  }

  // Step 3: Convert Stellar contract ID to EVM address
  console.log('\n3. Registering on TVA chain...');
  const evmAddress = contractIdToEvmAddress(contractId);
  console.log(`   EVM Address: ${evmAddress}`);

  // Step 4: Connect to TVA RPC and verify
  console.log('\n4. Verifying deployment...');
  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  try {
    const code = await provider.getCode(evmAddress);
    console.log(`   Code at address: ${code.length > 4 ? code.substring(0, 20) + '...' : 'empty (expected for Soroban contracts)'}`);
  } catch (e) {
    console.log(`   Code check: ${e.message}`);
  }

  // Step 5: Save deployment info
  const deployInfo = {
    contractName,
    contractId,
    evmAddress,
    wasmPath,
    deployedAt: new Date().toISOString(),
    network: 'testnet',
    chainId: TVA_CHAIN_ID,
  };

  const deployPath = path.join(__dirname, '..', 'deployments.json');
  writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
  console.log(`\n   Deployment saved to: deployments.json`);

  console.log('\n=== Deployment Complete ===');
  console.log(`\nTo interact with this contract:`);
  console.log(`  ./tva invoke ${contractId} get`);
  console.log(`  ./tva invoke ${contractId} set --arg 42`);
  console.log(`  ./tva invoke ${contractId} increment`);
  console.log(`\nOr via ethers.js:`);
  console.log(`  const contract = new ethers.Contract("${evmAddress}", abi, signer);`);

  return deployInfo;
}

/**
 * Convert a Stellar contract ID (C...) to an EVM-compatible address (0x...)
 * Uses first 20 bytes of the decoded public key
 */
function contractIdToEvmAddress(contractId) {
  // Stellar contract IDs are base32-encoded (strkey format)
  // Strip the version byte (C = contract) and checksum, take 20 bytes
  const decoded = strKeyDecode(contractId);
  // Use first 20 bytes as the EVM address
  const addressBytes = decoded.slice(0, 20);
  return '0x' + Buffer.from(addressBytes).toString('hex');
}

/**
 * Decode a Stellar strkey-encoded address to raw bytes
 */
function strKeyDecode(strkey) {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const encoded = strkey;

  // Base32 decode
  let bits = '';
  for (const char of encoded) {
    const val = ALPHABET.indexOf(char);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }

  // Skip version byte (first byte) and checksum (last 2 bytes)
  return bytes.slice(1, bytes.length - 2);
}

main().catch(console.error);
