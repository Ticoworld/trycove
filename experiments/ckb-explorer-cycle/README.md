# Explorer × cycle-tools offline experiment

This experiment is an offline script-group replay, not a new chain transaction or a public-chain acceptance claim. It exercises the pinned Explorer `rawTransaction()` method against a localhost JSON-RPC fixture server and passes that exact transaction with the upstream fixture's resolved Cells and CellDeps into the pinned cycle-tools `groupsOf()` and `replayGroups()` workflow. The pinned ckb-debugger WebAssembly binary executes the real scripts.

The archived transaction fixture comes from `ckb-cycle-tools`'s `test/fixtures/replay-testnet.json.br`, at revision `23182e2abce64d0574cae7acd3229bc87424d0d0`. It is copied here unchanged and SHA-256 checked before every run. The upstream fixture's record includes input Cells, script CellDeps, headers, VM version and the node's historical aggregate measurement. A localhost service returns only the fixture transaction to Explorer's real JSON-RPC client; it does not create cells or cycle results.

## Run

Requirements: Node.js 24, npm, Git, Docker, and the pinned `node:24-alpine` image already available locally. `prepare` obtains the public MIT-licensed sources and installs the exact lockfile dependencies with install scripts disabled. The run command starts a no-network, read-only container with bounded memory, CPU and process count.

```sh
scripts/prepare-ckb-cycle-experiment.sh
scripts/run-ckb-cycle-experiment.sh
```

The runner rejects source revision, fixture hash, debugger hash, VM version, field-preservation, valid-case, and invalid-case mismatches. For the missing-CellDeps case it accepts only the expected ckb-debugger `used unprovided cell dep` failure; an unexpected returned profile or unrelated harness error aborts receipt generation. Its JSON receipt is written to `evidence/ckb-explorer-cycle/execution.json`.

## Pinned upstreams

- [CKB Devnet Explorer](https://github.com/wildanrhmn/ckb-devnet-explorer), revision `b6aef5571bbe5a112b4809881a1b6229095f6da7`; `src/explorer.ts:365-369` implements `rawTransaction()`.
- [ckb-cycle-tools](https://github.com/luongthanhtung03/ckb-cycle-tools), revision `23182e2abce64d0574cae7acd3229bc87424d0d0`; `src/replay.ts` implements grouping and replay; `src/wasm.ts` uses the ckb-debugger WASM runtime.

Both source repositories include MIT notices, preserved in `licenses/`. The experiment does not submit a transaction, use a wallet, contact maintainers, or treat per-group execution as a whole-transaction node verdict.
