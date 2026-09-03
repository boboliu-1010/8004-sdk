import type { Hex } from "viem";

import type { MetadataEntry, RegistrationFile, RegistrationResult, SetWalletOptions } from "../models/types.js";
import type { SDK } from "./sdk.js";
import { TransactionHandle } from "./transaction-handle.js";

export class Agent {
  constructor(private readonly sdk: SDK, private readonly registrationFile: RegistrationFile) {}

  get agentId(): string | undefined {
    return this.registrationFile.agentId;
  }

  setMCP(endpoint: string, version = "2025-06-18"): this {
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter((e) => e.name !== "MCP");
    this.registrationFile.endpoints.push({ name: "MCP", endpoint, version });
    return this.touch();
  }

  setA2A(endpoint: string, version = "0.3.0"): this {
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter((e) => e.name !== "A2A");
    this.registrationFile.endpoints.push({ name: "A2A", endpoint, version });
    return this.touch();
  }

  setENS(name: string, version = "1.0"): this {
    this.registrationFile.endpoints = this.registrationFile.endpoints.filter((e) => e.name !== "ENS");
    this.registrationFile.endpoints.push({ name: "ENS", endpoint: name, version });
    return this.touch();
  }

  removeEndpoint(): this;
  removeEndpoint(opts: { type?: string; value?: string }): this;
  removeEndpoint(type?: string, value?: string): this;
  removeEndpoint(arg1?: string | { type?: string; value?: string }, arg2?: string): this {
    const { type, value } =
      arg1 && typeof arg1 === "object"
        ? { type: arg1.type, value: arg1.value }
        : { type: arg1 as string | undefined, value: arg2 };

    if (type === undefined && value === undefined) {
      this.registrationFile.endpoints = [];
      return this.touch();
    }

    this.registrationFile.endpoints = this.registrationFile.endpoints.filter((ep) => {
      const typeMatch = type === undefined || ep.name === type;
      const valueMatch = value === undefined || ep.endpoint === value;
      return !(typeMatch && valueMatch);
    });
    return this.touch();
  }

  removeEndpoints(): this {
    return this.removeEndpoint();
  }

  addSkill(skill: string): this {
    if (!this.registrationFile.tags.includes(skill)) this.registrationFile.tags.push(skill);
    return this.touch();
  }

  addDomain(domain: string): this {
    if (!this.registrationFile.tags.includes(domain)) this.registrationFile.tags.push(domain);
    return this.touch();
  }

  removeSkill(skill: string): this {
    this.registrationFile.tags = this.registrationFile.tags.filter((x) => x !== skill);
    return this.touch();
  }

  removeDomain(domain: string): this {
    this.registrationFile.tags = this.registrationFile.tags.filter((x) => x !== domain);
    return this.touch();
  }

  updateInfo(input: { name?: string; description?: string; image?: string }): this {
    if (typeof input.name === "string") this.registrationFile.name = input.name;
    if (typeof input.description === "string") this.registrationFile.description = input.description;
    if (typeof input.image === "string") this.registrationFile.image = input.image;
    return this.touch();
  }

  setTrust(input: { reputation?: boolean; cryptoEconomic?: boolean; teeAttestation?: boolean }): this {
    const trust: string[] = [];
    if (input.reputation) trust.push("reputation");
    if (input.cryptoEconomic) trust.push("crypto-economic");
    if (input.teeAttestation) trust.push("tee-attestation");
    this.registrationFile.supportedTrust = trust;
    return this.touch();
  }

  setTrustModels(models: Array<{ name: string } | string>): this {
    const trust: string[] = [];
    for (const model of models) {
      const raw = typeof model === "string" ? model : model.name;
      const x = String(raw || "").toLowerCase();
      if (x.includes("reputation")) {
        if (!trust.includes("reputation")) trust.push("reputation");
      } else if (x.includes("crypto")) {
        if (!trust.includes("crypto-economic")) trust.push("crypto-economic");
      } else if (x.includes("tee")) {
        if (!trust.includes("tee-attestation")) trust.push("tee-attestation");
      } else if (x.trim()) {
        if (!trust.includes(x.trim())) trust.push(x.trim());
      }
    }
    this.registrationFile.supportedTrust = trust;
    return this.touch();
  }

  setMetadata(kv: Record<string, unknown>): this {
    this.registrationFile.metadata = { ...this.registrationFile.metadata, ...kv };
    return this.touch();
  }

