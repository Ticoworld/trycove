# TC-01E frozen baseline

- Required starting commit and published `origin/main`: `21708af1d2cfe19e420d84d67f51f5c8fb64550e`.
- Working tree before TC-01E changes: clean; branch `work`.
- Database: existing local PGlite at `.data/trycove`; `DATABASE_URL` is unset.
- Existing inventory at freeze time: 231 products, 50 product/repository claims, 45 footprint records, 23 distinct pinned repository/revision identities, 84,548 footprint observations, 385 source signals, 53 saved opportunities.
- Selection: sort all unique `(repository URL, full revision)` identities by `SHA-256(repository + NUL + revision)`, take the first 24, retain the source-linked products and every footprint observation under those pins. There were only 23 identities, so all 23 were selected. No pair, issue or pull request influenced selection.
- Frozen input: [`frozen-source-cohort.json.gz`](frozen-source-cohort.json.gz).
- Gzip SHA-256: `9a121a03e1c005afd252e43afbc8e96a0ac1c1e8feb47055a11a791c3d98de4c` (7,333,871 bytes).
- Reproduction/verification: `pnpm tc01e:freeze -- --verify` checks the frozen identity, row counts and digest. The default command creates the snapshot only when absent and will not overwrite it.

This is the already-imported footprint set, not a claim that all CKB products or all source interfaces are covered. The snapshot includes duplicate footprint observations where multiple source-linked product records point at a repository; subsequent analysis must preserve those associations and deduplicate only at the explicitly stated repository/source-location boundary.

The baseline establishes no independent connection and no execution result. CKBdapps JSON and Pulse are not yet imported into this snapshot. Their live responses, upstream revisions/content digests and retrieval limitations will be recorded separately before use.
