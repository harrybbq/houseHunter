import type { Criteria, Listing } from '../types';

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

export const api = {
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
