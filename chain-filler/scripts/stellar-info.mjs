#!/usr/bin/env node
/**
 * TVA Stellar Info - Display Stellar explorer URLs for contracts and transactions
 */
import { ethers } from 'ethers';

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
TVA Stellar Info
================
Usage:
  node stellar-info.mjs <address>     - Get Stellar contract info
  node stellar-info.mjs tx <hash>     - Get Stellar transaction info
  node stellar-info.mjs all           - Show all contracts with Stellar IDs

Examples:
  node stellar-info.mjs 0xffcd262c4005c4c81ee359fca8da050d1ba0a790
  node stellar-info.mjs tx 0xc125ad9258dec82bb2880bb4cf9f189b74feab521dea52a53b49438affb54146
`);
    return;
  }

  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL);

  if (args[0] === 'tx') {
    // Get transaction info
    const txHash = args[1];
    if (!txHash) {
      console.error('Error: Missing transaction hash');
      process.exit(1);
    }

    console.log(`\n=== TVA Transaction Info ===\n`);
    console.log(`EVM TX Hash: ${txHash}\n`);

    try {
      const info = await provider.send('tva_getTransactionInfo', [txHash]);

      if (info.error) {
        console.log(`Status: ${info.error}`);
      } else {
        console.log(`Status:      ${info.status}`);
        console.log(`Block:       ${info.blockNumber || 'pending'}`);
        console.log(`Stellar TX:  ${info.stellarTxHash || 'not settled'}`);
        if (info.stellarExplorerUrl) {
          console.log(`\nStellar Explorer:`);
          console.log(`  ${info.stellarExplorerUrl}`);
        }
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }

  } else if (args[0] === 'all') {
    // Show all contracts (from deployment.json)
    console.log(`\n=== TVA Deployed Contracts ===\n`);

    try {
      const fs = await import('fs');
      const path = await import('path');
      const deployPath = path.join(process.cwd(), 'deployment.json');

      if (fs.existsSync(deployPath)) {
        const deployment = JSON.parse(fs.readFileSync(deployPath, 'utf-8'));
        console.log(`Contract: ${deployment.contractName}`);
        console.log(`EVM Address: ${deployment.contractAddress}`);
        console.log(`Stellar ID:  ${deployment.stellarContractId}`);
        console.log(`\nStellar Explorer:`);
        console.log(`  https://stellar.expert/explorer/testnet/contract/${deployment.stellarContractId}`);
      } else {
        console.log('No deployment.json found. Deploy a contract first.');
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }

  } else {
    // Get contract info
    const address = args[0];

    console.log(`\n=== TVA Contract Info ===\n`);
    console.log(`EVM Address: ${address}\n`);

    try {
      const info = await provider.send('tva_getContractInfo', [address]);

      if (info.error) {
        console.log(`Status: ${info.error}`);
      } else {
        console.log(`Stellar Contract ID:`);
        console.log(`  ${info.stellarContractId}`);
        console.log(`\nStellar Explorer:`);
        console.log(`  ${info.stellarExplorerUrl}`);
        console.log(`\nNetwork: ${info.network}`);
      }
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }

  console.log('');
}

main().catch(console.error);
