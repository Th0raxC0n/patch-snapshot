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

## Contributing

Small, reproducible contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md).

The current focused community task is [canonical EIP-1167 minimal-proxy detection](docs/contributor-task-eip1167.md): exact byte-pattern recognition, same-block implementation hashing, deterministic fixtures, and an explicit boundary that a clone match is evidence of a target pointer—not a safety verdict.

## Request a Patch Check

Need a focused, evidence-first snapshot of a public EVM contract? [Open a snapshot request](https://github.com/Th0raxC0n/patch-snapshot/issues/new?template=snapshot-request.yml) with the chain, contract address and exact question you want answered.

Requests are public. Never include seed phrases, private keys, API keys or other secrets. A Patch Check is a narrow preflight receipt—not a comprehensive smart-contract audit or a guarantee of safety.

## PATCH priority lane

The CLI, its source code and the normal public request queue remain free. `PATCH` can be used to buy priority handling for a narrow Patch Check when capacity is available. Payment changes queue order only—it never buys a favorable conclusion, a safety label or a guaranteed completion time.

1. Open a snapshot request and wait for Patch to quote the current amount. Do not send tokens before receiving a quote.
2. Transfer the quoted `PATCH` amount on Robinhood Chain to the service wallet.
3. Add the transaction hash and quoted amount to the GitHub issue.
4. The transaction is verified from the public RPC. Before accepting it, the maintainer checks existing requests for the same hash and records the accepted claim in its GitHub issue. One transaction may fund one request.

| Item | Value |
| --- | --- |
| Network | Robinhood Chain (`4663`) |
| PATCH token | `0x5a84B799627d22bBDfafA2290A657c96960034bd` |
| Service wallet | `0x1c417B6BD82Ae88Dc94D2897f3C6a635dfD5d92c` |
| Explorer | `https://robinhoodchain.blockscout.com` |

Verify a quoted payment without connecting a wallet or exposing a key:

```bash
npm run verify:payment -- \
  --tx 0xPaymentTransactionHash \
  --min 25000 \
  --confirmations 3 \
  --format markdown
```

The verifier tries Robinhood Chain's official public RPC first and falls back to the public dRPC endpoint if needed; `PATCH_RPC_URL` may override both. Public endpoints are rate-limited, so a dedicated provider is preferable for production automation. The verifier checks the chain ID, successful receipt, PATCH token address, recipient, amount and confirmation count, then emits an evidence receipt. It does not move tokens or request approvals.

## Security

Found a vulnerability in this repository? Please follow the private reporting guidance in [SECURITY.md](SECURITY.md). Do not publish exploitable details in a public issue.
