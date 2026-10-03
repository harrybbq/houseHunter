// Merge a freshly parsed listing into the stored one.
// Live market fields (price, status, photos…) take the new value; everything
// the user or research established (verdicts, measurements, notes) is kept.
import type { Listing, VerdictSource } from '../types';

const LIVE_FIELDS = [
  'price',
  'qualifier',
  'status',
  'imageUrls',
  'floorplanUrls',
  'epc',
  'councilTaxBand',
  'tenure',
  'lat',
  'lng',
] as const;

const TRUSTED: VerdictSource[] = ['manual', 'floorplan'];

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (Array.isArray(v) && v.length === 0);
}

function fmtPrice(p: number | null): string {
  return p === null ? '?' : `£${p.toLocaleString('en-GB')}`;
}

export interface RefreshResult {
  listing: Listing;
  changes: string[];
}

export function mergeRefresh(old: Listing, fresh: Listing, today = fresh.asOf): RefreshResult {
  const merged: Listing = { ...old };
  const m = merged as unknown as Record<string, unknown>;
  const f = fresh as unknown as Record<string, unknown>;
  const changes: string[] = [];

  // Fill anything we didn't know yet.
  for (const k of Object.keys(f)) {
    if (isEmpty(m[k]) && !isEmpty(f[k])) m[k] = f[k];
  }

  // Live fields: the site is the authority when it gives a value.
  for (const k of LIVE_FIELDS) {
    if (!isEmpty(f[k])) m[k] = f[k];
  }

  // Verdicts: keep a trusted (manual/floorplan) value; otherwise take a new non-null one.
  if (!TRUSTED.includes(old.kitchenSource) && fresh.kitchen !== null) {
    merged.kitchen = fresh.kitchen;
    merged.kitchenSource = fresh.kitchenSource;
  }
  if (!TRUSTED.includes(old.floorSource) && fresh.floor !== null) {
    merged.floor = fresh.floor;
    merged.floorSource = fresh.floorSource;
  }

  if (old.price !== merged.price) {
    const dir = old.price !== null && merged.price !== null && merged.price < old.price ? 'reduced' : 'changed';
    changes.push(`Price ${dir}: ${fmtPrice(old.price)} → ${fmtPrice(merged.price)}`);
  }
  if (old.qualifier !== merged.qualifier && old.qualifier && merged.qualifier) {
    changes.push(`Now "${merged.qualifier}" (was "${old.qualifier}")`);
  }
  if (old.status !== merged.status) {
    changes.push(`Status: ${old.status} → ${merged.status}`);
  }

  // Never touch the user's own fields.
  merged.id = old.id;
  merged.benchmark = old.benchmark;
  merged.notes = old.notes;
  merged.asOf = today;

  if (changes.length) {
    merged.notes = `${old.notes ? old.notes.trimEnd() + '\n' : ''}[${today}] ${changes.join('; ')}`;
  }
  return { listing: merged, changes };
}

/** A listing whose page has gone (404/410) — mark removed, note it once. */
export function markRemoved(old: Listing, today: string): RefreshResult {
  if (old.status === 'removed') return { listing: { ...old, asOf: today }, changes: [] };
  const change = `Status: ${old.status} → removed (listing page gone)`;
  return {
    listing: {
      ...old,
      status: 'removed',
      asOf: today,
      notes: `${old.notes ? old.notes.trimEnd() + '\n' : ''}[${today}] ${change}`,
    },
    changes: [change],
  };
}
