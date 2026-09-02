import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SDK } from "../src/core/sdk.js";

const fixtureUrl = new URL(
  "../../fixtures/registration-v1/extensible-services.json",
  import.meta.url,
);

async function loadFixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixtureUrl, "utf8")) as Record<string, unknown>;
}

test("registration-v1 fixture hydrates canonical wire fields", async () => {
  const fixture = await loadFixture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(fixture));

  try {
    const hydrated = await (SDK.prototype as unknown as {
      fetchRegistrationFromUri(uri: string): Promise<Record<string, unknown> | undefined>;
    }).fetchRegistrationFromUri.call({}, "https://example.test/registration.json");

    assert.deepEqual(hydrated?.endpoints, fixture.services);
    assert.deepEqual(hydrated?.registrations, fixture.registrations);
    assert.equal(hydrated?.x402support, fixture.x402Support);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registration-v1 fixture serializes canonical wire fields", async () => {
  const fixture = await loadFixture();
  let uploaded = "";
  const sdk = Object.create(SDK.prototype) as SDK;
  Object.defineProperty(sdk, "ipfsUploader", {
    value: async (json: string) => {
      uploaded = json;
      return "ipfs://fixture";
    },
  });

  const internal = {
    name: fixture.name,
    description: fixture.description,
    image: fixture.image,
    endpoints: fixture.services,
    registrations: fixture.registrations,
    tags: [],
    metadata: {},
    supportedTrust: fixture.supportedTrust,
    active: fixture.active,
    x402support: fixture.x402Support,
    updatedAt: fixture.updatedAt,
  };

  await sdk.uploadRegistrationFile(internal as never);
  const serialized = JSON.parse(uploaded) as Record<string, unknown>;

  assert.deepEqual(serialized.services, fixture.services);
  assert.deepEqual(serialized.registrations, fixture.registrations);
  assert.equal(serialized.x402Support, fixture.x402Support);
  assert.equal("endpoints" in serialized, false);
  assert.equal("x402support" in serialized, false);
});

test("legacy TypeScript field aliases remain readable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    name: "Legacy Agent",
    endpoints: [{ name: "A2A", endpoint: "https://example.test/a2a" }],
    x402support: true,
  }));

  try {
    const hydrated = await (SDK.prototype as unknown as {
      fetchRegistrationFromUri(uri: string): Promise<Record<string, unknown> | undefined>;
    }).fetchRegistrationFromUri.call({}, "https://example.test/legacy.json");

    assert.deepEqual(hydrated?.endpoints, [
      { name: "A2A", endpoint: "https://example.test/a2a" },
    ]);
    assert.equal(hydrated?.x402support, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
