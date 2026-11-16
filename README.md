# Trycove · TC-01

A local-first CKB connection workspace: source-backed project discovery, an investigated CellGuard × CrowdCell opportunity, evidence and a persistent follow-up ledger. Imported descriptions are upstream claims; synthetic trial results are not adoption or chain verification.

## Run

Node 20.9+ and pnpm 11 are required. From this directory:

```sh
pnpm install --frozen-lockfile
pnpm migrate
pnpm sync
pnpm seed
pnpm dev
```

Open the local development server. `sync` clones CKBDapps and upserts source-local project identifiers; rerun it to refresh. It reports invalid files and preserves prior records. `seed` is idempotent. PGlite persists to `.data/trycove` and is intended for a single local process; stop the server before running migration, sync or seed. For PostgreSQL set `DATABASE_URL` to a connection string before all commands. PostgreSQL server operation has not been tested here. Do not expose this development app publicly: the ledger has no authentication or moderation.

`pnpm test` runs unit tests, `pnpm build` checks the production build, and `scripts/run-trial.sh` reruns the independently observed upstream synthetic bridge suite at a pinned revision. This needs GitHub access. See [the trial record](evidence/cellguard-crowdcell.md) and [handoff](docs/TC-01.md).
