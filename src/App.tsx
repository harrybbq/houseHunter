import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Criteria, Listing, Score } from './types';
import { api, saveListings, STATIC } from './ui/api';
import { RefreshAll } from './ui/RefreshAll';
import { safeScore } from './ui/format';
import { Filters, applyFilters, defaultFilters, type FilterState } from './ui/Filters';
import { MapView } from './ui/MapView';
import { ListingTable } from './ui/ListingTable';
import { DetailDrawer } from './ui/DetailDrawer';
import { SettingsModal } from './ui/SettingsModal';
import { TopBar } from './ui/TopBar';

const FILTERS_KEY = 'househunter.filters.v1';

function loadFilters(c: Criteria): FilterState {
  const base = defaultFilters(c);
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) {
      const { knownAreas, ...saved } = JSON.parse(raw) as Partial<FilterState> & { knownAreas?: string[] };
      const f = { ...base, ...saved };
      // Areas added since the filters were saved start ticked. Older saves didn't record
      // which areas existed, so every unticked area gets ticked once.
      const added = Object.keys(c.areas).filter((k) => !(knownAreas ?? f.areas).includes(k) && !f.areas.includes(k));
      return added.length ? { ...f, areas: [...f.areas, ...added] } : f;
    }
  } catch {
    /* storage unavailable */
  }
  return base;
}

function isCriteria(x: unknown): x is Criteria {
  return !!x && typeof x === 'object' && typeof (x as Criteria).maxPrice === 'number' && !!(x as Criteria).areas;
}

