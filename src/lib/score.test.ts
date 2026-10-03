import { describe, it, expect } from 'vitest';
import type { Criteria, Listing } from '../types';
import criteriaJson from '../../data/criteria.json';
import { scoreListing } from './score';

const C = criteriaJson as Criteria;
const crit = (over: Partial<Criteria> = {}): Criteria => ({ ...C, ...over });

/** A listing that is at full points on every rule (price at 15%+ headroom). */
function ideal(over: Partial<Listing> = {}): Listing {
  return {
    id: 'test-1',
    source: 'manual',
    url: null,
    address: 'Test Street, Glasgow',
    position: '1/2',
    area: 'southside',
    postcode: 'G42',
    lat: null,
    lng: null,
    price: 190000,
    qualifier: 'Offers Over',
    beds: 2,
    floor: 1,
    floorSource: 'manual',
    kitchen: 'window',
    kitchenSource: 'manual',
    kitchenDims: null,
    sqftListing: 900,
    sqftFloorplan: null,
    bed2Dims: null,
    bed2WidthM: 3,
    tenement: true,
    epc: null,
    councilTaxBand: null,
    tenure: null,
    extras: {},
    excludedReason: null,
    imageUrls: [],
    floorplanUrls: [],
    status: 'for-sale',
    benchmark: false,
    notes: '',
    asOf: '2026-09-29',
    ...over,
  };
}

const lineOf = (s: ReturnType<typeof scoreListing>, rule: string) => s.lines.find((l) => l.rule === rule)!;

describe('ideal listing', () => {
  it('scores 100 and Perfect', () => {
    const s = scoreListing(ideal(), C);
    expect(s.hardFails).toEqual([]);
    expect(s.total).toBe(100);
    expect(s.tier).toBe('Perfect');
    expect(s.lines.filter((l) => !l.rule.startsWith('Bonus'))).toHaveLength(7);
    for (const l of s.lines) expect(l.why.length).toBeGreaterThan(0);
  });
});

describe('hard rules', () => {
  it('price over max', () => {
    const s = scoreListing(ideal({ price: 230000 }), C);
    expect(s.tier).toBe('Fails');
    expect(s.hardFails.join()).toMatch(/over the £225,000 limit/);
  });
  it('too few beds', () => {
    expect(scoreListing(ideal({ beds: 1 }), C).hardFails.join()).toMatch(/1 bedroom/);
  });
  it('third floor', () => {
    expect(scoreListing(ideal({ floor: 3, position: '3/1' }), C).hardFails.join()).toMatch(/Third floor/);
  });
  it('windowless kitchen', () => {
    expect(scoreListing(ideal({ kitchen: 'windowless' }), C).hardFails.join()).toMatch(/windowless/);
  });
  it('size under the hard minimum', () => {
    const s = scoreListing(ideal({ sqftListing: 700 }), C);
    expect(s.hardFails.join()).toMatch(/700 sq ft is below the 725/);
  });
  it('excluded', () => {
    expect(scoreListing(ideal({ excludedReason: 'auction' }), C).hardFails).toEqual(['Excluded: auction']);
  });
  it('tenement required', () => {
    expect(scoreListing(ideal({ tenement: false }), C).hardFails).toEqual([]);
    expect(scoreListing(ideal({ tenement: false }), crit({ requireTenement: true })).hardFails.join()).toMatch(/tenement/);
  });
  it('unknowns are warnings, not fails', () => {
    const s = scoreListing(
      ideal({ floor: null, kitchen: null, kitchenSource: null, tenement: null, sqftListing: null, bed2WidthM: null, price: null, beds: null, area: null }),
      C,
    );
    expect(s.hardFails).toEqual([]);
    expect(s.warnings).toContain('floor unknown — check floorplan');
    expect(s.warnings.join()).toMatch(/kitchen unknown/);
    expect(s.warnings.join()).toMatch(/size unknown/);
    expect(s.warnings.join()).toMatch(/price unknown/);
  });
  it('uses floorplan size over listing size, and warns on a >5% gap', () => {
    const s = scoreListing(ideal({ sqftListing: 900, sqftFloorplan: 700 }), C);
    expect(s.hardFails.join()).toMatch(/700 sq ft/);
    expect(s.warnings.join()).toMatch(/differs from listing/);
    expect(scoreListing(ideal({ sqftListing: 900, sqftFloorplan: 880 }), C).warnings.join()).not.toMatch(/differs/);
  });
});

