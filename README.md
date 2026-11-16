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

After migration and `pnpm sync`, run `pnpm sync:builder` and `pnpm discover`. The former imports CKBuilder's public README table; its issue API was inaccessible in this environment, so issue needs were not imported. Identity merging requires a unique matching name and corroborating site or repository. The discovery command inspects pinned DripFund and CellGuard code and applies a narrow interface rule; its output is a hypothesis, not a verified integration. `scripts/run-cross-trial.sh` reproduces the separate synthetic cross-project experiment; `pnpm exec tsx scripts/record-cross-trial.ts` records its result after running it.

Writes are disabled by default. To enable the local ledger set a strong `TRYCOVE_WRITE_KEY` in the server environment and enter it on the form. Do not expose this app publicly: this shared key is a local access control, not a complete multi-user authentication system. Restart the server after changing it.
