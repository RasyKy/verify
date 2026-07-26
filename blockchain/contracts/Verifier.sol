// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract Verifier is AccessControl {
    struct Certificate {
        bool exists;
        bool revoked;
        uint256 issueDate;
        uint256 expiryDate;
    }

    // A role is just a bytes32 identifier. OpenZeppelin's AccessControl lets you
    // check "does this address hold this role?" via onlyRole(...).
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    mapping(bytes32 => Certificate) public certificates;

    // Grants the deployer DEFAULT_ADMIN_ROLE, which can grant/revoke ISSUER_ROLE
    // to institution wallets later (via grantRole, inherited from AccessControl).
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function issue(bytes32 hash, uint256 expiresAt) external onlyRole(ISSUER_ROLE) {
        require(!certificates[hash].exists, "Certificate already exists");
        certificates[hash] = Certificate({
            exists: true,
            revoked: false,
            issueDate: block.timestamp,
            expiryDate: expiresAt
        });
    }

    function revoke(bytes32 hash) external onlyRole(ISSUER_ROLE) {
        require(certificates[hash].exists, "Certificate does not exist");
        certificates[hash].revoked = true;
    }

    function verify(bytes32 hash) external view returns (bool exists, bool revoked, uint256 issuedAt, uint256 expiresAt) {
        Certificate storage cert = certificates[hash];
        return (cert.exists, cert.revoked, cert.issueDate, cert.expiryDate);
    }
}