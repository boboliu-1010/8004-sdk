import pytest

from bankofai.sdk_8004.core import sdk as sdk_module


class StubWeb3Client:
    def __init__(self, *args, **kwargs):
        pass

    def get_contract(self, address, abi):
        return object()


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
