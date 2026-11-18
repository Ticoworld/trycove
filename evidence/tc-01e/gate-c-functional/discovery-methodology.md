# TC-01E Gate C functional discovery freeze

Frozen before selecting the fresh cohort or evaluating any new product relationships.

- Frozen at: `2026-11-18T09:10:24Z`
- Baseline repository commit: `533422e84b652ec73c70c16c4b3bf7bfeba8f952`
- TC-01E implementation baseline: `511e2a820bbb9b755a8762357c36d6450e648ef2`
- Input inventory: the already-imported CKBdapps JSON and CKB Pulse snapshots in the local Trycove database. No inventory refresh is part of this attempt.
- Historical evidence: the 12-repository TC-01E cohort, its scans, discoveries and receipts remain unchanged and are not inputs to the new candidate ranking.

## Frozen cohort algorithm

1. Read CKBdapps JSON repository claims already imported into Trycove. Normalize each to lowercase `owner/repository`.
2. Exclude claims that map to multiple imported product identities and repository paths with any existing pinned footprint. Retain all source claim rows and explicit exclusion reasons in the cohort artifact.
3. Sort remaining repository paths by ascending SHA-256 of the lowercase path. Select the first 12, independent of code, feature, issue, pull request, owner preference or anticipated match.
4. Pin each selected repository to the full commit returned by `git ls-remote ... HEAD` before source inspection. Record pin failures and do not replace a failed selection with a later row.
5. Scan the frozen selected repositories once with the bounded Trycove source scanner. Retain every success, partial result and failure. Do not widen or replace the cohort.

## Frozen capability family and role rules

Evaluate **CKB read-only data-query composition** only: consumer application logic that obtains transaction data or live-cell data, and a different product that exposes a concrete executable RPC/API/SDK boundary able to answer that same operation.

- Consumer evidence must be a source-observed query call in a non-test application path, with evidence that its returned transaction/cell data participates in an application result, state transition or user-visible task. A dependency declaration, uncalled wrapper, test, fixture, generic CKB keyword or network label is insufficient.
- Provider evidence must identify an exported SDK method, concrete RPC/API operation or server handler implemented by the provider, with request/response or argument/return types and source location. A provider's own use of a third-party RPC client, a documentation-only claim, or a generic “CKB RPC” string is insufficient.
- The boundary must map the consumer operation to the provider's exact method/route, request parameters, response fields, CKB network, version/dependency expectations, freshness/finality assumptions and security/trust constraints. Missing items remain explicit incompatibilities or unknowns.
- Exclude self-pairs, identical repository identities, same GitHub owner, and pairs with source or imported identity evidence that the same builder maintains both products. If builder independence is unresolved, do not present the pair as evidence of connecting previously isolated builders.
- Rank eligible edges lexicographically by (1) exact operation and filter/response-shape compatibility, (2) direct consumer use in a user-facing functional path, (3) provider implementation completeness and interface specificity, (4) network/version alignment, (5) builder independence evidence. Use ascending SHA-256 of the ordered source observation IDs only to break a complete tie. No score may compensate for a missing mandatory role or boundary requirement.
- Preserve all rejected edges with the failed criterion. If no edge meets the rules, report no defensible candidate and stop after this bounded cohort.

## Post-discovery checks and execution

Only after the matcher selects an edge, inspect the products' prior implementation and bounded public prior-art sources. An existing implementation changes novelty status; issues and pull requests do not influence cohort selection or candidate ranking.

For any selected edge, execute pinned consumer application logic through the pinned provider implementation and the versioned adapter. Use a real operation, positive and realistic negative cases, and a functional baseline comparison. Isolate execution with no credentials, no privilege, bounded filesystem/network/resources and cleanup. If source licensing does not permit redistribution, retain only Trycove-authored adapter code and hashes/metadata; do not commit third-party source or bundles.

## Bounded stopping rule

The cohort is exactly the first 12 eligible hash-ordered repositories, with failed inspections retained in place. No named project is preselected. Do not add repositories, re-seed the ordering, use issues/PRs to choose candidates, or reinterpret a rejected edge to force Gate C. This is one Phase 1 attempt; record the actual result and stop.
