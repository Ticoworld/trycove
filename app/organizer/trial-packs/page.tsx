import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '../../../lib/db';
import {trialPacks} from '../../../lib/schema';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {readPackVersion} from '../../../lib/trials/trial-packs';
import {changeState, saveDraft} from './actions';

export const dynamic = 'force-dynamic';
const path = '/organizer/trial-packs';
const example = {
  id: 'product-testing', productId: 'existing-project-id', description: 'What testers will explore',
  request: {kind: 'builder-declared', text: 'What the builder wants to learn'},
  application: {name: 'Application name', url: 'https://example.com/', network: 'CKB Testnet', version: 'Hosted preview'},
  prerequisites: ['List any wallet, account, faucet or token requirements'],
  safety: ['Use testnet only'],
  tasks: [{id: 'first-task', title: 'Open the app', instructions: 'Open the app and find the main navigation.', observe: ['Is the next action clear?']}],
};

export default async function TrialPackOrganizer({searchParams}: {searchParams: Promise<{room?: string; error?: string}>}) {
  if (!await hasOrganizerSession()) redirect(`/organizer?return=${encodeURIComponent(path)}`);
  const {room, error} = await searchParams;
  const packs = await db.select().from(trialPacks).orderBy(trialPacks.id);
  const pack = packs.find(item => item.id === room);
  const definition = pack ? await readPackVersion(pack.id, pack.latestVersion) : null;
  const editable = definition && {
    id: definition.id, productId: definition.product.id, description: definition.description,
    request: definition.request?.kind === 'builder-declared' ? definition.request : {kind: 'externally-sourced', evidenceId: null},
    application: definition.application, prerequisites: definition.prerequisites ?? [],
    safety: definition.safety, tasks: definition.tasks,
  };

  return <section className="section stack">
    <h1>Trial Packs</h1>
    <nav className="bar"><Link href={path}>Create a room</Link>
      {packs.map(item => <Link key={item.id} href={`${path}?room=${item.id}`}>{item.id} · {item.state}</Link>)}</nav>
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
      {pack.state !== 'closed' && <form action={changeState} className="bar">
        <input type="hidden" name="id" value={pack.id}/><input type="hidden" name="version" value={pack.latestVersion}/>
        <button className="button" name="state" value="published">Publish this version</button>
        {pack.state === 'published' && <button className="button secondary" name="state" value="paused">Pause enrollment</button>}
        <button className="button secondary" name="state" value="closed">Close room</button>
      </form>}
    </article>}
    {pack?.state !== 'closed' && <form action={saveDraft} className="card stack">
      <label htmlFor="trial-definition">{pack ? 'Edit definition' : 'New room definition'}</label>
      <p>Use an existing Product Passport ID. For an external request, use a request object with kind “externally-sourced” and a saved testing evidence ID.</p>
      <textarea id="trial-definition" name="definition" rows={22} required defaultValue={JSON.stringify(editable ?? example, null, 2)}/>
      <button className="button">Save draft and preview</button>
    </form>}
  </section>;
}
