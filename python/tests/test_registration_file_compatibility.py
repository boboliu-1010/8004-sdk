import json
from pathlib import Path

from bankofai.sdk_8004.core.models import EndpointType, RegistrationFile


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "fixtures"
    / "registration-v1"
    / "extensible-services.json"
)


def load_fixture():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_registration_v1_fixture_preserves_canonical_wire_fields():
    fixture = load_fixture()

    registration = RegistrationFile.from_dict(fixture)

    assert registration.endpoints[0].type is EndpointType.MCP
    assert registration.endpoints[1].type == "web"
    assert registration.endpoints[2].type == "email"
    assert registration.registrations == fixture["registrations"]
    assert registration.x402support is True

    serialized = registration.to_dict()
    assert serialized["services"] == fixture["services"]
    assert serialized["registrations"] == fixture["registrations"]
    assert serialized["x402Support"] is True
