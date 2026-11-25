import Link from 'next/link';
import {notFound} from 'next/navigation';
import {Fraunces,Geist} from 'next/font/google';
import {publicConnectionCopies} from '../../../../lib/public-connections';
import {validHttpsUrl} from '../../../../lib/handoffs';
import {EvidenceDialog} from '../../../projects/[id]/evidence-dialog';
import '../../../opportunities/connections.css';

const display=Fraunces({subsets:['latin'],style:['normal','italic'],variable:'--connection-display',display:'swap'});
const ui=Geist({subsets:['latin'],variable:'--connection-ui',display:'swap'});
export const dynamic='force-dynamic';

export default async function Reviewed({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const copy=(await publicConnectionCopies()).find(row=>row.opportunity_id===id);
 if(!copy)notFound();
 const source=validHttpsUrl(copy.public_source_url);
 const kind=copy.public_kind==='need'?'Documented need':copy.public_kind==='proposal'?'Proposed connection':'Evidenced existing relationship';
 return <div className={`connections connection-workspace ${display.variable} ${ui.variable}`}>
  <Link className="connection-return" href="/opportunities">Connections</Link>
  <section className="connection-intro"><p className="connection-state">{kind}</p><h1>{copy.public_title}</h1></section>
  <div className="connection-overview">
   <section><h2>About this connection</h2><p>{copy.public_summary}</p><p className="connection-note">Organizer-reviewed source claim. Participation and any further collaboration are not established by this listing.</p></section>
   {source&&<aside className="connection-source-list"><h2>Source evidence</h2><EvidenceDialog title="Source" description="Organizer-reviewed source claim"><p>{copy.public_summary}</p><a href={source} target="_blank" rel="noreferrer">Inspect source</a></EvidenceDialog></aside>}
  </div>
 </div>;
}
