#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# PID files for cleanup
RPC_PID_FILE="/tmp/tva-rpc.pid"
BLOCKSCOUT_PID_FILE="/tmp/tva-blockscout.pid"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Shutting down services...${NC}"
    
    # Stop RPC server
    if [ -f "$RPC_PID_FILE" ]; then
        RPC_PID=$(cat "$RPC_PID_FILE")
        if kill -0 "$RPC_PID" 2>/dev/null; then
            echo -e "${YELLOW}Stopping RPC server (PID: $RPC_PID)...${NC}"
            kill "$RPC_PID" 2>/dev/null || true
            wait "$RPC_PID" 2>/dev/null || true
        fi
        rm -f "$RPC_PID_FILE"
    fi
    
    # Stop Blockscout
    if [ -f "$BLOCKSCOUT_PID_FILE" ]; then
        echo -e "${YELLOW}Stopping Blockscout...${NC}"
        cd "$SCRIPT_DIR/blockscout"
        docker-compose down > /dev/null 2>&1 || true
        rm -f "$BLOCKSCOUT_PID_FILE"
    fi
    
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Trap signals for cleanup
trap cleanup SIGINT SIGTERM EXIT

# Check prerequisites
echo -e "${BLUE}=== TVA Protocol Startup Script ===${NC}\n"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed or not in PATH${NC}"
    exit 1
fi

if ! docker ps &> /dev/null; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    exit 1
fi

# Check Rust/Cargo
if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: Rust/Cargo is not installed${NC}"
    exit 1
fi

# Check .env file
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo -e "${YELLOW}Creating .env from .env.example if available...${NC}"
    if [ -f "$SCRIPT_DIR/.env.example" ]; then
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        echo -e "${YELLOW}Please edit .env and set STELLAR_SECRET_KEY${NC}"
    else
        echo -e "${RED}Error: .env file is required. Please create one with STELLAR_SECRET_KEY${NC}"
        exit 1
    fi
fi

# Check if STELLAR_SECRET_KEY is set
if ! grep -q "STELLAR_SECRET_KEY=" "$SCRIPT_DIR/.env" || grep -q "STELLAR_SECRET_KEY=SAX" "$SCRIPT_DIR/.env"; then
    echo -e "${YELLOW}Warning: STELLAR_SECRET_KEY appears to be a placeholder${NC}"
    echo -e "${YELLOW}Please set a valid Stellar secret key in .env file${NC}"
fi

# Check Solang compiler
if [ ! -f "$SCRIPT_DIR/tooling/bin/solang" ]; then
    echo -e "${YELLOW}Warning: Solang compiler not found at tooling/bin/solang${NC}"
    echo -e "${YELLOW}Some features may not work without it${NC}"
fi

echo -e "${GREEN}Prerequisites check passed${NC}\n"

# Start Blockscout
echo -e "${BLUE}Starting Blockscout...${NC}"
cd "$SCRIPT_DIR/blockscout"

# Check if Blockscout is already running
if docker-compose ps | grep -q "Up"; then
    echo -e "${YELLOW}Blockscout containers are already running${NC}"
else
    echo -e "${BLUE}Starting Blockscout containers...${NC}"
    docker-compose up -d
    
    # Wait for services to be healthy
    echo -e "${BLUE}Waiting for Blockscout services to be ready...${NC}"
    sleep 5
    
    # Check if services are up
    if docker-compose ps | grep -q "Up"; then
        echo -e "${GREEN}Blockscout started successfully${NC}"
    else
        echo -e "${RED}Error: Failed to start Blockscout${NC}"
        docker-compose logs --tail=20
        exit 1
    fi
fi

echo "blockscout" > "$BLOCKSCOUT_PID_FILE"
cd "$SCRIPT_DIR"

# Build RPC server if needed
echo -e "\n${BLUE}Building RPC server...${NC}"
cd "$SCRIPT_DIR/rpc"
if [ ! -f "target/release/tva-rpc" ] || [ "Cargo.toml" -nt "target/release/tva-rpc" ]; then
    echo -e "${BLUE}Compiling RPC server (this may take a minute)...${NC}"
    cargo build --release
else
    echo -e "${GREEN}RPC server already built${NC}"
fi

# Start RPC server
echo -e "\n${BLUE}Starting RPC server...${NC}"
cd "$SCRIPT_DIR/rpc"

# Load .env file
export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)

# Start RPC server in background
cargo run --release > /tmp/tva-rpc.log 2>&1 &
RPC_PID=$!
echo "$RPC_PID" > "$RPC_PID_FILE"

# Wait for RPC server to start
echo -e "${BLUE}Waiting for RPC server to start...${NC}"
sleep 3

# Check if RPC server is running
if kill -0 "$RPC_PID" 2>/dev/null; then
    # Test if RPC endpoint is responding
    for i in {1..10}; do
        if curl -s -X POST http://localhost:8545 \
            -H "Content-Type: application/json" \
            -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
            > /dev/null 2>&1; then
            echo -e "${GREEN}RPC server started successfully${NC}"
            break
        fi
        if [ $i -eq 10 ]; then
            echo -e "${YELLOW}Warning: RPC server may not be fully ready yet${NC}"
        else
            sleep 1
        fi
    done
else
    echo -e "${RED}Error: RPC server failed to start${NC}"
    echo -e "${RED}Check logs: tail -f /tmp/tva-rpc.log${NC}"
    exit 1
fi

# Print status
echo -e "\n${GREEN}=== TVA Protocol Services Started ===${NC}\n"
echo -e "${GREEN}✓${NC} Blockscout Backend:  ${BLUE}http://localhost:4000${NC}"
echo -e "${GREEN}✓${NC} Blockscout Frontend:  ${BLUE}http://localhost:3001${NC}"
echo -e "${GREEN}✓${NC} RPC Server:          ${BLUE}http://localhost:8545${NC}"
echo -e "${GREEN}✓${NC} Contract Verifier:   ${BLUE}http://localhost:8150${NC}"

echo -e "\n${BLUE}Useful commands:${NC}"
echo -e "  View RPC logs:     ${YELLOW}tail -f /tmp/tva-rpc.log${NC}"
echo -e "  View Blockscout:   ${YELLOW}docker-compose -f blockscout/docker-compose.yml logs -f${NC}"
echo -e "  Stop all services: ${YELLOW}Press Ctrl+C${NC}"

echo -e "\n${GREEN}Services are running. Press Ctrl+C to stop all services.${NC}\n"

# Keep script running and monitor processes
while true; do
    # Check if RPC server is still running
    if [ -f "$RPC_PID_FILE" ]; then
        RPC_PID=$(cat "$RPC_PID_FILE")
        if ! kill -0 "$RPC_PID" 2>/dev/null; then
            echo -e "${RED}RPC server stopped unexpectedly${NC}"
            echo -e "${RED}Check logs: tail -f /tmp/tva-rpc.log${NC}"
            cleanup
            exit 1
        fi
    fi
    
    # Check if Blockscout is still running
    if [ -f "$BLOCKSCOUT_PID_FILE" ]; then
        cd "$SCRIPT_DIR/blockscout"
        if ! docker-compose ps | grep -q "Up"; then
            echo -e "${RED}Blockscout stopped unexpectedly${NC}"
            cleanup
            exit 1
        fi
        cd "$SCRIPT_DIR"
    fi
    
    sleep 5
done

