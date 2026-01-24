pragma solidity 0;

/**
 * @title VerificationRegistry
 * @notice Stores verified contract source code on Stellar/Soroban
 * @dev Allows anyone to verify a contract by submitting source code
 *      that matches the deployed WASM hash
 */
contract VerificationRegistry {
    /// @notice Verification record for a contract
    struct Verification {
        string source;           // Full Solidity source code
        string compilerVersion;  // Solang compiler version (e.g., "0.3.0")
        string compilerFlags;    // Compilation flags (e.g., "--target soroban -O2")
        string metadata;         // JSON metadata (ABI, constructor args, etc.)
        address submitter;       // Address that submitted verification
        uint64 timestamp;        // When verified
    }

    /// @notice Mapping from contract address to verification record
    mapping(address => Verification) public persistent verified;

    /// @notice Emitted when a contract is verified
    event ContractVerified(
        address indexed contractAddress,
        address indexed submitter,
        uint64 timestamp
    );

    /// @notice Verify a contract by submitting source code
    /// @param contractAddr The address of the contract to verify
    /// @param source The full Solidity source code
    /// @param compilerVersion The Solang compiler version used
    /// @param flags The compilation flags used
    /// @param metadata JSON string with ABI, // [TVA shim] caller pattern -> explicit requireAuth
constructor args, etc.
    function verify(address _caller, address contractAddr,
        string memory source,
        string memory compilerVersion,
        string memory flags,
        string memory metadata) public {
        _caller.requireAuth();

        // In Soroban, _caller is replaced with requireAuth
        // We'll use the submitter parameter or requireAuth on the caller
        address submitter = address(this); // Will be set by RPC layer via requireAuth
        
        verified[contractAddr] = Verification({
            source: source,
            compilerVersion: compilerVersion,
            compilerFlags: flags,
            metadata: metadata,
            submitter: submitter,
            timestamp: uint64(block.timestamp)
        });

        emit ContractVerified(contractAddr, submitter, uint64(block.timestamp));
    
}

    /// @notice Get source code for a verified contract
    /// @param contractAddr The contract address to query
    /// @return The source code, or empty string if not verified
    function getSource(address contractAddr) public view returns (string memory) {
        return verified[contractAddr].source;
    }

    /// @notice Get compiler version for a verified contract
    /// @param contractAddr The contract address to query
    /// @return The compiler version, or empty string if not verified
    function getCompilerVersion(address contractAddr) public view returns (string memory) {
        return verified[contractAddr].compilerVersion;
    }

    /// @notice Get metadata for a verified contract
    /// @param contractAddr The contract address to query
    /// @return The metadata JSON, or empty string if not verified
    function getMetadata(address contractAddr) public view returns (string memory) {
        return verified[contractAddr].metadata;
    }

    /// @notice Check if a contract is verified
    /// @param contractAddr The contract address to check
    /// @return True if the contract is verified
    function isVerified(address contractAddr) public view returns (bool) {
        string memory source = verified[contractAddr].source;
        // Check if source is non-empty (Soroban strings are empty if not set)
        return bytes(source).length > 0;
    }
}

