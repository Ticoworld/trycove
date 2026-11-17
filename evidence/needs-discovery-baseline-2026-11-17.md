# TC-01C Part 2B-1 discovery baseline

## Reproduction

- Baseline code: `16601aa790df0d5587dc8192a02dfad5c4a6313a`.
- Command: `pnpm intelligence:blind --seed trycove-blind-20261116 --size 49`.
- Evaluation ran in a detached worktree with a copied PGlite database; the working database was not changed by the run.
- Full result: [`needs-discovery-baseline-run-2026-11-17.json`](needs-discovery-baseline-run-2026-11-17.json).
- Input snapshot: [`needs-discovery-input-2026-11-17.json.gz`](needs-discovery-input-2026-11-17.json.gz).
- Snapshot SHA-256 over canonical uncompressed table JSON: `6760396705df2247cc86a225173b30fb56555f1080350490b6069192dced3fa0`.
- Compressed snapshot SHA-256: `5e91b35c0a80981cc6325f1377425d1ceaeab52d3f43c1f80dd9a62a4b8367c1`.
- Baseline result SHA-256: `46a898a4f2c24f5882017869b3fbfc54da5fa1f3c44b6da04f07c6456cf3ff7d`.

The snapshot contains the imported projects, signals, atomic needs, intents, technical footprints and observations, prior opportunities/evidence, and lifecycle records. The current input digest can therefore be checked independently of later database refreshes.

## Baseline snapshot and decisions

| Measure | Observed |
| --- | ---: |
| Imported projects | 231 |
| Projects with a need or obstacle | 49 |
| Need/obstacle signals in the held-out cohort | 164 |
| Atomic `need_items` in the corpus (not read by the old matcher) | 856 |
| Stored code footprints / observations | 45 / 84,548 |
| Held-out projects with code observations | 12 of 49 |
| Classified old matcher intents | 38 |
| Unclassified need signals | 138 |
| Old matcher candidate pairs | 4 |
| Same-scope rejections | 6 (4 require explicit offers; 2 offer type mismatches) |
| Classified needs without a same-scope provider | 8 |

The sample was selected deterministically from all 49 eligible projects using the fixed seed and the existing claim-topic strata. No target pairs were supplied. All 49 eligible projects were included because the requested cohort size equals the eligible population.

The four pairs were:

- CKB Geo-Wars → Cellora, indexing-architecture review offer (5 source-code touchpoints).
- CKB Devnet Explorer → ckb-cycle-tools, per-script-group cycle analysis (6 touchpoints).
- CKB Escrow → Cellora, indexing-architecture review offer (4 touchpoints).
- DripFund → Cellora, indexing-architecture review offer (2 touchpoints).

The old matcher therefore repeated one Cellora offer for three consumers. The four results retained source claims and 17 pinned code touchpoints in total, but the findings did not establish runtime compatibility. The matcher did not consult candidate-scoped current-state verification before presenting these as discovered opportunities. Only 12 eligible projects had stored code observations; code-footprint absence did not exclude their needs from the sample.

## Known decision limitations

- The old matcher consumes whole `signals`; although 856 atomic needs exist, those rows do not influence generation or rejection.
- One scope is selected per signal, so separate requests in the same issue can be hidden by the first matching scope.
- 138 of 164 need signals were not classified; no defensible recall or precision reference labels exist.
- Explicit offers are source claims; current availability is not enforced by this discovery path. Existing lifecycle records were present in the database (3 capabilities, 16 verification runs, 42 evidence rows) but not used to gate these outputs.
- The Explorer/cycle-tools candidate is a reproduced known relationship, not evidence of a previously unknown discovery. Public prior-art search in the historical report was bounded, not exhaustive.
- Three of four candidates depend on the same historical Cellora review offer. Their code touchpoints do not prove that the offer is still available.

This baseline records observable behavior, not an accuracy score. Its purpose is comparison against the atomic-need pipeline on this exact source snapshot.

## Frozen issue-level comparison baseline

Before changing discovery code, a second read-only run applied the old matcher to the preselected issue holdout:

- Frozen manifest: [`needs-discovery-heldout-2026-11-17.json`](needs-discovery-heldout-2026-11-17.json), seed `trycove-2b1-heldout-v1`.
- Four whole CKBuilder issue URLs were selected across adoption, distribution, validation, review, security and ambiguous strata; all 70 atomic statements from them remain together. No user-testing source exists in the imported snapshot.
- The held-out source rows contain 17 need/obstacle signals. The old classifier recognized 3 and left 14 unclassified. The old typed matcher produced 0 candidates; its source-code corpus matcher also produced 0 candidates on this cohort.
- Two of the four source projects have code observations; two do not. The old system gives no explicit no-match decision for the latter.
- Full machine-readable run: [`needs-discovery-baseline-2026-11-17.json`](needs-discovery-baseline-2026-11-17.json), generated by `pnpm intelligence:compare --mode baseline` from the frozen snapshot. It includes rejected-scope and unmatched-need details and records the input digest.
- Frozen-cohort run SHA-256: `f202aaa9bb67860cceca70d1bcaecde547db5bf83b189dc5e52ccdffb43a221f`.

This is a same-input comparison baseline, not a human-labeled accuracy result. The new pipeline must retain issue-level separation and report provisional interpretation limits.
