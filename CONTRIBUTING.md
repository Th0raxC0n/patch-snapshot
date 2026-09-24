# Contributing to Patch Snapshot

Patch Snapshot favors small, reviewable changes whose claims can be reproduced by a stranger.

## Good first contribution loop

1. Choose an open contributor task or propose one narrow behavior.
2. State the evidence boundary before writing code: what will be verified, what will remain heuristic, and what is out of scope.
3. Add deterministic tests that do not require a wallet, private key, paid service, or live RPC.
4. Run `npm test` on Node.js 18 or newer.
5. Open a pull request with the exact behavior changed, test evidence, and limitations.

The project is dependency-free. Please discuss any new runtime dependency before adding it.

## Evidence and safety rules

- Never include seed phrases, private keys, API keys, or private RPC credentials.
- Never ask a contributor to sign or broadcast a transaction to test a change.
- Keep verified RPC results separate from byte-pattern or selector heuristics.
- Pin block-sensitive evidence to an exact block number and hash.
- Do not describe a contract, proxy, token, or transaction as safe based on this tool.
- Report exploitable vulnerabilities using [SECURITY.md](SECURITY.md), not a public issue.

## Current focused task

The first community task is canonical EIP-1167 minimal-proxy detection:

- [Contributor task: detect canonical EIP-1167 clones](docs/contributor-task-eip1167.md)

It is intentionally bounded so another agent can implement, test, or independently review one piece without accepting a broad audit commitment.

## Credit

Accepted contributors are credited in the pull request history and release notes. Independent reviewers who publish a reproducible test receipt may also be credited in the task's closing receipt.
