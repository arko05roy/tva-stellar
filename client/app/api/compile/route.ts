import { NextRequest, NextResponse } from 'next/server';
import { execSync, spawn } from 'child_process';
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

function parseCompilerOutput(output: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!output || output.trim().length === 0) {
    return { errors, warnings };
  }

  const lines = output.split('\n').filter((line) => line.trim().length > 0);

  let currentMessage = '';
  let currentType: 'error' | 'warning' | null = null;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Check for error indicators
    if (lowerLine.includes('error:') || lowerLine.includes('error[') || 
        lowerLine.includes('fatal:') || lowerLine.includes('failed') ||
        (lowerLine.includes('error') && (lowerLine.includes('at') || lowerLine.includes('line')))) {
      if (currentMessage && currentType) {
        if (currentType === 'error') errors.push(currentMessage.trim());
        else warnings.push(currentMessage.trim());
      }
      currentMessage = line;
      currentType = 'error';
    } else if (lowerLine.includes('warning:') || lowerLine.includes('warning[')) {
      if (currentMessage && currentType) {
        if (currentType === 'error') errors.push(currentMessage.trim());
        else warnings.push(currentMessage.trim());
      }
      currentMessage = line;
      currentType = 'warning';
    } else if (currentType) {
      // Continue building the current message
      currentMessage += '\n' + line;
      // Stop if we hit an empty line or a new error/warning starts
      if (line.trim().length === 0 && currentMessage.trim().length > 0) {
        if (currentType === 'error') errors.push(currentMessage.trim());
        else warnings.push(currentMessage.trim());
        currentMessage = '';
        currentType = null;
      }
    }
  }

  if (currentMessage && currentType) {
    if (currentType === 'error') errors.push(currentMessage.trim());
    else warnings.push(currentMessage.trim());
  }

  return { errors, warnings };
}

/**
 * Transform msg.sender patterns for Soroban compatibility.
 * - Constructor: adds `address _caller` param and replaces `msg.sender` with `_caller`
 * - Regular functions: removes `if (msg.sender != X) { return; }` access control blocks
 *   since Soroban handles authorization at the runtime level.
 *
 * This avoids the inkwell panic that occurs when `address` is the first parameter
 * of a non-constructor public function in solang's Soroban target.
 */
