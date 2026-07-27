# Certificate hash specification (FR-ISSUE-03, FR-EXP-04)

**For:** In Empiseysocheata (blockchain) · **From:** Chhay Lyhour (backend)

This is the contract between the Node backend and the Solidity contract. If our
two implementations disagree by a single byte, **genuine certificates report as
forged** — the failure is silent and looks like a product defect, not a bug. So
the format is pinned here, versioned, and covered by fixed vectors both sides
can test against.

Implementation: [backend/src/services/hash.js](../backend/src/services/hash.js).
Tests: [backend/tests/hash.test.js](../backend/tests/hash.test.js).

## The format

```
canonical = [ certId, name, course, completionDate, expiryDate ].join('|')
hash      = '0x' + sha256(utf8(canonical))      // 32 bytes → bytes32
expiresAt = UTC-midnight unix seconds of expiryDate, or 0 for never
```

Rules, all of which matter:

| Rule | Why |
| --- | --- |
| `certId` first | It is a UUID, so no user input can position-shift the fields |
| `\|` separator, always 5 fields | Cannot occur in a date; the fixed field count means a name containing `\|` still cannot forge a different layout |
| `name`/`course` → NFC, trimmed, runs of whitespace collapsed to one space | "Sophéa" encodes two ways (`é` vs `e`+combining acute) — identical on screen, different bytes. Real for Khmer and French-influenced names |
| **No case folding** | Names display as typed, so they hash as typed. Folding would let "chea sophat" verify against a certificate issued to "Chea Sophat" |
| Dates as `YYYY-MM-DD` | Unambiguous and timezone-free |
| No expiry → **empty string** | Never `"null"` or `"0"`, both of which a date field could plausibly contain |
| `expiresAt = 0` for never | Contract sentinel; must agree with the expiry inside the hash |
| Lowercase hex output | `bytes32` comparison is byte-wise; mixed case would break string equality in the DB |
| `student_email` is **not** hashed | Mutable contact data, not part of the credential claim. Including it would mean a typo'd email required a full on-chain revoke + reissue |

`hash_version` is stored per row (`certificate_hashes.hash_version`, currently
`1`) so the recipe can change later without stranding certificates already
issued: verification rehashes using the version that row was created with.

## Fixed vectors

Regenerate any time with `cd backend && node scripts/print-hash-vectors.js`.
**Your Hardhat tests should assert these exact digests.**

### 1 — no expiry

```
certId      3f2504e0-4f89-11d3-9a0c-0305e82c3301
name        Chea Sophat
course      Web Development Fundamentals
completion  2026-02-03
expiry      (none)

canonical   "3f2504e0-4f89-11d3-9a0c-0305e82c3301|Chea Sophat|Web Development Fundamentals|2026-02-03|"
hash        0xfc09204e74b36f61615700a856e9ee8d4dd7d19a54381bf197df1f052c6bc839
expiresAt   0
```

### 2 — with expiry

```
certId      3f2504e0-4f89-11d3-9a0c-0305e82c3301
name        Chea Sophat
course      Web Development Fundamentals
completion  2026-02-03
expiry      2028-02-03

canonical   "3f2504e0-4f89-11d3-9a0c-0305e82c3301|Chea Sophat|Web Development Fundamentals|2026-02-03|2028-02-03"
hash        0x6884f30ad0fd82f6e667ced8c3854b92cb5b90c4fedf4135bd2105dec5bacfaa
expiresAt   1833148800
```

### 3 — whitespace and NFC normalisation applied

Input name is `"  Sophéa   Chan "`; it normalises to `"Sophéa Chan"` before hashing.

```
certId      7c9e6679-7425-40de-944b-e07fc1f90ae7
course      Data Analytics with Python
completion  2026-05-20
expiry      (none)

canonical   "7c9e6679-7425-40de-944b-e07fc1f90ae7|Sophéa Chan|Data Analytics with Python|2026-05-20|"
hash        0xa4f1a73c0b8f551462902896660884620fe538797e4ea42500d5da9dabc226dd
expiresAt   0
```

### 4 — Khmer script

```
certId      b1d4f2a0-1111-4222-8333-444455556666
name        ជា សុភាព
course      Blockchain for Developers
completion  2026-03-12
expiry      2027-03-12

canonical   "b1d4f2a0-1111-4222-8333-444455556666|ជា សុភាព|Blockchain for Developers|2026-03-12|2027-03-12"
hash        0xcb2e70ed424e734a8b84d7b7c633dfa2512cde1f716c6fd96ceb2a67ac6c2b1f
expiresAt   1804809600
```

## Contract interface I'm coding against

`backend/src/services/blockchain.js` is written against this. If you change any
signature, tell me before you redeploy.

```solidity
function issue(bytes32 hash, uint256 expiresAt) external;   // ISSUER_ROLE
function revoke(bytes32 hash) external;                     // ISSUER_ROLE
function verify(bytes32 hash) external view
  returns (bool exists, bool revoked, uint256 issuedAt, uint256 expiresAt);

event Issued(bytes32 indexed hash, address indexed issuer, uint256 expiresAt);
event Revoked(bytes32 indexed hash, address indexed issuer);
```

Note the hash is computed with **SHA-256, not keccak256**. It is produced
off-chain in Node and passed in as a ready-made `bytes32`, so the contract never
hashes anything — it only stores and looks up. Please don't add an on-chain
`keccak256` step; it would break verification.

## Three consequences of keying records by hash

1. **Editing a certificate is revoke + reissue.** FR-MGMT-04 shows the user an
   edit form, but changed fields mean a changed hash, so the old hash is revoked
   and a new one issued. The certificate's UUID stays the same, because QR codes
   are already in circulation. That is why the backend keeps a
   `certificate_hashes` history table with exactly one `is_current` row.
2. **`expiresAt` is stored twice** — inside the hash and as a contract argument.
   They must agree or the on-chain record contradicts itself. Vector 2 above
   pins both.
3. **Anyone who knows the plaintext can compute the hash and query the chain.**
   That is by design: it is what makes verification independent of us. It is also
   why no PII may go on chain (FR-SC-05, NFR-SEC-02) — the hash is one-way, the
   ledger is public and permanent.

## What I need from you, in priority order

1. **The ABI JSON + deployed address on Amoy**, committed to
   `backend/src/blockchain/abi/CertificateRegistry.json`. This is on my critical
   path — the issuance endpoint cannot be integration-tested without it. I am
   writing against an in-memory stub with the interface above in the meantime, so
   a slip on your side does not block me, but I cannot ship until it lands.
2. **Confirmation that the vectors above reproduce in Hardhat.** Cheapest
   possible check, catches the most expensive possible bug.
3. **A Hardhat test proving `issue()` and `revoke()` revert for a wallet without
   `ISSUER_ROLE`** — that is T-01 in the threat model and a named line in the SRS
   Success Criteria.

## One design point to be aware of

We settled on a **single platform relayer wallet** holding `ISSUER_ROLE`, not
per-institution wallets. FR-INST-03 in the SRS says each institution gets a
wallet, but NFR-SEC-01 says one key in backend env vars — those conflict, and one
relayer is the right MVP call (one nonce queue, one key to rotate and fund).

The consequence to record in the SRS: `msg.sender` is the platform for every
issuance, so **on-chain non-repudiation is platform-level, not per-institution**.
Institution attribution lives in Supabase (`certificates.organization_id`) and
the audit log. T-08 still holds, just at a different granularity.

If we later want per-institution attribution on chain, the cheap route is an
extra `bytes32 institutionId` argument on `issue()` rather than N funded
wallets — worth considering now while the contract is still unwritten.
