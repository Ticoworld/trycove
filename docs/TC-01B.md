# TC-01B implementation and evidence

This is a continuation of the existing TC-01 repository. The work adds versioned source footprints, a conservative corpus discovery pass, persisted assessment findings, project and opportunity UI, and isolated trial receipts. It does not claim that the engine found a new viable integration.

## Acceptance gates

| Gate | Verdict | Evidence |
| --- | --- | --- |
| A. Source intelligence | PARTIAL | The existing CKBDapps and CKBuilder imports, including public issue-body extraction, remain available. A bounded TypeScript AST analyzer now records revision-pinned imports, local calls and signatures, exported interfaces, transaction operations, retry loops, selected CKB dependency lock versions and selected JSON network/script claims. The five-project CKBuilder needs batch analyzed 21,941 observations across 15 imported needs. Test code was excluded from the source scan. Rust syntax and YAML semantics are not analyzed, and network, deployment, signer and script identity are not inferred from declarations. |
| B. Connection discovery | PARTIAL | Discovery now consumes imported needs and immutable source observations rather than project name/category matches. A held-out five-project batch at pinned revisions surfaced one false match: CKAutomata to the CKB devnet explorer, due to generic `transaction` evidence from a test file. That candidate was retained as `needs-review`; after excluding test files and generic names, the same batch produced zero candidates. No independently investigated new opportunity survived. Semantic synonyms, broader architecture inference and a larger candidate review remain unfinished. See the [source-level rejection](../evidence/tc01b-rejected-candidate.md), [initial run](../evidence/tc01b-needs-batch.json) and [filtered rerun](../evidence/tc01b-needs-filtered.json). |
| C. Product workflow | PARTIAL | Project pages show stored footprints and source observations. Project footprint detail pages expose pinned evidence; opportunity pages show saved assessments, unknowns, evidence, trial receipts and follow-up history. The local CLI-to-database workflow persists findings for the UI. The follow-up form can dismiss, revise or advance an opportunity and updates its status with the reason in the same database transaction. There is no new qualified discovery to inspect. |
| D. Executable trials | PARTIAL | The CellGuard × CrowdCell benchmark ran selected source logic from both exact pinned repositories in a restricted offline container and passed seven synthetic pledge, guard, mutation and rebuild/revalidation assertions. A separate DripFund × Cellora differential executed pinned DripFund indexer logic against modeled Cellora-style responses. These are reproducible cross-project code checks, not valid on-chain transactions or proof of live compatibility. See [pledge experiment](../evidence/benchmarks/pledge-experiment.md) and [semantic differential](../evidence/semantic-differential.md). |
| E. Persistence and safety | PARTIAL | Versioned Drizzle migrations through 0005 were applied to a temporary PostgreSQL 17 service twice. UI, test and production builds were checked. Local development falls back to file-backed PGlite. Trial code executes only through bounded local containers, never in a web request. The follow-up write form requires a configured shared local key, which is not production multi-user authentication. |

## Reproduce

From the repository root, with dependencies installed, imported records available, and Docker available for trials:

```sh
pnpm test
pnpm build
pnpm intelligence:footprints --needs-only --limit 5
pnpm intelligence:discover --limit 20
scripts/benchmarks/run-pledge.sh
scripts/semantic-run.sh
pnpm trial:pledge
pnpm trial:semantics
pnpm trial:capsule fixtures/trials/revalidation-v1.json
```

`pnpm intelligence:footprints --project crowdcell --revision 0835ad42decf2c9594fa92a185eea4cee9eba622 --limit 1` refreshes the immutable CrowdCell snapshot used in the cross-project analysis. The TC-01B evidence files record the actual held-out batch revisions and results; a fresh database may select a different first five projects, so compare the run summary before interpreting the outcome.

## Remaining work

The key gap is useful autonomous discovery: the current exact-name bridge is safe against the observed superficial match after filtering, but it misses semantic and architecture-level opportunities and produced no qualified new candidate in the evaluated needs batch. The analyzer is partial and TypeScript/JavaScript centered. The reusable capsule does not yet accept a reviewed two-project integration specification, and the executed pledge harness does not build, sign or submit a real CCC transaction. Product state changes still need explicit persisted dismiss/revise/advance operations with recorded reasons. No maintainer response, production deployment or adoption is claimed.
