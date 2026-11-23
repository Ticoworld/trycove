import {inArray} from 'drizzle-orm';
import type {PgliteDatabase} from 'drizzle-orm/pglite';
import {projects, projectRepositories, signals, sourceRecords} from './schema';
import * as schema from './schema';
import {CKBDAPPS_PAGE, CKBDAPPS_URL, localized, metadataClaims, parseCkbDappsFeed, repositoryUrl, safeHttpUrl, sha256} from './sources/ckbdapps-json';

export const snapshotRevision = 'd1c5b55359c34d331c474593573e08bbbc7939ecc090db729e24b6945a002658';
export const snapshotPath = `evidence/tc-01e/sources/ckbdapps-projects-${snapshotRevision.slice(0, 16)}.json`;
export const pilotIds = ['ckb-on-ramp', 'grid3', 'cellula', 'ckbexplorer', 'arweave'];

export function prepareCatalog(raw: Buffer) {
  if (sha256(raw) !== snapshotRevision) throw new Error('Pinned catalog digest mismatch');
  const observedAt = new Date('2026-11-17T20:31:04.339Z');
  const feed = parseCkbDappsFeed(raw.toString('utf8'));
  if (feed.source !== CKBDAPPS_PAGE) throw new Error('Unexpected catalog source');

  const rows = feed.projects.map(row => {
    const sourceUrl = safeHttpUrl(row.page?.en) ?? CKBDAPPS_URL;
    const provenance = {sourceUrl, revision: snapshotRevision, observedAt};
    const website = safeHttpUrl(row.url) ?? null;
    const repository = repositoryUrl(row.github) ?? null;
    const projectId = row.slug;
    const description = localized(row.tagline) ?? '';
    return {
      project: {id: projectId, name: row.name, description, website, repository, ...provenance},
      source: {
        id: `ckbdapps-json-${projectId}-${snapshotRevision.slice(0, 16)}`,
        projectId, source: 'CKBdapps JSON', ...provenance,
        raw: JSON.stringify({feedSource: CKBDAPPS_URL, feedSha256: snapshotRevision, feedObservedAt: observedAt.toISOString(), record: row}),
      },
      repositories: repository ? [{
        id: `ckbdapps-repo-${sha256([projectId, repository.toLowerCase()].join('\0')).slice(0, 28)}`,
        projectId, repository, ...provenance, role: 'CKBdapps JSON repository claim',
        verification: 'imported_claim; product/repository relationship not independently verified',
      }] : [],
      signals: metadataClaims(row).filter(claim => claim.kind === 'product-category').map(claim => ({
        id: `ckbdapps-meta-${sha256([projectId, claim.kind, claim.concept, claim.claim].join('\0')).slice(0, 24)}`,
        projectId, ...claim, ...provenance, verification: 'imported_claim; not independently verified',
      })),
      ecosystemListing: row.group === 'eco',
      issues: [
        ...(!description || !row.name.trim() ? ['insufficient-provenance'] : []),
        ...(row.url && !website || row.github && !repository ? ['invalid-claimed-link'] : []),
      ],
    };
  });

  const shared = (value: string | null, key: 'website' | 'repository' | 'name') => value === null ? [] :
    rows.filter(row => row.project[key]?.trim().replace(/\/$/, '').toLowerCase() === value.trim().replace(/\/$/, '').toLowerCase())
      .map(row => row.project.id);
  const manifest = rows.map(({project, source, ecosystemListing, issues}) => {
    const aliases = [...new Set([
      ...shared(project.name, 'name'), ...shared(project.website, 'website'), ...shared(project.repository, 'repository'),
      ...(['ckbcfdao', 'ckb-community-fund-dao'].includes(project.id) ? ['ckbcfdao', 'ckb-community-fund-dao'] : []),
    ])].filter(id => id !== project.id);
    const review = [
      ...issues,
      ...(aliases.length ? ['requires-identity-review'] : []),
      ...(ecosystemListing ? ['requires-ckb-relevance-review'] : []),
    ];
    return {
      id: project.id, name: project.name, sourceId: source.id, sourceUrl: source.sourceUrl,
      availability: 'historical-availability-unknown',
      outcome: issues.length ? 'blocked' : review.length ? 'review-required' : 'source-backed-candidate',
      review, aliases, fixture: false, publicPromotionApproved: false,
    };
  });
  return {rows: rows.filter((_, index) => manifest[index].outcome !== 'blocked'), manifest};
}

export type CatalogRow = ReturnType<typeof prepareCatalog>['rows'][number];

export async function importCatalog(database: PgliteDatabase<typeof schema>, rows: CatalogRow[]) {
  const projectRows = rows.map(row => row.project);
  const sources = rows.map(row => row.source);
  const repositories = rows.flatMap(row => row.repositories);
  const categorySignals = rows.flatMap(row => row.signals);
  if (!projectRows.length) throw new Error('Empty catalog recovery selection');

  function verify<T extends {id: string}>(expected: T[], actual: T[]) {
    const byId = new Map(actual.map(row => [row.id, row]));
    for (const row of expected) {
      const stored = byId.get(row.id);
      if (!stored || Object.entries(row).some(([key, value]) =>
        JSON.stringify(stored[key as keyof T]) !== JSON.stringify(value))) {
        throw new Error(`Catalog ID or provenance conflict for ${row.id}`);
      }
    }
  }

  return database.transaction(async tx => {
    await tx.insert(projects).values(projectRows).onConflictDoNothing();
    await tx.insert(sourceRecords).values(sources).onConflictDoNothing();
    if (repositories.length) await tx.insert(projectRepositories).values(repositories).onConflictDoNothing();
    if (categorySignals.length) await tx.insert(signals).values(categorySignals).onConflictDoNothing();
    verify(projectRows, await tx.select().from(projects).where(inArray(projects.id, projectRows.map(row => row.id))));
    verify(sources, await tx.select().from(sourceRecords).where(inArray(sourceRecords.id, sources.map(row => row.id))));
    if (repositories.length) verify(repositories, await tx.select().from(projectRepositories)
      .where(inArray(projectRepositories.id, repositories.map(row => row.id))));
    if (categorySignals.length) verify(categorySignals, await tx.select().from(signals)
      .where(inArray(signals.id, categorySignals.map(row => row.id))));
  });
}
