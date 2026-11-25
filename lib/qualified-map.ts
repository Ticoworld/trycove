import {and, eq, exists, notInArray, or, sql} from 'drizzle-orm';
import {projects, sourceRecords, trialPacks, trialPackVersions} from './schema';
import manifest from '../evidence/data-01c/qualified-catalog.json';
import baseline from '../evidence/data-01b/publication-manifest.json';
import type {ClassificationEvidence} from './problem-map';

const qualified = new Map<string, {approvedDomains: string[]; sourceUrl: string; revision: string}>(manifest.decisions.filter(row => row.outcome === 'QUALIFIED').map(row => [row.id, row]));

export function qualifiedPreviewEnabled() {
  return process.env.TRYCOVE_QUALIFIED_PREVIEW === '1';
}

export function isQualifiedHistorical(id: string) {
  return qualifiedPreviewEnabled() && qualified.has(id);
}

export function projectQualifiedMemberships(id: string, memberships: Map<string, ClassificationEvidence[]>) {
  if (!qualifiedPreviewEnabled()) return memberships;
  const decision = qualified.get(id);
  return new Map([...memberships].flatMap(([domain, evidence]) => {
    if (!decision?.approvedDomains.includes(domain)) return [];
    const supported = evidence.filter(row => row.kind === 'directory-category' &&
      row.sourceUrl === decision.sourceUrl && row.revision === decision.revision);
    return supported.length ? [[domain, supported] as const] : [];
  }));
}

export function qualifiedCatalogCondition() {
  const notReference = sql`${projects.id} not like 'organizer-ref-%'`;
  if (!qualifiedPreviewEnabled()) return notReference;
  const historical = manifest.decisions.filter(row => row.outcome === 'QUALIFIED').map(row => and(
    eq(projects.id, row.id),
    eq(projects.revision, row.revision),
    eq(projects.sourceUrl, row.sourceUrl),
    eq(projects.description, row.description),
    exists(sql`(select 1 from ${sourceRecords} where ${sourceRecords.projectId} = ${projects.id}
      and ${sourceRecords.id} = ${row.sourceId} and ${sourceRecords.sourceUrl} = ${row.sourceUrl}
      and ${sourceRecords.revision} = ${row.revision} and ${sourceRecords.source} = 'CKBdapps JSON')`),
  ));
  // Release integration can retain previously public, published Trial Room products.
  // A reviewed catalog identity never bypasses its qualification decision.
  const publishedLegacy = process.env.TRYCOVE_INCLUDE_PUBLISHED_LEGACY === '1' ? and(
    notInArray(projects.id, baseline.entries.map(row => row.id)),
    exists(sql`(select 1 from ${trialPacks} inner join ${trialPackVersions}
      on ${trialPackVersions.packId} = ${trialPacks.id}
      and ${trialPackVersions.version} = ${trialPacks.publishedVersion}
      where ${trialPacks.state} = 'published'
      and ${trialPackVersions.definition}::jsonb -> 'product' ->> 'id' = ${projects.id})`),
  ) : undefined;
  return and(notReference, or(...historical, publishedLegacy));
}
