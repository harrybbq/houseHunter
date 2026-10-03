// Rightmove page parsers. Pure functions over saved HTML: no network access here.
import type { Listing, ListingStatus } from '../types';
import { readPageModel } from './devalue';
import { councilTaxFromText, epcFromText, htmlToText, parsePrice } from './hints';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
};
/** Safe nested get: get(o, 'a', 'b') */
function get(o: unknown, ...path: string[]): unknown {
  let cur = o;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
}

export function rightmoveIdFromUrl(url: string | null | undefined): string | null {
  const m = url?.match(/\/properties\/(\d+)/);
  return m ? m[1] : null;
}

/** Locate propertyData in the resolved page model (it normally sits at the root). */
function findPropertyData(root: Obj | null): Obj | null {
  if (!root) return null;
  if (isObj(root.propertyData)) return root.propertyData;
  // Defensive: search one or two levels down.
  for (const v of Object.values(root)) {
    if (isObj(v) && isObj(v.propertyData)) return v.propertyData;
  }
  return null;
}

/** Raw text fields the hint layer needs, alongside the structured listing fields. */
export interface RightmoveExtract {
  listing: Partial<Listing>;
  description: string; // plain text (HTML stripped)
  keyFeatures: string[];
  floorplanCaptions: string[];
  /** Structural exclusion signals, e.g. auction or shared ownership flags. */
  excludedHint: string | null;
}

function sqftFromSizings(sizings: unknown[]): number | null {
  let sqm: number | null = null;
  for (const s of sizings) {
    if (!isObj(s)) continue;
    const unit = String(s.unit ?? s.displayUnit ?? '').toLowerCase();
    const size = num(s.maximumSize) ?? num(s.minimumSize) ?? num(s.size);
    if (size === null || size <= 0) continue;
    if (/ft|feet/.test(unit)) return Math.round(size);
    if (/sqm|m²|metre|meter|sq\.? ?m/.test(unit)) sqm = size;
  }
  return sqm !== null ? Math.round(sqm * 10.7639) : null;
}

function statusOf(pd: Obj): ListingStatus {
  const st = pd.status;
  const flags: string[] = [];
  for (const t of arr(pd.tags)) if (typeof t === 'string') flags.push(t);
  const reason = str(get(pd, 'listingHistory', 'listingUpdateReason'));
  if (reason) flags.push(reason);
  for (const t of arr(get(pd, 'dfpAdInfo', 'targeting'))) {
    // SO = "sold" flag in Rightmove's ad targeting.
    if (isObj(t) && t.key === 'SO' && arr(t.value).some((v) => String(v).toUpperCase() === 'TRUE')) flags.push('SOLD_STC');
  }
  const joined = flags.join(' ').toLowerCase().replace(/[_-]/g, ' ');
  if (/sold\s*stc|\bsstc\b|sold subject/.test(joined)) return 'sold-stc';
  if (/under\s*offer/.test(joined)) return 'under-offer';
  if (isObj(st)) {
    if (st.archived === true) return 'removed';
    if (st.published === false) return 'removed';
    if (st.published === true) return 'for-sale';
  }
  return 'for-sale';
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s_-])([a-z])/g, (_, p: string, c: string) => (p === '_' ? ' ' : p) + c.toUpperCase());
}

