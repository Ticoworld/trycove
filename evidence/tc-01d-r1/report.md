# TC-01D-R1 prior-work reconciliation and contact readiness

Checked 17 November 2026. The review began from commit `664aaf70a1a9c9a614be8739b6daac7c016846b2` and reused the original ten-candidate cohort without reselection.

## Decision

The original CKB Kickstarter supply gap is no longer an untouched review request. Its April 9, 2026 issue comment received concrete hosting, RPC and indexing guidance; on April 20 the maintainer reported testnet fixes, including network-aware CKB client selection. At pinned CrowdCell `main` commit `78f8ec6babae7d5d344d90dda1afb12cc4429fd1`, `off-chain/indexer/src/indexer.ts` contains devnet, testnet and mainnet CCC client branches. This code observation does **not** prove a mainnet production deployment, public service uptime, RPC failover, or an operations runbook. R1 therefore marks the original architecture-advice request `ALREADY_ADDRESSED` and does not repeat it or treat Cellora's April 28 offer as current availability.

The best candidate for a first human-approved question is Owl Pilot's user-flow comprehension request. Its current open issue asks whether users understand account ownership, app-fund spending, allowance, and disconnect versus revocation. The complete retrieved thread has technical advice, including a November 17 revocation discussion, but no task-based UX test result. The saved result is `CONTACT_WORTHY`; a pilot is `NOT_READY`. A short draft is saved below and in Trycove, marked `NOT_SENT_AWAITING_USER_APPROVAL`.

No message was sent. Trycove has not recruited testers, recorded a response, or agreed a pilot. External outcome remains `NO_EXTERNAL_PARTICIPATION_VERIFIED`.

## Corrected decisions on the fixed pool

| Candidate / source | Previous TC-01D conclusion | Corrected prior-work finding | R1 action readiness | Pilot |
|---|---|---|---|---|
| pckt distribution advice, issue #15 | `NEEDS_CONFIRMATION` | Officeyutong provided concrete channels and staged user-growth advice. This answers the advice request, not adoption. | `ALREADY_ADDRESSED` | `NOT_READY` |
| CKBolt mainnet/audit scope, issue #54 | `NEEDS_CONFIRMATION` | Mentor confirms offered-TLC expiry protection already exists in Fiber v0.9.1 and asks for the concrete observed gap. That does not settle the broader mainnet/audit question. | `NEEDS_CONFIRMATION` | `NOT_READY` |
| Cellula owner-lock review, issue #39 | `BLOCKED` | The reviewer gave specific lock/flag advice; the maintainer reported SDK changes. The SDK release/code and a formal audit were not independently verified. A separate cycle-report workflow was welcomed. | `ALREADY_ADDRESSED` for the narrow lock-guidance question | `NOT_READY` |
| CKB Kickstarter production indexer, issue #6 | `BLOCKED`; selected supply gap | Architecture advice answered the original question; the maintainer reported testnet fixes and current code shows network-specific client selection. Production operation remains unverified. | `ALREADY_ADDRESSED` for the original question | `NOT_READY` |
| CKB Escrow history indexing, issue #26 | `BLOCKED` | One detailed review discusses reorg recovery and mainnet gates, but does not establish a full escrow-history indexing design or current builder need. | `NEEDS_CONFIRMATION` | `NOT_READY` |
| Freight on Nervos name resolution, issue #42 | `BLOCKED` | Recent comments concern mentor availability, security/demo feedback and explaining deliverables. They do not answer the separate CKB-name-to-verified-wallet question. | `NEEDS_CONFIRMATION` | `NOT_READY` |
| EventMesh validation, issue #40 | `BLOCKED` | Reviewer advice challenged scope and demand; the builder later reported a signed-receipt SDK and comparative tests. No external demand/adoption is established. | `ALREADY_ADDRESSED` for the original validation-guidance request | `NOT_READY` |
| ckb-cycle-tools outside-user validation, issue #46 | `BLOCKED` | Cellula welcomed a narrowly scoped cycle-report workflow and the author said a fork PR would follow a dummy-flow test. No matching PR appeared in the complete five-PR `cells-contracts` listing, and no outside-user execution was observed. | `NEEDS_CONFIRMATION`; do not duplicate the existing conversation | `NOT_READY` |
| Owl Pilot user-flow test, issue #51 | `BLOCKED` | Current specific UX request remains visible; the retrieved discussion has no task-based test result. The newest revocation answer is a different capability. | `CONTACT_WORTHY` | `NOT_READY` |
| CKAutomata initial review priorities, issue #43 | `ALREADY_ADDRESSED` | Detailed code review, maintainer-reported changes and follow-up were found. The reviewer explicitly said this was not a formal independent security audit. | `ALREADY_ADDRESSED` for the narrow initial-review request | `NOT_READY` |

