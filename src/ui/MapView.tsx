import { Fragment, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import type { Listing, Score } from '../types';
import { floorLabel, money } from './format';

const GLASGOW: [number, number] = [55.855, -4.27];

interface Props {
  listings: Listing[];
  scores: Map<string, Score>;
  selectedId: string | null;
  panRequest: number; // bumps when the list asks the map to pan
  onSelect: (id: string) => void;
}

function PanTo({ listing, panRequest }: { listing: Listing | undefined; panRequest: number }) {
  const map = useMap();
  useEffect(() => {
    if (!listing || listing.lat == null || listing.lng == null || panRequest === 0) return;
    map.flyTo([listing.lat, listing.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
    // Only react to explicit pan requests, not every re-render of the listing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panRequest]);
  return null;
}

/** Keep Leaflet in sync when the container changes size (drawer open, window resize). */
function AutoResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export function MapView({ listings, scores, selectedId, panRequest, onSelect }: Props) {
  const located = listings.filter((l) => l.lat != null && l.lng != null);
  // Draw failures first so stronger listings sit on top; selected last of all.
  const order = ['Fails', 'Possible', 'Strong', 'Perfect'];
  located.sort((a, b) => {
    if (a.id === selectedId) return 1;
    if (b.id === selectedId) return -1;
    return order.indexOf(scores.get(a.id)?.tier ?? 'Possible') - order.indexOf(scores.get(b.id)?.tier ?? 'Possible');
  });
  const selected = listings.find((l) => l.id === selectedId);

  return (
    <MapContainer center={GLASGOW} zoom={12} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {located.map((l) => {
        const s = scores.get(l.id);
        const tier = s?.tier ?? 'Possible';
        const isSel = l.id === selectedId;
        const pos: [number, number] = [l.lat!, l.lng!];
        return (
          // Leaflet ignores className changes after creation, so remount when tier/selection changes.
          // className is a direct prop (not in pathOptions) so it is set when the path is created.
          <Fragment key={`${l.id}:${tier}:${isSel}:${l.benchmark}`}>
            {l.benchmark && (
              <CircleMarker
                center={pos}
                radius={isSel ? 16 : 13}
                interactive={false}
                className="benchmark-ring"
                pathOptions={{ fill: false, weight: 2, dashArray: '3 3' }}
              />
            )}
            <CircleMarker
              center={pos}
              radius={isSel ? 10 : 7}
              className={`tier-${tier}${isSel ? ' is-selected' : ''}`}
              pathOptions={{ weight: isSel ? 3 : 1.5, fillOpacity: 0.9 }}
              eventHandlers={{ click: () => onSelect(l.id) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <strong>{l.address}</strong>
                {l.position ? ` ${l.position}` : ''}
                <br />
                {money(l.price)} · {l.beds ?? '?'} bed · floor {floorLabel(l.floor)} · {tier} {s ? Math.round(s.total) : ''}
                {l.benchmark ? ' · benchmark' : ''}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
      <PanTo listing={selected} panRequest={panRequest} />
      <AutoResize />
    </MapContainer>
  );
}
