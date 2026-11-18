import Link from 'next/link';
import {PROBLEM_DOMAINS, UNCLASSIFIED_DOMAIN} from '../../lib/problem-map';
import {getProblemMapOverview} from '../../lib/problem-map-data';

export const dynamic = 'force-dynamic';

export default async function ProblemMapPage() {
  const overview = await getProblemMapOverview();
  const productCount = overview.projects.length;
  return <>
    <section className="hero">
      <div className="eyebrow">Explore · Problem & Capability Map</div>
      <h1>Browse CKB products by the problems they address.</h1>
      <p>Groups come from imported directory categories, structured source-intent scopes, and existing recorded capability evidence. Shared labels help organize browsing; they do not prove products are compatible.</p>
      <div className="bar"><Link className="button" href="/projects">Search every product</Link><Link className="button secondary" href="/opportunities">Open connection records</Link></div>
    </section>

    <section className="section" aria-labelledby="map-groups">
      <div className="section-head"><div><div className="eyebrow">Problem domains</div><h2 id="map-groups">Products and recorded needs</h2></div><span className="muted">{productCount} imported product identities</span></div>
      <p className="muted">A product can appear in more than one group when separate source records support each placement. Open a group to inspect products, needs, pinned code observations, saved connections and evidence gaps.</p>
      <div className="grid map-domain-grid">{PROBLEM_DOMAINS.map((domain) => <Link className="card map-domain-card" href={`/map/${domain.slug}`} key={domain.slug}>
        <span className="tag">{overview.counts.get(domain.slug) ?? 0} products</span><h3>{domain.title}</h3><p>{domain.summary}</p><span className="arrow">Open problem group →</span>
      </Link>)}
        <Link className="card map-domain-card" href={`/map/${UNCLASSIFIED_DOMAIN.slug}`}>
          <span className="tag">{overview.unclassifiedCount} products</span><h3>{UNCLASSIFIED_DOMAIN.title}</h3><p>{UNCLASSIFIED_DOMAIN.summary}</p><span className="arrow">Review products without a supported placement →</span>
        </Link>
      </div>
    </section>

    <section className="section">
      <div className="eyebrow">How to read the map</div><h2>Similarity and connection are different records</h2>
      <div className="grid">
        <article className="card"><span className="tag">Shared problem group</span><h3>Similar labels</h3><p>Products with a shared imported category or exact source scope are grouped together. This is a navigation aid, not a claim that their features are identical.</p></article>
        <article className="card"><span className="tag">Saved relationship</span><h3>Possible provider ↔ consumer fit</h3><p>Connection cards come from stored opportunity, need, capability and evidence records. Each card keeps its recorded state and unknowns visible.</p></article>
        <article className="card"><span className="tag">No provider confirmed</span><h3>Evidence gaps stay visible</h3><p>A documented need without a qualified provider remains a useful map result. It does not mean no provider exists outside the reviewed records.</p></article>
      </div>
    </section>
  </>;
}
