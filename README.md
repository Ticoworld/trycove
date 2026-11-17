# Trycove · TC-01

A local-first CKB connection workspace: source-backed ecosystem ingestion, structured needs and code observations, explainable candidate discovery, saved compatibility findings, and a persistent follow-up ledger. Imported descriptions and issue requests remain upstream claims; source analysis and synthetic trial results are not runtime compatibility or adoption.

## Run

Node 20.9+ and pnpm 11 are required. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm migrate
pnpm sync
pnpm sync:builder
pnpm seed
pnpm exec next dev -H 127.0.0.1
```

Open the local development server. `sync` clones CKBDapps and refreshes its source records. `sync:builder` imports CKBuilder's README table; `sync:issues` imports public issue claims. `seed` is idempotent. PGlite persists to `.data/trycove` and is intended for a single local process; stop the server before running migration, sync or seed. For PostgreSQL set `DATABASE_URL` to a connection string before all commands. A disposable PostgreSQL 17 instance passed the six migrations that predate TC-01C, both source imports, issue import, pinned source scans, saved discovery run, production build, and local UI page smoke checks. No PostgreSQL service was available during TC-01C, so migration 0008 was verified on PGlite only. No production deployment was tested. Do not expose this development app publicly: the ledger write key is a local access control, not user authentication or moderation.

`pnpm test` runs unit tests, `pnpm build` checks the production build, and `scripts/run-trial.sh` reruns the independently observed upstream synthetic bridge suite at a pinned revision. This needs GitHub access. See [the trial record](evidence/cellguard-crowdcell.md) and [handoff](docs/TC-01.md).

## Connection discovery and access

After `pnpm migrate`, `pnpm sync`, and `pnpm sync:builder`, run `pnpm sync:issues` to import public issue claims. Identity merging requires a unique matching normalized name and corroborating site or repository; secondary repositories remain separately sourced claims. CKB Pulse is not yet an ingestion source. `pnpm intelligence:footprints` clones bounded source snapshots without executing project code. `pnpm intelligence:discover` applies both the source-interface rules and structured need/capability/offer taxonomy across imported claims, then saves explainable candidates and findings. The taxonomy supports specific scopes such as cycle profiling, contract-data decoding, indexing architecture, session integrations, transaction recovery, name identity, testing and explicit technical-review offers. It is deliberately bounded and should be expanded through evaluated evidence; it does not claim general semantic or architecture discovery. Every result remains a hypothesis until independently checked.

Run `pnpm sync:issue-repositories` to backfill multiple repository links from already-imported CKBuilder issues, then run `pnpm intelligence:blind --seed trycove-blind-20261116 --size 49` to reproduce the current pair-blind census. Consumer selection is based on imported needs before footprint availability is checked; no target pairs are supplied. The [evaluation record](evidence/unseen-corpus-evaluation.json) contains all 49 currently need-bearing projects (from 230 inventory records), 164 claims, matcher output and source pins. Its [review and trial report](evidence/unseen-corpus-evaluation.md) records two new-to-local-evidence review-offer candidates, one documented Explorer/cycle-tool need with a prior related-tools mention, the known DripFund/Cellora result, hard-negative findings and the RPC access blocker. This does not establish general coverage across all CKB projects.

Writes are disabled by default. To enable the local ledger set a strong `TRYCOVE_WRITE_KEY` in the server environment and enter it on the form. Do not expose this app publicly: this shared key is a local access control, not a complete multi-user authentication system. Restart the server after changing it.

## Issue intelligence and connection workflow

After `pnpm migrate`, `pnpm sync`, `pnpm seed`, and `pnpm sync:builder`, run:

```sh
pnpm sync:issues                  # GitHub public issue pages, no API token required
pnpm extract:code                 # scan repositories referenced by five imported issues
pnpm discover                     # save interface-based candidates
pnpm investigate                  # source-level check of first documented lock-query candidate
pnpm investigate:relays           # inspect selected transaction-recovery candidates
```

`sync:issues` also accepts issue numbers to refresh specific issues, and `extract:code` accepts issue numbers to scan other imported issue repositories. Exact-interface, name-resolution and transaction-recovery rules keep source claims, code observations, hypotheses and independent checks distinct. No candidate is automatically marked compatible. Inspection commands clone public repositories and never execute their code. Code scanners are bounded and may miss interfaces; they are not a general program analysis engine. The HTML issue adapter validates the current upstream payload and will report failures if GitHub changes it. No issue comments are imported. Re-running discovery marks previously generated but no longer supported discovered candidates as needing review, and preserves investigations and follow-ups.

The pckt × CellFlow result is a regression rediscovery of a pair already investigated at commit `4a9a6cd`; it is not used as novelty evidence. The latest pair-blind census surfaced CKB Geo-Wars × Cellora and CKB Escrow × Cellora as explicit technical-review offers; exact-name public GitHub issue searches in the report scope found no pair hits. The first has pinned Geo-Wars query calls and Cellora's cells-query API declaration; the second has pinned escrow app/indexer source and the same provider API. These are review offers, not integrations, and current availability and response are unknown. CKB Devnet Explorer × ckb-cycle-tools was also surfaced, but issue #46 already mentions the explorer as a related tool; its read-only testnet replay was blocked by endpoint access. DripFund × Cellora is prior local investigation. See the [pair-blind evidence](evidence/unseen-corpus-evaluation.json) and the [evaluation report](evidence/unseen-corpus-evaluation.md).

## TC-01C Part 1: current-state checks and offline execution

`pnpm prior-art:register` adds the Twine × Cellula invoice-routing regression opportunity without replacing imported records. `pnpm prior-art:verify fixtures/current-state/twine-cellula.json` performs a bounded, candidate-specific refresh of GitHub current refs, cited sources, alias/concept searches and selected current-revision code paths. The same verifier checks Cellora's dated architecture-review offer and the Explorer/cycle-tools candidate. Checks and evidence are append-only in the lifecycle tables; a failed source request leaves freshness partial or unresolved rather than confirming no prior art. The Twine/Cellula Talk and announcement references are currently inaccessible through the environment's public-source proxy, so the recorded historical testnet demonstration remains attributed and not independently confirmed. See [the TC-01C evidence report](evidence/tc-01c-part1.md) and the timestamped records in [current-state evidence](evidence/current-state/).

The offline cross-project experiment uses pinned upstream checkouts and an archived real Testnet transaction fixture. Prepare and run it with `pnpm experiment:ckb-cycle:prepare && pnpm experiment:ckb-cycle`. It invokes the pinned Explorer's `Explorer.rawTransaction()` against a local fixture JSON-RPC server, then the pinned cycle-tools `groupsOf`/`replayGroups` interfaces and its real ckb-debugger WebAssembly binary. The content-addressed [execution receipt](evidence/ckb-explorer-cycle/execution.json) records per-group cycles, an actual lock-script rejection after a one-shannon capacity mutation, and rejection when resolved CellDeps are removed. The replay is offline and does not establish fresh chain acceptance, submission, signer behavior or adoption. The Opportunity Workspace links this receipt and the current-state history.

## Versioned source footprints and TC-01B trials

Run the source analyzer over imported GitHub projects, then discover only from the resulting snapshots and imported documented needs:

```sh
pnpm intelligence:footprints --needs-only --limit 5
pnpm intelligence:discover --limit 20
```

`--project <imported-project-id>` narrows a scan to one imported project. `--repository-url` selects a source-claimed secondary repository; add `--revision <40-character-commit-sha>` to pin it. `--limit` is 1–20 and `--offset` selects another batch. A scan clones public GitHub source without running project code, skips test/build/vendor trees, and caps repository size and duration. TypeScript/JavaScript uses the TypeScript AST; package lockfiles, Cargo metadata, selected deployment/config JSON, and a narrow Rust relay-line scan are parsed separately. Each observation links to a repository, full revision, source path and line range, and is labeled `source_observed`. This is not proof of runtime behavior. Full Rust semantics, YAML deployment meaning, dynamic dispatch, current deployment, live network identity, signer behavior and script liveness may remain unknown.

Exact interface matches require equal source-observed TypeScript signatures. Narrow semantic rules also require structured needs and supporting source operations; a network or response-shape mismatch cannot be labeled compatible. The held-out CKBuilder needs batch initially produced one false match from the generic word `transaction`; it was moved to `needs-review`, generic and test-file matches were excluded, and rerunning that same five-project batch yielded zero candidates. See [both batch records](evidence/tc01b-needs-batch.json) and [the filtered rerun](evidence/tc01b-needs-filtered.json). Do not treat an empty run as evidence that no useful integration exists.

Project pages expose structured signals, source-claimed repositories and source footprints. The Opportunity Workspace shows its saved reasoning, compatibility findings, code sources, experiments, receipts and follow-up history. `/trials` shows content-addressed execution receipts and their evidence level. Reproduce the separate CellGuard × CrowdCell benchmark with `scripts/benchmarks/run-pledge.sh`; the DB-backed receipt command is `pnpm trial:pledge`. Reproduce the DripFund × Cellora modeled differential with `scripts/semantic-run.sh`; `pnpm trial:semantics` records its receipt. `pnpm trial:capsule fixtures/trials/revalidation-v1.json` runs the generic synthetic capsule. All execution is initiated locally from the CLI, never by a web request. These checks do not prove a valid live CKB transaction, deployment compatibility or adoption. See [the current evidence report](evidence/connection-engine-run-2026-11-16.md) and the [earlier TC-01B baseline report](docs/TC-01B.md).