### Independent control: LucentDEx, issue #35

The control was chosen by deterministic hash ranking from 39 eligible imported issues before retrieving its discussion. The reviewer reports a live testnet combined acceptance review and says “accepted as a testnet POC; not ready for mainnet.” The maintainer later reports fixes and updated deployments, while noting partial fills remain in progress. This is a partial testnet review outcome, not mainnet readiness or a reason to mark every request resolved. R1 classifies it `NEEDS_CONFIRMATION`.

## CKB Kickstarter prior-work details

The source identity check followed GitHub's repository metadata, not a name-similarity heuristic:

- Historical issue URL: `https://github.com/alesfer001/decentralized-kickstarter`
- Canonical repository: `https://github.com/alesfer001/CrowdCell`
- Stable GitHub repository ID: `1179274652` (`R_kgDORkpNnA`)
- Current inspected `main` revision: `78f8ec6babae7d5d344d90dda1afb12cc4429fd1`
- `off-chain/indexer/src/indexer.ts` SHA-256: `f9b2673eb8ddfd4a9d51cca3ecc6bbe3018e1ea961257b4588157547c43e4898`

The April reviewer comment `#4214047275` specifically recommends moving from local/ngrok exposure to a hosted worker using public mainnet RPC initially, incremental indexing, and operating a node only if latency or rate limits require it. The April 20 maintainer comment `#4283590795` reports fixes, testnet deployment and E2E tests, including network-aware client selection. The code read confirms the latter implementation branch but not deployment or production operation.

