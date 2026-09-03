# BankOfAI 8004 SDK (TypeScript)

TypeScript SDK for agent identity, discovery, trust, and reputation based on 8004.

This SDK provides a unified API for registration, wallet binding, feedback/reputation, and validation workflows on Base, BNB Smart Chain, and TRON.

The EVM and TRON adapters use the same official Registry v2 business ABI. The
TRON adapter handles TVM addresses and transaction signing without changing the
public Registry API.

## What Does This SDK Do?

BankOfAI 8004 SDK enables you to:

- Create and manage on-chain agent identities
- Register agent card URIs on-chain (`agent.register()`)
- Register via IPFS uploader hook (`agent.registerIPFS()`)
- Configure MCP/A2A endpoints, skills/domains, trust flags, metadata, and status
- Manage ENS/profile update and endpoint cleanup (`setENS()`, `updateInfo()`, `removeEndpoint()`)
- Manage verified wallet binding (`agent.getWallet()`, `agent.setWallet()`, `agent.unsetWallet()`)
- Submit/read/manage feedback (`giveFeedback()`, `getFeedback()`, `readAllFeedback()`, `appendResponse()`, `revokeFeedback()`, `getReputationSummary()`)
- Run validation request/response flows (`validationRequest()`, `validationResponse()`, `getValidationStatus()`, `getValidationSummary()`)
- Load and update registered agents (`loadAgent()`, `updateRegistration()`, `setAgentUri()`)
- Transfer and operator management (`transfer()`, `addOperator()`, `removeOperator()`)

Package import:

```ts
import { SDK } from "@bankofai/8004-sdk";
```

## Installation

### Prerequisites

- Node.js `>=20`
- npm
- Funded private key or external signer adapter for write operations
- RPC endpoint

### Install from Source (Local)

```bash
git clone https://github.com/bankofai/8004-sdk.git
cd 8004-sdk/ts
npm install
npm run build
```

## Quick Start

```ts
import { SDK } from "@bankofai/8004-sdk";

const sdk = new SDK({
  network: "base", // Base mainnet; also supports base:sepolia, BSC, and TRON aliases
  rpcUrl: "<RPC_URL>",
  signer: "<PRIVATE_KEY>",
});

const agent = sdk.createAgent({
  name: "My AI Agent",
  description: "Demo agent",
  image: "https://example.com/agent.png",
});

agent.setMCP("https://mcp.example.com/");
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json");
agent.setTrust({ reputation: true, cryptoEconomic: true });
agent.setMetadata({ version: "1.1.0" });
agent.setActive(true);

const tx = await agent.register("https://example.com/agent-card.json");
const mined = await tx.waitConfirmed({ timeoutMs: 180_000 });
console.log(mined.result.agentId, mined.result.agentURI);
```

### External Signers

Applications that keep keys in a wallet service can inject a signer adapter
instead of exporting a private key. This matches the Agent0 wallet-provider
pattern while also covering TRON transactions:

```ts
import { SDK, type ExternalSigner } from "@bankofai/8004-sdk";

const signer: ExternalSigner = {
  address: await wallet.getAddress(),
  signTransaction: (transaction) => wallet.signTransaction(transaction),
  signTypedData: (typedData) => wallet.signTypedData(typedData),
};

const sdk = new SDK({ network: "base", rpcUrl: "<RPC_URL>", signer });
```

For EVM, `signTransaction` returns a serialized transaction hex string. For
TRON, it returns the signed transaction object. The SDK builds and broadcasts
the transaction. `signTypedData` is required only when the adapter signs an
agent-wallet binding through `agent.setWallet()`.

The existing `signer: "<PRIVATE_KEY>"` configuration remains supported.

### Base Networks

| Network | Aliases | Chain ID | Agent ID for token `123` |
| --- | --- | --- | --- |
| Base Mainnet | `base`, `base:mainnet`, `eip155:8453` | `8453` | `8453:123` |
| Base Sepolia | `base:sepolia`, `eip155:84532` | `84532` | `84532:123` |

