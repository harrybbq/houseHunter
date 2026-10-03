import type { Criteria, Listing } from '../types';

// Local (npm run dev): the Vite dev server's /api reads and writes ./data and
// fetches listing pages. Published (GitHub Pages, built with VITE_STATIC=1):
// there is no server, so the committed data is baked into the build, edits are
// kept in this browser, and nothing can be fetched from the property sites.
export const STATIC = !!import.meta.env.VITE_STATIC;

const LISTINGS_KEY = 'househunter.listings.v1';
const CRITERIA_KEY = 'househunter.criteria.v1';
const BUILD_KEY = 'househunter.build.v1';
const NEEDS_SERVER = 'This is the published copy. Adding and refreshing listings only works in the local app (npm run dev).';

async function json<T>(res: Response): Promise<T> {
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok || (data && typeof data === 'object' && 'error' in (data as object))) {
    const msg = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

function stored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// A new deploy carries newer data, so it replaces edits made on the old one.
function dropStaleEdits() {
  try {
    if (localStorage.getItem(BUILD_KEY) === __BUILD_ID__) return;
    localStorage.removeItem(LISTINGS_KEY);
    localStorage.removeItem(CRITERIA_KEY);
    localStorage.setItem(BUILD_KEY, __BUILD_ID__);
  } catch {
    /* storage unavailable: just show the baked data */
  }
}

const staticApi = {
  getListings: async () => {
    dropStaleEdits();
    return stored<Listing[]>(LISTINGS_KEY) ?? ((await import('../../data/listings.json')).default as unknown as Listing[]);
  },
  getCriteria: async () => {
    dropStaleEdits();
    return stored<Criteria>(CRITERIA_KEY) ?? ((await import('../../data/criteria.json')).default as unknown as Criteria);
  },
  putCriteria: async (c: Criteria) => {
    localStorage.setItem(CRITERIA_KEY, JSON.stringify(c));
    return { ok: true as const };
  },
  add: async (_url: string): Promise<Listing> => {
    throw new Error(NEEDS_SERVER);
  },
  refresh: async (_id: string): Promise<{ listing: Listing; changes: string[] }> => {
    throw new Error(NEEDS_SERVER);
  },
};

const serverApi = {
  getListings: () => fetch('/api/listings').then((r) => json<Listing[]>(r)),
  getCriteria: () => fetch('/api/criteria').then((r) => json<Criteria>(r)),
  putCriteria: (c: Criteria) =>
    fetch('/api/criteria', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    }).then((r) => json<{ ok: true }>(r)),
  add: (url: string) =>
    fetch('/api/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }).then((r) => json<Listing>(r)),
  refresh: (id: string) =>
    fetch('/api/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).then((r) => json<{ listing: Listing; changes: string[] }>(r)),
};

export const api = STATIC ? staticApi : serverApi;

// PUT /api/listings saves the whole array, so writes are serialised: each save
// waits for the previous one, and a save queued behind another only sends the
// latest snapshot.
let chain: Promise<unknown> = Promise.resolve();
let pending: Listing[] | null = null;

export function saveListings(listings: Listing[]): Promise<void> {
  pending = listings;
  const next = chain.then(async () => {
    if (!pending) return;
    const body = JSON.stringify(pending);
    pending = null;
    if (STATIC) {
      localStorage.setItem(LISTINGS_KEY, body);
      return;
    }
    const r = await fetch('/api/listings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    await json<{ ok: true }>(r);
  });
  chain = next.catch(() => undefined);
  return next;
}
