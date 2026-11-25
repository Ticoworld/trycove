import {WorkspaceDialog} from '../workspace-dialog';
import '../evidence-pages.css';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {db} from '../../lib/db';
import {projects} from '../../lib/schema';
import discoveryData from '../../evidence/tc-01e/gate-c-functional/functional-discovery-ui.json';

export const dynamic='force-dynamic';

type Source = {path:string;startLine:number;endLine:number;sourceUrl:string;evidenceTextSha256:string;fact:string;kind:string};
type Role = {projectId:string;repository:string;revision:string|null;owner:string;consumerOperations:string[];consumerCallCount:number;providerOperations:string[];providerApiCount:number;networks:string[];missing:string[]};
type Hypothesis = {
 id:string;status:string;consumer:{projectId:string;repository:string;revision:string;operation:string;call:Source;callCount:number;networks:string[]};
 provider:{projectId:string;repository:string;revision:string;operation:string;api:Source;apiCount:number;networks:string[]};
 interfaceMapping:string;compatibility:Array<{dimension:string;state:string;explanation:string}>;valueAssessment:{state:string;explanation:string};rejectionReasons:string[];
};
type Report = {createdAt:string;baselineCommit:string;implementationBaseline:string;capabilityFamily:string;frozenCohort:{path:string;sha256:string;methodologyPath:string;methodologySha256:string;selectedCount:number};sourceScan:{path:string;sha256:string;analyzerVersion:string;selectedCount:number;commandSucceeded:number;commandFailed:number;sourceInspections:Array<{repositoryPath:string;revision:string|null;sourceInspectionStatus:string;fileCount?:number;observationCount?:number;unknowns?:string[]}>};matcher:{result:{roleAssessments:Role[];hypothesisCount:number;selectedCandidateId:string|null;rejectedHypotheses:Hypothesis[];rejectedOperationEdges:Array<{consumerProjectId:string;providerProjectId:string;consumerRepository:string;providerRepository:string;operation:string;reason:string;consumerEvidenceId:string;providerEvidenceId:string}>}}};

const githubUrl=(value:string)=>{try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='github.com'?url.toString():null}catch{return null}};

