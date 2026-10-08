import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import JourneyPlannerPage from './JourneyPlannerPage';
import { journeyPlannerApi } from '../services/journeyPlannerApi';
import { searchAddresses } from '../services/geocodingService';
vi.mock('../services/geocodingService', () => ({ searchAddresses: vi.fn() }));

// Leaflet lifecycle and drawing are covered in JourneyMap.test.jsx.
vi.mock('../components/journey-planner/JourneyMap', () => ({
  default: ({ journey, position, destination }) => (
    <div
      role="region"
      aria-label="Bản đồ lộ trình Hà Nội"
      data-route={journey?.route_id || ''}
      data-latitude={position?.latitude ?? ''}
      data-longitude={position?.longitude ?? ''}
      data-destination={destination?.id ?? ''}
      data-destination-latitude={destination?.latitude ?? ''}
      data-destination-longitude={destination?.longitude ?? ''}
    />
  ),
}));

vi.mock('../services/journeyPlannerApi', () => ({
  journeyPlannerApi: {
    places: vi.fn(),
    search: vi.fn(),
    detail: vi.fn(),
    tracking: vi.fn(),
    startTracking: vi.fn(),
    endTracking: vi.fn(),
  },
}));
const place = {
  id: '2',
  code: 'HN-TT',
  name: 'Tràng Thi',
  address: 'Phố Tràng Thi, Hà Nội',
  latitude: 21.02655,
  longitude: 105.84968,
};
const position = {
  coords: { latitude: 21.02, longitude: 105.84, accuracy: 50 },
};
const props = {
  initialLocationMode: 'device',
  user: { full_name: 'Hành khách' },
  onLogout: vi.fn(),
  logoutBusy: false,
  logoutError: '',
};
const originalGeolocation = navigator.geolocation;
const locate = vi.fn();
const journeys = {
  max_walking_distance_m: 2000,
  items: [
    {
      route_id: '1',
      route_code: '02',
      route_name: 'Bác Cổ tới Yên Nghĩa',
      fare_vnd: 7000,
      walking_distance_m: 200,
      walking_minutes: 3,
      wait_minutes: 3,
      ride_minutes: 9,
      total_minutes: 15,
      boarding_station: { id: '1', name: 'Bác Cổ' },
      pickup_at: '2035-01-01T01:06:00Z',
    },
    {
      route_id: '2',
      route_code: '26',
      route_name: 'Mai Động tới Mỹ Đình',
      fare_vnd: 8000,
      walking_distance_m: 350,
      walking_minutes: 5,
      wait_minutes: 6,
      ride_minutes: 7,
      total_minutes: 18,
      boarding_station: { id: '3', name: 'Mai Động' },
      pickup_at: '2035-01-01T01:11:00Z',
    },
  ],
};

function detailFor(routeId) {
  return {
    ...journeys.items.find((item) => item.route_id === routeId),
    schedule_id: `schedule-${routeId}`,
    alighting_station: place,
    stop_count: 3,
    walking_after_m: 0,
    walking_after_minutes: 0,
  };
}

function trackingFor() {
  return {
    id: 'tracking-1',
    origin: { latitude: 21.02, longitude: 105.84 },
    journey: detailFor('1'),
    step: 1,
    pickup_in_seconds: 360,
    arrival_in_seconds: 900,
    arrival_at: '2035-01-01T01:15:00Z',
    simulated: true,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: locate },
  });
  locate.mockImplementation((success) => success(position));
  journeyPlannerApi.places.mockResolvedValue({ items: [place], total: 1 });
  journeyPlannerApi.search.mockResolvedValue(journeys);
  journeyPlannerApi.tracking.mockResolvedValue({ active: null });
  journeyPlannerApi.startTracking.mockResolvedValue({ active: trackingFor() });
  journeyPlannerApi.endTracking.mockResolvedValue({ ended: true });
  journeyPlannerApi.detail.mockImplementation(async (_, __, routeId) =>
    detailFor(routeId),
  );
});

