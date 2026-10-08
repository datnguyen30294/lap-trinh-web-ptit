import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import JourneyMap from './JourneyMap';
import { journeyPlannerApi } from '../../services/journeyPlannerApi';

const mock = vi.hoisted(() => {
  const layer = () => ({
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    bindPopup: vi.fn().mockReturnThis(),
  });
  const map = {
    setView: vi.fn().mockReturnThis(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    remove: vi.fn(),
  };
  const events = {};
  const tiles = {
    ...layer(),
    on: vi.fn((event, handler) => {
      events[event] = handler;
    }),
    redraw: vi.fn(),
  };
  return {
    map,
    tiles,
    events,
    api: {
      map: vi.fn(() => map),
      tileLayer: vi.fn(() => tiles),
      control: { zoom: vi.fn(layer) },
      layerGroup: vi.fn(layer),
      divIcon: vi.fn((options) => options),
      marker: vi.fn(layer),
      circleMarker: vi.fn(layer),
      polyline: vi.fn(layer),
      latLngBounds: vi.fn(() => ({ extend: vi.fn().mockReturnThis() })),
    },
  };
});
vi.mock('leaflet', () => ({ default: mock.api }));
vi.mock('../../services/journeyPlannerApi', () => ({
  journeyPlannerApi: { routeMap: vi.fn() },
}));

const position = { latitude: 21.02, longitude: 105.84 };
const destination = {
  id: '3',
  name: '<img src=x onerror=alert(1)>',
  latitude: 21.03,
  longitude: 105.86,
};
const journey = { route_id: '1', boarding_station: { id: '2' } };

it('fits both selected endpoints before routing and moves A after an origin change', () => {
  const view = render(
    <JourneyMap position={position} destination={destination} />,
  );
  expect(mock.api.latLngBounds).toHaveBeenLastCalledWith([
    [21.02, 105.84],
    [21.03, 105.86],
  ]);
  expect(mock.map.fitBounds).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ maxZoom: 16 }),
  );
  view.rerender(
    <JourneyMap
      position={{ latitude: 21.01, longitude: 105.82, label: 'Điểm mới' }}
      destination={destination}
    />,
  );
  expect(mock.api.marker).toHaveBeenCalledWith(
    [21.01, 105.82],
    expect.anything(),
  );
  expect(mock.api.latLngBounds).toHaveBeenLastCalledWith([
    [21.01, 105.82],
    [21.03, 105.86],
  ]);
});
const data = {
  stops: [
    { id: '2', name: 'Bến lên', latitude: 21.021, longitude: 105.841 },
    destination,
  ],
  geometry: {
    type: 'LineString',
    coordinates: [
      [105.841, 21.021],
      [105.85, 21.025],
      [105.86, 21.03],
    ],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  journeyPlannerApi.routeMap.mockResolvedValue(data);
});
afterEach(() => vi.unstubAllGlobals());

it('shows the base map immediately without a position or a selected journey', () => {
  const view = render(<JourneyMap />);
  expect(
    screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
  ).toBeInTheDocument();
  expect(mock.map.setView).toHaveBeenCalledWith([21.0285, 105.8542], 14);
  expect(mock.api.tileLayer.mock.calls[0][0]).toBe(
    'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  );
  expect(journeyPlannerApi.routeMap).not.toHaveBeenCalled();
  expect(mock.api.tileLayer.mock.calls[0][1]).toMatchObject({
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 20,
    keepBuffer: 3,
    updateWhenIdle: true,
    updateWhenZooming: false,
  });
  expect(mock.api.tileLayer.mock.calls[0][1].attribution).toBe(
    '&copy; <a href="https://www.google.com/maps" target="_blank" rel="noreferrer">Google Maps</a> | Địa chỉ &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
  );
  expect(
    screen.getByRole('button', { name: 'Về vị trí của tôi' }),
  ).toBeDisabled();
  view.unmount();
  expect(mock.map.remove).toHaveBeenCalledOnce();
});

it('warms alternatives and switches cached geometry and color without another HTTP request', async () => {
  const brt = {
    route_id: '9',
    route_code: 'BRT01-DI',
    boarding_station: { id: '2' },
  };
  const alternatives = [journey, brt];
  const view = render(
    <JourneyMap
      position={position}
      destination={destination}
      alternatives={alternatives}
    />,
  );
  await waitFor(() =>
    expect(journeyPlannerApi.routeMap).toHaveBeenCalledTimes(2),
  );
  await act(async () => {});
  expect(mock.api.polyline).not.toHaveBeenCalled();
  view.rerender(
    <JourneyMap
      position={position}
      destination={destination}
      journey={brt}
      alternatives={alternatives}
    />,
  );
  expect(mock.api.polyline).toHaveBeenCalledWith(
    expect.any(Array),
    expect.objectContaining({ color: '#b45309' }),
  );
  view.rerender(
    <JourneyMap
      position={position}
      destination={destination}
      journey={journey}
      alternatives={alternatives}
    />,
  );
  expect(journeyPlannerApi.routeMap).toHaveBeenCalledTimes(2);
  expect(mock.api.map).toHaveBeenCalledOnce();
});

it('shows a clearly labeled dashed fallback without a routing error alert', async () => {
  journeyPlannerApi.routeMap.mockResolvedValueOnce({
    ...data,
    source: 'straight-line',
    approximate: true,
  });
  render(
    <JourneyMap
      position={position}
      destination={destination}
      journey={journey}
    />,
  );
  await screen.findByText(/Đường nối bến tạm thời/);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await waitFor(() =>
    expect(mock.api.polyline).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ dashArray: '8 8' }),
    ),
  );
});

