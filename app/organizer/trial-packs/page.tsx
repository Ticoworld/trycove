import {authenticatedUser,checkProjectPermission} from '../../../lib/authorization';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '../../../lib/db';
import {asc, eq} from 'drizzle-orm';
import {evidence, opportunities, projects, trialPacks} from '../../../lib/schema';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {readPackVersion} from '../../../lib/trials/trial-packs';
import {changeState} from './actions';
import {TrialPackEditor, type Draft} from './editor';

export const dynamic = 'force-dynamic';
const path = '/organizer/trial-packs';
const empty: Draft = {
  id: '', productId: '', description: '',
  request: {kind: 'builder-declared', text: ''},
  application: {name: '', url: '', network: '', version: ''},
  prerequisites: [], safety: [],
  tasks: [{id: 'task-1', title: '', instructions: '', observe: []}],
};

export default async function TrialPackOrganizer({searchParams}: {searchParams: Promise<{room?: string; error?: string; project?: string}>}) {
  const organizer = await hasOrganizerSession();
  const {room, error, project} = await searchParams;
  const scope = project ? 'project=' + encodeURIComponent(project) : '';
  let canPublish = organizer;
  if (!organizer) {
    const user = await authenticatedUser();
    if (!user) redirect(project ? '/account' : '/organizer?return=' + encodeURIComponent(path));
    if (!project) notFound();
    try {await checkProjectPermission(db,user.id,project,'edit');} catch {notFound();}
    try {await checkProjectPermission(db,user.id,project,'publish'); canPublish = true;} catch { /* Maintainers can edit drafts. */ }
  }
  const [allPacks, allProducts, sources] = await Promise.all([
    db.select().from(trialPacks).orderBy(trialPacks.id),
    db.select({id: projects.id, name: projects.name}).from(projects).orderBy(asc(projects.name)),
    db.select({id: evidence.id, productId: opportunities.projectA, claim: evidence.claim,
      url: evidence.sourceUrl, revision: evidence.revision, opportunityId: opportunities.id})
      .from(evidence).innerJoin(opportunities, eq(evidence.opportunityId, opportunities.id))
      .where(eq(opportunities.kind, 'user-testing')).orderBy(evidence.id),
  ]);
  const products = organizer ? allProducts : allProducts.filter(item => item.id === project);
  const versions = await Promise.all(allPacks.map(async pack => ({
    pack, definition: await readPackVersion(pack.id,pack.latestVersion),
  })));
  const visible = organizer ? versions : versions.filter(item => item.definition.product.id === project);
  const packs = visible.map(item => item.pack);
  const pack = packs.find(item => item.id === room);
  if (room && !pack) notFound();
  const definition = visible.find(item => item.pack.id === room)?.definition ?? null;
  const source = sources.find(item => item.productId === definition?.product.id
    && item.opportunityId === definition?.problemMap?.opportunityId
    && (definition?.request
      ? item.url === definition.request.sourceUrl && item.claim === definition.request.text
        && item.revision === (definition.request.revision ?? null)
      : item.url === definition?.problemMap?.sourceUrl));
  const editable: Draft | null = definition && {
    id: definition.id, productId: definition.product.id, description: definition.description ?? '',
    request: (definition.request?.kind === 'externally-sourced' || (!definition.request && definition.problemMap))
      ? {kind: 'externally-sourced', evidenceId: source?.id ?? 0}
      : {kind: 'builder-declared', text: definition.request?.text ?? ''},
    application: definition.application, prerequisites: definition.prerequisites ?? [],
    safety: definition.safety, tasks: definition.tasks, testingMode: definition.testingMode,
  };

  return <section className="section stack">
    <h1>Trial Packs</h1>
    <nav className="bar"><Link href={scope ? path + "?" + scope : path}>Create a room</Link>
      {packs.map(item => <Link key={item.id} href={`${path}?room=${item.id}${scope ? "&" + scope : ""}`}>{item.id} · {item.state}</Link>)}</nav>
    {error && <p role="alert">{error}</p>}
    {pack && definition && <article className="card stack">
      <h2>Preview · {definition.product.name}</h2>
      <p>Saved version {pack.latestVersion} · {pack.state}{pack.publishedVersion !== null && ` · published version ${pack.publishedVersion}`}</p>
      <p>{definition.description}</p>
      <p>{definition.application.name} · {definition.application.network} · {definition.application.version}</p>
      <p>{definition.request?.text}</p>
      <ol>{definition.tasks.map(task => <li key={task.id}>{task.title} — {task.instructions}<ul>
        {task.observe.map((item, i) => <li key={i}>{item}</li>)}</ul></li>)}</ol>
      <p>{definition.prerequisites?.join(' · ')}</p>
      <p>{definition.safety.join(' · ')}</p>
      {pack.publishedVersion !== null && <Link href={`/trials/rooms/${pack.id}`}>Open tester link</Link>}
      {canPublish && pack.state !== 'closed' && <div className="bar">
        {([
          ['published', 'Publish this version'],
          ['paused', 'Pause enrollment'],
          ['closed', 'Close room'],
        ] as const).filter(([state]) => state !== 'paused' || pack.state === 'published').map(([state, label]) =>
          <form action={changeState} key={state}>
            <input type="hidden" name="id" value={pack.id}/>
            <input type="hidden" name="version" value={pack.latestVersion}/>
            <input type="hidden" name="project" value={project ?? ""}/>
            <input type="hidden" name="state" value={state}/>
            <button className={state === 'published' ? 'button' : 'button secondary'}>{label}</button>
          </form>)}
      </div>}
    </article>}
    {pack?.state !== 'closed' && <TrialPackEditor key={pack ? pack.id + '/' + pack.latestVersion : 'new'}
      initial={editable ?? {...empty,productId: organizer ? "" : project ?? ""}} products={products} sources={organizer ? sources : sources.filter(item => item.productId === project)} editing={!!pack} scopedProduct={organizer ? undefined : project}/>}
  </section>;
}
