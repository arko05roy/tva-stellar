/**
 * TVA Protocol End-to-End Test
 *
 * Tests: wallet connection, transaction send, Blockscout visibility
 */

import { ethers } from 'ethers';

const RPC_URL = 'http://localhost:8545';
const BLOCKSCOUT_URL = 'http://localhost:4000';
const CHAIN_ID = 1414676736;

// Test private key (DO NOT use in production)
const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

async function main() {
  console.log('=== TVA Protocol E2E Test ===\n');

  // 1. Connect to TVA RPC
  console.log('1. Connecting to TVA RPC...');
  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    chainId: CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  const blockNumber = await provider.getBlockNumber();
  console.log(`   Current block: #${blockNumber}`);

  const chainId = (await provider.getNetwork()).chainId;
  console.log(`   Chain ID: ${chainId}`);

  // 2. Create wallet
  console.log('\n2. Creating wallet...');
  const wallet = new ethers.Wallet(TEST_PRIVATE_KEY, provider);
  console.log(`   Address: ${wallet.address}`);

  // 3. Check balance
  console.log('\n3. Checking balance...');
  const balance = await provider.getBalance(wallet.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} XLM`);

  // 4. Get nonce
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log(`   Nonce: ${nonce}`);

  // 5. Send a transaction
  console.log('\n4. Sending test transaction...');
  const tx = {
    to: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // recipient
    value: ethers.parseEther('0.001'),
    gasLimit: 21000,
    gasPrice: ethers.parseUnits('1', 'gwei'),
    nonce: nonce,
    chainId: CHAIN_ID,
  };

  const signedTx = await wallet.signTransaction(tx);
  console.log(`   Signed TX: ${signedTx.substring(0, 30)}...`);

  // Send raw transaction
  const txHash = await provider.send('eth_sendRawTransaction', [signedTx]);
  console.log(`   TX Hash: ${txHash}`);

  // 6. Wait for receipt
  console.log('\n5. Waiting for receipt...');
  let receipt = null;
  for (let i = 0; i < 12; i++) {
    await new Promise(r => setTimeout(r, 2000));
    receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) break;
    process.stdout.write('.');
  }

  if (receipt) {
    console.log(`\n   Block: #${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   Gas Used: ${receipt.gasUsed}`);
  } else {
    console.log('\n   Warning: No receipt yet (tx may still be pending)');
  }

  // 7. Verify block contains the transaction
  console.log('\n6. Verifying block data...');
  if (receipt) {
    const block = await provider.getBlock(receipt.blockNumber, true);
    console.log(`   Block #${block.number}: ${block.transactions.length} transactions`);
    console.log(`   Block hash: ${block.hash}`);
  }

  // 8. Check Blockscout
  console.log('\n7. Checking Blockscout...');
  await new Promise(r => setTimeout(r, 5000)); // Give Blockscout time to index

  try {
    const statsRes = await fetch(`${BLOCKSCOUT_URL}/api/v2/stats`);
    const stats = await statsRes.json();
    console.log(`   Blockscout blocks: ${stats.total_blocks}`);
    console.log(`   Blockscout transactions: ${stats.total_transactions}`);

    if (txHash) {
      const txRes = await fetch(`${BLOCKSCOUT_URL}/api/v2/transactions/${txHash}`);
      if (txRes.ok) {
        const txData = await txRes.json();
        console.log(`   TX in Blockscout: YES`);
        console.log(`   TX status: ${txData.status}`);
        console.log(`   TX from: ${txData.from?.hash}`);
        console.log(`   TX to: ${txData.to?.hash}`);
      } else {
        console.log(`   TX in Blockscout: NOT YET (status ${txRes.status})`);
      }
    }
  } catch (e) {
    console.log(`   Blockscout check failed: ${e.message}`);
  }

  // 9. Test eth_getTransactionByHash
  console.log('\n8. Testing eth_getTransactionByHash...');
  const txData = await provider.send('eth_getTransactionByHash', [txHash]);
  if (txData) {
    console.log(`   from: ${txData.from}`);
    console.log(`   to: ${txData.to}`);
    console.log(`   value: ${txData.value}`);
    console.log(`   blockNumber: ${txData.blockNumber}`);
    console.log(`   blockHash: ${txData.blockHash}`);
  }

  // 10. Test Hardhat-style calls
  console.log('\n9. Testing Hardhat compatibility...');
  const gasPrice = await provider.send('eth_gasPrice', []);
  console.log(`   eth_gasPrice: ${gasPrice}`);

  const syncing = await provider.send('eth_syncing', []);
  console.log(`   eth_syncing: ${syncing}`);

  const clientVersion = await provider.send('web3_clientVersion', []);
  console.log(`   web3_clientVersion: ${clientVersion}`);

  const netVersion = await provider.send('net_version', []);
  console.log(`   net_version: ${netVersion}`);

  console.log('\n=== E2E Test Complete ===');
}

main().catch(console.error);
