# TC-01E implementation and evidence report

Checked 2026-11-17. Baseline commit: `21708af1d2cfe19e420d84d67f51f5c8fb64550e`. TC-01E work was advanced in coherent commits through `66dc6e5386aff4da6807730ad5ba9f13b7fd0975`; the final implementation commit is recorded in the repository handoff.

## Product intelligence and frozen discovery

The Product Hub contains 231 imported project identities, 150 CKBdapps JSON source records and 106 retained CKB Pulse repository-detail snapshots. Its database currently holds 81 pinned footprints and 355,230 footprint observations across the retained history. The imported data remains source-backed and distinguishes Pulse activity from verified behavior or adoption. Import snapshots are under `evidence/tc-01e/sources/`.

Discovery used a hash-selected, frozen cohort of 12 repositories (`product-source-cohort.json`, SHA-256 `0851d127fa5c5b9a2f718c2b556fea76162a3da2ff80e81770e0d479553a9365`). The selection was frozen before source inspection. The pinned 1.9.1 scan completed all 12 repositories and retained 90,238 observations (`source-scan-2026-11-17T21-20-55-451Z.json`, SHA-256 `78dd42bcf83a4957b96bcf527b19bb221e478f9ee446cfb3ac2a34270c26c774`).

The generic, pair-agnostic transaction-link matcher received those stored observations without a target pair. It found one candidate and retained role assessments for all 12 products. Grid3 met the consumer requirements with a source-observed transaction submission, existing explorer links and explicit testnet configuration. CKB Viz met the provider requirements with a network-scoped URL builder, a route parser that validates 32-byte hashes, and a mainnet/testnet type contract. Other products lacked the complete consumer or provider interface evidence. Shared CCC usage and similar descriptions do not produce a match. The selected candidate is `b2032ed152e5f87e4691d7376a1b24c0a2b0a2ebbcb77452679397476061f533`.

This is a narrow supported interface family, not general-purpose source-code understanding. Both repositories have the same GitHub owner (`truthixify`), which is a relationship-bias risk. The existing Pudge explorer is a viable alternative; the evidence does not establish that CKB Viz is better for every user task.

## Candidate and prior-art finding

The engine-generated hypothesis is **Grid3 → CKB Viz**: adapt Grid3's existing transaction-view link to CKB Viz's read-only `/tx/<hash>?network=<network>` flow view. Relevant immutable source observations are recorded in the discovery report and the saved opportunity. The user-visible boundary is a browser URL only. There is no shared signer, transaction builder, contract, or protocol integration.

After candidate generation, eight bounded GitHub Search API queries checked indexed issue/PR titles, bodies and comments in the two repositories. All eight were available and returned zero results at 2026-11-17 21:44 UTC. That is a limited prior-art search, not proof that no proposal or integration exists elsewhere. The reports preserve an earlier malformed-query failure as well as the corrected query run.

The opportunity was saved as `tc01e-b2032ed152e5f87e4691d7376a1b24c0`. Eight search observations, five source observations and a follow-up finding are attached through the existing evidence and follow-up tables. No maintainer was contacted.

## Isolated execution

The adapter contract and implementation are in `experiments/tc01e/transaction-inspector/adapter.ts`; the fixed source/runtime profile and reproduction steps are alongside it. The runner checks the frozen cohort, scan and discovery digests, candidate identity, both repository origins and full revisions, a clean checkout, all reviewed source-file digests, the adapter and fixture digests, and the runtime image. It executes only the fixed local profile from a developer CLI, never from a web request.

The isolated container executed Grid3's pinned `constants.ts` and CKB Viz's actual URL builder, parser and hash validator through the Trycove adapter. The positive case preserved the testnet hash in the CKB Viz route. Four negative checks rejected malformed hashes, unsupported devnet, rewritten routes and malformed provider routes. The run passed these URL-boundary cases.

Fixture value `0xc1fdf9c24c256df4cc391c02509a8448555b43506401610085231f6deca97211` is declared in Grid3 source as `SCRIPT_CELL_DEP.outPoint.txHash`. It is a real source-declared CKB transaction-hash value, but it is **not** claimed to be a transaction emitted by Grid3 or independently confirmed on chain. The experiment did not execute Grid3's React signer hook or game page, call CKB RPC, open the hosted CKB Viz deployment, sign, broadcast, or validate a public-chain transaction.

