# TC-01D Qualification and Supply-Gap Handoff

Checked on 2026-11-17 UTC against the imported Trycove corpus. This is a product qualification result, not external participation.

## Baseline and selection

- Starting commit: `ebeb8cc08c40ada51b11b28e4fa0fa4e9a30ea25`.
- The live PGlite corpus contained 231 projects, 385 signals, 856 active atomic needs across 49 projects, 23 latest footprints and 42,049 footprint observations.
- The needs interpreter found 78 actionable items: adoption 1, distribution 1, product feedback 8, security review 20, technical integration 3, technical review 40 and validation 5. It found no explicitly classified user-testing item; Owl Pilot's current product-feedback request explicitly asks for user testing and was included.
- The existing matcher exposed one structured candidate (CKB Escrow × Cellora) and no code-observation candidates. There were 15 provider intents. This is a sparse provider inventory, not evidence that the wider ecosystem has no provider.
- The deterministic ten-entry shortlist retained the engine candidate, selected the newest active need from distinct source issues for available intent classes, then filled by source revision recency. It did not include supplied project pairs. The input snapshot SHA-256 is `257ae9da5f65b7bd309b0f6b009eece769da5d8937e525bd8f022dd28624009e`; candidate-pool SHA-256 is `aa09ddd08229362745d11e867ef4bc09151451101edff3a1ce7157fb2fe8b7ea`.

## Candidate decisions

| Builder need | Result | Qualification finding |
|---|---|---|
| pckt distribution | `NEEDS_CONFIRMATION` | Public request is dated May 6 and an open issue does not confirm present interest. No distribution channel owner was evidenced. |
| CKBolt security/mainnet review | `NEEDS_CONFIRMATION` | Recent public request, but no qualified independent CKB/Fiber reviewer was in the candidate pool. Test-funds use is not an audit or mainnet-readiness claim. |
| Cellula.id lock-authorization review | `BLOCKED` | Specific review question, no reviewer identified, and current source refresh was partial. Planned SDK filtering is not evidence of an independently validated policy. |
| CKB Kickstarter production indexer | `BLOCKED` | Strongest unresolved source-backed need, but its potential Cellora reviewer is an old unconfirmed human offer and the current-state check was partial. |
| CKB Escrow indexing review × Cellora | `BLOCKED` | Closest engine match; request is older and Cellora's same historical offer remains unconfirmed. This is a review lead, not a current service integration. |
| Freight on Nervos naming/wallet guidance | `BLOCKED` | Current public ask remains in an open issue updated November 16, but no specific naming or wallet reviewer/partner was evidenced. |
| EventMesh validation | `BLOCKED` | Proposed two-operator Fiber/CKB test is a design, not an executed experiment; no independent operator or receiver was identified. |
| ckb-cycle-tools outside use | `BLOCKED` | The author reports no outside user and asks whether another project can author `cycles.json`; no opted-in adopter was evidenced. |
| Owl Pilot UX testing | `BLOCKED` | Current issue requests testers; no tester pool or volunteer was identified. A broad project demonstration marker is not user-testing evidence. |
| CKAutomata independent review | `ALREADY_ADDRESSED` | The exact narrow request for initial review guidance received detailed public comments from accounts distinct from the project author; the maintainer responded with changes and closed the issue. This does not establish a formal audit, verified fixes, mainnet readiness or adoption. |

Of the ten source checks, two were complete and eight partial. The partial results retain HTTP 429 and redirect failures; those failures were not treated as evidence that no prior art or provider exists. A direct authenticated, read-only GitHub check confirmed current issue state and that each exact atomic excerpt remained in its public issue body. The CKAutomata review comments were preserved separately with author attribution and timestamps.

## Selected supply gap

**No candidate qualified as a pilot.** The supply-gap brief records CKB Kickstarter's exact request from [CKBuilder issue #6](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/6): its indexer is described as locally run and exposed through ngrok, and the builder asks whether production should use its own CKB node/indexer or a public mainnet service. The issue was still open and last updated November 11 at the time of the check. That supports a current public question; it does not prove that the builder still wants external help.

