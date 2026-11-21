import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readTrialPack} from '../../../../lib/trials/trial-packs';
import {GuidedTrialStart} from './start-client';

export const dynamic = 'force-dynamic';

export default async function GuidedTrialRoomPage({params}: {params: Promise<{packId: string}>}) {
  const room = await readTrialPack((await params).packId);
  if (!room) notFound();
  const {pack, definition} = room;
  return <div className="studio studio-entry">
    <div className="studio-top"><Link className="studio-wordmark" href="/">trycove<span>●</span></Link>
      <Link href={`/projects/${encodeURIComponent(definition.product.id)}`}>Back to project</Link></div>
    <div className="invitation">
      <div className="invitation-copy">
        <div className="product-identity"><span className="product-mark" aria-hidden="true">{definition.product.name[0]}</span>
          <div><strong>{definition.product.name}</strong><small>{definition.application.network}</small></div></div>
        <h1>Try {definition.product.name}</h1>
        <p>{definition.description}</p>
        {definition.request && <p>{definition.request.kind === 'builder-declared' ? 'Builder-declared testing request' : 'Externally sourced testing request'} · {definition.request.text}
          {definition.request.sourceUrl && <> · <a href={definition.request.sourceUrl}>Source</a></>}</p>}
        {definition.prerequisites?.length ? <><h2>Before you start</h2><ul>{definition.prerequisites.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}
        <h2>Safety restrictions</h2><ul>{definition.safety.map((item, i) => <li key={i}>{item}</li>)}</ul>
        {pack.state !== 'published' && <p>Enrollment is {pack.state}.</p>}
        <GuidedTrialStart packId={definition.id} enrollmentOpen={pack.state === 'published'}/>
      </div>
      <aside className="invitation-path"><h2>What you’ll explore</h2><ol>
        {definition.tasks.map((task, index) => <li key={task.id}><span>{index + 1}</span><strong>{task.title}</strong></li>)}
      </ol></aside>
    </div>
  </div>;
}
