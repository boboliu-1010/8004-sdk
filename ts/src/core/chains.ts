import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseAbiItem,
  toBytes,
  toHex,
  type Abi,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, toAccount } from "viem/accounts";
import { base, baseSepolia, bsc, bscTestnet } from "viem/chains";
import { TronWeb } from "tronweb";

import type { ChainContracts, ChainType, ExternalSigner, MetadataEntry, TxWaitOptions } from "../models/types.js";

const REGISTERED_EVENT = parseAbiItem("event Registered(uint256 indexed agentId, string agentURI, address indexed owner)");

export interface ChainAdapter {
  readonly chainType: ChainType;
  readonly rpcUrl: string;
  readonly signerAddress?: string;

  registerAgent(identityRegistry: string, abi: Abi, agentURI?: string, metadata?: MetadataEntry[]): Promise<string>;
  getAgentURI(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string>;
  getAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string>;
  getMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string): Promise<Hex>;
  getApproved(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string>;
  isApprovedForAll(identityRegistry: string, abi: Abi, owner: string, operator: string): Promise<boolean>;
  approve(identityRegistry: string, abi: Abi, operator: string, agentId: bigint): Promise<string>;
  ownerOf(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string>;
  setAgentURI(identityRegistry: string, abi: Abi, agentId: bigint, agentURI: string): Promise<string>;
  setApprovalForAll(identityRegistry: string, abi: Abi, operator: string, approved: boolean): Promise<string>;
  transferFrom(identityRegistry: string, abi: Abi, from: string, to: string, agentId: bigint): Promise<string>;
  setMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string, value: Uint8Array): Promise<string>;
  setAgentWallet(
    identityRegistry: string,
    abi: Abi,
    agentId: bigint,
    newWallet: string,
    deadline: bigint,
    signature: Hex,
  ): Promise<string>;
  unsetAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string>;
  giveFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    value: bigint,
    valueDecimals: number,
    tag1: string,
    tag2: string,
    endpoint: string,
    feedbackURI: string,
    feedbackHash: Hex,
  ): Promise<string>;
  readFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
  ): Promise<readonly [bigint, number, string, string, boolean]>;
  getSummary(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
  ): Promise<readonly [bigint, bigint, number]>;
  getClients(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
  ): Promise<string[]>;
  getLastIndex(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
  ): Promise<bigint>;
  readAllFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
    includeRevoked: boolean,
  ): Promise<readonly [string[], bigint[], bigint[], number[], string[], string[], boolean[]]>;
  getResponseCount(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responders: string[],
  ): Promise<bigint>;
  appendResponse(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responseURI: string,
    responseHash: Hex,
  ): Promise<string>;
  revokeFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    feedbackIndex: bigint,
  ): Promise<string>;
  validationRequest(
    validationRegistry: string,
    abi: Abi,
    validatorAddress: string,
    agentId: bigint,
    requestURI: string,
    requestHash: Hex,
  ): Promise<string>;
  validationResponse(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
    response: number,
    responseURI: string,
    responseHash: Hex,
    tag: string,
  ): Promise<string>;
  getValidationStatus(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
  ): Promise<readonly [string, bigint, number, Hex, string, bigint]>;
  getValidationSummary(
    validationRegistry: string,
    abi: Abi,
    agentId: bigint,
    validatorAddresses: string[],
    tag: string,
  ): Promise<readonly [bigint, number]>;
  getAgentValidations(validationRegistry: string, abi: Abi, agentId: bigint): Promise<Hex[]>;
  getValidatorRequests(validationRegistry: string, abi: Abi, validatorAddress: string): Promise<Hex[]>;
  waitForTransaction(txHash: string, opts?: TxWaitOptions): Promise<unknown>;
  parseRegisteredAgentId(receipt: unknown): string | undefined;
  toEvmAddress(address: string): string;
  toChainAddress(address: string): string;
  addressEqual(a: string, b: string): boolean;
}

export class EvmAdapter implements ChainAdapter {
  readonly chainType: ChainType = "evm";
  readonly rpcUrl: string;
  readonly signerAddress?: string;
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;

