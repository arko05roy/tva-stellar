/**
 * TVA Chain Filler - Generate coin transfer transactions
 *
 * Usage:
 *   npm run transfer                # Generate 10 transfers
 *   npm run transfer -- --count 20  # Generate 20 transfers
 */
import { ethers } from 'ethers';

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

// Test wallets (Hardhat default accounts)
const WALLETS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
];

async function main() {
  const args = process.argv.slice(2);
  const countIndex = args.indexOf('--count');
  const txCount = countIndex !== -1 ? parseInt(args[countIndex + 1]) : 10;

  console.log('=== TVA Coin Transfers ===\n');

  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  // Create wallets
  const wallets = WALLETS.map(pk => new ethers.Wallet(pk, provider));

  console.log('Wallets:');
  for (const w of wallets) {
    console.log(`  ${w.address}`);
  }
  console.log('');

  let txSent = 0;
  let errors = 0;

  console.log(`Sending ${txCount} transfer transactions...\n`);

  for (let i = 0; i < txCount; i++) {
    const fromIndex = i % wallets.length;
    const toIndex = (i + 1) % wallets.length;
    const from = wallets[fromIndex];
    const to = wallets[toIndex];

    // Random small amount (0.0001 to 0.001 XLM)
    const amount = ethers.parseUnits((Math.random() * 0.0009 + 0.0001).toFixed(6), 18);

    try {
      const nonce = await provider.getTransactionCount(from.address, 'pending');

      const tx = await from.sendTransaction({
        to: to.address,
        value: amount,
        gasLimit: 21000,
        gasPrice: ethers.parseUnits('1', 'gwei'),
        nonce: nonce,
      });

      txSent++;
      console.log(`[${txSent}/${txCount}] ${from.address.slice(0, 10)}... -> ${to.address.slice(0, 10)}... : ${ethers.formatEther(amount)} XLM`);
      console.log(`         TX: ${tx.hash.slice(0, 20)}...`);

      // Small delay
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      errors++;
      console.log(`[${i + 1}/${txCount}] ERROR: ${e.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Sent:   ${txSent}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
