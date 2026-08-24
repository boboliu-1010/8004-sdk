import assert from "node:assert/strict";
import test from "node:test";

import chainsJson from "../resource/chains.json" with { type: "json" };
import { resolveChainFromConfig } from "../src/core/chains.js";

const cases = [
  ["mainnet", 728126428],
  ["nile", 3448148188],
  ["shasta", 2494104990],
  ["tron", 3448148188],
  ["tron:nile", 3448148188],
  ["tron:mainnet", 728126428],
  ["tron:shasta", 2494104990],
  ["  Tron:Shasta  ", 2494104990],
] as const;

for (const [network, expectedChainId] of cases) {
  test(`${network} resolves to its canonical TRON chain ID`, () => {
    const resolved = resolveChainFromConfig(chainsJson, network);

    assert.equal(resolved.resolvedChainId, expectedChainId);
  });
}

test("an explicit TRON chain ID preserves legacy behavior", () => {
  const resolved = resolveChainFromConfig(chainsJson, "nile", 1);

  assert.equal(resolved.resolvedChainId, 1);
});

test("an unknown TRON network has a clear error", () => {
  assert.throws(
    () => resolveChainFromConfig(chainsJson, "tron:unknown"),
    /Unknown TRON network: unknown/,
  );
});
