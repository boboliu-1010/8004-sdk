import { SDK } from "../src/index.js";

async function main() {
  const bpk = process.env.BSC_AGENT_PRIVATE_KEY as string;
  const tpk = (process.env.TRON_PRIVATE_KEY || process.env.TRON_AGENT_PRIVATE_KEY || process.env.TRON_OWNER_PRIVATE_KEY) as string;
  const bsc = new SDK({ network: "eip155:97", rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545", signer: bpk });

  const bagent = bsc.createAgent({ name: `TS Wallet BSC ${Date.now()}`, description: "wallet flow test" });
  const brtx = await bagent.register("https://example.com/agent-card.json");
  console.log("BSC_REGISTER_TX", brtx.txHash);
  const br = await brtx.waitConfirmed({ timeoutMs: 240000 });
  console.log("BSC_AGENT", br.result.agentId);
  const buw = await bagent.unsetWallet();
  if (buw) { console.log("BSC_UNSET_TX", buw.txHash); await buw.waitConfirmed({ timeoutMs: 240000 }); }
  for (let i = 0; i < 10; i++) {
    if (!(await bagent.getWallet())) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const baddr = bsc.chain.signerAddress as string;
  const bsw = await bagent.setWallet(baddr);
  if (bsw) { console.log("BSC_SET_TX", bsw.txHash); await bsw.waitConfirmed({ timeoutMs: 240000 }); }
  console.log("BSC_WALLET", await bagent.getWallet());

  const tron = new SDK({
    network: process.env.TRON_NETWORK || "nile",
    rpcUrl: process.env.TRON_RPC_URL || "https://nile.trongrid.io",
    signer: tpk,
    feeLimit: Number(process.env.TRON_FEE_LIMIT || 120000000),
  });
  const tagent = tron.createAgent({ name: `TS Wallet TRON ${Date.now()}`, description: "wallet flow test" });
  const trtx = await tagent.register("https://example.com/agent-card.json");
  console.log("TRON_REGISTER_TX", trtx.txHash);
  const tr = await trtx.waitConfirmed({ timeoutMs: 240000 });
  console.log("TRON_AGENT", tr.result.agentId);
  const tuw = await tagent.unsetWallet();
  if (tuw) { console.log("TRON_UNSET_TX", tuw.txHash); await tuw.waitConfirmed({ timeoutMs: 240000 }); }
  for (let i = 0; i < 12; i++) {
    if (!(await tagent.getWallet())) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  const taddr = tron.chain.signerAddress as string;
  const tsw = await tagent.setWallet(taddr);
  if (tsw) { console.log("TRON_SET_TX", tsw.txHash); await tsw.waitConfirmed({ timeoutMs: 240000 }); }
  console.log("TRON_WALLET", await tagent.getWallet());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
