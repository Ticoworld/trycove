# TC-01C Part 2B-1: Builder-needs discovery evaluation

## Reproduction and frozen input

- Matcher baseline: `16601aa790df0d5587dc8192a02dfad5c4a6313a`.
- Evaluation repository HEAD: `3dfa527113afeb14cfcb0d4aa9fecb53a159920f`; the evaluation records the exact working-source digest because the new implementation was still uncommitted when it ran.
- Evaluation-source SHA-256: `bede232017f05d949d85616afad886649c3db68a7546f68d1a5e142906bc573e`.
- Source snapshot digest: `6760396705df2247cc86a225173b30fb56555f1080350490b6069192dced3fa0` (canonical uncompressed data); compressed snapshot SHA-256: `5e91b35c0a80981cc6325f1377425d1ceaeab52d3f43c1f80dd9a62a4b8367c1`.
- Holdout seed: `trycove-2b1-heldout-v1`. Four whole issue URLs were chosen by the fixed topic-strata rule before matcher changes: [issue 46](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/46), [issue 15](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/15), [issue 41](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/41), and [issue 3](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/3). All 70 statements from those issues were held out together and their issue URLs were excluded from provider-signal search.
- The frozen source snapshot has 231 projects, 385 signals, 856 atomic statements across 49 need-bearing projects, 23 latest-footprint repositories, and 42,049 latest code observations. The sample has four consumer projects; two have code observations and two do not. The snapshot contains no user-testing statement, so validation is the testing-related stratum; no tester demand was invented.

Machine-readable inputs and outputs: [snapshot](needs-discovery-input-2026-11-17.json.gz), [holdout manifest](needs-discovery-heldout-2026-11-17.json), [old matcher result](needs-discovery-baseline-2026-11-17.json), and [atomic-need result](needs-discovery-new-2026-11-17.json). Reproduce with `pnpm intelligence:compare --mode baseline` and `pnpm intelligence:compare --mode new`.

## Same-input result

| Measure | Frozen old matcher | Atomic-need pipeline |
|---|---:|---:|
| Held-out source signals | 17 | 17 |
| Atomic statements consumed | No | 70 |
| Need intents / actionable atoms | 3 | 9 |
| Typed candidates | 0 | 0 |
| Code-corpus candidates | 0 | 0 |
| Candidate relationships | 0 | 0 |
| Actionable atoms without a supported provider | Not recorded by the old path | 9 |

The new run rejected 40 statements by stance, 7 for unknown category, and 14 for lacking a bounded scope. It found 10 source-backed provider intents and one code-observation intent; the held-out provider search found no suitable same-scope provider or explicit human offer. Its result is an explicit no-match for this cohort, not a claim that no provider exists. The old and new run produced no relationship for this holdout; the improvement is in the correctness and traceability of the decisions, not candidate count.

Two source examples show the difference:

- **CKBuilder issue 46:** the old classifier assigned `user-testing` to a mixed signal that reports the 1.0.0 release and the Action's first real use on another project's contracts. Atomic decomposition keeps the release as a `status-update`, the “first real use” sentence as non-actionable roadmap language, and the harness statement as ambiguous. None is promoted as a fresh tester request.
- **CKBuilder issue 15:** the old matcher applied `ckb-sender-profile-identity` to a long mixed claim and also interpreted a separate advice request under that same scope. The atomic result keeps the identity and design statements distinct and ambiguous, while preserving the separate distribution question as an actionable request. No unrelated provider is inferred from the shared CKB terminology.

The new pipeline also records missed or unresolved examples, including an unscoped request for an audited CKB type script and a validation request that the current bounded taxonomy does not map to a candidate scope. These remain visible in the JSON result; they were not recast as successful matches. The sample was not independently annotated by builders or reviewers, so the report makes no precision or recall claim. The interpretations are provisional lexical judgments.

## Real-data discovery and current-state check

The full imported-data run selected **CKB Escrow × Cellora** without a supplied pair. The exact atomic need is “What is the recommended production architecture for indexing escrow cells and terminal transaction history?” from [CKBuilder issue 26](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/26). The provider evidence is Cellora's explicit offer to discuss apps with non-trivial indexing needs in [CKBuilder issue 12](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/12). This is a human review lead, not a claim of code compatibility or willingness to integrate.