  constructor(rpcUrl: string, chainId: number, signer?: string | ExternalSigner) {
    this.rpcUrl = rpcUrl;
    const chain = chainId === 56
      ? bsc
      : chainId === 97
        ? bscTestnet
        : chainId === 8453
          ? base
          : baseSepolia;
    this.publicClient = createPublicClient({ chain, transport: http(rpcUrl) }) as unknown as PublicClient;

    if (typeof signer === "string") {
      const key = signer.startsWith("0x") ? (signer as Hex) : (`0x${signer}` as Hex);
      const account = privateKeyToAccount(key);
      this.walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) }) as unknown as WalletClient;
      this.signerAddress = account.address;
    } else if (signer) {
      const address = this.toEvmAddress(signer.address) as Hex;
      const account = toAccount({
        address,
        async signTransaction(transaction) {
          const signed = await signer.signTransaction(transaction as unknown as Record<string, unknown>);
          if (typeof signed !== "string") throw new Error("EVM signer must return a serialized transaction");
          return (signed.startsWith("0x") ? signed : `0x${signed}`) as Hex;
        },
        async signMessage(message) {
          if (!signer.signMessage) throw new Error("External signer does not support message signing");
          return await signer.signMessage(message);
        },
        async signTypedData(typedData) {
          if (!signer.signTypedData) throw new Error("External signer does not support typed-data signing");
          return await signer.signTypedData(typedData as unknown as Record<string, unknown>);
        },
      });
      this.walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) }) as unknown as WalletClient;
      this.signerAddress = address;
    }
  }

  async registerAgent(identityRegistry: string, abi: Abi, agentURI?: string, metadata?: MetadataEntry[]): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");

    const args = metadata !== undefined
      ? [agentURI ?? "", metadata.map(({ metadataKey, metadataValue }) => ({ metadataKey, metadataValue }))]
      : agentURI !== undefined
        ? [agentURI]
        : [];
    const hash = await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "register",
      args,
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });

    return hash;
  }

  async getAgentURI(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "tokenURI",
      args: [agentId],
    }) as string;
  }

  async getAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "getAgentWallet",
      args: [agentId],
    }) as string;
  }

  async getMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string): Promise<Hex> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "getMetadata",
      args: [agentId, key],
    }) as Hex;
  }

  async getApproved(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "getApproved",
      args: [agentId],
    }) as string;
  }

  async isApprovedForAll(identityRegistry: string, abi: Abi, owner: string, operator: string): Promise<boolean> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "isApprovedForAll",
      args: [this.toChainAddress(owner), this.toChainAddress(operator)],
    }) as boolean;
  }

  async approve(identityRegistry: string, abi: Abi, operator: string, agentId: bigint): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "approve",
      args: [this.toChainAddress(operator), agentId],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async ownerOf(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    return await this.publicClient.readContract({
      address: identityRegistry as Hex,
      abi,
      functionName: "ownerOf",
      args: [agentId],
    }) as string;
  }

  async setAgentURI(identityRegistry: string, abi: Abi, agentId: bigint, agentURI: string): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "setAgentURI",
      args: [agentId, agentURI],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async setApprovalForAll(identityRegistry: string, abi: Abi, operator: string, approved: boolean): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "setApprovalForAll",
      args: [this.toChainAddress(operator), approved],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async transferFrom(identityRegistry: string, abi: Abi, from: string, to: string, agentId: bigint): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "transferFrom",
      args: [this.toChainAddress(from), this.toChainAddress(to), agentId],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async setMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string, value: Uint8Array): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "setMetadata",
      args: [agentId, key, toHex(value)],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async setAgentWallet(
    identityRegistry: string,
    abi: Abi,
    agentId: bigint,
    newWallet: string,
    deadline: bigint,
    signature: Hex,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");

    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "setAgentWallet",
      args: [agentId, this.toChainAddress(newWallet), deadline, signature],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async unsetAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");

    return await (this.walletClient.writeContract as any)({
      address: identityRegistry as Hex,
      abi,
      functionName: "unsetAgentWallet",
      args: [agentId],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async giveFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    value: bigint,
    valueDecimals: number,
    tag1: string,
    tag2: string,
    endpoint: string,
    feedbackURI: string,
    feedbackHash: Hex,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: reputationRegistry as Hex,
      abi,
      functionName: "giveFeedback",
      args: [agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async readFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
  ): Promise<readonly [bigint, number, string, string, boolean]> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "readFeedback",
      args: [agentId, this.toChainAddress(clientAddress), feedbackIndex],
    }) as readonly [bigint, number, string, string, boolean];
  }

  async getSummary(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
  ): Promise<readonly [bigint, bigint, number]> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "getSummary",
      args: [agentId, clientAddresses.map((x) => this.toChainAddress(x)), tag1, tag2],
    }) as readonly [bigint, bigint, number];
  }

  async getClients(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
  ): Promise<string[]> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "getClients",
      args: [agentId],
    }) as string[];
  }

  async getLastIndex(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
  ): Promise<bigint> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "getLastIndex",
      args: [agentId, this.toChainAddress(clientAddress)],
    }) as bigint;
  }

  async readAllFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
    includeRevoked: boolean,
  ): Promise<readonly [string[], bigint[], bigint[], number[], string[], string[], boolean[]]> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "readAllFeedback",
      args: [agentId, clientAddresses.map((x) => this.toChainAddress(x)), tag1, tag2, includeRevoked],
    }) as readonly [string[], bigint[], bigint[], number[], string[], string[], boolean[]];
  }

  async getResponseCount(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responders: string[],
  ): Promise<bigint> {
    return await this.publicClient.readContract({
      address: reputationRegistry as Hex,
      abi,
      functionName: "getResponseCount",
      args: [
        agentId,
        this.toChainAddress(clientAddress),
        feedbackIndex,
        responders.map((x) => this.toChainAddress(x)),
      ],
    }) as bigint;
  }

  async appendResponse(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responseURI: string,
    responseHash: Hex,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: reputationRegistry as Hex,
      abi,
      functionName: "appendResponse",
      args: [agentId, this.toChainAddress(clientAddress), feedbackIndex, responseURI, responseHash],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async revokeFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    feedbackIndex: bigint,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: reputationRegistry as Hex,
      abi,
      functionName: "revokeFeedback",
      args: [agentId, feedbackIndex],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async validationRequest(
    validationRegistry: string,
    abi: Abi,
    validatorAddress: string,
    agentId: bigint,
    requestURI: string,
    requestHash: Hex,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: validationRegistry as Hex,
      abi,
      functionName: "validationRequest",
      args: [this.toChainAddress(validatorAddress), agentId, requestURI, requestHash],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async validationResponse(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
    response: number,
    responseURI: string,
    responseHash: Hex,
    tag: string,
  ): Promise<string> {
    if (!this.walletClient || !this.signerAddress) throw new Error("Signer is required for write operations");
    return await (this.walletClient.writeContract as any)({
      address: validationRegistry as Hex,
      abi,
      functionName: "validationResponse",
      args: [requestHash, response, responseURI, responseHash, tag],
      account: this.walletClient.account,
      chain: this.walletClient.chain,
    });
  }

  async getValidationStatus(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
  ): Promise<readonly [string, bigint, number, Hex, string, bigint]> {
    return await this.publicClient.readContract({
      address: validationRegistry as Hex,
      abi,
      functionName: "getValidationStatus",
      args: [requestHash],
    }) as readonly [string, bigint, number, Hex, string, bigint];
  }

  async getValidationSummary(
    validationRegistry: string,
    abi: Abi,
    agentId: bigint,
    validatorAddresses: string[],
    tag: string,
  ): Promise<readonly [bigint, number]> {
    return await this.publicClient.readContract({
      address: validationRegistry as Hex,
      abi,
      functionName: "getSummary",
      args: [agentId, validatorAddresses.map((x) => this.toChainAddress(x)), tag],
    }) as readonly [bigint, number];
  }

  async getAgentValidations(validationRegistry: string, abi: Abi, agentId: bigint): Promise<Hex[]> {
    return await this.publicClient.readContract({
      address: validationRegistry as Hex,
      abi,
      functionName: "getAgentValidations",
      args: [agentId],
    }) as Hex[];
  }

  async getValidatorRequests(validationRegistry: string, abi: Abi, validatorAddress: string): Promise<Hex[]> {
    return await this.publicClient.readContract({
      address: validationRegistry as Hex,
      abi,
      functionName: "getValidatorRequests",
      args: [this.toChainAddress(validatorAddress)],
    }) as Hex[];
  }

  async waitForTransaction(txHash: string, opts: TxWaitOptions = {}): Promise<unknown> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash as Hex,
      timeout: opts.timeoutMs ?? 120_000,
      pollingInterval: opts.pollMs ?? 1_000,
    });

    if ((opts.throwOnRevert ?? true) && receipt.status !== "success") {
      throw new Error(`EVM transaction reverted: ${txHash}`);
    }

    return receipt;
  }

  parseRegisteredAgentId(receipt: unknown): string | undefined {
    const r = receipt as { logs?: Array<{ topics: Hex[]; data: Hex }> };
    if (!r?.logs) return undefined;

    for (const log of r.logs) {
      try {
        const decoded = decodeEventLog({ abi: [REGISTERED_EVENT], data: log.data, topics: log.topics as any });
        const id = (decoded.args as { agentId?: bigint }).agentId;
        if (typeof id === "bigint") return id.toString();
      } catch {
        // ignore non-matching logs
      }
    }

    return undefined;
  }

  toEvmAddress(address: string): string {
    const raw = address.trim();
    if (!raw.startsWith("0x") || raw.length !== 42) throw new Error(`Invalid EVM address: ${address}`);
    return raw.toLowerCase();
  }

  toChainAddress(address: string): string {
    return this.toEvmAddress(address);
  }

  addressEqual(a: string, b: string): boolean {
    return this.toEvmAddress(a) === this.toEvmAddress(b);
  }
}

