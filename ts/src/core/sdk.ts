import chainsJson from "../../resource/chains.json" with { type: "json" };
import { keccak256, recoverTypedDataAddress, toBytes, type Abi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Agent } from "./agent.js";
import { EvmAdapter, resolveChainFromConfig, TRON_CHAIN_IDS, TronAdapter, type ChainAdapter } from "./chains.js";
import { TransactionHandle } from "./transaction-handle.js";
import { getIdentityRegistryAbi, getReputationRegistryAbi, getValidationRegistryAbi } from "./contracts.js";
import { SubgraphClient } from "./subgraph-client.js";
import { AgentIndexer } from "./indexer.js";
import type {
  ExternalSigner,
  AppendResponseParams,
  AgentSummary,
  FeedbackSearchFilters,
  FeedbackSearchOptions,
  FeedbackRecord,
  FeedbackSummary,
  GiveFeedbackParams,
  MetadataEntry,
  OnChainFeedbackRecord,
  RegistrationFile,
  RegistrationResult,
  ReputationSummary,
  SDKConfig,
  SearchFilters,
  SearchOptions,
  ValidationRequestParams,
  ValidationResponseParams,
  ValidationStatus,
  ValidationSummary,
} from "../models/types.js";

const sdkSigners = new WeakMap<object, string | ExternalSigner>();

export class SDK {
  readonly chainType: "evm" | "tron";
  readonly network: string;
  readonly rpcUrl: string;
  readonly chainId: number;
  readonly feeLimit: number;

  readonly identityRegistry: string;
  readonly reputationRegistry: string;
  readonly validationRegistry: string;

  readonly identityRegistryAbi: Abi;
  readonly reputationRegistryAbi: Abi;
  readonly validationRegistryAbi: Abi;

  readonly chain: ChainAdapter;
  readonly indexer: AgentIndexer;
  readonly subgraphClients: Map<number, SubgraphClient>;
  readonly ipfsUploader?: (json: string) => Promise<string>;

  private static readonly DEFAULT_SUBGRAPH_URLS: Record<number, string> = {
    56: "",
    97: "",
  };

  constructor(config: SDKConfig) {
    const resolved = resolveChainFromConfig(chainsJson, config.network, config.chainId, config.rpcUrl);
    if (
      typeof config.chainId === "number" &&
      typeof resolved.resolvedChainId === "number" &&
      config.chainId !== resolved.resolvedChainId
    ) {
      throw new Error(
        `chainId/network mismatch: chainId=${config.chainId}, network=${config.network} -> ${resolved.resolvedChainId}`,
      );
    }

    this.chainType = resolved.chainType;
    this.network = resolved.resolvedNetwork;
    this.rpcUrl = resolved.rpcUrl;
    this.chainId = resolved.resolvedChainId ?? config.chainId ?? (this.chainType === "evm" ? 97 : 1);
    if (config.signer) sdkSigners.set(this, config.signer);
    this.feeLimit = config.feeLimit ?? 120_000_000;

    this.identityRegistry = resolved.contracts.identityRegistry;
    this.reputationRegistry = resolved.contracts.reputationRegistry;
    this.validationRegistry = resolved.contracts.validationRegistry;

    this.identityRegistryAbi = getIdentityRegistryAbi(this.chainType) as Abi;
    this.reputationRegistryAbi = getReputationRegistryAbi(this.chainType) as Abi;
    this.validationRegistryAbi = getValidationRegistryAbi(this.chainType) as Abi;

    this.chain = this.chainType === "evm"
      ? new EvmAdapter(this.rpcUrl, this.chainId, config.signer)
      : new TronAdapter(this.rpcUrl, config.signer, this.feeLimit);
    this.ipfsUploader = config.ipfsUploader;

    this.subgraphClients = new Map<number, SubgraphClient>();
    const mergedSubgraph = {
      ...SDK.DEFAULT_SUBGRAPH_URLS,
      ...(config.subgraphOverrides || {}),
    };
    if (config.subgraphUrl) mergedSubgraph[this.chainId] = config.subgraphUrl;
    for (const [k, v] of Object.entries(mergedSubgraph)) {
      const cid = Number(k);
      if (v && String(v).trim()) this.subgraphClients.set(cid, new SubgraphClient(v));
    }
    this.indexer = new AgentIndexer(this.chainId, this.subgraphClients);
  }

