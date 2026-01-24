import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

const DEPLOYMENTS_LOG = path.resolve(process.cwd(), '..', 'artifacts', 'deployments.log');

// Old format: 2025-01-24T16:11:42+00:00 | ContractName | ContractId
const OLD_FORMAT_REGEX = /^(\S+)\s*\|\s*(\S+)\s*\|\s*(\S+)$/;

// New format: [2026-01-24T12:00:00.000Z] Deployed "ContractName" => CABC...XYZ | source: ... | explorer: https://...
const NEW_FORMAT_REGEX = /^\[(.+?)\]\s+Deployed\s+"(.+?)"\s+=>\s+(\S+)\s*\|.*?explorer:\s*(https?:\/\/\S+)$/;

interface Deployment {
  timestamp: string;
  contractName: string;
  contractId: string;
  explorerUrl?: string;
}

function parseLine(line: string): Deployment | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Try new format first (more specific pattern)
  const newMatch = trimmed.match(NEW_FORMAT_REGEX);
  if (newMatch) {
    return {
      timestamp: newMatch[1],
      contractName: newMatch[2],
      contractId: newMatch[3],
      explorerUrl: newMatch[4],
    };
  }

  // Try old format
  const oldMatch = trimmed.match(OLD_FORMAT_REGEX);
  if (oldMatch) {
    return {
      timestamp: oldMatch[1],
      contractName: oldMatch[2],
      contractId: oldMatch[3],
    };
  }

  return null;
}

export async function GET(
  _request: NextRequest
): Promise<NextResponse<{ deployments: Deployment[] }>> {
  try {
    const content = await readFile(DEPLOYMENTS_LOG, 'utf-8');
    const lines = content.split('\n');

    const deployments: Deployment[] = [];
    for (const line of lines) {
      const parsed = parseLine(line);
      if (parsed) {
        deployments.push(parsed);
      }
    }

    // Sort by most recent first
    deployments.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ deployments });
  } catch (error: unknown) {
    // If file doesn't exist or can't be read, return empty array
    if (
      error instanceof Error &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === 'ENOENT'
    ) {
      return NextResponse.json({ deployments: [] });
    }

    // For other unexpected errors, still return empty to be safe
    return NextResponse.json({ deployments: [] });
  }
}
