import assert from "node:assert/strict";
import test from "node:test";

import { encodeFunctionData, type Abi } from "viem";

import contractAbisJson from "../resource/contract_abis.json" with { type: "json" };

type AbiItem = {
  type: string;
  name?: string;
  inputs?: Array<{ type: string }>;
  outputs?: Array<{ type: string }>;
};

const evmAbis = contractAbisJson.bsc.abi as Record<string, AbiItem[]>;

function findItem(registry: string, type: string, name: string): AbiItem {
  const item = evmAbis[registry]?.find((candidate) => candidate.type === type && candidate.name === name);
  assert.ok(item, `${registry} must expose ${type} ${name}`);
  return item;
}

test("Identity Registry uses the official ERC-721 approve and agent-wallet signatures", () => {
  const approve = findItem("identityRegistry", "function", "approve");
  assert.deepEqual(approve.inputs?.map(({ type }) => type), ["address", "uint256"]);

  const getAgentWallet = findItem("identityRegistry", "function", "getAgentWallet");
  assert.deepEqual(getAgentWallet.inputs?.map(({ type }) => type), ["uint256"]);

  assert.doesNotThrow(() => encodeFunctionData({
    abi: evmAbis.identityRegistry as Abi,
    functionName: "getAgentWallet",
    args: [1n],
  }));
});

test("Reputation Registry ResponseAppended includes the official response hash", () => {
  const event = findItem("reputationRegistry", "event", "ResponseAppended");
  assert.deepEqual(event.inputs?.map(({ type }) => type), [
    "uint256",
    "address",
    "uint64",
    "address",
    "string",
    "bytes32",
  ]);
});

test("Validation Registry getValidationStatus exposes the complete official return tuple", () => {
  const status = findItem("validationRegistry", "function", "getValidationStatus");
  assert.deepEqual(status.inputs?.map(({ type }) => type), ["bytes32"]);
  assert.deepEqual(status.outputs?.map(({ type }) => type), [
    "address",
    "uint256",
    "uint8",
    "bytes32",
    "string",
    "uint256",
  ]);
});
