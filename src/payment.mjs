#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { keccakHex } from "./keccak.mjs";

export const ROBINHOOD_CHAIN_ID = 4663n;
export const DEFAULT_ROBINHOOD_RPC = "https://rpc.mainnet.chain.robinhood.com";
export const FALLBACK_ROBINHOOD_RPC = "https://robinhood.drpc.org";
export const PATCH_TOKEN = "0x5a84b799627d22bbdfafa2290a657c96960034bd";
export const PATCH_PAYMENT_RECIPIENT = "0x1c417b6bd82ae88dc94d2897f3c6a635dfd5d92c";
export const PATCH_DECIMALS = 18;
export const TRANSFER_TOPIC = keccakHex(Buffer.from("Transfer(address,address,uint256)", "utf8"));

function usage() {
  return `patch-payment --tx 0x... --min AMOUNT [options]

Verify a PATCH priority-payment transaction on Robinhood Chain.

Options:
  --tx HASH              payment transaction hash
  --min AMOUNT           quoted minimum PATCH amount (for example: 25000)
  --recipient ADDRESS    override the default Patch service wallet
  --rpc URL              Robinhood Chain RPC endpoint
  --confirmations N      required confirmations (default: 1)
  --format FORMAT        json or markdown (default: markdown)
  --help                 show this help

This command is read-only. It never requests a wallet key or token approval.`;
}

function parseArgs(argv) {
  const args = {
    rpc: process.env.PATCH_RPC_URL,
    recipient: PATCH_PAYMENT_RECIPIENT,
    confirmations: 1,
    format: "markdown",
  };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i];
    if (value === "--help") args.help = true;
    else if (value === "--tx") args.txHash = argv[++i];
    else if (value === "--min") args.minimum = argv[++i];
    else if (value === "--recipient") args.recipient = argv[++i];
    else if (value === "--rpc") args.rpc = argv[++i];
    else if (value === "--confirmations") args.confirmations = Number(argv[++i]);
    else if (value === "--format") args.format = argv[++i];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (args.help) return args;
  if (!/^0x[0-9a-fA-F]{64}$/.test(args.txHash || "")) throw new Error("--tx must be a 32-byte transaction hash");
  if (!/^0x[0-9a-fA-F]{40}$/.test(args.recipient || "")) throw new Error("--recipient must be an EVM address");
  if (args.minimum === undefined) throw new Error("--min is required; use the quoted PATCH amount");
  if (!Number.isInteger(args.confirmations) || args.confirmations < 1) throw new Error("--confirmations must be a positive integer");
  if (!new Set(["json", "markdown"]).has(args.format)) throw new Error("--format must be json or markdown");
  return args;
}

export function parseTokenAmount(value, decimals = PATCH_DECIMALS) {
  const text = String(value).trim();
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) throw new Error("Token amount must be a non-negative decimal string");
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > decimals) throw new Error(`Token amount has more than ${decimals} decimal places`);
  return BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals));
}

export function formatTokenAmount(value, decimals = PATCH_DECIMALS) {
  const units = BigInt(value);
  const scale = 10n ** BigInt(decimals);
  const whole = units / scale;
  const fraction = (units % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function normalizeAddress(value) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(value || "")) return null;
  return value.toLowerCase();
}

function addressFromTopic(topic) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(topic || "")) return null;
  return normalizeAddress(`0x${topic.slice(-40)}`);
}

function hexQuantity(value, label) {
  if (!/^0x[0-9a-fA-F]+$/.test(value || "")) throw new Error(`Invalid ${label}`);
  return BigInt(value);
}

async function rpcCall(url, method, params = []) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": "patch-snapshot/0.2.0" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
      continue;
    }
    if (!response.ok) throw new Error(`RPC HTTP ${response.status} for ${method}`);
    const body = await response.json();
    if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`);
    return body.result;
  }
  throw new Error(`RPC retry budget exhausted for ${method}`);
}

async function selectRpc(explicitUrl) {
  const candidates = explicitUrl ? [explicitUrl] : [DEFAULT_ROBINHOOD_RPC, FALLBACK_ROBINHOOD_RPC];
  const failures = [];
  for (const candidate of candidates) {
    try {
      const chainIdHex = await rpcCall(candidate, "eth_chainId");
      const chainId = hexQuantity(chainIdHex, "chain ID");
      if (chainId !== ROBINHOOD_CHAIN_ID) {
        failures.push(`${new URL(candidate).origin}: wrong chain ${chainId}`);
        continue;
      }
      return { rpcUrl: candidate, chainIdHex };
    } catch (error) {
      failures.push(`${new URL(candidate).origin}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`No usable Robinhood Chain RPC endpoint (${failures.join("; ")})`);
}

