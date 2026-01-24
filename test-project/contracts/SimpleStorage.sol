// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * SimpleStorage - A basic contract for testing TVA Protocol
 * Compiles to Soroban WASM via Solang and deploys to Stellar
 */
contract SimpleStorage {
    uint64 public storedValue;
    address public owner;

    event ValueChanged(uint64 indexed oldValue, uint64 indexed newValue, address setter);

    constructor() {
        owner = msg.sender;
        storedValue = 0;
    }

    function set(uint64 _value) public {
        uint64 oldValue = storedValue;
        storedValue = _value;
        emit ValueChanged(oldValue, _value, msg.sender);
    }

    function get() public view returns (uint64) {
        return storedValue;
    }

    function increment() public {
        storedValue += 1;
    }
}
