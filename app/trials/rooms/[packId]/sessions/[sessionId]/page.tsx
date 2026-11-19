import {cookies} from 'next/headers';
import {notFound} from 'next/navigation';
import {guidedTrialStore} from '../../../../../../lib/trials/guided-room-store';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../lib/trials/room-auth';
import type {GuidedTrialStatus} from '../../../../../../lib/trials/room-definitions';
import {TrialStudio} from './trial-studio';
export const dynamic='force-dynamic';
export const revalidate=0;
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function GuidedTrialSessionPage({params}:{params:Promise<{packId:string;sessionId:string}>}){
 const {packId,sessionId}=await params;
 if(!/^[A-Za-z0-9_-]{16,40}$/.test(sessionId))notFound();
 const token=(await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
 if(!token)notFound();
 const loaded=await guidedTrialStore.loadSession(sessionId,token);
 if(!loaded || loaded.session.packId!==packId || !loaded.latestReceipt)notFound();
 const latest=Object.fromEntries(loaded.definition.tasks.map(task=>{const event=loaded.events.filter(e=>e.taskId===task.id).at(-1);return [task.id,event?{status:event.status as GuidedTrialStatus,note:event.note}:null]}));
 return <TrialStudio packId={packId} sessionId={sessionId} definition={loaded.definition} initialAnswers={latest} finished={!!loaded.session.completedAt} receiptIntact={loaded.receiptIntact} receipts={loaded.receipts.map(r=>({version:r.version,sha256:r.receiptSha256,createdAt:r.createdAt.toISOString(),receipt:r.receipt}))}/>;
}
