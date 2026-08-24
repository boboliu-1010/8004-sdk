import { SDK } from "../src/index.js";

const PRIVATE_KEY = "<TRON_PRIVATE_KEY>";

const sdk = new SDK({
  network: "nile",
  rpcUrl: "https://nile.trongrid.io",
  signer: PRIVATE_KEY,
  feeLimit: 120_000_000,
});

const agent = sdk.createAgent({
  name: `TS TRON Agent ${Date.now()}`,
  description: "TypeScript register sample on TRON Nile",
  image: "https://example.com/agent.png",
});

agent.setMCP("https://mcp.example.com/");
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json");
agent.setTrust({ reputation: true, cryptoEconomic: true });
agent.setMetadata({ version: "1.0.0", runtime: "ts" });
agent.setX402Support(true);

const tx = await agent.register("https://example.com/agent-card.json");
console.log("tx:", tx.txHash);
const mined = await tx.waitConfirmed({ timeoutMs: 180_000 });
console.log("agent:", mined.result.agentId);
