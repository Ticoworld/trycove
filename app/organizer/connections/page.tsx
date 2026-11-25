import Link from 'next/link';
import {redirect} from 'next/navigation';
import {db} from '../../../lib/db';
import {connectionOperations,opportunities,projects} from '../../../lib/schema';
import {hasOrganizerSession} from '../../../lib/organizer-auth';
import {createOpportunity,registerProjectReference} from './actions';
import {sql} from 'drizzle-orm';
import {needsConnectionAttention} from '../../../lib/connections-filter';

export const dynamic='force-dynamic';
export default async function Connections({searchParams}:{searchParams:Promise<{view?:string}>}) {
 if(!await hasOrganizerSession()) redirect('/organizer?return=%2Forganizer%2Fconnections');
 const ready=await db.execute<{name:string|null}>(sql`select to_regclass('public.connection_operations')::text as name`);
 if(!ready.rows[0]?.name)return <main className="evidence-paper"><h1>Connections workspace</h1><p>Database migration 0021 is required before this workspace can be used.</p></main>;
 const [rows,states,products,query]=await Promise.all([db.select().from(opportunities),db.select().from(connectionOperations),db.select({id:projects.id,name:projects.name}).from(projects),searchParams]);
 const stateById=new Map(states.map(state=>[state.opportunityId,state]));
 const today=new Date().toISOString().slice(0,10);
 const shown=query.view==='attention'?rows.filter(row=>needsConnectionAttention(row.status,stateById.get(row.id))):rows;
 return <main className="evidence-paper"><h1>Connections workspace</h1><p>Review sourced opportunities and track human follow-through. These fields do not establish compatibility or adoption.</p><nav><Link href="/organizer/connections">All opportunities</Link> · <Link href="/organizer/connections?view=attention">Needs attention</Link></nav>
 <div className="stack">{shown.map(row=>{const state=stateById.get(row.id);return <article className="card" key={row.id}><h2><Link href={`/organizer/connections/${encodeURIComponent(row.id)}`}>{row.problem}</Link></h2><p>{row.status} · {state?.publication??'existing'} · {state?.progress??'open'}{state?.dueDate&&state.dueDate<today&&state.progress!=='done'?' · overdue':''}</p><p>{state?.nextAction}</p></article>})}</div>
 <details><summary>Register a project reference</summary><form action={registerProjectReference} className="card"><p>References are private and do not enter the public catalog.</p><label>Project name <input name="name" required maxLength={200}/></label><label>Source-backed description <textarea name="description" required maxLength={2000}/></label><label>Source URL <input type="url" name="sourceUrl" required/></label><label>Source revision <input name="revision" required maxLength={200}/></label><label>Website (optional) <input type="url" name="website"/></label><label>Repository URL (optional) <input type="url" name="repository"/></label><button>Register private reference</button></form></details>
 <details><summary>Create a source-backed opportunity</summary><form action={createOpportunity} className="card"><label>Project <select name="projectA" required>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Second project (optional) <select name="projectB"><option value="">None</option>{products.map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label><label>Need or connection <textarea name="problem" required maxLength={2000}/></label><label>Context <textarea name="reasoning" required maxLength={2000}/></label><label>Source claim <textarea name="claim" required maxLength={2000}/></label><label>Public HTTPS source <input type="url" name="sourceUrl" required/></label><label>Source revision (optional) <input name="revision"/></label><button>Create private candidate</button></form></details></main>
}
