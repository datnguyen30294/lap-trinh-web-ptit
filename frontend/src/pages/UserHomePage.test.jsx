import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UserHomePage from './UserHomePage';
import { passengerApi } from '../services/passengerApi';
vi.mock('../services/passengerApi', () => ({
  passengerApi: { stations: vi.fn(), routes: vi.fn() },
}));
const stations = [
  { id: '1', code: 'BX01', name: 'Bến đầu' },
  { id: '2', code: 'BX02', name: 'Bến giữa' },
  { id: '3', code: 'BX03', name: 'Bến cuối' },
];
const route = {
  id: '10',
  code: '02',
  name: 'Tuyến từ máy chủ',
  origin_name: 'Bến đầu',
  destination_name: 'Bến cuối',
  operating_start: '05:00:00',
  operating_end: '22:00:00',
  distance_km: 20,
  stops: stations.map((s) => ({ station_id: s.id, station_name: s.name })),
};
const response = { items: [route], total: 1, totalPages: 1 };
const props = {
  user: { full_name: 'Hành khách thật' },
  onLogout: vi.fn(),
  logoutBusy: false,
  logoutError: '',
};
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/user/home');
  passengerApi.stations.mockResolvedValue(stations);
  passengerApi.routes.mockResolvedValue(response);
});
describe('Passenger homepage', () => {
  it('shows API route suggestions and the actual user name, with no fake Figma routes', async () => {
    render(<UserHomePage {...props} />);
    expect(screen.getByText('Hành khách thật')).toBeVisible();
    expect(
      await screen.findByRole('button', { name: 'Tuyến 02' }),
    ).toBeVisible();
    expect(screen.queryByText('Tuyến E01')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);
  });
  it('opens the map with the chosen segment instead of losing the home inputs', async () => {
    const actor = userEvent.setup();
    render(<UserHomePage {...props} />);
    await screen.findByRole('button', { name: 'Tuyến 02' });
    await actor.click(screen.getByLabelText('Điểm xuất phát'));
    await actor.click(
      await screen.findByRole('option', { name: /Bến giữa/ }),
    );
    await actor.click(screen.getByLabelText('Điểm đến'));
    await actor.click(
      await screen.findByRole('option', { name: /Bến cuối/ }),
    );
    await actor.click(
      screen.getByRole('button', { name: 'Tìm kiếm lộ trình nhanh' }),
    );
    expect(window.location.pathname).toBe('/user/journey-planner');
    expect(new URLSearchParams(window.location.search).get('from')).toBe('2');
    expect(new URLSearchParams(window.location.search).get('to')).toBe('3');
    expect(passengerApi.routes).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('rejects identical stops without making a search request', async () => {
    render(<UserHomePage {...props} />);
    await screen.findByRole('button', { name: 'Tuyến 02' });
    await userEvent.click(screen.getByLabelText('Điểm xuất phát'));
    await userEvent.click(
      await screen.findByRole('option', { name: /Bến đầu/ }),
    );
    await userEvent.click(screen.getByLabelText('Điểm đến'));
    await userEvent.click(
      await screen.findByRole('option', { name: /Bến đầu/ }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Tìm kiếm lộ trình nhanh' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('phải khác nhau');
    expect(passengerApi.routes).toHaveBeenCalledTimes(1);
  });
  it('recovers from catalog failure without displaying sample data', async () => {
    passengerApi.stations.mockRejectedValueOnce(
      new Error('Không kết nối được máy chủ'),
    );
    render(<UserHomePage {...props} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không kết nối được máy chủ',
    );
    expect(
      screen.getByRole('button', { name: 'Tìm kiếm lộ trình nhanh' }),
    ).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(
      await screen.findByRole('button', { name: 'Tuyến 02' }),
    ).toBeVisible();
  });
  it('shows an empty catalog and an empty search honestly', async () => {
    passengerApi.stations.mockResolvedValue([]);
    passengerApi.routes.mockResolvedValue({
      items: [],
      total: 0,
      totalPages: 0,
    });
    render(<UserHomePage {...props} />);
    await screen.findByText('Chưa có tuyến xe đang hoạt động.');
    expect(screen.getByLabelText('Điểm xuất phát')).toBeEnabled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Xem tất cả tuyến' }),
    );
    expect(
      await screen.findByText(/Không tìm thấy tuyến đi thẳng phù hợp/),
    ).toBeVisible();
  });
  it('opens booking links and keeps an upcoming dialog for unfinished features', async () => {
    render(<UserHomePage {...props} />);
    expect(screen.getByRole('link', { name: 'Đặt vé ngay' })).toHaveAttribute(
      'href',
      '/user/bookings',
    );
    expect(screen.getByRole('link', { name: 'Vé của tôi' })).toHaveAttribute(
      'href',
      '/user/tickets',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Facebook — sắp có' }),
    );
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'Facebook — Sắp có',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Đã hiểu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('retries failed results and paginates server results', async () => {
    render(<UserHomePage {...props} />);
    await screen.findByRole('button', { name: 'Tuyến 02' });
    passengerApi.routes.mockRejectedValueOnce(
      new Error('Không tải được kết quả'),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Xem tất cả tuyến' }),
    );
    await screen.findByText('Không tải được kết quả');
    passengerApi.routes.mockResolvedValue({
      ...response,
      total: 6,
      totalPages: 2,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByText('Trang 1/2');
    await userEvent.click(screen.getByRole('button', { name: 'Sau' }));
    await waitFor(() =>
      expect(passengerApi.routes).toHaveBeenLastCalledWith(
        { page: 2, limit: 5 },
        expect.any(AbortSignal),
      ),
    );
    await screen.findByText('Trang 2/2');
  });
});
