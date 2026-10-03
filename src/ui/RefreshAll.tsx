import { useRef, useState } from 'react';
import type { Listing } from '../types';
import { api } from './api';

const LAST_KEY = 'househunter.lastRefreshAll';
// Polite spacing between requests to the listing site.
const MIN_GAP_MS = 3000;
const JITTER_MS = 2000;

interface Report {
  checked: number;
  total: number;
  cancelled: boolean;
  changed: { address: string; changes: string[] }[];
  errors: { address: string; error: string }[];
}

interface Props {
  getListings: () => Listing[];
  onUpdated: (l: Listing) => void;
}

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

const label = (l: Listing) => `${l.address}${l.position ? ' ' + l.position : ''}`;

export function RefreshAll({ getListings, onUpdated }: Props) {
  const [progress, setProgress] = useState<{ i: number; total: number; current: string } | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [last, setLast] = useState(readLast);
  const cancelRef = useRef(false);

  const run = async () => {
    const targets = getListings().filter((l) => l.url && l.status !== 'removed');
    if (!targets.length) return;
    const mins = Math.ceil((targets.length * (MIN_GAP_MS + JITTER_MS / 2)) / 60_000);
    if (
      !window.confirm(
        `Re-check ${targets.length} saved listings, one at a time (about ${mins} min)?\n\n` +
          "This fetches each listing page from the site. Property sites' terms restrict automated access, so use it occasionally (e.g. weekly).",
      )
    )
      return;

    cancelRef.current = false;
    setReport(null);
    const rep: Report = { checked: 0, total: targets.length, cancelled: false, changed: [], errors: [] };

    for (let i = 0; i < targets.length; i++) {
      if (cancelRef.current) {
        rep.cancelled = true;
        break;
      }
      const t = targets[i];
      setProgress({ i: i + 1, total: targets.length, current: label(t) });
      try {
        const { listing, changes } = await api.refresh(t.id);
        onUpdated(listing);
        if (changes.length) rep.changed.push({ address: label(t), changes });
      } catch (e) {
        rep.errors.push({ address: label(t), error: (e as Error).message });
      }
      rep.checked++;
      if (i < targets.length - 1) {
        const gap = MIN_GAP_MS + Math.random() * JITTER_MS;
        const until = Date.now() + gap;
        while (Date.now() < until && !cancelRef.current) await new Promise((r) => setTimeout(r, 200));
      }
    }

    setProgress(null);
    setReport(rep);
    if (!rep.cancelled) {
      const now = new Date().toISOString();
      try {
        localStorage.setItem(LAST_KEY, now);
      } catch {
        /* ignore */
      }
      setLast(now);
    }
  };

  return (
    <>
      <button
        className="btn ghost"
        onClick={run}
        disabled={!!progress}
        title={`Re-check every saved listing for price and status changes. Last run: ${ago(last)}`}
      >
        {progress ? `Refreshing ${progress.i}/${progress.total}…` : 'Refresh all'}
      </button>

      {progress && (
        <div className="banner refresh-banner" role="status">
          <div className="refresh-bar">
            <div style={{ width: `${(100 * (progress.i - 1)) / progress.total}%` }} />
          </div>
          <span>
            Checking {progress.i} of {progress.total}: <strong>{progress.current}</strong>
          </span>
          <button className="link-btn" onClick={() => (cancelRef.current = true)}>
            Cancel
          </button>
        </div>
      )}

      {report && !progress && (
        <div className={`banner ${report.errors.length ? 'error' : ''} refresh-banner`} role="status">
          <div className="refresh-report">
            <strong>
              {report.cancelled ? 'Refresh cancelled' : 'Refresh done'}: checked {report.checked} of {report.total}
              {' · '}
              {report.changed.length} changed
              {report.errors.length ? ` · ${report.errors.length} failed` : ''}
            </strong>
            {report.changed.length > 0 && (
              <ul>
                {report.changed.map((c) => (
                  <li key={c.address}>
                    {c.address}: {c.changes.join('; ')}
                  </li>
                ))}
              </ul>
            )}
            {report.errors.length > 0 && (
              <ul>
                {report.errors.map((c) => (
                  <li key={c.address}>
                    {c.address}: {c.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="link-btn" onClick={() => setReport(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
