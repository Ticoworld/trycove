# TC-01C Part 1 execution report

Checked 2026-11-17 in Codex Cloud. Starting revision was `61026b5dde97cab915fbdcb61ac3f0db4aafe0f7`; the working tree was clean, and `origin/main` pointed to that same commit before work began.

## Verdict

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A — current-state and prior-art verification | **PARTIAL** | The reusable verifier refreshes repository heads, selected current code, cited source pages, merged-PR/release pages and capability/alias GitHub issue searches. Twine's implementation was retrieved at `274ecf42890eeff5abd60e70240240d34ac10f83`. The cited Nervos Talk and Teapaw report bodies were inaccessible through the configured proxy (CONNECT 403), so the reported Cellula-to-Cellula testnet trade cannot be independently confirmed here; freshness remains partial and compatibility unknown. Cellora's older review offer is recorded as requiring reconfirmation, not withdrawn. |
| B — executable Explorer/cycle-tools integration | **PASS — offline script-group execution** | Pinned `Explorer.rawTransaction()` data flowed through the pinned `ckb-cycle-tools` grouping and replay functions into the real `ckb-debugger` WASM. The receipt records two measured script groups, a real lock-script rejection after a 1-shannon mutation and rejection when resolved CellDeps were removed. The same command reproduced the checked-in receipt SHA. This is not fresh chain acceptance. |

**TC-01C Part 1 overall: PARTIAL**, because both gates are required and Gate A remains incomplete.

## Gate A: current state and prior art

`lib/intelligence/current-state.ts` implements candidate- and capability-scoped checks with bounded requests, a six-hour conditional cache, ETags, per-source timestamps and hashes, current GitHub refs, relevant source files, merged pull requests, releases, cited issues/discussions, and alias/concept searches. It treats failed checks as unresolved/partial rather than negative evidence. Lifecycle and technical compatibility are persisted separately; each run and its evidence are append-only. Human collaboration offers are not treated as software capabilities.

The Twine regression check at `evidence/current-state/cellula-lsp-invoice-routing-20261117T014427657Z.json` checked 16 sources: 14 were fetched and the Talk and Teapaw sources remain blocked. The accessible Twine code at the reported current revision contains:

- `src/fiber/hint.rs`: `TrampolineRouteHint` invoice parsing and Cellula payment-link handling. The source itself says the local fallback does not validate the invoice signature.
- `src/fiber/hint.rs` test around lines 368–391: a parser test references a captured Cellula Testnet invoice; it tests parsing, not settlement.
- `src/fiber/payment.rs`: explicit trampoline-hop payment construction and a `dry_run` route probe. This code does not establish a successful payment.

The state is therefore preserved as the task-supplied, maintainer-reported `demonstrated_in_wild` prior event, with **partial freshness** and **unknown compatibility**. The specific successful trade described in the inaccessible public report is not independently verified. There is no evidence of production readiness, an independently repeated payment, external adoption, or support for all Cellula capabilities. The next action is a bounded test of the exact payment path in an authorized test environment.

The independently selected Cellora review-offer check is recorded at `evidence/current-state/ckb-indexing-architecture-review-offer-20261117T014436169Z.json`. CKBuilder issue #12 was updated 2026-04-28 and offers a 20-minute architecture discussion for builders with substantial indexing needs. Current state is `stale_offer`: the public offer needs reconfirmation; age does not imply withdrawal. Its technical compatibility is unknown.

The Explorer/cycle-tools current-state run is at `evidence/current-state/explorer-script-group-cycle-analysis-20261117T014443527Z.json`. Current heads, cited issue and code, merged PR pages and release pages were checked. Two GitHub issue-search requests returned HTTP 429, so that run remains partial; the denial is recorded and cached.

## Gate B: reproducible offline execution

The adapter is intentionally small and reuses both pinned implementations:

1. A localhost JSON-RPC fixture server supplies one archived real Testnet `get_transaction` response.
2. Explorer `Explorer.rawTransaction()` at `b6aef5571bbe5a112b4809881a1b6229095f6da7` fetches it through its actual RPC code path. The raw transaction is deep-equal to the archived transaction.
3. `groupsOf` and `replayGroups` from ckb-cycle-tools at `23182e2abce64d0574cae7acd3229bc87424d0d0` build and execute the actual groups using that repository's `wasmRunner` and ckb-debugger WASM.
4. The fixture supplies resolved input Cells and CellDeps. Its recorded VM is CKB-VM v2. Removing the CellDeps produces a debugger error, not a cycle measurement.

