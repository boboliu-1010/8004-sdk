import assert from "node:assert/strict";
import test from "node:test";

import chainsJson from "../resource/chains.json" with { type: "json" };
import { resolveChainFromConfig } from "../src/core/chains.js";

const MAINNET_CONTRACTS = {
  identityRegistry: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
  reputationRegistry: "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63",
  validationRegistry: "0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58",
};

const TESTNET_CONTRACTS = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
  validationRegistry: "0x8004Cb1BF31DAf7788923b405b754f57acEB4272",
};

for (const network of ["base", "base:mainnet", "eip155:8453"]) {
  test(`${network} resolves to official Base mainnet deployment`, () => {
    const resolved = resolveChainFromConfig(chainsJson, network);

    assert.equal(resolved.chainType, "evm");
    assert.equal(resolved.resolvedChainId, 8453);
    assert.equal(resolved.resolvedNetwork, network === "eip155:8453" ? network : "base:mainnet");
    assert.deepEqual(resolved.contracts, MAINNET_CONTRACTS);
  });
}

for (const network of ["base:sepolia", "eip155:84532"]) {
  test(`${network} resolves to official Base Sepolia deployment`, () => {
    const resolved = resolveChainFromConfig(chainsJson, network);

    assert.equal(resolved.chainType, "evm");
    assert.equal(resolved.resolvedChainId, 84532);
    assert.equal(resolved.resolvedNetwork, network === "eip155:84532" ? network : "base:sepolia");
    assert.deepEqual(resolved.contracts, TESTNET_CONTRACTS);
  });
}

test("Base aliases reject a conflicting explicit chain ID", () => {
  assert.throws(
    () => resolveChainFromConfig(chainsJson, "base", 84532),
    /chainId\/network mismatch/,
  );
});
