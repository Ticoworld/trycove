import Link from 'next/link';
import {eq,sql} from 'drizzle-orm';
import {notFound,redirect} from 'next/navigation';
import {db} from '../../../../lib/db';
import {appUsers,connectionOperations,evidence,opportunities} from '../../../../lib/schema';
import {hasOrganizerSession} from '../../../../lib/organizer-auth';
import {saveOperations} from '../actions';

export const dynamic='force-dynamic';
export default async function Connection({params}:{params:Promise<{id:string}>}) {
 if(!await hasOrganizerSession())redirect('/organizer?return=%2Forganizer%2Fconnections');
 const ready=await db.execute<{name:string|null}>(sql`select to_regclass('public.connection_operations')::text as name`);
 if(!ready.rows[0]?.name)return <main className="evidence-paper"><h1>Connections workspace</h1><p>Database migration 0021 is required before this workspace can be used.</p></main>;
 const {id}=await params;
 const [[row],[state],sources,organizers]=await Promise.all([db.select().from(opportunities).where(eq(opportunities.id,id)),db.select().from(connectionOperations).where(eq(connectionOperations.opportunityId,id)),db.select().from(evidence).where(eq(evidence.opportunityId,id)),db.select().from(appUsers).where(eq(appUsers.organizer,true))]);
 if(!row)notFound();
 return <main className="evidence-paper"><Link href="/organizer/connections">Connections workspace</Link><h1>{row.problem}</h1><p>{row.reasoning}</p><p>Candidate status: {row.status}</p><h2>Source evidence</h2>{sources.map(source=><article className="card" key={source.id}><p>{source.claim}</p><p>{source.verification} · {source.revision??'revision unknown'}</p><a href={source.sourceUrl} rel="noreferrer">Source</a></article>)}
 <p><Link href={`/opportunities/${encodeURIComponent(id)}?view=follow-up`}>Open review and follow-up ledger</Link></p>
 <form action={saveOperations} className="card"><input type="hidden" name="id" value={id}/><label>Next action <textarea name="nextAction" defaultValue={state?.nextAction??''} maxLength={2000}/></label><label>Responsible organizer <select name="responsible" defaultValue={state?.responsibleUserId??''}><option value="">Unassigned</option>{organizers.map(user=><option key={user.id} value={user.id}>{user.id}</option>)}</select></label><label>Due date <input type="date" name="dueDate" defaultValue={state?.dueDate??''}/></label><label><input type="checkbox" name="watchlist" defaultChecked={state?.watchlist??false}/> Watchlist</label><label>Progress <select name="progress" defaultValue={state?.progress??'open'}><option value="open">Open</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option></select></label><label>Publication <select name="publication" defaultValue={state?.publication??(row.status==='needs-review'?'private':'legacy')}><option value="legacy">Existing visibility policy</option><option value="private">Private</option><option value="published">Publish reviewed opportunity</option></select></label><p>Only the approved public copy below is published. Review it for private information.</p><label>Public classification <select name="publicKind" defaultValue={state?.publicKind??'need'}><option value="need">Documented need</option><option value="proposal">Proposed connection</option><option value="evidenced">Evidenced existing relationship</option></select></label><label>Public title <textarea name="publicTitle" defaultValue={state?.publicTitle??''} maxLength={2000}/></label><label>Public summary <textarea name="publicSummary" defaultValue={state?.publicSummary??''} maxLength={2000}/></label><label>Public source URL <input type="url" name="publicSourceUrl" defaultValue={state?.publicSourceUrl??''}/></label><button>Save review and operations</button></form></main>
}
