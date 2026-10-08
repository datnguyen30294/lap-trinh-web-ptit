import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useRouteMap } from './useRouteMap';
import './journey-map.css';

const HANOI = [21.0285, 105.8542];
const latLng = (point) => [point.latitude, point.longitude];
const markerIcon = (label) =>
  L.divIcon({
    className: `jp-map-marker jp-map-marker-${label.toLowerCase()}`,
    html: `<span>${label}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

// Leaflet treats strings as HTML. Use textContent for database names instead.
function popup(text) {
  const element = document.createElement('span');
  element.textContent = text;
  return element;
}

export default function JourneyMap({
  position,
  destination,
  journey,
  alternatives,
}) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const tilesRef = useRef(null);
  const boundsRef = useRef(null);
  const [tileError, setTileError] = useState(false);
  const road = useRouteMap(journey, destination, alternatives);
  const geometry = road.status === 'success' ? road.data : null;
  const routeColor = journey?.route_code?.startsWith('BRT')
    ? '#b45309'
    : journey?.route_code?.startsWith('26')
      ? '#7c3aed'
      : '#2474db';
  const approximate = geometry?.source === 'straight-line';

  useEffect(() => {
    const map = L.map(container.current, { zoomControl: false }).setView(
      HANOI,
      14,
    );
    mapRef.current = map;
    L.control.zoom({ position: 'topright' }).addTo(map);
    const tiles = L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
      {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 20,
        keepBuffer: 3,
        updateWhenIdle: true,
        updateWhenZooming: false,
        attribution:
          '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a> | Địa chỉ &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      },
    ).addTo(map);
    tilesRef.current = tiles;
    let failed = false;
    tiles.on('loading', () => {
      failed = false;
    });
    tiles.on('tileerror', () => {
      failed = true;
      setTileError(true);
    });
    tiles.on('load', () => setTileError(failed));
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      map.remove();
      mapRef.current = null;
      tilesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    boundsRef.current = null;
    if (position)
      L.marker(latLng(position), { icon: markerIcon('A') })
        .bindPopup(popup(position.label || 'Điểm đi: Vị trí hiện tại của bạn'))
        .addTo(layer);
    if (!geometry) {
      if (position && destination) {
        const bounds = L.latLngBounds([latLng(position), latLng(destination)]);
        boundsRef.current = bounds;
        map.fitBounds(bounds, {
          padding: [65, 100],
          maxZoom: 16,
          animate: false,
        });
      } else if (position || destination) {
        map.setView(latLng(position || destination), 14);
      }
    }
    if (destination)
      L.marker(latLng(destination), { icon: markerIcon('B') })
        .bindPopup(popup(`Điểm đến: ${destination.name}`))
        .addTo(layer);
    if (geometry) {
      // GeoJSON uses longitude first; Leaflet's polyline uses latitude first.
      const points = geometry.geometry.coordinates.map(([lon, lat]) => [
        lat,
        lon,
      ]);
      L.polyline(points, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(
        layer,
      );
      L.polyline(points, {
        color: routeColor,
        weight: 5,
        ...(approximate ? { dashArray: '8 8' } : {}),
      }).addTo(layer);
      geometry.stops.forEach((stop, index) => {
        L.circleMarker(latLng(stop), {
          radius: index === 0 ? 6 : 4,
          color: routeColor,
          weight: 2,
          fillColor: '#fff',
          fillOpacity: 1,
        })
          .bindPopup(
            popup(`${index === 0 ? 'Bến lên xe' : 'Bến dừng'}: ${stop.name}`),
          )
          .addTo(layer);
      });
      if (position)
        L.polyline([latLng(position), latLng(geometry.stops[0])], {
          color: '#687c74',
          weight: 3,
          dashArray: '5 7',
        })
          .bindPopup(
            popup(
              'Kết nối tới bến theo đường chim bay, chưa phải chỉ dẫn đi bộ.',
            ),
          )
          .addTo(layer);
      const bounds = L.latLngBounds(points);
      if (position) bounds.extend(latLng(position));
      if (destination) bounds.extend(latLng(destination));
      boundsRef.current = bounds;
      map.fitBounds(bounds, {
        paddingTopLeft: [40, 100],
        paddingBottomRight: [55, 70],
        maxZoom: 16,
        animate: false,
      });
    }
    return () => {
      layer.remove();
    };
  }, [position, destination, geometry, routeColor, approximate]);

  return (
    <div className="jp-map-shell">
      <div
        ref={container}
        className="jp-map-canvas"
        role="region"
        aria-label="Bản đồ lộ trình Hà Nội"
      />
      <div className="jp-map-actions">
        <button
          type="button"
          title="Về vị trí của tôi"
          aria-label="Về vị trí của tôi"
          disabled={!position}
          onClick={() => mapRef.current?.setView(latLng(position), 16)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
            <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </button>
        <button
          type="button"
          title="Xem trọn tuyến"
          aria-label="Xem trọn tuyến"
          disabled={!geometry}
          onClick={() => {
            if (boundsRef.current)
              mapRef.current?.fitBounds(boundsRef.current, {
                padding: [65, 100],
                maxZoom: 16,
              });
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8l8 8M8 16l8-8" />
          </svg>
        </button>
      </div>
      <div className="jp-map-messages">
        {approximate && (
          <div className="jp-map-message" role="status">
            <p>Đường nối bến tạm thời, chưa phải đường đi theo đường phố.</p>
            <button type="button" onClick={road.retry}>
              Thử tải đường phố
            </button>
          </div>
        )}
        {road.status === 'loading' && (
          <p className="jp-map-message" role="status">
            Đang tải đường đi của tuyến…
          </p>
        )}
        {road.status === 'error' && (
          <div className="jp-map-message" role="alert">
            <p>Chưa tải được đường đi. Các gợi ý lộ trình vẫn dùng được.</p>
            <button type="button" onClick={road.retry}>
              Thử lại đường đi
            </button>
          </div>
        )}
        {tileError && (
          <div className="jp-map-message" role="alert">
            <p>Chưa tải được nền bản đồ. Hãy kiểm tra kết nối Internet.</p>
            <button type="button" onClick={() => tilesRef.current?.redraw()}>
              Tải lại bản đồ
            </button>
          </div>
        )}
      </div>
      <div className="jp-map-legend">
        <span>
          <i className="jp-legend-bus" style={{ borderColor: routeColor }} />{' '}
          Đường xe (tham khảo)
        </span>
        <span>
          <i className="jp-legend-walk" /> Tới bến (ước tính)
        </span>
        <span>A: Đi · B: Đến</span>
      </div>
    </div>
  );
}
