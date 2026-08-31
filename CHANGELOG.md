# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Added the `develop` integration branch and enforced feature, release, and
  hotfix pull request routes.
- Documented synchronized TypeScript and Python version preparation on release
  and hotfix branches.
- Corrected the TypeScript lockfile package metadata to the existing `1.1.1`
  package version.
- Extended CI to `develop` and kept automatic Audit disabled by default while
  preserving the authorized `/audit-pr` workflow.
- Limited Audit archives to tracked, non-symbolic-link files.

## [1.1.1] - 2026-02-11

### Fixed
- **Packaging (TS)**: Included missing `resource/`, `README.md`, and `LICENSE` files in the published TypeScript package. This ensures contract ABIs and chain configurations are available at runtime.
- **CI**: Fixed Python CI workflow to correctly handle environments with no tests and improved overall build stability.

### Changed
- **Parity**: Synchronized version to `1.1.1` across both TypeScript and Python SDKs.

## [1.1.0] - 2026-02-11

### Added
- **Enhanced Agent Management**: Added `transfer`, `addOperator`, and `removeOperator` to the `Agent` class for easier lifecycle control.
- **On-Chain Metadata**: New `updateOnChainMetadata` and `updateRegistration` methods allow updating agent details after initial registration.
- **IPFS Support**: Integrated `registerIPFS` and `ipfsUploader` hook for seamless agent card hosting.
- **Hydration**: Added `loadAgent` to the `SDK` to fully restore agent objects from on-chain and off-chain data.
- **Reputation Extensions**: Introduced `appendResponse` for agents to reply to feedback and `revokeFeedback` for reviewers to retract ratings.
- **Advanced Discovery**: Added `searchFeedback` to the `SDK` and `SubgraphClient` with support for complex filters (tags, value ranges, capabilities).
- **Parity**: Synchronized all new features across TypeScript and Python SDKs.

### Changed
- Improved `setWallet` flow with better signature handling and error reporting.
- Refined `Agent` class with helper methods like `setENS`, `removeEndpoint`, and `updateInfo`.

### Fixed
- Fixed various minor inconsistencies in chain adapter implementations for EVM and Tron.
- Corrected type definitions and improved ESM compatibility in the TypeScript SDK.

## [1.0.0] - 2026-02-11

### Added
- **Core SDK**: Initial stable release of the 8004 SDK for Python and TypeScript.
- **Multi-Chain**: Support for `eip155` (EVM) and `tron` (Nile, Shasta, Mainnet) architectures.
- **Identity**: Implementation of `register`, `setWallet`, and `getAgentWallet` flows.
- **Reputation**: Added `giveFeedback`, `getFeedback`, and `getReputationSummary` with support for decimal values and dual-tagging.
- **Validation**: Introduced `validationRequest`, `validationResponse`, and `getValidationStatus` for agent-specific verification flows.
- **Discovery**: Integrated `AgentIndexer` for searching agents across supported networks.
- **Shared Resources**: Centralized `chains.json` and contract ABIs in `resource/` directory.
- **Examples**: Comprehensive smoke tests and usage samples in `ts/examples` and `python/sample`.
