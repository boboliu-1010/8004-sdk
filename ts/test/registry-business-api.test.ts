import assert from "node:assert/strict";
import test from "node:test";

import { Agent, SDK, type RegistrationFile } from "../src/index.js";

function baseSdk(): SDK {
  return new SDK({ network: "base", rpcUrl: "http://unused.invalid" });
}

test("SDK exposes the official Registry business read APIs", () => {
  for (const method of [
    "getMetadata",
    "getAgentURI",
    "getAgentOwner",
    "getApproved",
    "isApprovedForAll",
    "getClients",
    "getLastIndex",
    "readAllFeedback",
    "getResponseCount",
    "getValidationSummary",
    "getAgentValidations",
    "getValidatorRequests",
  ]) {
    assert.equal(typeof (SDK.prototype as Record<string, unknown>)[method], "function", `missing SDK.${method}`);
  }
});

test("Agent exposes per-agent approval management", () => {
  assert.equal(typeof (Agent.prototype as unknown as Record<string, unknown>).approve, "function");
});

test("Base readAllFeedback maps official parallel arrays into records", async () => {
  const sdk = baseSdk();
  sdk.chain.readAllFeedback = async () => [[
    "0x1111111111111111111111111111111111111111",
  ], [3n], [875n], [2], ["quality"], ["latency"], [false]];

  const records = await sdk.readAllFeedback("8453:42");

  assert.deepEqual(records, [{
    agentId: "8453:42",
    reviewer: "0x1111111111111111111111111111111111111111",
    feedbackIndex: 3,
    value: 8.75,
    valueDecimals: 2,
    tag1: "quality",
    tag2: "latency",
    isRevoked: false,
  }]);
});

test("Base validation summary preserves the canonical agent ID", async () => {
  const sdk = baseSdk();
  sdk.chain.getValidationSummary = async () => [4n, 91];

  assert.deepEqual(await sdk.getValidationSummary(42), {
    agentId: "8453:42",
    count: 4,
    averageResponse: 91,
  });
});

test("Agent approve returns the transaction produced by the chain adapter", async () => {
  const sdk = baseSdk();
  sdk.chain.approve = async () => "0xapproval";
  const registration: RegistrationFile = {
    agentId: "8453:42",
    name: "agent",
    description: "",
    endpoints: [],
    tags: [],
    metadata: {},
    supportedTrust: [],
    active: true,
    x402support: false,
    updatedAt: 0,
  };

  const tx = await new Agent(sdk, registration).approve("0x2222222222222222222222222222222222222222");

  assert.equal(tx.txHash, "0xapproval");
});
