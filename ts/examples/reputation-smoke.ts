import { SDK } from "../src/index.js";

async function main() {
  const bpk = process.env.BSC_AGENT_PRIVATE_KEY as string;
  const tpk = (process.env.TRON_PRIVATE_KEY || process.env.TRON_AGENT_PRIVATE_KEY || process.env.TRON_OWNER_PRIVATE_KEY) as string;
  const bReviewer = process.env.BSC_REVIEWER_PRIVATE_KEY;
  const tReviewer = process.env.TRON_REVIEWER_PRIVATE_KEY;
  const bsc = new SDK({ network: "eip155:97", rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545", signer: bpk });

  const bagent = bsc.createAgent({ name: `TS Rep BSC ${Date.now()}`, description: "reputation smoke" });
  const brtx = await bagent.register("https://example.com/agent-card.json");
  const br = await brtx.waitConfirmed({ timeoutMs: 240000 });
  const bAgentId = br.result.agentId as string;

  if (bReviewer) {
    const bfb = await bsc.giveFeedback({
      agentId: bAgentId,
      reviewerSigner: bReviewer,
      value: 88.5,
      tag1: "execution",
      tag2: "market-swap",
      endpoint: "/a2a/x402/execute",
    });
    console.log("BSC_FEEDBACK_TX", bfb.txHash);
    const bfr = await bfb.waitConfirmed({ timeoutMs: 240000 });
    console.log("BSC_FEEDBACK_IDX", bfr.result.feedbackIndex);
    console.log("BSC_FEEDBACK", await bsc.getFeedback(bAgentId, bfr.result.reviewer, bfr.result.feedbackIndex));
    console.log("BSC_SUMMARY", await bsc.getReputationSummary(bAgentId));
  } else {
    console.log("BSC_FEEDBACK_SKIPPED", "missing BSC_REVIEWER_PRIVATE_KEY");
  }

  const tron = new SDK({
    network: process.env.TRON_NETWORK || "nile",
    rpcUrl: process.env.TRON_RPC_URL || "https://nile.trongrid.io",
    signer: tpk,
    feeLimit: Number(process.env.TRON_FEE_LIMIT || 120000000),
  });
  const tagent = tron.createAgent({ name: `TS Rep TRON ${Date.now()}`, description: "reputation smoke" });
  const trtx = await tagent.register("https://example.com/agent-card.json");
  const tr = await trtx.waitConfirmed({ timeoutMs: 240000 });
  const tAgentId = tr.result.agentId as string;

  if (tReviewer) {
    const tfb = await tron.giveFeedback({
      agentId: tAgentId,
      reviewerSigner: tReviewer,
      value: 91,
      tag1: "execution",
      tag2: "market-swap",
      endpoint: "/a2a/x402/execute",
    });
    console.log("TRON_FEEDBACK_TX", tfb.txHash);
    const tfr = await tfb.waitConfirmed({ timeoutMs: 240000 });
    console.log("TRON_FEEDBACK_IDX", tfr.result.feedbackIndex);
    console.log("TRON_FEEDBACK", await tron.getFeedback(tAgentId, tfr.result.reviewer, tfr.result.feedbackIndex));
    console.log("TRON_SUMMARY", await tron.getReputationSummary(tAgentId));
  } else {
    console.log("TRON_FEEDBACK_SKIPPED", "missing TRON_REVIEWER_PRIVATE_KEY");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