export class TronAdapter implements ChainAdapter {
  readonly chainType: ChainType = "tron";
  readonly rpcUrl: string;
  readonly signerAddress?: string;

  private readonly tronWeb: TronWeb;
  private readonly feeLimit: number;
  private readonly readCaller: string;

  constructor(rpcUrl: string, signer?: string | ExternalSigner, feeLimit: number = 120_000_000) {
    this.rpcUrl = rpcUrl;
    this.feeLimit = feeLimit;
    this.tronWeb = new TronWeb({ fullHost: rpcUrl });
    this.readCaller = "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb";
    if (typeof signer === "string") {
      const addr = this.tronWeb.address.fromPrivateKey(signer);
      if (addr && typeof addr === "string") this.signerAddress = addr;
      this.readCaller = this.signerAddress || this.readCaller;
      if (this.signerAddress) this.tronWeb.setAddress(this.signerAddress);
      const signWithPrivateKey = this.tronWeb.trx.sign.bind(this.tronWeb.trx);
      (this.tronWeb.trx as any).sign = (transaction: Record<string, unknown>) => signWithPrivateKey(transaction as any, signer);
    } else if (signer) {
      this.signerAddress = this.toChainAddress(signer.address);
      this.readCaller = this.signerAddress;
      this.tronWeb.setAddress(this.signerAddress);
      (this.tronWeb.trx as any).sign = async (transaction: Record<string, unknown>) => {
        const signed = await signer.signTransaction(transaction);
        if (!signed || typeof signed !== "object") {
          throw new Error("TRON signer must return a signed transaction object");
        }
        return signed;
      };
    }
  }

