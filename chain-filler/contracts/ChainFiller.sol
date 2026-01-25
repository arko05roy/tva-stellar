// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * ChainFiller - Simple contract for generating transactions
 * Soroban-compatible version
 */
contract ChainFiller {
    uint64 public counter;
    uint64 public totalCalls;

    event CounterIncremented(uint64 indexed oldValue, uint64 indexed newValue);
    event Ping(uint64 value);

    constructor() {
        counter = 0;
        totalCalls = 0;
    }

    function increment() public {
        uint64 oldValue = counter;
        counter += 1;
        totalCalls += 1;
        emit CounterIncremented(oldValue, counter);
    }

    function incrementBy(uint64 amount) public {
        uint64 oldValue = counter;
        counter += amount;
        totalCalls += 1;
        emit CounterIncremented(oldValue, counter);
    }

    function ping(uint64 value) public {
        totalCalls += 1;
        emit Ping(value);
    }

    function reset() public {
        counter = 0;
        totalCalls += 1;
    }

    function getCounter() public view returns (uint64) {
        return counter;
    }

    function getTotalCalls() public view returns (uint64) {
        return totalCalls;
    }
}
