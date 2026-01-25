/**
 * TVA Chain Filler - Generate transactions to populate the chain
 *
 * Usage:
 *   npm run fill                    # Generate 20 transactions
 *   npm run fill -- --count 50      # Generate 50 transactions
 *   npm run fill:continuous         # Run continuously (1 tx every 10s)
 */
import { readFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

// Test wallets (Hardhat default accounts)
const WALLETS = [
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
];

const ABI = [
  "function increment()",
  "function incrementBy(uint64 amount)",
  "function ping(uint64 value)",
  "function reset()",
  "function getCounter() view returns (uint64)",
  "function getTotalCalls() view returns (uint64)",
  "event CounterIncremented(uint64 indexed oldValue, uint64 indexed newValue)",
  "event Ping(uint64 value)",
];

async function sendTx(contract, wallet, type, nonce) {
  const iface = new ethers.Interface(ABI);
  let calldata;
  let description;

  switch (type % 4) {
    case 0:
      calldata = iface.encodeFunctionData('increment', []);
      description = 'increment()';
      break;
    case 1:
      const amount = Math.floor(Math.random() * 10) + 1;
      calldata = iface.encodeFunctionData('incrementBy', [amount]);
      description = `incrementBy(${amount})`;
      break;
    case 2:
      const pingValue = Math.floor(Math.random() * 1000);
      calldata = iface.encodeFunctionData('ping', [pingValue]);
      description = `ping(${pingValue})`;
      break;
    case 3:
      calldata = iface.encodeFunctionData('increment', []);
      description = 'increment()';
      break;
  }

  const tx = await wallet.sendTransaction({
    to: contract,
    data: calldata,
    gasLimit: 100000,
    gasPrice: ethers.parseUnits('1', 'gwei'),
    nonce: nonce,
  });

  return { tx, description };
}

async function main() {
  const args = process.argv.slice(2);
  const continuous = args.includes('--continuous');
  const countIndex = args.indexOf('--count');
  const txCount = countIndex !== -1 ? parseInt(args[countIndex + 1]) : 20;

  console.log('=== TVA Chain Filler ===\n');

  // Load deployment
  const deployPath = path.join(__dirname, '..', 'deployment.json');
  if (!existsSync(deployPath)) {
    console.error('No deployment found. Run first: npm run deploy');
    process.exit(1);
  }

  const deploy = JSON.parse(readFileSync(deployPath, 'utf-8'));
  console.log(`Contract: ${deploy.contractAddress}`);
  console.log(`Mode:     ${continuous ? 'Continuous' : `Batch (${txCount} txs)`}\n`);

  // Connect
  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  // Create wallets
  const wallets = WALLETS.map(pk => new ethers.Wallet(pk, provider));
  console.log(`Using ${wallets.length} wallets\n`);

  let txSent = 0;
  let txConfirmed = 0;
  let errors = 0;

  if (continuous) {
    console.log('Running continuously (Ctrl+C to stop)...\n');

    while (true) {
      const walletIndex = txSent % wallets.length;
      const wallet = wallets[walletIndex];

      try {
        const nonce = await provider.getTransactionCount(wallet.address, 'pending');
        const { tx, description } = await sendTx(deploy.contractAddress, wallet, txSent, nonce);
        txSent++;

        console.log(`[${txSent}] ${description} -> ${tx.hash.slice(0, 18)}...`);

        // Don't wait for confirmation in continuous mode
      } catch (e) {
        errors++;
        console.log(`[ERROR] ${e.message}`);
      }

      // Wait 10 seconds between transactions
      await new Promise(r => setTimeout(r, 10000));
    }
  } else {
    console.log(`Sending ${txCount} transactions...\n`);

    const pending = [];

    for (let i = 0; i < txCount; i++) {
      const walletIndex = i % wallets.length;
      const wallet = wallets[walletIndex];

      try {
        const nonce = await provider.getTransactionCount(wallet.address, 'pending');
        const { tx, description } = await sendTx(deploy.contractAddress, wallet, i, nonce);
        txSent++;

        console.log(`[${txSent}/${txCount}] ${description} -> ${tx.hash.slice(0, 18)}...`);
        pending.push(tx.hash);

        // Small delay to avoid overwhelming the RPC
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        errors++;
        console.log(`[${i + 1}/${txCount}] ERROR: ${e.message}`);
      }
    }

    console.log(`\nWaiting for confirmations...`);

    // Wait for some confirmations
    for (const hash of pending.slice(0, 5)) {
      try {
        for (let i = 0; i < 10; i++) {
          const receipt = await provider.getTransactionReceipt(hash);
          if (receipt) {
            txConfirmed++;
            break;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {
        // Ignore
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Sent:      ${txSent}`);
    console.log(`Confirmed: ${txConfirmed}+ (checked first 5)`);
    console.log(`Errors:    ${errors}`);

    // Read final state
    try {
      const contract = new ethers.Contract(deploy.contractAddress, ABI, provider);
      const counter = await contract.getCounter();
      const totalCalls = await contract.getTotalCalls();
      console.log(`\nContract State:`);
      console.log(`  Counter:     ${counter}`);
      console.log(`  Total Calls: ${totalCalls}`);
    } catch (e) {
      // Ignore
    }
  }
}

main().catch(console.error);
