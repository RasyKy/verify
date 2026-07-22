// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Verifier{
    struct Certificate {
        bool exists;
        bool revoked;
        uint256 issueDate;
        uint256 expiryDate;
    }

    mapping(bytes32 => Certificate) public certificates;

}