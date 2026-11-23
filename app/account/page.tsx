import Link from 'next/link';
import {eq, or} from 'drizzle-orm';
import {authenticatedUser, ensureProfile, isOrganizer} from '../../lib/authorization';
import {authConfigured} from '../../lib/neon-auth';
import {db} from '../../lib/db';
import {ownershipClaims, projectMemberships, projects} from '../../lib/schema';
import {bootstrapOrganizer, githubLogin, logout} from './actions';
import {manageMaintainer, reviewClaim, revokeClaim, startClaim, verifyClaim} from './claims';

export const dynamic = 'force-dynamic';

export default async function Account({searchParams}: {searchParams: Promise<{error?: string; project?: string}>}) {
  const [query, user] = await Promise.all([searchParams, authenticatedUser()]);
  if (!user) return <section className="section account-entry"><div className="account-entry-copy"><span className="eyebrow">Trycove account</span><h1>Build with your community.</h1><p>Sign in to manage your product and follow feedback from testers.</p></div><div className="card stack account-entry-card"><h2>Sign in</h2>
    {query.error && <p role="alert">Account action failed. Please try again.</p>}
    {authConfigured() && process.env.TRYCOVE_PUBLIC_URL
      ? <form action={githubLogin}><button className="button">Continue with GitHub</button></form>
      : <p>GitHub sign-in is unavailable.</p>}
    <p>Email sign-in is pending production delivery configuration.</p>
    <Link href="/trials">Explore trials as a guest</Link></div>
  </section>;

  await ensureProfile(user.id);
  const organizer = await isOrganizer(user.id);
  const [memberships, claims] = await Promise.all([
    db.select({id: projects.id, name: projects.name, role: projectMemberships.role}).from(projectMemberships)
      .innerJoin(projects, eq(projectMemberships.projectId, projects.id)).where(eq(projectMemberships.userId, user.id)),
    db.select().from(ownershipClaims).where(or(eq(ownershipClaims.userId, user.id), organizer ? or(eq(ownershipClaims.status, 'pending'), eq(ownershipClaims.status, 'approved')) : undefined)),
  ]);
  return <section className="section stack">
    <h1>Your account</h1>
    <p>Account ID <code>{user.id}</code></p>
    <form action={logout}><button className="button secondary">Sign out</button></form>
    {!organizer && process.env.TRYCOVE_BOOTSTRAP_ORGANIZER_ID === user.id &&
      <form action={bootstrapOrganizer}><button className="button">Activate configured organizer access</button></form>}
    <h2>Managed products</h2>
    <ul>{memberships.map(project => <li key={project.id}><Link href={'/projects/' + encodeURIComponent(project.id)}>{project.name}</Link> ({project.role}) <Link href={'/builder/' + encodeURIComponent(project.id)}>Open builder workspace</Link></li>)}</ul>
    {memberships.filter(project => project.role === 'owner').map(project =>
      <form key={project.id} action={manageMaintainer} className="card stack">
        <h3>Manage maintainers for {project.name}</h3>
        <input type="hidden" name="projectId" value={project.id}/>
        <label>Maintainer account ID <input name="userId" required/></label>
        <label>Action <select name="operation"><option value="add">Add</option><option value="remove">Remove</option></select></label>
        <button className="button">Save membership</button>
      </form>)}
    <form action={startClaim} className="card stack">
      <h2>Claim a Product Passport</h2>
      <label>Product Passport ID <input name="projectId" defaultValue={query.project} required maxLength={200}/></label>
      <button className="button">Start ownership verification</button>
    </form>
    {claims.map(claim => {
      const pending = claim.status === 'pending' && claim.expiresAt > new Date();
      return <article className="card stack" key={claim.id}>
        <h3>{claim.projectId}</h3><p>{claim.repository} ({claim.method})</p>
        <p>{claim.status === 'pending' && !pending ? 'Expired' : claim.status}</p>
        {pending && claim.userId === user.id && claim.method !== 'review' && <form action={verifyClaim}>
          {claim.method === 'organization' && <p>Place <code>{claim.id}</code> in <code>.trycove-ownership</code> on the default branch before {claim.expiresAt.toISOString()}.</p>}
          <input type="hidden" name="claimId" value={claim.id}/>
          <button className="button">Verify ownership</button>
        </form>}
        {pending && organizer && claim.userId !== user.id && <form action={reviewClaim} className="stack">
          <input type="hidden" name="claimId" value={claim.id}/>
          <label>Review decision <select name="decision"><option value="rejected">Reject</option><option value="approved">Approve</option></select></label>
          <label>Verification evidence and reason <textarea name="detail" minLength={10} maxLength={2000} required/></label>
          <button className="button">Record review</button>
        </form>}
        {organizer && claim.status === 'approved' && <form action={revokeClaim} className="stack">
          <input type="hidden" name="claimId" value={claim.id}/>
          <label>Reason for revoking ownership and project memberships <textarea name="detail" minLength={10} maxLength={2000} required/></label>
          <button className="button secondary">Revoke ownership</button>
        </form>}
      </article>;
    })}
  </section>;
}
