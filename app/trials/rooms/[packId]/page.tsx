import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readTrialPack} from '../../../../lib/trials/trial-packs';
import {GuidedTrialStart} from './start-client';
import {trialLogos} from '../../trial-media';
import {TrialMark} from '../../trial-visual';

export const dynamic = 'force-dynamic';

export default async function GuidedTrialRoomPage({params}: {params: Promise<{packId: string}>}) {
  const room = await readTrialPack((await params).packId);
  if (!room) notFound();
  const {pack, definition} = room;
  const logos=await trialLogos([definition.product.id]);
  return <div className="studio studio-entry">
    <div className="studio-top"><Link className="studio-wordmark" href="/">trycove<span>●</span></Link>
      <Link href="/trials">All Trial Rooms</Link></div>
    <div className="invitation">
      <div className="invitation-copy">
        <div className="product-identity"><TrialMark name={definition.product.name} logo={logos.get(definition.product.id)}/><span className="trial-network">{definition.application.network} · {definition.tasks.length} {definition.tasks.length===1?'task':'tasks'}</span></div>
        <h1>Try {definition.product.name}</h1>
        <p>{definition.description}</p>
        {definition.request && <p>{definition.request.kind === 'builder-declared' ? 'Builder-declared testing request' : 'Externally sourced testing request'} · {definition.request.text}
          {definition.request.sourceUrl && <> · <a href={definition.request.sourceUrl}>Source</a></>}</p>}
        {definition.prerequisites?.length ? <><h2>Before you start</h2><ul>{definition.prerequisites.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}
        <h2>Safety restrictions</h2><ul>{definition.safety.map((item, i) => <li key={i}>{item}</li>)}</ul>
        {pack.state !== 'published' && <p>Enrollment is {pack.state}.</p>}
        <GuidedTrialStart packId={definition.id} enrollmentOpen={pack.state === 'published'}/>
      </div>
      <aside className="invitation-path"><h2>The journey</h2><ol>
        {definition.tasks.map((task, index) => <li key={task.id}><span>{index + 1}</span><strong>{task.title}</strong></li>)}
      </ol></aside>
    </div>
  </div>;
}
