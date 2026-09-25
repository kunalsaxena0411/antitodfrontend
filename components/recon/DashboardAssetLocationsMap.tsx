import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AssetLocation } from '../../api/services/openasmClient';

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) {
      map.setView([20, 0], 2);
      return;
    }
    if (points.length === 1) {
      map.setView(points[0], 4);
      return;
    }
    const b = L.latLngBounds(points);
    map.fitBounds(b, { padding: [28, 28], maxZoom: 6 });
  }, [map, points]);
  return null;
}

export const DashboardAssetLocationsMap: React.FC<{ locations: AssetLocation[] }> = ({ locations }) => {
  const items = locations
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)));
  const pts = items.map(({ p }) => [Number(p.lat), Number(p.lon)] as [number, number]);
  const center: [number, number] = pts[0] ?? [20, 0];

  return (
    <MapContainer center={center} zoom={2} className="h-full w-full min-h-[240px] z-0 rounded-lg" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
      />
      <FitBounds points={pts} />
      {items.map(({ p, idx }) => (
        <CircleMarker
          key={`${String(p.query ?? p.country ?? 'pt')}-${idx}`}
          center={[Number(p.lat), Number(p.lon)]}
          radius={7}
          pathOptions={{ color: '#22d3ee', weight: 2, fillColor: '#22d3ee', fillOpacity: 0.82 }}
        >
          <Popup>
            <div className="text-xs text-gray-900 font-sans">
              <div className="font-semibold">{String(p.query ?? '—')}</div>
              <div className="text-gray-600">{[p.city, p.country].filter(Boolean).join(', ') || '—'}</div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
};
