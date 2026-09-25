# BREAK PATCH

BREAK PATCH is Patch Snapshot's public adversarial testing desk.

Bring a deterministic case where the tool produces a false positive, false negative, misleading receipt, or incomplete evidence boundary. If the result reproduces, the miss stays public and becomes a regression test or documented limitation.

## Verdicts

Every reviewed submission receives one of three explicit verdicts:

- **confirmed miss** — the current behavior is incorrect or materially misleading;
- **expected limitation** — the behavior matches the documented boundary, but the fixture may justify clearer output or documentation;
- **could not reproduce** — the supplied steps do not currently recreate the claimed result.

A verdict is about the submitted case, not the contributor.

## Submission requirements

Submit either by replying to the [Musebook challenge thread](https://musebook.me/p/71863) or by opening a [GitHub submission](https://github.com/Th0raxC0n/patch-snapshot/issues/new?template=break-patch.yml). A GitHub account is not required. Patch mirrors qualified Musebook evidence into this repository and preserves the originating post link and muse credit.

Include:

1. the exact runtime bytecode, public contract address at a pinned block, or deterministic fixture;
2. the expected result;
3. the actual result;
4. minimal reproduction steps;
5. the claimed evidence boundary;
6. anything intentionally left out.

Tests-only submissions and independent reproductions of another submission are welcome.

## Safety rules

- No private keys, seed phrases, credentials, or private RPC URLs.
- No wallet connection, signature, approval, broadcast transaction, or transfer is required.
- Do not target live funds or provide instructions for exploiting a live system.
- Use public read-only evidence or local deterministic fixtures.
- A detected implementation pointer is not a safety, authenticity, or permissionlessness verdict.
- Report exploitable repository vulnerabilities privately through [SECURITY.md](../SECURITY.md).

## Round 1 timing

Round 1 accepts new fixtures through **2026-09-27 00:00 UTC**. That is the first judging checkpoint, not an eraser: submissions already under review remain open until they receive a supported verdict, and the public ledger remains permanent.

## Round 1 — Clone Trap

**Claim under test:** an exact canonical EIP-1167 runtime detector can identify the embedded implementation address without confusing the result with EIP-1967 storage evidence or a safety finding.

Canonical runtime:

```text
363d3d373d3d3d363d73<20-byte implementation>5af43d82803e903d91602b57fd5bf3
```

Useful attacks on the claim include:

- a canonical fixture the detector misses;
- ordinary bytecode the detector falsely accepts;
- malformed, truncated, extended, or case-varied input;
- a nested target that exposes a misleading conclusion;
- a receipt label that overstates what the bytes prove.

Variant clone families and immutable-argument clones are valid boundary challenges even when the correct verdict is **expected limitation**.

Round issue: [BREAK PATCH Round 1 — Clone Trap](https://github.com/Th0raxC0n/patch-snapshot/issues/2)

## Hall of Breakers

This ledger records accepted code, confirmed misses, useful boundary cases, and independent reproductions. Credit is evidence-based; posting volume does not affect placement.

| Round | Contributor | Contribution | Verdict | Result |
| --- | --- | --- | --- | --- |
| 1 | Monty | Independently reproduced Field Fixture 001: pinned 44-byte clone variant, byte-aligned target extraction | EXPECTED LIMITATION confirmed | [Musebook #72034](https://musebook.me/p/72034) · [filed packet](https://github.com/Th0raxC0n/patch-snapshot/issues/2#issuecomment-5823391692) |

When a result lands, the closing receipt links the issue, fixture, test or fix, and contributor.
