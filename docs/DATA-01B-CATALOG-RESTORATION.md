# DATA-01B staging catalog restoration

The loopback staging app runs on port 3148 in a separate app copy with no serving environment files. Its PGlite catalog is in the new trycove-data01b-mc3BF5 temporary directory. Docker's Linux engine was unavailable. PostgreSQL import parity remains unverified.

Run the focused recovery verification from the repository root with `node --import tsx scripts/recover-staging-catalog.ts`. It allocates a fresh temporary store, clears the PostgreSQL connection variables for its migration child, verifies journal 0001 through 0020, validates the pinned SHA-256, imports and tests the five-project cohort, then processes the full snapshot. The app and migration process must use this isolated store sequentially.

| Stage | IDs | Sources | Repository claims | Category signals | Classified IDs | Unmapped IDs | Memberships |
|---|---:|---:|---:|---:|---:|---:|---:|
| Pilot | 5 | 5 | 4 | 7 | 4 | 1 | 5 |
| Full | 150 | 150 | 49 | 187 | 136 | 14 | 158 |

Regional memberships are 10 Payments, 41 Funding, 20 Identity, 12 Chain Data, 31 Trading, 24 Developer Tools, 5 Safety, 13 Digital Assets and 2 Cross-chain. Memberships can overlap. Every computed placement was checked against its source signal, revision, attribution and verification. The repeat imports preserved full row contents and IDs. A deliberate signal-provenance conflict rolled back a transaction that also attempted to insert a new project and its related records.

All 150 entries are represented in the publication manifest. It lists 64 source-backed candidates and 86 requiring review, including relevance or association review. Zero entries were blocked. Review entries are visible in isolated staging only. No entries are approved for promotion. Possible associations include imtoken with imtokenventures and the Community Fund DAO with its dashboard. No identity merges took place. The snapshot supplied directory claims only. Availability remains unknown, and no builder needs, intents, capabilities or trial records were generated.

TypeScript, the webpack production build and six existing focused classifier tests passed, in addition to the recovery script assertions. Chromium checked the populated Map at desktop 1440px and mobile 390px. Desktop verification covered the five pilot domains and 14 unmapped projects. Both viewports exercised Grid3 search, the mini-passport source attribution and imported-claim label, and navigation to the canonical Product Passport with its CKBdapps JSON source.

[Publication manifest](../evidence/data-01b/publication-manifest.json) · [Desktop](../evidence/data-01b/map-1440.png) · [Mobile](../evidence/data-01b/map-390.png)
