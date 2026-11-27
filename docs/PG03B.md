# PG03B hosted QuotaCell Playground

The isolated hosted receiver uses application ID `quotacell-playground` and the exact HTTPS origin `https://trycove-quotacell-playground.netlify.app`. The Trycove isolated deployment uses `https://trycove-pg03b-isolated.netlify.app`; the normal Trycove and QuotaCell production sites remain separate.

On the isolated Trycove Netlify project, configure `DATABASE_URL` with the pooled connection for the `trycove-stage2-verification` Neon branch and `TRYCOVE_PLAYGROUND_APPLICATIONS` with the `quotacell-playground` origin and a private 32-character-or-longer secret. Keep `TRYCOVE_WRITE_KEY` unset. On the receiver project, configure the exact app origin, isolated issuer origin, same private secret, application ID, and a `QUOTACELL_PLAYGROUND_IDENTITIES` map keyed by the fixture resource ID. The map is server-only and contains only the dedicated Pudge test identity and Pocket hash. Never put either secret or identity material into a room definition or Vite environment variable.

Build the receiver with `frontend/netlify.playground.toml`, then deploy it to the separate `trycove-quotacell-playground` Netlify project. The existing deploy preview is retained independently from its production URL. The isolated Trycove project must use the PG03B branch and the verification database only.

The end-to-end gate is an authorized HTTPS handoff from the isolated Trycove room. Acceptance evidence records the receiver URL, app ID, fixture resource ID, deployment commit, and visible receiver state. It does not include the bearer credential, handoff token, private key, or a transaction submission.