describe('Journey search results', () => {
  it('defaults to a labeled demo position without requesting geolocation', async () => {
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} initialLocationMode={undefined} />);
    expect(screen.getByLabelText('Điểm đi')).toHaveValue('Vị trí của bạn');
    expect(locate).not.toHaveBeenCalled();
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    expect(journeyPlannerApi.search).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 21.004,
        longitude: 105.8195,
        isDemo: true,
      }),
      '2',
      expect.any(AbortSignal),
    );
    await screen.findByRole('button', { name: /Tuyến 02/ });
    await actor.click(
      screen.getByRole('button', { name: 'Dùng vị trí hiện tại' }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Điểm đi')).toHaveValue(
        'Vị trí hiện tại của bạn',
      ),
    );
    expect(
      screen.queryByRole('button', { name: /Tuyến 02/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
  });

  it('uses the dropdown fallback while an older GPS request is pending and ignores its late response', async () => {
    let finish;
    locate
      .mockImplementationOnce((success) => {
        finish = success;
      })
      .mockImplementationOnce((_, failure) => failure({ code: 1 }));
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} initialLocationMode="demo" />);
    await actor.click(
      screen.getByRole('button', { name: 'Dùng vị trí hiện tại' }),
    );
    await actor.click(screen.getByRole('combobox', { name: 'Điểm đi' }));
    await actor.click(
      screen.getByRole('option', { name: 'Dùng vị trí hiện tại của tôi' }),
    );
    await act(async () => finish(position));
    expect(screen.getByLabelText('Điểm đi')).toHaveValue('Vị trí của bạn');
  });
  it('keeps cards unselected until clicked and preserves selection after the pointer leaves', async () => {
    let finish;
    journeyPlannerApi.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    expect(
      screen.getByRole('heading', { name: 'Đang tìm tuyến phù hợp' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: 'Đang tìm tuyến phù hợp' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
    expect(screen.getByLabelText('Điểm đi')).toHaveValue(
      'Vị trí hiện tại của bạn',
    );
    expect(journeyPlannerApi.search).toHaveBeenCalledWith(
      { latitude: 21.02, longitude: 105.84, accuracy: 50 },
      '2',
      expect.any(AbortSignal),
    );
    await act(async () => finish(journeys));
    expect(
      screen.getByRole('heading', { name: 'Lộ trình dành cho bạn' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('status', { name: 'Đang tìm tuyến phù hợp' }),
    ).not.toBeInTheDocument();
    const first = screen.getByRole('button', { name: /Tuyến 02/ });
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /Tuyến 26/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-route', '');
    await actor.hover(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    await actor.unhover(first);
    expect(first).toHaveAttribute('aria-pressed', 'false');
    expect(first).toHaveTextContent('7.000đ');
    expect(first).toHaveTextContent('15 phút');
    expect(first).toHaveTextContent('Chờ 3 phút');
    expect(first).toHaveTextContent('Đi bộ 200 m');
    expect(first).toHaveAttribute(
      'title',
      expect.stringContaining('Lên tại Bác Cổ'),
    );
    await actor.click(first);
    await screen.findByText('Đi bộ đến Bác Cổ');
    expect(
      screen.getByRole('heading', { name: 'Chi tiết tuyến 02' }),
    ).toBeVisible();
    expect(screen.getByText('7.000đ / lượt')).toBeVisible();
    expect(screen.getByText('3 điểm dừng · Đi xe 9 phút')).toBeVisible();
    expect(screen.getByText('Điểm đến ngay tại bến · 0 m')).toBeVisible();
    expect(journeyPlannerApi.detail).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 21.02, longitude: 105.84 }),
      '2',
      '1',
      expect.any(AbortSignal),
    );
    await actor.click(
      screen.getByRole('button', { name: /Quay lại các tuyến/ }),
    );
    expect(screen.getByRole('button', { name: /Tuyến 02/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const second = screen.getByRole('button', { name: /Tuyến 26/ });
    await actor.click(second);
    await screen.findByText('Đi bộ đến Mai Động');
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-route', '2');
    expect(screen.getByText('Chi tiết tuyến 26')).toBeInTheDocument();
    await actor.click(
      screen.getByRole('button', { name: /Quay lại các tuyến/ }),
    );
    expect(screen.getByRole('button', { name: /Tuyến 26/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /Tuyến 02/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await actor.click(screen.getByRole('button', { name: 'Tìm lại lộ trình' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Tuyến 02/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      ),
    );
    expect(screen.getByRole('button', { name: /Tuyến 26/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  it('starts tracking, returns to detail, cancels the end dialog and confirms back to refreshed suggestions', async () => {
    let finish;
    journeyPlannerApi.detail.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          finish = reject;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    await actor.click(await screen.findByRole('button', { name: /Tuyến 02/ }));
    expect(
      screen.getByRole('heading', { name: 'Chi tiết tuyến 02' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Bắt đầu hành trình' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeVisible();
    await act(async () =>
      finish(new Error('Tuyến không còn chuyến đón phù hợp')),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'không còn chuyến',
    );
    await actor.click(screen.getByRole('button', { name: 'Thử lại chi tiết' }));
    await actor.click(
      await screen.findByRole('button', { name: 'Bắt đầu hành trình' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Đang theo dõi hành trình' }),
    ).toBeVisible();
    expect(screen.getByText('Bước 1 / 4 · Đi đến điểm dừng')).toBeVisible();
    expect(screen.getByText('6 phút')).toBeVisible();
    expect(screen.getByText('Dự kiến đến nơi · 08:15')).toBeVisible();
    await actor.click(
      screen.getByRole('button', { name: 'Mua vé', exact: true }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await actor.click(
      screen.getByRole('button', { name: 'Xem chi tiết hành trình' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Chi tiết tuyến 02' }),
    ).toBeVisible();
    await actor.click(
      screen.getByRole('button', { name: 'Tiếp tục hành trình' }),
    );
    expect(journeyPlannerApi.startTracking).toHaveBeenCalledTimes(1);
    await actor.click(
      screen.getByRole('button', { name: 'Kết thúc hành trình' }),
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Kết thúc theo dõi hành trình?',
    });
    await actor.click(
      within(dialog).getByRole('button', { name: 'Tiếp tục hành trình' }),
    );
    expect(journeyPlannerApi.endTracking).not.toHaveBeenCalled();
    await actor.click(
      screen.getByRole('button', { name: 'Kết thúc hành trình' }),
    );
    await actor.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Kết thúc',
        exact: true,
      }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Lộ trình dành cho bạn' }),
    ).toBeVisible();
    expect(journeyPlannerApi.endTracking).toHaveBeenCalledWith('tracking-1');
    expect(journeyPlannerApi.search).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Điểm đến')).toHaveValue(place.name);
    expect(screen.getByRole('button', { name: /Tuyến 02/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('restores tracking after reload and keeps the dialog open when ending fails', async () => {
    journeyPlannerApi.tracking.mockResolvedValue({ active: trackingFor() });
    journeyPlannerApi.endTracking.mockRejectedValueOnce(
      new Error('Không thể kết thúc lúc này'),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await screen.findByRole('heading', { name: 'Đang theo dõi hành trình' });
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-route', '1');
    expect(journeyPlannerApi.startTracking).not.toHaveBeenCalled();
    await actor.click(
      screen.getByRole('button', { name: 'Kết thúc hành trình' }),
    );
    await actor.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Kết thúc',
        exact: true,
      }),
    );
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent('Không thể kết thúc');
    expect(journeyPlannerApi.search).not.toHaveBeenCalled();
    await actor.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Đóng hộp thoại',
      }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Đang theo dõi hành trình' }),
    ).toBeVisible();
  });
  it('keeps details visible on start failure and allows retry', async () => {
    journeyPlannerApi.startTracking.mockRejectedValueOnce(
      new Error('Chuyến không còn đón được'),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    await actor.click(await screen.findByRole('button', { name: /Tuyến 02/ }));
    await actor.click(
      await screen.findByRole('button', { name: 'Bắt đầu hành trình' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chuyến không còn đón được',
    );
    expect(
      screen.getByRole('heading', { name: 'Chi tiết tuyến 02' }),
    ).toBeVisible();
    await actor.click(
      screen.getByRole('button', { name: 'Bắt đầu hành trình' }),
    );
    await screen.findByRole('heading', { name: 'Đang theo dõi hành trình' });
  });
  it('refreshes a route when reopened instead of showing its previous schedule', async () => {
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    await actor.click(await screen.findByRole('button', { name: /Tuyến 02/ }));
    await screen.findByText('Đi bộ đến Bác Cổ');
    await actor.click(
      screen.getByRole('button', { name: /Quay lại các tuyến/ }),
    );
    let finish;
    journeyPlannerApi.detail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await actor.click(screen.getByRole('button', { name: /Tuyến 02/ }));
    expect(
      screen.getByRole('status', { name: 'Đang tải chi tiết tuyến' }),
    ).toBeVisible();
    expect(screen.queryByText('Đi bộ đến Bác Cổ')).not.toBeInTheDocument();
    await act(async () =>
      finish({ ...detailFor('1'), wait_minutes: 1, total_minutes: 13 }),
    );
    expect(screen.getByText('13 phút')).toBeVisible();
  });
  it('ignores old route detail when another route is selected', async () => {
    let finish;
    journeyPlannerApi.detail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    await actor.click(await screen.findByRole('button', { name: /Tuyến 02/ }));
    const signal = journeyPlannerApi.detail.mock.calls[0][3];
    await actor.click(
      screen.getByRole('button', { name: /Quay lại các tuyến/ }),
    );
    await actor.click(screen.getByRole('button', { name: /Tuyến 26/ }));
    await screen.findByText('Đi bộ đến Mai Động');
    expect(signal.aborted).toBe(true);
    await act(async () => finish(detailFor('1')));
    expect(
      screen.getByRole('heading', { name: 'Chi tiết tuyến 26' }),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-route', '2');
  });
  it('shows distinct empty and failure states with working retry', async () => {
    journeyPlannerApi.search
      .mockRejectedValueOnce(new Error('Mất kết nối máy chủ'))
      .mockResolvedValueOnce({ items: [], max_walking_distance_m: 2000 });
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mất kết nối máy chủ',
    );
    expect(
      screen.queryByText('Chưa có lộ trình phù hợp'),
    ).not.toBeInTheDocument();
    await actor.click(
      screen.getByRole('button', { name: 'Thử lại tìm lộ trình' }),
    );
    expect(
      await screen.findByText('Chưa có lộ trình phù hợp'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
    await actor.click(screen.getByRole('button', { name: 'Tìm lại lộ trình' }));
    expect(
      await screen.findByRole('button', { name: /Tuyến 02/ }),
    ).toBeInTheDocument();
  });
  it('aborts and ignores a stale journey response after changing the destination', async () => {
    let finish;
    journeyPlannerApi.search.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    const signal = journeyPlannerApi.search.mock.calls[0][2];
    await actor.click(screen.getByRole('button', { name: 'Xóa điểm đến' }));
    expect(signal.aborted).toBe(true);
    await act(async () => finish(journeys));
    expect(
      screen.queryByRole('button', { name: /Tuyến 02/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
  });
  it('clears routes when updating location and cancels a pending search on unmount', async () => {
    const actor = userEvent.setup();
    const view = render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    await screen.findByRole('button', { name: /Tuyến 02/ });
    await actor.click(
      screen.getByRole('button', { name: 'Lấy lại vị trí của tôi' }),
    );
    expect(
      screen.queryByRole('button', { name: /Tuyến 02/ }),
    ).not.toBeInTheDocument();
    journeyPlannerApi.search.mockImplementationOnce(
      () => new Promise(() => {}),
    );
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    const signal = journeyPlannerApi.search.mock.calls[1][2];
    view.unmount();
    expect(signal.aborted).toBe(true);
  });
});
afterAll(() =>
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  }),
);

async function selectDestination(actor) {
  await actor.type(screen.getByRole('combobox', { name: 'Điểm đến' }), 'tràng');
  await actor.click(await screen.findByRole('option', { name: /Tràng Thi/ }));
}

describe('Journey planner destination selection', () => {
  it('uses a selected free address for markers and journey search, then invalidates it when edited', async () => {
    const actor = userEvent.setup();
    const address = {
      name: 'Hồ Gươm, Hà Nội',
      latitude: 21.028,
      longitude: 105.852,
    };
    searchAddresses.mockResolvedValue([address]);
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    const input = screen.getByRole('combobox', { name: 'Điểm đi' });
    await actor.clear(input);
    await actor.type(input, 'Hồ Gươm');
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    expect(searchAddresses).not.toHaveBeenCalled();
    await actor.keyboard('{Enter}');
    await actor.click(
      await screen.findByRole('option', { name: /Hồ Gươm, Hà Nội/ }),
    );
    expect(input).toHaveValue(address.name);
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-latitude', '21.028');
    await actor.click(screen.getByRole('button', { name: 'Tìm lộ trình' }));
    expect(journeyPlannerApi.search).toHaveBeenLastCalledWith(
      expect.objectContaining(address),
      '2',
      expect.any(AbortSignal),
    );
    await screen.findByRole('button', { name: /Tuyến 02/ });
    await actor.type(input, ' mới');
    expect(
      screen.queryByRole('button', { name: /Tuyến 02/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
  });

  it('selects a database origin with the keyboard and ignores a late GPS response', async () => {
    let finish;
    locate.mockImplementation((success) => {
      finish = success;
    });
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    const input = screen.getByRole('combobox', { name: 'Điểm đi' });
    await actor.type(input, 'tràng');
    await screen.findByRole('option', { name: /Tràng Thi/ });
    await actor.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await act(async () => finish(position));
    expect(input).toHaveValue(place.name);
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-latitude', String(place.latitude));
  });

  it('offers current location at the top and falls back to the default if GPS is denied', async () => {
    locate.mockImplementation((_, failure) => failure({ code: 1 }));
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} initialLocationMode="demo" />);
    await actor.click(screen.getByRole('combobox', { name: 'Điểm đi' }));
    expect(screen.getByLabelText('Điểm đi')).toHaveValue('');
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-latitude', '');
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Dùng vị trí hiện tại của tôi');
    await actor.click(options[0]);
    await waitFor(() =>
      expect(screen.getByLabelText('Điểm đi')).toHaveValue('Vị trí của bạn'),
    );
    expect(locate).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' }),
    ).toHaveAttribute('data-longitude', '105.8195');
    await actor.click(screen.getByRole('combobox', { name: 'Điểm đi' }));
    expect(screen.getByLabelText('Điểm đi')).toHaveValue('');
    await actor.type(screen.getByLabelText('Điểm đi'), 'Ngã Tư Sở');
    expect(screen.getByLabelText('Điểm đi')).toHaveValue('Ngã Tư Sở');
  });

  it('discards a delayed address response after the input changes', async () => {
    let finish;
    searchAddresses.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    const input = screen.getByRole('combobox', { name: 'Điểm đi' });
    await actor.clear(input);
    await actor.type(input, 'Hồ Gươm{Enter}');
    const signal = searchAddresses.mock.calls[0][1];
    await actor.clear(input);
    await actor.type(input, 'Bách Khoa');
    await act(async () =>
      finish([
        { name: 'Kết quả địa chỉ cũ', latitude: 21.028, longitude: 105.852 },
      ]),
    );
    expect(signal.aborted).toBe(true);
    expect(screen.queryByText('Kết quả địa chỉ cũ')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
  });
  it('fills current origin and selected destination, enabling only a complete selection', async () => {
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    const button = screen.getByRole('button', { name: 'Tìm lộ trình' });
    await waitFor(() =>
      expect(screen.getByLabelText('Điểm đi')).toHaveValue(
        'Vị trí hiện tại của bạn',
      ),
    );
    expect(screen.getByLabelText('Điểm đi')).not.toHaveAttribute('readonly');
    const sidebar = screen.getByRole('complementary', {
      name: 'Điểm đi và điểm đến',
    });
    expect(within(sidebar).getAllByRole('combobox')).toHaveLength(2);
    expect(
      within(sidebar).getByRole('combobox', { name: 'Điểm đến' }),
    ).not.toHaveAttribute('readonly');
    expect(
      within(
        screen.getByRole('region', { name: 'Khu vực bản đồ' }),
      ).queryByRole('combobox'),
    ).not.toBeInTheDocument();
    expect(button).toBeDisabled();
    await actor.type(
      screen.getByRole('combobox', { name: 'Điểm đến' }),
      'tràng',
    );
    await screen.findByRole('option', { name: /Tràng Thi/ });
    expect(button).toBeDisabled();
    await actor.click(screen.getByRole('option', { name: /Tràng Thi/ }));
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
    const map = screen.getByRole('region', { name: 'Bản đồ lộ trình Hà Nội' });
    expect(map).toHaveAttribute('data-destination', place.id);
    expect(map).toHaveAttribute(
      'data-destination-latitude',
      String(place.latitude),
    );
    expect(map).toHaveAttribute(
      'data-destination-longitude',
      String(place.longitude),
    );
    expect(button).toBeEnabled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Xóa điểm đến' }));
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('');
    expect(map).toHaveAttribute('data-destination', '');
    expect(button).toBeDisabled();
  });
  it('waits for actual coordinates even after selecting a destination', async () => {
    let success;
    locate.mockImplementation((callback) => {
      success = callback;
    });
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await selectDestination(actor);
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    await act(async () => success(position));
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeEnabled();
  });
  it('shows location permission errors, preserves the destination and permits retry', async () => {
    locate.mockImplementationOnce((_, error) => error({ code: 1 }));
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('chưa cho phép');
    await selectDestination(actor);
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    await actor.click(
      screen.getByRole('button', { name: 'Lấy lại vị trí của tôi' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeEnabled();
  });
  it('supports keyboard selection and invalidates the selection when edited', async () => {
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await actor.type(
      screen.getByRole('combobox', { name: 'Điểm đến' }),
      'tràng',
    );
    await screen.findByRole('option');
    await actor.keyboard('{ArrowDown}{Enter}');
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi');
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeEnabled();
    await actor.type(
      screen.getByRole('combobox', { name: 'Điểm đến' }),
      ' khác',
    );
    expect(screen.getByLabelText('Điểm đến')).toHaveValue('Tràng Thi khác');
    expect(screen.getByRole('button', { name: 'Tìm lộ trình' })).toBeDisabled();
    await actor.keyboard('{Escape}');
    expect(screen.getByRole('combobox', { name: 'Điểm đến' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
  it('handles empty results and a retryable API failure', async () => {
    journeyPlannerApi.places
      .mockResolvedValueOnce({ items: [], total: 0 })
      .mockRejectedValueOnce(new Error('Không kết nối được máy chủ'));
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await actor.type(screen.getByRole('combobox', { name: 'Điểm đến' }), 'xyz');
    await screen.findByText(/Không tìm thấy địa điểm phù hợp/);
    await actor.clear(screen.getByRole('combobox', { name: 'Điểm đến' }));
    await actor.type(
      screen.getByRole('combobox', { name: 'Điểm đến' }),
      'tràng',
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Không kết nối');
    await actor.click(screen.getByRole('button', { name: 'Thử lại tìm kiếm' }));
    await screen.findByRole('option', { name: /Tràng Thi/ });
  });
  it('ignores stale results after typing a new search and also handles whitespace edits', async () => {
    let resolveOld;
    journeyPlannerApi.places.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    const actor = userEvent.setup();
    render(<JourneyPlannerPage {...props} />);
    await actor.type(screen.getByRole('combobox', { name: 'Điểm đến' }), 'old');
    await waitFor(() =>
      expect(journeyPlannerApi.places).toHaveBeenCalledTimes(1),
    );
    const oldSignal = journeyPlannerApi.places.mock.calls[0][1];
    await actor.clear(screen.getByRole('combobox', { name: 'Điểm đến' }));
    await actor.type(
      screen.getByRole('combobox', { name: 'Điểm đến' }),
      'tràng',
    );
    await screen.findByRole('option', { name: /Tràng Thi/ });
    await act(async () =>
      resolveOld({ items: [{ ...place, name: 'Kết quả cũ' }], total: 1 }),
    );
    expect(oldSignal.aborted).toBe(true);
    expect(screen.queryByText('Kết quả cũ')).not.toBeInTheDocument();
    await actor.type(screen.getByRole('combobox', { name: 'Điểm đến' }), ' ');
    await screen.findByRole('option', { name: /Tràng Thi/ });
  });
});
