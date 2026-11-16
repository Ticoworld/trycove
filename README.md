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

Open the local development server. `sync` clones CKBDapps and refreshes its source records. `sync:builder` imports CKBuilder's README table; `sync:issues` imports public issue claims. `seed` is idempotent. PGlite persists to `.data/trycove` and is intended for a single local process; stop the server before running migration, sync or seed. For PostgreSQL set `DATABASE_URL` to a connection string before all commands. A disposable PostgreSQL 17 instance passed the six migrations, both source imports, issue import, pinned source scans, saved discovery run, production build, and local UI page smoke checks. No production deployment was tested. Do not expose this development app publicly: the ledger write key is a local access control, not user authentication or moderation.

`pnpm test` runs unit tests, `pnpm build` checks the production build, and `scripts/run-trial.sh` reruns the independently observed upstream synthetic bridge suite at a pinned revision. This needs GitHub access. See [the trial record](evidence/cellguard-crowdcell.md) and [handoff](docs/TC-01.md).

## Connection discovery and access

After `pnpm migrate`, `pnpm sync`, and `pnpm sync:builder`, run `pnpm sync:issues` to import public issue claims. Identity merging requires a unique matching normalized name and corroborating site or repository; secondary repositories remain separately sourced claims. CKB Pulse is not yet an ingestion source. `pnpm intelligence:footprints` clones bounded source snapshots without executing project code; `pnpm intelligence:discover` matches imported needs against those snapshots and persists candidates. Discovery has explicit rules for exact function signatures, CKB name resolution, and transaction submission recovery. The rules reject superficial keyword overlap, but do not provide general semantic or architecture discovery. Every result is a hypothesis, never automatic proof of compatibility.

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

The current engine rediscovered pckt × CellFlow, a pair already investigated in [the earlier connection report](evidence/connection-investigation.md) at commit `4a9a6cd`. Treat it as a regression result, not a novel connection. Compatibility remains `unknown`: the CCC versions differ, submission boundaries do not directly align, network/deployment details remain unknown, and code reuse rights need resolution. The saved DripFund × Cellula resolver candidate is also a known public proposal. See [the current evidence report](evidence/connection-engine-run-2026-11-16.md). Missing compatibility data remains unknown; disjoint declared networks block a candidate rather than silently succeeding.

## Versioned source footprints and TC-01B trials

Run the source analyzer over imported GitHub projects, then discover only from the resulting snapshots and imported documented needs:

```sh
pnpm intelligence:footprints --needs-only --limit 5
pnpm intelligence:discover --limit 20
```

`--project <imported-project-id>` narrows a scan to one imported project. `--repository-url` selects a source-claimed secondary repository; add `--revision <40-character-commit-sha>` to pin it. `--limit` is 1–20 and `--offset` selects another batch. A scan clones public GitHub source without running project code, skips test/build/vendor trees, and caps repository size and duration. TypeScript/JavaScript uses the TypeScript AST; package lockfiles, Cargo metadata, selected deployment/config JSON, and a narrow Rust relay-line scan are parsed separately. Each observation links to a repository, full revision, source path and line range, and is labeled `source_observed`. This is not proof of runtime behavior. Full Rust semantics, YAML deployment meaning, dynamic dispatch, current deployment, live network identity, signer behavior and script liveness may remain unknown.

Exact interface matches require equal source-observed TypeScript signatures. Narrow semantic rules also require structured needs and supporting source operations; a network or response-shape mismatch cannot be labeled compatible. The held-out CKBuilder needs batch initially produced one false match from the generic word `transaction`; it was moved to `needs-review`, generic and test-file matches were excluded, and rerunning that same five-project batch yielded zero candidates. See [both batch records](evidence/tc01b-needs-batch.json) and [the filtered rerun](evidence/tc01b-needs-filtered.json). Do not treat an empty run as evidence that no useful integration exists.

Project pages expose structured signals, source-claimed repositories and source footprints. The Opportunity Workspace shows its saved reasoning, compatibility findings, code sources, experiments, receipts and follow-up history. `/trials` shows content-addressed execution receipts and their evidence level. Reproduce the separate CellGuard × CrowdCell benchmark with `scripts/benchmarks/run-pledge.sh`; the DB-backed receipt command is `pnpm trial:pledge`. Reproduce the DripFund × Cellora modeled differential with `scripts/semantic-run.sh`; `pnpm trial:semantics` records its receipt. `pnpm trial:capsule fixtures/trials/revalidation-v1.json` runs the generic synthetic capsule. All execution is initiated locally from the CLI, never by a web request. These checks do not prove a valid live CKB transaction, deployment compatibility or adoption. See [the current evidence report](evidence/connection-engine-run-2026-11-16.md) and the [earlier TC-01B baseline report](docs/TC-01B.md).