it('draws the road with correct coordinate order and keeps the map instance on selection changes', async () => {
  const view = render(
    <JourneyMap
      position={position}
      destination={destination}
      journey={journey}
    />,
  );
  await waitFor(() => expect(mock.api.polyline).toHaveBeenCalled());
  expect(journeyPlannerApi.routeMap).toHaveBeenCalledWith(
    '1',
    '2',
    '3',
    expect.any(AbortSignal),
  );
  expect(mock.api.polyline).toHaveBeenCalledWith(
    [
      [21.021, 105.841],
      [21.025, 105.85],
      [21.03, 105.86],
    ],
    expect.objectContaining({ color: '#2474db' }),
  );
  const marker = mock.api.marker.mock.results[1].value;
  const popup = marker.bindPopup.mock.calls[0][0];
  expect(popup.textContent).toContain(destination.name);
  expect(popup.querySelector('img')).toBeNull();
  const priorLayer = mock.api.layerGroup.mock.results.at(-1).value;
  view.rerender(<JourneyMap position={position} destination={destination} />);
  expect(priorLayer.remove).toHaveBeenCalled();
  expect(mock.api.map).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Xem trọn tuyến' })).toBeDisabled();
});

it('ignores delayed road results after changing the selected route', async () => {
  let finish;
  journeyPlannerApi.routeMap.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(
    <JourneyMap
      position={position}
      destination={destination}
      journey={journey}
    />,
  );
  const signal = journeyPlannerApi.routeMap.mock.calls[0][3];
  view.rerender(
    <JourneyMap
      position={position}
      destination={destination}
      journey={{ ...journey, route_id: '9' }}
    />,
  );
  await waitFor(() => expect(mock.api.polyline).toHaveBeenCalled());
  const fits = mock.map.fitBounds.mock.calls.length;
  await act(async () => finish(data));
  expect(signal.aborted).toBe(true);
  expect(mock.map.fitBounds).toHaveBeenCalledTimes(fits);
});

it('keeps the base map when routing fails and supports road and tile retries', async () => {
  journeyPlannerApi.routeMap.mockRejectedValueOnce(new Error('timeout'));
  const actor = userEvent.setup();
  render(
    <JourneyMap
      position={position}
      destination={destination}
      journey={journey}
    />,
  );
  await actor.click(
    await screen.findByRole('button', { name: 'Thử lại đường đi' }),
  );
  await waitFor(() => expect(mock.map.fitBounds).toHaveBeenCalled());
  expect(
    screen.queryByText(
      'Chưa tải được đường đi. Các gợi ý lộ trình vẫn dùng được.',
    ),
  ).not.toBeInTheDocument();
  await act(async () => mock.events.tileerror());
  await actor.click(screen.getByRole('button', { name: 'Tải lại bản đồ' }));
  expect(mock.tiles.redraw).toHaveBeenCalledOnce();
  expect(mock.api.map).toHaveBeenCalledOnce();
});
