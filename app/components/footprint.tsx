import Link from 'next/link';
import type {technicalFootprints,footprintObservations} from '../../lib/schema';
import {WorkspaceDialog} from '../workspace-dialog';

type Footprint = typeof technicalFootprints.$inferSelect;
type Observation = typeof footprintObservations.$inferSelect;

/** Only link immutable source snapshots on GitHub. Never render imported URLs directly. */
function sourceUrl(observation: Observation): string | null {
  try {
    const repo = new URL(observation.repository);
    const path = observation.path.split('/');
    if (repo.protocol !== 'https:' || repo.hostname !== 'github.com' || repo.port || repo.username || repo.password ||
      !/^\/[\w.-]+\/[\w.-]+$/.test(repo.pathname) || !/^[a-f0-9]{40}$/.test(observation.revision) ||
      path.some(part => !part || part === '.' || part === '..') || observation.startLine < 1 ||
      observation.endLine < observation.startLine) return null;
    const file = path.map(encodeURIComponent).join('/');
    return `${repo.origin}${repo.pathname}/blob/${observation.revision}/${file}#L${observation.startLine}`;
  } catch { return null; }
}

export function FootprintLink({footprint, projectName}: {footprint: Footprint; projectName?: string}) {
  return <div>
    {projectName && <h3>{projectName}</h3>}
    <span className="tag">{footprint.status} · source analysis</span>
    <p>Revision <code>{footprint.revision.slice(0, 12)}</code> · {footprint.fileCount} files · analyzer {footprint.analyzerVersion}</p>
    <p>Observed {footprint.analyzedAt.toISOString().slice(0, 10)}. Source analysis does not prove runtime behavior or current deployment state.</p>
    <Link className="source" href={`/projects/${encodeURIComponent(footprint.projectId)}/footprints/${encodeURIComponent(footprint.id)}`}>Inspect technical footprint →</Link>
  </div>;
}

export function Unknowns({value}: {value: string}) {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { parsed = null; }
  const items = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string').slice(0, 50) : [];
  return items.length ? <ul>{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="muted">No machine-readable limitations were recorded.</p>;
}

export function ObservationCard({observation}: {observation: Observation}) {
  const url = sourceUrl(observation);
  return <article className="card">
    <span className="tag">{observation.dimension} · {observation.kind} · {observation.verification.replaceAll('_', ' ')}</span>
    <h3>{observation.fact}</h3>
    <p>{observation.path}:{observation.startLine}{observation.endLine !== observation.startLine ? `–${observation.endLine}` : ''} · revision {observation.revision.slice(0, 12)}</p>
    {url && <a className="source" href={url} rel="noreferrer">Inspect pinned source ↗</a>}
    <WorkspaceDialog label="Source excerpt and limitations"><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{observation.evidence}</pre><Unknowns value={observation.unknowns}/></WorkspaceDialog>
  </article>;
}
