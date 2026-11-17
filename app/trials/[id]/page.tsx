import Link from 'next/link';
import {notFound} from 'next/navigation';
import {eq} from 'drizzle-orm';
import {db} from '../../../lib/db';
import {trialEvidenceRecords} from '../../../lib/schema';

export const dynamic='force-dynamic';

export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[a-z0-9-]{1,100}$/.test(id))notFound();
 const [record]=await db.select().from(trialEvidenceRecords).where(eq(trialEvidenceRecords.id,id));
 if(!record)notFound();
 let body='Receipt data is unreadable.';
 let parsed:Record<string,unknown>|null=null;
 try{parsed=JSON.parse(record.receipt) as Record<string,unknown>;body=JSON.stringify(parsed,null,2)}catch{}
 const offline=record.mode==='offline-script-group-replay';
 return <>
  <section className="hero">
   <Link className="eyebrow" href="/trials">← Integration Lab</Link>
   <h1>Execution receipt.</h1>
   <p>Level {record.evidenceLevel} · {record.mode} · {record.result}</p>
   <p>Recorded digest: <code>{record.receiptSha256}</code></p>
   <p>{offline?'This is a real offline CKB script-group execution using an archived Testnet fixture. It is not fresh chain acceptance or a broadcast transaction.':'The digest checks stored content integrity. Receipt isolation metadata is recorded evidence, not independent attestation or proof of chain validity; the receipt identifies synthetic and mocked inputs.'}</p>
  </section>
  <section className="section">
   <h2>Receipt and limitations</h2>
   <pre className="card" style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{body}</pre>
   {record.opportunityId&&<Link className="source" href={`/opportunities/${encodeURIComponent(record.opportunityId)}`}>View opportunity →</Link>}
  </section>
 </>;
}
