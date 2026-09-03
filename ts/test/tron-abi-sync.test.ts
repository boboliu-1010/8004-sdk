import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { SDK, type ExternalSigner } from "../src/index.js";

const abiPath = new URL("../resource/contract_abis.json", import.meta.url);

test("TRON Registry ABIs match the official EVM v2 ABIs", async () => {
  const resources = JSON.parse(await readFile(abiPath, "utf8"));

  for (const registry of ["identityRegistry", "reputationRegistry", "validationRegistry"]) {
    assert.deepEqual(resources.tron.abi[registry], resources.bsc.abi[registry], `${registry} ABI differs`);
  }
});

test("TRON approve sends the official address,uint256 argument order", async () => {
  const signer: ExternalSigner = {
    address: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    async signTransaction(transaction) {
      return transaction;
    },
  };
  const sdk = new SDK({ network: "tron:nile", rpcUrl: "http://unused.invalid", signer });
  const calls: unknown[][] = [];
  const approve = (...args: unknown[]) => ({
    async send() {
      calls.push(args);
      return "approval-tx";
    },
  });
  (sdk.chain as any).tronWeb.contract = async () => ({
    "approve(address,uint256)": approve,
    approve,
  });

  const txHash = await sdk.chain.approve(
    sdk.identityRegistry,
    sdk.identityRegistryAbi,
    "TKwVM5YrbBJZ3tF7b9QZQLaM4okB7V9G4G",
    42n,
  );

  assert.equal(txHash, "approval-tx");
  assert.deepEqual(calls, [["TKwVM5YrbBJZ3tF7b9QZQLaM4okB7V9G4G", 42]]);
});

test("TRON register selects the canonical tuple overload and encodes positional metadata", async () => {
  const signer: ExternalSigner = {
    address: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    async signTransaction(transaction) {
      return transaction;
    },
  };
  const sdk = new SDK({ network: "tron:nile", rpcUrl: "http://unused.invalid", signer });
  const calls: unknown[][] = [];
  const registerWithMetadata = (...args: unknown[]) => ({
    async send() {
      calls.push(args);
      return "registration-tx";
    },
  });
  (sdk.chain as any).tronWeb.contract = async () => ({
    "register(string,(string,bytes)[])": registerWithMetadata,
    register() {
      throw new Error("selected the ambiguous register alias");
    },
  });

  const txHash = await sdk.chain.registerAgent(sdk.identityRegistry, sdk.identityRegistryAbi, "ipfs://agent", [
    { metadataKey: "category", metadataValue: "0x1234" },
  ]);

  assert.equal(txHash, "registration-tx");
  assert.deepEqual(calls, [["ipfs://agent", [["category", "0x1234"]]]]);
});