/** Full extraction: structured fields + raw text for hints. Never throws. */
export function extractRightmoveProperty(html: string, url: string): RightmoveExtract {
  const out: RightmoveExtract = { listing: {}, description: '', keyFeatures: [], floorplanCaptions: [], excludedHint: null };
  const l = out.listing;
  const urlId = rightmoveIdFromUrl(url);
  l.source = 'rightmove';
  l.url = url;
  if (urlId) l.id = `rm-${urlId}`;

  let pd: Obj | null = null;
  try {
    pd = findPropertyData(readPageModel(html));
  } catch {
    pd = null;
  }
  if (!pd) return out;

  try {
    const id = str(pd.id) ?? (num(pd.id) !== null ? String(pd.id) : null) ?? urlId;
    if (id) l.id = `rm-${id}`;
    if (!urlId && id) l.url = `https://www.rightmove.co.uk/properties/${id}`;

    out.description = htmlToText(str(get(pd, 'text', 'description')));
    out.keyFeatures = arr(pd.keyFeatures)
      .map((k) => (typeof k === 'string' ? k : isObj(k) ? str(k.description) ?? str(k.text) : null))
      .filter((k): k is string => !!k)
      .map((k) => htmlToText(k));

    // Price
    l.price = parsePrice(get(pd, 'prices', 'primaryPrice')) ?? num(get(pd, 'mortgageCalculator', 'price'));
    l.qualifier = str(get(pd, 'prices', 'displayPriceQualifier'));

    // Address / location
    l.address = str(get(pd, 'address', 'displayAddress')) ?? undefined;
    const outcode = str(get(pd, 'address', 'outcode'));
    const incode = str(get(pd, 'address', 'incode'));
    l.postcode = outcode ? (incode ? `${outcode} ${incode}` : outcode) : null;
    l.lat = num(get(pd, 'location', 'latitude'));
    l.lng = num(get(pd, 'location', 'longitude'));

    l.beds = num(pd.bedrooms);
    l.sqftListing = sqftFromSizings(arr(pd.sizings));

    // Media
    const floorplans = arr(pd.floorplans).filter(isObj);
    l.floorplanUrls = floorplans.map((f) => str(f.url)).filter((u): u is string => !!u);
    out.floorplanCaptions = floorplans.map((f) => str(f.caption)).filter((c): c is string => !!c);
    l.imageUrls = arr(pd.images)
      .filter(isObj)
      .map((i) => str(i.url))
      .filter((u): u is string => !!u);

    // Costs / tenure / EPC
    l.councilTaxBand = str(get(pd, 'livingCosts', 'councilTaxBand'))?.toUpperCase() ?? councilTaxFromText(out.description);
    const tenure = str(get(pd, 'tenure', 'tenureType'));
    l.tenure = tenure ? titleCase(tenure) : null;
    const epcCaption = arr(pd.epcGraphs)
      .filter(isObj)
      .map((e) => str(e.caption) ?? '')
      .join(' ');
    l.epc = epcFromText(epcCaption) ?? epcFromText([out.description, ...out.keyFeatures].join('\n'));

    l.status = statusOf(pd);

    // Structural exclusion flags
    if (str(get(pd, 'text', 'auctionFeesDisclaimer')) || str(get(pd, 'text', 'reservePriceDisclaimer'))) {
      out.excludedHint = 'auction';
    } else if (get(pd, 'sharedOwnership', 'sharedOwnershipFlag') === true) {
      out.excludedHint = 'shared ownership';
    }
  } catch {
    // Keep whatever was collected.
  }
  return out;
}

/** Structured Rightmove fields. Every field optional; never throws. */
export function parseRightmovePropertyPage(html: string, url: string): Partial<Listing> {
  return extractRightmoveProperty(html, url).listing;
}

/** Property ids + canonical URLs from a Rightmove search results page. */
export function parseRightmoveSearchPage(html: string): { id: string; url: string }[] {
  const seen = new Set<string>();
  const out: { id: string; url: string }[] = [];
  const add = (id: unknown) => {
    const s = typeof id === 'number' ? String(id) : typeof id === 'string' ? id.trim() : '';
    if (!/^\d+$/.test(s) || seen.has(s)) return;
    seen.add(s);
    out.push({ id: s, url: `https://www.rightmove.co.uk/properties/${s}` });
  };

  const m = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      for (const p of arr(get(data, 'props', 'pageProps', 'searchResults', 'properties'))) {
        if (!isObj(p)) continue;
        add(p.id ?? rightmoveIdFromUrl(str(p.propertyUrl)));
      }
    } catch {
      /* fall through to regex */
    }
  }
  if (out.length === 0) {
    const re = /\/properties\/(\d+)/g;
    let r: RegExpExecArray | null;
    while ((r = re.exec(html))) add(r[1]);
  }
  return out;
}