describe('second-floor exception', () => {
  it('passes when everything else is strong and kitchen is window/open-dining', () => {
    const s = scoreListing(ideal({ floor: 2, position: '2/1' }), C);
    expect(s.hardFails).toEqual([]);
    expect(s.warnings).toContain('2nd-floor exception');
    expect(lineOf(s, 'Floor').pass).toBe(true);
  });
  it('fails when the rest of the score is under 85%', () => {
    const s = scoreListing(ideal({ floor: 2, tenement: null, bed2WidthM: null, area: null }), C);
    expect(s.tier).toBe('Fails');
    expect(s.hardFails.join()).toMatch(/Second floor.*< 85%/);
  });
  it('fails with an open-living kitchen', () => {
    expect(scoreListing(ideal({ floor: 2, kitchen: 'open-living' }), C).hardFails.join()).toMatch(/kitchen is not window/);
  });
  it('fails when the exception is disabled', () => {
    expect(scoreListing(ideal({ floor: 2 }), crit({ allowSecondFloorException: false })).tier).toBe('Fails');
  });
  it('fails when another hard rule fails', () => {
    const s = scoreListing(ideal({ floor: 2, beds: 1 }), C);
    expect(s.hardFails).toHaveLength(2);
  });
});

describe('windowless exception', () => {
  it('off → fails even if everything else is perfect', () => {
    expect(scoreListing(ideal({ kitchen: 'windowless' }), crit({ allowWindowlessException: false })).tier).toBe('Fails');
  });
  it('on + everything else full → passes with a warning', () => {
    const s = scoreListing(ideal({ kitchen: 'windowless' }), crit({ allowWindowlessException: true }));
    expect(s.hardFails).toEqual([]);
    expect(s.warnings.join()).toMatch(/windowless-kitchen exception/);
    expect(s.total).toBe(75);
    expect(s.tier).toBe('Strong');
  });
  it('on + something else below full → still fails', () => {
    const s = scoreListing(ideal({ kitchen: 'windowless', bed2WidthM: 2.2 }), crit({ allowWindowlessException: true }));
    expect(s.tier).toBe('Fails');
  });
});

describe('points', () => {
  it('kitchen levels', () => {
    expect(lineOf(scoreListing(ideal({ kitchen: 'open-dining' }), C), 'Kitchen').points).toBe(25);
    expect(lineOf(scoreListing(ideal({ kitchen: 'open-living' }), C), 'Kitchen').points).toBe(20);
    expect(lineOf(scoreListing(ideal({ kitchen: 'unsure' }), C), 'Kitchen').points).toBe(10);
    expect(lineOf(scoreListing(ideal({ kitchen: null }), C), 'Kitchen').points).toBe(10);
  });
  it('size curve', () => {
    const pts = (sq: number) => lineOf(scoreListing(ideal({ sqftListing: sq }), C), 'Size').points;
    expect(pts(850)).toBe(15);
    expect(pts(700)).toBeCloseTo(4.5, 2);
    expect(pts(775)).toBeCloseTo(15 * 0.65, 2);
    expect(pts(600)).toBeLessThan(3.01);
  });
  it('area ranks', () => {
    const pts = (area: string | null) => lineOf(scoreListing(ideal({ area }), C), 'Area').points;
    expect(pts('southside')).toBe(10);
    expect(pts('kelvindale')).toBe(4);
    expect(pts('partick')).toBe(7);
    expect(pts(null)).toBe(3);
  });
  it('price headroom', () => {
    const pts = (price: number) => lineOf(scoreListing(ideal({ price }), C), 'Price').points;
    expect(pts(225000)).toBe(0);
    expect(pts(191250)).toBe(10);
    expect(pts(210000)).toBeCloseTo(4.44, 2);
  });
  it('bonuses and the 100 cap', () => {
    const s = scoreListing(
      ideal({ extras: { walkInShower: true, garden: true, bay: true }, epc: 'C', councilTaxBand: 'B' }),
      C,
    );
    expect(s.lines.filter((l) => l.rule.startsWith('Bonus'))).toHaveLength(5);
    expect(s.total).toBe(100);
    const t = scoreListing(ideal({ price: 225000, extras: { walkInShower: true }, epc: 'D', councilTaxBand: 'D' }), C);
    expect(t.total).toBe(93);
  });
});

