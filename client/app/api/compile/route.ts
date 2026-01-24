import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

interface CompileRequest {
  source: string;
  filename: string;
}

interface CompileResponse {
  success: boolean;
  wasm?: string;
  abi?: object;
  errors?: string[];
  warnings?: string[];
  size?: number;
  hash?: string;
}

function getProjectRoot(): string {
  // The project root is the parent of the 'client' directory.
  // process.cwd() in Next.js points to the client directory during runtime.
  const cwd = process.cwd();
  if (cwd.endsWith('/client')) {
    return resolve(cwd, '..');
  }
  // Fallback: traverse up from this file's location
  return resolve(cwd, '..');
}

function getSolangPath(projectRoot: string): string {
  return resolve(projectRoot, 'tooling/bin/solang');
}

function getMsgSenderShimPath(projectRoot: string): string {
  return resolve(projectRoot, 'tooling/msg-sender-shim/target/release/msg-sender-shim');
}

function parseCompilerOutput(stderr: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = stderr.split('\n').filter((line) => line.trim().length > 0);

  let currentMessage = '';
  let currentType: 'error' | 'warning' | null = null;

  for (const line of lines) {
    if (line.includes('error:') || line.includes('error[')) {
      if (currentMessage && currentType) {
        if (currentType === 'error') errors.push(currentMessage.trim());
        else warnings.push(currentMessage.trim());
      }
      currentMessage = line;
      currentType = 'error';
    } else if (line.includes('warning:') || line.includes('warning[')) {
      if (currentMessage && currentType) {
        if (currentType === 'error') errors.push(currentMessage.trim());
        else warnings.push(currentMessage.trim());
      }
      currentMessage = line;
      currentType = 'warning';
    } else if (currentType) {
      currentMessage += '\n' + line;
    }
  }

  if (currentMessage && currentType) {
    if (currentType === 'error') errors.push(currentMessage.trim());
    else warnings.push(currentMessage.trim());
  }

  return { errors, warnings };
}

export async function POST(request: NextRequest): Promise<NextResponse<CompileResponse>> {
  let tempDir: string | null = null;

  try {
    const body: CompileRequest = await request.json();
    const { source, filename } = body;

    if (!source || !filename) {
      return NextResponse.json(
        {
          success: false,
          errors: ['Missing required fields: source and filename'],
        },
        { status: 400 }
      );
    }

    // Validate filename to prevent path traversal
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!sanitizedFilename.endsWith('.sol')) {
      return NextResponse.json(
        {
          success: false,
          errors: ['Filename must have a .sol extension'],
        },
        { status: 400 }
      );
    }

    const projectRoot = getProjectRoot();
    const solangPath = getSolangPath(projectRoot);
    const shimPath = getMsgSenderShimPath(projectRoot);

    // Verify solang binary exists
    if (!existsSync(solangPath)) {
      return NextResponse.json(
        {
          success: false,
          errors: [`Solang compiler not found at: ${solangPath}`],
        },
        { status: 500 }
      );
    }

    // Create temporary directory for compilation
    tempDir = mkdtempSync(join(tmpdir(), 'tva-compile-'));
    const sourceFilePath = join(tempDir, sanitizedFilename);
    const outputDir = join(tempDir, 'output');

    let processedSource = source;

    // If source contains msg.sender, run the msg-sender-shim preprocessor
    if (source.includes('msg.sender')) {
      if (!existsSync(shimPath)) {
        return NextResponse.json(
          {
            success: false,
            errors: [`msg-sender-shim preprocessor not found at: ${shimPath}`],
          },
          { status: 500 }
        );
      }

      // Write original source to temp file for shim processing
      const shimInputPath = join(tempDir, 'shim_input.sol');
      writeFileSync(shimInputPath, source, 'utf-8');

      try {
        const shimOutput = execSync(`"${shimPath}" "${shimInputPath}"`, {
          encoding: 'utf-8',
          timeout: 30000,
          cwd: tempDir,
        });
        processedSource = shimOutput;
      } catch (shimError: unknown) {
        const err = shimError as { stderr?: string; message?: string };
        return NextResponse.json(
          {
            success: false,
            errors: [
              `msg-sender-shim preprocessing failed: ${err.stderr || err.message || 'Unknown error'}`,
            ],
          },
          { status: 422 }
        );
      }
    }

    // Write the (possibly preprocessed) source to the temp file
    writeFileSync(sourceFilePath, processedSource, 'utf-8');

    // Run solang compiler with --target soroban
    const compileCommand = `"${solangPath}" compile "${sourceFilePath}" --target soroban -o "${outputDir}"`;

    let compileStderr = '';
    const warnings: string[] = [];

    try {
      execSync(compileCommand, {
        encoding: 'utf-8',
        timeout: 60000,
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (compileError: unknown) {
      const err = compileError as { stderr?: string; stdout?: string; status?: number };
      compileStderr = err.stderr || '';

      const parsed = parseCompilerOutput(compileStderr);

      // If there are actual errors (not just warnings), return failure
      if (parsed.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            errors: parsed.errors,
            warnings: parsed.warnings.length > 0 ? parsed.warnings : undefined,
          },
          { status: 422 }
        );
      }

      // If only warnings, continue
      warnings.push(...parsed.warnings);
    }

    // Look for the compiled WASM output
    if (!existsSync(outputDir)) {
      return NextResponse.json(
        {
          success: false,
          errors: ['Compilation produced no output directory'],
          warnings: warnings.length > 0 ? warnings : undefined,
        },
        { status: 422 }
      );
    }

    const outputFiles = readdirSync(outputDir);
    const wasmFile = outputFiles.find((f) => f.endsWith('.wasm'));
    const abiFile = outputFiles.find((f) => f.endsWith('.json') || f.endsWith('.abi'));

    if (!wasmFile) {
      // Check if stderr had warnings we missed
      if (compileStderr) {
        const parsed = parseCompilerOutput(compileStderr);
        warnings.push(...parsed.warnings);
      }

      return NextResponse.json(
        {
          success: false,
          errors: ['Compilation did not produce a WASM file'],
          warnings: warnings.length > 0 ? warnings : undefined,
        },
        { status: 422 }
      );
    }

    // Read the WASM binary
    const wasmPath = join(outputDir, wasmFile);
    const wasmBuffer = readFileSync(wasmPath);
    const wasmBase64 = wasmBuffer.toString('base64');
    const wasmSize = wasmBuffer.length;

    // Compute SHA256 hash of the WASM binary
    const hash = createHash('sha256').update(wasmBuffer).digest('hex');

    // Read ABI if available
    let abi: object | undefined;
    if (abiFile) {
      try {
        const abiContent = readFileSync(join(outputDir, abiFile), 'utf-8');
        abi = JSON.parse(abiContent);
      } catch {
        // ABI parsing failed, continue without it
      }
    }

    // Parse any remaining warnings from stderr
    if (compileStderr && warnings.length === 0) {
      const parsed = parseCompilerOutput(compileStderr);
      warnings.push(...parsed.warnings);
    }

    const response: CompileResponse = {
      success: true,
      wasm: wasmBase64,
      abi,
      size: wasmSize,
      hash,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      {
        success: false,
        errors: [err.message || 'Internal compilation error'],
      },
      { status: 500 }
    );
  } finally {
    // Clean up temp files
    if (tempDir && existsSync(tempDir)) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    }
  }
}
