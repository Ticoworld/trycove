# TC-01C Part 1 hardening and completion record

Follow-up to commit `8581571af02980c03887d6dcf45f66660a3fd6bc`; checked 2026-11-17.

## Gate A — PASS: current-state and prior-art verification

The Twine regression now has a **provided lifecycle baseline of `unknown`**. The latest saved verification, [`cellula-lsp-invoice-routing-20261117T035301366Z.json`](current-state/cellula-lsp-invoice-routing-20261117T035301366Z.json), records `unknown → demonstrated_in_wild`, `freshness=current`, `compatibility=unknown`, and `result=complete`. The persisted capability row and lifecycle run show the same transition; prior runs and evidence remain in history.

The bounded source refresh retrieved all 16 planned sources. It found the Twine current ref at `274ecf42890eeff5abd60e70240240d34ac10f83`, the merged pull request `feat(fiber): pay invoices with a trampoline route hint`, the Nov. 13 Talk update, the Nov. 14 Teapaw announcement, and the pinned source paths. The Talk update's latest post is dated `2026-11-13T12:02:55.764Z`; its extracted excerpt states that “a Cellula→Cellula trade given the pay link settled on testnet.” The Teapaw post is dated `2026-11-14T01:17:16Z` and says Twine works with Cellula Wallet and Fiber Studio. Source excerpts, timestamps, current revision, and content hashes are in the verification report.

This is a maintainer-reported Testnet demonstration. It does not prove independent reproduction, current payment success, production readiness, external customer use, or adoption. Compatibility remains unknown. The testnet trade does not mark every Cellula capability complete.

The source parser now reads Discourse `raw` text when available and decodes `cooked` HTML when `raw` is omitted. Request detection is limited to issue/discussion evidence and requires capability terms in the same sentence; GitHub pull-request navigation text can no longer be mistaken for an outstanding need. The earlier contradictory run is preserved at [`034626615Z`](current-state/cellula-lsp-invoice-routing-20261117T034626615Z.json) as historical evidence of the false positive that was corrected.

The Twine fixture's reviewer-supplied summary is a separate, hashed evidence item with an explicit non-verbatim provenance label. The verifier test also starts from unknown and derives a demonstrated state directly from a Discourse cooked-body response, without that prior evidence or a project-name-specific rule.

The same current-state workflow checked the independently selected Cellora review offer in [`ckb-indexing-architecture-review-offer-20261117T035410747Z.json`](current-state/ckb-indexing-architecture-review-offer-20261117T035410747Z.json): 17/17 sources fetched, current freshness, `stale_offer`, and compatibility unknown. The April 28 offer needs reconfirmation; it is not marked withdrawn.

## Gate B — PASS: offline cross-project execution

The pinned Explorer and cycle-tools experiment and its receipt are unchanged. The missing-CellDeps runner now accepts only the expected ckb-debugger exit-1 message containing `used unprovided cell dep`. A resolved profile, unrelated debugger error, or harness error aborts receipt generation. Regression tests prove the unexpected-success and unrelated-error paths fail. Re-running `pnpm experiment:ckb-cycle` against the pinned local checkouts reproduced receipt SHA-256 `260ccf5de3c7b295d20e3c482246e0c97ab9dec17358edd6332549ee7426aeec`.

Gate B remains narrowly about an offline adapter run. It does not establish fresh CKB node acceptance or add profiling to the upstream Explorer application's own user interface. Trycove displays the actual run and its limitations in the Opportunity Workspace and receipt page.

## Verification and persistence

- `pnpm test`: **71 tests passed** (12 files).
- `pnpm exec tsc --noEmit --pretty false`: passed.
- `pnpm build`: passed on Next.js 15.5.29.
- PGlite migration persistence and repeatability tests passed. PostgreSQL was unavailable; migration 0008 has not been checked against a PostgreSQL service.
- Production UI smoke checks returned HTTP 200 and expected saved content for Twine, Cellora, Explorer/cycle-tools, and the execution receipt.
- The pre-existing 230 projects, 48 opportunities, 269 evidence rows, 4 trials, 4 receipts, 45 footprints and 84,548 footprint observations remain. The database now has 231 projects, 49 opportunities, 274 evidence rows, 5 trials, 5 receipts, the same 45 footprints and 84,548 observations, plus 3 capability records, 16 lifecycle verification runs and 42 lifecycle evidence records.

## Part 1 verdict

**Gate A PASS. Gate B PASS (offline script-group execution). TC-01C Part 1 PASS.** The original historical report remains unchanged; this addendum records the later recovered public sources, corrected inference, and hardening results.
