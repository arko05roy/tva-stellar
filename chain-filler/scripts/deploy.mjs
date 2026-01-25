/**
 * Deploy ChainFiller contract to TVA
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { ethers } from 'ethers';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TVA_RPC_URL = process.env.TVA_RPC_URL || 'http://localhost:8545';
const TVA_CHAIN_ID = 1414676736;

async function main() {
  console.log('=== TVA Chain Filler - Deploy ===\n');

  const contractPath = path.resolve(__dirname, '../contracts/ChainFiller.sol');
  const filename = 'ChainFiller.sol';

  if (!existsSync(contractPath)) {
    console.error(`Contract not found: ${contractPath}`);
    process.exit(1);
  }

  console.log(`Contract: ChainFiller`);
  console.log(`RPC:      ${TVA_RPC_URL}\n`);

  const source = readFileSync(contractPath, 'utf-8');
  console.log(`1. Read source (${source.length} bytes)`);

  const provider = new ethers.JsonRpcProvider(TVA_RPC_URL, {
    chainId: TVA_CHAIN_ID,
    name: 'TVA Protocol',
  }, { staticNetwork: true });

  try {
    const chainId = await provider.send('eth_chainId', []);
    console.log(`2. Connected to TVA (chainId: ${chainId})`);
  } catch (e) {
    console.error(`Cannot connect to TVA RPC at ${TVA_RPC_URL}`);
    console.error(`Make sure the TVA node is running: cd rpc && cargo run`);
    process.exit(1);
  }

  console.log(`3. Compiling & deploying to Stellar...`);

  try {
    const result = await provider.send('tva_deployContract', [
      source,
      filename,
      '{}',
      null,
    ]);

    console.log(`\n   Deployed!`);
    console.log(`   EVM Address:      ${result.contractAddress}`);
    console.log(`   Stellar Contract: ${result.stellarContractId}`);
    console.log(`   WASM Size:        ${result.wasmSize} bytes`);

    const deployInfo = {
      contractName: 'ChainFiller',
      contractAddress: result.contractAddress,
      stellarContractId: result.stellarContractId,
      wasmSize: result.wasmSize,
      deployedAt: new Date().toISOString(),
      chainId: TVA_CHAIN_ID,
      rpcUrl: TVA_RPC_URL,
    };

    const deployPath = path.join(__dirname, '..', 'deployment.json');
    writeFileSync(deployPath, JSON.stringify(deployInfo, null, 2));
    console.log(`\n4. Saved to: deployment.json`);

    console.log(`\n=== Deploy Complete ===`);
    console.log(`\nRun: npm run fill    # to generate transactions`);

    return deployInfo;
  } catch (e) {
    console.error(`\nDeployment failed!`);
    console.error(`Error: ${e.info?.error?.message || e.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
