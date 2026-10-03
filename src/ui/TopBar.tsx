import { useState, type FormEvent, type ReactNode } from 'react';
import { HelpPopover } from './HelpPopover';

interface Props {
  onAdd: (url: string) => Promise<void>;
  onSettings: () => void;
  onToggleFilters: () => void;
  actions?: ReactNode;
}

export function TopBar({ onAdd, onSettings, onToggleFilters, actions }: Props) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!u) return;
    setBusy(true);
    setErr(null);
    try {
      await onAdd(u);
      setUrl('');
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <header className="topbar">
      <button className="icon-btn filters-toggle" onClick={onToggleFilters} aria-label="Toggle filters">
        ☰
      </button>
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ⌂
        </span>
        HouseHunter
      </div>
      <form className="add" onSubmit={submit}>
        <div className="add-row">
          <input
            type="url"
            placeholder="Paste a Rightmove / ESPC / S1 / Zoopla / OnTheMarket URL"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setErr(null);
            }}
            aria-label="Listing URL"
            disabled={busy}
          />
          <button className="btn primary" type="submit" disabled={busy || !url.trim()}>
            {busy ? 'Adding…' : 'Add by URL'}
          </button>
        </div>
        {err ? (
          <div className="error small" role="alert">
            {err}
          </div>
        ) : (
          <div className="muted tiny">
            Fetches only the page you paste. Property sites' terms restrict automated access — use sparingly.
          </div>
        )}
      </form>
      <div className="top-actions">
        {actions}
        <HelpPopover />
        <button className="btn ghost" onClick={onSettings}>
          Settings
        </button>
      </div>
    </header>
  );
}
