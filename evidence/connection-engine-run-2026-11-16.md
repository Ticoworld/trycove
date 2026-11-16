# Connection Engine continuation — 2026-11-16

## Acceptance status

| Gate | Verdict | Evidence and remaining gap |
| --- | --- | --- |
| A. Ecosystem intelligence | PARTIAL | CKBDapps and CKBuilder table/issues import and refresh, identity corroboration, structured claim signals, and pinned repo analysis run against PostgreSQL. No CKB Pulse adapter exists yet; technical extraction is bounded. |
| B. Connection discovery | PARTIAL | A real corpus run rediscovered pckt × CellFlow from needs in both issues plus signed-relay, relay-guard, intent-tracking, and ambiguous-send source observations. The same pair was investigated earlier at commit `4a9a6cd`, so this is a regression result, not evidence of a new discovery. The candidate remains `unknown`; discovery uses a small explicit rule set, so broader semantic and architectural coverage is not established. |
| C. User workflow | PARTIAL | The production build served the project listing, pckt profile, and saved Opportunity Workspace from PostgreSQL with HTTP 200. This confirms server-rendered access, not that a builder completed a useful investigation or acted on the result. The existing follow-up form still needs an end-to-end state-change smoke test. |
| D. Cross-project experiment | PARTIAL | No safe executable pckt × CellFlow integration was possible from inspected code: neither repository includes a root license file at the pinned revisions, CCC versions differ, and direct CellFlow submission would bypass pckt's relay guard. A resolver endpoint check was blocked by the environment proxy (HTTP CONNECT 403). Existing synthetic fixtures do not establish a live integration. |
| PostgreSQL persistence and build | PASS | PostgreSQL 17 migrations were applied twice; imports, scans, discovery persistence, production build, and server-rendered page reads succeeded against that disposable database. Production service deployment and production authentication remain untested. |

## Real-data run

The import and discovery path was run against a disposable PostgreSQL 17 instance:

