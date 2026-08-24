# BankOfAI 8004 SDK (Python)

Python SDK for agent identity, discovery, trust, and reputation based on 8004.

This SDK provides a unified API for registration, wallet binding, feedback/reputation, and validation workflows.

## What Does This SDK Do?

BankOfAI 8004 SDK enables you to:

- Create and manage agent identities on-chain
- Register agent metadata using HTTP URI or IPFS (`register()` / `registerIPFS()`)
- Configure MCP/A2A endpoints, skills, domains, trust models, and custom metadata
- Manage verified agent wallets (`setWallet()` / `unsetWallet()`)
- Submit and read feedback (`giveFeedback()`, `getFeedback()`, `searchFeedback()`, `getReputationSummary()`)
- Trigger and read validation flows (`validationRequest` / `validationResponse` / `getValidationStatus`)

Entrypoint:

```python
from bankofai.sdk_8004.core.sdk import SDK
```

## Installation

### Prerequisites

- Python `>=3.11`
- `pip`
- Funded private key for write operations
- RPC endpoint

### Install from Source (Local)

Current release is local-install only (not published to PyPI yet).

```bash
git clone https://github.com/bankofai/8004-sdk.git
cd 8004-sdk/python
pip install -e .
```

## Quick Start

```python
from bankofai.sdk_8004.core.sdk import SDK

sdk = SDK(
    rpcUrl="<RPC_URL>",
    network="<NETWORK_ID>",  # e.g. eip155:97 or nile
    signer="<PRIVATE_KEY>",
)

agent = sdk.createAgent(
    name="My AI Agent",
    description="Demo agent",
    image="https://example.com/agent.png",
)

agent.setMCP("https://mcp.example.com/")
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json")
agent.setTrust(reputation=True, cryptoEconomic=True)
agent.setMetadata({"version": "1.1.0"})
agent.setActive(True)

tx = agent.register("https://example.com/agent-card.json")
res = tx.wait_confirmed(timeout=180).result
print(res.agentId, res.agentURI)
```

### TRON Agent IDs

When `chainId` is omitted, TRON registrations use a network-specific agent ID:

| Network | Agent ID for token `123` |
| --- | --- |
| Nile | `3448148188:123` |
| Mainnet | `728126428:123` |
| Shasta | `2494104990:123` |

Older SDK versions defaulted to `1:<tokenId>`. Existing persisted IDs are not
rewritten automatically, so migrate storage keys, parsers, validators, and indexes
to the network-specific format. You can pass `chainId=1` explicitly for temporary
legacy compatibility, but that format is ambiguous across TRON networks and should
not be used for new data.

## Core Flows

### Wallet Management

```python
wallet = agent.getWallet()
set_tx = agent.setWallet("<NEW_WALLET_ADDRESS>")
if set_tx:
    set_tx.wait_confirmed(timeout=180)
```

### Feedback and Reputation

```python
fb_tx = sdk.giveFeedback(agentId="<AGENT_ID>", value=88)
fb = fb_tx.wait_confirmed(timeout=180).result
summary = sdk.getReputationSummary("<AGENT_ID>")
print(fb.id, summary)
```

### Validation

```python
req_tx = sdk.validationRequest(
    validatorAddress="<VALIDATOR_ADDRESS>",
    agentId="<AGENT_ID>",
    requestURI="ipfs://QmRequest",
)
req = req_tx.wait_confirmed(timeout=180).result

resp_tx = sdk.validationResponse(requestHash=req.requestHash, response=95)
resp_tx.wait_confirmed(timeout=180)
```

## Search and Indexing

- `loadAgent(agentId)` reads directly from on-chain data and works without subgraph.
- `getAgent(agentId)` / `searchAgents()` are index-based APIs and depend on subgraph.
- Current release does **not** enable subgraph URL integration by default.
- Full subgraph-backed search support is planned in a future update.

## Samples

Chain-specific runnable scripts are in `python/sample/`.
See `python/sample/README.md` for full usage.

## Notes

- Package name: `bankofai-8004-sdk`
- Python module path: `bankofai.sdk_8004`
- Contracts reject self-feedback; use a separate reviewer wallet

## License

MIT
