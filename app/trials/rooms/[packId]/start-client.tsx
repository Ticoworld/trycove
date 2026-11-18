'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import {startGuidedTrial} from './actions';

type SavedSession = {id: string; startedAt: string};

export function GuidedTrialStart({packId}: {packId: string}) {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedSession[]>([]);
  const [selfReported, setSelfReported] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(`trycove-guided-trials:${packId}`) ?? '[]');
      if (Array.isArray(stored)) setSaved(stored.filter((item): item is SavedSession => Boolean(item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(item.id) && typeof item.startedAt === 'string')));
    } catch { setSaved([]); }
  }, [packId]);

  async function begin() {
    if (!selfReported || busy) return;
    setBusy(true);
    setError('');
    try {
      const session = await startGuidedTrial(packId, true);
      try {
        const key = `trycove-guided-trials:${packId}`;
        const previous: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
        const entries = Array.isArray(previous) ? previous.filter((item): item is SavedSession => Boolean(item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{16,40}$/.test(item.id) && typeof item.startedAt === 'string')) : [];
        const next = [{id: session.sessionId, startedAt: session.startedAt}, ...entries.filter((item) => item.id !== session.sessionId)].slice(0, 12);
        localStorage.setItem(key, JSON.stringify(next));
        setSaved(next);
      } catch { /* The private cookie and URL still support this session. */ }
      router.push(`/trials/rooms/${packId}/sessions/${session.sessionId}`);
    } catch {
      setError('The private session could not be started. Reload and try again.');
      setBusy(false);
    }
  }

  return <div className="guided-trial-entry">
    <label className="guided-trial-consent"><input type="checkbox" checked={selfReported} onChange={(event) => setSelfReported(event.target.checked)} /> I am recording my own attempt. I understand Trycove does not verify my identity or independently prove that I am a human tester.</label>
    <button type="button" onClick={begin} disabled={!selfReported || busy}>{busy ? 'Starting private session…' : 'Start a private trial session'}</button>
    <p className="muted">This browser stores a private access cookie and a non-secret session link for resume. The app only shows notes through this session cookie; the Trycove server/database operator can access stored text. Never enter addresses, keys or passkey details.</p>
    {error && <p role="alert">{error}</p>}
    {saved.length > 0 && <section aria-labelledby="resume-trial-session"><h3 id="resume-trial-session">Resume on this browser</h3><ul>{saved.map((session) => <li key={session.id}><Link className="source" href={`/trials/rooms/${packId}/sessions/${session.id}`}>Resume session started {new Date(session.startedAt).toLocaleString()}</Link></li>)}</ul><p className="muted">A saved link alone cannot open the session; its private HttpOnly cookie is also required.</p></section>}
  </div>;
}
