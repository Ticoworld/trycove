# TC-01E Gate C functional composition attempt

## Decision

**TC-01E PARTIAL.** The bounded capability-first attempt produced source-backed query hypotheses, but no candidate had a defensible value proposition. No adapter, consumer/provider execution, positive or negative integration case, or integration receipt was produced. Gate C is incomplete. The stopping rule was followed: no repositories or interface families were added after the frozen cohort.

## Repository baseline and handoff

- Repository: `Ticoworld/trycove`.
- Expected and fetched `origin/main`: `533422e84b652ec73c70c16c4b3bf7bfeba8f952`.
- TC-01E implementation baseline: `511e2a820bbb9b755a8762357c36d6450e648ef2`.
- Local branch at start: `work` at `533422e84b652ec73c70c16c4b3bf7bfeba8f952`; worktree clean and local HEAD equal to `origin/main` after explicit fetch.
- No prior TC-01E report, scan, discovery, adapter or receipt was edited by this attempt. The new evidence is isolated in `evidence/tc-01e/gate-c-functional/`.
- The report is included in the final handoff commit; the exact resulting commit SHA and remote push state are supplied in the delivery summary.

## Frozen discovery and methodology

The capability family and selection rules were frozen at `2026-11-18T09:10:24Z` before examining source matches. The family was CKB read-only transaction and live-cell queries crossing a consumer application boundary into a concrete exported query method or executable query handler. No product pair, issue, or pull request was used for selection.

The inventory reused locally imported CKBdapps repository claims and Pulse snapshots. After excluding pinned repository paths and ambiguous product identities, **27** repositories were eligible; **22** were excluded as already pinned, none were ambiguous. The deterministic SHA-256 ordering selected the first 12. All 12 received full source pins. The cohort artifact retains all claims, exclusions, the selected cohort and revisions, pin results, and the import digests:

| Repository | Pinned revision | Source scan |
|---|---|---|
| `psawyerberlin/vericellnet` | `fb53b7fd43c0801093979d2777a4722caf713d55` | completed |
| `utxoplay/utxoplay` | `8578cbe8bdbfb9023839084601726192220cb70d` | completed |
| `nervosnetwork/fiber-dashboard` | `acad8689b10fd975384b25be8551ef07b6de94e0` | completed |
| `lusocryptolabs/ckb-pulse` | `6d5b3fe20b894e0a7dbdf9259d2acff752088e0a` | completed |
| `nervosnetwork/ckb-script-templates` | `f90b1e2c52de1e60dc6aca437de8f43d7aed9c14` | completed |
| `hiepthach/credora_ckb` | `d5365fd6289f163782b2ee37ae10bfa6aa356e77` | completed |
| `hitbtc-com/hitbtc-api` | `5cca555f8e57b974438e3ccef12604b10c66fb5d` | failed: zero supported source files |
| `nervosnetwork/ckb-explorer-frontend` | `39f93f2d2bd7a682c0d8dffe25192c2db63c7ad9` | completed |
| `rgbplusplus/rgbpp` | `590a2caf791dcbc687cecd71e29d22f496862d8e` | completed |
| `truthixify/vellum` | `87b377d71c10dbbf64d12c93411506268ccf2c9f` | completed |
| `jackylhh/ckb-community-fund-dao-dashboard` | `2971facfc389a9ece85177392199db38621e9804` | completed |
| `quantumpurse/quantum-purse-v2` | `4e66bc738b3330f45c8f9e77c350ce90a1c4d400` | completed |

The frozen method is [discovery-methodology.md](discovery-methodology.md), SHA-256 `10b5541fbd50ed7cd94d487b49173a1e2405e9d45fe94fc069aac477cb8434ac`. The selected cohort and sidecar are [frozen-cohort.json](frozen-cohort.json), SHA-256 `db64b72e991974443ead13ed39c8acb22febec9f95cb52bbff4a1bca867cfe53`.

## Source findings and candidate decision

The final pinned scan used analyzer **2.0.1**. All 12 scanner commands returned successfully; 11 repositories had supported source files and one source inspection failed with zero supported files. The final scan is [source-scan-2026-11-18T09-36-36-582Z.json](source-scan-2026-11-18T09-36-36-582Z.json), SHA-256 `c8b4361cbbfeff697298da771a561c60a6214b6de17f831c2d11eacd8fec5499`.