The pinned runtime in the receipt is Explorer 0.4.0, ckb-cycle-tools 1.3.0, `@ckb-ccc/core` 1.23.0, ckb-testtool 1.0.5, WASI shim 0.4.2, TSX 4.23.15, ckb-debugger 0.200.1, and Node 24.22.3 inside the pinned `node:24-alpine` image. Host checks reported Node v24.22.1, pnpm 11.25.0 and Docker Server 29.9.2. Execution was containerized with no network, read-only root, dropped capabilities, no-new-privileges, resource limits, and no wallet or broadcast.

Receipt: [`execution.json`](ckb-explorer-cycle/execution.json), SHA-256 `260ccf5de3c7b295d20e3c482246e0c97ab9dec17358edd6332549ee7426aeec`.

| Case | Actual observation |
| --- | --- |
| Archived valid fixture | `input.0.lock`: **1,652,198 cycles**, result 0. `input.0.type`: **14,022,840 cycles**, result 0. Sum **15,675,038**, matching the fixture's archived node aggregate. |
| Output capacity increased by 1 shannon | Real lock group rejected with result **-31**. The independently executed type group passed; this does not make the mutated transaction valid. |
| Resolved `mock_info.cell_deps` removed | ckb-debugger exited 1 with `tx.cell_deps[0] used unprovided cell dep`; no measurements are trusted. |

These are offline per-script-group executions against an archived fixture. The local fixture server is not a CKB node, and a group replay is not new consensus validation or public-chain acceptance.

The execution was run against pre-existing local clones already at the exact pins. Reproduce from clean upstream checkouts with:

```sh
pnpm experiment:ckb-cycle:prepare
pnpm experiment:ckb-cycle
```

The runner checks both exact Git revisions, uses the checked-in fixture and container image digest, refuses to overwrite a different receipt, and writes a SHA-256 sidecar. Both upstream repositories are MIT licensed; their license files are preserved under `experiments/ckb-explorer-cycle/licenses/`.

The cold clone and npm-install preparation command was not rerun in this execution; the checked-out sources and dependencies were already present. The repository includes that preparation script and lockfile-pinned revision checks.

## Product and persistence

The Opportunity Workspace displays capability lifecycle, freshness, compatibility, last check, source requests and failures, evidence excerpts and hashes, and verification history. It links the cross-project receipt and renders the full receipt on its trial page with the offline limitation. Production server smoke checks returned HTTP 200 for the Twine opportunity, Cellora offer, Explorer/cycle-tools opportunity and saved trial receipt; page responses contained the expected lifecycle text and cycle values.

The existing PGlite database was preserved. Before this work it contained 230 projects, 48 opportunities, 269 evidence rows, 4 trial runs, 4 trial receipts, 45 technical footprints and 84,548 footprint observations. It now contains 231 projects, 49 opportunities, 274 evidence rows, 5 trial runs, 5 receipts, 45 footprints and 84,548 observations, plus 3 candidate capabilities, 9 lifecycle-verification runs and 19 lifecycle evidence records. No PostgreSQL service or `DATABASE_URL` was available in this execution; migration 0008 was tested with PGlite, including a repeatable migration test. The earlier PostgreSQL 17 check covered the six preceding migrations.

## Checks

- `pnpm test`: **12 files, 67 tests passed**. Vitest now excludes `.data` so pinned upstream checkouts do not get mistaken for Trycove's test suite.
- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm build`: passed on Next.js 15.5.29.
- `pnpm migrate`: passed; migration 0008 also passed repeatability and persistence tests.
- `pnpm experiment:ckb-cycle`: passed and reproduced receipt SHA-256 `260ccf5d…6aeec`.
- Production Opportunity Workspace and trial receipt smoke checks: all four routes returned HTTP 200 with expected saved content.

## Remaining work

- Gate A needs successful access to and attribution of the cited Twine public demonstration report, plus a later fresh source check. Until then, its lifecycle state is a preserved attributed report, not independent confirmation.
- No testnet payment was executed for Twine × Cellula. No maintainer was contacted.
- Gate B proves archived offline script execution and per-group measurements, not current chain state, end-to-end node validation, signing/submission, production compatibility, or adoption.
- A live PostgreSQL test of migration 0008 was unavailable.
