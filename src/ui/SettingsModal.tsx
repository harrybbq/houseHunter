import { useEffect, useRef, useState } from 'react';
import type { AreaDef, Criteria, Listing } from '../types';

interface Props {
  criteria: Criteria;
  listings: Listing[];
  onSave: (c: Criteria) => Promise<void>;
  onImport: (listings: Listing[], criteria: Criteria | null) => Promise<void>;
  onClose: () => void;
}

const NUMBER_FIELDS: { key: keyof Criteria; label: string; step?: number; hint?: string }[] = [
  { key: 'maxPrice', label: 'Max price £', step: 5000 },
  { key: 'minBeds', label: 'Min bedrooms' },
  { key: 'minSqftHard', label: 'Min sq ft (hard fail)', step: 25 },
  { key: 'targetSqft', label: 'Target sq ft', step: 25, hint: 'full size points' },
  { key: 'poorSqft', label: 'Poor sq ft', step: 25, hint: 'near-zero size points' },
  { key: 'bed2MinWidthM', label: 'Bedroom 2 min width m', step: 0.05 },
];

const TOGGLES: { key: keyof Criteria; label: string }[] = [
  { key: 'allowSecondFloorException', label: 'Allow 2nd floor if otherwise perfect' },
  { key: 'allowWindowlessException', label: 'Allow windowless kitchen (warning, not fail)' },
  { key: 'requireTenement', label: 'Require tenement (otherwise soft preference)' },
];

interface AreaRow {
  key: string;
  name: string;
  outcodes: string;
  rank: number;
  notes: string;
}

const toRows = (areas: Record<string, AreaDef>): AreaRow[] =>
  Object.entries(areas)
    .sort((a, b) => a[1].rank - b[1].rank)
    .map(([key, a]) => ({ key, name: a.name, outcodes: a.outcodes.join(', '), rank: a.rank, notes: a.notes ?? '' }));

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

function looksLikeListings(x: unknown): x is Listing[] {
  return Array.isArray(x) && x.every((l) => l && typeof l === 'object' && typeof (l as Listing).id === 'string');
}

