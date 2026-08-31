# Official EVM ABI Synchronization Design

## Goal

Synchronize the TypeScript SDK's EVM registry interfaces with the upstream
`erc-8004/erc-8004-contracts` ABIs at commit
`b9e466c250744a7e06b13dff9d3c2844ed64f825`, without changing the existing
TRON contracts, addresses, chain IDs, or adapter behavior.

## Scope

This change updates the Identity, Reputation, and Validation Registry ABIs used
by the TypeScript EVM path. It also removes the TypeScript Validation ABI
workaround after the bundled ABI provides the official return shape.

The change does not add more EVM networks, change Registry addresses, alter the
public SDK API, modify TRON ABIs, update the Python SDK, or begin CLI
implementation. Python ABI synchronization is deferred to a separate change and
does not block the TypeScript CLI.

## Upstream Source

The authoritative inputs are:

- `abis/IdentityRegistry.json`
- `abis/ReputationRegistry.json`
- `abis/ValidationRegistry.json`
- `scripts/addresses.ts`

from `https://github.com/erc-8004/erc-8004-contracts` at the pinned commit above.
The BSC mainnet and testnet addresses already match upstream and remain
unchanged.

## ABI Changes

The synchronized EVM ABI must include the exact official function and event
signatures. Regression coverage must specifically protect these known drift
points:

- `approve(address,uint256)`, not `approve(uint256,address)`.
- `ResponseAppended(uint256,address,uint64,address,string,bytes32)`.
- `getValidationStatus(bytes32)` returning
  `(address,uint256,uint8,bytes32,string,uint256)`.

All other official functions and events are copied as published, including
standard ERC-721 and upgradeability interfaces. Keeping the complete ABI avoids
future consumers receiving a different interface depending on whether they use
the SDK resource or the upstream artifact.

## TypeScript Package Integration

`ts/resource/contract_abis.json` remains the runtime source. Only the
`bsc.abi.identityRegistry`, `bsc.abi.reputationRegistry`, and
`bsc.abi.validationRegistry` arrays are replaced. The `tron` object is retained
byte-for-byte.

`ts/src/core/chains.ts` stops defining `VALIDATION_STATUS_ABI` and uses the ABI
passed to `EvmAdapter.getValidationStatus()`. Its public tuple return type stays
unchanged.

## Verification

Tests validate ABI signatures rather than full JSON formatting. The TypeScript
suite asserts the three known drift points and ensures the TRON ABI still
exposes its existing Registry methods. It additionally exercises
`getValidationStatus()` with the bundled ABI so removal of the workaround cannot
silently restore the old return shape.

The completion gate is:

- TypeScript tests, typecheck, and build pass.
- A deterministic signature comparison reports no missing or altered official
  EVM functions/events for all three registries.
- The TRON ABI portion of `contract_abis.json` is unchanged from the branch base.
- No files under `python/` are modified.

## Release Impact

This is a backward-compatible TypeScript SDK patch. Existing public method
signatures and contract addresses remain stable. The resulting TypeScript SDK is
suitable as the base for the planned BSC + TRON CLI. The Python package version
and contents remain unchanged.