export default async function Page({searchParams}:{searchParams:Promise<{product?:string}>}){
 const params=await searchParams;
 const productId=params.product;
 if(productId&&!/^[a-zA-Z0-9_-]{1,100}$/.test(productId))notFound();
 const [productRows]=await Promise.all([db.select({id:projects.id,name:projects.name}).from(projects)]);
 const report=discoveryData as Report;
 const names=new Map(productRows.map(row=>[row.id,row.name]));
 const roles=report.matcher.result.roleAssessments;
 const selectedRole=productId?roles.find(role=>role.projectId===productId):undefined;
 if(productId&&!selectedRole)notFound();
 const roleIds=new Set(selectedRole?[selectedRole.projectId]:roles.map(role=>role.projectId));
 const findings=report.matcher.result.rejectedHypotheses.filter(item=>roleIds.has(item.consumer.projectId)||roleIds.has(item.provider.projectId));
 const visibleRoles=selectedRole?[selectedRole]:roles;
 const failedInspections=report.sourceScan.sourceInspections.filter(item=>item.sourceInspectionStatus.startsWith('failed'));
 const passportHref=selectedRole?`/projects/${encodeURIComponent(selectedRole.projectId)}`:'/projects';

 return <div className="evidence-paper discovery-page">
  <section className="hero evidence-intro">
   <Link className="evidence-return" href={passportHref}>{selectedRole?`${names.get(selectedRole.projectId)??selectedRole.projectId} Product Passport`:'Explore projects'}</Link>
   <h1>Looking for useful connections</h1>
   <p>We reviewed how these projects look up CKB data. The source review did not find a connection that clearly added value.</p>
   <p className="discovery-summary">{report.frozenCohort.selectedCount} repositories reviewed · No connection selected</p>
  </section>

  <WorkspaceDialog label="How we reviewed"><section className="section">
   <h2>What was evaluated</h2>
   <p>{report.capabilityFamily}. The method and cohort were frozen before source inspection; the matching engine contains no pair names.</p>
   <p><strong>Baseline:</strong> the consumers already make the matched query calls in their pinned application code. The exported provider methods delegate to those same CKB query operations. The source review found no provider-specific data, validation, freshness guarantee, failure reduction, or measurable behavior improvement to justify an adapter.</p>
   <p><strong>Selection:</strong> no connection was chosen. All {report.matcher.result.hypothesisCount} exact-operation hypotheses were rejected for lack of demonstrated value; mismatched query edges are retained below. No issues or pull requests were used.</p>
   <p><strong>Frozen cohort:</strong> <code>{report.frozenCohort.path}</code> · SHA-256 <code>{report.frozenCohort.sha256}</code> · methodology <code>{report.frozenCohort.methodologyPath}</code> · SHA-256 <code>{report.frozenCohort.methodologySha256}</code></p>
   <p><strong>Source scan:</strong> analyzer {report.sourceScan.analyzerVersion}, {report.sourceScan.commandSucceeded}/{report.sourceScan.selectedCount} scan commands succeeded. One selected source pin yielded zero supported files and remains a failed inspection.</p>
   <p><strong>Trycove revisions:</strong> baseline <code>{report.baselineCommit}</code> · implementation baseline <code>{report.implementationBaseline}</code></p>
  </section></WorkspaceDialog>

  <section className="section discovery-roles">
   <div className="discovery-section-heading"><h2>{selectedRole?'Project reviewed':'Projects reviewed'}</h2><p>Open a project for the source details.</p></div>
   <div className="discovery-role-list">{visibleRoles.map(role=>{const name=names.get(role.projectId)??role.projectId;const hasCalls=role.consumerCallCount>0;const hasMethods=role.providerApiCount>0;return <article className="discovery-role" key={role.projectId}><div><h3>{name}</h3><p>{hasCalls||hasMethods?'Source observations recorded':'No matching code found in this review'}</p></div><WorkspaceDialog label={`Details for ${name}`} buttonLabel="View details"><p><strong>Repository:</strong> {githubUrl(role.repository)?<a className="source" href={githubUrl(role.repository)!}>{role.repository}</a>:role.repository}</p><p>Owner {role.owner} · revision <code>{role.revision??'unknown'}</code></p><p><strong>Observed consumer calls:</strong> {role.consumerOperations.join(', ')||'none'} ({role.consumerCallCount} source observations)</p><p><strong>Observed provider methods:</strong> {role.providerOperations.join(', ')||'none'} ({role.providerApiCount} source observations)</p><p><strong>Networks mentioned:</strong> {role.networks.join(', ')||'unknown'}</p>{role.missing.length>0&&<p><strong>Missing evidence:</strong> {role.missing.join('; ')}</p>}</WorkspaceDialog></article>})}</div>
   {failedInspections.length>0&&<WorkspaceDialog label="Unavailable source reviews">{failedInspections.map(item=><p key={item.repositoryPath}>{item.repositoryPath} · {item.revision??'unpinned'} · {item.sourceInspectionStatus}</p>)}</WorkspaceDialog>}
  </section>

  <section className="section">
   <h2>Connections considered ({findings.length})</h2>
   <p className="muted">These ideas were not selected. Open the details to see why.</p>
   <div className="stack">{findings.map(item=>{
    const consumerName=names.get(item.consumer.projectId)??item.consumer.projectId;
    const providerName=names.get(item.provider.projectId)??item.provider.projectId;
    const consumerHref=githubUrl(item.consumer.call.sourceUrl),providerHref=githubUrl(item.provider.api.sourceUrl);
    return <article className="discovery-idea" key={item.id}>
     <div><h3>{consumerName} and {providerName}</h3><p>Not selected in this review.</p></div><WorkspaceDialog label={`Why ${consumerName} and ${providerName} were not selected`} buttonLabel="View why"><div className="review-answer"><p>Both projects use the same type of CKB data query.</p><p>This review did not find a clear added benefit from connecting them. That is a finding from the available source code, not a verdict on either product.</p></div><WorkspaceDialog label={`Source details for ${consumerName} and ${providerName}`} buttonLabel="View source details">
     <p><strong>Consumer:</strong> {item.consumer.call.fact} · {item.consumer.callCount} calls · {item.consumer.networks.join(', ')||'network unknown'}.</p>
     <p>{consumerHref?<a className="source" href={consumerHref} target="_blank" rel="noreferrer">{item.consumer.call.path}:{item.consumer.call.startLine} at {item.consumer.revision.slice(0,12)} ↗</a>:`${item.consumer.call.path}:${item.consumer.call.startLine}`} · excerpt SHA-256 <code>{item.consumer.call.evidenceTextSha256}</code></p>
     <p><strong>Provider:</strong> {item.provider.api.fact} · {item.provider.apiCount} matching exports/handlers · {item.provider.networks.join(', ')||'network unknown'}.</p>
     <p>{providerHref?<a className="source" href={providerHref} target="_blank" rel="noreferrer">{item.provider.api.path}:{item.provider.api.startLine} at {item.provider.revision.slice(0,12)} ↗</a>:`${item.provider.api.path}:${item.provider.api.startLine}`} · excerpt SHA-256 <code>{item.provider.api.evidenceTextSha256}</code></p>
     <p><strong>Potential boundary:</strong> {item.interfaceMapping}</p>
     <ul>{item.compatibility.map(check=><li key={check.dimension}><strong>{check.dimension} · {check.state}:</strong> {check.explanation}</li>)}</ul>
     <p><strong>Value assessment:</strong> {item.valueAssessment.explanation}</p>
     <p><strong>Rejection:</strong> {item.rejectionReasons.join(' ')}</p></WorkspaceDialog></WorkspaceDialog>
    </article>;
   })}</div>
   {!findings.length&&<p className="muted">No exact-operation hypotheses involve this product in the frozen cohort.</p>}
  </section>

  {!selectedRole&&<section className="section"><WorkspaceDialog label={`Other comparisons (${report.matcher.result.rejectedOperationEdges.length})`}>{report.matcher.result.rejectedOperationEdges.map((edge,index)=><p key={`${edge.consumerEvidenceId}-${edge.providerEvidenceId}`}><strong>{names.get(edge.consumerProjectId)??edge.consumerProjectId} → {names.get(edge.providerProjectId)??edge.providerProjectId} · {edge.operation}:</strong> {edge.reason}</p>)}</WorkspaceDialog></section>}

  <WorkspaceDialog label="More about this review"><section className="section">
   <h2>Integration Lab and execution evidence</h2>
   <article className="card"><span className="tag">Not produced for this discovery attempt</span><p>No pair passed the value gate, so there is no adapter, positive case, negative case, baseline-versus-integrated execution, or execution receipt to display. Gate C remains incomplete. The historical Grid3 to CKB Viz URL receipt is a separate regression example and is not evidence for this review.</p></article>
   <h2>Reproduction</h2>
   <p>Verify the frozen cohort with <code>pnpm tc01e:freeze:functional -- --verify</code>. Recompute this discovery from its pinned scan using <code>pnpm tc01e:discover:functional -- --scan {report.sourceScan.path}</code> against the retained local CKBdapps/Pulse database snapshot.</p>
   <p>That command is a repeated local computation, not independent reproduction. No integration existed to reproduce independently. Database verification used PGlite; a PostgreSQL server was unavailable.</p>
  </section></WorkspaceDialog>
 </div>;
}