Base uses the official ERC-8004 CREATE2 Registry deployments. Agents registered
on Base Mainnet can be discovered by ERC-8004 indexers such as 8004scan after
their indexer processes the registration event and agent URI.

### TRON Agent IDs

When `chainId` is omitted, TRON registrations use a network-specific agent ID:

| Network | Agent ID for token `123` |
| --- | --- |
| Nile | `3448148188:123` |
| Mainnet | `728126428:123` |
| Shasta | `2494104990:123` |

Older SDK versions defaulted to `1:<tokenId>`. Existing persisted IDs are not
rewritten automatically, so migrate storage keys, parsers, validators, and indexes
to the network-specific format. You can pass `chainId: 1` explicitly for temporary
legacy compatibility, but that format is ambiguous across TRON networks and should
not be used for new data.

IPFS upload flow (optional):

```ts
const sdk = new SDK({
  network: "eip155:97",
  rpcUrl: "<RPC_URL>",
  signer: "<PRIVATE_KEY>",
  ipfsUploader: async (json) => {
    // Upload JSON to your pinning/storage service and return ipfs://... URI
    return "ipfs://QmExample";
  },
});

const agent = sdk.createAgent({ name: "IPFS Agent", description: "IPFS flow" });
const tx = await agent.registerIPFS();
await tx.waitConfirmed({ timeoutMs: 180_000 });
```

## Core Flows

### Wallet Management

```ts
const wallet = await agent.getWallet();
const setTx = await agent.setWallet("<NEW_WALLET_ADDRESS>");
if (setTx) await setTx.waitConfirmed({ timeoutMs: 180_000 });
```

### Feedback and Reputation

```ts
const fbTx = await sdk.giveFeedback({ agentId: "<AGENT_ID>", value: 88 });
const fb = await fbTx.waitConfirmed({ timeoutMs: 180_000 });
await sdk.appendResponse({
  agentId: "<AGENT_ID>",
  clientAddress: fb.result.reviewer,
  feedbackIndex: fb.result.feedbackIndex,
  responseURI: "ipfs://QmResponse",
});
const summary = await sdk.getReputationSummary("<AGENT_ID>");
const feedback = await sdk.readAllFeedback("<AGENT_ID>");
const list = await sdk.searchFeedback({ agents: ["<AGENT_ID>"] });
console.log(fb.result, summary, feedback);
```

### Agent Lifecycle

```ts
const loaded = await sdk.loadAgent("<CHAIN_ID>:<TOKEN_ID>");
loaded.updateInfo({ description: "updated description" });
loaded.setENS("myagent.eth");
await loaded.updateRegistration("https://example.com/agent-card-updated.json");
```

### Validation

```ts
const reqTx = await sdk.validationRequest({
  validatorAddress: "<VALIDATOR_ADDRESS>",
  agentId: "<AGENT_ID>",
  requestURI: "ipfs://QmRequest",
});
const req = await reqTx.waitConfirmed({ timeoutMs: 180_000 });

const respTx = await sdk.validationResponse({
  requestHash: req.result.requestHash,
  response: 95,
});
await respTx.waitConfirmed({ timeoutMs: 180_000 });
```

## Search and Indexing

- `loadAgent(agentId)` reads directly from on-chain data and works without subgraph.
- `getAgent(agentId)` / `searchAgents()` are index-based APIs and depend on subgraph.
- `searchFeedback()` is available when subgraph is configured.
- Current release does **not** enable subgraph URL integration by default.
- Full subgraph-backed search support is planned in a future update.

## Examples

Chain-specific runnable scripts are in `ts/examples/`.
See `ts/examples/README.md` for full usage.

## Notes

- Package name: `@bankofai/8004-sdk`
- ESM package (`"type": "module"`)
- Contracts reject self-feedback; use a separate reviewer wallet

## License

MIT
