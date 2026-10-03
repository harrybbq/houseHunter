import type { Criteria, Floor, KitchenVerdict, Listing, Score, Tier } from '../types';
import { scoreListing } from '../lib/score';

export const TIERS: Tier[] = ['Perfect', 'Strong', 'Possible', 'Fails'];

export const KITCHEN_OPTIONS: { value: KitchenVerdict; label: string; short: string; ok: boolean | null }[] = [
  { value: 'window', label: 'Window', short: 'Window', ok: true },
  { value: 'open-living', label: 'Open to living', short: 'Open/living', ok: true },
  { value: 'open-dining', label: 'Open to dining', short: 'Open/dining', ok: true },
  { value: 'windowless', label: 'Windowless', short: 'Windowless', ok: false },
  { value: 'unsure', label: 'Unsure', short: 'Unsure', ok: null },
];

export const FLOOR_OPTIONS: { value: Exclude<Floor, null>; label: string }[] = [
  { value: 0, label: 'G' },
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3+' },
];

export function floorLabel(f: Floor): string {
  if (f === null) return '?';
  return FLOOR_OPTIONS.find((o) => o.value === f)?.label ?? String(f);
}

export function floorLong(f: Floor): string {
  return f === null ? 'Unknown' : ['Ground', 'First', 'Second', 'Third +'][f];
}

export function kitchenInfo(k: KitchenVerdict | null) {
  return KITCHEN_OPTIONS.find((o) => o.value === k) ?? null;
}

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
export const money = (n: number | null) => (n == null ? '—' : gbp.format(n));

export function qualifierShort(q: string | null): string {
  if (!q) return '';
  const s = q.toLowerCase();
  if (s.startsWith('offers over')) return 'O/O';
  if (s.startsWith('offers in the region')) return 'OIRO';
  if (s.startsWith('fixed')) return 'Fixed';
  if (s.startsWith('guide')) return 'Guide';
  return q;
}

export function effectiveSqft(l: Listing): number | null {
  return l.sqftFloorplan ?? l.sqftListing;
}

/** True when both sq ft figures exist and differ by more than 5%. */
export function sqftMismatch(l: Listing): boolean {
  if (l.sqftFloorplan == null || l.sqftListing == null) return false;
  const base = Math.max(l.sqftFloorplan, l.sqftListing);
  return Math.abs(l.sqftFloorplan - l.sqftListing) / base > 0.05;
}

export const hasLocation = (l: Listing) => l.lat != null && l.lng != null;

export const isInactive = (l: Listing) =>
  l.status === 'under-offer' || l.status === 'sold-stc' || l.status === 'removed';

export function statusLabel(s: Listing['status']): string {
  return (
    { 'for-sale': 'For sale', 'under-offer': 'Under offer', 'sold-stc': 'Sold STC', removed: 'Removed', unknown: 'Unknown' } as const
  )[s];
}

const FALLBACK: Score = { total: 0, tier: 'Possible', hardFails: [], warnings: ['Scoring unavailable'], lines: [] };

/** scoreListing is owned elsewhere and may be mid-edit; never let it crash the UI. */
export function safeScore(l: Listing, c: Criteria): Score {
  try {
    const s = scoreListing(l, c);
    return s && typeof s.total === 'number' ? s : FALLBACK;
  } catch (e) {
    return { ...FALLBACK, warnings: [`Scoring error: ${(e as Error).message}`] };
  }
}

export function parseNum(s: string): number | null {
  const t = s.replace(/[,£\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
