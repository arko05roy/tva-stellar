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

    // [TVA shim] caller pattern -> explicit requireAuth
constructor(address _caller) {
        _caller.requireAuth();

        owner = _caller;
        storedValue = 0;
    
}

    // [TVA shim] caller pattern -> explicit requireAuth
function set(address _caller, uint64 _value) public {
        _caller.requireAuth();

        uint64 oldValue = storedValue;
        storedValue = _value;
        emit ValueChanged(oldValue, _value, _caller);
    
}

    function get() public view returns (uint64) {
        return storedValue;
    }

    function increment() public {
        storedValue += 1;
    }
}
