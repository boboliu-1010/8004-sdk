# 8004-sdk

Monorepo for 8004 SDKs.
Current layout includes a Python SDK and a TypeScript SDK.

## Repository Structure

- `python/`: Python SDK (`bankofai.sdk_8004`)
- `ts/`: TypeScript SDK (`@bankofai/8004-sdk`)

## Python SDK

Location:
- `python/`

Entrypoint:
- `from bankofai.sdk_8004.core.sdk import SDK`

Install (local editable):

```bash
cd python
pip install -e .
```

Quick start and chain-specific examples:
- `python/README.md`
- `python/sample/README.md`

## TypeScript SDK

Location:
- `ts/`

Entrypoint:
- `import { SDK } from "@bankofai/8004-sdk"`

Install and build (local):

```bash
cd ts
npm install
npm run build
```

Quick start and chain-specific examples:
- `ts/README.md`
- `ts/examples/README.md`

## Development and releases

The repository uses `develop` for normal integration and `main` for stable
releases. Create ordinary work from `develop` and open `feature/*` pull
requests back to `develop`. Package versions are updated only while preparing
a release or hotfix.

- [Contributing guide](./CONTRIBUTING.md)
- [Branching and release workflow](./BRANCHING.md)

## Subgraph Status

- `loadAgent(agentId)` works today via direct on-chain reads.
- `getAgent()` / `searchAgents()` are index/subgraph-based and are limited until subgraph integration is enabled.
- Full subgraph URL integration is planned for a future update.
