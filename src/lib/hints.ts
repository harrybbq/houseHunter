// Text heuristics. Everything here is a *hint*: callers mark results with source 'text'.
// Unknown → null. Never guess when the evidence is thin.
import type { Criteria, Floor, KitchenVerdict, Listing } from '../types';

// ---------------------------------------------------------------- text utils

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  pound: '£',
  frac12: '½',
  sup2: '²',
  times: '×',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
};

/** Strip tags, decode common entities, and turn <br>/<p>/<li> into newlines. */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z0-9]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

/** Split into clauses (sentences / lines / list items) for proximity-based cues. */
function clauses(text: string): string[] {
  return text
    .split(/[.;!?\n•]+(?:\s|$)|\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------- floor

// A Glasgow position code: floor digit / door (digit or L/R/M). Not part of a date,
// a longer fraction, or a number like "11/2".
const POSITION_RE =
  /(?<![\d/.,£])([0-9])\s?\/\s?([0-9]|[LRMlrm])(?![\d/])(?!\s*(?:miles?|mi\b|acres?|hours?|hrs?\b|price|bath|baths|inch|in\b|"|”|of\b))/g;

interface FloorPhrase {
  re: RegExp;
  floor: Exclude<Floor, null> | 'top';
}

const FLOOR_PHRASES: FloorPhrase[] = [
  { re: /\b(?:raised|elevated|lower)\s+ground(?:\s+floor)?\b/gi, floor: 0 },
  { re: /\bground[- ]floor\b(?!\s+(?:of the close|landing|entrance|entry|shops?|commercial|retail|bin|store|storage))/gi, floor: 0 },
  { re: /\bmain[- ]door\b(?!\s+(?:to|of|into) the close)/gi, floor: 0 },
  { re: /\bgarden[- ]level\b/gi, floor: 0 },
  { re: /\b(?:first|1st)[- ]floor\b(?!\s+(?:landing|of the close|stair|stairwell|half[- ]landing))/gi, floor: 1 },
  { re: /\b(?:second|2nd)[- ]floor\b(?!\s+(?:landing|of the close|stair|stairwell|half[- ]landing))/gi, floor: 2 },
  { re: /\b(?:third|3rd|fourth|4th|fifth|5th|sixth|6th)[- ]floor\b(?!\s+(?:landing|of the close|stair))/gi, floor: 3 },
  { re: /\btop[- ]floor\b/gi, floor: 'top' },
];

/**
 * Evidence that the building has 4+ storeys (so "top floor" means ≥ 3rd).
 * "Tenement" alone is not evidence: Glasgow tenements are 3 or 4 storeys,
 * so a top-floor tenement flat may be 2nd floor (exception-eligible).
 */
const TALL_BUILDING_RE =
  /\b(?:(?:four|five|six|4|5|6)[- ]stor(?:e)?y|(?:third|fourth|3rd|4th)[- ]floor)\b/i;

export function parseFloor(text: string | null | undefined): { floor: Floor; position: string | null } {
  const t = htmlToText(text);
  if (!t) return { floor: null, position: null };

  // 1. Position code wins.
  POSITION_RE.lastIndex = 0;
  const code = POSITION_RE.exec(t);
  if (code) {
    const n = Number(code[1]);
    const position = `${code[1]}/${code[2].toUpperCase()}`;
    return { floor: (n >= 3 ? 3 : n) as Floor, position };
  }

  // 2. Phrases: take the earliest unambiguous match.
  let best: { idx: number; floor: Floor } | null = null;
  for (const p of FLOOR_PHRASES) {
    p.re.lastIndex = 0;
    const m = p.re.exec(t);
    if (!m) continue;
    let floor: Floor;
    if (p.floor === 'top') {
      // "Top floor" of a two-storey building is ambiguous; need evidence of height.
      if (!TALL_BUILDING_RE.test(t) || /\b(?:two|2)[- ]stor(?:e)?y\b|four[- ]in[- ]a[- ]block|cottage flat/i.test(t)) continue;
      floor = 3;
    } else {
      floor = p.floor;
    }
    if (!best || m.index < best.idx) best = { idx: m.index, floor };
  }
  return { floor: best ? best.floor : null, position: null };
}

// ---------------------------------------------------------------- kitchen

const ROOM_WORDS = /\b(?:lounge|living|sitting|reception|bedroom|bathroom|shower room|hall|hallway|dining room|study|bay)\b/i;

export function kitchenHint(text: string | null | undefined): { verdict: KitchenVerdict | null; cues: string[] } {
  const t = htmlToText(text);
  const cues: string[] = [];
  if (!t) return { verdict: null, cues };

  let windowless = false;
  let window = false;
  let dining = false;
  let openLiving = false;
  let openDining = false;
  let warning = false;

  for (const c of clauses(t)) {
    const lc = c.toLowerCase();
    if (!/kitchen|scullery|galley/.test(lc)) continue;

    // Explicit "no window" statements.
    const noWin =
      lc.match(/\b(?:windowless|internal)\s+(?:\w+\s+)?kitchen\b/) ??
      lc.match(/\bkitchen\b[^,]{0,40}\b(?:no|without(?: a)?|lacks(?: a)?)\s+(?:external\s+)?window/) ??
      lc.match(/\bkitchen\b[^,]{0,30}\bis\s+internal\b/);
    if (noWin) {
      windowless = true;
      cues.push(noWin[0]);
      continue;
    }

    // Window close to "kitchen" in the same clause, no other room in between.
    const winRes = [/\bkitchen\b([^.]{0,60}?)\bwindows?\b/, /\bwindows?\b([^.]{0,40}?)\bkitchen\b/];
    for (const re of winRes) {
      const m = lc.match(re);
      if (m && !ROOM_WORDS.test(m[1])) {
        window = true;
        cues.push(m[0]);
        break;
      }
    }

    const diner = lc.match(/\bkitchen\s*(?:\/|-|&|and)\s*diner\b/);
    if (diner) {
      openDining = true;
      cues.push(diner[0]);
    }

    const din =
      lc.match(/\b(?:dining|breakfasting|breakfast)[- ](?:sized[- ])?kitchen\b/) ??
      lc.match(/\bkitchen\b[^,]{0,40}\b(?:dining|breakfasting) (?:area|space|table)\b/) ??
      lc.match(/\b(?:dining|breakfasting) (?:area|space)\b[^,]{0,40}\bkitchen\b/);
    if (din) {
      dining = true;
      cues.push(din[0]);
    }

    const open = lc.match(/\bopen[- ]plan\b/);
    if (open) {
      if (/\b(?:lounge|living|sitting|family room)\b/.test(lc)) {
        openLiving = true;
        cues.push(c.length > 80 ? open[0] + ' (living)' : c);
      } else if (/\bdin(?:ing|er)\b/.test(lc)) {
        openDining = true;
        cues.push(c.length > 80 ? open[0] + ' (dining)' : c);
      }
    }

    const warn =
      lc.match(/\bgalley\b/) ??
      lc.match(/\bscullery\b/) ??
      lc.match(/\bkitchenette\b/) ??
      lc.match(/\bkitchen\s+(?:off|leading off|accessed (?:from|via))\s+(?:the\s+)?(?:lounge|living room|sitting room)\b/) ??
      lc.match(/\b(?:lounge|living room|sitting room)\b[^,]{0,30}\bkitchen off\b/) ??
      lc.match(/\badjacent (?:\w+\s+)?kitchen\b/) ??
      lc.match(/\bkitchen\b[^,]{0,20}\badjacent\b/);
    if (warn) {
      warning = true;
      cues.push(warn[0]);
    }
  }

  let verdict: KitchenVerdict | null = null;
  if (windowless) verdict = 'windowless';
  else if (window) verdict = 'window';
  else if (warning) verdict = 'unsure'; // "kitchen off lounge" often means no window (bay-tenement pattern)
  else if (openDining) verdict = 'open-dining';
  else if (openLiving) verdict = 'open-living';
  else if (dining) verdict = 'window'; // a dining/breakfasting kitchen nearly always has a window
  return { verdict, cues: [...new Set(cues)] };
}

// ---------------------------------------------------------------- exclusions

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the first exclusion keyword found (whole-word, case-insensitive), else null. */
export function detectExcluded(text: string | null | undefined, keywords: string[]): string | null {
  const t = htmlToText(text).toLowerCase();
  if (!t) return null;
  for (const kw of keywords) {
    const k = kw.trim().toLowerCase();
    if (!k) continue;
    const pattern = escapeRe(k).replace(/(?:\\-|\s)+/g, '[\\s-]+');
    const re = new RegExp(`(?<![\\w-])${pattern}(?![\\w-])`, 'i');
    const m = re.exec(t);
    if (!m) continue;
    // Skip direct negations ("not tenanted", "no auction", "non buy-to-let"). Keep checking later keywords.
    const before = t.slice(Math.max(0, m.index - 6), m.index);
    if (/\b(?:not|no|non)[\s-]+$/.test(before)) continue;
    return kw;
  }
  return null;
}

// ---------------------------------------------------------------- tenement

const NOT_TENEMENT_RE =
  /\b(?:new[- ]build|newly built|purpose[- ]built|conversion|converted|19[3-9]0'?s|20[0-2]\d'?s?\s+(?:built|development)|ex[- ](?:local[- ]authority|council)|former council|modern (?:development|block|building)|built in (?:19[3-9]\d|20\d\d))\b/i;
const TENEMENT_RE =
  /\b(?:sandstone|tenements?|victorian|edwardian|traditional|period (?:features?|property|character|tenement|building|details?|flat|home|style)|(?:the|secure|tiled|wally|entry|common|main) close|close (?:door|entry))\b/i;

export function detectTenement(text: string | null | undefined): boolean | null {
  const t = htmlToText(text);
  if (!t) return null;
  if (NOT_TENEMENT_RE.test(t)) return false;
  if (TENEMENT_RE.test(t)) return true;
  return null;
}

// ---------------------------------------------------------------- extras

export function detectExtras(text: string | null | undefined): Listing['extras'] {
  const t = htmlToText(text);
  const out: Listing['extras'] = {};
  if (!t) return out;
  if (/\bwalk[- ]?in\s+(?:\w+\s+)?shower\b/i.test(t)) out.walkInShower = true;
  if (/\b(?:private|own|exclusive|enclosed|exclusive use of (?:a|the))\s+(?:\w+\s+)?gardens?\b/i.test(t)) {
    // "own garden" is fine; reject "shared/communal" in the same phrase.
    const m = t.match(/\b(?:private|own|exclusive|enclosed|exclusive use of (?:a|the))\s+(?:\w+\s+)?gardens?\b/i);
    if (m && !/communal|shared/i.test(m[0])) out.garden = true;
  }
  if (/\bbay[- ]?(?:window(?:ed|s)?|fronted|front)\b|\bbay (?:lounge|sitting room|living room)\b/i.test(t)) out.bay = true;
  return out;
}

// ---------------------------------------------------------------- room dimensions

const FT_IN = String.raw`(\d{1,2})\s*(?:'|’|ft|feet)\s*(?:(\d{1,2})\s*(?:"|”|''|in(?:ches)?)?)?`;
const METRIC_PAIR = new RegExp(
  String.raw`(\d{1,2}(?:\.\d{1,2})?)\s*m?\s*(?:x|×|by)\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:m|metres|meters)\b`,
  'i',
);
const IMPERIAL_PAIR = new RegExp(`${FT_IN}\\s*(?:x|×|by)\\s*${FT_IN}`, 'i');

function ftToM(ft: string, inch?: string): number {
  return (Number(ft) * 12 + (inch ? Number(inch) : 0)) * 0.0254;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Find "<label> ... 4.58m x 2.95m" (or ft/in) and return dims string + narrower side in metres. */
export function roomDimensions(text: string | null | undefined, label: RegExp): { dims: string; widthM: number } | null {
  const t = htmlToText(text);
  if (!t) return null;
  const re = new RegExp(label.source, label.flags.includes('g') ? label.flags : label.flags + 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const window = t.slice(m.index + m[0].length, m.index + m[0].length + 90);
    // Don't run into the next room's dimensions.
    const stop = window.search(/\b(?:bedroom|lounge|living|kitchen|bathroom|hall|dining|study|shower room)\b/i);
    const seg = stop >= 0 ? window.slice(0, stop) : window;
    const mm = seg.match(METRIC_PAIR);
    if (mm) {
      const a = Number(mm[1]);
      const b = Number(mm[2]);
      if (a > 0 && b > 0 && a < 20 && b < 20) return { dims: `${mm[1]} x ${mm[2]} m`, widthM: Math.min(a, b) };
    }
    const im = seg.match(IMPERIAL_PAIR);
    if (im) {
      const a = ftToM(im[1], im[2]);
      const b = ftToM(im[3], im[4]);
      if (a > 0 && b > 0) return { dims: `${round2(a)} x ${round2(b)} m`, widthM: round2(Math.min(a, b)) };
    }
  }
  return null;
}

const BED2_LABEL = /\b(?:bedroom\s*(?:2|two|no\.?\s*2)|second bedroom|2nd bedroom)\b/i;
const KITCHEN_LABEL = /\b(?:dining\s+|breakfasting\s+)?kitchen(?:\s*\/\s*diner)?\b/i;

export function bed2Dimensions(text: string | null | undefined): { dims: string; widthM: number } | null {
  return roomDimensions(text, BED2_LABEL);
}

/** Narrower side of bedroom 2 in metres, or null. */
export function bed2Width(text: string | null | undefined): number | null {
  return bed2Dimensions(text)?.widthM ?? null;
}

export function kitchenDimensions(text: string | null | undefined): string | null {
  return roomDimensions(text, KITCHEN_LABEL)?.dims ?? null;
}

// ---------------------------------------------------------------- misc text facts

export function epcFromText(text: string | null | undefined): string | null {
  const m = htmlToText(text).match(/\bEPC(?:\s+(?:rating|band|grade))?\s*(?:[:\-–]|is|of)?\s*([A-G])\b(?![a-z])/i);
  return m ? m[1].toUpperCase() : null;
}

export function councilTaxFromText(text: string | null | undefined): string | null {
  const m = htmlToText(text).match(/\bcouncil\s+tax(?:\s+band)?\s*(?:[:\-–]|is)?\s*(?:band\s*)?([A-H])\b(?![a-z])/i);
  return m ? m[1].toUpperCase() : null;
}

/** Floor area stated in text, as sq ft. */
export function sqftFromText(text: string | null | undefined): number | null {
  const t = htmlToText(text);
  const ft = t.match(/\b(\d{1,2},?\d{3}|\d{3})\s*(?:sq\.?\s*ft|sqft|square\s+f(?:ee|oo)t|ft²|ft2)\b/i);
  if (ft) return Number(ft[1].replace(/,/g, ''));
  const m2 = t.match(/\b(\d{2,3}(?:\.\d+)?)\s*(?:sq\.?\s*m|sqm|square\s+met(?:re|er)s?|m²|m2)\b/i);
  if (m2) return Math.round(Number(m2[1]) * 10.7639);
  return null;
}

/** "£210,000" / "210000" / "£210k" → 210000; anything else → null. */
export function parsePrice(s: unknown): number | null {
  if (typeof s === 'number') return Number.isFinite(s) && s > 0 ? s : null;
  if (typeof s !== 'string') return null;
  const m = s.replace(/\s/g, '').match(/£?(\d[\d,]*(?:\.\d+)?)(k|m)?/i);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ''));
  if (m[2]?.toLowerCase() === 'k') n *= 1_000;
  if (m[2]?.toLowerCase() === 'm') n *= 1_000_000;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

// ---------------------------------------------------------------- area

const KELVINDALE_WORDS = /\b(?:kelvindale|kelvinside|cleveden)\b/i;

export function outcodeOf(s: string | null | undefined): string | null {
  if (!s) return null;
  const direct = s.trim().toUpperCase().match(/^([A-Z]{1,2}\d[A-Z\d]?)(?:\s|$)/);
  if (direct) return direct[1];
  const inside = s.toUpperCase().match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)(?:\s+\d[A-Z]{2})?\b/);
  return inside ? inside[1] : null;
}

export function areaFor(postcode: string | null, address: string | null, criteria: Criteria): string | null {
  const oc = outcodeOf(postcode) ?? outcodeOf(address);
  if (!oc) return null;
  const candidates = Object.entries(criteria.areas).filter(([, a]) =>
    a.outcodes.some((o) => o.toUpperCase() === oc),
  );
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0][0];

  const addr = address ?? '';
  // An area named in the address wins.
  const named = candidates.find(
    ([key, a]) => new RegExp(`\\b${escapeRe(key)}\\b`, 'i').test(addr) || addr.toLowerCase().includes(a.name.toLowerCase()),
  );
  if (named) return named[0];
  // G12: Kelvindale / Kelvinside / Cleveden streets → kelvindale.
  if (KELVINDALE_WORDS.test(addr)) {
    const k = candidates.find(([key]) => key === 'kelvindale');
    if (k) return k[0];
  }
  // Otherwise the better-ranked area sharing the outcode (G12 → hillhead).
  candidates.sort((a, b) => a[1].rank - b[1].rank);
  return candidates[0][0];
}
