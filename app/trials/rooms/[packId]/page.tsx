import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getGuidedTrialDefinition} from '../../../../lib/trials/room-definitions';
import {GuidedTrialStart} from './start-client';

export const dynamic = 'force-dynamic';

export default async function GuidedTrialRoomPage({params}: {params: Promise<{packId: string}>}) {
  const {packId} = await params;
  const definition = getGuidedTrialDefinition(packId);
  if (!definition) notFound();

  return <>
    <section className="hero">
      <Link className="eyebrow" href={`/projects/${encodeURIComponent(definition.product.id)}`}>← {definition.product.name} Product Passport</Link>
      <h1>Guided Trial Room</h1>
      <p>Attempt the actual {definition.application.name} flow and record what happened, one task at a time. Trycove does not recreate the wallet or approve actions for you.</p>
      <div className="bar"><a className="button" href={definition.application.url} target="_blank" rel="noreferrer">Open Owl Pilot ↗</a><Link className="button secondary" href={`/map/${definition.problemMap.slug}#${definition.problemMap.opportunityId}`}>Open linked Problem Map request ↗</Link></div>
    </section>
    <section className="section" aria-labelledby="pilot-trial-app">
      <div className="eyebrow">Application under test</div><h2 id="pilot-trial-app">{definition.application.name}</h2>
      <article className="card"><p><strong>Live application:</strong> <a className="source" href={definition.application.url} target="_blank" rel="noreferrer">{definition.application.url}</a></p><p><strong>Network:</strong> {definition.application.network}</p><p><strong>Version:</strong> {definition.application.version}</p><p><strong>Linked source request:</strong> <a className="source" href={definition.problemMap.sourceUrl} target="_blank" rel="noreferrer">CKBuilder issue #51 ↗</a></p>{definition.application.relatedApps.map((app) => <p key={app.url}><strong>Related test app:</strong> <a className="source" href={app.url} target="_blank" rel="noreferrer">{app.name} ↗</a> — {app.role}</p>)}</article>
    </section>
    <section className="section" aria-labelledby="guided-trial-tasks"><div className="eyebrow">Four real tasks</div><h2 id="guided-trial-tasks">What to try</h2><div className="grid guided-trial-task-grid">{definition.tasks.map((task, index) => <article className="card" key={task.id}><span className="tag">Task {index + 1}</span><h3>{task.title}</h3><p>{task.instructions}</p><ul>{task.observe.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>
    <section className="section" aria-labelledby="trial-safety"><div className="eyebrow">Before starting</div><h2 id="trial-safety">Keep your account in your control</h2><ul className="guided-trial-safety">{definition.safety.map((item) => <li key={item}>{item}</li>)}</ul><GuidedTrialStart packId={definition.id} /></section>
  </>;
}
