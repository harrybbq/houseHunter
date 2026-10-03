import { useEffect, useRef } from 'react';
import type { Criteria, Listing, Score } from '../types';
import {
  effectiveSqft,
  floorLabel,
  hasLocation,
  isInactive,
  kitchenInfo,
  money,
  qualifierShort,
  sqftMismatch,
  statusLabel,
} from './format';

interface Props {
  listings: Listing[]; // already filtered and sorted
  scores: Map<string, Score>;
  criteria: Criteria;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TierChip({ tier }: { tier: Score['tier'] }) {
  return <span className={`chip tier-chip-${tier}`}>{tier}</span>;
}

export function KitchenIcon({ listing }: { listing: Listing }) {
  const k = kitchenInfo(listing.kitchen);
  if (!k) return <span className="kicon kicon-none" title="Kitchen not assessed">–</span>;
  const cls = k.ok === true ? 'kicon-ok' : k.ok === false ? 'kicon-bad' : 'kicon-unsure';
  const glyph = k.ok === true ? '✓' : k.ok === false ? '✗' : '?';
  const src = listing.kitchenSource ? ` (${listing.kitchenSource})` : '';
  return (
    <span className={`kicon ${cls}`} title={`${k.label}${src}`}>
      <span aria-hidden>{glyph}</span> {k.short}
    </span>
  );
}

export function ListingTable({ listings, scores, criteria, selectedId, onSelect }: Props) {
  const selRef = useRef<HTMLTableRowElement>(null);
  useEffect(() => {
    selRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  return (
    <div className="table-wrap">
      <table className="listings">
        <thead>
          <tr>
            <th>Tier</th>
            <th className="num">Score</th>
            <th>Address</th>
            <th>Area</th>
            <th className="num">Price</th>
            <th className="num">Beds</th>
            <th>Floor</th>
            <th>Kitchen</th>
            <th className="num">Sq ft</th>
            <th className="num" title="Narrower dimension of bedroom 2">Bed 2 w</th>
          </tr>
        </thead>
        <tbody>
          {listings.map((l) => {
            const s = scores.get(l.id);
            const sq = effectiveSqft(l);
            const mismatch = sqftMismatch(l);
            const narrow = l.bed2WidthM != null && l.bed2WidthM < criteria.bed2MinWidthM;
            const small = sq != null && sq < criteria.minSqftHard;
            const sel = l.id === selectedId;
            return (
              <tr
                key={l.id}
                ref={sel ? selRef : undefined}
                className={`${sel ? 'selected' : ''} ${isInactive(l) ? 'inactive' : ''}`}
                onClick={() => onSelect(l.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(l.id);
                  }
                }}
                tabIndex={0}
                aria-selected={sel}
              >
                <td>{s && <TierChip tier={s.tier} />}</td>
                <td className="num score">{s ? Math.round(s.total) : '—'}</td>
                <td className="addr">
                  <div>
                    {l.benchmark && (
                      <span className="star" title="Benchmark">
                        ★
                      </span>
                    )}
                    {l.address}
                    {l.position && <span className="pos">{l.position}</span>}
                  </div>
                  <div className="badges">
                    {!hasLocation(l) && <span className="badge">no location</span>}
                    {isInactive(l) && <span className="badge warn">{statusLabel(l.status)}</span>}
                    {l.excludedReason && <span className="badge bad">{l.excludedReason}</span>}
                  </div>
                </td>
                <td>{l.area ? criteria.areas[l.area]?.name ?? l.area : <span className="muted">—</span>}</td>
                <td className="num">
                  {money(l.price)}
                  {l.qualifier && <div className="muted small">{qualifierShort(l.qualifier)}</div>}
                </td>
                <td className="num">{l.beds ?? '?'}</td>
                <td>
                  <span className={`floor floor-${l.floor ?? 'x'}`}>{floorLabel(l.floor)}</span>
                </td>
                <td>
                  <KitchenIcon listing={l} />
                </td>
                <td className={`num ${small ? 'bad-text' : ''}`}>
                  {sq ?? '—'}
                  {mismatch && (
                    <span
                      className="flag"
                      title={`Floorplan ${l.sqftFloorplan} vs listing ${l.sqftListing} sq ft (>5% gap; trusting floorplan)`}
                    >
                      ≠
                    </span>
                  )}
                </td>
                <td className={`num ${narrow ? 'bad-text' : ''}`} title={narrow ? 'Narrower than a proper double' : undefined}>
                  {l.bed2WidthM != null ? `${l.bed2WidthM.toFixed(2)} m` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