  createAgent(input: { name: string; description: string; image?: string }): Agent {
    const registrationFile: RegistrationFile = {
      name: input.name,
      description: input.description,
      image: input.image,
      endpoints: [],
      tags: [],
      metadata: {},
      supportedTrust: [],
      active: true,
      x402support: false,
      updatedAt: Math.floor(Date.now() / 1000),
    };

    return new Agent(this, registrationFile);
  }

  async loadAgent(agentIdInput: string | number): Promise<Agent> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    const now = Math.floor(Date.now() / 1000);

    let summary: AgentSummary | undefined;
    try {
      summary = await this.getAgent(agentId);
    } catch {
      // ignore subgraph/indexer errors; we still try to hydrate from chain.
    }

    let agentURI = summary?.agentURI;
    if (!agentURI || !String(agentURI).trim()) {
      try {
        const uri = await this.chain.getAgentURI(this.identityRegistry, this.identityRegistryAbi, tokenId);
        if (uri && String(uri).trim()) agentURI = String(uri);
      } catch {
        // keep empty if unavailable
      }
    }

    const registrationFile: RegistrationFile = {
      agentId,
      agentURI,
      name: summary?.name ?? "",
      description: summary?.description ?? "",
      image: summary?.image,
      endpoints: [],
      tags: [],
      metadata: {},
      supportedTrust: [],
      active: summary?.active ?? true,
      x402support: summary?.x402support ?? false,
      updatedAt: summary?.updatedAt ?? now,
    };

    if (agentURI && String(agentURI).trim()) {
      const hydrated = await this.fetchRegistrationFromUri(agentURI);
      if (hydrated) {
        registrationFile.name = hydrated.name ?? registrationFile.name;
        registrationFile.description = hydrated.description ?? registrationFile.description;
        registrationFile.image = hydrated.image ?? registrationFile.image;
        registrationFile.endpoints = hydrated.endpoints ?? registrationFile.endpoints;
        registrationFile.tags = hydrated.tags ?? registrationFile.tags;
        registrationFile.metadata = hydrated.metadata ?? registrationFile.metadata;
        registrationFile.supportedTrust = hydrated.supportedTrust ?? registrationFile.supportedTrust;
        registrationFile.active = hydrated.active ?? registrationFile.active;
        registrationFile.x402support = hydrated.x402support ?? registrationFile.x402support;
      }
    }

