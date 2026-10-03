import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseRightmovePropertyPage, parseRightmoveSearchPage, extractRightmoveProperty } from './rightmove';
import { parseListingPage, hashString } from './parse';

const ROOT = process.cwd();
const REAL_FIXTURE = path.join(ROOT, 'research', 'fixtures', 'rightmove-property-93437829.html');
const SEARCH_FIXTURE = path.join(ROOT, 'src', 'lib', '__fixtures__', 'rightmove-search.html');

/** Flatten a plain object into Rightmove's devalue format (objects/arrays hold indices). */
function flatten(root: unknown): string {
  const out: unknown[] = [];
  const put = (v: unknown): number => {
    if (v === undefined) return -1;
    const i = out.length;
    out.push(null);
    if (Array.isArray(v)) out[i] = v.map(put);
    else if (v && typeof v === 'object') {
      const o: Record<string, number> = {};
      for (const [k, x] of Object.entries(v)) o[k] = put(x);
      out[i] = o;
    } else out[i] = v;
    return i;
  };
  put(root);
  return JSON.stringify(out);
}

function syntheticPage(propertyData: unknown): string {
  const model = { data: flatten({ propertyData, metadata: { x: 1 } }), encoding: 'on' };
  return `<html><script>\n    window.__PAGE_MODEL = ${JSON.stringify(model)};\n    window.adInfo = [];</script></html>`;
}

const SYNTH = {
  id: '12345678',
  status: { published: true, archived: false },
  text: {
    description:
      'A beautifully presented <b>traditional</b> red sandstone tenement flat.<br />Dining kitchen with window to the rear.<br />' +
      'Bedroom 2 4.20m x 2.20m.<br />Bathroom with walk-in shower.<br />EPC Rating: C',
    auctionFeesDisclaimer: null,
  },
  prices: { primaryPrice: '£189,995', displayPriceQualifier: 'Offers Over' },
  address: { displayAddress: 'Flat 1/2, 12 Alexandra Parade, Dennistoun', outcode: 'G31', incode: '2AB' },
  keyFeatures: ['First floor', 'Two double bedrooms'],
  location: { latitude: 55.86, longitude: -4.21 },
  bedrooms: 2,
  sizings: [
    { unit: 'sqft', displayUnit: 'sq. ft.', minimumSize: 880, maximumSize: 880 },
    { unit: 'sqm', displayUnit: 'sq. m.', minimumSize: 82, maximumSize: 82 },
  ],
  floorplans: [{ url: 'https://example.invalid/fp.jpg', caption: '1/2, 12 Alexandra Parade' }],
  images: [{ url: 'https://example.invalid/1.jpg' }, { url: 'https://example.invalid/2.jpg' }],
  listingHistory: { listingUpdateReason: 'Reduced on 01/09/2026' },
  livingCosts: { councilTaxBand: 'B' },
  tenure: { tenureType: 'FREEHOLD' },
  epcGraphs: [{ url: 'https://example.invalid/epc.png', caption: 'EPC Rating Graph' }],
  tags: [],
};

