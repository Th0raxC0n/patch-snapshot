import test from "node:test";
import assert from "node:assert/strict";
import {
  PATCH_PAYMENT_RECIPIENT,
  PATCH_TOKEN,
  TRANSFER_TOPIC,
  evaluatePatchPayment,
  formatTokenAmount,
  parseTokenAmount,
} from "../src/payment.mjs";

function addressTopic(address) {
  return `0x${address.slice(2).padStart(64, "0")}`;
}

test("PATCH decimal amounts round-trip", () => {
  assert.equal(parseTokenAmount("25000"), 25_000n * 10n ** 18n);
  assert.equal(parseTokenAmount("1.25"), 1_250_000_000_000_000_000n);
  assert.equal(formatTokenAmount(1_250_000_000_000_000_000n), "1.25");
});

test("payment verifier accepts a successful PATCH transfer to the recipient", () => {
  const amount = parseTokenAmount("25000");
  const receipt = {
    status: "0x1",
    blockNumber: "0x64",
    blockHash: `0x${"ab".repeat(32)}`,
    logs: [{
      address: PATCH_TOKEN,
      topics: [
        TRANSFER_TOPIC,
        addressTopic("0x1111111111111111111111111111111111111111"),
        addressTopic(PATCH_PAYMENT_RECIPIENT),
      ],
      data: `0x${amount.toString(16).padStart(64, "0")}`,
      logIndex: "0x2",
    }],
  };
  const result = evaluatePatchPayment({ receipt, latestBlock: 102n, minimumUnits: amount });
  assert.equal(result.paid, true);
  assert.equal(result.receivedUnits, amount);
  assert.equal(result.confirmations, 3n);
});

test("payment verifier rejects unrelated token transfers", () => {
  const receipt = {
    status: "0x1",
    blockNumber: "0x64",
    logs: [{
      address: "0x2222222222222222222222222222222222222222",
      topics: [TRANSFER_TOPIC, addressTopic(PATCH_PAYMENT_RECIPIENT), addressTopic(PATCH_PAYMENT_RECIPIENT)],
      data: `0x${parseTokenAmount("999999").toString(16).padStart(64, "0")}`,
    }],
  };
  const result = evaluatePatchPayment({ receipt, latestBlock: 100n, minimumUnits: parseTokenAmount("1") });
  assert.equal(result.paid, false);
  assert.equal(result.receivedUnits, 0n);
});

test("payment verifier rejects failed transactions", () => {
  assert.throws(
    () => evaluatePatchPayment({ receipt: { status: "0x0", logs: [] }, latestBlock: 100n, minimumUnits: 1n }),
    /did not succeed/,
  );
});
