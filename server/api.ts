// Local-only API served by the Vite dev server (no separate process).
// Data lives in ./data as JSON files; nothing is sent anywhere except
// on-demand fetches of listing pages the user explicitly adds.
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Listing } from '../src/types';
import { parseListingPage } from '../src/lib/parse';
import { mergeRefresh, markRemoved, type RefreshResult } from '../src/lib/refresh';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LISTINGS = path.join(DATA_DIR, 'listings.json');
const CRITERIA = path.join(DATA_DIR, 'criteria.json');

const ALLOWED_HOSTS = [
  'rightmove.co.uk',
  'zoopla.co.uk',
  'onthemarket.com',
  's1homes.com',
  'espc.com',
];

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function body(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => (s += c));
    req.on('end', () => resolve(s));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function fetchPage(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
      'Accept-Language': 'en-GB,en;q=0.9',
    },
  });
  if (!r.ok) throw new FetchError(r.status);
  return r.text();
}

class FetchError extends Error {
  constructor(public status: number) {
    super(`Fetch failed: HTTP ${status}`);
  }
}

function checkHost(url: string | undefined): URL {
  let u: URL;
  try {
    u = new URL(url ?? '');
  } catch {
    throw new Error('Not a valid URL');
  }
  if (!ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) {
    throw new Error(`Unsupported site: ${u.hostname}`);
  }
  return u;
}

export function apiPlugin(): Plugin {
  return {
    name: 'househunter-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();
        try {
          const route = `${req.method} ${req.url.split('?')[0]}`;
          switch (route) {
            case 'GET /api/listings':
              return send(res, 200, readJson<Listing[]>(LISTINGS, []));

            case 'PUT /api/listings': {
              const listings = JSON.parse(await body(req)) as Listing[];
              if (!Array.isArray(listings)) return send(res, 400, { error: 'Expected an array' });
              writeJson(LISTINGS, listings);
              return send(res, 200, { ok: true });
            }

            case 'GET /api/criteria':
              return send(res, 200, readJson(CRITERIA, {}));

            case 'PUT /api/criteria':
              writeJson(CRITERIA, JSON.parse(await body(req)));
              return send(res, 200, { ok: true });

            case 'POST /api/add': {
              const { url } = JSON.parse(await body(req)) as { url?: string };
              let u: URL;
              try {
                u = checkHost(url);
              } catch (e) {
                return send(res, 400, { error: (e as Error).message });
              }
              const listing = parseListingPage(await fetchPage(u.toString()), u.toString());
              const listings = readJson<Listing[]>(LISTINGS, []);
              const i = listings.findIndex((l) => l.id === listing.id);
              // Re-adding a known listing refreshes it without losing verdicts or notes.
              const saved = i >= 0 ? mergeRefresh(listings[i], listing).listing : listing;
              if (i >= 0) listings[i] = saved;
              else listings.push(saved);
              writeJson(LISTINGS, listings);
              return send(res, 200, saved);
            }

            // Re-check one saved listing. The client calls this one at a time,
            // spaced out, and only when the user presses "Refresh all".
            case 'POST /api/refresh': {
              const { id } = JSON.parse(await body(req)) as { id?: string };
              const listings = readJson<Listing[]>(LISTINGS, []);
              const i = listings.findIndex((l) => l.id === id);
              if (i < 0) return send(res, 404, { error: `No listing ${id}` });
              const old = listings[i];
              const u = checkHost(old.url ?? undefined);
              const today = new Date().toISOString().slice(0, 10);
              let result: RefreshResult;
              try {
                result = mergeRefresh(old, parseListingPage(await fetchPage(u.toString()), u.toString()), today);
              } catch (e) {
                if (e instanceof FetchError && (e.status === 404 || e.status === 410)) {
                  result = markRemoved(old, today);
                } else throw e;
              }
              // Re-read in case the user edited something while we were fetching.
              const latest = readJson<Listing[]>(LISTINGS, []);
              const j = latest.findIndex((l) => l.id === id);
              if (j >= 0) {
                latest[j] = { ...result.listing, notes: result.changes.length ? result.listing.notes : latest[j].notes };
                writeJson(LISTINGS, latest);
              }
              return send(res, 200, result);
            }
          }
          return send(res, 404, { error: 'Not found' });
        } catch (e) {
          return send(res, 500, { error: (e as Error).message });
        }
      });
    },
  };
}
