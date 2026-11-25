import {WorkspaceDialog} from '../../../../workspace-dialog';
import '../../../../evidence-pages.css';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {and, asc, count, eq} from 'drizzle-orm';
import {db} from '../../../../../lib/db';
import {footprintObservations, projects, technicalFootprints} from '../../../../../lib/schema';
import {ObservationCard, Unknowns} from '../../../../components/footprint';

export const dynamic='force-dynamic';
const pageSize=24;
const dimensions=['interfaces','transaction','state','environment','failure'] as const;

export default async function Page({params,searchParams}:{params:Promise<{id:string;footprintId:string}>;searchParams:Promise<{page?:string;dimension?:string}>}) {
  const {id,footprintId}=await params;
  const {page:rawPage,dimension:rawDimension}=await searchParams;
  const dimension=dimensions.find(value=>value===rawDimension);
  const parsedPage=Number(rawPage ?? '1');
  const page=Number.isSafeInteger(parsedPage)&&parsedPage>0&&parsedPage<=10000?parsedPage:1;
  const [project]=await db.select().from(projects).where(eq(projects.id,id));
  const [footprint]=await db.select().from(technicalFootprints).where(and(eq(technicalFootprints.id,footprintId),eq(technicalFootprints.projectId,id)));
  if(!project||!footprint)notFound();
  const predicate=dimension?and(eq(footprintObservations.footprintId,footprint.id),eq(footprintObservations.dimension,dimension)):eq(footprintObservations.footprintId,footprint.id);
  const [{total}]=await db.select({total:count()}).from(footprintObservations).where(predicate);
  const observations=await db.select().from(footprintObservations).where(predicate)
    .orderBy(asc(footprintObservations.path),asc(footprintObservations.startLine),asc(footprintObservations.id))
    .limit(pageSize).offset((page-1)*pageSize);
  const url=(nextPage:number)=>`?${new URLSearchParams({...dimension&&{dimension},page:String(nextPage)}).toString()}`;
  return <div className="evidence-paper notebook-page">
    <section className="hero evidence-intro"><Link className="evidence-return" href={`/projects/${encodeURIComponent(id)}`}>{project.name}</Link><h1>What we found in the code</h1><p>These are notes from a source review. They do not confirm how the product works today.</p></section>
    <section className="section notebook-overview"><div><h2>Review overview</h2><p>{total} {total===1?'note':'notes'}{dimension ? ` in ${dimension}` : ''} · reviewed {footprint.analyzedAt.toISOString().slice(0,10)}</p><WorkspaceDialog label="Review details"><p>Repository: {footprint.repository}</p><p>Revision: {footprint.revision} · {footprint.fileCount} files · analyzer {footprint.analyzerVersion}</p><p>Scope: {footprint.scope} · status: {footprint.status}</p><h2>What we could not confirm</h2><Unknowns value={footprint.unknowns}/><p>Source analysis does not prove runtime behavior, compatibility, current deployment, or adoption.</p></WorkspaceDialog></div><nav className="notebook-filters" aria-label="Filter source notes"><Link aria-current={!dimension?'page':undefined} href="?">All</Link>{dimensions.map(value=><Link aria-current={dimension===value?'page':undefined} key={value} href={`?dimension=${encodeURIComponent(value)}`}>{value==='interfaces'?'Interfaces':value==='transaction'?'Transactions':value==='state'?'State':value==='environment'?'Environment':'Failures'}</Link>)}</nav></section>
    <section className="section"><h2>Source notes</h2><div className="stack">{observations.map(o=><ObservationCard key={o.id} observation={o}/>)}</div>{!observations.length&&<p className="muted">No notes in this view yet.</p>}<div className="bar" style={{marginTop:'24px'}}>{page>1&&<Link className="button secondary" href={url(page-1)}>Previous</Link>}{page*pageSize<total&&<Link className="button secondary" href={url(page+1)}>Next</Link>}</div></section>
  </div>;
}
