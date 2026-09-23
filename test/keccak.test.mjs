import test from "node:test";
import assert from "node:assert/strict";
import { keccakHex } from "../src/keccak.mjs";
import { eip1967Slot } from "../src/index.mjs";

test("Ethereum Keccak-256 empty input vector", () => {
  assert.equal(
    keccakHex(Buffer.alloc(0)),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
});

test("Ethereum Keccak-256 abc vector", () => {
  assert.equal(
    keccakHex(Buffer.from("abc", "utf8")),
    "0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45",
  );
});

test("EIP-1967 implementation slot", () => {
  assert.equal(
    eip1967Slot("eip1967.proxy.implementation"),
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  );
});
