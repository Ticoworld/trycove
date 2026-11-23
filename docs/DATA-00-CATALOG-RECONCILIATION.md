# DATA-00 Catalog Reconciliation

## A. Executive finding

**PARTIAL.** The running Next development server on port 3010 has a populated DATABASE_URL in its process environment. The database factory in [lib/db.ts](../lib/db.ts) therefore selects PostgreSQL. The historical 231-project verification used local PGlite. This establishes an environment split. The PostgreSQL inventory and exact cause of its apparent two-project catalog remain unverified because a dedicated authorized read-only role was unavailable.

The default local PGlite store independently reproduces two unmapped projects. Both lack source records and all three membership inputs are empty. The same pattern appears in several later stores. The audit found no accessible local copy of the historical catalog.

## B. Database inventory

Local stores have pseudonyms in this report. Resolved paths and backups are retained locally outside the checkout with a private Windows ACL. The inspected Next server uses PostgreSQL and had no local PGlite override. Process inspection and read-only file handles that denied write/delete sharing guarded capture. File metadata was compared across capture. Each copied store was opened in a separate disposable directory and process. One browser test copy still had a PGlite engine startup abort. Its backup was preserved for later compatibility review.

| Environment | Migration journal | Projects / distinct IDs | Classified / unmapped | Opportunities / evidence |
|---|---|---:|---:|---:|
| Current development PostgreSQL | Unknown | Unknown | Unknown | Unknown |
| Hosted production and verification PostgreSQL configurations | Unknown | Unknown | Unknown | Unknown |
| Default local | 0001–0017 | 2 / 2 | 0 / 2 | 1 / 1 |
| Before trial-pack migration | 0001–0016 | 1 / 1 | 0 / 1 | 1 / 1 |
| Before second product | 0001–0017 | 1 / 1 | 0 / 1 | 1 / 1 |
| Cold backup | 0001–0017 | 2 / 2 | 0 / 2 | 1 / 1 |
| Cold backup verification | 0001–0017 | 2 / 2 | 0 / 2 | 1 / 1 |
| Owl working copy | 0001–0017 | 2 / 2 | 0 / 2 | 1 / 1 |
| TC-02B disposable | Absent | 1 / 1 | 0 / 1 | 1 / 0 |
| TC-03 preflight | Absent | 1 / 1 | 0 / 1 | 1 / 1 |
| TC-03 migration check | 0001–0016 | 0 / 0 | 0 / 0 | 0 / 0 |
| Workspace UX test | 0001–0020 | 3 / 3 | 0 / 3 | 0 / 0 |
| TC-03 browser test | Engine startup abort | Unknown | Unknown | Unknown |

Every successfully opened copy had zero source records across all source types, signals across all kinds, repository associations, structured needs, intents, candidate capabilities, external snapshots, footprints, footprint observations, execution receipts and trial runs. Every project lacked a source-record row. All nine regional counts and all classification evidence counts were zero. The schema includes the catalog and Map tables even on the journal-less copies.

Counts are complete for the named tables on the readable copies. In a read-only transaction, list public tables with pg_tables, query the journal with SELECT version FROM trycove_migrations ORDER BY version, and count projects with SELECT count(*), count(DISTINCT id) FROM projects. Use SELECT count(*) for the other tables, GROUP BY source for source_records and external_source_snapshots, and GROUP BY kind for signals. Count uncovered projects with NOT EXISTS on source_records.project_id = projects.id. Roll back and close, then run getProblemMapOverview against the same disposable copy with DATABASE_URL cleared and the explicit PGlite override. Count membership keys per project, evidence-array lengths, and projects without memberships. No project payloads were written to the audit output.

## C. Historical baseline comparison

The [locked roadmap](TRYCOVE_LOCKED_ROADMAP.md) records 231 imported identities, 149 with a supported placement and 82 unclassified. The default local store has 229 fewer total rows, 149 fewer classified rows and 80 fewer unclassified rows by count. These deltas compare populations and do not prove deletion or shared identities. The historical region counts were 12 payments, 42 funding, 22 identity, 19 chain data, 31 trading, 26 developer tools, 9 contract safety, 13 digital assets and 2 cross-chain. Placements overlap.