  async updateOnChainMetadata(): Promise<string[]> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);
    const txHashes: string[] = [];
    const encoder = new TextEncoder();

    for (const [k, v] of Object.entries(this.registrationFile.metadata || {})) {
      const payload = typeof v === "string" ? v : JSON.stringify(v);
      const txHash = await this.sdk.chain.setMetadata(
        this.sdk.identityRegistry,
        this.sdk.identityRegistryAbi,
        agentTokenId,
        k,
        encoder.encode(payload),
      );
      txHashes.push(txHash);
    }

    const ens = this.registrationFile.endpoints.find((e) => e.name === "ENS")?.endpoint;
    if (ens && ens.trim()) {
      const txHash = await this.sdk.chain.setMetadata(
        this.sdk.identityRegistry,
        this.sdk.identityRegistryAbi,
        agentTokenId,
        "agentName",
        encoder.encode(ens.trim()),
      );
      txHashes.push(txHash);
    }

    return txHashes;
  }

  setActive(active: boolean): this {
    this.registrationFile.active = active;
    return this.touch();
  }

  setX402Support(enabled: boolean): this {
    this.registrationFile.x402support = enabled;
    return this.touch();
  }

  async register(agentURI?: string, metadata?: MetadataEntry[]): Promise<TransactionHandle<RegistrationResult>> {
    const resolvedAgentURI = agentURI ?? "";
    const tx = await this.sdk.submitRegister(agentURI, metadata);

    return new TransactionHandle<RegistrationResult>(tx.txHash, this.sdk.chain, async (receipt) => {
      const parsed = this.sdk.chain.parseRegisteredAgentId(receipt);
      const resolved: RegistrationResult = {
        agentURI: resolvedAgentURI,
        agentId: parsed ? `${this.sdk.chainId}:${parsed}` : undefined,
      };
      this.registrationFile.agentURI = resolvedAgentURI;
      this.registrationFile.agentId = resolved.agentId;
      this.touch();
      return resolved;
    });
  }

  async registerIPFS(): Promise<TransactionHandle<RegistrationResult>> {
    const uri = await this.sdk.uploadRegistrationFile(this.toJSON());
    return await this.register(uri);
  }

  setAgentUri(uri: string): this {
    this.registrationFile.agentURI = uri;
    return this.touch();
  }

  async updateRegistration(agentURI?: string): Promise<TransactionHandle<Agent> | Agent> {
    if (!this.registrationFile.agentId) {
      throw new Error("Agent must be registered before updating");
    }
    if (agentURI === undefined) {
      return this;
    }

    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);
    const txHash = await this.sdk.chain.setAgentURI(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      agentTokenId,
      agentURI,
    );
    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => {
      this.registrationFile.agentURI = agentURI;
      this.touch();
      return this;
    });
  }

  async getWallet(): Promise<string | undefined> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    return this.sdk.getAgentWallet(this.registrationFile.agentId);
  }

  async setWallet(newWallet: string, options: SetWalletOptions = {}): Promise<TransactionHandle<Agent> | undefined> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");

    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);
    const addrEvm = this.sdk.chain.toEvmAddress(newWallet);
    const addrChain = this.sdk.chain.toChainAddress(newWallet);

    const currentWallet = await this.getWallet().catch(() => undefined);
    if (currentWallet && this.sdk.chain.addressEqual(currentWallet, addrChain)) {
      this.registrationFile.walletAddress = addrChain;
      this.registrationFile.walletChainId = this.sdk.chainId;
      this.touch();
      return undefined;
    }

    const ownerChain = await this.sdk.chain.ownerOf(this.sdk.identityRegistry, this.sdk.identityRegistryAbi, agentTokenId);
    const ownerEvm = this.sdk.chain.toEvmAddress(ownerChain) as Hex;
    const deadline = BigInt(options.deadline ?? (Math.floor(Date.now() / 1000) + 60));

    let signature = options.signature;
    if (!signature) {
      signature = await this.sdk.signAgentWalletBinding(
        agentTokenId,
        addrEvm,
        ownerEvm,
        deadline,
        options.newWalletSigner,
      );
    }

    const txHash = await this.sdk.chain.setAgentWallet(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      agentTokenId,
      addrChain,
      deadline,
      signature,
    );

    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => {
      this.registrationFile.walletAddress = addrChain;
      this.registrationFile.walletChainId = this.sdk.chainId;
      this.touch();
      return this;
    });
  }

  async unsetWallet(): Promise<TransactionHandle<Agent> | undefined> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);

    const currentWallet = await this.getWallet().catch(() => undefined);
    if (!currentWallet) {
      this.registrationFile.walletAddress = undefined;
      this.registrationFile.walletChainId = undefined;
      this.touch();
      return undefined;
    }

    const txHash = await this.sdk.chain.unsetAgentWallet(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      agentTokenId,
    );

    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => {
      this.registrationFile.walletAddress = undefined;
      this.registrationFile.walletChainId = undefined;
      this.touch();
      return this;
    });
  }

  async transfer(newOwnerAddress: string, approveOperator = false): Promise<TransactionHandle<Agent>> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);
    const currentOwner = await this.sdk.chain.ownerOf(this.sdk.identityRegistry, this.sdk.identityRegistryAbi, agentTokenId);

    if (approveOperator) {
      await this.sdk.chain.setApprovalForAll(
        this.sdk.identityRegistry,
        this.sdk.identityRegistryAbi,
        this.sdk.chain.toChainAddress(newOwnerAddress),
        true,
      );
    }

    const txHash = await this.sdk.chain.transferFrom(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      currentOwner,
      this.sdk.chain.toChainAddress(newOwnerAddress),
      agentTokenId,
    );

    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => {
      this.registrationFile.walletAddress = undefined;
      this.registrationFile.walletChainId = undefined;
      this.touch();
      return this;
    });
  }

  async addOperator(operator: string): Promise<TransactionHandle<Agent>> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const txHash = await this.sdk.chain.setApprovalForAll(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      this.sdk.chain.toChainAddress(operator),
      true,
    );
    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => this);
  }

  async approve(operator: string): Promise<TransactionHandle<Agent>> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const agentTokenId = BigInt(this.registrationFile.agentId.split(":").pop() as string);
    const txHash = await this.sdk.chain.approve(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      this.sdk.chain.toChainAddress(operator),
      agentTokenId,
    );
    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => this);
  }

  async removeOperator(operator: string): Promise<TransactionHandle<Agent>> {
    if (!this.registrationFile.agentId) throw new Error("Agent must be registered first");
    const txHash = await this.sdk.chain.setApprovalForAll(
      this.sdk.identityRegistry,
      this.sdk.identityRegistryAbi,
      this.sdk.chain.toChainAddress(operator),
      false,
    );
    return new TransactionHandle<Agent>(txHash, this.sdk.chain, async () => this);
  }

  toJSON(): RegistrationFile {
    return { ...this.registrationFile };
  }

  private touch(): this {
    this.registrationFile.updatedAt = Math.floor(Date.now() / 1000);
    return this;
  }
}
