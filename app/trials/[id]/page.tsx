import {WorkspaceDialog} from '../../workspace-dialog';
import '../../evidence-pages.css';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {trialEvidenceRecords} from '../../../lib/schema';

export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(id))notFound();
 const [record]=await db.select().from(trialEvidenceRecords).where(eq(trialEvidenceRecords.id,id));
 if(!record)notFound();
 let body='Receipt data is unreadable.';
 let parsed:Record<string,unknown>|null=null;
 try{parsed=JSON.parse(record.receipt) as Record<string,unknown>;body=JSON.stringify(parsed,null,2)}catch{}
 const offline=record.mode==='offline-script-group-replay';
 const upstreamInterface=record.mode==='real-upstream-source-interface-isolated';
 const adapter=parsed&&typeof parsed.adapter==='object'&&parsed.adapter!==null?parsed.adapter as Record<string,unknown>:null;
 const adapterPath=typeof adapter?.path==='string'&&/^experiments\/tc01e\/transaction-inspector\/adapter\.ts$/.test(adapter.path)?adapter.path:null;
 const adapterSha256=typeof adapter?.sha256==='string'&&/^[a-f0-9]{64}$/.test(adapter.sha256)?adapter.sha256:null;
 return <div className="evidence-paper receipt-page">
  <section className="hero evidence-intro">
   <Link className="evidence-return" href="/results?view=technical">Technical executions</Link>
   <h1>Technical test record</h1>
   <p>Level {record.evidenceLevel} · {record.mode} · {record.result}</p>

   <p>This record describes a technical check. It does not confirm real-world use.</p>
   {upstreamInterface&&adapterPath&&adapterSha256&&<p><a className="source" href={`https://github.com/Ticoworld/trycove/blob/main/${adapterPath}`} target="_blank" rel="noreferrer">Inspect adapter source</a> · SHA-256 <code>{adapterSha256}</code></p>}
  </section>
  <section className="section receipt-details">
   <WorkspaceDialog label="View full receipt"><p>{offline?'This is a real offline CKB script-group execution using an archived Testnet fixture. It is not fresh chain acceptance or a broadcast transaction.':upstreamInterface?'Pinned source modules from both named repositories were executed in an offline, restricted container. This receipt covers a read-only URL builder/parser boundary only; it does not prove transaction creation, CKB RPC behavior, chain compatibility, deployment availability, adoption or independent reproduction.': 'The digest checks stored content integrity. Receipt isolation metadata is recorded evidence, not independent attestation or proof of chain validity; this mode may use synthetic or mocked inputs.'}</p><p>Recorded digest: <code>{record.receiptSha256}</code></p><pre className="card" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{body}</pre></WorkspaceDialog>
   {record.opportunityId&&<Link className="source" href={`/opportunities/${encodeURIComponent(record.opportunityId)}`}>View opportunity</Link>}
  </section>
 </div>;
}
