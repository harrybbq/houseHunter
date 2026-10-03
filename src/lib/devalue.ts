// Resolve Rightmove's `window.__PAGE_MODEL = {"data":"[...]","encoding":"on"}`
// payload: a devalue-style flattened array where object/array members are
// integer indices into the array and primitives appear only as leaves.

const UNDEFINED = -1;
const HOLE = -2;
const NAN = -3;
const POS_INF = -4;
const NEG_INF = -5;
const NEG_ZERO = -6;

function sentinel(n: number): unknown {
  switch (n) {
    case UNDEFINED:
    case HOLE:
      return undefined;
    case NAN:
      return NaN;
    case POS_INF:
      return Infinity;
    case NEG_INF:
      return -Infinity;
    case NEG_ZERO:
      return -0;
    default:
      return undefined;
  }
}

/** Resolve a flat devalue array starting at index 0. Cycles are preserved via memoisation. */
export function resolveDevalue(flat: unknown): unknown {
  if (typeof flat === 'number') return sentinel(flat);
  if (!Array.isArray(flat)) return flat;
  if (flat.length === 0) return undefined;
  const memo = new Map<number, unknown>();

  const ref = (i: unknown): unknown => {
    if (typeof i !== 'number' || !Number.isInteger(i)) return i; // defensive: literal value
    if (i < 0) return sentinel(i);
    if (i >= flat.length) return undefined;
    if (memo.has(i)) return memo.get(i);
    const v = flat[i];
    if (v === null || typeof v !== 'object') {
      memo.set(i, v);
      return v;
    }
    if (Array.isArray(v)) {
      // A string first member is a devalue type tag.
      if (typeof v[0] === 'string') return resolveTagged(i, v);
      const out: unknown[] = [];
      memo.set(i, out);
      for (let k = 0; k < v.length; k++) {
        if (v[k] === HOLE) continue;
        out[k] = ref(v[k]);
      }
      return out;
    }
    const out: Record<string, unknown> = {};
    memo.set(i, out);
    for (const [k, idx] of Object.entries(v as Record<string, unknown>)) out[k] = ref(idx);
    return out;
  };

  const resolveTagged = (i: number, v: unknown[]): unknown => {
    const tag = v[0] as string;
    switch (tag) {
      case 'Date': {
        const d = new Date(String(v[1]));
        memo.set(i, d);
        return d;
      }
      case 'BigInt': {
        let b: unknown = v[1];
        try {
          b = BigInt(String(v[1]));
        } catch {
          /* keep raw */
        }
        memo.set(i, b);
        return b;
      }
      case 'RegExp': {
        let r: unknown = v[1];
        try {
          r = new RegExp(String(v[1]), typeof v[2] === 'string' ? v[2] : undefined);
        } catch {
          /* keep raw */
        }
        memo.set(i, r);
        return r;
      }
      case 'Set': {
        const s = new Set<unknown>();
        memo.set(i, s);
        for (let k = 1; k < v.length; k++) s.add(ref(v[k]));
        return s;
      }
      case 'Map': {
        const m = new Map<unknown, unknown>();
        memo.set(i, m);
        for (let k = 1; k + 1 < v.length; k += 2) m.set(ref(v[k]), ref(v[k + 1]));
        return m;
      }
      case 'null': {
        const o: Record<string, unknown> = Object.create(null);
        memo.set(i, o);
        const body = v[1];
        if (body && typeof body === 'object') {
          for (const [k, idx] of Object.entries(body as Record<string, unknown>)) o[k] = ref(idx);
        }
        return o;
      }
      default: {
        // Not a known tag: probably a plain array whose first member is a literal. Resolve defensively.
        const out: unknown[] = [];
        memo.set(i, out);
        for (const x of v) out.push(typeof x === 'number' ? ref(x) : x);
        return out;
      }
    }
  };

  return ref(0);
}

/** Find the `(window.)__PAGE_MODEL = {...}` object literal in HTML and return its raw JSON text. */
export function extractPageModelJson(html: string): string | null {
  const re = /(?:window\.)?(?:__)?PAGE_MODEL\s*=\s*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const start = m.index + m[0].length;
    if (html[start] !== '{') continue;
    const end = matchBrace(html, start);
    if (end > start) return html.slice(start, end);
  }
  return null;
}

/** Given the index of an opening `{`, return the index just past its matching `}`, or -1. */
function matchBrace(s: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let k = start; k < s.length; k++) {
    const c = s[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return k + 1;
    }
  }
  return -1;
}

/**
 * Decode a PAGE_MODEL object. Accepts the devalue form ({ data: "<json array>" }),
 * a data field that is already an array, or plain JSON that holds `propertyData` directly.
 */
export function decodePageModel(model: unknown): Record<string, unknown> | null {
  if (!model || typeof model !== 'object') return null;
  const obj = model as Record<string, unknown>;
  if ('propertyData' in obj) return obj;
  let data = obj.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (Array.isArray(data)) {
    const root = resolveDevalue(data);
    return root && typeof root === 'object' ? (root as Record<string, unknown>) : null;
  }
  if (data && typeof data === 'object') return data as Record<string, unknown>;
  return null;
}

/** HTML → resolved page model root, or null. Never throws. */
export function readPageModel(html: string): Record<string, unknown> | null {
  try {
    const raw = extractPageModelJson(html);
    if (!raw) return null;
    return decodePageModel(JSON.parse(raw));
  } catch {
    return null;
  }
}
