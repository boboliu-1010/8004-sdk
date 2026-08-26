import pytest

from bankofai.sdk_8004.core import sdk as sdk_module


class StubWeb3Client:
    def __init__(self, *args, **kwargs):
        self.chain_type = kwargs.get("chain_type", "evm")
        self.chain_id = None
        self.captured_typed_data_chain_id = None

    def get_contract(self, address, abi):
        return type("Contract", (), {"address": address})()

    def to_evm_address(self, address):
        return address

    def to_chain_address(self, address):
        return address

    def call_contract(self, contract, method, *args):
        if method == "getAgentWallet":
            return "0x0000000000000000000000000000000000000000"
        if method == "ownerOf":
            return "0x2222222222222222222222222222222222222222"
        if method == "getClients":
            return []
        if method == "getSummary":
            return (0, 0, 0)
        raise AssertionError(f"Unexpected contract call: {method}")

    def build_agent_wallet_set_typed_data(self, **kwargs):
        self.captured_typed_data_chain_id = kwargs["chain_id"]
        return {"domain": {"chainId": kwargs["chain_id"]}}

    def transact_contract(self, contract, method, *args):
        return "0xtx"


@pytest.mark.parametrize(
    ("network", "expected_chain_id"),
    [
        ("mainnet", 728126428),
        ("nile", 3448148188),
        ("shasta", 2494104990),
        ("tron", 3448148188),
        ("tron:nile", 3448148188),
        ("tron:mainnet", 728126428),
        ("tron:shasta", 2494104990),
        ("  Tron:Shasta  ", 2494104990),
    ],
)
def test_tron_networks_get_distinct_canonical_chain_ids(
    monkeypatch, network, expected_chain_id
):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)

    sdk = sdk_module.SDK(network=network, rpcUrl="http://unused.invalid")

    assert sdk.chainId == expected_chain_id


def test_explicit_tron_chain_id_preserves_legacy_behavior(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)

    sdk = sdk_module.SDK(
        chainId=1,
        network="nile",
        rpcUrl="http://unused.invalid",
    )

    assert sdk.chainId == 1


def test_tron_alias_uses_nile_chain_id_for_wallet_typed_data(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)
    sdk = sdk_module.SDK(
        chainId=1,
        network="tron",
        rpcUrl="http://unused.invalid",
    )
    agent = sdk.createAgent(name="test", description="test")
    agent.registration_file.agentId = "1:123"

    agent.setWallet(
        "0x1111111111111111111111111111111111111111",
        signature=b"external-signature",
    )

    assert sdk.web3_client.captured_typed_data_chain_id == 3448148188


def test_nile_feedback_rejects_mainnet_agent_id(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)
    sdk = sdk_module.SDK(network="nile", rpcUrl="http://unused.invalid")

    with pytest.raises(ValueError, match="Chain mismatch.*728126428.*3448148188"):
        sdk.giveFeedback("728126428:36", 1)


def test_tron_services_receive_logical_chain_id(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)
    sdk = sdk_module.SDK(network="nile", rpcUrl="http://unused.invalid")

    assert sdk.feedback_manager.chain_id == 3448148188
    assert sdk.indexer.chain_id == 3448148188


def test_unprefixed_tron_agent_id_is_canonicalized(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)
    sdk = sdk_module.SDK(network="nile", rpcUrl="http://unused.invalid")

    summary = sdk.getReputationSummary("36")

    assert summary["agentId"] == "3448148188:36"


def test_unknown_tron_network_has_clear_error(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)

    with pytest.raises(ValueError, match="Unknown TRON network: unknown"):
        sdk_module.SDK(network="tron:unknown", rpcUrl="http://unused.invalid")


def test_tron_registry_overrides_use_resolved_network_chain_id(monkeypatch):
    monkeypatch.setattr(sdk_module, "Web3Client", StubWeb3Client)
    override = "TOverrideIdentityRegistry"

    sdk = sdk_module.SDK(
        network="shasta",
        rpcUrl="http://unused.invalid",
        registryOverrides={2494104990: {"IDENTITY": override}},
    )

    assert sdk.registries()["IDENTITY"] == override
