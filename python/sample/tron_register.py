"""Register an agent on TRON Nile/Mainnet/Shasta.

Set variables in this file before running.
"""

import time

from bankofai.sdk_8004.core.sdk import SDK


# Replace before running.
TRON_NETWORK = "nile"  # or "tron:nile"
TRON_RPC_URL = "https://nile.trongrid.io"
TRON_PRIVATE_KEY = "<TRON_PRIVATE_KEY>"
TRON_FEE_LIMIT = 120_000_000

if TRON_PRIVATE_KEY.startswith("<"):
    raise SystemExit("Set TRON_PRIVATE_KEY in sample/tron_register.py first")

sdk = SDK(
    rpcUrl=TRON_RPC_URL,
    network=TRON_NETWORK,
    signer=TRON_PRIVATE_KEY,
    feeLimit=TRON_FEE_LIMIT,
)

agent = sdk.createAgent(
    name=f"Sample Tron Agent {int(time.time())}",
    description="sample register on tron",
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

handle = agent.register("https://example.com/agent-card.json")
print("tx_hash:", handle.tx_hash)
result = handle.wait_confirmed(timeout=120).result
print("agent_id:", result.agentId)
print("agent_uri:", result.agentURI)
