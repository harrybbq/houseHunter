import type { Criteria, KitchenVerdict, Listing, Score, Tier } from '../types';
import { KITCHEN_OPTIONS, TIERS, effectiveSqft, isInactive } from './format';

export type FloorKey = '0' | '1' | '2' | '3' | 'unknown';
export type KitchenKey = KitchenVerdict | 'unknown';

export interface FilterState {
  maxPrice: number | null;
  minBeds: number | null;
  minSqft: number | null;
  floors: FloorKey[];
  kitchens: KitchenKey[];
  areas: string[]; // criteria.areas keys, plus 'unknown'
  tiers: Tier[]; // Perfect / Strong / Possible
  showFailed: boolean;
  hideInactive: boolean;
  tenementOnly: boolean;
  search: string;
}

const FLOOR_KEYS: { key: FloorKey; label: string }[] = [
  { key: '0', label: 'Ground' },
  { key: '1', label: 'First' },
  { key: '2', label: 'Second' },
  { key: '3', label: '3rd +' },
  { key: 'unknown', label: 'Unknown' },
];

export function defaultFilters(c: Criteria): FilterState {
  return {
    maxPrice: c.maxPrice,
    minBeds: c.minBeds,
    minSqft: null,
    floors: FLOOR_KEYS.map((f) => f.key),
    kitchens: [...KITCHEN_OPTIONS.map((k) => k.value), 'unknown'],
    areas: [...Object.keys(c.areas), 'unknown'],
    tiers: ['Perfect', 'Strong', 'Possible'],
    showFailed: false,
    hideInactive: true,
    tenementOnly: false,
    search: '',
  };
}

/** Unknown values pass numeric filters: the data says "don't know", not "no". */
export function applyFilters(
  listings: Listing[],
  scores: Map<string, Score>,
  f: FilterState,
  c: Criteria,
): Listing[] {
  const q = f.search.trim().toLowerCase();
  return listings.filter((l) => {
    const s = scores.get(l.id);
    if (f.maxPrice != null && l.price != null && l.price > f.maxPrice) return false;
    if (f.minBeds != null && l.beds != null && l.beds < f.minBeds) return false;
    const sq = effectiveSqft(l);
    if (f.minSqft != null && sq != null && sq < f.minSqft) return false;
    if (!f.floors.includes(l.floor === null ? 'unknown' : (String(l.floor) as FloorKey))) return false;
    if (!f.kitchens.includes(l.kitchen ?? 'unknown')) return false;
    const areaKey = l.area && c.areas[l.area] ? l.area : 'unknown';
    if (!f.areas.includes(areaKey)) return false;
    if (s) {
      if (s.tier === 'Fails') {
        if (!f.showFailed) return false;
      } else if (!f.tiers.includes(s.tier)) return false;
    }
    if (f.hideInactive && isInactive(l)) return false;
    if (f.tenementOnly && l.tenement !== true) return false;
    if (q) {
      const areaName = l.area ? c.areas[l.area]?.name ?? l.area : '';
      const hay = [l.address, l.position, l.postcode, areaName, l.notes, l.id].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

interface Props {
  criteria: Criteria;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  shown: number;
  total: number;
  onReset: () => void;
}

export function Filters({ criteria, filters: f, onChange, shown, total, onReset }: Props) {
  const set = <K extends keyof FilterState>(k: K, v: FilterState[K]) => onChange({ ...f, [k]: v });
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const areas = Object.entries(criteria.areas).sort((a, b) => a[1].rank - b[1].rank);

  return (
    <div className="filters">
      <div className="filters-count" aria-live="polite">
        <strong>{shown}</strong> of {total} listings
        <button className="link-btn" onClick={onReset}>
          Reset
        </button>
      </div>

      <label className="field">
        <span>Search</span>
        <input
          type="search"
          placeholder="Street, postcode, notes…"
          value={f.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Max price £</span>
          <input
            type="number"
            step={5000}
            min={0}
            value={f.maxPrice ?? ''}
            onChange={(e) => set('maxPrice', num(e.target.value))}
          />
        </label>
      </div>
      <div className="field-row two">
        <label className="field">
          <span>Min beds</span>
          <input type="number" min={0} value={f.minBeds ?? ''} onChange={(e) => set('minBeds', num(e.target.value))} />
        </label>
        <label className="field">
          <span>Min sq ft</span>
          <input
            type="number"
            min={0}
            step={25}
            placeholder={String(criteria.minSqftHard)}
            value={f.minSqft ?? ''}
            onChange={(e) => set('minSqft', num(e.target.value))}
          />
        </label>
      </div>

      <fieldset>
        <legend>Tier</legend>
        {TIERS.filter((t) => t !== 'Fails').map((t) => (
          <label key={t} className="check">
            <input type="checkbox" checked={f.tiers.includes(t)} onChange={() => set('tiers', toggle(f.tiers, t))} />
            <span className={`dot tier-dot-${t}`} aria-hidden /> {t}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={f.showFailed} onChange={(e) => set('showFailed', e.target.checked)} />
          <span className="dot tier-dot-Fails" aria-hidden /> Show failed
        </label>
      </fieldset>

      <fieldset>
        <legend>Floor</legend>
        <div className="check-grid">
          {FLOOR_KEYS.map((o) => (
            <label key={o.key} className="check">
              <input
                type="checkbox"
                checked={f.floors.includes(o.key)}
                onChange={() => set('floors', toggle(f.floors, o.key))}
              />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Kitchen</legend>
        {[...KITCHEN_OPTIONS.map((k) => ({ key: k.value as KitchenKey, label: k.label })), { key: 'unknown' as KitchenKey, label: 'Not assessed' }].map(
          (o) => (
            <label key={o.key} className="check">
              <input
                type="checkbox"
                checked={f.kitchens.includes(o.key)}
                onChange={() => set('kitchens', toggle(f.kitchens, o.key))}
              />
              {o.label}
            </label>
          ),
        )}
      </fieldset>

      <fieldset>
        <legend>Area</legend>
        {areas.map(([key, a]) => (
          <label key={key} className="check" title={a.notes}>
            <input type="checkbox" checked={f.areas.includes(key)} onChange={() => set('areas', toggle(f.areas, key))} />
            <span>
              {a.name} <span className="muted small">{a.outcodes.join(' ')}</span>
            </span>
          </label>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={f.areas.includes('unknown')}
            onChange={() => set('areas', toggle(f.areas, 'unknown'))}
          />
          Other / unknown
        </label>
      </fieldset>

      <fieldset>
        <legend>Other</legend>
        <label className="check">
          <input type="checkbox" checked={f.hideInactive} onChange={(e) => set('hideInactive', e.target.checked)} />
          Hide sold / under offer
        </label>
        <label className="check">
          <input type="checkbox" checked={f.tenementOnly} onChange={(e) => set('tenementOnly', e.target.checked)} />
          Tenement only
        </label>
      </fieldset>
    </div>
  );
}
