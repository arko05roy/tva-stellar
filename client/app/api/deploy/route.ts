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

function getDefaultForType(type: string, contractName: string, argName?: string, sourceAccount?: string): string {
  // _caller is Solang's msg.sender equivalent — use the deployer identity
  if (argName === '_caller' || argName === 'caller') {
    return sourceAccount || 'tva-deployer';
  }
  switch (type.toLowerCase()) {
    case 'string':
      return `Hello from ${contractName}`;
    case 'u32':
    case 'u64':
    case 'u128':
    case 'i32':
    case 'i64':
    case 'i128':
    case 'uint256':
    case 'uint128':
    case 'uint64':
    case 'uint32':
    case 'int256':
    case 'int128':
    case 'int64':
    case 'int32':
      return '0';
    case 'bool':
      return 'false';
    case 'address':
      return sourceAccount || 'tva-deployer';
    case 'bytes':
    case 'bytes32':
      return '0000000000000000000000000000000000000000000000000000000000000000';
    default:
      return '0';
  }
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
    const hasConstructorArgs = body.constructorArgs && typeof body.constructorArgs === 'object'
      && Object.keys(body.constructorArgs).length > 0;

    // Track if _caller is already provided
    let hasCaller = false;

    if (hasConstructorArgs) {
      args.push('--');
      for (const [argName, argValue] of Object.entries(body.constructorArgs!)) {
        const cleanName = argName.replace(/^-+/, '');
        const flag = `--${cleanName}`;
        let value = String(argValue);

        // Track if _caller is provided
        if (cleanName === '_caller' || cleanName === 'caller') {
          hasCaller = true;
          value = sourceAccount;
        }

        // Replace EVM-format addresses with the source account identity
        if (value.startsWith('0x') && value.length === 42) {
          value = sourceAccount;
        }

        args.push(flag, value);
      }
    }

    // Always add --_caller if not already provided (contracts using msg.sender need it)
    // We'll add it proactively, and if the contract doesn't need it, the retry logic will handle it
    if (!hasCaller) {
      if (!hasConstructorArgs) {
        args.push('--');
      }
      args.push('--_caller', sourceAccount);
    }

    // Execute the stellar CLI - with retry logic for missing constructor args
    let stdout: string;
    let stderr: string;
    try {
      const result = await execFileAsync(STELLAR_BIN, args, {
        cwd: PROJECT_ROOT,
        timeout: 120000,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (deployError: unknown) {
      const err = deployError as { message?: string; stderr?: string; stdout?: string };
      const errorOutput = `${err.message || ''}\n${err.stderr || ''}`;

      // Check if the error is about unexpected constructor arguments
      const unexpectedArgPattern = /unexpected argument '?--([^'"\s]+)'? found/g;
      const unexpectedArgs: string[] = [];
      let unexpectedMatch;
      while ((unexpectedMatch = unexpectedArgPattern.exec(errorOutput)) !== null) {
        unexpectedArgs.push(unexpectedMatch[1]);
      }

      // If there are unexpected args, retry without them
      if (unexpectedArgs.length > 0) {
        const cleanedArgs: string[] = [];
        let skipNext = false;
        for (let i = 0; i < args.length; i++) {
          if (skipNext) { skipNext = false; continue; }
          const isUnexpected = unexpectedArgs.some(ua => args[i] === `--${ua}`);
          if (isUnexpected) { skipNext = true; continue; }
          cleanedArgs.push(args[i]);
        }
        // Remove trailing '--' if no constructor args remain after it
        const sepIdx = cleanedArgs.indexOf('--');
        if (sepIdx >= 0 && sepIdx === cleanedArgs.length - 1) {
          cleanedArgs.pop();
        }
        const retryClean = await execFileAsync(STELLAR_BIN, cleanedArgs, {
          cwd: PROJECT_ROOT,
          timeout: 120000,
        });
        stdout = retryClean.stdout;
        stderr = retryClean.stderr;
      } else {
        // Check if the error is about missing constructor arguments
        const missingArgPattern = /(?:Missing required argument|required arguments were not provided).*?['`"]?(_caller|--([^'`"\s]+))['`"]?/g;
        const missingArgs: Array<{ name: string; type: string }> = [];
        let argMatch;
        while ((argMatch = missingArgPattern.exec(errorOutput)) !== null) {
          // Match can be either _caller directly or --argname
          const argName = argMatch[1] === '_caller' ? '_caller' : argMatch[2] || argMatch[1].replace(/^--/, '');
          if (argName && !missingArgs.find(a => a.name === argName)) {
            // Determine type from error message if available
            const typeMatch = errorOutput.match(new RegExp(`${argName}.*?of type\\s+(\\w+)`, 'i'));
            const argType = typeMatch ? typeMatch[1] : 'address';
            missingArgs.push({ name: argName, type: argType });
          }
        }
        // Also try clap's explicit format
        const missingArgPattern2 = /the following required arguments were not provided:\s*([\s\S]*?)(?:\n\n|$)/;
        const blockMatch = missingArgPattern2.exec(errorOutput);
        if (blockMatch) {
          const argLines = blockMatch[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('--') || l.includes('_caller'));
          for (const line of argLines) {
            let name = line.replace(/^--/, '').replace(/<.*>/, '').trim();
            // Handle _caller without -- prefix
            if (line.includes('_caller') && !name.includes('_caller')) {
              name = '_caller';
            }
            if (name && !missingArgs.find(a => a.name === name)) {
              const typeMatch = errorOutput.match(new RegExp(`${name}.*?of type\\s+(\\w+)`, 'i'));
              const argType = typeMatch ? typeMatch[1] : 'address';
              missingArgs.push({ name, type: argType });
            }
          }
        }

        if (missingArgs.length > 0) {
          // Retry with default constructor arguments
          const retryArgs = [...args];
          if (!retryArgs.includes('--')) {
            retryArgs.push('--');
          }
          const seen = new Set<string>();
          for (let i = 0; i < retryArgs.length; i++) {
            if (retryArgs[i].startsWith('--') && retryArgs[i] !== '--') {
              seen.add(retryArgs[i]);
            }
          }
          for (const arg of missingArgs) {
            const flag = `--${arg.name}`;
            if (seen.has(flag)) continue;
            seen.add(flag);
            const defaultValue = getDefaultForType(arg.type, body.contractName, arg.name, sourceAccount);
            retryArgs.push(flag, defaultValue);
          }

          const retryResult = await execFileAsync(STELLAR_BIN, retryArgs, {
            cwd: PROJECT_ROOT,
            timeout: 120000,
          });
          stdout = retryResult.stdout;
          stderr = retryResult.stderr;
        } else {
          throw deployError;
        }
      }
    }

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

