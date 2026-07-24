/**
 * Prints the canonical strings and digests that the Solidity/Hardhat tests must
 * reproduce. Run with `node scripts/print-hash-vectors.js`.
 *
 * This is the cross-language contract for FR-ISSUE-03: if Hardhat computes a
 * different digest for the same input, verification of real certificates will
 * fail, so both sides check against these values.
 */
/* eslint-disable no-console -- this script's entire purpose is stdout */
import {
  HASH_VERSION,
  buildCanonicalString,
  computeCertificateHash,
  expiryToUnix,
} from '../src/services/hash.js';

const VECTORS = [
  {
    label: 'no expiry',
    certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    studentName: 'Chea Sophat',
    courseName: 'Web Development Fundamentals',
    completionDate: '2026-02-03',
    expiryDate: null,
  },
  {
    label: 'with expiry',
    certId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    studentName: 'Chea Sophat',
    courseName: 'Web Development Fundamentals',
    completionDate: '2026-02-03',
    expiryDate: '2028-02-03',
  },
  {
    label: 'whitespace + NFC normalisation applied',
    certId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    studentName: '  Sophéa   Chan ',
    courseName: 'Data Analytics with Python',
    completionDate: '2026-05-20',
    expiryDate: null,
  },
  {
    label: 'Khmer script',
    certId: 'b1d4f2a0-1111-4222-8333-444455556666',
    studentName: 'ជា សុភាព',
    courseName: 'Blockchain for Developers',
    completionDate: '2026-03-12',
    expiryDate: '2027-03-12',
  },
];

console.log(`Verify — certificate hash vectors (HASH_VERSION ${HASH_VERSION})`);
console.log('='.repeat(78));
console.log(
  'canonical = [certId, name, course, completionDate, expiryDate].join("|")'
);
console.log('hash      = "0x" + sha256(utf8(canonical))');
console.log('expiresAt = UTC-midnight unix seconds, 0 = never');
console.log('='.repeat(78));

for (const { label, ...input } of VECTORS) {
  console.log(`\n── ${label} ──`);
  console.log(`certId        ${input.certId}`);
  console.log(`studentName   ${JSON.stringify(input.studentName)}`);
  console.log(`courseName    ${JSON.stringify(input.courseName)}`);
  console.log(`completion    ${input.completionDate}`);
  console.log(`expiry        ${input.expiryDate ?? '(none)'}`);
  console.log(`canonical     ${JSON.stringify(buildCanonicalString(input))}`);
  console.log(`hash          ${computeCertificateHash(input)}`);
  console.log(`expiresAt     ${expiryToUnix(input.expiryDate)}`);
}

console.log('');
