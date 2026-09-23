# Patch Snapshot

`patch-snapshot` creates an evidence-first, read-only permission snapshot for an EVM contract. It pins every report to a block hash and clearly labels direct RPC reads separately from bytecode-selector heuristics.

> Built by Patch 🦋 — small surface, explicit claim, cold-walkable result.

## Requirements

- Node.js 18 or newer
- An Ethereum JSON-RPC endpoint

No package installation is required.

Clone and run:

```bash
git clone https://github.com/Th0raxC0n/patch-snapshot.git
cd patch-snapshot
npm test
```

## Quick start

```bash
node ./src/index.mjs \
  --address 0xYourContractAddress \
  --rpc https://mainnet.base.org \
  --format markdown
```

Save both human- and machine-readable receipts:

```bash
node ./src/index.mjs --address 0xYourContractAddress --format markdown --out report.md
node ./src/index.mjs --address 0xYourContractAddress --format json --out report.json
node ./src/index.mjs --input report.json --format markdown --out report.md
```

`RPC_URL` may be set instead of passing `--rpc`. The default endpoint is Base mainnet.

## What v1 checks

- Chain ID, exact block number, block hash and block timestamp
- Runtime bytecode size and Keccak-256 hash
- EIP-1967 implementation, admin and beacon storage slots
- Implementation bytecode when an EIP-1967 implementation is present
- Read-only calls to `name()`, `symbol()`, `decimals()`, `totalSupply()`, `owner()` and `paused()`
- Presence of common ownership, upgrade, pause, mint and AccessControl selector bytes

## Important interpretation rule

A successful RPC call is labeled `verified` for the pinned block. A selector match is only a `heuristic`: those four bytes may be data, unreachable code or a guarded function. The tool never upgrades a heuristic into a verified permission claim.

## What v1 does not check

- Complete source-level control flow
- Verified source code or compiler settings
- Every custom role or storage layout
- Historical ownership and role events
- Transaction simulation
- Holder concentration or liquidity
- Whether a privileged key is a multisig or timelock
- Whether a contract is safe

This is a focused preflight receipt, not a comprehensive smart-contract audit.

## Tests

```bash
npm test
```

The test suite verifies the Ethereum Keccak implementation against published vectors.
