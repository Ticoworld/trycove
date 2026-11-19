import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getGuidedTrialDefinition} from '../../../../lib/trials/room-definitions';
import {GuidedTrialStart} from './start-client';
export const dynamic='force-dynamic';
export default async function GuidedTrialRoomPage({params}:{params:Promise<{packId:string}>}){
 const {packId}=await params;const definition=getGuidedTrialDefinition(packId);if(!definition)notFound();
 return <div className="studio studio-entry"><div className="studio-top"><Link className="studio-wordmark" href="/">trycove<span>●</span></Link><Link href={`/projects/${encodeURIComponent(definition.product.id)}`}>Back to project</Link></div><div className="invitation"><div className="invitation-copy"><div className="product-identity"><span className="product-mark" aria-hidden="true">O</span><div><strong>Owl Pilot</strong><small>CKB Testnet</small></div></div><h1>Try Owl Pilot</h1><p>Explore the wallet and tell us what works or feels confusing.</p><GuidedTrialStart packId={definition.id}/></div><aside className="invitation-path"><h2>What you’ll explore</h2><p>Four small steps, at your own pace.</p><ol><li><span>1</span><div><strong>Account</strong><small>Find the owner and app-facing accounts</small></div></li><li><span>2</span><div><strong>Permissions</strong><small>Review what an app can request</small></div></li><li><span>3</span><div><strong>Allowance</strong><small>Understand the spending limit</small></div></li><li><span>4</span><div><strong>Recovery</strong><small>Explore receipts and session controls</small></div></li></ol></aside></div></div>;
}
