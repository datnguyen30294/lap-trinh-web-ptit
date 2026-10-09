import { beforeEach, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { authApi } from './services/stationsApi';
import { bookingsApi } from './services/bookingsApi';
import { journeyPlannerApi } from './services/journeyPlannerApi';

vi.mock('./services/stationsApi', () => ({
  authApi: { me: vi.fn(), logout: vi.fn() },
}));
vi.mock('./services/passengerApi', () => ({
  passengerApi: {
    stations: vi.fn(async () => [
      { id: '1', code: 'BX01', name: 'Bến đầu' },
      { id: '3', code: 'BX03', name: 'Bến cuối' },
    ]),
    routes: vi.fn(async () => ({ items: [] })),
  },
}));
vi.mock('./services/bookingsApi', () => ({
  bookingsApi: {
    list: vi.fn(async () => ({ items: [], totalPages: 1 })),
    trip: vi.fn(async (id) => ({
      id,
      route_code: `TEST-${id}`,
      from_station: 'Bến đầu',
      to_station: 'Bến cuối',
      remaining: 2,
      capacity: 60,
      unit_price: 8000,
    })),
    create: vi.fn(async () => ({})),
    receipt: vi.fn(async () => [
      {
        id: '20',
        booking_code: 'GBTEST',
        passenger_name: 'Nguyễn An',
        display_status: 'CONFIRMED',
        unit_price: 8000,
        from_station: 'Bến đầu',
        to_station: 'Bến cuối',
      },
    ]),
  },
}));
vi.mock('./services/journeyPlannerApi', () => ({
  journeyPlannerApi: {
    places: vi.fn(),
    search: vi.fn(),
    tracking: vi.fn(),
  },
}));
// Giữ trang lộ trình thật, thay phần vẽ Leaflet trong môi trường jsdom.
vi.mock('./components/journey-planner/JourneyMap', () => ({
  default: () => <div aria-label="Bản đồ hành trình" role="region" />,
}));
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/user/home');
  authApi.me.mockResolvedValue({
    id: '1',
    full_name: 'Người đặt',
    role: 'USER',
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // jsdom không cung cấp cuộn tới phần tử như trình duyệt thật.
  HTMLElement.prototype.scrollIntoView = vi.fn();
  journeyPlannerApi.tracking.mockResolvedValue({ active: null });
  journeyPlannerApi.search.mockResolvedValue({ items: [] });
  journeyPlannerApi.places.mockImplementation(async (code) => ({
    items: [
      {
        id: code === 'BX01' ? '1' : '3',
        name: code === 'BX01' ? 'Bến đầu' : 'Bến cuối',
        code,
        latitude: code === 'BX01' ? 21.02655 : 21.03,
        longitude: 105.84968,
      },
    ],
  }));
});

it.each(['Đặt vé ngay', 'Mua vé'])(
  'carries both home stations into %s',
  async (name) => {
    const actor = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Hành Trình Xanh/ });
    await waitFor(() =>
      expect(screen.getByLabelText('Điểm xuất phát')).toBeEnabled(),
    );
    await actor.click(screen.getByLabelText('Điểm xuất phát'));
    await actor.click(await screen.findByRole('option', { name: /Bến đầu/ }));
    await actor.click(screen.getByLabelText('Điểm đến'));
    await actor.click(
      await screen.findByRole('option', { name: /Bến cuối/ }),
    );
    await actor.click(screen.getByRole('link', { name, exact: true }));
    await screen.findByRole('heading', { name: 'Đặt vé trực tuyến' });
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Điểm đi *' })).toHaveValue(
        'Bến đầu',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Điểm đến *' })).toHaveValue(
      'Bến cuối',
    );
    expect(window.location.search).toBe('?from=1&to=3');
    expect(authApi.me).toHaveBeenCalledTimes(1);
  },
);

