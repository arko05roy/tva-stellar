"use client";

import { useMemo } from "react";
import { createRpcClient, RpcClient } from "@tva-protocol/sdk/rpc";
import type { EvmBlock } from "@tva-protocol/sdk/types";
import { DEFAULT_RPC_URL } from "../lib/constants";

/**
 * Hook to get a singleton RPC client instance
 */
export function useTvaRpc(): RpcClient {
  const rpc = useMemo(() => {
    return createRpcClient(DEFAULT_RPC_URL);
  }, []);

  return rpc;
}

/**
 * Get RPC client instance (non-hook version for server components or callbacks)
 */
let _rpcClient: RpcClient | null = null;

export function getRpcClient(): RpcClient {
  if (!_rpcClient) {
    _rpcClient = createRpcClient(DEFAULT_RPC_URL);
  }
  return _rpcClient;
}

/**
 * Parse hex string to number
 */
function hexToNumber(hex: string | number): number {
  if (typeof hex === "number") return hex;
  if (!hex || hex === "0x") return 0;
  return parseInt(hex, 16);
}

/**
 * Parse hex string to bigint
 */
function hexToBigInt(hex: string | number | bigint): bigint {
  if (typeof hex === "bigint") return hex;
  if (typeof hex === "number") return BigInt(hex);
  if (!hex || hex === "0x") return BigInt(0);
  return BigInt(hex);
}

/**
 * Parse raw RPC block response (hex strings) into typed EvmBlock
 * The RPC returns all numeric values as hex strings (e.g., "0x1a4")
 * but our components expect parsed numbers/bigints.
 */
export function parseBlock(raw: any): EvmBlock | null {
  if (!raw) return null;
  return {
    number: hexToNumber(raw.number),
    hash: raw.hash || "",
    parentHash: raw.parentHash || raw.parent_hash || "",
    timestamp: hexToNumber(raw.timestamp),
    miner: raw.miner || "0x0000000000000000000000000000000000000000",
    difficulty: hexToBigInt(raw.difficulty),
    totalDifficulty: hexToBigInt(raw.totalDifficulty || raw.total_difficulty || "0x0"),
    gasLimit: hexToBigInt(raw.gasLimit || raw.gas_limit || "0x0"),
    gasUsed: hexToBigInt(raw.gasUsed || raw.gas_used || "0x0"),
    transactions: Array.isArray(raw.transactions) ? raw.transactions : [],
    transactionsRoot: raw.transactionsRoot || raw.transactions_root || "",
    stateRoot: raw.stateRoot || raw.state_root || "",
    receiptsRoot: raw.receiptsRoot || raw.receipts_root || "",
    logsBloom: raw.logsBloom || raw.logs_bloom || "",
    nonce: raw.nonce || "0x0",
    extraData: raw.extraData || raw.extra_data || "0x",
  };
}
