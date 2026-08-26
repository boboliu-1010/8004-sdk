import assert from "node:assert/strict";
import test from "node:test";

import { SDK } from "../src/core/sdk.js";

const MAINNET_AGENT_ID = "728126428:36";
const NILE_CHAIN_ID = 3448148188;

function nileSdk(): SDK {
  return new SDK({
    network: "nile",
    rpcUrl: "http://unused.invalid",
  });
}

test("Nile rejects a Mainnet-prefixed agent ID before chain access", async () => {
  const sdk = nileSdk();
  const mismatch = new RegExp(`chainId=728126428.*chainId=${NILE_CHAIN_ID}`);

  const operations = [
    () => sdk.loadAgent(MAINNET_AGENT_ID),
    () => sdk.getAgentWallet(MAINNET_AGENT_ID),
    () => sdk.giveFeedback({ agentId: MAINNET_AGENT_ID, value: 1 }),
    () => sdk.getFeedback(MAINNET_AGENT_ID, "TReviewer", 1),
    () => sdk.getReputationSummary(MAINNET_AGENT_ID),
    () => sdk.appendResponse({
      agentId: MAINNET_AGENT_ID,
      clientAddress: "TReviewer",
      feedbackIndex: 1,
      responseURI: "ipfs://response",
    }),
    () => sdk.revokeFeedback(MAINNET_AGENT_ID, 1),
    () => sdk.validationRequest({
      agentId: MAINNET_AGENT_ID,
      validatorAddress: "TValidator",
      requestURI: "ipfs://request",
    }),
  ];

  for (const operation of operations) {
    await assert.rejects(operation, mismatch);
  }
});

test("Nile canonicalizes an unprefixed agent ID", async () => {
  const sdk = nileSdk();
  sdk.chain.getClients = async () => [];

  const summary = await sdk.getReputationSummary("36");

  assert.equal(summary.agentId, "3448148188:36");
});
