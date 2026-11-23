# DATA-01C catalog qualification

The 64 source-backed candidates received 51 QUALIFIED, 13 REVIEW REQUIRED and zero EXCLUDE decisions. The 86 deferred DATA-01B entries retain their prior status. The qualification uses the pinned CKBdapps description, canonical slug, directory claims and source provenance for every decision. A qualified record is eligible as a source-attributed historical listing. Present availability remains unknown. Twelve pending decisions concern CKB scope or provenance and one concerns the BitKeep and Bitget Wallet identity relationship.

Grid3 and CrowdCell remain searchable and unmapped because their retained descriptions concern gaming and crowdfunding, respectively. The preview also withholds misleading secondary placements for Imagination, JoyID, .bit, Credora, Fiber Dashboard and Sluice. Original category signals remain queryable and Passports retain original directory attribution.

| Qualified identities | Classified | Unmapped | Project-domain placements |
|---:|---:|---:|---:|
| 51 | 49 | 2 | 60 |

| Payments | Funding | Identity | Chain Data | Trading | Developer Tools | Safety | Digital Assets | Cross-chain |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 8 | 4 | 12 | 5 | 4 | 22 | 0 | 5 | 0 |

Run `node --import tsx scripts/recover-qualified-catalog.ts` against the checkout. It allocates a new PGlite database, validates the reviewed IDs and pinned provenance, imports original rows with the existing importer, and verifies exact memberships and replay stability. Run the preview in an isolated app environment on loopback with `TRYCOVE_QUALIFIED_PREVIEW=1` and the generated PGlite path. The preview intersects the existing classifier's source evidence with approved domains. The database contains 51 source records, 40 repository claims and 78 original category signals. The full recovered dataset was left intact.

TypeScript, the production build, six classifier tests and the qualification recovery assertions passed. Chromium verified Payments, Identity, Trading, Unmapped, search and canonical Passport navigation with source attribution at desktop and mobile sizes. The bounded repository checks corroborated public source references for the examples below. Functionality and availability were not tested through those links.

- [CKB On-ramp](https://github.com/RetricSu/ckb-on-ramp)
- [Grid3](https://github.com/truthixify/grid3)
- [Cellula](https://github.com/LusoCryptoLabs/cells-contracts)
- [CKB Explorer](https://github.com/nervosnetwork/ckb-explorer-frontend)

PostgreSQL parity and production identity collision checks remain release gates.

[Decision manifest](../evidence/data-01c/qualified-catalog.json) · [Desktop](../evidence/data-01c/map-1440.png) · [Mobile](../evidence/data-01c/map-390.png)