Receipt `evidence/tc-01e/execution/tc01e-grid3-ckb-viz-transaction-inspector-2026-11-17t21-55-42-207z.json` records the exact container command, source hashes, bundle hash, outputs, limits and failure cases. Runtime: Docker 29.9.2 in rootless mode; pinned `node:24-alpine` image digest; Node v24.22.3; esbuild 0.28.2; no network; read-only root and input mounts; no capabilities; UID 1000; 128 MiB, 1 CPU, 32 processes and a 20 second timeout. The unlicensed upstream modules were bundled only in transient private staging and removed after execution; no upstream code was committed or retained in the receipt.

The receipt result is `passed` for the tested URL interface. Its overall integration-gate assessment remains `partial`: no real Grid3-produced transaction, live CKB Viz runtime, RPC result or external reproduction was verified. GitHub license metadata was `null` and neither pinned repository had a root license file; the exact license limitation is retained in the profile and receipt.

## User-facing journey

The Product Hub links to Grid3 and CKB Viz Product Passports. Those Passports prioritize the source-observed link, network and route interfaces and link to the saved connection. The Opportunity Workspace shows the inferred value, exact boundary, adapter contract, compatibility findings, source evidence, bounded prior-art follow-up, next experiment and execution receipt. The Integration Lab page exposes the receipt and links to the adapter source.

Production HTTP smoke evidence is `ui/route-smoke-2026-11-17T22-02-44-871Z.json` (SHA-256 `4dde40fc6457b5ab001abe198adcfbce0eff61e8fe78825a8c67a926584afe39`). All five checked routes returned HTTP 200 and contained the required product, interface, opportunity, evidence and receipt content. Earlier failed route-smoke reports are preserved; the Passport evidence-priority defect they exposed was corrected before the passing run.

Database verification used local PGlite, not PostgreSQL. The corrected verification command confirms the frozen discovery inputs, persisted candidate, evidence and follow-up rows, latest receipt digest, existing trial record and retained earlier receipts. External outcome remains `NO_EXTERNAL_PARTICIPATION_VERIFIED`.

## Verification commands

```sh
pnpm migrate
pnpm tc01e:discover:products -- --scan evidence/tc-01e/source-scan-2026-11-17T21-20-55-451Z.json --persist
pnpm tc01e:run:transaction-inspector -- --source-root /tmp/tc01e-upstream
pnpm tc01e:verify:journey
pnpm exec vitest run --maxWorkers=1 --minWorkers=1 --testTimeout=15000
pnpm exec tsc --noEmit
pnpm build
pnpm start --hostname 127.0.0.1
pnpm tc01e:smoke:journey
```

The full suite passed: 21 test files, 126 tests. The repository's default five-second test timeout was too short for two PGlite migration tests under parallel load; both passed in the serialized 15-second run. TypeScript and the production build passed. All 14 versioned migrations applied to PGlite. PostgreSQL behavior remains unverified.

## Acceptance assessment

| Gate | Verdict | Evidence and limit |
|---|---|---|
| A — Product intelligence and imports | **PASS** | Real CKBdapps and Pulse snapshots, deterministic repository cohort, pinned source observations and source-attributed Product Passports are retained and rendered. Database verification used PGlite. |
| B — Capability-first connections | **PASS** | One candidate emerged from the frozen cohort without a target pair. The exact source interfaces and network boundary support a useful read-only link hypothesis; prior-art search remains bounded, and product value is not independently measured. |
| C — Executable integration proof | **PARTIAL** | Actual pinned modules from both repositories and the Trycove adapter passed five isolated URL cases. No Grid3 signer-produced transaction or live provider/chain behavior was executed. |
| D — Connected product journey | **PASS** | Product Hub → both Product Passports → saved Opportunity Workspace → actual receipt works in production-mode HTTP checks. The UI shows source interfaces and the adapter rather than only a candidate count. |

TC-01E is **not complete** because Gate C is partial. This is suitable for a preliminary demonstration of product discovery, a source-backed link hypothesis and its bounded interface trial. It is not a claim of live CKB compatibility, integration adoption, Trial Rooms, or readiness for the full Tovarishch presentation.