Analyzer 1.9.1 and 2.0.0 diagnostic scan receipts remain preserved. The 2.0.0 scan was excluded from matching after inherited JavaScript object methods produced false CKB query hits. Version 2.0.1 limits query recognition to own entries in the query-operation map. The corrected scan is the only input to the final matcher result.

Code evidence identified four products with source-observed query calls (VeriCell, Credora, CKB Explorer, Vellum) and four with exported query methods (the same four). The matching pass produced **15 exact-operation hypotheses** and retained **54 operation-mismatch edges**. None met the value requirement. The exact-operation examples were direct `getTransaction`, `getCell`, `getCellLive`, and `findCellsByLock` lookups. The consumers already perform these operations in pinned application paths; the matching provider exports delegated the same low-level query without an evidenced new data source, response contract, indexing guarantee, validation, freshness guarantee, failure reduction, or measurable improvement. Same-owner pairs were also excluded from representing independent builders.

**Chosen candidate: none.** There is no candidate value proposition to justify an adapter. This decision avoids treating an already-available RPC call as a product improvement. All role assessments, source locations and revisions, exact hypotheses, compatibility unknowns, rejection reasons and rejected mismatch edges are retained in [functional-discovery.json](functional-discovery.json), SHA-256 `21d4e6e211dcaa76967e5d99e3a639b5bf927316d5a2082889d068305dda0264`. It records source excerpt hashes and pinned source links; it does not redistribute source excerpts.

The pre-existing Grid3 → CKB Viz URL adapter remains a historical bounded regression example only. It was not reselected or polished as the flagship for this functional attempt.

## Prior art, adapter, and execution

The frozen rule allowed pair-specific prior-art review only after a candidate passed the source and value requirements. No pair passed; therefore no issue/PR search or pair-specific prior-art review was run. Issues and PRs were not used for discovery.

No adapter or configuration change between the selected consumer and provider exists. No consumer or provider application code was executed; upstream source was statically inspected only. Consequently:

- Baseline behavior is source-substantiated: the consumers already make the relevant query calls directly.
- Integrated behavior: none.
- Positive case: none.
- Negative integration case: none.
- Baseline-versus-integrated runtime comparison: none.
- Adapter source, runtime limits, execution hashes and integration receipt: not applicable because no candidate was selected.
- Public CKB RPC, devnet, CKB-VM, transaction construction, signing and broadcasts: not attempted.

There is no integration execution to reproduce independently. A fresh scan or runtime trial was not started after the final analyzer result; repeating the local static matcher would not constitute independent functional reproduction. The discovery command below regenerates the report from the same retained imported database and frozen scan, so that is a repeatable local computation, not an independent reproduction.

## Security and licenses

The source scanner checked out pinned repositories for static analysis; it did not execute imported repository code. There were no credentials, wallets, production secrets, service requests, or broadcasts. No third-party source or generated bundle is retained in this report or adapter. The report keeps Trycove-authored facts, source line links, immutable revisions and hashes of the extracted snippets.

License metadata was checked at the frozen revisions through GitHub's repository license endpoint. MIT metadata was identified for CKB Pulse, CKB Explorer, Vellum and Quantum Purse; LGPL-3.0 metadata for HitBTC API; GitHub did not identify a repository license file for the other seven repositories. These are metadata results, not a review of full license texts or an integration permission grant. Because no candidate was selected, no source was integrated or redistributed. The complete record is [license-review.json](license-review.json), SHA-256 `520adf38e99b84a2c0552b5a1a3d6455d8834b8063afb2bbf508f8f3e1086813`.

## Product UI result

The Product Passports for the frozen cohort now link to `/functional-discovery?product=<id>`. The page shows the source-backed role assessment, exact consumer/provider interface lines, revisions, compatibility unknowns and rejection reasons. It explicitly says no adapter or execution receipt exists for this attempt. The journey stops at the no-candidate result; it does not claim the historical Grid3 receipt as evidence for this attempt. A reduced, code-free projection at [functional-discovery-ui.json](functional-discovery-ui.json), SHA-256 `5a129da2fb222fec769b87079fb65f1ba8fb38712f0ec9e39d0eb0d2430f78d4`, is statically imported by both routes and appears in their Next.js production file traces.

