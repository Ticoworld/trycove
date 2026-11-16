# CellGuard × CrowdCell pledge: controlled cross-source experiment

Executed in Codex Cloud on 2026-11-16. Reproduce from the Trycove repository root with `scripts/benchmarks/run-pledge.sh`. The command exited **0**; [pledge-run.log](pledge-run.log) contains its complete stdout/stderr (SHA-256 `88ec77fadd64cdd71a97526f037565de628bbd56a1b4a802fdc91f856bca8e40`). No transaction was signed with a real key or broadcast.

The runner checks out CrowdCell `0835ad42decf2c9594fa92a185eea4cee9eba622` and CellGuard `2bb3182adb1a5d00bca24e2068f790a50e8e2d70`. It verifies the SHA-256 of the CrowdCell frontend page, serializer and retry classifier, parses the actual pledge loop with TypeScript, and produces temporary JavaScript from that loop and the actual serializer and stale-error classifier. Its only change to the loop replaces its combined `signer.sendTransaction(tx)` call with a test-only guarded submission hook. It runs the extracted source along with CellGuard's actual `analyzeTransaction` and `toCkbRpcTransaction` in a disposable Node container. The rest of CrowdCell's React page and its network-dependent campaign lookup are not run.

The isolated worker uses synthetic scripts, outpoints, capacities and campaign data. Its `Transaction.from`, input selection, fee completion, signer and submission boundary are mocks. CellGuard receives a v2 policy requiring a complete transaction shape, at least three outputs and the five synthetic code dependencies. Additional experimental checks compare the campaign input and successor, accumulator data, pledge and receipt scripts and data against the fixture. This is **not** the finalize-specific bridge or a deployment-ready pledge policy. CellGuard checks occupied output capacity using its own implementation; mock input capacity and fee completeness are not chain-verified. A SHA-256 digest of the normalized signed-like transaction is used only as an integrity fingerprint, not represented as a CKB transaction hash.

Seven assertions passed:

1. A synthetic pledge built by the extracted CrowdCell loop passed CellGuard and fixture-specific checks and reached the mock submitter.
2. An insufficient-capacity pledge output was rejected before mock submission.
3. Wrong pledge data with the correct shape was rejected by the experimental pledge checks.
4. A missing synthetic CellDep was rejected by CellGuard.
5. A mutation after checking was caught by the fingerprint check before the mock submitter.
6. A simulated `Unknown(OutPoint(` failure was classified by CrowdCell's extracted classifier; the loop rebuilt with a different mock campaign outpoint, re-ran the guard and reached the mock submitter again.
7. A malformed rebuilt transaction was rejected before the second mock submission.

Host: Node `v24.22.1`, TypeScript `5.9.3`, Docker client/server `29.9.2`. Container: `node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5`, Node `v24.22.3`. Execution uses `--network none`, a read-only root and input mount, a non-root user, dropped capabilities, no-new-privileges, a 192 MiB memory limit, a 32-process limit, one CPU, a 60-second timeout, and no mounted credentials. The host clones public source for read-only preparation; the code runs only in the restricted container. Generated upstream-derived files are temporary and removed on exit.

This is actual execution of selected code from both projects with synthetic dependencies, **not** a real CCC transaction build, real fee/coin selection, valid signature, CKB VM execution, node acceptance, testnet integration or independent reproduction. It does not establish that the guard is complete or that any deployment is safe. The observed repository tree contains no CrowdCell `LICENSE` or `COPYING` file; no CrowdCell source or candidate patch is redistributed here. The intended integration boundary requires an author-reviewed, deployment-specific policy and a separately reviewed signing/submission change. CellGuard's source is MIT-licensed; the runner copies it only into its temporary, deleted execution directory.

Artifact digests:

- `scripts/benchmarks/prepare-pledge.cjs`: `4d19452d812dbc5fa3d2abee61dd84c14372b06653ce60bfee53ebd01588a58f`
- `scripts/benchmarks/pledge-worker.mjs`: `da5d618522be5c389589cce3f265e131ae4ffab0d6af721fd2a10587540cc28d`
- `scripts/benchmarks/run-pledge.sh`: `64f8a17571c1c5cc1c4e0c742dcedc3357f4478dfe3381ca75b9c1b92579fd46`