The same issue later documents a different collaboration: ckb-session-kit proposed an opt-in testnet pledge retry; CrowdCell welcomed the PR; and the developer opened [CrowdCell PR #14](https://github.com/alesfer001/CrowdCell/pull/14). At the check, PR #14 was **open and unmerged**, head `1a92a016b21dc53eae3a2d2540e05a736cd7b031`, base `78f8ec6babae7d5d344d90dda1afb12cc4429fd1`. It changes five files. Its author reports a 7 November testnet flow, including a race/rebuild case, but Trycove did not independently reproduce that test. The work is in progress with a maintainer-reported testnet demonstration; it is not merged integration or adoption, and it is not the indexer capability.

## Prepared first question

**To:** `@Birdmannn`, issue author for Owl Pilot

**Purpose:** Confirm whether the particular user-flow test remains useful.

**Expected answer:** Whether a short task-based check of the four named UX flows is still wanted.

**Status:** `NOT_SENT_AWAITING_USER_APPROVAL`

> Hi Birdmannn — I reviewed your UX question in CKBuilder issue #51 about who owns the account, which account spends app funds, what the allowance means, and disconnecting versus revoking. The later discussion I retrieved covers architecture and on-chain revocation, but I did not see a task-based user-test result in that issue thread. Would a short check of those four flows still be useful? If so, Trycove can help scope a test script and explore suitable volunteer testers. We have not recruited or tested anyone, and I am not assuming that you or anyone else is available.

This asks the builder first. It does not claim tester availability or imply that anyone has agreed to participate.

## Bounded source collection

The authenticated, read-only collector retrieved complete, chronologically sorted comment pages for the original ten source issues, the independent control (#35), and two directly linked issue threads (#47 and #2140): 13 issue threads and 80 comments. It also retained four directly referenced pull requests and repository identity observations. There were no fetch failures in that collection. The Cellula `cells-contracts` pull check separately preserved the complete five-entry response; no cycle-report PR was present in that bounded list. No all-GitHub or ecosystem-wide absence claim is made.

Primary artifacts:

- [Original frozen candidate pool](../tc-01d/candidate-pool-257ae9da5f65b7bd.json), SHA-256 `aa09ddd08229362745d11e867ef4bc09151451101edff3a1ce7157fb2fe8b7ea`.
- [Original TC-01D qualification report](../tc-01d/qualification-review-3b32928287de878a.json), preserved, SHA-256 `6ac6f89baa79a76ff18fbb8ea79e3eafd886d742da849ac0fcf81d2c357aadc4`.
- `source-collection-20261117T171343Z.json`, SHA-256 `904fe73676d7eb4f78657f5d8888e632fb5ce043ba2617cf9e98b675c6c34d69`.
- `source-observations.json`, SHA-256 `a5a7170f4ef99dbdf5fa18b86dc7372c6b29a369d5ea7d24bea5886f0f9422cb`, containing the pinned CrowdCell code excerpt and full-file hash.
- `review-annotations.json`, SHA-256 `28ead3e2b94f63df35338b527b5f57d2bc88ec8c1e930c30ebcfb2f47befd248`, with capability-scoped review labels and citations.
- `control-selection.json`, documenting the preselected independent control.
- `repository-pull-checks.json`, SHA-256 `4cf9a920edc3c9794097782f6d99a4afe8d148db85edda29836d70090b99edc9`, and its retained five-PR raw response `cells-contracts-pulls-response-20261117.json`, SHA-256 `5bb1a360011ff84b47f186672ce5b590d7603799c9f4c91c094338c0d7c1ebda`.
- [Corrected review, schema v2](corrected-review-4905b1bdb676aea2.json), SHA-256 `5eff2ef159f6da2a49dc7de6b27aca7af5a4119d67b1adb317d7f3e976923a24`, input snapshot `4905b1bdb676aea2317ea1499ebc83df3cab32cf559dc21712635335774c79ba`. It binds each workspace to its own candidate and action-readiness state. Earlier corrected reports remain preserved as historical evaluations.

## Persistence and reproduction

R1 adds append-only `opportunity_prior_work_reconciliations` records to the existing Kickstarter no-pilot workspace and the selected Owl Pilot need workspace. Each record's action-readiness value is bound to its own candidate: Kickstarter is `ALREADY_ADDRESSED` for the original architecture-guidance question; Owl Pilot is `CONTACT_WORTHY`, with pilot `NOT_READY`. Only the Owl workspace displays its unsent contact draft. The historical no-pilot qualification review, the original three source-evidence rows, and all zero follow-up rows on the Kickstarter workspace remained unchanged. The Owl workspace stores the exact imported `need_item` lineage and evidence. Re-running reconciliation with identical inputs adds no duplicate report or evidence.

Reproduce the source collection and decision from the retained inputs with:

```sh
pnpm prior-work:reconcile
pnpm migrate
pnpm exec vitest run --testTimeout 20000
pnpm exec tsc --noEmit
pnpm build
```

The reconciliation command consumes the retained, hash-pinned source collection by default. To refresh it, run `pnpm prior-work:collect`, then pass the emitted collection path to `pnpm prior-work:reconcile <collection-path>`. Incomplete issue or linked-PR retrieval now persists as candidate-level `BLOCKED` with source failures; it cannot become an empty-thread confirmation. The full suite passed with a 20-second per-test timeout because the existing PGlite migration tests can exceed Vitest's 5-second default under Codex Cloud load.

The repository had no `DATABASE_URL`; the versioned migrations and persistence verification used the existing PGlite local database. PostgreSQL runtime behavior was not verified in this environment.

## Verification results

- `pnpm migrate` reapplied the complete versioned SQL set successfully on PGlite.
- `pnpm exec vitest run --testTimeout 20000`: 18 files, 109 tests passed, including failed-comment, unavailable-thread, and unavailable-PR rejection cases.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm build`: passed.
- Production HTTP smoke checks rendered both saved workspaces. The Kickstarter page showed its candidate-level `ALREADY_ADDRESSED` state and no contact draft; the Owl Pilot page showed `CONTACT_WORTHY`, `NOT_SENT_AWAITING_USER_APPROVAL`, and `NOT_READY` for pilot readiness.
- Repeated `pnpm prior-work:reconcile` runs produced the same corrected report hash and left the original qualification, source-evidence and follow-up counts unchanged.

## Gate status

- **Gate A — prior-work reconciliation: PASS.** The same reusable collector, exact-capability event model and reducer were exercised on Kickstarter/CrowdCell, CKAutomata, and the independently preselected LucentDEx control. Answers, reported/code-observed changes, testnet demonstration, open PR progress and unrelated thread discussion remain distinct.
- **Gate B — contact-readiness qualification: PASS.** The original ten were reassessed. Contact-worthiness does not require a confirmed participant; contact, expressed interest, and pilot readiness are separate evidence states. One specific draft is saved and unsent; no candidate is marked pilot-ready.
- **External outcome: `NO_EXTERNAL_PARTICIPATION_VERIFIED`.** No message, response, tester activity, pilot, adoption, or partnership was created by this work.

These gates do not claim mainnet production readiness, completed CrowdCell PR #14, a formal CKAutomata audit, or user testing for Owl Pilot.
