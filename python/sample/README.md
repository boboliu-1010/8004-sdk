# Python Samples Guide

Runnable Python examples for 8004 flows:
- Agent registration (BSC / TRON)
- Reputation feedback (BSC / TRON)

## 1. Prerequisites

Run from `8004-sdk/python`:

```bash
pip install -e .
```

Required:
- Python 3.9+
- Funded private key(s) for target testnet
- BSC RPC (for BSC samples) or TRON Nile RPC (for TRON samples)

BSC CAIP-2 IDs used in samples:
- `eip155:56` (mainnet)
- `eip155:97` (testnet)

Important:
- Samples use local constants in each script.
- `.env` is not required for these sample scripts.

## 2. Files In This Folder

- `bsc_register.py`: Register one agent on BSC testnet
- `tron_register.py`: Register one agent on TRON Nile/Mainnet/Shasta
- `bsc_reputation_flow.py`: Register -> give feedback -> read feedback -> summary (BSC)
- `tron_reputation_flow.py`: Register -> give feedback -> read feedback -> summary (TRON)

## 3. How Agent Creation Works (Step by Step)

All sample scripts follow the same build order:

1. Create SDK client
2. Create an in-memory agent object with `createAgent(...)`
3. Add optional capability/profile fields (`setMCP`, `setA2A`, `addSkill`, `addDomain`, `setTrust`, `setMetadata`, `setActive`, `setX402Support`)
4. Register on-chain with `agent.register(agent_card_uri)`
5. Wait for confirmation and read `agentId`

Example (full-style, same pattern as samples):

```python
import time
from bankofai.sdk_8004.core.sdk import SDK

sdk = SDK(
    rpcUrl="https://data-seed-prebsc-1-s1.binance.org:8545",
    network="eip155:97",
    signer="<EVM_PRIVATE_KEY>",
)

agent = sdk.createAgent(
    name=f"Sample Agent {int(time.time())}",
    description="sample register",
    image="https://example.com/agent.png",
)

agent.setMCP("https://mcp.example.com/")
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json")
agent.addSkill("data_engineering/data_transformation_pipeline", validate_oasf=True)
agent.addDomain("technology/data_science/data_science", validate_oasf=True)
agent.setTrust(reputation=True, cryptoEconomic=True)
agent.setMetadata({"version": "1.0.0", "category": "sample"})
agent.setActive(True)
agent.setX402Support(True)

handle = agent.register("https://example.com/agent-card.json")
result = handle.wait_confirmed(timeout=180).result
print(result.agentId, result.agentURI)
```

What each field is for:
- `name`, `description`, `image`: basic profile shown to indexers and clients
- `setMCP(url)`: MCP endpoint declaration
- `setA2A(url)`: A2A agent card declaration
- `addSkill(...)`, `addDomain(...)`: taxonomy tags for discovery
- `setTrust(...)`: trust model flags (reputation / crypto-economic)
- `setMetadata({...})`: extra custom key-values
- `setActive(True)`: discoverability status
- `setX402Support(True)`: payment capability flag
- `register(uri)`: submit final registration URI to chain

## 4. Quick Run

### BSC Registration

```bash
python sample/bsc_register.py
```

Edit in script:
- `BSC_PRIVATE_KEY`

Expected output:
- `tx_hash`
- `agent_id` (format like `97:123`)
- `agent_uri`

### TRON Registration

```bash
python sample/tron_register.py
```

Edit in script:
- `TRON_NETWORK` (`nile`, `tron:nile`, `mainnet`, `shasta`)
- `TRON_RPC_URL`
- `TRON_PRIVATE_KEY`
- `TRON_FEE_LIMIT`

Expected output:
- `tx_hash`
- `agent_id` (for token ID `123`: Nile `3448148188:123`, Mainnet
  `728126428:123`, or Shasta `2494104990:123`)
- `agent_uri`

TRON agent IDs use a network-specific chain ID when `chainId` is omitted:

| Network | Agent ID example |
| --- | --- |
| Nile | `3448148188:123` |
| Mainnet | `728126428:123` |
| Shasta | `2494104990:123` |

Migration note: older SDK versions defaulted to `1:<tokenId>`. Existing persisted
IDs are not rewritten automatically; update stored keys, parsing, validation, and
indexing to use the network-specific ID. Passing `chainId=1` explicitly preserves
the legacy format temporarily, but it is ambiguous across TRON networks and is not
recommended for new data.

## 5. Reputation Flows

### BSC

```bash
python sample/bsc_reputation_flow.py
```

Edit:
- `OWNER_PRIVATE_KEY`
- `REVIEWER_PRIVATE_KEY`

Flow:
1. Owner registers agent
2. Reviewer calls `giveFeedback`
3. Read feedback by `(agentId, reviewer, index)`
4. Query summary via `getReputationSummary`

### TRON

```bash
python sample/tron_reputation_flow.py
```

Edit:
- `TRON_NETWORK`
- `TRON_RPC_URL`
- `TRON_FEE_LIMIT`
- `OWNER_PRIVATE_KEY`
- `REVIEWER_PRIVATE_KEY`

Same flow as BSC.

## 6. Common Errors

- `Self-feedback not allowed`
  - Cause: owner wallet and reviewer wallet are the same
  - Fix: use a different reviewer private key

- TRON `REVERT`
  - Check `TRON_NETWORK` + `TRON_RPC_URL` match
  - Increase `TRON_FEE_LIMIT` if needed
  - Ensure account has enough TRX/energy

- BSC timeout or pending too long
  - Check RPC health
  - Ensure gas balance exists on testnet account

## 7. Safety Notes

- Never commit real private keys
- Use test wallets and testnet funds
- Verify end-to-end flow on testnet before mainnet
