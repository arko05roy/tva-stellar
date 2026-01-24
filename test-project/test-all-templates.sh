#!/bin/bash
# Test all Solidity templates compile with solang --target soroban
# Uses the same transformation logic as the compile route

SOLANG="/home/agnij/Desktop/TVA-Protocol/tooling/bin/solang"
TMPBASE=$(mktemp -d)
PASS=0
FAIL=0
WARN=0

cleanup() {
    rm -rf "$TMPBASE"
}
trap cleanup EXIT

# Transform msg.sender:
# 1. Add address _caller to constructor params
# 2. Replace msg.sender with _caller in constructor body
# 3. Remove if (msg.sender != X) { return; } blocks from regular functions
# 4. Remove remaining msg.sender equality checks
transform_source() {
    local src="$1"

    if ! echo "$src" | grep -q "msg.sender"; then
        echo "$src"
        return
    fi

    # Use perl for multi-step transformation
    echo "$src" | perl -0777 -pe '
        # Step 1: Add _caller to constructor params
        s/constructor\s*\(([^)]*)\)/
            my $params = $1;
            $params =~ s|^\s+||; $params =~ s|\s+$||;
            my $new_params = $params ? "address _caller, $params" : "address _caller";
            "constructor($new_params)"
        /ge;

        # Step 2: Replace msg.sender with _caller only in constructor body
        # Find constructor body and replace within it
        if (/constructor\s*\([^)]*\)\s*\{/) {
            my $before_body = $`;
            my $from_brace = $& . $'"'"';
            # Find matching closing brace
            my $pos = length($&) - 1; # position of opening {
            my $full = $before_body . $from_brace;
            my $depth = 0;
            my $start = index($full, "{", length($before_body));
            my $end = -1;
            for (my $i = $start; $i < length($full); $i++) {
                my $c = substr($full, $i, 1);
                if ($c eq "{") { $depth++; }
                elsif ($c eq "}") { $depth--; if ($depth == 0) { $end = $i; last; } }
            }
            if ($end > 0) {
                my $body = substr($full, $start+1, $end-$start-1);
                $body =~ s/msg\.sender/_caller/g;
                $_ = substr($full, 0, $start+1) . $body . substr($full, $end);
            }
        }

        # Step 3: Remove access control checks from regular functions
        # if (msg.sender != X) { return; } or { return 0; } etc
        s/\s*if\s*\(\s*msg\.sender\s*!=\s*[^)]+\)\s*\{[^}]*return[^}]*\}\s*\n?//g;
        s/\s*if\s*\(\s*[^)]+?\s*!=\s*msg\.sender\s*\)\s*\{[^}]*return[^}]*\}\s*\n?//g;

        # Step 4: Replace remaining msg.sender == X with true
        s/msg\.sender\s*==\s*\w+/true/g;
        s/\w+\s*==\s*msg\.sender/true/g;

        # Clean up multiple blank lines
        s/\n{3,}/\n\n/g;
    '
}

compile_template() {
    local name="$1"
    local file="$2"
    local source="$3"

    local workdir="$TMPBASE/$name"
    mkdir -p "$workdir/output"

    local srcfile="$workdir/$file"

    # Transform the source
    local transformed
    transformed=$(transform_source "$source")
    echo "$transformed" > "$srcfile"

    # Compile with solang
    local output
    output=$("$SOLANG" compile "$srcfile" --target soroban -o "$workdir/output" 2>&1)
    local exitcode=$?

    # Check for WASM output
    local wasm=$(find "$workdir/output" -name "*.wasm" 2>/dev/null | head -1)

    if [ -n "$wasm" ]; then
        local size=$(stat -c%s "$wasm" 2>/dev/null || stat -f%z "$wasm" 2>/dev/null)
        if echo "$output" | grep -qi "warning"; then
            echo "PASS (with warnings, ${size}B): $name"
            WARN=$((WARN + 1))
        else
            echo "PASS (${size}B): $name"
        fi
        PASS=$((PASS + 1))
        return 0
    else
        echo "FAIL: $name"
        if [ -n "$output" ]; then
            # Strip ANSI color codes for cleaner output
            echo "  $(echo "$output" | sed 's/\x1b\[[0-9;]*m//g' | head -3)"
        fi
        FAIL=$((FAIL + 1))
        return 1
    fi
}

echo "=== TVA Template Compilation Test ==="
echo "Solang: $SOLANG"
echo ""

# --- Base Templates ---
echo "--- Base Templates ---"

compile_template "blank" "MyContract.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {

}
'

compile_template "counter" "Counter.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Counter {
    uint64 private persistent count;

    function increment() public {
        count += 1;
    }

    function decrement() public {
        if (count == 0) {
            return;
        }
        count -= 1;
    }

    function get() public view returns (uint64) {
        return count;
    }
}
'

compile_template "greeter" "Greeter.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Greeter {
    string private persistent greeting;

    constructor(string memory _greeting) {
        greeting = _greeting;
    }

    function greet() public view returns (string memory) {
        return greeting;
    }

    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
}
'

compile_template "erc20" "Token.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Token {
    string public instance name;
    string public instance symbol;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
    }

    function mint(uint128 amount) public {
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        totalSupply -= amount;
        ownerBalance -= amount;
    }

    function getOwnerBalance() public view returns (uint128) {
        return ownerBalance;
    }
}
'

compile_template "erc721" "NFT.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract NFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalMinted;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerTokenCount;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalMinted = 0;
        nextTokenId = 1;
        ownerTokenCount = 0;
    }

    function mint() public returns (uint128) {
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalMinted += 1;
        ownerTokenCount += 1;
        return tokenId;
    }

    function burn(uint128 tokenId) public {
        if (ownerTokenCount == 0) {
            return;
        }
        totalMinted -= 1;
        ownerTokenCount -= 1;
    }

    function balanceOf() public view returns (uint128) {
        return ownerTokenCount;
    }

    function totalSupply() public view returns (uint128) {
        return totalMinted;
    }

    function getNextTokenId() public view returns (uint128) {
        return nextTokenId;
    }
}
'

compile_template "erc1155" "MultiToken.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MultiToken {
    string public instance name;
    address public instance owner;

    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent balance3;

    constructor(string memory _name) {
        name = _name;
        owner = msg.sender;
        balance1 = 0;
        balance2 = 0;
        balance3 = 0;
    }

    function mint(uint128 tokenId, uint128 amount) public {
        if (tokenId == 1) {
            balance1 += amount;
        } else if (tokenId == 2) {
            balance2 += amount;
        } else if (tokenId == 3) {
            balance3 += amount;
        }
    }

    function balanceOf(uint128 tokenId) public view returns (uint128) {
        if (tokenId == 1) {
            return balance1;
        } else if (tokenId == 2) {
            return balance2;
        } else if (tokenId == 3) {
            return balance3;
        }
        return 0;
    }

    function getTotalBalance() public view returns (uint128) {
        return balance1 + balance2 + balance3;
    }
}
'

compile_template "storage" "Storage.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Storage {
    uint128 private persistent value;

    event ValueChanged(uint128 newValue);

    function store(uint128 _value) public {
        value = _value;
        emit ValueChanged(_value);
    }

    function retrieve() public view returns (uint128) {
        return value;
    }
}
'

echo ""
echo "--- OpenZeppelin Templates ---"

compile_template "oz-erc20" "MyToken.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }

    function transfer(uint128 amount) public returns (bool) {
        if (ownerBalance < amount) {
            return false;
        }
        ownerBalance -= amount;
        return true;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) {
            return;
        }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function burn(uint128 amount) public {
        if (ownerBalance < amount) {
            return;
        }
        ownerBalance -= amount;
        totalSupply -= amount;
    }
}
'

compile_template "oz-erc721" "MyNFT.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;
    string public instance baseURI;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
        baseURI = "";
    }

    function setBaseURI(string memory _baseURI) public {
        if (msg.sender != owner) {
            return;
        }
        baseURI = _baseURI;
    }

    function getBaseURI() public view returns (string memory) {
        return baseURI;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) {
            return 0;
        }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
'

compile_template "oz-timelock" "Timelock.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Timelock {
    address public instance owner;
    uint128 public instance delay;
    uint128 public persistent pendingValue;
    uint128 public persistent currentValue;
    uint128 public persistent unlockTime;
    bool public instance hasPending;

    constructor(uint128 _delay) {
        owner = msg.sender;
        delay = _delay;
        pendingValue = 0;
        currentValue = 0;
        unlockTime = 0;
        hasPending = false;
    }

    function queueValue(uint128 _value, uint128 currentTime) public {
        if (msg.sender != owner) {
            return;
        }
        pendingValue = _value;
        unlockTime = currentTime + delay;
        hasPending = true;
    }

    function executeValue(uint128 currentTime) public {
        if (msg.sender != owner) {
            return;
        }
        if (!hasPending) {
            return;
        }
        if (currentTime < unlockTime) {
            return;
        }
        currentValue = pendingValue;
        hasPending = false;
    }

    function cancelPending() public {
        if (msg.sender != owner) {
            return;
        }
        hasPending = false;
        pendingValue = 0;
    }

    function getValue() public view returns (uint128) {
        return currentValue;
    }

    function getTimeRemaining(uint128 currentTime) public view returns (uint128) {
        if (!hasPending) {
            return 0;
        }
        if (currentTime >= unlockTime) {
            return 0;
        }
        return unlockTime - currentTime;
    }
}
'

compile_template "oz-erc20-pausable" "PausableToken.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PausableToken {
    string public instance name;
    string public instance symbol;
    uint32 public instance decimals;
    uint128 public persistent totalSupply;
    address public instance owner;
    uint128 public persistent ownerBalance;
    bool public instance paused;

    constructor(string memory _name, string memory _symbol, uint128 _initialSupply) {
        name = _name;
        symbol = _symbol;
        decimals = 7;
        totalSupply = _initialSupply;
        owner = msg.sender;
        ownerBalance = _initialSupply;
        paused = false;
    }

    function pause() public {
        if (msg.sender != owner) { return; }
        paused = true;
    }

    function unpause() public {
        if (msg.sender != owner) { return; }
        paused = false;
    }

    function transfer(uint128 amount) public returns (bool) {
        if (paused) { return false; }
        if (ownerBalance < amount) { return false; }
        ownerBalance -= amount;
        return true;
    }

    function mint(uint128 amount) public {
        if (msg.sender != owner) { return; }
        if (paused) { return; }
        totalSupply += amount;
        ownerBalance += amount;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
'

compile_template "oz-ownable" "OwnableContract.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OwnableContract {
    address public instance owner;
    address public instance pendingOwner;
    bool public instance hasPendingOwner;

    constructor() {
        owner = msg.sender;
        pendingOwner = address(0);
        hasPendingOwner = false;
    }

    function transferOwnership(address newOwner) public {
        if (msg.sender != owner) { return; }
        pendingOwner = newOwner;
        hasPendingOwner = true;
    }

    function acceptOwnership() public {
        if (msg.sender != pendingOwner) { return; }
        owner = pendingOwner;
        pendingOwner = address(0);
        hasPendingOwner = false;
    }

    function renounceOwnership() public {
        if (msg.sender != owner) { return; }
        owner = address(0);
    }

    function getOwner() public view returns (address) {
        return owner;
    }
}
'

compile_template "oz-pausable" "PausableContract.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PausableContract {
    address public instance owner;
    bool public instance paused;
    uint128 public persistent value;

    constructor() {
        owner = msg.sender;
        paused = false;
        value = 0;
    }

    function pause() public {
        if (msg.sender != owner) { return; }
        paused = true;
    }

    function unpause() public {
        if (msg.sender != owner) { return; }
        paused = false;
    }

    function isPaused() public view returns (bool) {
        return paused;
    }

    function setValue(uint128 _value) public {
        if (paused) { return; }
        value = _value;
    }

    function getValue() public view returns (uint128) {
        return value;
    }
}
'

compile_template "oz-reentrancy-guard" "SecureContract.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SecureContract {
    address public instance owner;
    uint128 public persistent balance;
    bool public instance locked;

    constructor() {
        owner = msg.sender;
        balance = 0;
        locked = false;
    }

    function deposit(uint128 amount) public {
        if (locked) { return; }
        locked = true;
        balance += amount;
        locked = false;
    }

    function withdraw(uint128 amount) public {
        if (locked) { return; }
        if (balance < amount) { return; }
        locked = true;
        balance -= amount;
        locked = false;
    }

    function getBalance() public view returns (uint128) {
        return balance;
    }
}
'

compile_template "oz-escrow" "Escrow.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public instance owner;
    address public instance beneficiary;
    uint128 public persistent depositAmount;
    bool public instance isDeposited;
    bool public instance isReleased;
    bool public instance isRefunded;

    constructor(address _beneficiary) {
        owner = msg.sender;
        beneficiary = _beneficiary;
        depositAmount = 0;
        isDeposited = false;
        isReleased = false;
        isRefunded = false;
    }

    function deposit(uint128 amount) public {
        if (msg.sender != owner) { return; }
        if (isDeposited) { return; }
        depositAmount = amount;
        isDeposited = true;
    }

    function release() public {
        if (msg.sender != owner) { return; }
        if (!isDeposited) { return; }
        if (isReleased || isRefunded) { return; }
        isReleased = true;
    }

    function refund() public {
        if (msg.sender != owner) { return; }
        if (!isDeposited) { return; }
        if (isReleased || isRefunded) { return; }
        isRefunded = true;
    }

    function getAmount() public view returns (uint128) {
        return depositAmount;
    }
}
'

compile_template "oz-vesting" "VestingWallet.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VestingWallet {
    address public instance owner;
    address public instance beneficiary;
    uint128 public instance start;
    uint128 public instance duration;
    uint128 public instance totalAmount;
    uint128 public persistent released;

    constructor(address _beneficiary, uint128 _startTime, uint128 _duration, uint128 _amount) {
        owner = msg.sender;
        beneficiary = _beneficiary;
        start = _startTime;
        duration = _duration;
        totalAmount = _amount;
        released = 0;
    }

    function vestedAmount(uint128 currentTime) public view returns (uint128) {
        if (currentTime < start) { return 0; }
        uint128 elapsed = currentTime - start;
        if (elapsed >= duration) { return totalAmount; }
        return (totalAmount * elapsed) / duration;
    }

    function releasable(uint128 currentTime) public view returns (uint128) {
        uint128 vested = vestedAmount(currentTime);
        if (vested <= released) { return 0; }
        return vested - released;
    }

    function release(uint128 currentTime) public {
        uint128 amount = releasable(currentTime);
        if (amount == 0) { return; }
        released += amount;
    }

    function getReleased() public view returns (uint128) {
        return released;
    }

    function getRemaining() public view returns (uint128) {
        return totalAmount - released;
    }
}
'

compile_template "oz-erc1155" "MyMultiToken.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyMultiToken {
    string public instance name;
    string public instance uri;
    address public instance owner;

    uint128 public persistent balance0;
    uint128 public persistent balance1;
    uint128 public persistent balance2;
    uint128 public persistent balance3;
    uint128 public persistent balance4;

    constructor(string memory _uri) {
        name = "MyMultiToken";
        uri = _uri;
        owner = msg.sender;
        balance0 = 0;
        balance1 = 0;
        balance2 = 0;
        balance3 = 0;
        balance4 = 0;
    }

    function setURI(string memory _uri) public {
        if (msg.sender != owner) { return; }
        uri = _uri;
    }

    function mint(uint128 id, uint128 amount) public {
        if (msg.sender != owner) { return; }
        if (id == 0) balance0 += amount;
        else if (id == 1) balance1 += amount;
        else if (id == 2) balance2 += amount;
        else if (id == 3) balance3 += amount;
        else if (id == 4) balance4 += amount;
    }

    function balanceOf(uint128 id) public view returns (uint128) {
        if (id == 0) return balance0;
        if (id == 1) return balance1;
        if (id == 2) return balance2;
        if (id == 3) return balance3;
        if (id == 4) return balance4;
        return 0;
    }

    function getTotalBalance() public view returns (uint128) {
        return balance0 + balance1 + balance2 + balance3 + balance4;
    }
}
'

compile_template "oz-access-control" "AccessControlled.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract AccessControlled {
    address public instance admin;
    address public instance minter;
    address public instance pauser;
    bool public instance minterSet;
    bool public instance pauserSet;

    constructor() {
        admin = msg.sender;
        minter = address(0);
        pauser = address(0);
        minterSet = false;
        pauserSet = false;
    }

    function grantMinterRole(address account) public {
        if (msg.sender != admin) { return; }
        minter = account;
        minterSet = true;
    }

    function grantPauserRole(address account) public {
        if (msg.sender != admin) { return; }
        pauser = account;
        pauserSet = true;
    }

    function hasMinterRole(address account) public view returns (bool) {
        return minterSet && minter == account;
    }

    function hasPauserRole(address account) public view returns (bool) {
        return pauserSet && pauser == account;
    }

    function hasAdminRole(address account) public view returns (bool) {
        return admin == account;
    }
}
'

compile_template "oz-ownable2step" "Ownable2Step.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Ownable2Step {
    address public instance owner;
    address public instance pendingOwner;

    constructor() {
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function transferOwnership(address newOwner) public {
        if (msg.sender != owner) { return; }
        pendingOwner = newOwner;
    }

    function acceptOwnership() public {
        if (msg.sender != pendingOwner) { return; }
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    function renounceOwnership() public {
        if (msg.sender != owner) { return; }
        owner = address(0);
        pendingOwner = address(0);
    }

    function getOwner() public view returns (address) {
        return owner;
    }

    function getPendingOwner() public view returns (address) {
        return pendingOwner;
    }
}
'

compile_template "oz-erc721-royalty" "RoyaltyNFT.sol" '// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RoyaltyNFT {
    string public instance name;
    string public instance symbol;
    address public instance owner;
    uint128 public persistent totalSupply;
    uint128 public persistent nextTokenId;
    uint128 public persistent ownerBalance;
    address public instance royaltyReceiver;
    uint128 public instance royaltyBps;

    constructor(string memory _name, string memory _symbol, uint128 _royaltyBps) {
        name = _name;
        symbol = _symbol;
        owner = msg.sender;
        royaltyReceiver = msg.sender;
        royaltyBps = _royaltyBps;
        totalSupply = 0;
        nextTokenId = 1;
        ownerBalance = 0;
    }

    function mint() public returns (uint128) {
        if (msg.sender != owner) { return 0; }
        uint128 tokenId = nextTokenId;
        nextTokenId += 1;
        totalSupply += 1;
        ownerBalance += 1;
        return tokenId;
    }

    function getRoyaltyAmount(uint128 salePrice) public view returns (uint128) {
        return (salePrice * royaltyBps) / 10000;
    }

    function getRoyaltyReceiver() public view returns (address) {
        return royaltyReceiver;
    }

    function setRoyaltyInfo(address receiver, uint128 bps) public {
        if (msg.sender != owner) { return; }
        royaltyReceiver = receiver;
        royaltyBps = bps;
    }

    function balanceOf() public view returns (uint128) {
        return ownerBalance;
    }
}
'

echo ""
echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "With warnings: $WARN"
echo ""
if [ $FAIL -gt 0 ]; then
    echo "SOME TESTS FAILED"
    exit 1
else
    echo "ALL TESTS PASSED"
    exit 0
fi