describe('parseRightmovePropertyPage (synthetic)', () => {
  it('reads structured fields', () => {
    const l = parseRightmovePropertyPage(syntheticPage(SYNTH), 'https://www.rightmove.co.uk/properties/12345678');
    expect(l).toMatchObject({
      id: 'rm-12345678',
      source: 'rightmove',
      price: 189995,
      qualifier: 'Offers Over',
      address: 'Flat 1/2, 12 Alexandra Parade, Dennistoun',
      postcode: 'G31 2AB',
      lat: 55.86,
      lng: -4.21,
      beds: 2,
      sqftListing: 880,
      councilTaxBand: 'B',
      tenure: 'Freehold',
      epc: 'C',
      status: 'for-sale',
    });
    expect(l.floorplanUrls).toEqual(['https://example.invalid/fp.jpg']);
    expect(l.imageUrls).toHaveLength(2);
  });

  it('never throws on missing fields', () => {
    expect(() => parseRightmovePropertyPage(syntheticPage({}), 'https://www.rightmove.co.uk/properties/1')).not.toThrow();
    expect(parseRightmovePropertyPage('<html></html>', 'https://www.rightmove.co.uk/properties/9')).toMatchObject({ id: 'rm-9' });
    const partial = parseRightmovePropertyPage(syntheticPage({ id: 5, prices: null, sizings: 'x' }), 'u');
    expect(partial.id).toBe('rm-5');
    expect(partial.price).toBeNull();
  });

  it('detects status flags and auction', () => {
    const sstc = extractRightmoveProperty(syntheticPage({ ...SYNTH, tags: ['SOLD_STC'] }), 'u').listing.status;
    expect(sstc).toBe('sold-stc');
    const uo = extractRightmoveProperty(syntheticPage({ ...SYNTH, tags: ['UNDER_OFFER'] }), 'u').listing.status;
    expect(uo).toBe('under-offer');
    const archived = extractRightmoveProperty(syntheticPage({ ...SYNTH, status: { published: false, archived: true } }), 'u');
    expect(archived.listing.status).toBe('removed');
    const auction = extractRightmoveProperty(
      syntheticPage({ ...SYNTH, text: { ...SYNTH.text, auctionFeesDisclaimer: 'Auction fees apply' } }),
      'u',
    );
    expect(auction.excludedHint).toBe('auction');
  });

  it('parseListingPage fills hints from text', () => {
    const l = parseListingPage(syntheticPage(SYNTH), 'https://www.rightmove.co.uk/properties/12345678');
    expect(l).toMatchObject({
      id: 'rm-12345678',
      floor: 1,
      position: '1/2',
      floorSource: 'text',
      kitchen: 'window',
      kitchenSource: 'text',
      tenement: true,
      bed2WidthM: 2.2,
      bed2Dims: '4.20 x 2.20 m',
      area: 'dennistoun',
      excludedReason: null,
      status: 'for-sale',
      benchmark: false,
      notes: '',
    });
    expect(l.extras).toEqual({ walkInShower: true });
    expect(l.asOf).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe.skipIf(!fs.existsSync(REAL_FIXTURE))('real Rightmove fixture (93437829)', () => {
  const html = fs.existsSync(REAL_FIXTURE) ? fs.readFileSync(REAL_FIXTURE, 'utf8') : '';
  const url = 'https://www.rightmove.co.uk/properties/93437829';

  it('parses the structured fields', () => {
    const l = parseRightmovePropertyPage(html, url);
    expect(l).toMatchObject({
      id: 'rm-93437829',
      price: 210000,
      qualifier: 'Offers Over',
      beds: 2,
      postcode: 'G42 8RW',
      councilTaxBand: 'C',
      tenure: 'Freehold',
      epc: 'D', // only stated in the description text
      status: 'for-sale',
    });
    expect(l.lat).toBeCloseTo(55.836, 3);
    expect(l.lng).toBeCloseTo(-4.2647, 3);
    expect(l.floorplanUrls).toHaveLength(1);
    expect(l.imageUrls!.length).toBeGreaterThanOrEqual(10);
  });

  it('builds a full Listing with text hints', () => {
    const l = parseListingPage(html, url);
    expect(l).toMatchObject({
      id: 'rm-93437829',
      source: 'rightmove',
      area: 'southside',
      tenement: true, // "traditional two-bedroom tenement flat"
      kitchen: 'window', // "dining-sized kitchen"
      kitchenSource: 'text',
      excludedReason: null,
    });
    expect(l.extras.bay).toBe(true); // "bay windowed lounge"
    expect(l.extras.garden).toBeUndefined(); // communal garden only
  });

  it('floor comes from a position code only when the page text has one', () => {
    // The saved page's floorplan caption is just "Floorplan" and the text has no "1/2";
    // the position is only visible inside the floorplan image. Assert on whatever the text says.
    const ex = extractRightmoveProperty(html, url);
    const l = parseListingPage(html, url);
    const hasCode = /\b1\/2\b/.test([ex.listing.address, ...ex.floorplanCaptions, ex.description].join(' '));
    if (hasCode) {
      expect(l.floor).toBe(1);
      expect(l.position).toBe('1/2');
    } else {
      expect(l.floor).toBeNull();
      expect(l.floorSource).toBeNull();
    }
  });
});

describe('parseRightmoveSearchPage', () => {
  it('reads __NEXT_DATA__ results, de-duplicated', () => {
    const html = fs.readFileSync(SEARCH_FIXTURE, 'utf8');
    expect(parseRightmoveSearchPage(html)).toEqual([
      { id: '93437829', url: 'https://www.rightmove.co.uk/properties/93437829' },
      { id: '93216738', url: 'https://www.rightmove.co.uk/properties/93216738' },
      { id: '93472476', url: 'https://www.rightmove.co.uk/properties/93472476' },
    ]);
  });

  it('falls back to scanning /properties/<id> links', () => {
    const html = '<a href="/properties/111#x">a</a><a href="https://www.rightmove.co.uk/properties/222">b</a><a href="/properties/111">c</a>';
    expect(parseRightmoveSearchPage(html).map((p) => p.id)).toEqual(['111', '222']);
  });

  it('falls back when __NEXT_DATA__ is broken', () => {
    const html = '<script id="__NEXT_DATA__" type="application/json">{broken</script><a href="/properties/333">x</a>';
    expect(parseRightmoveSearchPage(html)).toEqual([{ id: '333', url: 'https://www.rightmove.co.uk/properties/333' }]);
  });
});

describe('parseListingPage (other sites)', () => {
  it('uses og tags and JSON-LD', () => {
    const html = `<html><head>
      <meta property="og:title" content="2 bed flat for sale, Craigpark Drive, Glasgow G31" />
      <meta property="og:description" content="Offers over £199,000. Main door flat in a red sandstone tenement with breakfasting kitchen." />
      <meta property="og:image" content="https://example.invalid/a.jpg" />
      <script type="application/ld+json">{"@type":"Residence","geo":{"latitude":55.86,"longitude":-4.21},"address":{"streetAddress":"Craigpark Drive","addressLocality":"Glasgow","postalCode":"G31 2NA"}}</script>
    </head></html>`;
    const url = 'https://www.zoopla.co.uk/for-sale/details/123/';
    const l = parseListingPage(html, url);
    expect(l).toMatchObject({
      id: `zoopla-${hashString(url)}`,
      source: 'zoopla',
      price: 199000,
      qualifier: 'Offers Over',
      beds: 2,
      address: 'Craigpark Drive, Glasgow',
      postcode: 'G31 2NA',
      area: 'dennistoun',
      lat: 55.86,
      floor: 0,
      floorSource: 'text',
      kitchen: 'window',
      tenement: true,
      status: 'for-sale',
    });
    expect(l.imageUrls).toEqual(['https://example.invalid/a.jpg']);
  });

  it('never throws on an empty page', () => {
    const l = parseListingPage('', 'https://www.s1homes.com/x');
    expect(l.source).toBe('s1homes');
    expect(l.status).toBe('for-sale');
    expect(l.floor).toBeNull();
  });
});