it.each([
  ['button', 'Tìm kiếm lộ trình nhanh'],
  ['link', 'Tìm Đường'],
  ['link', 'Lộ trình & Bản đồ'],
])(
  'carries both home stations to the map through %s %s',
  async (role, name) => {
    const actor = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: /Hành Trình Xanh/ });
    await waitFor(() =>
      expect(screen.getByLabelText('Điểm xuất phát')).toBeEnabled(),
    );
    await actor.click(screen.getByLabelText('Điểm xuất phát'));
    await actor.click(await screen.findByRole('option', { name: /Bến đầu/ }));
    await actor.click(screen.getByLabelText('Điểm đến'));
    await actor.click(
      await screen.findByRole('option', { name: /Bến cuối/ }),
    );
    await actor.click(screen.getByRole(role, { name, exact: true }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Điểm đi' })).toHaveValue(
        'Bến đầu',
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Điểm đến' })).toHaveValue(
      'Bến cuối',
    );
    expect(window.location.pathname).toBe('/user/journey-planner');
    expect(journeyPlannerApi.search).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 21.02655, longitude: 105.84968 }),
      '3',
      expect.any(AbortSignal),
    );
    expect(authApi.me).toHaveBeenCalledTimes(1);
  },
);

it('loads new map inputs when navigating between query strings and returning with Back', async () => {
  window.history.replaceState(null, '', '/user/journey-planner?from=1&to=3');
  render(<App />);
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Điểm đi' })).toHaveValue(
      'Bến đầu',
    ),
  );
  act(() => {
    window.history.pushState(null, '', '/user/journey-planner?from=3&to=1');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Điểm đi' })).toHaveValue(
      'Bến cuối',
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Điểm đến' })).toHaveValue(
    'Bến đầu',
  );
  act(() => window.history.back());
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Điểm đi' })).toHaveValue(
      'Bến đầu',
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Điểm đến' })).toHaveValue(
    'Bến cuối',
  );
});

it('opens booking from home without reloading the session and keeps the booking header mounted', async () => {
  const actor = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: /Hành Trình Xanh/ });
  await actor.click(screen.getByRole('link', { name: 'Mua vé' }));
  await screen.findByRole('heading', { name: 'Đặt vé trực tuyến' });
  expect(window.location.pathname).toBe('/user/bookings');
  expect(authApi.me).toHaveBeenCalledTimes(1);
  const header = screen.getByRole('banner');
  expect(
    fireEvent.click(within(header).getByRole('link', { name: 'Mua vé' })),
  ).toBe(false);
  await actor.click(within(header).getByRole('link', { name: 'Vé của tôi' }));
  await screen.findByRole('heading', { name: 'Vé của tôi' });
  expect(screen.getByRole('banner')).toBe(header);
  expect(authApi.me).toHaveBeenCalledTimes(1);
  // Trình duyệt quay lại một URL cũ trong cùng tài liệu.
  act(() => {
    window.history.replaceState(null, '', '/user/bookings');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await screen.findByRole('heading', { name: 'Đặt vé trực tuyến' });
});

