import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, appendFile, mkdir } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const STELLAR_BIN = path.join(PROJECT_ROOT, 'tooling', 'bin', 'stellar');
const ARTIFACTS_DIR = path.join(PROJECT_ROOT, 'artifacts');
const DEPLOYMENTS_LOG = path.join(ARTIFACTS_DIR, 'deployments.log');

const CONTRACT_ID_PATTERN = /C[A-Z0-9]{55}/;

interface DeployRequestBody {
  wasm: string;
  contractName: string;
  constructorArgs?: Record<string, string>;
}

interface DeployResponse {
  success: boolean;
  contractId?: string;
  explorerUrl?: string;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DeployResponse>> {
  let tempWasmPath: string | null = null;

  try {
    const body: DeployRequestBody = await request.json();

    if (!body.wasm || typeof body.wasm !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "wasm" field. Expected base64 encoded WASM.' },
        { status: 400 }
      );
    }

    if (!body.contractName || typeof body.contractName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "contractName" field.' },
        { status: 400 }
      );
    }

    // Decode base64 WASM and write to temp file
    const wasmBuffer = Buffer.from(body.wasm, 'base64');
    const tempFileName = `tva-deploy-${crypto.randomBytes(8).toString('hex')}.wasm`;
    tempWasmPath = path.join(os.tmpdir(), tempFileName);
    await writeFile(tempWasmPath, wasmBuffer);

    // Determine source account
    const sourceAccount = process.env.TVA_SOURCE || 'tva-deployer';

    // Build deploy command arguments
    const args: string[] = [
      'contract',
      'deploy',
      '--wasm',
      tempWasmPath,
      '--source-account',
      sourceAccount,
      '--network-passphrase',
      'Test SDF Network ; September 2015',
      '--rpc-url',
      'https://soroban-testnet.stellar.org',
    ];

    // Append constructor args if provided
    if (body.constructorArgs && typeof body.constructorArgs === 'object') {
      args.push('--');
      for (const [argName, argValue] of Object.entries(body.constructorArgs)) {
        args.push(`--${argName}`, String(argValue));
      }
    }

    // Execute the stellar CLI
    const { stdout, stderr } = await execFileAsync(STELLAR_BIN, args, {
      cwd: PROJECT_ROOT,
      timeout: 120000,
    });

    // Combine stdout and stderr to search for contract ID
    const combinedOutput = `${stdout}\n${stderr}`;
    const match = combinedOutput.match(CONTRACT_ID_PATTERN);

    if (!match) {
      return NextResponse.json(
        {
          success: false,
          error: `Deployment command executed but no contract ID found in output. stdout: ${stdout.trim()}, stderr: ${stderr.trim()}`,
        },
        { status: 500 }
      );
    }

    const contractId = match[0];
    const explorerUrl = `https://stellar.expert/explorer/testnet/contract/${contractId}`;

    // Log the deployment
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] Deployed "${body.contractName}" => ${contractId} | source: ${sourceAccount} | explorer: ${explorerUrl}\n`;

    await mkdir(ARTIFACTS_DIR, { recursive: true });
    await appendFile(DEPLOYMENTS_LOG, logEntry, 'utf-8');

    return NextResponse.json({
      success: true,
      contractId,
      explorerUrl,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred during deployment';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  } finally {
    // Clean up temp file
    if (tempWasmPath) {
      try {
        await unlink(tempWasmPath);
      } catch {
        // Temp file cleanup is best-effort
      }
    }
  }
}
