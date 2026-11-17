# Grid3 → CKB Viz transaction-link experiment

This experiment applies to the engine-selected candidate recorded in `evidence/tc-01e/discovery/`. It is deliberately restricted to browser navigation from a source-observed Grid3 transaction link to CKB Viz's network-scoped transaction route.

## Reproduce

The source checkouts are prepared outside the execution container. Clone without running package lifecycle scripts and check out the exact commits:

```sh
mkdir -p /tmp/tc01e-upstream
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/truthixify/grid3.git /tmp/tc01e-upstream/grid3
git -C /tmp/tc01e-upstream/grid3 checkout --detach abaaaf7b6812e0515e1191b949314fa295543979
git -c core.hooksPath=/dev/null clone --no-checkout https://github.com/truthixify/ckb-viz.git /tmp/tc01e-upstream/ckb-viz
git -C /tmp/tc01e-upstream/ckb-viz checkout --detach ccaf766df6e19d8da787d39aadda9aea084cd64a
pnpm install --frozen-lockfile
pnpm tc01e:run:transaction-inspector -- --source-root /tmp/tc01e-upstream
```

The fixed runner checks the selected-candidate identity, both repository URLs and full commit IDs, a clean checkout, every file hash in `profile.json`, the adapter and fixture hashes, and the pinned runtime image before it runs. It bundles only the reviewed modules, executes with no network in a read-only restricted container, and deletes the transient bundle and staging directory afterward. It accepts a source-root location, not arbitrary commands or user-supplied code.

## Cases and limits

The positive path executes Grid3's pinned constants and CKB Viz's real `buildUrl`, `parseLocation` and `isValidTxHash` functions through the Trycove adapter. Negative cases reject a malformed hash, devnet, route rewriting and an invalid provider route. The fixture value comes from Grid3's `SCRIPT_CELL_DEP.outPoint.txHash`; it is a source-declared CellDep hash, not a transaction produced by Grid3 or independently confirmed on chain.

Grid3's React signer hook and page were inspected and hash-checked but are not executed. The run does not query CKB RPC, sign, submit, broadcast, confirm transaction inclusion, validate a live deployment, or prove adoption or maintainer approval. The repositories reported no GitHub license metadata and no root license file at the pinned revisions. Upstream source is not included in Trycove's committed adapter or retained in the execution bundle.
