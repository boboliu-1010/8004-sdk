"""TRON reputation flow: register -> giveFeedback -> readFeedback -> summary.

Set variables in this file before running.
"""

import time

from bankofai.sdk_8004.core.sdk import SDK


# Replace before running.
TRON_NETWORK = "nile"  # or "tron:nile"
TRON_RPC_URL = "https://nile.trongrid.io"
TRON_FEE_LIMIT = 120_000_000
OWNER_PRIVATE_KEY = "<TRON_OWNER_PRIVATE_KEY>"
REVIEWER_PRIVATE_KEY = "<TRON_REVIEWER_PRIVATE_KEY>"

if OWNER_PRIVATE_KEY.startswith("<") or REVIEWER_PRIVATE_KEY.startswith("<"):
    raise SystemExit("Set OWNER_PRIVATE_KEY and REVIEWER_PRIVATE_KEY in sample/tron_reputation_flow.py first")

owner_sdk = SDK(
    rpcUrl=TRON_RPC_URL,
    network=TRON_NETWORK,
    signer=OWNER_PRIVATE_KEY,
    feeLimit=TRON_FEE_LIMIT,
)
reviewer_sdk = SDK(
    rpcUrl=TRON_RPC_URL,
    network=TRON_NETWORK,
    signer=REVIEWER_PRIVATE_KEY,
    feeLimit=TRON_FEE_LIMIT,
)

agent = owner_sdk.createAgent(
    name=f"Sample Rep Agent {int(time.time())}",
    description="sample reputation flow",
    image="https://example.com/agent.png",
)

# Optional richer configuration
agent.setMCP("https://mcp.example.com/")
agent.setA2A("https://a2a.example.com/.well-known/agent-card.json")
agent.addSkill("data_engineering/data_transformation_pipeline", validate_oasf=True)
agent.addDomain("technology/data_science/data_science", validate_oasf=True)
agent.setTrust(reputation=True, cryptoEconomic=True)
agent.setMetadata({"version": "1.0.0", "category": "sample"})
agent.setActive(True)
agent.setX402Support(True)

reg = agent.register("https://example.com/agent-card.json").wait_confirmed(timeout=120).result
print("registered:", reg.agentId)

fb_handle = reviewer_sdk.giveFeedback(
    agentId=reg.agentId,
    value=90,
    tag1="execution",
    tag2="market-swap",
    endpoint="/a2a/x402/execute",
)
print("feedback_tx:", fb_handle.tx_hash)
fb = fb_handle.wait_confirmed(timeout=120).result
print("feedback_id:", fb.id)

agent_num = int(str(reg.agentId).split(":")[-1])
reviewer = reviewer_sdk.web3_client.account.address
idx = reviewer_sdk.web3_client.call_contract(reviewer_sdk.reputation_registry, "getLastIndex", agent_num, reviewer)
fb_read = reviewer_sdk.getFeedback(reg.agentId, reviewer, int(idx))
print("feedback_read:", fb_read.value, fb_read.tags, fb_read.isRevoked)

summary = reviewer_sdk.getReputationSummary(reg.agentId)
print("summary:", summary)