export function SettingsModal({ criteria, listings, onSave, onImport, onClose }: Props) {
  const [c, setC] = useState<Criteria>(() => structuredClone(criteria));
  const [areas, setAreas] = useState<AreaRow[]>(() => toRows(criteria.areas));
  const [keywords, setKeywords] = useState(criteria.excludeKeywords.join('\n'));
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    window.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setNum = (k: keyof Criteria, v: string) => setC({ ...c, [k]: v === '' ? 0 : Number(v) });
  const weightSum = Object.values(c.weights).reduce((a, b) => a + b, 0);

  const build = (): Criteria | string => {
    const out: Record<string, AreaDef> = {};
    for (const r of areas) {
      const key = r.key.trim();
      if (!key) return 'Every area needs a key.';
      if (out[key]) return `Duplicate area key "${key}".`;
      if (!r.name.trim()) return `Area "${key}" needs a name.`;
      out[key] = {
        name: r.name.trim(),
        outcodes: r.outcodes
          .split(/[,\s]+/)
          .map((o) => o.trim().toUpperCase())
          .filter(Boolean),
        rank: Number(r.rank) || 1,
        ...(r.notes.trim() ? { notes: r.notes.trim() } : {}),
      };
    }
    return {
      ...c,
      excludeKeywords: keywords
        .split('\n')
        .map((k) => k.trim())
        .filter(Boolean),
      areas: out,
    };
  };

  const save = async () => {
    const next = build();
    if (typeof next === 'string') return setErr(next);
    setErr(null);
    setSaving(true);
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), criteria, listings }, null, 2)], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `househunter-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const importJson = async (file: File) => {
    setErr(null);
    setMsg(null);
    try {
      const data = JSON.parse(await file.text()) as unknown;
      let ls: unknown;
      let cr: Criteria | null = null;
      if (Array.isArray(data)) ls = data;
      else if (data && typeof data === 'object') {
        ls = (data as { listings?: unknown }).listings;
        const maybe = (data as { criteria?: Criteria }).criteria;
        if (maybe && typeof maybe === 'object' && typeof maybe.maxPrice === 'number' && maybe.areas) cr = maybe;
      }
      if (!looksLikeListings(ls)) throw new Error('File has no valid "listings" array.');
      const ok = window.confirm(
        `Replace ${listings.length} current listings with ${ls.length} from the file${cr ? ', and replace criteria' : ''}?`,
      );
      if (!ok) return;
      await onImport(ls, cr);
      if (cr) {
        setC(structuredClone(cr));
        setAreas(toRows(cr.areas));
        setKeywords(cr.excludeKeywords.join('\n'));
      }
      setMsg(`Imported ${ls.length} listings${cr ? ' and criteria' : ''}.`);
    } catch (e) {
      setErr(`Import failed: ${(e as Error).message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" tabIndex={-1} ref={dialogRef}>
        <header className="modal-head">
          <h2 id="settings-title">Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </header>

        <div className="modal-body">
          <section>
            <h3>Hard limits</h3>
            <div className="settings-grid">
              {NUMBER_FIELDS.map((f) => (
                <label key={f.key} className="field">
                  <span>
                    {f.label} {f.hint && <span className="muted small">({f.hint})</span>}
                  </span>
                  <input type="number" step={f.step ?? 1} value={c[f.key] as number} onChange={(e) => setNum(f.key, e.target.value)} />
                </label>
              ))}
            </div>
            {TOGGLES.map((t) => (
              <label key={t.key} className="check">
                <input
                  type="checkbox"
                  checked={c[t.key] as boolean}
                  onChange={(e) => setC({ ...c, [t.key]: e.target.checked })}
                />
                {t.label}
              </label>
            ))}
          </section>

          <section>
            <h3>
              Weights <span className={`muted small ${weightSum !== 100 ? 'warn-text' : ''}`}>sum {weightSum}</span>
            </h3>
            <div className="settings-grid">
              {(Object.keys(c.weights) as (keyof Criteria['weights'])[]).map((k) => (
                <label key={k} className="field">
                  <span>{k}</span>
                  <input
                    type="number"
                    value={c.weights[k]}
                    onChange={(e) => setC({ ...c, weights: { ...c.weights, [k]: Number(e.target.value) || 0 } })}
                  />
                </label>
              ))}
            </div>
            <h3>Bonuses</h3>
            <div className="settings-grid">
              {(Object.keys(c.bonuses) as (keyof Criteria['bonuses'])[]).map((k) => (
                <label key={k} className="field">
                  <span>{k}</span>
                  <input
                    type="number"
                    value={c.bonuses[k]}
                    onChange={(e) => setC({ ...c, bonuses: { ...c.bonuses, [k]: Number(e.target.value) || 0 } })}
                  />
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3>
              Exclude keywords <span className="muted small">one per line</span>
            </h3>
            <textarea rows={6} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </section>

          <section>
            <h3>Areas</h3>
            <div className="areas-table">
              <div className="areas-row head">
                <span>Key</span>
                <span>Name</span>
                <span>Outcodes</span>
                <span>Rank</span>
                <span>Notes</span>
                <span />
              </div>
              {areas.map((r, i) => {
                const upd = (p: Partial<AreaRow>) => setAreas(areas.map((x, j) => (j === i ? { ...x, ...p } : x)));
                return (
                  <div className="areas-row" key={i}>
                    <input aria-label="Key" value={r.key} onChange={(e) => upd({ key: slug(e.target.value) })} />
                    <input aria-label="Name" value={r.name} onChange={(e) => upd({ name: e.target.value })} />
                    <input aria-label="Outcodes" value={r.outcodes} onChange={(e) => upd({ outcodes: e.target.value })} />
                    <input
                      aria-label="Rank"
                      type="number"
                      min={1}
                      value={r.rank}
                      onChange={(e) => upd({ rank: Number(e.target.value) })}
                    />
                    <input aria-label="Notes" value={r.notes} onChange={(e) => upd({ notes: e.target.value })} />
                    <button className="icon-btn" aria-label={`Remove ${r.name}`} onClick={() => setAreas(areas.filter((_, j) => j !== i))}>
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              className="btn ghost small"
              onClick={() => setAreas([...areas, { key: '', name: '', outcodes: '', rank: areas.length + 1, notes: '' }])}
            >
              + Add area
            </button>
            <p className="muted small">Renaming a key orphans listings that use the old key (they show as Other / unknown).</p>
          </section>

          <section>
            <h3>Backup</h3>
            <div className="row-gap">
              <button className="btn ghost" onClick={exportJson}>
                Export JSON
              </button>
              <button className="btn ghost" onClick={() => fileRef.current?.click()}>
                Import JSON…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
              />
            </div>
            <p className="muted small">Export saves listings and saved criteria. Import replaces them.</p>
          </section>
        </div>

        <footer className="modal-foot">
          {err && <span className="error">{err}</span>}
          {msg && <span className="ok-text">{msg}</span>}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save criteria'}
          </button>
        </footer>
      </div>
    </div>
  );
}
