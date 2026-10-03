// Turn a saved listing page into a complete Listing. Pure: no network access.
import type { Criteria, Listing, ListingStatus } from '../types';
import defaultCriteria from '../../data/criteria.json';
import { extractRightmoveProperty } from './rightmove';
import {
  areaFor,
  bed2Dimensions,
  councilTaxFromText,
  detectExcluded,
  detectExtras,
  detectTenement,
  epcFromText,
  htmlToText,
  kitchenDimensions,
  kitchenHint,
  outcodeOf,
  parseFloor,
  parsePrice,
  sqftFromText,
} from './hints';

type Source = Listing['source'];

export function sourceFromUrl(url: string): Source {
  let host = '';
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'manual';
  }
  if (host.endsWith('rightmove.co.uk')) return 'rightmove';
  if (host.endsWith('zoopla.co.uk')) return 'zoopla';
  if (host.endsWith('onthemarket.com')) return 'onthemarket';
  if (host.endsWith('s1homes.com')) return 's1homes';
  if (host.endsWith('espc.com')) return 'espc';
  return 'manual'; // Listing.source has no "other" member.
}

/** Short stable hash (FNV-1a, 32-bit, base36). */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const today = () => new Date().toISOString().slice(0, 10);

function blankListing(url: string, source: Source): Listing {
  return {
    id: `${source}-${hashString(url)}`,
    source,
    url,
    address: '',
    position: null,
    area: null,
    postcode: null,
    lat: null,
    lng: null,
    price: null,
    qualifier: null,
    beds: null,
    floor: null,
    floorSource: null,
    kitchen: null,
    kitchenSource: null,
    kitchenDims: null,
    sqftListing: null,
    sqftFloorplan: null,
    bed2Dims: null,
    bed2WidthM: null,
    tenement: null,
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
    asOf: today(),
  };
}

// ---------------------------------------------------------------- generic (non-Rightmove) pages

function metaContent(html: string, prop: string): string | null {
  const p = prop.replace(/[.:]/g, (c) => '\\' + c);
  const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']*)["']`, 'i'));
  const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${p}["']`, 'i'));
  const v = a?.[1] ?? b?.[1];
  return v ? htmlToText(v) : null;
}

function jsonLdNodes(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      out.push(o);
      if (o['@graph']) visit(o['@graph']);
      for (const k of ['mainEntity', 'itemOffered', 'offers']) if (o[k]) visit(o[k]);
    }
  };
  while ((m = re.exec(html))) {
    try {
      visit(JSON.parse(m[1]));
    } catch {
      /* skip bad block */
    }
  }
  return out;
}

interface GenericExtract {
  listing: Partial<Listing>;
  text: string;
}

function extractGeneric(html: string): GenericExtract {
  const l: Partial<Listing> = {};
  const title = metaContent(html, 'og:title') ?? htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
  const desc = metaContent(html, 'og:description') ?? metaContent(html, 'description');
  const image = metaContent(html, 'og:image');
  const texts: string[] = [title ?? '', desc ?? ''];
  if (image) l.imageUrls = [image];

  for (const n of jsonLdNodes(html)) {
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !isNaN(Number(v)) ? Number(v) : null);
    if (typeof n.description === 'string') texts.push(n.description);
    if (typeof n.name === 'string') texts.push(n.name);
    if (l.price == null) l.price = parsePrice(n.price) ?? null;
    const addr = n.address;
    if (addr && typeof addr === 'object') {
      const a = addr as Record<string, unknown>;
      const parts = [a.streetAddress, a.addressLocality].filter((x) => typeof x === 'string') as string[];
      if (parts.length && !l.address) l.address = parts.join(', ');
      if (typeof a.postalCode === 'string' && !l.postcode) l.postcode = a.postalCode;
    } else if (typeof addr === 'string' && !l.address) l.address = addr;
    const geo = n.geo as Record<string, unknown> | undefined;
    if (geo && typeof geo === 'object') {
      l.lat ??= num(geo.latitude);
      l.lng ??= num(geo.longitude);
    }
    l.beds ??= num(n.numberOfBedrooms) ?? num(n.numberOfRooms);
    const fs = n.floorSize as Record<string, unknown> | undefined;
    if (fs && typeof fs === 'object' && l.sqftListing == null) {
      const v = num(fs.value);
      const unit = String(fs.unitCode ?? fs.unitText ?? '').toUpperCase();
      if (v) l.sqftListing = /MTK|M2|SQM|METRE/.test(unit) ? Math.round(v * 10.7639) : Math.round(v);
    }
    if (typeof n.image === 'string' && !l.imageUrls?.length) l.imageUrls = [n.image];
  }

  const text = texts.filter(Boolean).join('\n');
  if (l.price == null) l.price = parsePrice(text.match(/£\s?\d[\d,]{3,}/)?.[0]);
  const q = text.match(/\b(offers over|fixed price|offers around|guide price|offers in the region of|from)\b/i);
  if (q) l.qualifier = q[1].replace(/\b\w/g, (c) => c.toUpperCase());
  if (l.beds == null) {
    const b = text.match(/\b(\d|one|two|three|four)[- ]bed(?:room)?s?\b/i);
    if (b) l.beds = { one: 1, two: 2, three: 3, four: 4 }[b[1].toLowerCase()] ?? Number(b[1]);
  }
  if (!l.address && title) l.address = title;
  return { listing: l, text };
}

