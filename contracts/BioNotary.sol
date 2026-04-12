// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title BioNotary — reference / deployable notary registry
/// @notice Function selectors match the unverified Sepolia deployment at
/// `0xCDa82472BD768156A5d961A0Ce61d9C93D4ffDA1`:
/// - `records(bytes32)` → `0x01e64725`
/// - `getRecord(bytes32)` → `0x213681cd`
/// - `notarize(bytes32,bytes32)` → `0xe48a2630` (`notarizeSelector` in the Flutter app)
/// @dev The second argument is an opaque client “witness” hash. The Flutter app sets it to
/// SHA-256 over the wallet address string’s UTF-16 code units (`sha256.convert(address.codeUnits)`),
/// which for normal `0x…` hex addresses equals SHA-256 over the ASCII / UTF-8 bytes.
contract BioNotary {
    struct Record {
        bytes32 docHash;
        address notary;
        bytes32 witness;
    }

    mapping(bytes32 => Record) public records;

    /// @dev Event name/topic on the live deployment may differ; this matches this source file.
    event Notarized(bytes32 indexed docHash, address indexed notary, bytes32 witness);

    function notarize(bytes32 docHash, bytes32 clientWitness) external {
        Record storage r = records[docHash];
        require(r.notary == address(0), "Already notarized");
        r.docHash = docHash;
        r.notary = msg.sender;
        r.witness = clientWitness;
        emit Notarized(docHash, msg.sender, clientWitness);
    }

    function getRecord(bytes32 docHash) external view returns (bytes32, address, bytes32) {
        Record storage r = records[docHash];
        return (r.docHash, r.notary, r.witness);
    }
}
