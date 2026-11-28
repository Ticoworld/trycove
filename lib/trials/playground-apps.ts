// Credentials are configured only in the server environment. Room snapshots
// contain the public identifier, never the credential.
export function playgroundApplication(id: string) {
  try {
    const entries: unknown = JSON.parse(process.env.TRYCOVE_PLAYGROUND_APPLICATIONS ?? '{}');
    if (!entries || typeof entries !== 'object' || Array.isArray(entries)) return null;
    const entry = (entries as Record<string, unknown>)[id];
    if (entry && typeof entry === 'object') {
      const {origin, secret} = entry as Record<string, unknown>;
      if (typeof origin !== 'string' || typeof secret !== 'string' || secret.length < 32) return null;
      const url = new URL(origin);
      if (url.origin !== origin || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === '127.0.0.1'))) return null;
      return {origin, secret};
    }
    if (id === 'legacy' && process.env.TRYCOVE_PLAYGROUND_APP_ORIGIN && (process.env.TRYCOVE_PLAYGROUND_APP_SECRET?.length ?? 0) >= 32)
      return {origin: process.env.TRYCOVE_PLAYGROUND_APP_ORIGIN, secret: process.env.TRYCOVE_PLAYGROUND_APP_SECRET!};
  } catch { /* Invalid configuration is unavailable. */ }
  return null;
}

export async function confirmPlaygroundResource(id:string, resourceId:string) {
  const app=playgroundApplication(id);
  if(!app)return false;
  try {
    const response=await fetch(`${app.origin}/__playground/readiness`,{method:'POST',redirect:'error',headers:{'content-type':'application/json',authorization:`Bearer ${app.secret}`},body:JSON.stringify({applicationId:id,resourceId}),signal:AbortSignal.timeout(5000),cache:'no-store'});
    if(!response.ok)return false;
    const result=await response.json();
    return result?.ready===true && result.applicationId===id && result.resourceId===resourceId;
  } catch {return false;}
}
