import {WorkspaceDialog} from '../../workspace-dialog';
import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {and,desc,eq,inArray,isNull} from 'drizzle-orm';
import {authenticatedUser,checkProjectPermission} from '../../../lib/authorization';
import {db} from '../../../lib/db';
import {declarations} from '../../../lib/declarations';
import {followUps,handoffReports,historicalFeedback,projects,trialPacks} from '../../../lib/schema';
import {readPackVersion} from '../../../lib/trials/trial-packs';
import {respondToFeedback,saveDeclaration} from './actions';

export const dynamic = 'force-dynamic';

export default async function Builder({params}: {params: Promise<{id:string}>}) {
  const [{id},user] = await Promise.all([params,authenticatedUser()]);
  if (!user) redirect('/account');
  try {await checkProjectPermission(db,user.id,id,'edit');} catch {notFound();}
  const [[product], items, reports, historical] = await Promise.all([
    db.select({name:projects.name}).from(projects).where(eq(projects.id,id)),
    declarations(id),
    db.select({id:handoffReports.id, token:handoffReports.shareToken, createdAt:handoffReports.createdAt})
      .from(handoffReports).where(and(eq(handoffReports.projectId,id),eq(handoffReports.kind,'feedback'),isNull(handoffReports.revokedAt)))
      .orderBy(desc(handoffReports.createdAt)),
    db.select().from(historicalFeedback).where(eq(historicalFeedback.projectId,id)).orderBy(desc(historicalFeedback.importedAt)),
  ]);
  if (!product) notFound();
  const packs = await db.select().from(trialPacks);
  const roomVersions = await Promise.all(packs.map(async pack=>({pack,definition:await readPackVersion(pack.id,pack.latestVersion)})));
  const productRooms = roomVersions.filter(room=>room.definition.product.id===id);
  const responses = reports.length ? await db.select().from(followUps).where(and(
    inArray(followUps.handoffReportId,reports.map(report=>report.id)),eq(followUps.kind,'builder-responded'),
  )) : [];
  return <section className="section stack builder-workspace final-page">
    <Link href="/account">My products</Link>
    <h1>{product.name}</h1>
    <p className="lead">{productRooms.length ? `${productRooms.filter(room=>room.pack.state==='published').length} published trial${productRooms.filter(room=>room.pack.state==='published').length===1?'':'s'} · ${reports.length} approved feedback report${reports.length===1?'':'s'}` : 'Prepare a trial and invite testers to share feedback.'}</p>
    <Link className="button" href={'/organizer/trial-packs?project=' + encodeURIComponent(id)}>Create or manage trial</Link>
    <Link href={'/projects/' + encodeURIComponent(id)}>Product Passport and connections</Link>
    <WorkspaceDialog label="Manage product declarations"><form action={saveDeclaration} className="card stack">
      <h2>Publish a declaration</h2>
      <input type="hidden" name="projectId" value={id}/>
      <input type="hidden" name="state" value="published"/>
      <label>Type <select name="kind"><option value="testing-need">Testing need</option><option value="product-need">Product need</option><option value="capability">Capability</option></select></label>
      <label>Declaration <textarea name="content" required maxLength={2000}/></label>
      <label>Prerequisites <textarea name="prerequisites" maxLength={2000}/></label>
      <button className="button">Publish declaration</button>
    </form>
    {items.map(item => <form action={saveDeclaration} key={item.id} className="card stack">
      <h3>{item.kind.replaceAll('-', ' ')}</h3>
      <input type="hidden" name="projectId" value={id}/><input type="hidden" name="previousId" value={item.id}/>
      <label>Declaration <textarea name="content" defaultValue={item.content} required maxLength={2000}/></label>
      <label>Prerequisites <textarea name="prerequisites" defaultValue={item.prerequisites} maxLength={2000}/></label>
      <label>Action <select name="state"><option value="published">Publish edited declaration</option><option value="withdrawn">Withdraw declaration</option></select></label>
      <button className="button">Save declaration</button>
    </form>)}
    </WorkspaceDialog>
    <h2>Tester-approved feedback</h2>
    {!reports.length && !historical.length && <p>No approved feedback is available.</p>}
    {historical.map(record => <WorkspaceDialog key={record.sha256} label="Historical tester-approved export">
      <p>SHA-256 <code>{record.sha256}</code></p>
      <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{record.exportJson}</pre>
    </WorkspaceDialog>)}
    {reports.map(report => <article className="card stack" key={report.id}>
      <Link href={'/share/' + report.token}>Read report from {report.createdAt.toISOString().slice(0,10)}</Link>
      {responses.filter(response=>response.handoffReportId===report.id).map(response=><p key={response.id}>{response.note}</p>)}
      <form className="stack" action={respondToFeedback}>
        <input type="hidden" name="projectId" value={id}/><input type="hidden" name="reportId" value={report.id}/>
        <label>Builder follow-up <textarea name="note" required maxLength={2000}/></label>
        <button className="button">Record follow-up</button>
      </form>
    </article>)}
  </section>;
}
