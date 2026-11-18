import Link from 'next/link';
import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import {finishGuidedTrial, saveGuidedTrialStep} from './actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const metadata = {robots: {index: false, follow: false}, referrer: 'no-referrer'};

const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
const timestamp = (value: Date | string) => new Date(value).toLocaleString();

export default async function GuidedTrialSessionPage({params}: {params: Promise<{packId: string; sessionId: string}>}) {
  const {packId, sessionId} = await params;
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId)) notFound();
  const token = (await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  if (!token) notFound();
  const loaded = await guidedTrialStore.loadSession(sessionId, token);
  if (!loaded || loaded.session.packId !== packId || !loaded.latestReceipt) notFound();
  const {session, definition, events, receipts, latestReceipt, receiptIntact} = loaded;
  const latestByTask = new Map<string, (typeof events)[number]>();
  for (const event of events) latestByTask.set(event.taskId, event);
  let receipt: Record<string, unknown> | null = null;
  try { receipt = JSON.parse(latestReceipt.receipt) as Record<string, unknown>; } catch {}

  return <>
    <section className="hero"><Link className="eyebrow" href={`/trials/rooms/${definition.id}`}>← {definition.product.name} Trial Room</Link><h1>Private session receipt</h1><p>Session {session.id}. This receipt is private to this browser session and records self-reported results, not a verified human identity or on-chain outcome.</p><div className="bar"><a className="button" href={definition.application.url} target="_blank" rel="noreferrer">Open Owl Pilot ↗</a><Link className="button secondary" href={`/projects/${encodeURIComponent(definition.product.id)}`}>Product Passport ↗</Link><Link className="button secondary" href={`/map/${definition.problemMap.slug}#${definition.problemMap.opportunityId}`}>Problem Map request ↗</Link></div></section>

    <section className="section" aria-labelledby="session-details"><div className="eyebrow">Session details</div><h2 id="session-details">{definition.application.name}</h2><div className="card guided-trial-receipt-meta"><p><strong>Application:</strong> <a className="source" href={definition.application.url} target="_blank" rel="noreferrer">{definition.application.url}</a></p><p><strong>Network:</strong> {definition.application.network}</p><p><strong>Version:</strong> {definition.application.version}</p><p><strong>Started:</strong> {timestamp(session.startedAt)} · <strong>Updated:</strong> {timestamp(session.updatedAt)}{session.completedAt && <> · <strong>Finished:</strong> {timestamp(session.completedAt)}</>}</p><p><strong>Linked Problem Map record:</strong> <Link className="source" href={`/map/${definition.problemMap.slug}#${definition.problemMap.opportunityId}`}>{definition.problemMap.opportunityId}</Link></p><p><strong>Self-report acknowledgement:</strong> {timestamp(session.selfReportedAt)}. Trycove does not collect a tester name or verify that a person, rather than automation, entered these observations.</p></div></section>

    <section className="section" aria-labelledby="task-results"><div className="eyebrow">Task outcomes</div><h2 id="task-results">Record what happened</h2><p className="muted">Open the real application in another tab. For each task, select completed, failed, stuck or skipped and optionally add a short note. Save again if your observation changes; every entry remains in the history.</p><div className="stack">{definition.tasks.map((task, index) => {const latest = latestByTask.get(task.id);const history = events.filter((event) => event.taskId === task.id);return <article className="card guided-trial-task" key={task.id}><span className="tag">Task {index + 1}{latest ? ` · ${statusLabel(latest.status)}` : ' · Not recorded'}</span><h3>{task.title}</h3><p>{task.instructions}</p><ul>{task.observe.map((item) => <li key={item}>{item}</li>)}</ul><h4>Step history</h4>{history.length ? <ol className="guided-trial-history">{history.map((event) => <li key={event.id}><strong>{statusLabel(event.status)}</strong> · {timestamp(event.observedAt)}{event.note && <blockquote><p>{event.note}</p></blockquote>}</li>)}</ol> : <p className="muted">No result has been recorded for this task.</p>}{session.completedAt ? <p className="muted">This session is finished. Start a new one if you need to add another observation.</p> : <form action={saveGuidedTrialStep} className="guided-trial-step-form"><input type="hidden" name="packId" value={packId} /><input type="hidden" name="sessionId" value={sessionId} /><input type="hidden" name="taskId" value={task.id} /><label htmlFor={`status-${task.id}`}>Outcome</label><select id={`status-${task.id}`} name="status" required defaultValue={latest?.status ?? ''}><option value="" disabled>Choose an outcome</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="stuck">Stuck</option><option value="skipped">Skipped</option></select><label htmlFor={`note-${task.id}`}>Optional note (never include an address, key or passkey detail)</label><textarea id={`note-${task.id}`} name="note" maxLength={1200} defaultValue={latest?.note ?? ''} /><button type="submit">Save this step</button></form>}</article>})}</div></section>

    <section className="section" aria-labelledby="receipt"><div className="eyebrow">Versioned Session Receipt</div><h2 id="receipt">Receipt v{latestReceipt.version} {receiptIntact ? '· digest verified' : '· digest mismatch'}</h2>{receiptIntact && receipt ? <><div className="card"><p><strong>Session state:</strong> {session.completedAt ? 'Finished' : 'In progress'} · <strong>Results recorded:</strong> {events.length} step history entr{events.length === 1 ? 'y' : 'ies'}</p><p><strong>Receipt SHA-256:</strong> <code>{latestReceipt.receiptSha256}</code></p><ul>{definition.tasks.map((task) => {const latest = latestByTask.get(task.id);return <li key={task.id}><strong>{task.title}:</strong> {latest ? statusLabel(latest.status) : 'Not recorded'}{latest?.note ? ` — ${latest.note}` : ''}{latest && <> · {timestamp(latest.observedAt)}</>}</li>})}</ul><h3>Evidence limitations</h3><ul>{definition.safety.map((item) => <li key={item}>{item}</li>)}</ul><ul>{Array.isArray(receipt.limitations) && (receipt.limitations as string[]).map((item) => <li key={item}>{item}</li>)}</ul></div><details className="card guided-trial-prior-receipts"><summary>Receipt history · {receipts.length} immutable version{receipts.length === 1 ? '' : 's'}</summary><ol>{receipts.map((row) => <li key={row.id}>v{row.version} · {timestamp(row.createdAt)} · SHA-256 <code>{row.receiptSha256}</code></li>)}</ol></details></> : <p role="alert">The stored receipt failed its content digest check. Do not treat it as intact evidence.</p>}</section>

    {!session.completedAt && <section className="section"><div className="card"><h2>Finish this session</h2><p>Finishing appends a final receipt version and makes the session read-only. You can leave it open and return later from this browser.</p><form action={finishGuidedTrial}><input type="hidden" name="packId" value={packId} /><input type="hidden" name="sessionId" value={sessionId} /><button type="submit">Finish and lock receipt</button></form></div></section>}
  </>;
}
