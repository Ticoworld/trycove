import Link from 'next/link';
import {notFound} from 'next/navigation';
import {publicConnectionCopies} from '../../../../lib/public-connections';
import {validHttpsUrl} from '../../../../lib/handoffs';
export const dynamic='force-dynamic';
export default async function Reviewed({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;const copy=(await publicConnectionCopies()).find(row=>row.opportunity_id===id);
 if(!copy)notFound();const source=validHttpsUrl(copy.public_source_url);
 return <main className="connections"><Link href="/opportunities">Connections</Link><p>{copy.public_kind==='need'?'Documented need':copy.public_kind==='proposal'?'Proposed connection':'Evidenced existing relationship'}</p><h1>{copy.public_title}</h1><p>{copy.public_summary}</p><p>Organizer-reviewed source claim. Compatibility, participation and adoption are not established by this listing.</p>{source&&<a href={source} rel="noreferrer">Source</a>}</main>;
}