it('reloads the selected trip when only its query changes', async () => {
  window.history.replaceState(
    null,
    '',
    '/user/bookings/new?trip=10&from=1&to=3',
  );
  render(<App />);
  await screen.findByRole('heading', { name: /Tuyến TEST-10/ });
  act(() => {
    window.history.pushState(
      null,
      '',
      '/user/bookings/new?trip=11&from=1&to=3',
    );
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await waitFor(() =>
    expect(bookingsApi.trip).toHaveBeenCalledWith(
      '11',
      expect.any(Object),
      expect.any(AbortSignal),
    ),
  );
  expect(
    await screen.findByRole('heading', { name: /Tuyến TEST-11/ }),
  ).toBeVisible();
});

it('opens the journey planner from the booking header without reloading the session', async () => {
  window.history.replaceState(null, '', '/user/bookings');
  const actor = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Đặt vé trực tuyến' });
  await actor.click(screen.getByRole('link', { name: 'Lộ trình & Bản đồ' }));
  expect(window.location.pathname).toBe('/user/journey-planner');
  expect(window.location.hash).toBe('');
  expect(
    await screen.findByRole('heading', { name: 'Hôm nay bạn đi đâu?' }),
  ).toBeVisible();
  expect(
    screen.getByRole('region', { name: 'Bản đồ hành trình' }),
  ).toBeVisible();
  await waitFor(() =>
    expect(journeyPlannerApi.tracking).toHaveBeenCalledTimes(1),
  );
  expect(authApi.me).toHaveBeenCalledTimes(1);
});

it('shows the saved receipt after submitting without restarting the app', async () => {
  window.history.replaceState(
    null,
    '',
    '/user/bookings/new?trip=10&from=1&to=3',
  );
  const actor = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Thông tin hành khách' });
  await actor.type(screen.getByLabelText('Họ và tên *'), 'Nguyễn An');
  await actor.type(screen.getByLabelText('Số điện thoại *'), '0901234567');
  await actor.click(screen.getByRole('button', { name: 'Xác nhận đặt vé' }));
  expect(
    await screen.findByRole('heading', { name: 'Đặt vé thành công!' }),
  ).toBeVisible();
  expect(bookingsApi.create).toHaveBeenCalledTimes(1);
  const body = bookingsApi.create.mock.calls[0][0];
  expect(bookingsApi.receipt).toHaveBeenCalledWith(
    body.request_id,
    expect.any(AbortSignal),
  );
  expect(authApi.me).toHaveBeenCalledTimes(1);
});

it.each([
  [
    'button',
    'Tìm kiếm lộ trình nhanh',
    '/user/journey-planner',
    'Điểm đi',
    'Điểm đến',
  ],
  ['link', 'Tìm Đường', '/user/journey-planner', 'Điểm đi', 'Điểm đến'],
  [
    'link',
    'Lộ trình & Bản đồ',
    '/user/journey-planner',
    'Điểm đi',
    'Điểm đến',
  ],
  ['link', 'Đặt vé ngay', '/user/bookings', 'Điểm đi *', 'Điểm đến *'],
  ['link', 'Mua vé', '/user/bookings', 'Điểm đi *', 'Điểm đến *'],
])(
  'keeps unselected typed text through %s %s and reload',
  async (role, name, path, originLabel, destinationLabel) => {
    const actor = userEvent.setup();
    const view = render(<App />);
    const origin = await screen.findByRole('combobox', {
      name: 'Điểm xuất phát',
    });
    await actor.type(origin, '12 Nguyễn Trãi & Ngõ 2');
    await actor.type(screen.getByLabelText('Điểm đến'), 'Học viện Bưu chính');
    await actor.click(screen.getByRole(role, { name, exact: true }));
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: originLabel })).toHaveValue(
        '12 Nguyễn Trãi & Ngõ 2',
      ),
    );
    expect(
      screen.getByRole('combobox', { name: destinationLabel }),
    ).toHaveValue('Học viện Bưu chính');
    expect(window.location.pathname).toBe(path);
    const params = new URLSearchParams(window.location.search);
    expect(params.get('from_text')).toBe('12 Nguyễn Trãi & Ngõ 2');
    expect(params.get('to_text')).toBe('Học viện Bưu chính');
    expect(journeyPlannerApi.search).not.toHaveBeenCalled();
    // Reload the destination page from its URL, without homepage state.
    view.unmount();
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: originLabel })).toHaveValue(
        '12 Nguyễn Trãi & Ngõ 2',
      ),
    );
    expect(
      screen.getByRole('combobox', { name: destinationLabel }),
    ).toHaveValue('Học viện Bưu chính');
  },
);

it.each(['Điểm xuất phát', 'Điểm đến'])(
  'carries just the typed %s into the map',
  async (label) => {
    const actor = userEvent.setup();
    render(<App />);
    await actor.type(
      await screen.findByRole('combobox', { name: label }),
      'Hà Đông',
    );
    await actor.click(
      screen.getByRole('button', { name: 'Tìm kiếm lộ trình nhanh' }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', {
          name: label === 'Điểm xuất phát' ? 'Điểm đi' : 'Điểm đến',
        }),
      ).toHaveValue('Hà Đông'),
    );
    expect(journeyPlannerApi.search).not.toHaveBeenCalled();
  },
);

it('discards a previously selected station ID when its text is edited', async () => {
  const actor = userEvent.setup();
  render(<App />);
  const origin = await screen.findByRole('combobox', {
    name: 'Điểm xuất phát',
  });
  await actor.click(origin);
  await actor.click(await screen.findByRole('option', { name: /Bến đầu/ }));
  await actor.clear(origin);
  await actor.type(origin, 'Địa điểm mới');
  await actor.click(screen.getByLabelText('Điểm đến'));
  await actor.click(await screen.findByRole('option', { name: /Bến cuối/ }));
  await actor.click(screen.getByRole('link', { name: 'Đặt vé ngay' }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Điểm đi *' })).toHaveValue(
      'Địa điểm mới',
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Điểm đến *' })).toHaveValue(
    'Bến cuối',
  );
  expect(new URLSearchParams(window.location.search).has('from')).toBe(false);
  expect(new URLSearchParams(window.location.search).get('to')).toBe('3');
  expect(screen.getByRole('combobox', { name: 'Điểm đi *' })).toBeInvalid();
});
