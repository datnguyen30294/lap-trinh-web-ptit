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

vi.mock('./services/stationsApi', () => ({
  authApi: { me: vi.fn(), logout: vi.fn() },
}));
vi.mock('./services/passengerApi', () => ({
  passengerApi: {
    stations: vi.fn(async () => [
      { id: '1', name: 'Bến đầu' },
      { id: '3', name: 'Bến cuối' },
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
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/user/home');
  authApi.me.mockResolvedValue({
    id: '1',
    full_name: 'Người đặt',
    role: 'USER',
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
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
