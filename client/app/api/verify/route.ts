import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';
import os from 'os';

interface VerifyRequest {
  source: string;
  filename: string;
  existingHash?: string;
  contractId?: string;
}

interface VerifyResponse {
  verified: boolean;
  hash: string;
  existingHash?: string;
  onChainHash?: string;
  hashMatch: boolean;
  onChainMatch?: boolean;
  onChainVerified?: boolean;
  size: number;
  errors?: string[];
}

export async function POST(request: NextRequest) {
  const errors: string[] = [];
  let tmpDir = '';

  try {
    const body: VerifyRequest = await request.json();
    const { source, filename, existingHash, contractId } = body;

    if (!source || !filename) {
      return NextResponse.json(
        { error: 'Missing required fields: source and filename' },
        { status: 400 }
      );
    }

    const projectRoot = path.resolve(process.cwd(), '..');
    const solangBin = path.join(projectRoot, 'tooling', 'bin', 'solang');
    const msgSenderShim = path.join(
      projectRoot,
      'tooling',
      'msg-sender-shim',
      'target',
      'release',
      'msg-sender-shim'
    );

    // Create a temporary directory for compilation
    tmpDir = path.join(os.tmpdir(), `tva-verify-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });

    // Determine the source file to compile
    let sourceToCompile = source;
    const sourceFilePath = path.join(tmpDir, filename);

    // Preprocess with msg-sender-shim if source contains msg.sender
    if (source.includes('msg.sender')) {
      writeFileSync(sourceFilePath, source, 'utf-8');

      try {
        sourceToCompile = execSync(
          `"${msgSenderShim}" "${sourceFilePath}"`,
          { encoding: 'utf-8', timeout: 30000 }
        );
      } catch (shimError: unknown) {
        const errorMessage =
          shimError instanceof Error ? shimError.message : String(shimError);
        errors.push(`msg-sender-shim preprocessing failed: ${errorMessage}`);
        // Fall back to original source
        sourceToCompile = source;
      }
    }

    // Write the (possibly preprocessed) source to the temp file
    writeFileSync(sourceFilePath, sourceToCompile, 'utf-8');

    // Run solang compiler with --target soroban
    const outputDir = path.join(tmpDir, 'output');
    mkdirSync(outputDir, { recursive: true });

    try {
      execSync(
        `"${solangBin}" compile "${sourceFilePath}" --target soroban -o "${outputDir}"`,
        {
          encoding: 'utf-8',
          timeout: 60000,
          cwd: tmpDir,
        }
      );
    } catch (compileError: unknown) {
      const errorMessage =
        compileError instanceof Error ? compileError.message : String(compileError);
      errors.push(`Solang compilation failed: ${errorMessage}`);

      return NextResponse.json(
        {
          verified: false,
          hash: '',
          existingHash: existingHash || undefined,
          hashMatch: false,
          onChainMatch: contractId ? false : undefined,
          size: 0,
          errors,
        } as VerifyResponse,
        { status: 200 }
      );
    }

    // Find the compiled WASM file
    const wasmFilename = filename.replace(/\.sol$/, '.wasm');
    let wasmPath = path.join(outputDir, wasmFilename);

    // If the expected wasm file does not exist, look for any .wasm file in output
    if (!existsSync(wasmPath)) {
      const { readdirSync } = await import('fs');
      const outputFiles = readdirSync(outputDir);
      const wasmFile = outputFiles.find((f: string) => f.endsWith('.wasm'));
      if (wasmFile) {
        wasmPath = path.join(outputDir, wasmFile);
      } else {
        errors.push('No WASM output file found after compilation');
        return NextResponse.json(
          {
            verified: false,
            hash: '',
            existingHash: existingHash || undefined,
            hashMatch: false,
            onChainMatch: contractId ? false : undefined,
            size: 0,
            errors,
          } as VerifyResponse,
          { status: 200 }
        );
      }
    }

    // Read the WASM and compute SHA256 hash
    const wasmBuffer = readFileSync(wasmPath);
    const computedHash = createHash('sha256').update(wasmBuffer).digest('hex');
    const wasmSize = wasmBuffer.length;

    // Compare with existing hash if provided
    let hashMatch = false;
    if (existingHash) {
      hashMatch = computedHash.toLowerCase() === existingHash.toLowerCase();
      if (!hashMatch) {
        errors.push(
          `Hash mismatch: computed ${computedHash} vs provided ${existingHash}`
        );
      }
    }

    // Fetch on-chain hash if contractId is provided
    let onChainHash: string | undefined;
    let onChainMatch: boolean | undefined;

    if (contractId) {
      const stellarBin = path.join(projectRoot, 'tooling', 'bin', 'stellar');

      try {
        const onChainResult = execSync(
          `"${stellarBin}" contract info wasm-hash --id ${contractId} --network-passphrase "Test SDF Network ; September 2015" --rpc-url https://soroban-testnet.stellar.org`,
          {
            encoding: 'utf-8',
            timeout: 30000,
          }
        ).trim();

        onChainHash = onChainResult;
        onChainMatch = computedHash.toLowerCase() === onChainHash.toLowerCase();

        if (!onChainMatch) {
          errors.push(
            `On-chain hash mismatch: computed ${computedHash} vs on-chain ${onChainHash}`
          );
        }
      } catch (stellarError: unknown) {
        const errorMessage =
          stellarError instanceof Error
            ? stellarError.message
            : String(stellarError);
        errors.push(`Failed to fetch on-chain hash: ${errorMessage}`);
        onChainMatch = false;
      }
    }

    // Determine overall verification status
    const verified =
      (existingHash ? hashMatch : true) &&
      (contractId ? onChainMatch === true : true) &&
      errors.length === 0;

    // If hash matches and contract ID is provided, submit to Stellar VerificationRegistry
    let onChainVerified = false;
    if (verified && contractId && onChainMatch) {
      try {
        const rpcUrl = process.env.TVA_RPC_URL || 'http://localhost:8545';
        const verifyResponse = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'tva_verifyContract',
            params: [
              contractId,
              source,
              '0.3.0', // Compiler version
              '--target soroban',
              JSON.stringify({
                abi: '{}', // TODO: Include ABI if available
                wasmHash: computedHash,
                size: wasmSize,
              }),
            ],
            id: 1,
          }),
        });

        if (verifyResponse.ok) {
          const verifyResult = await verifyResponse.json();
          if (verifyResult.result && verifyResult.result.verified) {
            onChainVerified = true;
          } else if (verifyResult.error) {
            errors.push(`Stellar verification failed: ${verifyResult.error.message || JSON.stringify(verifyResult.error)}`);
          }
        } else {
          const errorText = await verifyResponse.text();
          errors.push(`Stellar verification request failed: ${errorText}`);
        }
      } catch (verifyError: unknown) {
        const errorMessage =
          verifyError instanceof Error ? verifyError.message : String(verifyError);
        errors.push(`Failed to submit to Stellar: ${errorMessage}`);
        // Don't fail overall verification if Stellar submission fails
      }
    }

    const response: VerifyResponse = {
      verified,
      hash: computedHash,
      existingHash: existingHash || undefined,
      onChainHash,
      hashMatch,
      onChainMatch,
      onChainVerified,
      size: wasmSize,
      errors: errors.length > 0 ? errors : undefined,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    errors.push(`Unexpected error: ${errorMessage}`);

    return NextResponse.json(
      {
        verified: false,
        hash: '',
        hashMatch: false,
        size: 0,
        errors,
      } as VerifyResponse,
      { status: 500 }
    );
  } finally {
    // Clean up temporary directory
    if (tmpDir && existsSync(tmpDir)) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {
        // Silently ignore cleanup errors
      }
    }
  }
}
