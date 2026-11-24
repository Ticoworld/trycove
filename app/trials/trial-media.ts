import {and,desc,eq,inArray} from 'drizzle-orm';
import {db} from '../../lib/db';
import {projects,sourceRecords} from '../../lib/schema';
import {qualifiedCatalogCondition} from '../../lib/qualified-map';
import {CkbDappsProjectSchema,safeHttpUrl} from '../../lib/sources/ckbdapps-json';
export async function trialLogos(ids:string[]){
 const unique=[...new Set(ids)];if(!unique.length)return new Map<string,string>();
 const [visible,sources]=await Promise.all([db.select({id:projects.id}).from(projects).where(and(inArray(projects.id,unique),qualifiedCatalogCondition())),db.select().from(sourceRecords).where(and(inArray(sourceRecords.projectId,unique),eq(sourceRecords.source,'CKBdapps JSON'))).orderBy(desc(sourceRecords.observedAt))]);
 const allowed=new Set(visible.map(row=>row.id));const found=new Map<string,string>();const seen=new Set<string>();
 for(const source of sources){if(seen.has(source.projectId)||!allowed.has(source.projectId))continue;seen.add(source.projectId);try{const parsed=CkbDappsProjectSchema.safeParse((JSON.parse(source.raw) as {record?:unknown}).record);const url=parsed.success?safeHttpUrl(parsed.data.logo):undefined;if(url?.startsWith('https://'))found.set(source.projectId,url)}catch{}}
 return found;
}