export default function App() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [criteria, setCriteria] = useState<Criteria | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panRequest, setPanRequest] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const listingsRef = useRef<Listing[]>([]);

  const replaceListings = useCallback((next: Listing[], persist: boolean) => {
    listingsRef.current = next;
    setListings(next);
    if (persist) {
      saveListings(next).then(
        () => setSaveError(null),
        (e: Error) => setSaveError(`Save failed: ${e.message}`),
      );
    }
  }, []);

  useEffect(() => {
    Promise.all([api.getListings(), api.getCriteria()])
      .then(([ls, c]) => {
        if (!isCriteria(c)) throw new Error('data/criteria.json is missing or invalid');
        replaceListings(Array.isArray(ls) ? ls : [], false);
        setCriteria(c);
        setFilters(loadFilters(c));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [replaceListings]);

  useEffect(() => {
    if (!filters) return;
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ ...filters, knownAreas: criteria ? Object.keys(criteria.areas) : undefined }));
    } catch {
      /* ignore */
    }
  }, [filters, criteria]);

  const scores = useMemo(() => {
    const m = new Map<string, Score>();
    if (criteria) for (const l of listings) m.set(l.id, safeScore(l, criteria));
    return m;
  }, [listings, criteria]);

  const visible = useMemo(() => {
    if (!criteria || !filters) return [];
    return applyFilters(listings, scores, filters, criteria).sort(
      (a, b) =>
        (scores.get(b.id)?.total ?? 0) - (scores.get(a.id)?.total ?? 0) ||
        Number(b.benchmark) - Number(a.benchmark) ||
        (a.price ?? Infinity) - (b.price ?? Infinity),
    );
  }, [listings, scores, filters, criteria]);

  const selected = listings.find((l) => l.id === selectedId) ?? null;

  const select = (id: string, pan: boolean) => {
    setSelectedId(id);
    setDrawerError(null);
    if (pan) setPanRequest((n) => n + 1);
  };

  // Merge a listing returned by POST /api/add (the server has already saved it).
  const mergeFromServer = (l: Listing) => {
    const cur = listingsRef.current;
    const i = cur.findIndex((x) => x.id === l.id);
    replaceListings(i >= 0 ? cur.map((x) => (x.id === l.id ? l : x)) : [...cur, l], false);
  };

  const addByUrl = async (url: string) => {
    const l = await api.add(url);
    mergeFromServer(l);
    select(l.id, true);
  };

  const patchSelected = (patch: Partial<Listing>) => {
    if (!selectedId) return;
    const id = selectedId;
    replaceListings(
      listingsRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      true,
    );
  };

  const refreshSelected = async () => {
    if (!selected?.url) return;
    setDrawerBusy(true);
    setDrawerError(null);
    try {
      mergeFromServer(await api.add(selected.url));
    } catch (e) {
      setDrawerError((e as Error).message);
    } finally {
      setDrawerBusy(false);
    }
  };

  const deleteSelected = () => {
    if (!selected) return;
    if (!window.confirm(`Delete ${selected.address}${selected.position ? ' ' + selected.position : ''}?`)) return;
    replaceListings(
      listingsRef.current.filter((l) => l.id !== selected.id),
      true,
    );
    setSelectedId(null);
  };

  const saveCriteria = async (c: Criteria) => {
    await api.putCriteria(c);
    setCriteria(c);
    // Newly added areas should start ticked in the filter.
    setFilters((f) => {
      if (!f || !criteria) return f;
      const added = Object.keys(c.areas).filter((k) => !(k in criteria.areas));
      return added.length ? { ...f, areas: [...f.areas, ...added] } : f;
    });
  };

  const importAll = async (ls: Listing[], c: Criteria | null) => {
    await saveListings(ls);
    replaceListings(ls, false);
    if (c) await saveCriteria(c);
    setSelectedId(null);
  };

  const loadSample = async () => {
    const mod = await import('../data/sample-listings.json');
    const sample = mod.default as unknown as Listing[];
    try {
      await saveListings(sample);
      replaceListings(sample, false);
    } catch (e) {
      setSaveError(`Could not load sample: ${(e as Error).message}`);
    }
  };

  if (loadError) {
    return (
      <div className="fullpage-msg">
        <h1>HouseHunter</h1>
        <p className="error">Could not load data: {loadError}</p>
        <p className="muted">Is the Vite dev server running (npm run dev)? The API lives in its middleware.</p>
      </div>
    );
  }
  if (!criteria || !filters) {
    return <div className="fullpage-msg muted">Loading…</div>;
  }

  return (
    <div className={`app ${selected ? 'has-drawer' : ''}`}>
      <TopBar
        onAdd={STATIC ? undefined : addByUrl}
        onSettings={() => setShowSettings(true)}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        actions={STATIC ? undefined : <RefreshAll getListings={() => listingsRef.current} onUpdated={mergeFromServer} />}
      />
      {STATIC && (
        <div className="banner note">
          Published copy. Changes you make here stay in this browser and are replaced by the next deploy. Adding and
          refreshing listings needs the local app.
        </div>
      )}
      {saveError && (
        <div className="banner error" role="alert">
          {saveError}
          <button className="link-btn" onClick={() => setSaveError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className="layout">
        <nav className={`sidebar ${filtersOpen ? 'open' : ''}`} aria-label="Filters">
          <button className="btn ghost small sidebar-close" onClick={() => setFiltersOpen(false)}>
            Done
          </button>
          <Filters
            criteria={criteria}
            filters={filters}
            onChange={setFilters}
            shown={visible.length}
            total={listings.length}
            onReset={() => setFilters(defaultFilters(criteria))}
          />
        </nav>
        <main className="main">
          <div className="map-wrap">
            <MapView
              listings={visible}
              scores={scores}
              selectedId={selectedId}
              panRequest={panRequest}
              onSelect={(id) => select(id, false)}
            />
            <div className="legend" aria-hidden>
              <span><i className="dot tier-dot-Perfect" /> Perfect</span>
              <span><i className="dot tier-dot-Strong" /> Strong</span>
              <span><i className="dot tier-dot-Possible" /> Possible</span>
              <span><i className="dot tier-dot-Fails" /> Fails</span>
              <span><i className="dot ring" /> Benchmark</span>
            </div>
          </div>
          <div className="list-pane">
            {listings.length === 0 ? (
              <div className="empty">
                <h2>No listings yet</h2>
                {STATIC ? (
                  <p>This published copy has no listings. Add them in the local app, then commit and push.</p>
                ) : (
                  <p>
                    Paste a property page URL into <strong>Add by URL</strong> at the top. HouseHunter reads that one page,
                    scores it against your criteria, and puts it on the map.
                  </p>
                )}
                {import.meta.env.DEV && (
                  <button className="btn ghost" onClick={loadSample}>
                    Load sample data
                  </button>
                )}
              </div>
            ) : visible.length === 0 ? (
              <div className="empty">
                <h2>Nothing matches these filters</h2>
                <p className="muted">
                  {listings.length} listings are hidden. Failed listings are hidden unless you tick “Show failed”.
                </p>
                <button className="btn ghost" onClick={() => setFilters(defaultFilters(criteria))}>
                  Reset filters
                </button>
              </div>
            ) : (
              <ListingTable
                listings={visible}
                scores={scores}
                criteria={criteria}
                selectedId={selectedId}
                onSelect={(id) => select(id, true)}
              />
            )}
          </div>
        </main>
      </div>

      {selected && (
        <DetailDrawer
          key={selected.id}
          listing={selected}
          score={scores.get(selected.id)}
          criteria={criteria}
          busy={drawerBusy}
          error={drawerError}
          onPatch={patchSelected}
          onRefresh={STATIC ? undefined : refreshSelected}
          onDelete={deleteSelected}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          criteria={criteria}
          listings={listings}
          onSave={saveCriteria}
          onImport={importAll}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