[The Map overview](../lib/problem-map-data.ts) selects every project, then builds memberships from category and bounded claim signals, intents and recorded candidate capabilities. The category branch requires product-category and the exact CKBdapps prefix before applying directory rules. Source claims require a configured phrase. The [Map page](../app/map/page.tsx) passes the result to the explorer, whose Unmapped control selects projects with empty memberships. Runtime execution on the local copies confirms correct unmapped handling for absent evidence. No local row reached the stage of having evidence that the rules then rejected. The live data and category rule coverage against the historical catalog remain unverified. The current selection differs from the historical environment, and the local copies exhibit absent identities and evidence. There is no observed earlier-to-later row history demonstrating deletion or incomplete transfer. Missing later migrations do not explain the sparse default local store because its Map tables exist and a fully journaled test store is also sparse.

## D. Source preservation

- The retained CKBdapps JSON payload contains exactly 150 entries by parsing its projects array. Its SHA-256 is d1c5b55359c34d331c474593573e08bbbc7939ecc090db729e24b6945a002658. The adjacent import receipt retains ingestion metadata. [Payload](../evidence/tc-01e/sources/ckbdapps-projects-d1c5b55359c34d33.json) · [Receipt](../evidence/tc-01e/sources/ckbdapps-import-d1c5b55359c34d33.json)
- The README records the pinned CKBdapps Markdown revision and CKBuilder README revision through the handoff, which reports 74 historical CKBuilder rows. The issue collection and review retain bounded issue content and source checks. They are evidence for the documented scope. [TC-01 handoff](TC-01.md) · [Issue snapshot](../evidence/tc-01d/github-issue-state-2026-11-17.json) · [Review](../evidence/tc-01d-r1/report.md)
- TC-01E reports 150 historical JSON source rows, 106 retained repo-detail snapshots, 81 pinned footprints and 355,230 observations. The tracked source folder retains Pulse state, repository responses, and import receipts with revision and hash metadata. The database counts are historical report observations. [TC-01E report](../evidence/tc-01e/report.md) · [Source artifacts](../evidence/tc-01e/sources/)
- Two local reviewed public manifests have one project each. The Owl manifest also has one opportunity and one evidence row. Both have zero source and repository rows. Their array counts corroborate the shape of the limited local data and cannot establish the provenance of every database row.

## E. Identity risks

Project primary keys provide distinct stored IDs. Multiple source and repository rows can point to one product. CKBdapps Markdown uses filename-derived IDs, and refreshing a reused slug can overwrite a row under that key. Check source slugs and ID mappings before any transfer. CKBuilder issue ingestion can associate an issue with an existing product or retain an issue-specific identity. Preserve source IDs, timestamps and revisions. Source-local records, issue references and repository counts are separate from canonical identity counts.

No readable store showed repeated normalized project names, websites or primary repositories when grouped separately by lowercased trimmed name or lowercased URL with a trailing slash removed. None contained a project ID starting with ckbuilder-issue-. These tests cover the sparse copies only and leave cross-source identity unknown. Shared sites and repositories require corroboration. Preserve multiple association roles for one product and use stable GitHub repository IDs to review rename candidates, as the Pulse adapter does. One of the three UX test IDs matched the fixture/editor/test-product heuristic. That is a fixture candidate, and public qualification still requires provenance review for all three rows. The two default rows are existing source-less records with correct unmapped behavior. Their publication eligibility is a separate decision.

## F. Recoverability

- **Directly recoverable** Two stored IDs, one opportunity and one evidence row are available together from the default local copy. The two reviewed manifests are additional narrow transfer inputs. Zero identities from the historical 231 were verified as directly recoverable with their historical source rows. The full recoverable count remains unknown.
- **Recoverable from retained snapshots** 150 CKBdapps JSON entries can provide source claims for identity review. Pinned Markdown and CKBuilder material, issue collections and Pulse payloads can supply evidence within their retained scope. Overlap prevents adding these counts to infer unique products.
- **Requires source refresh** Only missing observations that matter to an approved recovery cohort. A refresh should add a new observation with the correct revision and time.
- **Requires review** Alias or collision candidates, issue-to-product mapping, fixture status, public qualification and every classification whose inputs are missing or unsupported.
- **Unknown or inaccessible** PostgreSQL inventory, failed browser test copy and original catalog continuity. Metadata alone cannot recreate historical decisions, source scans or execution receipts. Existing reviewed artifacts preserve the conclusions they actually record.