The closest alternative is CKB Escrow's indexing architecture request. The CKB Kickstarter issue is newer, retains a concrete deployment choice and gives a measurable review output. Cellora's [April 28 issue #12](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/12) offers a 20-minute architecture call for apps with non-trivial indexing needs, but it describes a human review offer and work planned before API and reorganization handling lands. It is not a verified production service or a confirmed available reviewer. The discovery engine preserved the offer as a rejected `offer_type_mismatch` alternative to the technical-integration intent; independent qualification treated it as a partial review fit that requires reconfirmation.

The brief proposes a bounded architecture review only if the builder and reviewer separately confirm interest. It asks for a written decision across self-hosting, a specifically verified public service, and deferring production exposure. It defines success as a documented operating model and checklist for node/indexer ownership, data persistence, reorganization handling, monitoring, recovery and unresolved costs. It does not claim that the review, collaborator or service exists today.

The saved outcome is `NO_QUALIFIED_PILOT`. No contact was sent, no introduction or response was recorded, and the selected workspace has no follow-up entries. External outcome: `NO_EXTERNAL_PARTICIPATION_VERIFIED`.

## Saved product record and evidence

- Workspace: `/opportunities/need-53135c9a7743cd070658f7756be90c5b`.
- Qualification report: `qualification-review-3b32928287de878a.json`, SHA-256 `6ac6f89baa79a76ff18fbb8ea79e3eafd886d742da849ac0fcf81d2c357aadc4`.
- Source issue state and exact-body checks: `github-issue-state-2026-11-17.json`.
- CKAutomata public review comments: `ckautomata-review-comments-2026-11-17.json`.
- Duplicate-row audit copy: `evidence-dedup-audit.json`. It preserves all six rows before cleanup. Three exact duplicates from early local test runs were removed, retaining one copy of each source claim; the current transactional writer was then run twice with zero new evidence rows.
- Persisted record verification: `persistence-verification.json`, SHA-256 `4322834ea7606fb49e74c868acf8327d5cfe5d3ed81a7821cde879cd96678109`. It confirms the review JSON equals the saved database content, three source records remain, three review snapshots are unique, and follow-up count is zero.

## Reproduction and verification

```sh
pnpm migrate
pnpm opportunity:pool
pnpm opportunity:verify <saved-candidate-pool.json>
pnpm opportunity:qualify
pnpm opportunity:verify-record
pnpm exec vitest run --maxWorkers=1 --minWorkers=1
pnpm exec tsc --noEmit
pnpm build
```

The frozen input snapshot, pool, source checks, reviewer annotations and report preserve the exact qualification inputs and decisions. Rebuilding the pool requires the same imported corpus snapshot; live source refresh is bounded and can change as upstream sources change. `pnpm exec vitest run --maxWorkers=1 --minWorkers=1` passed 97 tests; TypeScript and the production build passed. The Next.js production server returned HTTP 200 for `/opportunities` and the selected workspace; content checks confirmed the exact need, provider caveat, `ALREADY_ADDRESSED` regression result, public review evidence, next action, and no-send state.

Migrations were applied repeatedly against local PGlite 0.5.16. No `DATABASE_URL`, `psql` or `pg_isready` was available, so PostgreSQL service behavior is unverified.

## Acceptance

- **Gate A — PASS:** ten source-backed candidates were reviewed; currentness, alternatives, prior work, missing providers and partial source refreshes are explicit. The strongest need was not promoted into an unsupported collaboration.
- **Gate B — PASS:** a reproducible `NO_QUALIFIED_PILOT` supply-gap brief is persisted and visible in the existing Opportunity Workspace, with the exact need, sources, alternatives, missing evidence and next human action.
- **External outcome — `NO_EXTERNAL_PARTICIPATION_VERIFIED`:** nothing was sent and no participation/adoption is claimed.
- **TC-01D — PASS for its two acceptance gates.** This result does not demonstrate an external collaboration, builder response or adoption.

## Delivery

- Implementation and evidence commit: `5ba1bd4894d58bdb403dcf3b07a1196bafdd1201`, pushed fast-forward to `origin/main` and verified with `git ls-remote`. This handoff is a follow-up commit; the final remote tip is recorded in the completion response.
