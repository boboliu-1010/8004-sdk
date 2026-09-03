export type ChainType = "evm" | "tron";

export interface ExternalSigner {
  address: string;
  signTransaction(transaction: Record<string, unknown>): Promise<string | Record<string, unknown>>;
  signMessage?(message: unknown): Promise<`0x${string}`>;
  signTypedData?(typedData: Record<string, unknown>): Promise<`0x${string}`>;
}

export interface SDKConfig {
  chainId?: number;
  rpcUrl?: string;
  network: string;
  signer?: string | ExternalSigner;
  feeLimit?: number;
  subgraphUrl?: string;
  subgraphOverrides?: Record<number, string>;
  ipfsUploader?: (json: string) => Promise<string>;
}

export interface RegistrationResult {
  agentId?: string;
  agentURI: string;
}

export interface MetadataEntry {
  metadataKey: string;
  metadataValue: `0x${string}`;
}

export interface SetWalletOptions {
  newWalletSigner?: string | ExternalSigner;
  deadline?: number;
  signature?: `0x${string}`;
}

export interface GiveFeedbackParams {
  agentId: string | number;
  value: number;
  reviewerSigner?: string | ExternalSigner;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: `0x${string}`;
}

export interface FeedbackRecord {
  agentId: string;
  reviewer: string;
  feedbackIndex: number;
  value: number;
  valueDecimals: number;
  tag1: string;
  tag2: string;
  isRevoked: boolean;
}

export interface OnChainFeedbackRecord extends FeedbackRecord {
  feedbackIndex: number;
}

export interface ReputationSummary {
  agentId: string;
  count: number;
  summaryValue: number;
  summaryValueDecimals: number;
  averageValue: number;
}

export interface ValidationRequestParams {
  validatorAddress: string;
  agentId: string | number;
  requestURI: string;
  requestHash?: `0x${string}`;
}

export interface ValidationResponseParams {
  requestHash: `0x${string}`;
  response: number;
  responseURI?: string;
  responseHash?: `0x${string}`;
  tag?: string;
}

export interface ValidationStatus {
  validatorAddress: string;
  agentId: string;
  response: number;
  responseHash: `0x${string}`;
  tag: string;
  lastUpdate: number;
}

export interface ValidationSummary {
  agentId: string;
  count: number;
  averageResponse: number;
}

export interface AppendResponseParams {
  agentId: string | number;
  clientAddress: string;
  feedbackIndex: number;
  responseURI: string;
  responseHash?: `0x${string}`;
}

export interface FeedbackSummary {
  id: string;
  agentId: string;
  reviewer: string;
  feedbackIndex: number;
  value: number;
  valueDecimals?: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  isRevoked?: boolean;
  createdAt?: number;
}

export interface FeedbackSearchFilters {
  agentId?: string;
  agents?: string[];
  reviewers?: string[];
  tags?: string[];
  capabilities?: string[];
  skills?: string[];
  tasks?: string[];
  names?: string[];
  minValue?: number;
  maxValue?: number;
  includeRevoked?: boolean;
  keyword?: string;
}

export interface FeedbackSearchOptions {
  first?: number;
  skip?: number;
  orderBy?: "createdAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
}

export interface TxWaitOptions {
  timeoutMs?: number;
  pollMs?: number;
  throwOnRevert?: boolean;
}

export interface TxMined<T> {
  receipt: unknown;
  result: T;
}

export interface RegistrationFile {
  registrationType?: string;
  agentId?: string;
  agentURI?: string;
  walletAddress?: string;
  walletChainId?: number;
  name: string;
  description: string;
  image?: string;
  endpoints: Array<{ name: string; endpoint: string; version?: string }>;
  registrations?: Array<{ agentId: number; agentRegistry: string }>;
  tags: string[];
  metadata: Record<string, unknown>;
  supportedTrust: string[];
  active: boolean;
  x402support: boolean;
  updatedAt: number;
}

export interface ChainContracts {
  identityRegistry: string;
  reputationRegistry: string;
  validationRegistry: string;
}

export interface AgentSummary {
  id: string;
  agentId: string;
  chainId: number;
  tokenId: number;
  name?: string;
  description?: string;
  image?: string;
  agentURI?: string;
  active?: boolean;
  x402support?: boolean;
  updatedAt?: number;
}

export interface SearchFilters {
  name?: string;
  active?: boolean;
  x402support?: boolean;
  keyword?: string;
}

export interface SearchOptions {
  first?: number;
  skip?: number;
  orderBy?: "updatedAt" | "createdAt" | "name";
  orderDirection?: "asc" | "desc";
}
