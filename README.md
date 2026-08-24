# Verify

Blockchain-based digital certificate verification for educational institutions
in Cambodia. An issuing institution submits certificate data, the backend
hashes it and anchors the hash on Polygon, the full record is stored in
Supabase, and the recipient claims their certificate via a one-time emailed
link. Anyone — an employer, another institution, anyone with the link or QR
code — can verify a certificate's authenticity without an account.

A university project (Software Engineering, Year 3) built by a team of three.

**Live app:** TODO — Vercel URL, if this is meant to be public
**Live API:** TODO — Render URL, if worth linking

## How it works

1. An **Issuer** (institution) submits certificate data through the issuer
   portal.
2. The backend hashes the certificate and writes the hash to a smart contract
   on Polygon; the full record is saved in Supabase.
3. The recipient gets a claim email and creates an account via a one-time
   link to become the certificate's **Holder**.
4. Anyone can **verify** a certificate by scanning its QR code or visiting its
   verify link — the backend re-hashes the stored record and compares it
   against the on-chain hash.

## Monorepo layout

| Directory | What it is |
| --- | --- |
| [`frontend/`](frontend) | Nuxt.js (SSR) — issuer, holder, admin, and public verify/claim pages |
| [`backend/`](backend) | Node.js + Express API — hashing, Supabase access, blockchain calls, email |
| [`blockchain/`](blockchain) | Hardhat + Solidity — the certificate registry contract |
| [`docs/`](docs) | API schema, ER diagram, deployment notes, hash spec, user flows |

## Tech stack

- **Frontend:** Nuxt.js, Tailwind CSS, Nuxt UI
- **Backend:** Express, Supabase (Postgres + Auth), ethers.js, Zod, Winston
- **Blockchain:** Solidity, OpenZeppelin, Hardhat, Polygon (Amoy testnet)
- **Infra:** Vercel (frontend), Render (backend), GitHub Actions (CI)

## Getting started

Each part of the stack has its own setup:

- Backend — see [`backend/README.md`](backend/README.md) for environment
  variables, database setup, and running the API locally.
- Frontend — TODO
- Blockchain — see [`blockchain/README.md`](blockchain/README.md)

For how the two deployed services (Vercel + Render) are configured and wired
together, see [`docs/deployment.md`](docs/deployment.md).

## Team

| Name | Focus |
| --- | --- |
| Rasy | Frontend (Nuxt portals), security middleware, CI/CD, API docs |
| Lyhour | Backend (API, Supabase schema/auth, hashing, blockchain calls, email) |
| Cheata | Smart contract, Hardhat tests, testnet/mainnet deployment |

## License

TODO
