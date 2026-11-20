'use server';
import {z} from 'zod';
import {eq} from 'drizzle-orm';
import {revalidatePath} from 'next/cache';
import {db} from '../../lib/db';
import {FOLLOW_UP_KINDS,validHttpsUrl} from '../../lib/handoffs';
import {followUps,handoffReports} from '../../lib/schema';
import {hasOrganizerSession} from '../../lib/organizer-auth';
const Schema=z.object({reportId:z.string().regex(/^[A-Za-z0-9_-]{16,40}$/),kind:z.enum(FOLLOW_UP_KINDS),note:z.string().trim().min(1).max(2000),sourceUrl:z.string().max(2048).optional(),publicNote:z.boolean()});
export async function recordReportFollowUp(input:unknown){
 if(!await hasOrganizerSession())throw new Error('Organizer access is required.');const v=Schema.parse(input);
 const [report]=await db.select().from(handoffReports).where(eq(handoffReports.id,v.reportId));if(!report||report.revokedAt)throw new Error('This report is unavailable.');
 if(report.kind==='feedback'&&!['shared-with-builder','builder-replied','fix-reported','fix-verified','retested','closed','no-response'].includes(v.kind))throw new Error('Choose a feedback follow-up event.');
 if(report.kind==='connection'&&!['introduction-prepared','introduction-made','builder-replied','trial-attempted','blocked','not-a-fit','integration-reported','integration-verified','follow-up-completed'].includes(v.kind))throw new Error('Choose a connection follow-up event.');
 const sourceUrl=v.sourceUrl?validHttpsUrl(v.sourceUrl):null;if(v.sourceUrl&&!sourceUrl)throw new Error('Supporting links must use HTTPS.');
 await db.insert(followUps).values({opportunityId:report.opportunityId,handoffReportId:report.id,kind:v.kind,note:v.note,sourceUrl,publicNote:v.publicNote,createdAt:new Date()});
 revalidatePath('/results');revalidatePath(`/share/${report.shareToken}`);return {ok:true};
}
