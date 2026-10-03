import { useEffect, useState } from 'react';
import type { Criteria, Floor, KitchenVerdict, Listing, Score } from '../types';
import { TierChip } from './ListingTable';
import {
  FLOOR_OPTIONS,
  KITCHEN_OPTIONS,
  effectiveSqft,
  floorLong,
  hasLocation,
  money,
  parseNum,
  sqftMismatch,
  statusLabel,
} from './format';

interface Props {
  listing: Listing;
  score: Score | undefined;
  criteria: Criteria;
  busy: boolean;
  error: string | null;
  onPatch: (patch: Partial<Listing>) => void;
  onRefresh: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Text input that commits on blur / Enter rather than per keystroke. */
function CommitInput({
  value,
  onCommit,
  placeholder,
  inputMode,
}: {
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      inputMode={inputMode}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') {
          setDraft(value);
          e.stopPropagation();
        }
      }}
    />
  );
}

function PassIcon({ pass }: { pass: boolean | null }) {
  if (pass === true) return <span className="pi pi-ok" title="Pass">✓</span>;
  if (pass === false) return <span className="pi pi-bad" title="Fail">✗</span>;
  return <span className="pi pi-unk" title="Unknown / not a hard rule">–</span>;
}

export function DetailDrawer({ listing: l, score, criteria, busy, error, onPatch, onRefresh, onDelete, onClose }: Props) {
  const setKitchen = (k: KitchenVerdict) => onPatch({ kitchen: k, kitchenSource: 'manual' });
  const setFloor = (f: Floor) => onPatch({ floor: f, floorSource: 'manual' });

  // Keyboard 1–5 = kitchen verdict, Esc = close. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = document.activeElement as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.modal')) return;
      if (e.key === 'Escape') return onClose();
      const i = ['1', '2', '3', '4', '5'].indexOf(e.key);
      if (i >= 0) {
        e.preventDefault();
        setKitchen(KITCHEN_OPTIONS[i].value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const areaName = l.area ? criteria.areas[l.area]?.name ?? l.area : null;
  const sq = effectiveSqft(l);

  return (
    <aside className="drawer" aria-label="Listing detail">
      <header className="drawer-head">
        <div>
          <h2>
            {l.benchmark && <span className="star" title="Benchmark">★</span>}
            {l.address} {l.position && <span className="pos">{l.position}</span>}
          </h2>
          <div className="muted small">
            {[areaName, l.postcode, statusLabel(l.status), `as of ${l.asOf}`].filter(Boolean).join(' · ')}
            {!hasLocation(l) && <span className="badge">no location</span>}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close detail" title="Close (Esc)">
          ×
        </button>
      </header>

      <div className="drawer-body">
        <div className="drawer-summary">
          {score && <TierChip tier={score.tier} />}
          <span className="big-score">{score ? Math.round(score.total) : '—'}</span>
          <span className="summary-facts">
            <strong>{money(l.price)}</strong> {l.qualifier && <span className="muted">{l.qualifier}</span>} ·{' '}
            {l.beds ?? '?'} bed · {sq ?? '?'} sq ft · {floorLong(l.floor)} floor
          </span>
          {l.url && (
            <a className="btn ghost small" href={l.url} target="_blank" rel="noreferrer noopener">
              Original listing ↗
            </a>
          )}
        </div>

        {l.imageUrls.length > 0 && (
          <div className="photo-strip">
            {l.imageUrls.slice(0, 12).map((u, i) => (
              <a key={u + i} href={u} target="_blank" rel="noreferrer noopener">
                <img src={u} alt={`Photo ${i + 1}`} loading="lazy" referrerPolicy="no-referrer" />
              </a>
            ))}
          </div>
        )}

        <section>
          <h3>Floorplan</h3>
          {l.floorplanUrls.length > 0 ? (
            l.floorplanUrls.map((u, i) => (
              <a key={u + i} href={u} target="_blank" rel="noreferrer noopener" className="floorplan">
                <img src={u} alt={`Floorplan ${i + 1}`} referrerPolicy="no-referrer" />
              </a>
            ))
          ) : (
            <p className="muted">No floorplan captured. Check the original listing before trusting the kitchen verdict.</p>
          )}
        </section>

        <section>
          <h3>
            Kitchen verdict <span className="muted small">keys 1–5{l.kitchenSource ? ` · source: ${l.kitchenSource}` : ''}</span>
          </h3>
          <div className="seg">
            {KITCHEN_OPTIONS.map((k, i) => (
              <button
                key={k.value}
                className={`seg-btn ${l.kitchen === k.value ? 'on' : ''} ${k.ok === true ? 'ok' : k.ok === false ? 'bad' : ''}`}
                onClick={() => setKitchen(k.value)}
                aria-pressed={l.kitchen === k.value}
              >
                <kbd>{i + 1}</kbd> {k.label} {k.ok === true ? '✓' : k.ok === false ? '✗' : ''}
              </button>
            ))}
          </div>
          <h3>
            Floor <span className="muted small">{l.floorSource ? `source: ${l.floorSource}` : ''}</span>
          </h3>
          <div className="seg">
            {FLOOR_OPTIONS.map((f) => (
              <button
                key={f.value}
                className={`seg-btn ${l.floor === f.value ? 'on' : ''}`}
                onClick={() => setFloor(f.value)}
                aria-pressed={l.floor === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="edit-grid">
          <label className="field">
            <span>Floorplan sq ft</span>
            <CommitInput
              inputMode="numeric"
              value={l.sqftFloorplan?.toString() ?? ''}
              placeholder={l.sqftListing ? `listing says ${l.sqftListing}` : ''}
              onCommit={(v) => onPatch({ sqftFloorplan: parseNum(v) })}
            />
            {sqftMismatch(l) && <small className="bad-text">More than 5% off the listing's {l.sqftListing}</small>}
          </label>
          <label className="field">
            <span>Bedroom 2 width (m)</span>
            <CommitInput
              inputMode="decimal"
              value={l.bed2WidthM?.toString() ?? ''}
              placeholder={l.bed2Dims ?? ''}
              onCommit={(v) => onPatch({ bed2WidthM: parseNum(v) })}
            />
            {l.bed2WidthM != null && l.bed2WidthM < criteria.bed2MinWidthM && (
              <small className="bad-text">Under {criteria.bed2MinWidthM} m: single / study</small>
            )}
          </label>
          <label className="field">
            <span>Kitchen dims</span>
            <CommitInput
              value={l.kitchenDims ?? ''}
              placeholder="3.9 x 4.9 m"
              onCommit={(v) => onPatch({ kitchenDims: v.trim() || null })}
            />
          </label>
          <div className="field">
            <span>Tenement</span>
            <div className="seg compact">
              {([
                [true, 'Yes'],
                [false, 'No'],
                [null, '?'],
              ] as const).map(([v, label]) => (
                <button
                  key={label}
                  className={`seg-btn ${l.tenement === v ? 'on' : ''}`}
                  onClick={() => onPatch({ tenement: v })}
                  aria-pressed={l.tenement === v}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Status</span>
            <select value={l.status} onChange={(e) => onPatch({ status: e.target.value as Listing['status'] })}>
              {(['for-sale', 'under-offer', 'sold-stc', 'removed', 'unknown'] as const).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="check field-check">
            <input type="checkbox" checked={l.benchmark} onChange={(e) => onPatch({ benchmark: e.target.checked })} />
            Benchmark
          </label>
          <label className="field span-2">
            <span>Notes</span>
            <NotesInput value={l.notes} onCommit={(notes) => onPatch({ notes })} />
          </label>
        </section>

        {score && (
          <section>
            <h3>Score breakdown</h3>
            {score.hardFails.length > 0 && (
              <ul className="msgs fails">
                {score.hardFails.map((m, i) => (
                  <li key={i}>
                    <span className="pi pi-bad">✗</span> {m}
                  </li>
                ))}
              </ul>
            )}
            {score.warnings.length > 0 && (
              <ul className="msgs warns">
                {score.warnings.map((m, i) => (
                  <li key={i}>
                    <span className="pi pi-warn">!</span> {m}
                  </li>
                ))}
              </ul>
            )}
            {score.lines.length > 0 ? (
              <table className="breakdown">
                <tbody>
                  {score.lines.map((ln, i) => (
                    <tr key={i}>
                      <td>
                        <PassIcon pass={ln.pass} />
                      </td>
                      <td className="rule">{ln.rule}</td>
                      <td className="num">
                        {Math.round(ln.points * 10) / 10}
                        <span className="muted">/{ln.max}</span>
                      </td>
                      <td className="muted why">{ln.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted">No score lines.</p>
            )}
          </section>
        )}

        {error && <p className="error">{error}</p>}
        <footer className="drawer-actions">
          <button className="btn" onClick={onRefresh} disabled={!l.url || busy}>
            {busy ? 'Refreshing…' : 'Refresh from site'}
          </button>
          <button className="btn danger" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        </footer>
      </div>
    </aside>
  );
}

function NotesInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <textarea
      rows={4}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
    />
  );
}