function transformMsgSender(source: string): string {
  let result = source;

  // Step 1: Transform the constructor - add _caller param and replace msg.sender
  const constructorRegex = /constructor\s*\(([^)]*)\)/;
  const constructorMatch = result.match(constructorRegex);
  if (constructorMatch) {
    const existingParams = constructorMatch[1].trim();
    const newParams = existingParams
      ? `address _caller, ${existingParams}`
      : 'address _caller';
    result = result.replace(constructorRegex, `constructor(${newParams})`);
  }

  // Step 2: Replace msg.sender with _caller ONLY inside the constructor body
  // Find constructor body boundaries
  const constructorBodyStart = result.indexOf('constructor');
  if (constructorBodyStart !== -1) {
    const braceStart = result.indexOf('{', constructorBodyStart);
    if (braceStart !== -1) {
      let depth = 0;
      let braceEnd = -1;
      for (let i = braceStart; i < result.length; i++) {
        if (result[i] === '{') depth++;
        else if (result[i] === '}') {
          depth--;
          if (depth === 0) { braceEnd = i; break; }
        }
      }
      if (braceEnd !== -1) {
        const beforeConstructor = result.slice(0, braceStart + 1);
        const constructorBody = result.slice(braceStart + 1, braceEnd);
        const afterConstructor = result.slice(braceEnd);

        const transformedBody = constructorBody.replace(/msg\.sender/g, '_caller');
        result = beforeConstructor + transformedBody + afterConstructor;
      }
    }
  }

  // Step 3: Remove msg.sender access control checks from regular functions.
  // Patterns:
  //   if (msg.sender != X) { return; }
  //   if (msg.sender != X) { return 0; }
  //   if (X != msg.sender) { return; }
  //   if (X != msg.sender) { return 0; }
  //   Multi-line variants
  const accessControlPatterns = [
    // Single-line: if (msg.sender != X) { return; } or { return 0; }
    /if\s*\(\s*msg\.sender\s*!=\s*[^)]+\)\s*\{\s*return\s*[^;]*;\s*\}/g,
    // Single-line reversed: if (X != msg.sender) { return; }
    /if\s*\(\s*[^)]+\s*!=\s*msg\.sender\s*\)\s*\{\s*return\s*[^;]*;\s*\}/g,
    // Multi-line: if (msg.sender != X) {\n  return;\n}
    /if\s*\(\s*msg\.sender\s*!=\s*[^)]+\)\s*\{[^}]*return\s*[^;]*;[^}]*\}/g,
    // Multi-line reversed
    /if\s*\(\s*[^)]+\s*!=\s*msg\.sender\s*\)\s*\{[^}]*return\s*[^;]*;[^}]*\}/g,
    // Equality check (for patterns like if (msg.sender == owner) used in positive checks)
    // Keep these - they're not access control blocks
  ];

  for (const pattern of accessControlPatterns) {
    result = result.replace(pattern, '');
  }

  // Step 4: Remove any remaining msg.sender references in regular functions
  // (after constructor processing, these would be in non-constructor code)
  // Replace comparisons like `msg.sender == X` with `true` (for return statements)
  result = result.replace(/msg\.sender\s*==\s*\w+/g, 'true');
  result = result.replace(/\w+\s*==\s*msg\.sender/g, 'true');

  // Clean up any double blank lines created by removing blocks
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
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

    // If source contains msg.sender, perform Soroban-compatible transformations.
    // The solang compiler panics when address is the first parameter of non-constructor
    // public functions, so we only inject _caller into constructors and remove
    // msg.sender-based access control checks from regular functions (Soroban handles
    // authorization at the runtime level).
    if (source.includes('msg.sender')) {
      processedSource = transformMsgSender(source);
    }

    // Write the (possibly preprocessed) source to the temp file
    writeFileSync(sourceFilePath, processedSource, 'utf-8');

    // Run solang compiler with --target soroban using spawn to properly capture output
    const compileArgs = ['compile', sourceFilePath, '--target', 'soroban', '-o', outputDir];
    
    let compileStdout = '';
    let compileStderr = '';
    let compileExitCode = 0;
    const warnings: string[] = [];

    try {
      // Use spawn to properly capture both stdout and stderr
      const compileProcess = spawn(solangPath, compileArgs, {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      compileProcess.stdout.on('data', (data) => {
        compileStdout += data.toString();
      });

      compileProcess.stderr.on('data', (data) => {
        compileStderr += data.toString();
      });

      // Wait for process to complete
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          compileProcess.kill();
          reject(new Error('Compilation timeout'));
        }, 60000);

        compileProcess.on('close', (code) => {
          clearTimeout(timeout);
          compileExitCode = code ?? 1;
          resolve();
        });

        compileProcess.on('error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
    } catch (compileError: unknown) {
      const err = compileError as { message?: string };
      // If spawn failed, try to get error message
      if (!compileStderr && err.message) {
        compileStderr = err.message;
      }
    }

    // Combine stdout and stderr for error parsing (Solang may output errors to either)
    const combinedOutput = compileStderr + '\n' + compileStdout;
    const parsed = parseCompilerOutput(combinedOutput);

    // Collect warnings regardless of outcome
    warnings.push(...parsed.warnings);

    // Check for WASM output first - the compiler may produce valid output
    // even with a non-zero exit code (e.g., when there are only warnings)
    let wasmFile: string | undefined;
    let abiFile: string | undefined;
    if (existsSync(outputDir)) {
      const outputFiles = readdirSync(outputDir);
      wasmFile = outputFiles.find((f) => f.endsWith('.wasm'));
      abiFile = outputFiles.find((f) => f.endsWith('.json') || f.endsWith('.abi'));
    }

    // If no WASM was produced and there were errors or non-zero exit, report failure
    if (!wasmFile) {
      if (parsed.errors.length > 0) {
        return NextResponse.json(
          {
            success: false,
            errors: parsed.errors,
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          { status: 422 }
        );
      }

      if (compileExitCode !== 0) {
        // Try to extract meaningful error from output
        if (combinedOutput.trim()) {
          const errorLines = combinedOutput.split('\n').filter(line =>
            line.trim().length > 0
          );

          if (errorLines.length > 0) {
            return NextResponse.json(
              {
                success: false,
                errors: errorLines.slice(0, 5),
                warnings: warnings.length > 0 ? warnings : undefined,
              },
              { status: 422 }
            );
          }
        }

        return NextResponse.json(
          {
            success: false,
            errors: ['Compilation failed with no error details'],
            warnings: warnings.length > 0 ? warnings : undefined,
          },
          { status: 422 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          errors: ['Compilation produced no WASM output'],
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
      const stderrParsed = parseCompilerOutput(compileStderr);
      warnings.push(...stderrParsed.warnings);
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
