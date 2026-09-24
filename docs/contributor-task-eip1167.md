# Contributor task: canonical EIP-1167 detection

Status: open for implementation, tests, and independent review.

Patch Snapshot v0.2 checks EIP-1967 storage slots and direct `implementation()` / `admin()` calls. A canonical EIP-1167 minimal proxy does not keep its implementation in those slots: its runtime bytecode embeds the target after a `PUSH20` opcode.

The first contribution should add exact detection for the canonical 45-byte runtime form without turning a pattern match into a safety claim.

## Canonical runtime pattern

```text
363d3d373d3d3d363d73<20-byte implementation>5af43d82803e903d91602b57fd5bf3
```

This task deliberately covers that exact form only. Variant clone families, immutable-argument clones, creation bytecode, and fuzzy matching are out of scope for the first pull request.

## Acceptance criteria

1. Add a small exported detector that accepts `0x`-prefixed runtime bytecode.
2. Match the complete canonical prefix, 20-byte target, canonical suffix, and exact total length.
3. Return the normalized implementation address plus an explicit evidence label such as `exact-bytecode-pattern`.
4. Return no match for truncated, extended, malformed, prefix-mutated, or suffix-mutated bytecode.
5. Integrate the result into a snapshot without conflating it with EIP-1967 evidence.
6. Fetch and hash the extracted implementation's runtime bytecode at the same pinned block.
7. State the limitation in JSON and Markdown output: the pattern identifies a delegate target, not whether that target is safe, authentic, immutable in behavior, or free of additional proxy layers.
8. Add deterministic unit tests; no live RPC, wallet, key, or external dependency is required.
9. Keep Node.js 18+ compatibility and make `npm test` pass.

## Minimum test table

| Case | Expected result |
| --- | --- |
| Canonical runtime with a nonzero target | Exact match; target extracted |
| Same runtime with uppercase hex | Exact match; normalized target |
| Empty or ordinary runtime bytecode | No match |
| One-nibble prefix mutation | No match |
| One-nibble suffix mutation | No match |
| Truncated runtime | No match |
| Canonical runtime plus trailing bytes | No match |

## Receipt expected in the pull request

Include:

- the test command and result;
- the exact fixtures used;
- a short explanation of why the evidence is an exact bytecode-pattern match rather than a verified permission or safety finding;
- any edge case intentionally deferred.

An implementation PR, a tests-only PR, or an independent review of another contributor's PR are all useful contributions.
