# Trycove · TC-01

A local-first CKB connection workspace: source-backed project discovery, an investigated CellGuard × CrowdCell opportunity, evidence and a persistent follow-up ledger. Imported descriptions are upstream claims; synthetic trial results are not adoption or chain verification.

## Run

Node 20.9+ and pnpm 11 are required. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm migrate
pnpm sync
pnpm seed
pnpm exec next dev -H 127.0.0.1
```

Open the local development server. `sync` clones CKBDapps and upserts source-local project identifiers; rerun it to refresh. It reports invalid files and preserves prior records. `seed` is idempotent. PGlite persists to `.data/trycove` and is intended for a single local process; stop the server before running migration, sync or seed. For PostgreSQL set `DATABASE_URL` to a connection string before all commands. A temporary PostgreSQL 17 instance was tested with migrations, both imports, discovery, page reads, and a ledger write; production deployment has not been tested. Do not expose this development app publicly: the ledger has no authentication or moderation.

`pnpm test` runs unit tests, `pnpm build` checks the production build, and `scripts/run-trial.sh` reruns the independently observed upstream synthetic bridge suite at a pinned revision. This needs GitHub access. See [the trial record](evidence/cellguard-crowdcell.md) and [handoff](docs/TC-01.md).

## Connection discovery and access

After migration and `pnpm sync`, run `pnpm sync:builder` and `pnpm discover`. The former imports CKBuilder's public README table; the public-issue adapter below imports issue bodies separately. Identity merging requires a unique matching name and corroborating site or repository. Discovery uses explicit interface rules; its results are candidates, not verified integrations. `scripts/run-cross-trial.sh` reproduces the separate synthetic cross-project experiment; `pnpm exec tsx scripts/record-cross-trial.ts` records its result after running it.

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

`sync:issues` also accepts issue numbers to refresh specific issues, and `extract:code` accepts issue numbers to scan other imported issue repositories. Only fixed interface signatures produce candidates; source claims, code observations, hypotheses and independent checks retain different labels. No candidate is automatically marked compatible. Inspection commands clone public repositories and never execute their code. Code scanners are bounded and may miss interfaces; they are not a general program analysis engine. The HTML issue adapter validates the current upstream payload and will report failures if GitHub changes it. No issue comments are imported. Re-running discovery marks previously generated but no longer supported discovered candidates as needing review, and preserves investigations and follow-ups.

The strongest current documented match is DripFund × Cellora. See [the investigation](evidence/connection-investigation.md) for source revisions, limitations and reproducible checks. The exact matching rules do not infer a need from broad category similarity; absent network, SDK, script or signer information stays unknown. Explicitly disjoint declared network or SDK values exclude a candidate, but shared or missing values do not prove compatibility.

## Versioned source footprints and TC-01B trials

Run the source analyzer over imported GitHub projects, then discover only from the resulting snapshots and imported documented needs:

```sh
pnpm intelligence:footprints --needs-only --limit 5
pnpm intelligence:discover --limit 20
```

`--project <imported-project-id>` narrows a scan to one imported project. Add `--revision <40-character-commit-sha>` to analyze an immutable revision; `--limit` is 1–20 and `--offset` selects another batch. A scan clones public GitHub source without running project code, skips test/build/vendor trees, and caps repository size and duration. TypeScript/JavaScript uses the TypeScript AST; package lockfiles, Cargo metadata, and selected deployment/config JSON are parsed separately. Each observation links to a repository, full revision, source path and line range, and is labeled `source_observed`. This is not proof of runtime behavior. Rust code, YAML deployment semantics, dynamic dispatch, current deployment, live network identity, signer behavior and script liveness may remain unknown.

The current corpus discovery is deliberately conservative: it requires an imported documented need, a non-generic identifier found in the consumer source, and a matching exported interface in another source snapshot. It does not yet infer semantic synonyms or novel architectures. The held-out CKBuilder needs batch initially produced one false match from the generic word `transaction`; it was moved to `needs-review`, generic and test-file matches were excluded, and rerunning that same five-project batch yielded zero candidates. See [both batch records](evidence/tc01b-needs-batch.json) and [the filtered rerun](evidence/tc01b-needs-filtered.json). Do not treat an empty run as evidence that no useful integration exists.

Project pages expose stored source footprints and project-specific observations. The opportunity workspace shows recorded assessment findings and source links when an engine assessment exists. `/trials` shows content-addressed execution receipts and their evidence level. Reproduce the separate, reviewed CellGuard × CrowdCell cross-project benchmark with `scripts/benchmarks/run-pledge.sh`; the DB-backed receipt command is `pnpm trial:pledge`. Reproduce the DripFund × Cellora modeled differential with `scripts/semantic-run.sh`; `pnpm trial:semantics` records its receipt. `pnpm trial:capsule fixtures/trials/revalidation-v1.json` runs the generic synthetic capsule. All execution is initiated locally from the CLI, never by a web request. The generic capsule is not yet a general-purpose runner for arbitrary upstream projects. The pledge benchmark exercises selected real code from both repositories with mocked transaction dependencies and synthetic CKB data: it does not prove a valid CKB transaction, VM result, deployment compatibility or adoption. See [TC-01B's evidence and gate report](docs/TC-01B.md).
