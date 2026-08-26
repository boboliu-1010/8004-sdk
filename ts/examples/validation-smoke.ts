import { SDK } from "../src/index.js";

async function main() {
  const nonce = Date.now();
  const bpk = process.env.BSC_AGENT_PRIVATE_KEY as string;
  const tpk = (process.env.TRON_PRIVATE_KEY || process.env.TRON_AGENT_PRIVATE_KEY || process.env.TRON_OWNER_PRIVATE_KEY) as string;
  const bsc = new SDK({ network: "eip155:97", rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545", signer: bpk });

  const bagent = bsc.createAgent({ name: `TS Val BSC ${Date.now()}`, description: "validation smoke" });
  const brtx = await bagent.register("https://example.com/agent-card.json");
  const br = await brtx.waitConfirmed({ timeoutMs: 240000 });
  const bAgentId = br.result.agentId as string;

  const breq = await bsc.validationRequest({
    validatorAddress: bsc.chain.signerAddress as string,
    agentId: bAgentId,
    requestURI: `ipfs://QmValidationRequest-${nonce}`,
  });
  console.log("BSC_VREQ_TX", breq.txHash);
  const breqRes = await breq.waitConfirmed({ timeoutMs: 240000 });
  const reqHash = breqRes.result.requestHash;
  console.log("BSC_REQ_HASH", reqHash);

  const bresp = await bsc.validationResponse({
    requestHash: reqHash,
    response: 95,
    responseURI: `ipfs://QmValidationResponse-${nonce}`,
    tag: "market-order",
  });
  console.log("BSC_VRESP_TX", bresp.txHash);
  await bresp.waitConfirmed({ timeoutMs: 240000 });
  console.log("BSC_VSTATUS", await bsc.getValidationStatus(reqHash));

  const tron = new SDK({
    network: process.env.TRON_NETWORK || "nile",
    rpcUrl: process.env.TRON_RPC_URL || "https://nile.trongrid.io",
    signer: tpk,
    feeLimit: Number(process.env.TRON_FEE_LIMIT || 120000000),
  });
  const tagent = tron.createAgent({ name: `TS Val TRON ${Date.now()}`, description: "validation smoke" });
  const trtx = await tagent.register("https://example.com/agent-card.json");
  const tr = await trtx.waitConfirmed({ timeoutMs: 240000 });
  const tAgentId = tr.result.agentId as string;

  const treq = await tron.validationRequest({
    validatorAddress: tron.chain.signerAddress as string,
    agentId: tAgentId,
    requestURI: `ipfs://QmValidationRequestTron-${nonce}`,
  });
  console.log("TRON_VREQ_TX", treq.txHash);
  const treqRes = await treq.waitConfirmed({ timeoutMs: 240000 });
  const tReqHash = treqRes.result.requestHash;
  console.log("TRON_REQ_HASH", tReqHash);

  const tresp = await tron.validationResponse({
    requestHash: tReqHash,
    response: 93,
    responseURI: `ipfs://QmValidationResponseTron-${nonce}`,
    tag: "market-order",
  });
  console.log("TRON_VRESP_TX", tresp.txHash);
  await tresp.waitConfirmed({ timeoutMs: 240000 });
  try {
    console.log("TRON_VSTATUS", await tron.getValidationStatus(tReqHash));
  } catch (e) {
    console.log("TRON_VSTATUS_READ_FAILED", String(e));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
