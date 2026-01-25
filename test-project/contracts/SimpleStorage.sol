// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * SimpleStorage - A basic contract for testing TVA Protocol
 * Compiles to Soroban WASM via Solang and deploys to Stellar
 *
 * Note: Solang's Soroban backend has limitations:
 * - No indexed event parameters
 * - No address type (use bytes32 for identifiers)
 * - No msg.sender
 */
contract SimpleStorage {
    uint64 public storedValue;

    // Events without indexed parameters for Soroban compatibility
    event ValueChanged(uint64 oldValue, uint64 newValue);

    constructor() {
        storedValue = 0;
    }

    function set(uint64 _value) public {
        uint64 oldValue = storedValue;
        storedValue = _value;
        emit ValueChanged(oldValue, _value);
    }

    function get() public view returns (uint64) {
        return storedValue;
    }

    function increment() public {
        storedValue += 1;
    }
}
