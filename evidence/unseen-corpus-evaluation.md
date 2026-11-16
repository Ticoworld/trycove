# Pair-blind connection evaluation

Run date: 2026-11-16. The machine-readable record is [`unseen-corpus-evaluation.json`](unseen-corpus-evaluation.json).

## Evaluation design and coverage

The evaluator used seed `trycove-blind-20261116`, selected consumers from source-recorded needs before checking whether their repositories had previously been scanned, and did not receive target pairs. At `--size 49`, it evaluated all 49 projects with an imported need/obstacle from the current 230-project inventory: 164 source claims, of which 26 became specific need intents. It searched all imported provider claims and all available pinned source observations. The selection spans integration, testing, distribution/adoption, and feedback/review claims.

The selected cohort was not filtered for prior footprints. In the final snapshot, 37 of 49 projects had no source footprint. After selecting consumers, the repository backfill recovered CKB Escrow’s two issue-linked repositories and the final run included both scans. This is a full census of the imported need-bearing subset, not a representative test of the whole 230-project inventory. The bounded taxonomy left 138 claim records unclassified; the engine did not promote those broad claims.

## Findings

| Pair | Engine relation | Assessment |
| --- | --- | --- |
| CKB Geo-Wars × Cellora | Explicit technical-review offer | New local pair finding in this run. Geo-Wars asks about lock/type queries and indexer reliability in [CKBuilder issue 23](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/23). At `9e8424d0a857ef80799070ff44071c72363cfc57`, four board-state paths call CCC `findCells`, including [`findSettledBoardByType.ts:11`](https://github.com/Felabs1/ckb-geo-wars/blob/9e8424d0a857ef80799070ff44071c72363cfc57/client/src/chain/boardState/findSettledBoardByType.ts#L11) and [`findStateCellByLock.ts:10`](https://github.com/Felabs1/ckb-geo-wars/blob/9e8424d0a857ef80799070ff44071c72363cfc57/server/src/boardState/findStateCellByLock.ts#L10). Cellora’s [issue 12](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/12) explicitly offers a 20-minute call to apps with non-trivial indexing needs. Its pinned [`GET /v1/cells` route](https://github.com/Antismart/cellora/blob/a534c38f248c0406eeafee94adadb8c2c9072f8a/crates/api/src/routes/cells.rs#L152) accepts exactly one lock or type hash and uses liveness and cursor parameters. This is an offered architecture review, not a service integration. Availability, auth, deployment, query semantics, and any response remain unknown. |
| CKB Escrow × Cellora | Explicit technical-review offer | A second specific review lead from the same blind run. [Issue 26](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/26) asks how to index terminal escrow history; the author links both the frontend and Rust contracts. The ingestion backfill now retains those repository associations with issue provenance. At frontend revision `eed20bc30bdde02cb4cd1a7e7e518941fd1a1591`, `packages/escrow-app/src/service.ts:39` calls `findCells`, and `packages/escrow-app/src/preflight.ts:20,39` checks live-cell status. Cellora’s route exposes lock/type-hash cell queries with liveness and pagination, but the service is not a demonstrated history backend for this escrow app. A bounded architecture review could test whether the API’s consumed-cell and cursor semantics meet the terminal-history need. No integration or response is recorded. |
| CKB Devnet Explorer × ckb-cycle-tools | Documented technical need | The explorer asks about per-script-group cycle analysis in [issue 50](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/50). The pinned repositories expose a raw-transaction route (`src/explorer.ts:366`, revision `b6aef5571bbe5a112b4809881a1b6229095f6da7`) and `planReplay`/`replayGroups` (`src/replay.ts:294,382`, revision `23182e2abce64d0574cae7acd3229bc87424d0d0`). A public issue search returned one related-tools mention, [issue 46](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/46); it is not evidence of an integration proposal, but this pair is not counted as wholly unmentioned. Runtime compatibility remains unknown. |
| DripFund × Cellora | Explicit technical-review offer | Existing local DripFund × Cellora investigation makes this a rediscovery, not novelty evidence. |

The issue search used exact quoted project-name pairs in GitHub’s public issue search. It returned zero issue results for `"ckb-geo-wars" "cellora"` and `"ckb-escrow" "cellora"`, and one result for `"ckb-devnet-explorer" "ckb-cycle-tools"` (issue 46). Local repository evidence was also searched. This check covers public GitHub issues only; it does not rule out forum posts, pull requests, alternate names, private discussions, or unpublished proposals.

## Rejections and hard negatives

The blind run rejected six same-scope pairs: two because a review offer was incorrectly being considered for a technical-integration need, and four because a technical capability was being considered for a human-review request without an explicit offer. It did not promote the 138 claims that failed specific-scope extraction. Regression tests also reject pckt’s sender-profile identity need against Credora’s DID-recipient resolution capability, generic wallet/transaction/feedback overlap, and disjoint explicitly declared networks. A CKB tester need can match an explicit tester offer without requiring code integration; no such real pair appeared in this corpus.

## Trial attempt and blocker

I checked out ckb-cycle-tools v1.3.0 at `23182e2abce64d0574cae7acd3229bc87424d0d0` and installed its locked dependencies in a disposable directory with `npm ci --ignore-scripts --no-audit --no-fund` (127 packages; Node v24.22.1). Its WebAssembly debugger loaded and returned `ckb-debugger 0.200.1`. I attempted the tool’s documented testnet transaction `0x52a1b3ba45a28614c30ddc52f0795c164141abbebd1558e6c69fb0ac45fada50` through `planReplay` and a read-only testnet RPC.

The executed command and relevant output were:

```text
$ node --import tsx /tmp/run-ckb-cycle-wasm.mts
debugger=ckb-debugger 0.200.1
Error: get_transaction: cannot reach https://testnet.ckb.dev/ (EAI_AGAIN)
```

A standard JSON-RPC `get_transaction` request through the configured outbound proxy then returned HTTP 403. No transaction replay ran, so there are no measured script groups or compatibility result. I stopped at the denied endpoint and did not try alternate endpoints or claim the README’s recorded cycle value as this run’s result.

The executable compatibility gate for Explorer × ckb-cycle-tools is therefore **BLOCKED by RPC access in this environment**. The Geo-Wars × Cellora and CKB Escrow × Cellora findings are actionable review opportunities, but their human offers have not been reconfirmed or accepted. No maintainer was contacted.

## Reproduction

```sh
pnpm sync:issue-repositories
pnpm intelligence:footprints --project ckbuilder-issue-26 --limit 2
pnpm intelligence:blind --seed trycove-blind-20261116 --size 49
```

The RPC attempt used upstream ckb-cycle-tools at the pinned revision above and its documented testnet transaction. It did not execute a transaction replay because the node request was denied/unresolvable.
