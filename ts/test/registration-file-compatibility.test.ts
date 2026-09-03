import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Agent } from "../src/core/agent.js";
import { SDK } from "../src/core/sdk.js";
import type { ChainAdapter } from "../src/core/chains.js";
import type { RegistrationFile } from "../src/models/types.js";

const fixtureDirectory = new URL("../../fixtures/registration-v1/", import.meta.url);

async function loadFixture(name = "extensible-services.json"): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(new URL(name, fixtureDirectory), "utf8")) as Record<string, unknown>;
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
    assert.equal(hydrated?.registrationType, fixture.type);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("registration-v1 fixture serializes canonical wire fields", async () => {
  const fixture = await loadFixture();
  let uploaded = "";
  const sdk = Object.create(SDK.prototype) as SDK;
  Object.defineProperties(sdk, {
    chainType: { value: "evm" },
    ipfsUploader: {
      value: async (json: string) => {
        uploaded = json;
        return "ipfs://fixture";
      },
    },
  });

  const internal = {
    name: fixture.name,
    description: fixture.description,
    image: fixture.image,
    endpoints: fixture.services,
    registrations: fixture.registrations,
    tags: ["assistant"],
    metadata: { model: "example" },
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
  assert.equal(serialized.type, fixture.type);
  assert.deepEqual(serialized.tags, internal.tags);
  assert.deepEqual(serialized.metadata, internal.metadata);
  assert.equal("endpoints" in serialized, false);
  assert.equal("x402support" in serialized, false);
});

function registrationFile(agentId?: string): RegistrationFile {
  return {
    agentId,
    name: "IPFS Agent",
    description: "Registration flow",
    endpoints: [],
    registrations: [],
    tags: [],
    metadata: {},
    supportedTrust: [],
    active: true,
    x402support: false,
    updatedAt: 0,
  };
}

function sdkWithMockChain(options: {
  existingAgentId?: string;
  chainType?: "evm" | "tron";
  chainId?: number;
  identityRegistry?: string;
  failFirstUriWait?: boolean;
} = {}) {
  let uploaded = "";
  let uriWaitFailed = false;
  const calls: string[] = [];
  const chain = {
    registerAgent: async (_registry: string, _abi: unknown, uri: string) => {
      calls.push(`register:${uri}`);
      return "0xmint";
    },
    setAgentURI: async (_registry: string, _abi: unknown, agentId: bigint, uri: string) => {
      calls.push(`setAgentURI:${agentId}:${uri}`);
      return "0xuri";
    },
    waitForTransaction: async (txHash: string) => {
      calls.push(`wait:${txHash}`);
      if (txHash === "0xuri" && options.failFirstUriWait && !uriWaitFailed) {
        uriWaitFailed = true;
        throw new Error("confirmation timeout");
      }
      return { txHash };
    },
    parseRegisteredAgentId: () => "7",
  } as unknown as ChainAdapter;

  const sdk = Object.create(SDK.prototype) as SDK;
  Object.defineProperties(sdk, {
    chainType: { value: options.chainType ?? "evm" },
    chainId: { value: options.chainId ?? 8453 },
    chain: { value: chain },
    identityRegistry: { value: options.identityRegistry ?? "0x1234567890123456789012345678901234567890" },
    identityRegistryAbi: { value: [] },
    ipfsUploader: {
      value: async (json: string) => {
        uploaded = json;
        return "ipfs://registration";
      },
    },
  });

  return {
    agent: new Agent(sdk, registrationFile(options.existingAgentId)),
    calls,
    uploaded: () => JSON.parse(uploaded) as Record<string, unknown>,
  };
}

test("first registerIPFS mints before uploading and binds the resulting URI", async () => {
  const { agent, calls, uploaded } = sdkWithMockChain();

  const tx = await agent.registerIPFS();
  const mined = await tx.waitConfirmed();

  assert.equal(mined.result.agentId, "8453:7");
  assert.equal(mined.result.agentURI, "ipfs://registration");
  assert.deepEqual(uploaded().registrations, [{
    agentId: 7,
    agentRegistry: "eip155:8453:0x1234567890123456789012345678901234567890",
  }]);
  assert.deepEqual(calls, [
    "register:",
    "wait:0xmint",
    "setAgentURI:7:ipfs://registration",
    "wait:0xuri",
  ]);
});

test("first registerIPFS performs its upload and URI binding only once", async () => {
  const { agent, calls } = sdkWithMockChain();

  const tx = await agent.registerIPFS();
  const first = await tx.waitConfirmed();
  const second = await tx.waitConfirmed();

  assert.deepEqual(second.result, first.result);
  assert.deepEqual(calls, [
    "register:",
    "wait:0xmint",
    "setAgentURI:7:ipfs://registration",
    "wait:0xuri",
    "wait:0xmint",
    "wait:0xuri",
  ]);
});

test("first registerIPFS retries URI confirmation without rebroadcasting", async () => {
  const { agent, calls } = sdkWithMockChain({ failFirstUriWait: true });

  const tx = await agent.registerIPFS();
  await assert.rejects(tx.waitConfirmed(), /confirmation timeout/);
  const mined = await tx.waitConfirmed();

  assert.equal(mined.result.agentURI, "ipfs://registration");
  assert.deepEqual(calls, [
    "register:",
    "wait:0xmint",
    "setAgentURI:7:ipfs://registration",
    "wait:0xuri",
    "wait:0xmint",
    "wait:0xuri",
  ]);
});

test("existing agent registerIPFS updates its URI without minting another agent", async () => {
  const { agent, calls, uploaded } = sdkWithMockChain({ existingAgentId: "8453:5" });

  const tx = await agent.registerIPFS();
  const mined = await tx.waitConfirmed();

  assert.equal(mined.result.agentId, "8453:5");
  assert.deepEqual(uploaded().registrations, [{
    agentId: 5,
    agentRegistry: "eip155:8453:0x1234567890123456789012345678901234567890",
  }]);
  assert.deepEqual(calls, [
    "setAgentURI:5:ipfs://registration",
    "wait:0xuri",
  ]);
});

test("TRON registerIPFS emits the Final TRC-8004 registration shape", async () => {
  const fixture = await loadFixture("tron-extensible-services.json");
  const { agent, uploaded } = sdkWithMockChain({
    chainType: "tron",
    chainId: 728126428,
    identityRegistry: "TFLvivMdKsk6v2GrwyD2apEr9dU1w7p7Fy",
  });

  const tx = await agent.registerIPFS();
  await tx.waitConfirmed();

  assert.equal(uploaded().type, fixture.type);
  assert.deepEqual(uploaded().registrations, fixture.registrations);
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
