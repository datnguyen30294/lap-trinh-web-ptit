import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoutesPage from './RoutesPage';
import { routesApi } from '../services/routesApi';
import { stationsApi } from '../services/stationsApi';
vi.mock('../services/routesApi', () => ({
  routesApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  },
}));
vi.mock('../services/stationsApi', () => ({ stationsApi: { list: vi.fn() } }));
const stations = [1, 2, 3].map((id) => ({
  id: String(id),
  code: `S${id}`,
  name: `Bến ${id}`,
  is_active: true,
}));
const route = {
  id: '11',
  code: 'R01',
  name: 'Tuyến một chiều',
  origin_station_id: '1',
  destination_station_id: '3',
  origin_name: 'Bến 1',
  destination_name: 'Bến 3',
  operating_start: '05:00:00',
  operating_end: '22:00:00',
  distance_km: 10,
  status: 'ACTIVE',
  stop_count: 3,
  has_bookings: false,
  schedule_count: 0,
  stops: stations.map((s, i) => ({
    id: String(i + 10),
    station_id: s.id,
    station_name: s.name,
    station_code: s.code,
    is_active: 1,
    stop_order: i + 1,
    minutes_from_origin: i * 10,
    km_from_origin: i * 5,
  })),
};
const result = { items: [route], total: 1, page: 1, limit: 10, totalPages: 1 };
beforeEach(() => {
  vi.resetAllMocks();
  routesApi.list.mockResolvedValue(result);
  routesApi.detail.mockResolvedValue(route);
  stationsApi.list.mockResolvedValue({
    items: stations,
    total: 3,
    totalPages: 1,
  });
});
describe('Routes admin flows', () => {
  it('AC-1/6 shows loading, then real route columns and filtered requests', async () => {
    const actor = userEvent.setup();
    render(<RoutesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang tải');
    expect(await screen.findByRole('table')).toHaveTextContent('10 km');
    await actor.type(
      screen.getByRole('textbox', { name: 'Tìm kiếm tuyến xe' }),
      'R01',
    );
    await actor.click(
      screen.getByRole('button', { name: 'Tìm kiếm', exact: true }),
    );
    await actor.selectOptions(
      screen.getByRole('combobox', { name: 'Trạng thái' }),
      'INACTIVE',
    );
    expect(routesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'R01', status: 'INACTIVE', page: 1 }),
      expect.any(AbortSignal),
    );
  });
  it('AC-6 retries errors and clears an empty result filter', async () => {
    routesApi.list
      .mockRejectedValueOnce(new Error('Mất kết nối'))
      .mockResolvedValue({ ...result, items: [], total: 0, totalPages: 0 });
    const actor = userEvent.setup();
    render(<RoutesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
    await actor.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy tuyến xe' }),
    ).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(routesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', status: '' }),
      expect.any(AbortSignal),
    );
  });
  it('AC-1 displays journey in order and unknown legacy minutes without inventing values', async () => {
    routesApi.detail.mockResolvedValue({
      ...route,
      stops: route.stops.map((s) => ({ ...s, minutes_from_origin: null })),
    });
    const actor = userEvent.setup();
    render(<RoutesPage />);
    await actor.click(
      await screen.findByRole('button', { name: 'Chi tiết R01' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Chi tiết tuyến R01' }),
    ).toBeVisible();
    expect(screen.getAllByText(/Chưa có số phút/)).toHaveLength(3);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(
      [
        expect.stringContaining('Bến 1'),
        expect.stringContaining('Bến 2'),
        expect.stringContaining('Bến 3'),
      ],
    );
  });
  it('AC-2/6 adds, removes and reorders stops, recalculates order and retains values after server rejection', async () => {
    routesApi.update.mockRejectedValue(new Error('Mã tuyến đã tồn tại.'));
    const actor = userEvent.setup();
    render(<RoutesPage />);
    await actor.click(await screen.findByRole('button', { name: 'Sửa R01' }));
    await screen.findByRole('heading', { name: 'Cập nhật tuyến xe: R01' });
    await actor.click(screen.getByRole('button', { name: 'Thêm điểm dừng' }));
    expect(screen.getByLabelText('Bến 4 *')).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Bỏ điểm 4' }));
    await actor.click(screen.getByRole('button', { name: 'Đưa điểm 2 xuống' }));
    expect(screen.getByLabelText('Bến 3 *')).toHaveValue('2');
    await actor.click(screen.getByRole('button', { name: 'Đưa điểm 3 lên' }));
    await actor.clear(screen.getByLabelText('Tên tuyến xe *'));
    await actor.type(screen.getByLabelText('Tên tuyến xe *'), 'Tên đang sửa');
    await actor.click(
      screen.getByRole('button', { name: 'Cập nhật thông tin' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mã tuyến đã tồn tại',
    );
    expect(screen.getByLabelText('Tên tuyến xe *')).toHaveValue('Tên đang sửa');
    expect(routesApi.update).toHaveBeenCalledWith(
      '11',
      expect.objectContaining({
        stops: route.stops.map(
          ({
            station_id,
            stop_order,
            minutes_from_origin,
            km_from_origin,
          }) => ({
            station_id,
            stop_order,
            minutes_from_origin,
            km_from_origin,
          }),
        ),
      }),
    );
  });
  it('AC-2 creates a route and refreshes the list after successful save', async () => {
    routesApi.create.mockResolvedValue(route);
    const actor = userEvent.setup();
    render(<RoutesPage />);
    await screen.findByRole('table');
    await actor.click(screen.getByRole('button', { name: 'Thêm tuyến mới' }));
    await screen.findByRole('heading', { name: 'Thêm tuyến xe mới' });
    await actor.type(screen.getByLabelText('Tên tuyến xe *'), 'Tuyến thử');
    await actor.type(screen.getByLabelText('Mã tuyến xe *'), 'NEW');
    await actor.selectOptions(screen.getByLabelText('Bến 1 *'), '1');
    await actor.selectOptions(screen.getByLabelText('Bến 2 *'), '3');
    await actor.type(
      screen.getByRole('spinbutton', { name: 'Phút điểm 2' }),
      '20',
    );
    await actor.type(
      screen.getByRole('spinbutton', { name: 'Km điểm 2' }),
      '10',
    );
    await actor.type(screen.getByLabelText('Tổng khoảng cách (km) *'), '10');
    await actor.click(screen.getByRole('button', { name: 'Lưu tuyến xe' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã thêm tuyến xe thành công',
    );
    expect(routesApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'NEW',
        status: 'ACTIVE',
        origin_station_id: '1',
        destination_station_id: '3',
      }),
    );
  });
  it('AC-4 disables identity and itinerary for booked routes but allows editing hours', async () => {
    routesApi.detail.mockResolvedValue({ ...route, has_bookings: true });
    const actor = userEvent.setup();
    render(<RoutesPage />);
    await actor.click(await screen.findByRole('button', { name: 'Sửa R01' }));
    await screen.findByRole('heading', { name: 'Cập nhật tuyến xe: R01' });
    expect(screen.getByLabelText('Mã tuyến xe *')).toBeDisabled();
    expect(screen.getByLabelText('Bến 1 *')).toBeDisabled();
    expect(screen.getByLabelText('Giờ bắt đầu *')).toBeEnabled();
  });
  it('AC-4/6 requires confirmation and preserves blocked dialog with an explanation', async () => {
    routesApi.setStatus.mockRejectedValue(
      new Error('Chuyến tương lai còn vé CONFIRMED.'),
    );
    const actor = userEvent.setup();
    render(<RoutesPage />);
    await actor.click(await screen.findByRole('button', { name: 'Ngừng R01' }));
    expect(routesApi.setStatus).not.toHaveBeenCalled();
    await actor.click(screen.getByRole('button', { name: 'Xác nhận ngừng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('CONFIRMED');
    expect(screen.getByRole('dialog')).toBeVisible();
    await actor.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});
