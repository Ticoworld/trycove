import Link from 'next/link';
import {eq, or} from 'drizzle-orm';
import {authenticatedUser, ensureProfile, isOrganizer} from '../../lib/authorization';
import {authConfigured} from '../../lib/neon-auth';
import {db} from '../../lib/db';
import {ownershipClaims, projectMemberships, projects, trialPacks} from '../../lib/schema';
import {readPackVersion} from '../../lib/trials/trial-packs';
import {bootstrapOrganizer, githubLogin} from './actions';
import {PendingButton} from '../organizer/trial-packs/pending-button';
import {ActionForm} from './action-form';
import {claimAction, verifyAction, reviewAction, revokeAction, maintainerAction, logoutAction} from './feedback';

export const dynamic = 'force-dynamic';

export default async function Account({searchParams}: {searchParams: Promise<{error?: string; project?: string; claim?: string; notice?: string}>}) {
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
  const packs = await db.select().from(trialPacks);
  const rooms = await Promise.all(packs.map(async pack => ({pack, definition: await readPackVersion(pack.id, pack.latestVersion)})));
  return <section className="section stack workspace">
    <span className="eyebrow">Builder workspace</span><h1>My products</h1>
    <p className="lead">Prepare a trial, share it with testers, and follow their feedback.</p>
    {!organizer && process.env.TRYCOVE_BOOTSTRAP_ORGANIZER_ID === user.id &&
      <form action={bootstrapOrganizer}><button className="button">Activate configured organizer access</button></form>}
    {!memberships.length && <p>No products yet. Claim a product below to get started.</p>}
    <div className="workspace-products">{memberships.map(project => {
      const productRooms = rooms.filter(room => room.definition.product.id === project.id);
      const published = productRooms.filter(room => room.pack.state === 'published').length;
      return <article className="workspace-product" key={project.id}><div><h2>{project.name}</h2><p>{productRooms.length ? `${published} live · ${productRooms.length} total trial${productRooms.length === 1 ? '' : 's'}` : 'No trial yet'} · {project.role}</p></div><Link className="button" href={'/builder/' + encodeURIComponent(project.id)}>Open workspace →</Link></article>;
    })}</div>
    <details className="workspace-settings" open={!!query.claim || !!query.error || !!query.project || !!query.notice}><summary>Account and product settings</summary>
    {query.error && <p role="alert">Account action failed. Please try again.</p>}
    {query.notice && <p role="status">{query.notice === "verified" ? "Ownership verified." : query.notice === "claim" ? "Ownership request started." : "Changes saved."}</p>}
    <p>Account ID <code>{user.id}</code></p><ActionForm action={logoutAction}><PendingButton label="Sign out" pendingLabel="Signing out…" secondary/></ActionForm>
    {memberships.filter(project => project.role === 'owner').map(project =>
      <ActionForm key={project.id} action={maintainerAction} className="card stack">
        <h3>Manage maintainers for {project.name}</h3>
        <input type="hidden" name="projectId" value={project.id}/>
        <label>Maintainer account ID <input name="userId" required/></label>
        <label>Action <select name="operation"><option value="add">Add</option><option value="remove">Remove</option></select></label>
        <PendingButton label="Save membership" pendingLabel="Saving…"/></ActionForm>)}
    <ActionForm action={claimAction} className="card stack">
      <h2>Claim a Product Passport</h2>
      <label>Product Passport ID <input name="projectId" defaultValue={query.project} required maxLength={200}/></label>
      <PendingButton label="Start ownership verification" pendingLabel="Checking…"/></ActionForm>
    {claims.map(claim => {
      const pending = claim.status === 'pending' && claim.expiresAt > new Date();
      return <article className="card stack" key={claim.id}>
        <h3>{claim.projectId}</h3><p>{claim.repository} ({claim.method})</p>
        <p>{claim.status === 'pending' && !pending ? 'Expired' : claim.status}</p>
        {pending && claim.userId === user.id && claim.method !== 'review' && <ActionForm action={verifyAction}>
          {claim.method === 'organization' && <p>Place <code>{claim.id}</code> in <code>.trycove-ownership</code> on the default branch before {claim.expiresAt.toISOString()}.</p>}
          <input type="hidden" name="claimId" value={claim.id}/>
          <PendingButton label="Verify ownership" pendingLabel="Verifying…"/></ActionForm>}
        {pending && organizer && claim.userId !== user.id && <ActionForm action={reviewAction} className="stack">
          <input type="hidden" name="claimId" value={claim.id}/>
          <label>Review decision <select name="decision"><option value="rejected">Reject</option><option value="approved">Approve</option></select></label>
          <label>Verification evidence and reason <textarea name="detail" minLength={10} maxLength={2000} required/></label>
          <PendingButton label="Record review" pendingLabel="Saving…"/></ActionForm>}
        {organizer && claim.status === 'approved' && <ActionForm action={revokeAction} className="stack">
          <input type="hidden" name="claimId" value={claim.id}/>
          <label>Reason for revoking ownership and project memberships <textarea name="detail" minLength={10} maxLength={2000} required/></label>
          <PendingButton label="Revoke ownership" pendingLabel="Revoking…" secondary/></ActionForm>}
      </article>;
    })}
    </details>
  </section>;
}