export function evaluatePatchPayment({ receipt, latestBlock, minimumUnits, recipient = PATCH_PAYMENT_RECIPIENT }) {
  if (!receipt) throw new Error("Transaction receipt not found");
  if (receipt.status !== "0x1") throw new Error("Transaction did not succeed");
  const normalizedRecipient = normalizeAddress(recipient);
  if (!normalizedRecipient) throw new Error("Invalid payment recipient");

  const transfers = [];
  for (const log of receipt.logs || []) {
    if (normalizeAddress(log.address) !== PATCH_TOKEN) continue;
    if ((log.topics?.[0] || "").toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) continue;
    if (log.topics.length < 3 || addressFromTopic(log.topics[2]) !== normalizedRecipient) continue;
    const amountUnits = hexQuantity(log.data, "Transfer amount");
    transfers.push({
      from: addressFromTopic(log.topics[1]),
      to: normalizedRecipient,
      amountUnits,
      logIndex: log.logIndex || null,
    });
  }

  const receivedUnits = transfers.reduce((total, transfer) => total + transfer.amountUnits, 0n);
  const blockNumber = hexQuantity(receipt.blockNumber, "receipt block number");
  const head = BigInt(latestBlock);
  const confirmations = head >= blockNumber ? head - blockNumber + 1n : 0n;
  return {
    paid: receivedUnits >= BigInt(minimumUnits),
    receivedUnits,
    confirmations,
    transfers,
    blockNumber,
  };
}

export async function verifyPatchPayment({
  txHash,
  minimum,
  recipient = PATCH_PAYMENT_RECIPIENT,
  rpcUrl,
  requiredConfirmations = 1,
}) {
  const minimumUnits = parseTokenAmount(minimum);
  if (minimumUnits <= 0n) throw new Error("Minimum payment must be greater than zero");
  const selected = await selectRpc(rpcUrl);
  const [receipt, latestBlockHex] = await Promise.all([
    rpcCall(selected.rpcUrl, "eth_getTransactionReceipt", [txHash]),
    rpcCall(selected.rpcUrl, "eth_blockNumber"),
  ]);
  const chainId = hexQuantity(selected.chainIdHex, "chain ID");
  if (chainId !== ROBINHOOD_CHAIN_ID) throw new Error(`Wrong chain: expected ${ROBINHOOD_CHAIN_ID}, received ${chainId}`);

  const evaluated = evaluatePatchPayment({
    receipt,
    latestBlock: hexQuantity(latestBlockHex, "latest block"),
    minimumUnits,
    recipient,
  });
  if (!evaluated.paid) {
    throw new Error(`Insufficient PATCH payment: received ${formatTokenAmount(evaluated.receivedUnits)}, required ${formatTokenAmount(minimumUnits)}`);
  }
  if (evaluated.confirmations < BigInt(requiredConfirmations)) {
    throw new Error(`Payment has ${evaluated.confirmations} confirmation(s); ${requiredConfirmations} required`);
  }

  return {
    schema: "patch.payment-proof.v1",
    verifiedAt: new Date().toISOString(),
    rpc: new URL(selected.rpcUrl).origin,
    chain: { name: "Robinhood Chain", id: Number(ROBINHOOD_CHAIN_ID) },
    transactionHash: txHash.toLowerCase(),
    blockNumber: evaluated.blockNumber.toString(),
    blockHash: receipt.blockHash,
    confirmations: evaluated.confirmations.toString(),
    token: { symbol: "PATCH", address: PATCH_TOKEN, decimals: PATCH_DECIMALS },
    recipient: recipient.toLowerCase(),
    minimum: formatTokenAmount(minimumUnits),
    received: formatTokenAmount(evaluated.receivedUnits),
    transfers: evaluated.transfers.map((transfer) => ({
      ...transfer,
      amountUnits: transfer.amountUnits.toString(),
      amount: formatTokenAmount(transfer.amountUnits),
    })),
    qualified: true,
    note: "This proves an onchain token transfer, not completion or quality of the requested service. A transaction hash must not be reused for another request.",
  };
}

export function paymentToMarkdown(proof) {
  return `# Patch Priority Payment Proof

- Qualified: **yes**
- Transaction: \`${proof.transactionHash}\`
- Chain: ${proof.chain.name} (\`${proof.chain.id}\`)
- Block: \`${proof.blockNumber}\` (\`${proof.blockHash}\`)
- Confirmations at verification: ${proof.confirmations}
- PATCH received: **${proof.received}**
- Required minimum: ${proof.minimum}
- Recipient: \`${proof.recipient}\`
- Token: \`${proof.token.address}\`

${proof.note}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const proof = await verifyPatchPayment({
    txHash: args.txHash,
    minimum: args.minimum,
    recipient: args.recipient,
    rpcUrl: args.rpc,
    requiredConfirmations: args.confirmations,
  });
  process.stdout.write(args.format === "json" ? `${JSON.stringify(proof, null, 2)}\n` : paymentToMarkdown(proof));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
