# PG03B hosted QuotaCell Playground

The isolated hosted receiver uses application ID `quotacell-playground` and the exact HTTPS origin `https://trycove-quotacell-playground.netlify.app`. The Trycove isolated deployment uses `https://trycove-pg03b-isolated.netlify.app`; the normal Trycove and QuotaCell production sites remain separate.

On the isolated Trycove Netlify project, configure `DATABASE_URL` with the pooled connection for the `trycove-stage2-verification` Neon branch and `TRYCOVE_PLAYGROUND_APPLICATIONS` with the `quotacell-playground` origin and a private 32-character-or-longer secret. Keep `TRYCOVE_WRITE_KEY` unset. On the receiver project, configure the exact app origin, isolated issuer origin, same private secret, application ID, and a `QUOTACELL_PLAYGROUND_IDENTITIES` map keyed by the fixture resource ID. The map is server-only and contains only the dedicated Pudge test identity and Pocket hash. Never put either secret or identity material into a room definition or Vite environment variable.

The separate `trycove-quotacell-playground` Netlify project is linked to `Ticoworld/QuotaCell` on `codex/pg03b-hosted`. It builds from `frontend`, publishes `dist`, and deploys `netlify/functions`; the project environment supplies the Playground build flags and issuer origin. `frontend/netlify.playground.toml` records the corresponding receiver build configuration. The existing preview deploy `6b097568ad5996918ba3cc0f` remains retained independently from the production URL. The isolated Trycove project uses the PG03B branch and verification database only.

The fixture launch URL must be the hosted receiver's `/app` route, where the handoff listener is installed. The origin root is the public landing page and cannot accept the handoff.

The end-to-end gate is an authorized HTTPS handoff from the isolated Trycove room. Acceptance evidence records the receiver URL, app ID, fixture resource ID, deployment commit, and visible receiver state. It does not include the bearer credential, handoff token, private key, or a transaction submission.

## Hosted acceptance

- Date: 2026-11-27.
- Receiver: `https://trycove-quotacell-playground.netlify.app/app`; Netlify deploy `6b098bedcc5ec96e4ab2cf32`, branch `codex/pg03b-hosted`, QuotaCell commit `619e8af41126027ffabbe2db761915dd1a1399a9`.
- Isolated issuer: `https://trycove-pg03b-isolated.netlify.app`; Netlify deploy `6b0990481cd4efc651f5d740`, branch `codex/pg03b-hosted`, Trycove commit `d12a7f8520591e67f4905d2c6a78efe397b9df5d`.
- Fixture: application `quotacell-playground`, resource `2cd82253-366d-44e2-979d-60b45c5cadda`.
- Result: the isolated room opened the receiver over HTTPS; the receiver displayed `Playground · Pudge test identity` on Pudge testnet. Trycove saved the task result as `It worked` in a private final receipt. No report was shared.
- Scope: this is an independent handoff acceptance only. No transaction was prepared, signed, or submitted. It makes no upstream compatibility or adoption claim. Normal QuotaCell production was not changed.
