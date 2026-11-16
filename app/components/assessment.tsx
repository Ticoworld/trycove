import type {intelligenceAssessments,technicalFootprints} from '../../lib/schema';
import {FootprintLink} from './footprint';

type Assessment = typeof intelligenceAssessments.$inferSelect;
type Footprint = typeof technicalFootprints.$inferSelect;
type Finding = {dimension:string; conclusion:string; explanation:string};

function parseFindings(value:string):Finding[] {
  try {
    const parsed: unknown=JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item:unknown) => {
      if (!item || typeof item!=='object') return [];
      const record=item as Record<string,unknown>;
      if (typeof record.dimension!=='string'||typeof record.conclusion!=='string'||typeof record.explanation!=='string') return [];
      return [{dimension:record.dimension,conclusion:record.conclusion,explanation:record.explanation}];
    }).slice(0,50);
  } catch { return []; }
}

export function IntelligenceAssessment({assessment,consumer,provider}:{assessment:Assessment;consumer?:Footprint;provider?:Footprint}) {
  const findings=parseFindings(assessment.findings);
  return <section aria-label="Stored intelligence assessment" className="card">
    <span className="tag">Stored analysis · {assessment.conclusion.replaceAll('_',' ')}</span>
    <p>Assessed {assessment.createdAt.toISOString().slice(0,10)} using the source snapshots below. This is a planner conclusion; source observations and unknowns are not evidence of execution, chain validity or adoption.</p>
    {findings.length ? findings.map((finding,index)=><div key={`${finding.dimension}-${index}`}>
      <h3>{finding.dimension} · {finding.conclusion.replaceAll('_',' ')}</h3>
      <p>{finding.explanation}</p>
    </div>) : <p className="muted">No readable findings were saved for this assessment.</p>}
    <details><summary>Source snapshots used by this assessment</summary>
      {consumer ? <FootprintLink footprint={consumer} projectName="Consumer"/> : <p>Consumer footprint unavailable.</p>}
      {provider ? <FootprintLink footprint={provider} projectName="Provider"/> : <p>Provider footprint unavailable.</p>}
      <p>These are the snapshots used for the assessment, which can differ from the latest stored footprints.</p>
    </details>
  </section>;
}