## G. Proposed restoration sequence

1. Quiesce writers, capture private consistent backups and verify a second copy opens. Obtain an authorized read-only aggregate inventory of the actual PostgreSQL target. Preserve the current serving database and rollback point before any later transfer.
2. Create an isolated staging target. Keep original stores and first-generation backups offline. Keep the ledger private.
3. Compare the schema and ordered journal against [scripts/migrate.ts](../scripts/migrate.ts), which expects a contiguous prefix through 0020. Journal-less existing schemas require validation against the original chain before baselining. Exercise migration compatibility on staging only, including remapping or checking foreign-key dependencies. PGlite physical files are unsuitable as a hosted PostgreSQL transfer format.
4. Prefer verified original rows if the full catalog is found. Otherwise select a reviewed cohort from retained snapshots. The [public-history importer](../scripts/import-public-history.ts) requires PostgreSQL and a SHA-256-pinned v1 manifest. Its transaction accepts up to 300 projects and 1,200 rows per other array. It keeps project, source, repository, opportunity and evidence IDs, skips insert conflicts, then reads rows back to check collisions and provenance before committing. Repeat the same manifest in staging to check idempotency. [Implementation](../lib/public-history.ts)
5. Review collisions before applying any export. Preserve stable source IDs and all links. Put uncertain associations and fixture candidates aside for qualification.
6. Account separately for signals, structured needs, intents, candidate capabilities, external snapshots and execution evidence. The public-history importer has no arrays for these, footprints, sessions, follow-ups or private notes. A manifest-only transfer can produce a larger unmapped catalog. Preserve independently documented evidence where verified, and retain unsupported projects as unmapped. Keep upstream claims, hypotheses, independent tests and adoption separate.
7. Approve only source-backed public rows and verify the transfer contains no fixtures, private session material or credentials. Approved feedback uses a distinct, tester-approved export and importer per the [hosting runbook](TRYCOVE_STAGE_2_HOSTING.md).
8. Verify exact project/source counts and ID sets, provenance links, regional overlaps, unmapped counts and Product Passport links on staging. Verify one negative fixture case, one valid unmapped record and several verified supported placements.
9. Obtain explicit deployment approval against a reviewed manifest and measured staging results. Keep a pre-change backup and the prior database binding. If verification fails, restore the prior binding or restore from the pre-change snapshot under controlled approval. Preserve the failed staging artifacts for diagnosis.

## H. Risks and blockers

An old or missing journal can break migration continuity even when Map tables respond. Taking data from a writer or booting a first-generation backup can compromise preservation. Bulk re-import can duplicate aliases or replace sources. A manifest without Map inputs can omit historical placements. The current catalog query has no fixture exclusion at its initial project select, so fixture separation belongs in public qualification. Production and verification database states require credentials with SELECT-only privileges or an operator-provided aggregate export. Diagnose the failed browser-test copy with its matching PGlite runtime before any recovery attempt.

Database originals were used only for capture and metadata checks. No migrations, imports, seeds, classification rebuilds or deployments ran. The SQL evaluation used disposable copies and there were no production writes. No credentials or private records are included. The report is the only tracked deliverable.

## I. Next bounded work order

DATA-01A should acquire the current PostgreSQL SELECT-only inventory and compare it to the default two-row store. Locate the database behind the roadmap verification using its original environment or backup provenance. If found, inventory exact row and ID overlaps with the live target. If unavailable, prepare a review-only mapping for a small cohort of at most ten retained CKBdapps entries covering clear identity, a possible association collision and a genuinely unmapped product. Produce a source-to-canonical mapping, fixture exclusions and a per-project list of missing Map inputs. End at approval of a staging transfer plan before changing any serving database.
