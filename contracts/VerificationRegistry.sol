pragma solidity 0;

/**
 * @title VerificationRegistry
 * @notice Stores verified contract source code verification status on Stellar/Soroban
 * @dev Stores hashes on-chain, source code stored off-chain
 */
contract VerificationRegistry {
    /// Mapping from contract address to verification hash (SHA256 of source)
    mapping(address => bytes32) public persistent verificationHash;
    
    /// Mapping from contract address to metadata hash
    mapping(address => bytes32) public persistent metadataHash;
    
    /// Mapping from contract address to verification status
    mapping(address => bool) public persistent isVerified;

    /// @notice Emitted when a contract is verified
    event ContractVerified(
        address indexed contractAddress,
        address indexed submitter,
        bytes32 indexed sourceHash
    );

    /// @notice Verify a contract by submitting source hash
    /// @param contractAddr The contract address to verify
    /// @param sourceHash SHA256 hash of the source code
    /// @param metaHash SHA256 hash of the metadata JSON
    /// @param submitter The address submitting the verification (must authorize)
    function verify(
        address contractAddr,
        bytes32 sourceHash,
        bytes32 metaHash,
        address submitter
    ) public {
        // Require authorization from the submitter
        submitter.requireAuth();
        
        verificationHash[contractAddr] = sourceHash;
        metadataHash[contractAddr] = metaHash;
        isVerified[contractAddr] = true;

        emit ContractVerified(contractAddr, submitter, sourceHash);
    }

    /// @notice Get verification hash for a contract
    /// @param contractAddr The contract address to query
    /// @return The verification hash, or 0 if not verified
    function getVerificationHash(address contractAddr) public view returns (bytes32) {
        return verificationHash[contractAddr];
    }

    /// @notice Get metadata hash for a contract
    /// @param contractAddr The contract address to query
    /// @return The metadata hash, or 0 if not verified
    function getMetadataHash(address contractAddr) public view returns (bytes32) {
        return metadataHash[contractAddr];
    }

    /// @notice Check if a contract is verified
    /// @param contractAddr The contract address to check
    /// @return True if the contract is verified
    function isContractVerified(address contractAddr) public view returns (bool) {
        return isVerified[contractAddr];
    }
}
