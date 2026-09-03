# ERC-8004 registration-v1 fixtures

These synthetic, offline fixtures exercise the canonical agent registration
fields described by
[`ethereum/ERCs@98469bc93b6add1e3bc9501dafaa73311071145b`](https://github.com/ethereum/ERCs/blob/98469bc93b6add1e3bc9501dafaa73311071145b/ERCS/erc-8004.md#agent-uri-and-agent-registration-file).

Both the Python and TypeScript test suites load these files. The assertions
cover semantic compatibility across SDKs rather than byte-for-byte JSON
equality.

`tron-extensible-services.json` covers the Final
[`TRC-8004`](https://github.com/tronprotocol/tips/blob/master/tip-8004.md)
registration type and TRON Base58 registry address representation.
