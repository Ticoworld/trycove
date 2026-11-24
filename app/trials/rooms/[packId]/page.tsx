import Link from 'next/link';
import {notFound} from 'next/navigation';
import {readTrialPack} from '../../../../lib/trials/trial-packs';
import {GuidedTrialStart} from './start-client';
import {trialLogos} from '../../trial-media';
import {TrialMark} from '../../trial-visual';
import {db} from '../../../../lib/db';
import {projects, opportunities} from '../../../../lib/schema';
import {eq} from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function GuidedTrialRoomPage({params}: {params: Promise<{packId: string}>}) {
  const room = await readTrialPack((await params).packId);
  if (!room) notFound();
  const {pack, definition} = room;
  const logos=await trialLogos([definition.product.id]);
  const [product, opportunity] = await Promise.all([
    db.select({id:projects.id}).from(projects).where(eq(projects.id,definition.product.id)).limit(1),
    definition.problemMap?.opportunityId ? db.select({id:opportunities.id}).from(opportunities).where(eq(opportunities.id,definition.problemMap.opportunityId)).limit(1) : Promise.resolve(null),
  ]);
  const available = product.length > 0 && (opportunity === null || opportunity.length > 0);
  return <div className="studio studio-entry">
    <div className="studio-top"><Link className="studio-wordmark" href="/">trycove<span>●</span></Link>
      <Link href="/trials">All Trial Rooms</Link></div>
    <div className="invitation">
      <div className="invitation-copy">
        <div className="product-identity"><TrialMark name={definition.product.name} logo={logos.get(definition.product.id)}/><span className="trial-network">{definition.application.network} · {definition.tasks.length} {definition.tasks.length===1?'task':'tasks'}</span></div>
        <h1>Try {definition.product.name}</h1>
        <p>{definition.description}</p>
        <div className="invitation-mobile-journey"><h2>The journey</h2><ol>{definition.tasks.map((task,index)=><li key={task.id}><span>{index + 1}.</span> {task.title}</li>)}</ol></div>
        {definition.request && <p>{definition.request.kind === 'builder-declared' ? 'Builder-declared testing request' : 'Externally sourced testing request'} · {definition.request.text}
          {definition.request.sourceUrl && <> · <a href={definition.request.sourceUrl}>Source</a></>}</p>}
        {definition.prerequisites?.length ? <><h2>Before you start</h2><ul>{definition.prerequisites.map((item, i) => <li key={i}>{item}</li>)}</ul></> : null}
        <h2>Safety restrictions</h2><ul>{definition.safety.map((item, i) => <li key={i}>{item}</li>)}</ul>
        {pack.state !== 'published' && <p>Enrollment is {pack.state}.</p>}
        {!available && <p role="status">This trial is temporarily unavailable because its required records are incomplete.</p>}
        <GuidedTrialStart packId={definition.id} enrollmentOpen={pack.state === 'published' && available}/>
      </div>
      <aside className="invitation-path"><h2>The journey</h2><ol>
        {definition.tasks.map((task, index) => <li key={task.id}><span>{index + 1}</span><strong>{task.title}</strong></li>)}
      </ol></aside>
    </div>
  </div>;
}