    return new Agent(this, registrationFile);
  }

  private async fetchRegistrationFromUri(uri: string): Promise<Partial<RegistrationFile> | undefined> {
    const u = String(uri || "").trim();
    if (!u) return undefined;

    let target = u;
    if (u.startsWith("ipfs://")) {
      const cid = u.slice("ipfs://".length).replace(/^ipfs\//, "");
      target = `https://ipfs.io/ipfs/${cid}`;
    } else if (!u.startsWith("http://") && !u.startsWith("https://")) {
      return undefined;
    }

    try {
      const res = await fetch(target, { method: "GET" });
      if (!res.ok) return undefined;
      const json = await res.json();
      const rf = json as Partial<RegistrationFile>;
      return {
        name: typeof rf.name === "string" ? rf.name : undefined,
        description: typeof rf.description === "string" ? rf.description : undefined,
        image: typeof rf.image === "string" ? rf.image : undefined,
        endpoints: Array.isArray(rf.endpoints) ? rf.endpoints : undefined,
        tags: Array.isArray(rf.tags) ? rf.tags : undefined,
        metadata: typeof rf.metadata === "object" && rf.metadata ? rf.metadata : undefined,
        supportedTrust: Array.isArray(rf.supportedTrust) ? rf.supportedTrust : undefined,
        active: typeof rf.active === "boolean" ? rf.active : undefined,
        x402support: typeof rf.x402support === "boolean" ? rf.x402support : undefined,
      };
    } catch {
      return undefined;
    }
  }

  async uploadRegistrationFile(registrationFile: RegistrationFile): Promise<string> {
    if (!this.ipfsUploader) {
      throw new Error("No ipfsUploader configured. Pass SDKConfig.ipfsUploader to use registerIPFS().");
    }
    return await this.ipfsUploader(JSON.stringify(registrationFile, null, 2));
  }

  async submitRegister(agentURI?: string, metadata?: MetadataEntry[]): Promise<TransactionHandle<RegistrationResult>> {
    const txHash = await this.chain.registerAgent(this.identityRegistry, this.identityRegistryAbi, agentURI, metadata);
    return new TransactionHandle<RegistrationResult>(
      txHash,
      this.chain,
      async (receipt) => {
        const agentNum = this.chain.parseRegisteredAgentId(receipt);
        return {
          agentId: agentNum ? `${this.chainId}:${agentNum}` : undefined,
          agentURI: agentURI ?? "",
        };
      },
    );
  }

  async getAgentWallet(agentId: string | number): Promise<string | undefined> {
    const { tokenId } = this.parseAgentId(agentId);
    const wallet = await this.chain.getAgentWallet(this.identityRegistry, this.identityRegistryAbi, tokenId);

    if (!wallet) return undefined;
    const evm = this.chain.toEvmAddress(wallet).toLowerCase();
    if (evm === "0x0000000000000000000000000000000000000000") return undefined;
    if (wallet.toLowerCase() === "t9yd14nj9j7xab4dbgeix9h8unkkhxuwwb") return undefined;
    return this.chain.toChainAddress(wallet);
  }

  async getAgentURI(agentId: string | number): Promise<string> {
    const { tokenId } = this.parseAgentId(agentId);
    return await this.chain.getAgentURI(this.identityRegistry, this.identityRegistryAbi, tokenId);
  }

  async getAgentOwner(agentId: string | number): Promise<string> {
    const { tokenId } = this.parseAgentId(agentId);
    const owner = await this.chain.ownerOf(this.identityRegistry, this.identityRegistryAbi, tokenId);
    return this.chain.toChainAddress(owner);
  }

  async getMetadata(agentId: string | number, key: string): Promise<Hex> {
    const { tokenId } = this.parseAgentId(agentId);
    return await this.chain.getMetadata(this.identityRegistry, this.identityRegistryAbi, tokenId, key);
  }

  async getApproved(agentId: string | number): Promise<string | undefined> {
    const { tokenId } = this.parseAgentId(agentId);
    const approved = await this.chain.getApproved(this.identityRegistry, this.identityRegistryAbi, tokenId);
    const evm = this.chain.toEvmAddress(approved).toLowerCase();
    if (evm === "0x0000000000000000000000000000000000000000") return undefined;
    return this.chain.toChainAddress(approved);
  }

  async isApprovedForAll(owner: string, operator: string): Promise<boolean> {
    return await this.chain.isApprovedForAll(this.identityRegistry, this.identityRegistryAbi, owner, operator);
  }

  private parseAgentId(agentIdInput: string | number): { tokenId: bigint; agentId: string } {
    const input = String(agentIdInput).trim();
    const parts = input.split(":");
    let chainId = this.chainId;
    let token = input;

    if (parts.length === 2) {
      chainId = Number(parts[0]);
      token = parts[1];
    } else if (parts.length === 3 && parts[0].toLowerCase() === "eip155") {
      chainId = Number(parts[1]);
      token = parts[2];
    } else if (parts.length !== 1) {
      throw new Error(`Invalid agentId: ${agentIdInput}`);
    }

    if (!Number.isSafeInteger(chainId) || chainId !== this.chainId) {
      throw new Error(
        `Agent ID chain mismatch: agentId=${agentIdInput} targets chainId=${chainId}, SDK is configured for chainId=${this.chainId}`,
      );
    }
    if (!token) throw new Error(`Invalid agentId: ${agentIdInput}`);

    const tokenId = BigInt(token);
    return { tokenId, agentId: `${this.chainId}:${tokenId}` };
  }

  private encodeFeedbackValue(value: number): { raw: bigint; decimals: number } {
    const decimals = 6;
    const raw = BigInt(Math.round(value * 10 ** decimals));
    return { raw, decimals };
  }

  private toBytes32(input?: string, fallback?: string): Hex {
    if (input && input.startsWith("0x") && input.length === 66) return input.toLowerCase() as Hex;
    const src = input || fallback;
    if (src) return keccak256(toBytes(src));
    return `0x${"00".repeat(32)}` as Hex;
  }

  async giveFeedback(params: GiveFeedbackParams): Promise<TransactionHandle<{ agentId: string; reviewer: string; feedbackIndex: number }>> {
    const { tokenId, agentId } = this.parseAgentId(params.agentId);
    const { raw, decimals } = this.encodeFeedbackValue(params.value);
    const reviewerChain = params.reviewerSigner
      ? (this.chainType === "evm"
        ? new EvmAdapter(this.rpcUrl, this.chainId, params.reviewerSigner)
        : new TronAdapter(this.rpcUrl, params.reviewerSigner, this.feeLimit))
      : this.chain;
    const reviewer = reviewerChain.signerAddress;
    if (!reviewer) throw new Error("Signer is required for giveFeedback");

    const txHash = await reviewerChain.giveFeedback(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      raw,
      decimals,
      params.tag1 ?? "",
      params.tag2 ?? "",
      params.endpoint ?? "",
      params.feedbackURI ?? "",
      this.toBytes32(params.feedbackHash, params.feedbackURI),
    );

    return new TransactionHandle(txHash, reviewerChain, async () => {
      const idx = await reviewerChain.getLastIndex(
        this.reputationRegistry,
        this.reputationRegistryAbi,
        tokenId,
        reviewer,
      );
      return {
        agentId,
        reviewer: reviewerChain.toChainAddress(reviewer),
        feedbackIndex: Number(idx),
      };
    });
  }

  async getFeedback(agentIdInput: string | number, reviewerAddress: string, feedbackIndex: number): Promise<FeedbackRecord> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    const reviewer = this.chain.toChainAddress(reviewerAddress);
    const [valueRaw, valueDecimals, tag1, tag2, isRevoked] = await this.chain.readFeedback(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      reviewer,
      BigInt(feedbackIndex),
    );

    const divisor = 10 ** valueDecimals;
    const value = Number(valueRaw) / divisor;
    return {
      agentId,
      reviewer,
      feedbackIndex,
      value,
      valueDecimals,
      tag1,
      tag2,
      isRevoked,
    };
  }

  async readAllFeedback(
    agentIdInput: string | number,
    clientAddresses: string[] = [],
    tag1 = "",
    tag2 = "",
    includeRevoked = false,
  ): Promise<OnChainFeedbackRecord[]> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    const [clients, indexes, values, decimals, tag1s, tag2s, revoked] = await this.chain.readAllFeedback(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      clientAddresses,
      tag1,
      tag2,
      includeRevoked,
    );
    return clients.map((client, index) => ({
      agentId,
      reviewer: this.chain.toChainAddress(client),
      feedbackIndex: Number(indexes[index]),
      value: Number(values[index]) / (10 ** decimals[index]),
      valueDecimals: decimals[index],
      tag1: tag1s[index],
      tag2: tag2s[index],
      isRevoked: revoked[index],
    }));
  }

  async getResponseCount(
    agentIdInput: string | number,
    clientAddress: string,
    feedbackIndex: number,
    responders: string[] = [],
  ): Promise<bigint> {
    const { tokenId } = this.parseAgentId(agentIdInput);
    return await this.chain.getResponseCount(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      clientAddress,
      BigInt(feedbackIndex),
      responders,
    );
  }

  async getReputationSummary(
    agentIdInput: string | number,
    clientAddresses: string[] = [],
    tag1 = "",
    tag2 = "",
  ): Promise<ReputationSummary> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    let clients = clientAddresses;
    if (!clients.length) {
      clients = await this.chain.getClients(
        this.reputationRegistry,
        this.reputationRegistryAbi,
        tokenId,
      );
      if (!clients.length) {
        return {
          agentId,
          count: 0,
          summaryValue: 0,
          summaryValueDecimals: 0,
          averageValue: 0,
        };
      }
    }

    const [count, summaryValue, summaryValueDecimals] = await this.chain.getSummary(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      clients,
      tag1,
      tag2,
    );
    const averageValue = Number(summaryValue) / (10 ** summaryValueDecimals);
    return {
      agentId,
      count: Number(count),
      summaryValue: Number(summaryValue),
      summaryValueDecimals,
      averageValue,
    };
  }

  async getClients(agentIdInput: string | number): Promise<string[]> {
    const { tokenId } = this.parseAgentId(agentIdInput);
    const clients = await this.chain.getClients(this.reputationRegistry, this.reputationRegistryAbi, tokenId);
    return clients.map((client) => this.chain.toChainAddress(client));
  }

  async getLastIndex(agentIdInput: string | number, clientAddress: string): Promise<bigint> {
    const { tokenId } = this.parseAgentId(agentIdInput);
    return await this.chain.getLastIndex(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      clientAddress,
    );
  }

  async appendResponse(
    params: AppendResponseParams,
  ): Promise<TransactionHandle<{ agentId: string; clientAddress: string; feedbackIndex: number }>> {
    const { tokenId, agentId } = this.parseAgentId(params.agentId);
    const responseHash = this.toBytes32(params.responseHash, params.responseURI);
    const txHash = await this.chain.appendResponse(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      params.clientAddress,
      BigInt(params.feedbackIndex),
      params.responseURI,
      responseHash,
    );
    return new TransactionHandle(txHash, this.chain, async () => ({
      agentId,
      clientAddress: this.chain.toChainAddress(params.clientAddress),
      feedbackIndex: params.feedbackIndex,
    }));
  }

  async revokeFeedback(
    agentIdInput: string | number,
    feedbackIndex: number,
  ): Promise<TransactionHandle<{ agentId: string; feedbackIndex: number }>> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    const txHash = await this.chain.revokeFeedback(
      this.reputationRegistry,
      this.reputationRegistryAbi,
      tokenId,
      BigInt(feedbackIndex),
    );
    return new TransactionHandle(txHash, this.chain, async () => ({ agentId, feedbackIndex }));
  }

  async validationRequest(params: ValidationRequestParams): Promise<TransactionHandle<{ requestHash: Hex; agentId: string }>> {
    const { tokenId, agentId } = this.parseAgentId(params.agentId);
    const requestHash = this.toBytes32(params.requestHash, params.requestURI);
    const txHash = await this.chain.validationRequest(
      this.validationRegistry,
      this.validationRegistryAbi,
      params.validatorAddress,
      tokenId,
      params.requestURI,
      requestHash,
    );

    return new TransactionHandle(txHash, this.chain, async () => ({ requestHash, agentId }));
  }

  async validationResponse(params: ValidationResponseParams): Promise<TransactionHandle<{ requestHash: Hex; response: number }>> {
    const responseHash = this.toBytes32(params.responseHash, params.responseURI);
    const txHash = await this.chain.validationResponse(
      this.validationRegistry,
      this.validationRegistryAbi,
      params.requestHash,
      params.response,
      params.responseURI ?? "",
      responseHash,
      params.tag ?? "",
    );
    return new TransactionHandle(txHash, this.chain, async () => ({ requestHash: params.requestHash, response: params.response }));
  }

  async getValidationStatus(requestHash: Hex): Promise<ValidationStatus> {
    const [validatorAddress, agentIdNum, response, responseHash, tag, lastUpdate] = await this.chain.getValidationStatus(
      this.validationRegistry,
      this.validationRegistryAbi,
      requestHash,
    );
    return {
      validatorAddress: this.chain.toChainAddress(validatorAddress),
      agentId: `${this.chainId}:${agentIdNum.toString()}`,
      response,
      responseHash,
      tag,
      lastUpdate: Number(lastUpdate),
    };
  }

  async getValidationSummary(
    agentIdInput: string | number,
    validatorAddresses: string[] = [],
    tag = "",
  ): Promise<ValidationSummary> {
    const { tokenId, agentId } = this.parseAgentId(agentIdInput);
    const [count, averageResponse] = await this.chain.getValidationSummary(
      this.validationRegistry,
      this.validationRegistryAbi,
      tokenId,
      validatorAddresses,
      tag,
    );
    return { agentId, count: Number(count), averageResponse };
  }

  async getAgentValidations(agentIdInput: string | number): Promise<Hex[]> {
    const { tokenId } = this.parseAgentId(agentIdInput);
    return await this.chain.getAgentValidations(this.validationRegistry, this.validationRegistryAbi, tokenId);
  }

  async getValidatorRequests(validatorAddress: string): Promise<Hex[]> {
    return await this.chain.getValidatorRequests(
      this.validationRegistry,
      this.validationRegistryAbi,
      validatorAddress,
    );
  }

  getTypedDataChainId(): number {
    if (this.chainType !== "tron") return this.chainId;
    const key = (this.network || "").toLowerCase().split(":").pop() || "nile";
    return TRON_CHAIN_IDS[key] ?? this.chainId;
  }

  getSubgraphClient(chainId?: number): SubgraphClient | undefined {
    return this.subgraphClients.get(chainId ?? this.chainId);
  }

  async searchAgents(filters: SearchFilters = {}, options: SearchOptions = {}, chainId?: number): Promise<AgentSummary[]> {
    return this.indexer.searchAgents(filters, options, chainId);
  }

  async getAgent(agentId: string): Promise<AgentSummary | undefined> {
    return this.indexer.getAgent(agentId);
  }

  async searchFeedback(
    filters: FeedbackSearchFilters = {},
    options: FeedbackSearchOptions = {},
    chainId?: number,
  ): Promise<FeedbackSummary[]> {
    const cid = chainId ?? this.chainId;
    const client = this.getSubgraphClient(cid);
    if (!client) return [];
    return client.searchFeedback(cid, filters, options);
  }
}

