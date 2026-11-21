import Link from 'next/link';
import {declarations} from '../../lib/declarations';

export async function BuilderDeclarations({projectId, testingOnly = false}: {projectId?: string; testingOnly?: boolean}) {
  const items = await declarations(projectId,testingOnly);
  if (!items.length) return null;
  return <section className="section">
    <h2>{testingOnly ? 'Builder-declared testing needs' : 'Builder declarations'}</h2>
    <p>Authenticated project members supplied these declarations. Runtime compatibility remains unknown.</p>
    <div className="grid">{items.map(item => <article key={item.id} className="card">
      <h3>{item.kind.replaceAll('-', ' ')}</h3>
      {!projectId && <Link href={'/projects/' + encodeURIComponent(item.projectId)}>{item.product}</Link>}
      <p>{item.content}</p>{item.prerequisites && <p>{item.prerequisites}</p>}
    </article>)}</div>
  </section>;
}
