import manifest from '../evidence/data-01c/qualified-catalog.json';
import type {ClassificationEvidence} from './problem-map';

const qualified = new Map<string, {approvedDomains: string[]; sourceUrl: string; revision: string}>(manifest.decisions.filter(row => row.outcome === 'QUALIFIED').map(row => [row.id, row]));

export function qualifiedPreviewEnabled() {
  return process.env.TRYCOVE_QUALIFIED_PREVIEW === '1';
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
