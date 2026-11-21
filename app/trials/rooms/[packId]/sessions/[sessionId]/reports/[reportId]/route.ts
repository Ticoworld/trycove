import {cookies} from 'next/headers';
import {exportFeedbackReport} from '../../../../../../../../lib/handoffs';
import {GUIDED_TRIAL_ACCESS_COOKIE} from '../../../../../../../../lib/trials/room-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  {params}: {params: Promise<{packId: string; sessionId: string; reportId: string}>},
) {
  const sessionToken = (await cookies()).get(GUIDED_TRIAL_ACCESS_COOKIE)?.value;
  return exportFeedbackReport({...await params, sessionToken});
}
