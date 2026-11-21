import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getProblemDomain, relationshipStatus, UNCLASSIFIED_DOMAIN, type ClassificationEvidence} from '../../../lib/problem-map';
import {getProblemDomainData} from '../../../lib/problem-map-data';
import {listPublishedTrials} from '../../../lib/trials/trial-packs';

export const dynamic = 'force-dynamic';

function safeHttps(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const value = new URL(raw);
    return value.protocol === 'https:' && !value.username && !value.password ? value.href : null;
  } catch { return null; }
}

function ClaimLink({href, children}: {href?: string | null; children: React.ReactNode}) {
  const safe = safeHttps(href);
  return safe ? <a className="source" href={safe} target="_blank" rel="noreferrer">{children} ↗</a> : <span>{children}</span>;
}

function evidenceLabel(row: ClassificationEvidence) {
  if (row.kind === 'directory-category') return `Directory category claim: ${row.label}`;
  if (row.kind === 'source-intent') return `Structured source scope: ${row.label}`;
  if (row.kind === 'source-claim') return row.label;
  return `Recorded capability: ${row.label}`;
}

export default async function ProblemDomainPage({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  const domain = getProblemDomain(slug);
  if (!domain) notFound();
  const data = await getProblemDomainData(slug);
  const names = new Map(data.products.map((project) => [project.id, project.name]));
  const signalByProject = new Map<string, typeof data.signals>();
  for (const row of data.signals) signalByProject.set(row.projectId, [...(signalByProject.get(row.projectId) ?? []), row]);
  const needsByProject = new Map<string, typeof data.needs>();
  for (const row of data.needs) needsByProject.set(row.projectId, [...(needsByProject.get(row.projectId) ?? []), row]);
  const observationsByProject = new Map<string, typeof data.observations>();
  for (const row of data.observations) observationsByProject.set(row.projectId, [...(observationsByProject.get(row.projectId) ?? []), row]);
  const capByOpportunity = new Map<string, typeof data.capabilities>();
  for (const row of data.capabilities) capByOpportunity.set(row.opportunityId, [...(capByOpportunity.get(row.opportunityId) ?? []), row]);
  const evidenceByOpportunity = new Map<string, typeof data.evidence>();
  for (const row of data.evidence) evidenceByOpportunity.set(row.opportunityId, [...(evidenceByOpportunity.get(row.opportunityId) ?? []), row]);
  const receiptsByOpportunity = new Map<string, typeof data.trialReceipts>();
  for (const row of data.trialReceipts) if (row.opportunityId) receiptsByOpportunity.set(row.opportunityId, [...(receiptsByOpportunity.get(row.opportunityId) ?? []), row]);
  const runsByOpportunity = new Map<string, typeof data.trialRuns>();
  for (const row of data.trialRuns) runsByOpportunity.set(row.opportunityId, [...(runsByOpportunity.get(row.opportunityId) ?? []), row]);
  const sharedCategories = new Map<string, string[]>();
  for (const product of data.products) {
    for (const reason of data.memberships.get(product.id)?.get(slug) ?? []) {
      if (reason.kind !== 'directory-category') continue;
      const current = sharedCategories.get(reason.label) ?? [];
      current.push(product.name);
      sharedCategories.set(reason.label, current);
    }
  }
  const sharedCategoryGroups = [...sharedCategories.entries()].filter(([,products]) => new Set(products).size > 1).map(([category,products]) => ({category,products:[...new Set(products)].sort()}));
  const domainOpportunities = data.opportunities.filter((row) => data.products.some((product) => product.id === row.projectA || product.id === row.projectB));
  const feedbackNeeds = data.needs.filter((need) => (need.category === 'user-testing' || need.category === 'adoption') && ['explicit-request', 'explicit-offer'].includes(need.stance));
  const rooms = await listPublishedTrials();
  const feedbackOpportunities = domainOpportunities.filter((row) => row.kind === 'user-testing');

  return <>
    <section className="hero">
      <Link className="eyebrow" href="/map">← Problem Map</Link>
      <h1>{domain.title}</h1>
      <p>{domain.summary}</p>
      <p className="muted">{data.products.length} products with at least one supporting record. These placements are source-backed browse groups, not compatibility verdicts.</p>
    </section>

    <section className="section" aria-labelledby="similar-products">
      <div className="eyebrow">Shared problem labels</div><h2 id="similar-products">Products grouped by the same evidence label</h2>
      <p className="muted">Groups below share an exact CKBdapps category claim. That overlap makes products easier to compare, but does not prove their implementations are similar or interchangeable.</p>
      {sharedCategoryGroups.length ? <div className="grid">{sharedCategoryGroups.map((group) => <article className="card" key={group.category}>
        <span className="tag">Same directory category · {group.category}</span><ul className="map-name-list">{group.products.map((name) => <li key={name}>{name}</li>)}</ul>
      </article>)}</div> : <p className="muted">No exact directory category is shared by multiple products in this group. Source-intent or capability placements still appear below.</p>}
    </section>

    <section className="section" aria-labelledby="products">
      <div className="section-head"><div><div className="eyebrow">Products in this domain</div><h2 id="products">What each product does and needs</h2></div><Link className="source" href="/projects">Search all products →</Link></div>
      <p className="muted">Descriptions and capabilities retain their source links. Pinned code observations are static source evidence; they do not prove deployed runtime behavior.</p>
      {data.products.length ? <div className="grid">{data.products.map((project) => {
        const reasons = data.memberships.get(project.id)?.get(slug) ?? [];
        const signals = signalByProject.get(project.id) ?? [];
        const capabilities = signals.filter((row) => row.kind === 'capability' || row.kind === 'provides').slice(0, 3);
        const needs = needsByProject.get(project.id) ?? [];
        const observations = observationsByProject.get(project.id) ?? [];
        return <article className="card map-product-card" key={project.id}>
          <span className="tag">Product · {needs.length} active need record{needs.length === 1 ? '' : 's'}{needs.length > 3 ? ' · up to 3 shown' : ''}</span>
          <h3><Link href={`/projects/${encodeURIComponent(project.id)}`}>{project.name}</Link></h3>
          <p>{project.description || 'No product description is present in the imported project record.'}</p>
          <p className="map-source-note">Project record: revision {project.revision.slice(0, 12)} · observed {new Date(project.observedAt).toISOString().slice(0, 10)} · <ClaimLink href={project.sourceUrl}>primary source</ClaimLink></p>
          <h4>Why it appears here</h4>
          <ul className="map-evidence-list">{reasons.map((reason, index) => <li key={`${reason.kind}-${reason.label}-${index}`}>
            {reason.opportunityId ? <Link className="source" href={`/opportunities/${encodeURIComponent(reason.opportunityId)}`}>{evidenceLabel(reason)} · inspect saved connection →</Link> : <ClaimLink href={reason.sourceUrl}>{evidenceLabel(reason)}</ClaimLink>}
            <span className="muted">{reason.verification ? ` · ${reason.verification}` : ''}{reason.revision ? ` · ${reason.revision.slice(0, 12)}` : ''}</span>
          </li>)}</ul>
          <h4>Reusable capabilities and source observations</h4>
          {capabilities.length ? capabilities.map((item) => <article className="map-claim" key={item.id}><span className="tag">{item.kind} · {item.verification}</span><p>{item.claim}</p><ClaimLink href={item.sourceUrl}>source claim</ClaimLink></article>) : <p className="muted">No structured provider capability claim is stored for this product.</p>}
          {observations.slice(0, 2).map((item) => <article className="map-claim" key={item.id}><span className="tag">Pinned code observation · {item.kind}</span><p>{item.fact}</p><ClaimLink href={`${item.repository}/blob/${item.revision}/${item.path}#L${item.startLine}`}>{item.path}:{item.startLine} · revision {item.revision.slice(0, 12)}</ClaimLink><p className="muted">{item.verification}{item.unknowns ? ` · ${item.unknowns}` : ''}</p></article>)}
          <h4>Documented needs and obstacles</h4>
          {needs.length ? needs.slice(0, 3).map((need) => <article className="map-claim" key={need.id}><span className="tag">Automated category: {need.category.replaceAll('-', ' ')} · {need.stance.replaceAll('-', ' ')}</span><blockquote><p>{need.excerpt}</p></blockquote><ClaimLink href={need.sourceUrl}>inspect exact source</ClaimLink><p className="muted">{need.verification}</p></article>) : <p className="muted">No active extracted need is stored. Missing need data is not evidence that the project has no needs.</p>}
          <Link className="arrow" href={`/projects/${encodeURIComponent(project.id)}`}>Open Product Passport →</Link>
        </article>;
      })}</div> : <p className="muted">No products have enough stored evidence for this domain. The group stays available so an unsupported classification is not implied.</p>}
    </section>

    <section className="section" aria-labelledby="connections">
      <div className="eyebrow">Complementary relationship records</div><h2 id="connections">Provider capabilities ↔ consumer needs</h2>
      <p className="muted">These are saved records, not newly generated pairings. Their evidence status is kept separate from the shared problem labels above.</p>
      {domainOpportunities.length ? <div className="stack">{domainOpportunities.map((opportunity) => {
        const capabilities = capByOpportunity.get(opportunity.id) ?? [];
        const sourceRows = evidenceByOpportunity.get(opportunity.id) ?? [];
        const receipts = receiptsByOpportunity.get(opportunity.id) ?? [];
        const executionRuns = runsByOpportunity.get(opportunity.id) ?? [];
        const firstCapability = capabilities[0];
        const status = relationshipStatus({opportunityKind:opportunity.kind, opportunityStatus:opportunity.status, providerExists:Boolean(opportunity.projectB), lifecycleState:firstCapability?.lifecycleState, compatibilityState:firstCapability?.compatibilityState, summary:firstCapability?.summary});
        const consumerId = firstCapability?.consumerProjectId ?? opportunity.projectA;
        const providerId = firstCapability?.providerProjectId ?? opportunity.projectB;
        return <article className="card map-connection" key={opportunity.id}>
          <span className="tag">{status.label}</span>
          <h3><Link href={`/projects/${encodeURIComponent(consumerId)}`}>{names.get(consumerId) ?? 'Consumer record'}</Link> <span className="arrow">{providerId ? '↔' : '→'}</span> {providerId ? <Link href={`/projects/${encodeURIComponent(providerId)}`}>{names.get(providerId) ?? 'Provider record'}</Link> : 'No provider recorded'}</h3>
          <p><strong>Capability or need:</strong> {firstCapability?.capability ?? opportunity.problem}</p>
          <p><strong>Why this may be useful:</strong> {opportunity.reasoning}</p>
          {firstCapability && <><p><strong>Consumer need:</strong> {opportunity.problem}</p><p><strong>Compatibility unknowns:</strong> {firstCapability.uncertainty}</p><p><strong>Next step:</strong> {firstCapability.nextAction}</p></>}
          {!firstCapability && <><p><strong>Compatibility unknowns or requirements:</strong> {opportunity.requirements || 'No compatibility requirements are recorded; compatibility is unknown.'}</p><p><strong>Next step from saved record:</strong> {opportunity.experiment}</p></>}
          <p className="muted">Saved record: {opportunity.kind} · {opportunity.status}. {status.detail}</p>
          <div className="map-evidence-block"><h4>Supporting source evidence</h4>{sourceRows.slice(0, 5).map((row) => <article className="map-claim" key={row.id}><blockquote><p>{row.claim}</p></blockquote><ClaimLink href={row.sourceUrl}>open source evidence</ClaimLink><p className="muted">{row.verification}{row.revision ? ` · revision ${row.revision.slice(0, 12)}` : ''}</p></article>)}{!sourceRows.length && <p className="muted">No source evidence is attached to this saved record.</p>}</div>
          {capabilities.map((capability) => <p className="muted" key={capability.id}>Compatibility: {capability.compatibilityState} · lifecycle: {capability.lifecycleState} · freshness: {capability.freshness}</p>)}
          <div className="map-evidence-block"><h4>Execution and adoption state</h4>{receipts.length || executionRuns.length ? <>
            {receipts.map((receipt) => <article className="map-claim" key={receipt.id}><span className="tag">Execution receipt · level {receipt.evidenceLevel} · {receipt.result}</span><p>Mode: {receipt.mode} · receipt SHA-256 {receipt.receiptSha256.slice(0, 16)} · {new Date(receipt.createdAt).toISOString().slice(0, 10)}</p><Link className="source" href={`/trials/${encodeURIComponent(receipt.id)}`}>Inspect execution receipt →</Link></article>)}
            {executionRuns.map((run) => <article className="map-claim" key={run.id}><span className="tag">Recorded execution run · {run.result}</span><p>{run.details.slice(0, 650)}{run.details.length > 650 ? '…' : ''}</p></article>)}
          </> : <p className="muted">No execution receipt or run is linked to this saved connection.</p>}
          <p className="muted">Confirmed adoption: no adoption event is confirmed in this connection record.</p></div>
          <Link className="arrow" href={`/opportunities/${encodeURIComponent(opportunity.id)}`}>Open full connection details and next action →</Link>
        </article>;
      })}</div> : <article className="card"><h3>No saved provider-to-consumer record in this group</h3><p>No matching record is present in the imported opportunities. This does not prove there is no suitable provider; it means Trycove has no supported connection to show here.</p><Link className="source" href="/opportunities">Inspect all saved connection records →</Link></article>}
    </section>

    <section className="section" aria-labelledby="people-needs">
      <div className="eyebrow">Adoption and testing evidence</div><h2 id="people-needs">Products asking for feedback or adoption</h2>
      {feedbackOpportunities.length || feedbackNeeds.length ? <div className="grid">{feedbackOpportunities.map((opportunity) => {const room=rooms.find(room=>room.problemMap?.opportunityId===opportunity.id);return <article className="card" id={opportunity.id} key={opportunity.id}><span className="tag">Explicit source-backed user-feedback request</span><h3><Link href={`/projects/${encodeURIComponent(opportunity.projectA)}`}>{names.get(opportunity.projectA) ?? 'Product'}</Link></h3><blockquote><p>{opportunity.problem}</p></blockquote><p>{relationshipStatus({opportunityKind:opportunity.kind,opportunityStatus:opportunity.status,providerExists:false}).detail}</p>{(evidenceByOpportunity.get(opportunity.id) ?? []).slice(0, 2).map((row) => <p key={row.id}><ClaimLink href={row.sourceUrl}>{row.verification}</ClaimLink></p>)}<div className="bar"><Link className="arrow" href={`/opportunities/${encodeURIComponent(opportunity.id)}`}>Review request and questions →</Link>{room&&<Link className="button secondary" href={`/trials/rooms/${room.id}`}>Open its Guided Trial Room →</Link>}</div></article>})}{feedbackNeeds.map((need) => <article className="card" key={need.id}><span className="tag">Automated need classification · {need.category} / {need.stance}</span><h3>{names.get(need.projectId) ?? 'Product'}</h3><blockquote><p>{need.excerpt}</p></blockquote><p>{need.verification}</p><ClaimLink href={need.sourceUrl}>inspect source →</ClaimLink></article>)}</div> : <p className="muted">No explicit user-testing or adoption request is supported by this domain's loaded records. A directory testnet flag or app status is not treated as a request for testers.</p>}
      <p className="muted">Opening a room does not create a tester result. Only saved task observations appear in its separate private receipt.</p>
    </section>

    <section className="section">
      <div className="eyebrow">Product Hub</div><h2>Continue exploring</h2>
      <div className="bar"><Link className="button" href="/map">Back to all problem groups</Link><Link className="button secondary" href="/projects">Open Product Hub</Link><Link className="button secondary" href="/opportunities">All connections</Link></div>
    </section>
  </>;
}
