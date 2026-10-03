import { describe, it, expect } from 'vitest';
import { mergeRefresh, markRemoved } from './refresh';
import type { Listing } from '../types';

function listing(over: Partial<Listing> = {}): Listing {
  return {
    id: 'rm-1', source: 'rightmove', url: 'https://www.rightmove.co.uk/properties/1',
    address: 'Test St', position: '1/2', area: 'dennistoun', postcode: 'G31',
    lat: 55.86, lng: -4.21, price: 200000, qualifier: 'Offers Over', beds: 2,
    floor: 1, floorSource: 'floorplan', kitchen: 'window', kitchenSource: 'manual',
    kitchenDims: '3 x 4 m', sqftListing: 850, sqftFloorplan: 820, bed2Dims: null,
    bed2WidthM: 2.9, tenement: true, epc: 'C', councilTaxBand: 'C', tenure: null,
    extras: { bay: true }, excludedReason: null, imageUrls: ['a.jpg'], floorplanUrls: ['f.png'],
    status: 'for-sale', benchmark: true, notes: 'my note', asOf: '2026-09-01',
    ...over,
  };
}

describe('mergeRefresh', () => {
  it('keeps trusted verdicts, measurements, notes and benchmark', () => {
    const fresh = listing({
      floor: null, floorSource: null, kitchen: 'unsure', kitchenSource: 'text',
      sqftFloorplan: null, kitchenDims: null, benchmark: false, notes: '', asOf: '2026-10-06',
    });
    const { listing: m, changes } = mergeRefresh(listing(), fresh);
    expect(m.floor).toBe(1);
    expect(m.kitchen).toBe('window');
    expect(m.kitchenSource).toBe('manual');
    expect(m.sqftFloorplan).toBe(820);
    expect(m.kitchenDims).toBe('3 x 4 m');
    expect(m.benchmark).toBe(true);
    expect(m.notes).toBe('my note');
    expect(m.asOf).toBe('2026-10-06');
    expect(changes).toEqual([]);
  });

  it('takes price and status from the site and logs them in notes', () => {
    const fresh = listing({ price: 190000, status: 'under-offer', asOf: '2026-10-06' });
    const { listing: m, changes } = mergeRefresh(listing(), fresh);
    expect(m.price).toBe(190000);
    expect(m.status).toBe('under-offer');
    expect(changes).toEqual(['Price reduced: £200,000 → £190,000', 'Status: for-sale → under-offer']);
    expect(m.notes).toBe('my note\n[2026-10-06] Price reduced: £200,000 → £190,000; Status: for-sale → under-offer');
  });

  it('replaces untrusted text-sourced verdicts with new ones and fills unknowns', () => {
    const old = listing({ floor: null, floorSource: null, kitchen: 'unsure', kitchenSource: 'text', epc: null });
    const fresh = listing({ floor: 0, floorSource: 'text', kitchen: 'window', kitchenSource: 'text', epc: 'D' });
    const { listing: m } = mergeRefresh(old, fresh);
    expect(m.floor).toBe(0);
    expect(m.kitchen).toBe('window');
    expect(m.epc).toBe('D');
  });

  it('does not blank live fields the new page omits', () => {
    const fresh = listing({ price: null, imageUrls: [], lat: null });
    const { listing: m, changes } = mergeRefresh(listing(), fresh);
    expect(m.price).toBe(200000);
    expect(m.imageUrls).toEqual(['a.jpg']);
    expect(m.lat).toBe(55.86);
    expect(changes).toEqual([]);
  });
});

describe('markRemoved', () => {
  it('marks once and notes it', () => {
    const r = markRemoved(listing(), '2026-10-06');
    expect(r.listing.status).toBe('removed');
    expect(r.changes).toHaveLength(1);
    expect(markRemoved(r.listing, '2026-10-13').changes).toHaveLength(0);
  });
});
