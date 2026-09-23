const MASK_64 = (1n << 64n) - 1n;

const ROUND_CONSTANTS = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an,
  0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n,
  0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an,
  0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n,
  0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n,
  0x000000000000800an, 0x800000008000000an, 0x8000000080008081n,
  0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];

const ROTATION = [
  0, 1, 62, 28, 27,
  36, 44, 6, 55, 20,
  3, 10, 43, 25, 39,
  41, 45, 15, 21, 8,
  18, 2, 61, 56, 14,
];

function rotl64(value, shift) {
  const amount = BigInt(shift);
  if (amount === 0n) return value & MASK_64;
  return ((value << amount) | (value >> (64n - amount))) & MASK_64;
}

function permutation(state) {
  for (const roundConstant of ROUND_CONSTANTS) {
    const columns = new Array(5);
    const deltas = new Array(5);

    for (let x = 0; x < 5; x++) {
      columns[x] = state[x] ^ state[x + 5] ^ state[x + 10] ^ state[x + 15] ^ state[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      deltas[x] = columns[(x + 4) % 5] ^ rotl64(columns[(x + 1) % 5], 1);
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        state[x + 5 * y] = (state[x + 5 * y] ^ deltas[x]) & MASK_64;
      }
    }

    const moved = new Array(25).fill(0n);
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const nextX = y;
        const nextY = (2 * x + 3 * y) % 5;
        moved[nextX + 5 * nextY] = rotl64(state[x + 5 * y], ROTATION[x + 5 * y]);
      }
    }

    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        state[x + 5 * y] = (
          moved[x + 5 * y] ^
          ((~moved[((x + 1) % 5) + 5 * y]) & moved[((x + 2) % 5) + 5 * y])
        ) & MASK_64;
      }
    }
    state[0] = (state[0] ^ roundConstant) & MASK_64;
  }
}

/** @param {Uint8Array} input */
export function keccak256(input) {
  const bytes = Buffer.from(input);
  const rate = 136;
  const paddingLength = rate - (bytes.length % rate);
  const padded = Buffer.alloc(bytes.length + paddingLength);
  bytes.copy(padded);
  padded[bytes.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  const state = new Array(25).fill(0n);
  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let lane = 0; lane < rate / 8; lane++) {
      state[lane] ^= padded.readBigUInt64LE(offset + lane * 8);
    }
    permutation(state);
  }

  const output = Buffer.alloc(32);
  for (let lane = 0; lane < 4; lane++) output.writeBigUInt64LE(state[lane], lane * 8);
  return output;
}

/** @param {Uint8Array} input */
export function keccakHex(input) {
  return `0x${keccak256(input).toString("hex")}`;
}
