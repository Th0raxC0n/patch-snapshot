#!/usr/bin/env node

import fs from "node:fs";
import { keccak256, keccakHex } from "./keccak.mjs";

const DEFAULT_RPC = "https://mainnet.base.org";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const SELECTORS = [
  { selector: "8da5cb5b", signature: "owner()", category: "ownership" },
  { selector: "f2fde38b", signature: "transferOwnership(address)", category: "ownership" },
  { selector: "715018a6", signature: "renounceOwnership()", category: "ownership" },
  { selector: "3659cfe6", signature: "upgradeTo(address)", category: "upgrade" },
  { selector: "4f1ef286", signature: "upgradeToAndCall(address,bytes)", category: "upgrade" },
  { selector: "52d1902d", signature: "proxiableUUID()", category: "upgrade" },
  { selector: "f851a440", signature: "admin()", category: "upgrade" },
  { selector: "8f283970", signature: "changeAdmin(address)", category: "upgrade" },
  { selector: "8456cb59", signature: "pause()", category: "pause" },
  { selector: "3f4ba83a", signature: "unpause()", category: "pause" },
  { selector: "5c975abb", signature: "paused()", category: "pause" },
  { selector: "40c10f19", signature: "mint(address,uint256)", category: "supply" },
  { selector: "42966c68", signature: "burn(uint256)", category: "supply" },
  { selector: "a217fddf", signature: "DEFAULT_ADMIN_ROLE()", category: "roles" },
  { selector: "91d14854", signature: "hasRole(bytes32,address)", category: "roles" },
  { selector: "2f2ff15d", signature: "grantRole(bytes32,address)", category: "roles" },
  { selector: "d547741f", signature: "revokeRole(bytes32,address)", category: "roles" },
];

function usage() {
  return `patch-snapshot --address 0x... [options]

Options:
  --rpc URL             JSON-RPC endpoint (default: RPC_URL or Base mainnet)
  --block TAG           latest, safe, finalized, or a hex block number
  --format FORMAT       markdown or json (default: markdown)
  --input FILE          render an existing snapshot JSON without RPC calls
  --out FILE            write the report to a file
  --help                show this help

The tool performs read-only JSON-RPC calls. It never requests or uses a wallet key.`;
}

function parseArgs(argv) {
  const args = { rpc: process.env.RPC_URL || DEFAULT_RPC, block: "latest", format: "markdown" };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help") args.help = true;
    else if (value === "--address") args.address = argv[++i];
    else if (value === "--rpc") args.rpc = argv[++i];
    else if (value === "--block") args.block = argv[++i];
    else if (value === "--format") args.format = argv[++i];
    else if (value === "--input") args.input = argv[++i];
    else if (value === "--out") args.out = argv[++i];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.help && !args.address && !args.input) throw new Error("--address or --input is required");
  if (args.address && args.input) throw new Error("Use --address or --input, not both");
  if (args.address && !/^0x[0-9a-fA-F]{40}$/.test(args.address)) throw new Error("Invalid EVM address");
  if (!new Set(["markdown", "json"]).has(args.format)) throw new Error("--format must be markdown or json");
  return args;
}

class RpcClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.queue = Promise.resolve();
    this.lastRequestAt = 0;
  }

  call(method, params = []) {
    const task = this.queue.then(() => this.perform(method, params));
    this.queue = task.catch(() => undefined);
    return task;
  }

  async perform(method, params = []) {
    const id = this.nextId++;
    for (let attempt = 0; attempt < 4; attempt++) {
      const spacing = 125 - (Date.now() - this.lastRequestAt);
      if (spacing > 0) await new Promise((resolve) => setTimeout(resolve, spacing));
      this.lastRequestAt = Date.now();
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "patch-snapshot/0.1.0",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, 5000)
          : 300 * (2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      if (!response.ok) throw new Error(`RPC HTTP ${response.status} for ${method}`);
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`);
      return body.result;
    }
    throw new Error(`RPC retry budget exhausted for ${method}`);
  }
}

async function optional(task) {
  try {
    return { ok: true, value: await task() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function hexBytes(hex) {
  return Buffer.from(hex.replace(/^0x/, ""), "hex");
}

function quantity(hex) {
  return BigInt(hex).toString(10);
}

function slotFor(label) {
  const digest = keccak256(Buffer.from(label, "utf8"));
  const value = BigInt(`0x${digest.toString("hex")}`) - 1n;
  return `0x${value.toString(16).padStart(64, "0")}`;
}

export function eip1967Slot(label) {
  return slotFor(label);
}

function addressFromWord(word) {
  const clean = word.replace(/^0x/, "").padStart(64, "0");
  const address = `0x${clean.slice(-40)}`.toLowerCase();
  return address === ZERO_ADDRESS ? null : address;
}

function decodeUint(result) {
  if (!/^0x[0-9a-fA-F]{64,}$/.test(result)) return null;
  return BigInt(`0x${result.slice(2, 66)}`).toString(10);
}

function decodeBool(result) {
  const value = decodeUint(result);
  if (value === "0") return false;
  if (value === "1") return true;
  return null;
}

function decodeAddress(result) {
  if (!/^0x[0-9a-fA-F]{64,}$/.test(result)) return null;
  return addressFromWord(result.slice(0, 66));
}

function decodeString(result) {
  const clean = result.replace(/^0x/, "");
  if (clean.length < 64) return null;
  try {
    const offset = Number(BigInt(`0x${clean.slice(0, 64)}`));
    const lengthAt = offset * 2;
    if (offset >= 32 && clean.length >= lengthAt + 64) {
      const length = Number(BigInt(`0x${clean.slice(lengthAt, lengthAt + 64)}`));
      const start = lengthAt + 64;
      if (length >= 0 && clean.length >= start + length * 2) {
        return Buffer.from(clean.slice(start, start + length * 2), "hex").toString("utf8").replace(/\0+$/g, "");
      }
    }
    return Buffer.from(clean.slice(0, 64), "hex").toString("utf8").replace(/\0+$/g, "") || null;
  } catch {
    return null;
  }
}

function selectorHits(code) {
  const clean = code.replace(/^0x/, "").toLowerCase();
  return SELECTORS.filter((entry) => clean.includes(entry.selector)).map(({ selector, ...entry }) => ({
    ...entry,
    selector: `0x${selector}`,
    confidence: "heuristic",
    note: "Selector bytes occur in runtime bytecode; this does not prove the function is reachable or permissionless.",
  }));
}

async function readCall(rpc, address, data, blockTag, decoder) {
  const result = await optional(() => rpc.call("eth_call", [{ to: address, data }, blockTag]));
  if (!result.ok) return { status: "unavailable", error: result.error };
  const decoded = decoder(result.value);
  return decoded === null ? { status: "unparsed", raw: result.value } : { status: "verified", value: decoded };
}

function finding(level, title, evidence, limitation) {
  return { level, title, evidence, limitation };
}

export async function createSnapshot({ address, rpcUrl, requestedBlock = "latest" }) {
  const rpc = new RpcClient(rpcUrl);
  const [chainIdHex, resolvedBlock] = await Promise.all([
    rpc.call("eth_chainId"),
    requestedBlock.startsWith("0x") ? Promise.resolve(requestedBlock) : rpc.call("eth_blockNumber"),
  ]);
  const blockTag = requestedBlock === "latest" ? resolvedBlock : requestedBlock;
  const block = await rpc.call("eth_getBlockByNumber", [blockTag, false]);
  if (!block) throw new Error(`Block not found: ${blockTag}`);

  const implementationSlot = slotFor("eip1967.proxy.implementation");
  const adminSlot = slotFor("eip1967.proxy.admin");
  const beaconSlot = slotFor("eip1967.proxy.beacon");

  const code = await rpc.call("eth_getCode", [address, blockTag]);
  const noCode = { status: "unavailable", error: "No runtime bytecode at target block" };
  let implementationWord = "0x0";
  let adminWord = "0x0";
  let beaconWord = "0x0";
  let implementationCall = noCode;
  let adminCall = noCode;
  let owner = noCode;
  let paused = noCode;
  let name = noCode;
  let symbol = noCode;
  let decimals = noCode;
  let totalSupply = noCode;

  if (code !== "0x") {
    [implementationWord, adminWord, beaconWord, implementationCall, adminCall, owner, paused, name, symbol, decimals, totalSupply] = await Promise.all([
      rpc.call("eth_getStorageAt", [address, implementationSlot, blockTag]),
      rpc.call("eth_getStorageAt", [address, adminSlot, blockTag]),
      rpc.call("eth_getStorageAt", [address, beaconSlot, blockTag]),
      readCall(rpc, address, "0x5c60da1b", blockTag, decodeAddress),
      readCall(rpc, address, "0xf851a440", blockTag, decodeAddress),
      readCall(rpc, address, "0x8da5cb5b", blockTag, decodeAddress),
      readCall(rpc, address, "0x5c975abb", blockTag, decodeBool),
      readCall(rpc, address, "0x06fdde03", blockTag, decodeString),
      readCall(rpc, address, "0x95d89b41", blockTag, decodeString),
      readCall(rpc, address, "0x313ce567", blockTag, decodeUint),
      readCall(rpc, address, "0x18160ddd", blockTag, decodeUint),
    ]);
  }

  const implementationFromSlot = addressFromWord(implementationWord);
  const adminFromSlot = addressFromWord(adminWord);
  const implementation = implementationFromSlot || (implementationCall.status === "verified" ? implementationCall.value : null);
  const admin = adminFromSlot || (adminCall.status === "verified" ? adminCall.value : null);
  const beacon = addressFromWord(beaconWord);
  const implementationCodeResult = implementation
    ? await optional(() => rpc.call("eth_getCode", [implementation, blockTag]))
    : { ok: true, value: "0x" };
  const implementationCode = implementationCodeResult.ok ? implementationCodeResult.value : "0x";

  const findings = [];
  const codeSize = Math.max(0, (code.length - 2) / 2);
  if (codeSize === 0) findings.push(finding("critical", "No runtime bytecode at the target", { address, block: block.number }, "The address may be an EOA, destroyed contract, or absent at this block."));
  if (implementation) findings.push(finding("warning", implementationFromSlot ? "EIP-1967 implementation is set" : "implementation() returns an address", implementationFromSlot ? { implementation, slot: implementationSlot } : { implementation, call: "implementation()" }, "This identifies an implementation address, not who can upgrade it."));
  if (admin) findings.push(finding("warning", adminFromSlot ? "EIP-1967 admin is set" : "admin() returns an address", adminFromSlot ? { admin, slot: adminSlot } : { admin, call: "admin()" }, "Admin authority may be mediated by another contract; inspect the admin separately."));
  if (beacon) findings.push(finding("warning", "EIP-1967 beacon is set", { beacon, slot: beaconSlot }, "The beacon implementation and its owner require separate inspection."));
  if (owner.status === "verified") {
    findings.push(finding(owner.value ? "warning" : "info", owner.value ? "owner() returns a nonzero address" : "owner() returns the zero address", { owner: owner.value || ZERO_ADDRESS }, "owner() alone does not enumerate AccessControl roles, proxy admins, guardians, or custom authorities."));
  }
  if (paused.status === "verified") findings.push(finding("info", `paused() returned ${paused.value}`, { paused: paused.value }, "This is state at one pinned block, not a guarantee about future state."));

  const runtimeSelectors = selectorHits(code);
  const implementationSelectors = implementationCode !== "0x" ? selectorHits(implementationCode) : [];
  for (const entry of [...runtimeSelectors, ...implementationSelectors]) {
    if (["upgrade", "pause", "supply", "roles"].includes(entry.category)) {
      findings.push(finding("heuristic", `${entry.signature} selector bytes detected`, { selector: entry.selector, location: runtimeSelectors.includes(entry) ? "target" : "implementation" }, entry.note));
    }
  }

  return {
    schema: "patch.permission-snapshot.v1",
    generatedAt: new Date().toISOString(),
    target: address.toLowerCase(),
    rpc: new URL(rpcUrl).origin,
    chain: {
      id: Number(BigInt(chainIdHex)),
      idHex: chainIdHex,
    },
    block: {
      number: quantity(block.number),
      numberHex: block.number,
      hash: block.hash,
      timestamp: new Date(Number(BigInt(block.timestamp)) * 1000).toISOString(),
    },
    bytecode: {
      sizeBytes: codeSize,
      keccak256: keccakHex(hexBytes(code)),
      selectorHits: runtimeSelectors,
    },
    proxy: {
      standardChecked: "EIP-1967 storage slots",
      implementation,
      implementationSource: implementationFromSlot ? "eip1967-slot" : implementation ? "implementation-call" : null,
      admin,
      adminSource: adminFromSlot ? "eip1967-slot" : admin ? "admin-call" : null,
      beacon,
      implementationCodeSizeBytes: Math.max(0, (implementationCode.length - 2) / 2),
      implementationCodeKeccak256: implementationCode === "0x" ? null : keccakHex(hexBytes(implementationCode)),
      implementationSelectorHits: implementationSelectors,
    },
    calls: { name, symbol, decimals, totalSupply, owner, paused, implementation: implementationCall, admin: adminCall },
    findings,
    limitations: [
      "This is a read-only permission snapshot, not a comprehensive security audit.",
      "Selector-byte matches are heuristics and may be false positives or unreachable code.",
      "owner() and EIP-1967 slots do not enumerate every custom role, multisig policy, timelock, guardian, or external dependency.",
      "Source verification, transaction simulation, historical event analysis, holder concentration, and liquidity analysis are not included in v1.",
      "The report describes state at the pinned block and cannot guarantee future behavior.",
    ],
  };
}

function displayValue(item) {
  if (item.status === "verified") return String(item.value ?? ZERO_ADDRESS);
  return item.status;
}

export function toMarkdown(snapshot) {
  const lines = [
    "# Patch Permission Snapshot",
    "",
    `- Target: \`${snapshot.target}\``,
    `- Chain ID: \`${snapshot.chain.id}\``,
    `- Block: \`${snapshot.block.number}\` (\`${snapshot.block.hash}\`)`,
    `- Block time: ${snapshot.block.timestamp}`,
    `- Runtime bytecode: ${snapshot.bytecode.sizeBytes} bytes`,
    `- Code hash: \`${snapshot.bytecode.keccak256}\``,
    "",
    "## Direct reads",
    "",
    `- name(): ${displayValue(snapshot.calls.name)}`,
    `- symbol(): ${displayValue(snapshot.calls.symbol)}`,
    `- decimals(): ${displayValue(snapshot.calls.decimals)}`,
    `- totalSupply(): ${displayValue(snapshot.calls.totalSupply)}`,
    `- owner(): ${displayValue(snapshot.calls.owner)}`,
    `- paused(): ${displayValue(snapshot.calls.paused)}`,
    "",
    "## Proxy slots",
    "",
    `- Implementation: ${snapshot.proxy.implementation || "not set"}`,
    `- Admin: ${snapshot.proxy.admin || "not set"}`,
    `- Beacon: ${snapshot.proxy.beacon || "not set"}`,
    "",
    "## Findings",
    "",
  ];

  if (snapshot.findings.length === 0) lines.push("No supported findings were produced. This is not a safety verdict.");
  for (const item of snapshot.findings) {
    lines.push(`### ${item.level.toUpperCase()}: ${item.title}`, "", `Evidence: \`${JSON.stringify(item.evidence)}\``, "", `Limit: ${item.limitation}`, "");
  }

  lines.push("## Limitations", "");
  for (const limitation of snapshot.limitations) lines.push(`- ${limitation}`);
  lines.push("", `Generated by \`${snapshot.schema}\` at ${snapshot.generatedAt}.`);
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const snapshot = args.input
    ? JSON.parse(fs.readFileSync(args.input, "utf8"))
    : await createSnapshot({ address: args.address, rpcUrl: args.rpc, requestedBlock: args.block });
  const output = args.format === "json" ? `${JSON.stringify(snapshot, null, 2)}\n` : toMarkdown(snapshot);
  if (args.out) fs.writeFileSync(args.out, output, "utf8");
  else process.stdout.write(output);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
