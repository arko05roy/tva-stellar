import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execFileAsync = promisify(execFile);

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const STELLAR_BIN = path.join(PROJECT_ROOT, 'tooling', 'bin', 'stellar');

interface CallRequestBody {
  contractId: string;
  functionName: string;
  args?: string[];
  namedArgs?: Record<string, string>;
  isView: boolean;
}

interface CallResponse {
  success: boolean;
  result?: any;
  error?: string;
  txHash?: string;
  gasUsed?: string;
}

function parseResult(output: string): any {
  const trimmed = output.trim();

  // Try to parse as JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Not JSON, continue
  }

  // Check for common Soroban output formats
  if (trimmed === 'null' || trimmed === '()') {
    return null;
  }

  // Check for boolean
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;

  // Check for number (u32, i32, u64, i64, u128, i128)
  if (/^-?\d+$/.test(trimmed)) {
    const num = BigInt(trimmed);
    // Return as number if safe, otherwise as string
    if (num >= Number.MIN_SAFE_INTEGER && num <= Number.MAX_SAFE_INTEGER) {
      return Number(num);
    }
    return trimmed;
  }

  // Check for quoted string
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  // Return as-is
  return trimmed;
}

export async function POST(request: NextRequest): Promise<NextResponse<CallResponse>> {
  try {
    const body: CallRequestBody = await request.json();

    if (!body.contractId || typeof body.contractId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "contractId" field.' },
        { status: 400 }
      );
    }

    if (!body.functionName || typeof body.functionName !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "functionName" field.' },
        { status: 400 }
      );
    }

    // Determine source account
    const sourceAccount = process.env.TVA_SOURCE || 'tva-deployer';

    // Build base invoke command arguments
    const baseArgs: string[] = [
      'contract',
      'invoke',
      '--id',
      body.contractId,
      '--source-account',
      sourceAccount,
      '--network-passphrase',
      'Test SDF Network ; September 2015',
      '--rpc-url',
      'https://soroban-testnet.stellar.org',
      '--',
      body.functionName,
    ];

    // Collect user-provided function arguments
    const fnArgs: string[] = [];
    if (body.namedArgs && typeof body.namedArgs === 'object' && Object.keys(body.namedArgs).length > 0) {
      for (const [paramName, paramValue] of Object.entries(body.namedArgs)) {
        if (paramName === '_caller' || paramName === 'caller') continue;
        const flag = paramName.startsWith('-') ? paramName : `--${paramName}`;
        fnArgs.push(flag, String(paramValue));
      }
    } else if (body.args && Array.isArray(body.args) && body.args.length > 0) {
      for (const arg of body.args) {
        fnArgs.push(String(arg));
      }
    }

    // Try without _caller first (works for auto-generated getters),
    // retry with _caller if the function requires it (explicit functions using msg.sender)
    let stdout: string;
    let stderr: string;
    try {
      const result = await execFileAsync(STELLAR_BIN, [...baseArgs, ...fnArgs], {
        cwd: PROJECT_ROOT,
        timeout: 60000,
      });
      stdout = result.stdout.trim();
      stderr = result.stderr.trim();
    } catch (firstError: unknown) {
      const firstErr = firstError as { message?: string; stderr?: string };
      const errText = `${firstErr.message || ''} ${firstErr.stderr || ''}`;

      // If the error indicates _caller is required, retry with it
      if (errText.includes('_caller') || errText.includes('missing') || errText.includes('required argument')) {
        const result = await execFileAsync(STELLAR_BIN, [...baseArgs, '--_caller', sourceAccount, ...fnArgs], {
          cwd: PROJECT_ROOT,
          timeout: 60000,
        });
        stdout = result.stdout.trim();
        stderr = result.stderr.trim();
      } else {
        throw firstError;
      }
    }

    // Parse the result
    const parsedResult = parseResult(stdout);

    // Try to extract transaction hash from stderr if it's a write operation
    let txHash: string | undefined;
    const txHashMatch = stderr.match(/[a-f0-9]{64}/i);
    if (txHashMatch && !body.isView) {
      txHash = txHashMatch[0];
    }

    return NextResponse.json({
      success: true,
      result: parsedResult,
      txHash,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; stderr?: string; stdout?: string };
    const errorMessage = err.stderr || err.message || 'Unknown error during contract call';

    // Clean up error message
    const cleanError = errorMessage
      .replace(/error:/gi, '')
      .replace(/\n+/g, ' ')
      .trim()
      .slice(0, 200);

    return NextResponse.json(
      { success: false, error: cleanError || 'Contract call failed' },
      { status: 500 }
    );
  }
}
