import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../../lib/db';
import {projects,sourceRecords} from '../../lib/schema';
import {qualifiedCatalogCondition} from '../../lib/qualified-map';
import {getProblemMapOverview} from '../../lib/problem-map-data';
import {CkbDappsProjectSchema,safeHttpUrl} from '../../lib/sources/ckbdapps-json';
import {places} from '../components/district-art';

export type RelationshipProfile={id:string;name:string;logo?:string;kind?:number;color?:string;visible:boolean};
export async function relationshipProfiles(ids:string[]):Promise<Map<string,RelationshipProfile>>{
 const unique=[...new Set(ids.filter(Boolean))];if(!unique.length)return new Map();
 const [all,visible,sources,overview]=await Promise.all([
  db.select({id:projects.id,name:projects.name}).from(projects).where(inArray(projects.id,unique)),
  db.select({id:projects.id}).from(projects).where(and(inArray(projects.id,unique),qualifiedCatalogCondition())),
  db.select().from(sourceRecords).where(and(inArray(sourceRecords.projectId,unique),eq(sourceRecords.source,'CKBdapps JSON'))).orderBy(desc(sourceRecords.observedAt)),
  getProblemMapOverview(),
 ]);
 const visibleIds=new Set(visible.map(p=>p.id));const latest=new Map<string,typeof sources[number]>();for(const source of sources)if(!latest.has(source.projectId))latest.set(source.projectId,source);
 return new Map(all.map(project=>{
  let logo:string|undefined;const record=latest.get(project.id);if(record){try{const parsed=CkbDappsProjectSchema.safeParse((JSON.parse(record.raw) as {record?:unknown}).record);const url=parsed.success?safeHttpUrl(parsed.data.logo):undefined;if(url?.startsWith('https://'))logo=url}catch{}}
  const memberships=overview.memberships.get(project.id);const slug=Object.keys(places).find(key=>memberships?.has(key));const place=slug?places[slug]:undefined;
  return [project.id,{...project,logo,kind:place?.kind,color:place?.color,visible:visibleIds.has(project.id)}] as const;
 }));
}
