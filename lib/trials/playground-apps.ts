import 'server-only';

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
