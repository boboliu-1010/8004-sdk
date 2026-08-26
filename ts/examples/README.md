# TypeScript Examples Guide

Runnable TypeScript examples for 8004 flows:
- Agent registration
- Wallet management (`setWallet` / `unsetWallet`)
- Reputation feedback
- Validation request/response
- Agent lifecycle updates (`loadAgent`, `updateRegistration`, transfer/operator APIs)

## 1. Prerequisites

Run from `8004-sdk/ts`:

```bash
npm install
npm run build
```

Required:
- Node.js >= 20
- Funded key(s) for BSC and/or TRON test networks

BSC CAIP-2 IDs used in examples:
- `eip155:56` (mainnet)
- `eip155:97` (testnet)

Notes:
- Examples mainly use local constants in script files.
- `.env` is optional for smoke automation, not required for basic runs.

## 2. Files In This Folder

- `register-bsc.ts`: Register one agent on BSC testnet
- `register-tron.ts`: Register one agent on TRON Nile
- `wallet-smoke.ts`: Register -> unsetWallet -> setWallet -> getWallet (BSC + TRON)
- `reputation-smoke.ts`: Reputation flow (BSC + TRON)
- `validation-smoke.ts`: Validation flow (BSC + TRON)

## 3. How Agent Creation Works (Step by Step)

All examples use the same build order:

1. Create SDK client
2. Create in-memory agent with `createAgent(...)`
3. Optionally configure capability/profile fields
4. Register with `agent.register(agentCardUri)`
5. Wait confirmed and read `agentId`

Example:

```ts
import { SDK } from "@bankofai/8004-sdk";

const sdk = new SDK({
  network: "eip155:97",
  rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
  signer: "<EVM_PRIVATE_KEY>",
});

const agent = sdk.createAgent({
  name: `Sample Agent ${Date.now()}`,
  description: "sample register",
  image: "https://example.com/agent.png",
});

agent.setMCP("https://mcp.example.com/");
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json");
agent.addSkill("data_engineering/data_transformation_pipeline");
agent.addDomain("technology/data_science/data_science");
agent.setTrust({ reputation: true, cryptoEconomic: true });
agent.setMetadata({ version: "1.0.0", category: "sample" });
agent.setActive(true);
agent.setX402Support(true);

const tx = await agent.register("https://example.com/agent-card.json");
const mined = await tx.waitConfirmed({ timeoutMs: 180_000 });
console.log(mined.result.agentId, mined.result.agentURI);
```

For TRON, the default agent ID identifies the selected network:

| Network | Agent ID for token `123` |
| --- | --- |
| Nile | `3448148188:123` |
| Mainnet | `728126428:123` |
| Shasta | `2494104990:123` |

Older SDK versions defaulted to `1:<tokenId>`. Existing persisted IDs are not
rewritten automatically; migrate storage keys, parsers, validators, and indexes to
the network-specific format. Passing `chainId: 1` explicitly preserves the legacy
format temporarily, but it is ambiguous across TRON networks and is not recommended
for new data.

Field purpose:
- `name`, `description`, `image`: base agent profile
- `setMCP(url)`: MCP endpoint
- `setA2A(url)`: A2A endpoint
- `addSkill(...)`, `addDomain(...)`: taxonomy tags for discovery
- `setTrust(...)`: trust model flags
- `setMetadata(...)`: extra custom fields
- `setActive(true)`: active/discoverable status
- `setX402Support(true)`: x402 capability flag
- `register(uri)`: submit final registration URI to chain

## 4.1 Extra High-Level APIs

```ts
// load and update
const loaded = await sdk.loadAgent("97:123");
loaded.updateInfo({ description: "updated" });
loaded.setENS("myagent.eth");
await loaded.updateRegistration("https://example.com/agent-card-updated.json");

// feedback moderation
await sdk.appendResponse({
  agentId: "97:123",
  clientAddress: "0x....",
  feedbackIndex: 1,
  responseURI: "ipfs://QmResponse",
});
await sdk.revokeFeedback("97:123", 1);

// transfer/operator
await loaded.addOperator("0x....");
await loaded.removeOperator("0x....");
await loaded.transfer("0xNewOwner....");
```

## 5. Quick Run

```bash
npx tsx examples/register-bsc.ts
npx tsx examples/register-tron.ts
npx tsx examples/wallet-smoke.ts
npx tsx examples/reputation-smoke.ts
npx tsx examples/validation-smoke.ts
```

## 6. Reputation Notes

Contracts reject self-feedback.

If you see:
- `Self-feedback not allowed`

Use a different reviewer wallet and pass `reviewerSigner`.

## 7. Validation Notes

- `validationRequest` needs a unique `requestHash`
- Duplicate hash can fail with `exists`
- Current samples generate unique values to avoid collisions

## 8. Common Errors

- TRON `REVERT`
  - Check network and RPC match (`nile/mainnet/shasta`)
  - Check account energy/bandwidth and `feeLimit`

- BSC timeout
  - Check RPC health and gas balance

- Read result delay
  - Wait a few seconds and retry