The production Next.js server-rendered journey assertions passed for `/projects/vericell` → `/functional-discovery?product=vericell`. Receipt [ui-journey-2026-11-18T10-04-02-892Z.json](ui-journey-2026-11-18T10-04-02-892Z.json), SHA-256 `d893bc23902e61d46abb6293251535671a43a5b2aab5e5f6d1b851847c43c082`, includes response-content assertions for the Product Passport link, no-candidate state, rejected source interface, and empty execution evidence. The browser controller could not initialize (`the gaas-browser node_repl sandbox cannot be disabled`), so a visual browser inspection was blocked. The server-rendered checks prove more than route availability, but do not replace that visual inspection. The UI does not execute imported source.

## Reproduction and environment

```sh
pnpm tc01e:freeze:functional -- --verify
pnpm tc01e:discover:functional -- --scan evidence/tc-01e/gate-c-functional/source-scan-2026-11-18T09-36-36-582Z.json
pnpm exec vitest run tests/footprint.test.ts tests/data-query-connections.test.ts --maxWorkers=1 --minWorkers=1 --testTimeout=15000
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --testTimeout=15000
pnpm exec tsc --noEmit
pnpm build
pnpm migrate
pnpm tc01e:smoke:functional
```

Executed for this handoff: the frozen-cohort integrity check passed; the full serialized suite passed **22 files / 132 tests**; `tsc --noEmit` passed; the production build passed; and `pnpm migrate` applied all 14 versioned migrations to PGlite. The focused capability tests passed 17 tests. The existing `pnpm tc01e:verify:journey` verification passed and confirmed the historical Grid3 receipt and database evidence remained intact. The prior-product route smoke passed its five existing routes at [route-smoke-2026-11-18T10-04-04-340Z.json](../ui/route-smoke-2026-11-18T10-04-04-340Z.json), SHA-256 `065b62f62770105cc877199a74ba6bfa8d7433aa8a1aef851256aec94cc55c3e`. The new functional discovery server-rendered route assertions passed at the receipt linked above. Browser-level visual inspection remained blocked by the browser controller initialization error.

The scanner ran in the current Trycove development environment with bounded clones, a fixed repository/revision cohort and static TypeScript analysis. Node was v24.22.1; pnpm was v11.25.0. The local imported inventory used PGlite. `DATABASE_URL` was not configured and no PostgreSQL server was available, so PostgreSQL behavior and production-database readiness are unverified.

## Remaining unknowns

- Other functional families such as transaction construction, validation, sessions, or off-chain services were not evaluated; this was intentionally one bounded query-family attempt.
- Static analysis does not prove runtime reachability, package publication, deployment availability, live network identity, response semantics, freshness, finality, security properties, adoption, or user value.
- No provider-specific interface compatibility was executed because no value-qualified candidate existed.
- Full third-party license texts and integration permissions were not reviewed for a prospective adapter.
- Independent functional reproduction is unavailable without a selected integration to execute.
- TC-02 and TC-03 still require genuine implementation, human participation and outcome evidence. This result does not establish readiness for Tovarishch.

## Gate assessment

| Gate | Verdict | Evidence and limit |
|---|---|---|
| A — Product intelligence and inventory | **PASS** | Reused the imported CKBdapps/Pulse inventory and Product Passports; selected pins, scans and role evidence are retained. Local DB verification uses PGlite, not PostgreSQL. |
| B — Capability-first connection | **PARTIAL** | The bounded matcher found 15 source-backed exact-operation hypotheses and retained 54 rejected mismatch edges. No connection demonstrated product-specific value. |
| C — Functional execution | **PARTIAL** | No candidate passed the value gate. Consumer/provider execution, adapter, positive/negative behavior and functional comparison are absent. |
| D — Product journey and evidence | **PARTIAL** | The no-candidate finding is rendered from Product Passport into source-linked discovery evidence. No new Integration Lab receipt can be shown because there is no integration to execute. The previous Grid3 URL journey remains separate historical evidence. |

The milestone verdict is **TC-01E PARTIAL**. This bounded attempt is complete and stopped; a meaningful functional composition was not demonstrated.
