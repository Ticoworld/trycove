import Link from 'next/link';
import {notFound,redirect} from 'next/navigation';
import {and,desc,eq,inArray,isNull} from 'drizzle-orm';
import {authenticatedUser,checkProjectPermission} from '../../../lib/authorization';
import {db} from '../../../lib/db';
import {declarations} from '../../../lib/declarations';
import {followUps,handoffReports,historicalFeedback,projects} from '../../../lib/schema';
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
  const responses = reports.length ? await db.select().from(followUps).where(and(
    inArray(followUps.handoffReportId,reports.map(report=>report.id)),eq(followUps.kind,'builder-responded'),
  )) : [];
  return <section className="section stack">
    <h1>{product.name} builder workspace</h1>
    <Link className="button" href={'/organizer/trial-packs?project=' + encodeURIComponent(id)}>Manage Trial Packs</Link>
    <Link href={'/projects/' + encodeURIComponent(id)}>Product Passport and connections</Link>
    <form action={saveDeclaration} className="card stack">
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
    <h2>Tester-approved feedback</h2>
    {!reports.length && !historical.length && <p>No approved feedback is available.</p>}
    {historical.map(record => <details key={record.sha256} className="card">
      <summary>Historical tester-approved export</summary>
      <p>SHA-256 <code>{record.sha256}</code></p>
      <pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{record.exportJson}</pre>
    </details>)}
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