The existing candidate-scoped verifier checked 15 bounded current sources (repository refs, merged PRs, releases, both cited issues, and alias/concept issue searches); all 15 were available. It saved four relevant evidence excerpts and determined `stale_offer`, with compatibility `unknown` and the next action “Reconfirm the offer before presenting it as available.” `stale_offer` means unconfirmed evidence, not a withdrawn offer. The opportunity remains `provisional` and is rendered with the original need, offer source, lifecycle finding, and next action in the [Opportunity Workspace](../app/opportunities/%5Bid%5D/page.tsx). The hashed verification artifact is [here](needs-discovery-current-state/intent-00a3979b5875aae7c7fc413bb5d87077-20261117T074759628Z.json) (SHA-256 `423082dcf826e950303e84d311124eaa5dc6a1022d543654758b8dea8def2a64`). No maintainer was contacted.

The same real-data run saved [CellFlow's CKB correctness-review request](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/38) as a no-provider decision: no imported record supported a matching reviewer offer, and the workspace gives a human-controlled next action. This is not presented as evidence that no reviewer exists.

A full-corpus false positive also produced a useful negative regression: CellFlow asks which test evidence would convince reviewers, while an unrelated provider describes transaction-submission recovery. The engine now interprets that phrasing as validation, rejects matching it to a code capability, and has a regression test. The previous generated row remains in history with a review note rather than being deleted.

## Persistence and limitations

Two source refreshes preserved 856 active need atoms and 856 superseded source-revision rows (1,712 total); all 1,712 rows retain their source-signal relationship in the current database. The discovery run persisted need-linked typed intents and exact need evidence. Generated candidates that no longer recur move to `needs-review` with an appended finding; prior evidence and trial records remain intact. A further discovery run produced no additional retirement notes.

Verification used the existing local PGlite database. `DATABASE_URL` was unset and PostgreSQL client tools were unavailable, so a separate PostgreSQL service was not verified. Current-state freshness is bounded to the sources listed in the receipt; it is not exhaustive coverage of private channels, every repository, or every alias. Code observations remain static source evidence and do not establish runtime compatibility.

## Checks run

- `pnpm migrate` succeeded twice consecutively after the idempotence fix.
- `pnpm intelligence:needs` succeeded twice with the same 856 active need items; `pnpm intelligence:needs:verify` confirmed 856 active, 856 superseded, and 1,712 retained signal links.
- `pnpm intelligence:discover` ran repeatedly against the imported database; the final run produced one provisional review lead and the CellFlow no-provider decision, with no duplicate retirement note.
- `pnpm exec vitest run --maxWorkers=1 --testTimeout=30000`: 16 test files, 89 tests passed.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed.
- Production server smoke checks returned HTTP 200 for the opportunity list, the CKB Escrow × Cellora workspace, the CellFlow no-provider workspace, and the CKB Escrow project profile. The responses contained the source need, provisional state, stale-offer next action, and no-provider conclusion.

## Acceptance assessment

- **Gate A — PASS.** Active `need_items` feed intent generation and rejection; exact atoms, parent claims, revisions, offsets, category, stance, interpretation method, and provider evidence are retained. Human-review matching works without code footprints, non-actionable text abstains, and repeated refreshes preserve lineage.
- **Gate B — PASS, bounded to decision quality on this frozen cohort.** The comparison is reproducible and issue-level; it shows real-source misclassification avoided, reports missed/unsupported cases, includes an adversarial rejection, and makes no semantic-accuracy claim. The holdout still produced zero supported relationships, so it does not prove that this small sample can generate a technical integration match.
- **Gate C — PASS.** Full imported data generated the CKB Escrow × Cellora review lead, ran current-state verification, saved its stale/unconfirmed outcome, and exposed it in the workspace. CellFlow's separate review need is saved as a no-provider decision with exact source evidence and next action.

These gates establish the needs-to-decision workflow for this milestone. They do not establish a new technical integration, external reviewer participation, adoption, or ecosystem-wide semantic understanding.
