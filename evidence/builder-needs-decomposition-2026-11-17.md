# Builder need decomposition snapshot

Run date: 2026-11-17. Database: the existing local PGlite corpus. No project records or source claims were replaced.

## What the extractor did

The pipeline read all 385 imported signals. It selected 164 records whose imported source kind is `need` or `obstacle`, split their source text into 856 literal statements, and attached each statement to its project, original source URL, source revision, observation time, and character offsets in the imported claim. Those records span 49 projects and 49 issue URLs.

Each statement receives one bounded topic label and one stance label. The topic describes the subject of the source excerpt; stance distinguishes an explicit ask, a reported obstacle, a roadmap item, a status update, or ambiguous language. Labels are automated interpretations. Source statements remain unverified upstream claims. The project browser searches the excerpts and filters projects by these need categories, and each project profile links the visible fragments back to the originating source.

## Corpus counts

| Topic | Statements |
| --- | ---: |
| Feature request / capability | 173 |
| Technical review | 91 |
| Infrastructure and operations | 81 |
| Integration | 35 |
| Product feedback | 32 |
| Security | 43 |
| Validation | 16 |
| Distribution | 6 |
| Adoption | 4 |
| Unknown topic | 375 |

| Stance | Statements |
| --- | ---: |
| Explicit request | 337 |
| Reported obstacle | 14 |
| Roadmap | 21 |
| Status update | 12 |
| Ambiguous | 472 |

Counts describe extraction output, not demand volume, priority, currentness, or evidence of success. The taxonomy intentionally leaves many excerpts unknown or ambiguous.

## Examples retained with source provenance

- Adoption: “Which contract repos would try the PR Action?” — [CKBuilder-projects issue #46](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/46), ckb-cycle-tools.
- Validation: “Run it against your own devnet project...” — [issue #50](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/50), CKB Devnet Explorer.
- Distribution: “Where does a CKB-native app actually find users today...” — [issue #15](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/15), pckt.
- Technical review: Cellula.id asks reviewers to assess its authorization model — [issue #39](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/39).

## Limits

This is deterministic lexical decomposition of the current imported CKBuilder issue signals, not general language understanding. It does not infer urgency, audience size, willingness, project health, or whether a request remains open. A question or roadmap item is not automatically a matchable provider need. Original issue claims and raw source records remain available on project profiles; the new fragments link back to those same claims. No human review or external adoption is implied.
