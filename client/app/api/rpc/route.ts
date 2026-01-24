import { NextRequest, NextResponse } from "next/server";

const RPC_URL = process.env.TVA_RPC_URL || "http://localhost:8545";

/**
 * JSON-RPC Proxy to TVA RPC Server
 * Proxies eth_*, net_*, web3_* calls to the Rust RPC server,
 * avoiding CORS issues and allowing server-side configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate JSON-RPC format
    if (!body.method || body.jsonrpc !== "2.0") {
      return NextResponse.json(
        { jsonrpc: "2.0", id: body.id || null, error: { code: -32600, message: "Invalid Request" } },
        { status: 400 }
      );
    }

    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { jsonrpc: "2.0", id: body.id || null, error: { code: -32603, message: `RPC server error: ${response.status}` } },
        { status: 502 }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error: any) {
    // Handle connection refused / timeout
    if (error.code === "ECONNREFUSED" || error.name === "AbortError" || error.cause?.code === "ECONNREFUSED") {
      return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: -32603, message: "RPC server unavailable" } },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: error.message || "Internal error" } },
      { status: 500 }
    );
  }
}
