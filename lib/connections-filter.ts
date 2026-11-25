export type ConnectionGroup = 'needs'|'potential'|'tested';
export function reviewedCopyGroup(kind:string):ConnectionGroup {
 return kind==='need'?'needs':kind==='proposal'?'potential':'tested';
}
export function matchesReviewedCopy(copy:{public_kind:string;public_title:string;public_summary:string},query:string,group:string) {
 return (!group||reviewedCopyGroup(copy.public_kind)===group) && `${copy.public_title} ${copy.public_summary}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
}
export function needsConnectionAttention(status:string,state:{publication:string;progress:string;nextAction:string;watchlist:boolean;dueDate:string|null}|undefined) {
 return status==='needs-review'&&(!state||state.publication==='private') || !!state&&state.progress!=='done'&&(!!state.nextAction||state.watchlist||!!state.dueDate);
}