  private pickMethod(contract: any, abi: Abi, name: string, argCount: number): any {
    const funcs = (abi as Array<any>).filter((x) => x.type === "function" && x.name === name && (x.inputs?.length ?? 0) === argCount);
    if (funcs.length > 0) {
      const signature = `${name}(${(funcs[0].inputs || []).map((i: any) => i.type).join(",")})`;
      return contract[signature] ?? contract[name];
    }
    return contract[name];
  }

  private toBigIntSafe(value: unknown, field: string): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
    if (typeof value === "string") {
      const s = value.trim();
      if (s) {
        if (s.startsWith("0x") || /^[0-9]+$/.test(s)) return BigInt(s);
      }
    }
    if (value && typeof value === "object") {
      const v = value as Record<string, unknown>;
      if (typeof v._hex === "string") return BigInt(v._hex);
      if (typeof v.hex === "string") return BigInt(v.hex);
      if (typeof v.toString === "function") {
        const s = String(v.toString());
        if (s && s !== "[object Object]" && (s.startsWith("0x") || /^[0-9]+$/.test(s))) {
          return BigInt(s);
        }
      }
    }
    throw new Error(`Unable to parse bigint field ${field}: ${String(value)}`);
  }

  private async getValidationStatusViaConstantCall(
    validationRegistry: string,
    requestHash: Hex,
  ): Promise<readonly [string, bigint, number, Hex, string, bigint]> {
    const callRes = await this.tronWeb.transactionBuilder.triggerConstantContract(
      validationRegistry,
      "getValidationStatus(bytes32)",
      {},
      [{ type: "bytes32", value: requestHash }],
      this.readCaller,
    );

    const raw = (callRes as any)?.constant_result?.[0];
    if (!raw) throw new Error("TRON constant call returned empty result for getValidationStatus");

    const decoded = (this.tronWeb.utils as any).abi.decodeParams(
      ["address", "uint256", "uint8", "bytes32", "string", "uint256"],
      `0x${raw}`,
    );

    return [
      this.toChainAddress(String(decoded[0])),
      this.toBigIntSafe(decoded[1], "agentId"),
      Number(decoded[2]),
      String(decoded[3]) as Hex,
      String(decoded[4] || ""),
      this.toBigIntSafe(decoded[5], "lastUpdate"),
    ] as const;
  }

  async registerAgent(identityRegistry: string, abi: Abi, agentURI?: string, metadata?: MetadataEntry[]): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");

    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const argCount = metadata !== undefined ? 2 : agentURI !== undefined ? 1 : 0;
    const method = this.pickMethod(contract, abi, "register", argCount);
    const args = metadata !== undefined
      ? [agentURI ?? "", metadata.map(({ metadataKey, metadataValue }) => ({ metadataKey, metadataValue }))]
      : agentURI !== undefined
        ? [agentURI]
        : [];
    const txid = await method(...args).send({ feeLimit: this.feeLimit });
    return txid;
  }

  async getAgentURI(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "tokenURI", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    return String(out || "");
  }

  async getAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "getAgentWallet", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    return String(out);
  }

  async getMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string): Promise<Hex> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "getMetadata", 2);
    const out = await method(Number(agentId), key).call({ from: this.readCaller });
    return String(out || "0x") as Hex;
  }

  async getApproved(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "getApproved", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    return this.toChainAddress(String(out));
  }

  async isApprovedForAll(identityRegistry: string, abi: Abi, owner: string, operator: string): Promise<boolean> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "isApprovedForAll", 2);
    return Boolean(await method(
      this.toChainAddress(owner),
      this.toChainAddress(operator),
    ).call({ from: this.readCaller }));
  }

  async approve(identityRegistry: string, abi: Abi, operator: string, agentId: bigint): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "approve", 2);
    return await method(Number(agentId), this.toChainAddress(operator)).send({ feeLimit: this.feeLimit });
  }

  async ownerOf(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "ownerOf", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    return String(out);
  }

  async setAgentURI(identityRegistry: string, abi: Abi, agentId: bigint, agentURI: string): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "setAgentURI", 2);
    return await method(Number(agentId), agentURI).send({ feeLimit: this.feeLimit });
  }

  async setApprovalForAll(identityRegistry: string, abi: Abi, operator: string, approved: boolean): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "setApprovalForAll", 2);
    return await method(this.toChainAddress(operator), approved).send({ feeLimit: this.feeLimit });
  }

  async transferFrom(identityRegistry: string, abi: Abi, from: string, to: string, agentId: bigint): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "transferFrom", 3);
    return await method(
      this.toChainAddress(from),
      this.toChainAddress(to),
      Number(agentId),
    ).send({ feeLimit: this.feeLimit });
  }

  async setMetadata(identityRegistry: string, abi: Abi, agentId: bigint, key: string, value: Uint8Array): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "setMetadata", 3);
    return await method(Number(agentId), key, value).send({ feeLimit: this.feeLimit });
  }

  async setAgentWallet(
    identityRegistry: string,
    abi: Abi,
    agentId: bigint,
    newWallet: string,
    deadline: bigint,
    signature: Hex,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "setAgentWallet", 4);
    return await method(
      Number(agentId),
      this.toChainAddress(newWallet),
      Number(deadline),
      toBytes(signature),
    ).send({ feeLimit: this.feeLimit });
  }

  async unsetAgentWallet(identityRegistry: string, abi: Abi, agentId: bigint): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, identityRegistry);
    const method = this.pickMethod(contract, abi, "unsetAgentWallet", 1);
    return await method(Number(agentId)).send({ feeLimit: this.feeLimit });
  }

  async giveFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    value: bigint,
    valueDecimals: number,
    tag1: string,
    tag2: string,
    endpoint: string,
    feedbackURI: string,
    feedbackHash: Hex,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "giveFeedback", 8);
    return await method(
      Number(agentId),
      Number(value),
      Number(valueDecimals),
      tag1,
      tag2,
      endpoint,
      feedbackURI,
      feedbackHash,
    ).send({ feeLimit: this.feeLimit });
  }

  async readFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
  ): Promise<readonly [bigint, number, string, string, boolean]> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "readFeedback", 3);
    const out = await method(
      Number(agentId),
      this.toChainAddress(clientAddress),
      Number(feedbackIndex),
    ).call({ from: this.readCaller });
    const arr = Array.isArray(out) ? out : [out.value, out.valueDecimals, out.tag1, out.tag2, out.isRevoked];
    return [
      BigInt(arr[0]),
      Number(arr[1]),
      String(arr[2] || ""),
      String(arr[3] || ""),
      Boolean(arr[4]),
    ] as const;
  }

  async getSummary(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
  ): Promise<readonly [bigint, bigint, number]> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "getSummary", 4);
    const out = await method(
      Number(agentId),
      clientAddresses.map((x) => this.toChainAddress(x)),
      tag1,
      tag2,
    ).call({ from: this.readCaller });
    const arr = Array.isArray(out) ? out : [out.count, out.summaryValue, out.summaryValueDecimals];
    return [BigInt(arr[0]), BigInt(arr[1]), Number(arr[2])] as const;
  }

  async getClients(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
  ): Promise<string[]> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "getClients", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    if (!Array.isArray(out)) return [];
    return out.map((x) => this.toChainAddress(String(x)));
  }

  async getLastIndex(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
  ): Promise<bigint> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "getLastIndex", 2);
    const out = await method(
      Number(agentId),
      this.toChainAddress(clientAddress),
    ).call({ from: this.readCaller });
    return BigInt(out);
  }

  async readAllFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddresses: string[],
    tag1: string,
    tag2: string,
    includeRevoked: boolean,
  ): Promise<readonly [string[], bigint[], bigint[], number[], string[], string[], boolean[]]> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "readAllFeedback", 5);
    const out = await method(
      Number(agentId),
      clientAddresses.map((x) => this.toChainAddress(x)),
      tag1,
      tag2,
      includeRevoked,
    ).call({ from: this.readCaller });
    const arr = Array.isArray(out)
      ? out
      : [out.clients, out.feedbackIndexes, out.values, out.valueDecimals, out.tag1s, out.tag2s, out.revokedStatuses];
    return [
      (arr[0] || []).map((x: unknown) => this.toChainAddress(String(x))),
      (arr[1] || []).map((x: unknown) => this.toBigIntSafe(x, "feedbackIndex")),
      (arr[2] || []).map((x: unknown) => this.toBigIntSafe(x, "value")),
      (arr[3] || []).map(Number),
      (arr[4] || []).map(String),
      (arr[5] || []).map(String),
      (arr[6] || []).map(Boolean),
    ] as const;
  }

  async getResponseCount(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responders: string[],
  ): Promise<bigint> {
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "getResponseCount", 4);
    const out = await method(
      Number(agentId),
      this.toChainAddress(clientAddress),
      Number(feedbackIndex),
      responders.map((x) => this.toChainAddress(x)),
    ).call({ from: this.readCaller });
    return this.toBigIntSafe(out, "responseCount");
  }

  async appendResponse(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    clientAddress: string,
    feedbackIndex: bigint,
    responseURI: string,
    responseHash: Hex,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "appendResponse", 5);
    return await method(
      Number(agentId),
      this.toChainAddress(clientAddress),
      Number(feedbackIndex),
      responseURI,
      responseHash,
    ).send({ feeLimit: this.feeLimit });
  }

  async revokeFeedback(
    reputationRegistry: string,
    abi: Abi,
    agentId: bigint,
    feedbackIndex: bigint,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, reputationRegistry);
    const method = this.pickMethod(contract, abi, "revokeFeedback", 2);
    return await method(Number(agentId), Number(feedbackIndex)).send({ feeLimit: this.feeLimit });
  }

  async validationRequest(
    validationRegistry: string,
    abi: Abi,
    validatorAddress: string,
    agentId: bigint,
    requestURI: string,
    requestHash: Hex,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, validationRegistry);
    const method = this.pickMethod(contract, abi, "validationRequest", 4);
    return await method(
      this.toChainAddress(validatorAddress),
      Number(agentId),
      requestURI,
      requestHash,
    ).send({ feeLimit: this.feeLimit });
  }

  async validationResponse(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
    response: number,
    responseURI: string,
    responseHash: Hex,
    tag: string,
  ): Promise<string> {
    if (!this.signerAddress) throw new Error("Signer is required for write operations");
    const contract = await this.tronWeb.contract(abi as any, validationRegistry);
    const method = this.pickMethod(contract, abi, "validationResponse", 5);
    return await method(
      requestHash,
      Number(response),
      responseURI,
      responseHash,
      tag,
    ).send({ feeLimit: this.feeLimit });
  }

  async getValidationStatus(
    validationRegistry: string,
    abi: Abi,
    requestHash: Hex,
  ): Promise<readonly [string, bigint, number, Hex, string, bigint]> {
    try {
      const contract = await this.tronWeb.contract(abi as any, validationRegistry);
      const method = this.pickMethod(contract, abi, "getValidationStatus", 1);
      const out = await method(requestHash).call({ from: this.readCaller });
      const arr = Array.isArray(out)
        ? out
        : [out.validatorAddress, out.agentId, out.response, out.responseHash, out.tag, out.lastUpdate];
      return [
        this.toChainAddress(String(arr[0])),
        this.toBigIntSafe(arr[1], "agentId"),
        Number(arr[2]),
        String(arr[3]) as Hex,
        String(arr[4] || ""),
        this.toBigIntSafe(arr[5], "lastUpdate"),
      ] as const;
    } catch (error) {
      const msg = String((error as any)?.message || error || "");
      if (msg.toLowerCase().includes("overflow")) {
        return await this.getValidationStatusViaConstantCall(validationRegistry, requestHash);
      }
      throw error;
    }
  }

  async getValidationSummary(
    validationRegistry: string,
    abi: Abi,
    agentId: bigint,
    validatorAddresses: string[],
    tag: string,
  ): Promise<readonly [bigint, number]> {
    const contract = await this.tronWeb.contract(abi as any, validationRegistry);
    const method = this.pickMethod(contract, abi, "getSummary", 3);
    const out = await method(
      Number(agentId),
      validatorAddresses.map((x) => this.toChainAddress(x)),
      tag,
    ).call({ from: this.readCaller });
    const arr = Array.isArray(out) ? out : [out.count, out.avgResponse];
    return [this.toBigIntSafe(arr[0], "count"), Number(arr[1])] as const;
  }

  async getAgentValidations(validationRegistry: string, abi: Abi, agentId: bigint): Promise<Hex[]> {
    const contract = await this.tronWeb.contract(abi as any, validationRegistry);
    const method = this.pickMethod(contract, abi, "getAgentValidations", 1);
    const out = await method(Number(agentId)).call({ from: this.readCaller });
    return Array.isArray(out) ? out.map(String) as Hex[] : [];
  }

  async getValidatorRequests(validationRegistry: string, abi: Abi, validatorAddress: string): Promise<Hex[]> {
    const contract = await this.tronWeb.contract(abi as any, validationRegistry);
    const method = this.pickMethod(contract, abi, "getValidatorRequests", 1);
    const out = await method(this.toChainAddress(validatorAddress)).call({ from: this.readCaller });
    return Array.isArray(out) ? out.map(String) as Hex[] : [];
  }

  async waitForTransaction(txHash: string, opts: TxWaitOptions = {}): Promise<unknown> {
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const pollMs = opts.pollMs ?? 1_000;
    const throwOnRevert = opts.throwOnRevert ?? true;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const info = await this.tronWeb.trx.getTransactionInfo(txHash);
      if (info && Object.keys(info).length > 0) {
        const result = (info as any).receipt?.result;
        if (throwOnRevert && result && String(result).toUpperCase() !== "SUCCESS") {
          throw new Error(`TRON transaction reverted: ${txHash} (${result})`);
        }
        return info;
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    throw new Error(`Timeout waiting TRON tx: ${txHash}`);
  }

  parseRegisteredAgentId(receipt: unknown): string | undefined {
    const logs = (receipt as any)?.log;
    if (!Array.isArray(logs)) return undefined;

    const eventSig = this.tronWeb.sha3("Registered(uint256,string,address)").replace(/^0x/, "").toLowerCase();
    for (const log of logs) {
      const topics = (log?.topics || []) as string[];
      if (!topics.length) continue;
      const t0 = String(topics[0]).replace(/^0x/, "").toLowerCase();
      if (t0 !== eventSig) continue;
      const t1 = String(topics[1] || "").replace(/^0x/, "");
      if (!t1) continue;
      try {
        return BigInt(`0x${t1}`).toString();
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  toEvmAddress(address: string): string {
    const raw = address.trim();
    if (raw.startsWith("0x") && raw.length === 42) return raw.toLowerCase();

    if (raw.length === 42 && raw.slice(0, 2).toLowerCase() === "41") {
      return `0x${raw.slice(2).toLowerCase()}`;
    }

    const tronHex = this.tronWeb.address.toHex(raw);
    if (!tronHex) throw new Error(`Invalid TRON address: ${address}`);
    const cleaned = tronHex.replace(/^0x/i, "").toLowerCase();
    return `0x${cleaned.slice(-40)}`;
  }

  toChainAddress(address: string): string {
    const raw = address.trim();
    if (!raw) throw new Error("Address cannot be empty");
    if (!raw.startsWith("0x")) {
      const cleaned = raw.replace(/^0x/i, "");
      if (cleaned.length === 42 && cleaned.slice(0, 2).toLowerCase() === "41") {
        return this.tronWeb.address.fromHex(cleaned);
      }
      return raw;
    }

    const cleaned = raw.slice(2).toLowerCase();
    if (cleaned.length !== 40) throw new Error(`Invalid EVM address for TRON conversion: ${address}`);
    return this.tronWeb.address.fromHex(`41${cleaned}`);
  }

  addressEqual(a: string, b: string): boolean {
    return this.toEvmAddress(a) === this.toEvmAddress(b);
  }
}

export function resolveChainFromConfig(chainsJson: any, network: string, chainId?: number, rpcUrl?: string): {
  chainType: ChainType;
  resolvedNetwork: string;
  resolvedChainId: number;
  rpcUrl: string;
  contracts: ChainContracts;
} {
  const n = (network || "").toLowerCase().trim();

  if (n === "nile" || n === "mainnet" || n === "shasta" || n.startsWith("tron")) {
    const key = n === "tron" ? "nile" : n.startsWith("tron:") ? n.split(":", 2)[1] : n;
    const resolvedNetwork = key || "nile";
    const cfg = chainsJson.tron.networks[resolvedNetwork];
    if (!cfg) throw new Error(`Unknown TRON network: ${resolvedNetwork}`);
    return {
      chainType: "tron",
      resolvedNetwork,
      resolvedChainId: chainId ?? TRON_CHAIN_IDS[resolvedNetwork],
      rpcUrl: rpcUrl || cfg.fullNode,
      contracts: cfg.contracts,
    };
  }

  const eip155 = /^eip155:(\d+)$/.exec(n);
  const eip155ChainId = eip155 ? Number(eip155[1]) : undefined;
  const finalChainId = eip155ChainId ?? chainId;

  const baseAlias = n === "base" || n === "base:mainnet" || n === "base:sepolia";
  const baseChainId = n === "base:sepolia" ? 84532 : baseAlias ? 8453 : undefined;
  if (baseAlias || finalChainId === 8453 || finalChainId === 84532) {
    if (chainId !== undefined && baseChainId !== undefined && chainId !== baseChainId) {
      throw new Error(`chainId/network mismatch: chainId=${chainId}, network=${network} -> ${baseChainId}`);
    }
    const resolvedChainId = finalChainId ?? baseChainId ?? 8453;
    const networkKey = resolvedChainId === 84532 ? "sepolia" : "mainnet";
    const cfg = chainsJson.base.networks[networkKey];
    return {
      chainType: "evm",
      resolvedNetwork: eip155ChainId ? `eip155:${resolvedChainId}` : `base:${networkKey}`,
      resolvedChainId,
      rpcUrl: rpcUrl || cfg.rpc,
      contracts: cfg.contracts,
    };
  }

  if (n === "evm" || n.includes("bsc") || finalChainId === 56 || finalChainId === 97) {
    const resolvedNetwork = finalChainId === 56 ? "mainnet" : "testnet";
    const cfg = chainsJson.bsc.networks[resolvedNetwork];
    return {
      chainType: "evm",
      resolvedNetwork: eip155ChainId ? `eip155:${finalChainId}` : `bsc:${resolvedNetwork}`,
      resolvedChainId: finalChainId ?? 97,
      rpcUrl: rpcUrl || cfg.rpc,
      contracts: cfg.contracts,
    };
  }

  throw new Error(`Unsupported network: ${network}. Supported: Base/Base Sepolia, BSC/BSC Testnet, TRON Mainnet/Nile/Shasta`);
}

export const TRON_CHAIN_IDS: Record<string, number> = {
  mainnet: 728126428,
  nile: 3448148188,
  shasta: 2494104990,
};
