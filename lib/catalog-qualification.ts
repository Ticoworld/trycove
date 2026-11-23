import decisions from '../evidence/data-01c/qualified-catalog.json';
import baseline from '../evidence/data-01b/publication-manifest.json';
import {prepareCatalog, snapshotRevision} from './catalog-recovery';
import {classifyDirectoryCategory} from './problem-map';

export function selectQualifiedCatalog(raw: Buffer, manifest = decisions) {
  const {rows} = prepareCatalog(raw);
  const sources = new Map(rows.map(row => [row.project.id, row]));
  const candidates = new Set(baseline.entries.filter(row => row.outcome === 'source-backed-candidate').map(row => row.id));
  if (manifest.revision !== snapshotRevision || manifest.decisions.length !== candidates.size) {
    throw new Error('Unexpected qualification revision or candidate count');
  }
  return manifest.decisions.flatMap(decision => {
    const row = sources.get(decision.id);
    if (!row || !candidates.delete(decision.id) || row.source.id !== decision.sourceId ||
      row.source.sourceUrl !== decision.sourceUrl || row.source.revision !== decision.revision ||
      row.project.description !== decision.description || decision.availability !== 'unknown') {
      throw new Error(`Unexpected qualification identity or provenance for ${decision.id}`);
    }
    const domains = new Set(row.signals.flatMap(signal =>
      classifyDirectoryCategory(signal.claim.slice('CKBdapps category: '.length)).map(domain => domain.slug)));
    const reviewed = [...decision.approvedDomains, ...decision.withheld.map(item => item.domain)];
    if (reviewed.length !== domains.size || new Set(reviewed).size !== domains.size ||
      reviewed.some(domain => !domains.has(domain)) ||
      !['QUALIFIED', 'REVIEW REQUIRED', 'EXCLUDE'].includes(decision.outcome) ||
      (decision.outcome !== 'QUALIFIED' && decision.approvedDomains.length)) {
      throw new Error(`Unexpected placement decision for ${decision.id}`);
    }
    return decision.outcome === 'QUALIFIED' ? [row] : [];
  });
}
