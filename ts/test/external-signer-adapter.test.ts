import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { privateKeyToAccount } from "viem/accounts";

import { Agent, SDK, type ExternalSigner, type RegistrationFile } from "../src/index.js";

test("EVM writes use an external signer and broadcast its signed transaction", async () => {
  let transactionToSign: unknown;
  let broadcastTransaction: unknown;
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const rpc = JSON.parse(body) as { id: number; method: string; params?: unknown[] };
      const results: Record<string, unknown> = {
        eth_chainId: "0x2105",
        eth_getTransactionCount: "0x7",
        eth_estimateGas: "0x1d4c0",
        eth_maxPriorityFeePerGas: "0x1",
        eth_gasPrice: "0x2",
        eth_getBlockByNumber: { baseFeePerGas: "0x1", gasLimit: "0x1c9c380", gasUsed: "0x0" },
        eth_sendRawTransaction: "0xbroadcast",
      };
      if (rpc.method === "eth_sendRawTransaction") broadcastTransaction = rpc.params?.[0];
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ jsonrpc: "2.0", id: rpc.id, result: results[rpc.method] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const signer: ExternalSigner = {
    address: "0x1111111111111111111111111111111111111111",
    async signTransaction(transaction) {
      transactionToSign = transaction;
      return "0xsigned";
    },
  };
  const sdk = new SDK({ network: "base", rpcUrl: `http://127.0.0.1:${address.port}`, signer });

  try {
    const tx = await sdk.submitRegister("ipfs://agent");

    assert.equal(tx.txHash, "0xbroadcast");
    assert.equal(broadcastTransaction, "0xsigned");
    assert.equal((transactionToSign as Record<string, unknown>).chainId, 8453);
    assert.equal((transactionToSign as Record<string, unknown>).nonce, 7);
    assert.equal((transactionToSign as Record<string, unknown>).to, "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("TRON writes use an external signer and broadcast its signed transaction", async () => {
  const unsignedTransaction = { txID: "unsigned", raw_data: { contract: [] } };
  const signedTransaction = { ...unsignedTransaction, txID: "broadcast", signature: ["signature"] };
  let transactionToSign: unknown;
  const signer: ExternalSigner = {
    address: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    async signTransaction(transaction) {
      transactionToSign = transaction;
      return signedTransaction;
    },
  };
  const sdk = new SDK({ network: "tron:nile", rpcUrl: "http://unused.invalid", signer });
  const tronWeb = (sdk.chain as any).tronWeb;
  tronWeb.transactionBuilder.triggerSmartContract = async () => ({
    result: { result: true },
    transaction: unsignedTransaction,
  });
  tronWeb.trx.sendRawTransaction = async (transaction: unknown) => {
    assert.deepEqual(transaction, signedTransaction);
    return { result: true, txid: "broadcast" };
  };

  const tx = await sdk.submitRegister("ipfs://agent");

  assert.equal(tx.txHash, "broadcast");
  assert.deepEqual(transactionToSign, unsignedTransaction);
});

test("setWallet uses typed-data signing exposed by an external signer", async () => {
  const account = privateKeyToAccount("0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
  let typedDataSigned = false;
  const signer: ExternalSigner = {
    address: account.address,
    async signTransaction() {
      throw new Error("not used by this test");
    },
    async signTypedData(typedData) {
      typedDataSigned = true;
      return await account.signTypedData(typedData as any);
    },
  };
  const sdk = new SDK({ network: "base", rpcUrl: "http://unused.invalid", signer });
  sdk.chain.getAgentWallet = async () => "0x0000000000000000000000000000000000000000";
  sdk.chain.ownerOf = async () => "0x2222222222222222222222222222222222222222";
  sdk.chain.setAgentWallet = async () => "0xwallet";
  const registration: RegistrationFile = {
    agentId: "8453:42",
    name: "agent",
    description: "",
    endpoints: [],
    tags: [],
    metadata: {},
    supportedTrust: [],
    active: true,
    x402support: false,
    updatedAt: 0,
  };

  const tx = await new Agent(sdk, registration).setWallet(account.address);

  assert.equal(typedDataSigned, true);
  assert.equal(tx?.txHash, "0xwallet");
});

test("SDK does not expose signer credentials as a public property", () => {
  const sdk = new SDK({
    network: "base",
    rpcUrl: "http://unused.invalid",
    signer: "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  });

  assert.equal("signer" in sdk, false);
  assert.equal(JSON.stringify(sdk).includes("0123456789abcdef"), false);
});

test("TRON private-key compatibility does not store the key in TronWeb", () => {
  const privateKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const sdk = new SDK({ network: "tron:nile", rpcUrl: "http://unused.invalid", signer: privateKey });

  assert.equal((sdk.chain as any).tronWeb?.defaultPrivateKey, false);
});

test("SDK does not expose a raw typed-data signing method", () => {
  const sdk = new SDK({ network: "base", rpcUrl: "http://unused.invalid" });

  assert.equal("signAgentWalletBinding" in sdk, false);
});