describe('tiers', () => {
  it('Perfect needs total ≥ 85 and a floorplan/manual window or open-dining kitchen', () => {
    expect(scoreListing(ideal(), C).tier).toBe('Perfect');
    expect(scoreListing(ideal({ kitchenSource: 'text' }), C).tier).toBe('Strong');
    expect(scoreListing(ideal({ kitchen: 'open-dining', kitchenSource: 'floorplan' }), C).tier).toBe('Perfect');
    expect(scoreListing(ideal({ kitchen: 'open-living' }), C).tier).toBe('Strong');
  });
  it('boundary at 85', () => {
    // price 225000 → 90; tenement null → -7.5 → 82.5 → 83 (Strong)
    expect(scoreListing(ideal({ price: 225000, tenement: null }), C).total).toBe(83);
    expect(scoreListing(ideal({ price: 225000, tenement: null }), C).tier).toBe('Strong');
    // price 225000 (90) - tenement unknown (-7.5) + walk-in shower 3 = 85.5 → 86 → Perfect
    expect(scoreListing(ideal({ price: 225000, tenement: null, extras: { walkInShower: true } }), C).total).toBe(86);
    expect(scoreListing(ideal({ price: 225000, tenement: null, extras: { walkInShower: true } }), C).tier).toBe('Perfect');
  });
  it('a known non-tenement caps the tier at Strong', () => {
    const s = scoreListing(ideal({ tenement: false }), C);
    expect(s.total).toBeGreaterThanOrEqual(85);
    expect(s.tier).toBe('Strong');
  });
  it('a known-narrow bedroom 2 caps the tier at Strong even at 85+', () => {
    const s = scoreListing(ideal({ price: 225000, bed2WidthM: 2.2, extras: { walkInShower: true } }), C);
    expect(s.total).toBe(86);
    expect(s.tier).toBe('Strong');
    expect(s.warnings.some((w) => w.includes('bedroom 2'))).toBe(true);
  });
  it('boundary at 70', () => {
    // 100 - tenement(15) - price(10) - area partial(3) → 72 Strong
    const a = scoreListing(ideal({ tenement: false, price: 225000, area: 'partick' }), C);
    expect(a.total).toBe(72);
    expect(a.tier).toBe('Strong');
    // 100 - tenement 15 - price 10 - bed2 7 = 68 → Possible
    const b = scoreListing(ideal({ tenement: false, price: 225000, bed2WidthM: 2 }), C);
    expect(b.total).toBe(68);
    expect(b.tier).toBe('Possible');
  });
});

describe('known flats (research/criteria.md)', () => {
  it('Laurel St, 603 sq ft → Fails on size', () => {
    const s = scoreListing(
      ideal({ id: 'rm-92094774', address: 'Laurel Street, Partick', area: 'partick', postcode: 'G11', sqftListing: 603, kitchenSource: 'text' }),
      C,
    );
    expect(s.tier).toBe('Fails');
    expect(s.hardFails).toHaveLength(1);
    expect(s.hardFails[0]).toMatch(/603 sq ft is below/);
  });

  it('Albert Ave, 2nd floor with an excellent dining kitchen → passes via exception', () => {
    const s = scoreListing(
      ideal({
        id: 'rm-93311106',
        address: 'Albert Avenue, Queens Park',
        position: '2/1',
        floor: 2,
        kitchen: 'window',
        kitchenSource: 'manual',
        price: 205000,
        sqftListing: 900,
        bed2WidthM: 2.9,
      }),
      C,
    );
    expect(s.hardFails).toEqual([]);
    expect(s.warnings).toContain('2nd-floor exception');
    expect(['Strong', 'Perfect']).toContain(s.tier);
  });

  it('Albert Ave with weaker supporting facts → fails', () => {
    const s = scoreListing(
      ideal({ id: 'rm-93311106', floor: 2, position: '2/1', price: 222000, tenement: null, bed2WidthM: null }),
      C,
    );
    expect(s.tier).toBe('Fails');
  });

  it('Garthland Dr, windowless kitchen → Fails', () => {
    const s = scoreListing(
      ideal({ id: 'rm-92295759', address: 'Garthland Drive, Dennistoun', area: 'dennistoun', postcode: 'G31', floor: 0, position: '0/1', kitchen: 'windowless', kitchenSource: 'manual', extras: { bay: true } }),
      C,
    );
    expect(s.tier).toBe('Fails');
    expect(s.hardFails.join()).toMatch(/windowless/);
  });

  it('406 Victoria Road benchmark → Perfect or Strong', () => {
    const s = scoreListing(
      ideal({
        id: 'rm-93437829',
        source: 'rightmove',
        address: '406 Victoria Road, Queens Park, Glasgow',
        position: '1/2',
        area: 'southside',
        postcode: 'G42',
        price: 210000,
        floor: 1,
        kitchen: 'window',
        kitchenSource: 'manual',
        kitchenDims: '3.91 x 4.93 m',
        sqftListing: 1087,
        bed2Dims: '4.58 x 2.95 m',
        bed2WidthM: 2.95,
        tenement: true,
        councilTaxBand: 'C',
        extras: { bay: true },
        benchmark: true,
      }),
      C,
    );
    expect(s.hardFails).toEqual([]);
    expect(s.total).toBe(96); // 94.44 + bay 1 + CT band C 1
    expect(s.tier).toBe('Perfect');
  });
});
