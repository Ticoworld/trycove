import '../../../../evidence-pages.css';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {and, asc, count, eq} from 'drizzle-orm';
import {db} from '../../../../../lib/db';
import {footprintObservations, projects, technicalFootprints} from '../../../../../lib/schema';
import {FootprintLink, ObservationCard, Unknowns} from '../../../../components/footprint';

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
    <section className="hero evidence-intro"><Link className="evidence-return" href={`/projects/${encodeURIComponent(id)}`}>{project.name}</Link><h1>Technical footprint</h1><p>Source observations are evidence for investigation. They do not establish runtime behavior, compatibility, deployment state or adoption.</p></section>
    <section className="section"><div className="detail"><div className="stack"><div className="card"><FootprintLink footprint={footprint}/><p>Repository: {footprint.repository} · scope: {footprint.scope}</p></div><div className="card"><span className="tag">Coverage and unknowns</span><Unknowns value={footprint.unknowns}/></div></div><aside className="card"><span className="tag">Inspect by dimension</span><p><Link className="source" href="?">All observations</Link></p>{dimensions.map(value=><p key={value}><Link className="source" href={`?dimension=${encodeURIComponent(value)}`}>{value}</Link></p>)}<p>{total} observations{dimension ? ` in ${dimension}` : ''}.</p></aside></div></section>
    <section className="section"><h2>Source observations</h2><div className="stack">{observations.map(o=><ObservationCard key={o.id} observation={o}/>)}</div>{!observations.length&&<p className="muted">No observations on this page. Choose another dimension or return to the first page.</p>}<div className="bar" style={{marginTop:'24px'}}>{page>1&&<Link className="button secondary" href={url(page-1)}>Previous</Link>}{page*pageSize<total&&<Link className="button secondary" href={url(page+1)}>Next</Link>}</div></section>
  </div>;
}