function statusFromText(text: string): ListingStatus | null {
  const t = text.toLowerCase();
  if (/\bsold\s*(?:stc|subject to contract)\b|\bsstc\b/.test(t)) return 'sold-stc';
  if (/\bunder offer\b/.test(t)) return 'under-offer';
  return null;
}

// ---------------------------------------------------------------- public

/** Same as parseListingPage but with explicit criteria (for area + exclusion keywords). */
export function parseListingPageWith(html: string, url: string, criteria: Criteria): Listing {
  const source = sourceFromUrl(url);
  const listing = blankListing(url, source);

  let description = '';
  let keyFeatures: string[] = [];
  let captions: string[] = [];
  let excludedHint: string | null = null;
  let explicitStatus: ListingStatus | null = null;

  if (source === 'rightmove') {
    const rm = extractRightmoveProperty(html, url);
    assignDefined(listing, rm.listing);
    description = rm.description;
    keyFeatures = rm.keyFeatures;
    captions = rm.floorplanCaptions;
    excludedHint = rm.excludedHint;
    explicitStatus = rm.listing.status ?? null;
  } else {
    const g = extractGeneric(html);
    assignDefined(listing, g.listing);
    description = g.text;
  }

  // ---- hints (source: 'text')
  const featureText = keyFeatures.join('\n');
  const captionText = captions.join('\n');
  const bodyText = [featureText, description].filter(Boolean).join('\n');

  // Position codes are most reliable in the address and floorplan captions, so check those first.
  const floorHit =
    firstFloor(listing.address) ?? firstFloor(captionText) ?? firstFloor(featureText) ?? firstFloor(description);
  if (floorHit) {
    listing.floor = floorHit.floor;
    listing.position = floorHit.position;
    listing.floorSource = 'text';
  }

  const k = kitchenHint([featureText, description, captionText].filter(Boolean).join('\n'));
  if (k.verdict) {
    listing.kitchen = k.verdict;
    listing.kitchenSource = 'text';
  }
  listing.kitchenDims = kitchenDimensions(bodyText);

  listing.tenement = detectTenement(bodyText);
  listing.extras = { ...listing.extras, ...detectExtras(bodyText) };

  const bed2 = bed2Dimensions(bodyText);
  if (bed2) {
    listing.bed2Dims = bed2.dims;
    listing.bed2WidthM = bed2.widthM;
  }

  listing.excludedReason = excludedHint ?? detectExcluded(bodyText, criteria.excludeKeywords);

  listing.sqftListing ??= sqftFromText(bodyText);
  listing.epc ??= epcFromText(bodyText);
  listing.councilTaxBand ??= councilTaxFromText(bodyText);

  if (!listing.postcode) listing.postcode = outcodeOf(listing.address) ?? null;
  listing.area = areaFor(listing.postcode, listing.address, criteria);

  const textStatus = statusFromText(bodyText);
  listing.status =
    explicitStatus && explicitStatus !== 'for-sale' ? explicitStatus : textStatus ?? explicitStatus ?? 'for-sale';

  listing.asOf = today();
  return listing;
}

/** Parse a saved listing page (uses the default criteria for area + exclusion keywords). */
export function parseListingPage(html: string, url: string): Listing {
  return parseListingPageWith(html, url, defaultCriteria as Criteria);
}

function firstFloor(text: string | null | undefined): ReturnType<typeof parseFloor> | null {
  const r = parseFloor(text);
  return r.floor !== null ? r : null;
}

function assignDefined(target: Listing, src: Partial<Listing>) {
  for (const [k, v] of Object.entries(src)) {
    if (v !== undefined) (target as unknown as Record<string, unknown>)[k] = v;
  }
}