1. Applied all six Drizzle SQL migrations twice.
2. Imported 150 CKBDapps records at `2b2de54ed5703c4e8efd7b07ce1385cdb8fb8764` and 74 CKBuilder table records at `66357b6eb22c107ef50abff8047851d60df63751`.
3. Imported CKBuilder issues [#2](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/2), [#15](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/15), [#38](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/38), and [#39](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/39). The issue adapter saved 28 structured claim signals. Issue #39 resolved uniquely to the CKBDapps `Cellula.id` project using corroborating name, website, and repository claims; secondary repositories retain the source issue and the association remains unverified.
4. Scanned four pinned repositories: DripFund `34241019e35f4e4f00f505f5b6aac24619a1f400`, Cellula resolver `b63292873b791979b5ae26df1e2d6833f0101451`, pckt `f351c6c2eea531814e78d557b8a23c2695df292d`, and CellFlow `027ce1c4202a3e62ae504bc9aa0f14169b2ca085`.
5. Ran `pnpm intelligence:discover -- --limit 100`. The PostgreSQL run processed 4 repositories, 4,635 source observations and 14 imported needs. It saved two candidates with `unknown` compatibility conclusions. The same engine on the local PGlite corpus processed 20 repositories, 39,276 observations and 32 needs, and also returned two candidates.
6. Built the production app against PostgreSQL and smoke-requested `/projects`, the pckt profile, and the saved pckt–CellFlow Opportunity Workspace. All three returned HTTP 200 and the workspace rendered source-backed needs, code touchpoints, compatibility unknowns, the next experiment, and evidence links.

## Reconstructed known opportunity: pckt × CellFlow

The current engine rediscovered the same pckt × CellFlow relationship already documented in [`evidence/connection-investigation.md` at commit `4a9a6cd`](https://github.com/Ticoworld/trycove/blob/4a9a6cdc8a4e44755c476f18618366437b50eb85/evidence/connection-investigation.md). This is a useful regression result showing that the structured source matcher can recover an earlier investigation. It is not a new Trycove discovery and is not used as evidence for autonomous novelty.

This candidate is discovered by matching imported needs to pinned source observations; the rule does not contain either project ID.

- [CKBuilder issue #15](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/15) asks for signed-relay auditing.
- [CKBuilder issue #38](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/38) asks for integration examples other CKB applications can adopt, and for easier TypeScript/CCC integration.
- At pckt revision `f351c6c2eea531814e78d557b8a23c2695df292d`, [`frontend/src/tx.ts:115-173`](https://github.com/RobaireTH/pckt/blob/f351c6c2eea531814e78d557b8a23c2695df292d/frontend/src/tx.ts#L115) constructs and signs a packet transaction, serializes it, and calls `relayTransaction`.
- At the same revision, [`backend/src/routes/relay.rs:29-43`](https://github.com/RobaireTH/pckt/blob/f351c6c2eea531814e78d557b8a23c2695df292d/backend/src/routes/relay.rs#L29) rejects a transaction without the configured packet-lock cell dependency before calling CKB RPC.
- At CellFlow revision `027ce1c4202a3e62ae504bc9aa0f14169b2ca085`, [`packages/ccc/src/ccc.ts:137-263`](https://github.com/tydeptrai21042004/CellFlow/blob/027ce1c4202a3e62ae504bc9aa0f14169b2ca085/packages/ccc/src/ccc.ts#L137) signs, persists intent and input evidence, preflights, broadcasts through `signer.client.sendTransaction`, and records ambiguous outcomes without automatic rebroadcast.

The hypothesis is a bounded adapter experiment around pckt's existing relay: make submission uncertainty auditable and give CellFlow an integration target while retaining pckt's packet-lock guard. This remains an unverified hypothesis, not an established integration, verified compatibility, maintainer response, or adoption.

Compatibility findings stored in the workspace:

- Network and live deployments: unknown.
- Script identities and current CellDeps: not verified beyond the source-declared pckt relay guard.
- CCC core: pckt locks `1.12.5`; CellFlow's adapter declares `1.19.1`. API compatibility is unverified.
- Boundary mismatch: pckt submits the serialized transaction to a Rust relay; CellFlow's CCC wrapper broadcasts through the signer's CCC client. Replacing that path directly would bypass pckt's packet-lock check; an adapter must retain it.
- Neither cloned repository had a root license file at the pinned revision. Code reuse rights remain unresolved.

## Novelty check and experiment limits

On 2026-11-16, the exact public GitHub issue search for `"pckt" "CellFlow"` returned zero results. Searches of pckt's issues for `CellFlow` and CellFlow's issues for `pckt` returned no results. This search does not cover code, forums, other names, private discussions, or every prior proposal.

The imported DripFund × Cellula candidate is **not novel**: [DripFund issue #1](https://github.com/adisuyash/dripfund/issues/1) already proposes using `.cell` names in donation pages. A testnet health request to `https://testnet.cellula.id/api/health` previously failed at the environment proxy with HTTP CONNECT 403; it was not retried or bypassed. DripFund has no root license file in the pinned checkout. This pair remains a known proposal, not a new discovery or an executed integration.

No executable pckt–CellFlow integration was attempted: their checked-out source has no root license files, their CCC versions differ, and their current submission interfaces do not align. No other inspected pair provided a stronger license-clear experiment with the available environment. The existing CellGuard × CrowdCell harness and DripFund × Cellora differential remain synthetic/modeled checks; neither proves a live CKB transaction or compatibility. No transaction, deployment, testnet response, maintainer approval, or adoption is claimed here.

## Reproduction

With the project dependencies and imported database available:

```sh
pnpm sync
pnpm sync:builder
pnpm sync:issues 2 15 38 39
pnpm intelligence:footprints -- --project ckbuilder-pckt-27 --revision f351c6c2eea531814e78d557b8a23c2695df292d --limit 5
pnpm intelligence:footprints -- --project ckbuilder-issue-38 --repository-url https://github.com/tydeptrai21042004/CellFlow --revision 027ce1c4202a3e62ae504bc9aa0f14169b2ca085 --limit 5
pnpm intelligence:discover -- --limit 100
```