export async function signAgentWalletBinding(
  sdk: SDK,
  agentId: bigint,
  newWallet: string,
  deadline: bigint,
  signerOverride?: string | ExternalSigner,
): Promise<Hex> {
  const newWalletAddress = sdk.chain.toEvmAddress(newWallet) as Hex;
  const owner = await sdk.chain.ownerOf(sdk.identityRegistry, sdk.identityRegistryAbi, agentId);
  const ownerAddress = sdk.chain.toEvmAddress(owner) as Hex;
  const domain = {
    name: "ERC8004IdentityRegistry",
    version: "1",
    chainId: sdk.getTypedDataChainId(),
    verifyingContract: sdk.chain.toEvmAddress(sdk.identityRegistry) as Hex,
  } as const;
  const types = {
    AgentWalletSet: [
      { name: "agentId", type: "uint256" },
      { name: "newWallet", type: "address" },
      { name: "owner", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
  } as const;
  const message = { agentId, newWallet: newWalletAddress, owner: ownerAddress, deadline } as const;
  const signer = signerOverride ?? sdkSigners.get(sdk);
  if (!signer) {
    throw new Error("New wallet signature is required. Provide options.newWalletSigner or options.signature.");
  }

  let signerAddress: string;
  let signature: Hex;
  if (typeof signer === "string") {
    const normalizedKey = (signer.startsWith("0x") ? signer : `0x${signer}`) as Hex;
    const account = privateKeyToAccount(normalizedKey);
    signerAddress = account.address;
    signature = await account.signTypedData({ domain, types, primaryType: "AgentWalletSet", message });
  } else {
    signerAddress = sdk.chain.toEvmAddress(signer.address);
    if (!signer.signTypedData) throw new Error("External signer does not support typed-data signing");
    signature = await signer.signTypedData({ domain, types, primaryType: "AgentWalletSet", message });
  }
  if (signerAddress.toLowerCase() !== newWalletAddress.toLowerCase()) {
    throw new Error(`newWalletSigner address (${signerAddress}) does not match newWallet (${newWalletAddress}).`);
  }

  const recovered = await recoverTypedDataAddress({
    domain,
    types,
    primaryType: "AgentWalletSet",
    message,
    signature,
  });
  if (recovered.toLowerCase() !== newWalletAddress.toLowerCase()) {
    throw new Error(`Signature verification failed: recovered ${recovered}, expected ${newWalletAddress}`);
  }
  return signature;
}
