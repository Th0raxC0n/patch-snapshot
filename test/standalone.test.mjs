import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalonePath = path.join(root, "dist", "patch-snapshot.mjs");

test("standalone CLI exposes help without installing packages", () => {
  const output = execFileSync(process.execPath, [standalonePath, "--help"], { encoding: "utf8" });
  assert.match(output, /patch-snapshot --address/);
  assert.match(output, /never requests or uses a wallet key/);
});

test("standalone exports the same cryptographic primitives", async () => {
  const standalone = await import(pathToFileURL(standalonePath));
  assert.equal(
    standalone.keccakHex(Buffer.alloc(0)),
    "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470",
  );
  assert.equal(
    standalone.eip1967Slot("eip1967.proxy.implementation"),
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  );
});

test("standalone checksum manifest matches the generated file", () => {
  const expected = fs.readFileSync(path.join(root, "dist", "SHA256SUMS"), "utf8").trim().split(/\s+/)[0];
  const actual = crypto.createHash("sha256").update(fs.readFileSync(standalonePath)).digest("hex");
  assert.equal(actual, expected);
});
