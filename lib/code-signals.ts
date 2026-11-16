export type CodeSignal={kind:'architecture'|'provides';concept:string;claim:string};
/** Each rule requires multiple concrete interface markers within one source file. */
export function extractCodeSignals(path:string,content:string):CodeSignal[]{const out:CodeSignal[]=[];if(content.length>500000)return out;
 if(/\.(?:ts|tsx|js|mjs)$/.test(path)&&/\b(?:Transaction\.from|cccAny\.Transaction\.from)\s*\(/.test(content)&&/completeFeeBy\s*\(/.test(content)&&/\b(?:signTransaction|sendTransaction)\s*\(/.test(content))out.push({kind:'architecture',concept:'submits-ccc-transaction',claim:`${path} constructs and fee-completes a CCC transaction and invokes a signer.`});
 if(/\.(?:ts|tsx|js|mjs)$/.test(path)&&/findCellsByLock\s*\(/.test(content)&&/outputData/.test(content))out.push({kind:'architecture',concept:'reads-cells-by-lock',claim:`${path} queries cells by lock and reads their output data.`});
 if(/\.rs$/.test(path)&&/GET \/v1\/cells\?lock_hash/.test(content)&&/query_by_lock_hash/.test(content)&&/include_data/.test(content))out.push({kind:'provides',concept:'query-cells-by-lock',claim:`${path} defines a paginated GET /v1/cells endpoint with lock-hash filtering and optional cell data.`});
 if(/\.(?:ts|js)$/.test(path)&&/SUBMISSION_UNKNOWN/.test(content)&&/reconcil/i.test(content)&&/broadcast/i.test(content))out.push({kind:'provides',concept:'transaction-recovery',claim:`${path} handles ambiguous submission and reconciliation around broadcast.`});
 if(/\.mjs$/.test(path)&&/export function analyzeTransaction\s*\(/.test(content)&&/policyInput/.test(content))out.push({kind:'provides',concept:'transaction-policy-review',claim:`${path} exports a transaction and policy analyzer.`});
 return out}
