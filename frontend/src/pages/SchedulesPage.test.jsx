import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SchedulesPage from './SchedulesPage';
import { schedulesApi } from '../services/schedulesApi';
import { routesApi } from '../services/routesApi';
vi.mock('../services/schedulesApi', async (original) => ({
  ...(await original()),
  schedulesApi: {
    list: vi.fn(),
    vehicles: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  },
}));
vi.mock('../services/routesApi', () => ({
  routesApi: { list: vi.fn(), detail: vi.fn() },
}));
const route = {
  id: '1',
  code: 'R01',
  name: 'Tuyến thử',
  status: 'ACTIVE',
  origin_name: 'Bến A',
  destination_name: 'Bến B',
  operating_start: '05:00:00',
  operating_end: '22:00:00',
  stops: [
    {
      id: '1',
      station_id: '1',
      station_name: 'Bến A',
      station_code: 'A',
      stop_order: 1,
      minutes_from_origin: 0,
      km_from_origin: 0,
      is_active: 1,
    },
    {
      id: '2',
      station_id: '2',
      station_name: 'Bến B',
      station_code: 'B',
      stop_order: 2,
      minutes_from_origin: 20,
      km_from_origin: 10,
      is_active: 1,
    },
  ],
};
const schedule = {
  id: '10',
  route_id: '1',
  vehicle_id: '2',
  route_code: 'R01',
  route_name: 'Tuyến thử',
  origin_name: 'Bến A',
  destination_name: 'Bến B',
  vehicle_code: 'XE01',
  capacity: 30,
  confirmed_bookings: 0,
  status: 'SCHEDULED',
  departure_at: '2099-01-01T01:00:00.000Z',
  arrival_at: '2099-01-01T01:20:00.000Z',
  has_bookings: false,
  can_edit: true,
  edit_block_reason: '',
  stops: route.stops.map((s, i) => ({
    ...s,
    expected_at: i ? '2099-01-01T01:20:00.000Z' : '2099-01-01T01:00:00.000Z',
  })),
};
const result = {
  items: [schedule],
  total: 1,
  totalPages: 1,
  page: 1,
  limit: 10,
};
beforeEach(() => {
  vi.resetAllMocks();
  schedulesApi.list.mockResolvedValue(result);
  schedulesApi.vehicles.mockResolvedValue({
    items: [{ id: '2', vehicle_code: 'XE01', capacity: 30 }],
    totalPages: 1,
  });
  schedulesApi.detail.mockResolvedValue(schedule);
  routesApi.list.mockResolvedValue({ items: [route], totalPages: 1 });
  routesApi.detail.mockResolvedValue(route);
});
describe('Schedules UI', () => {
  it('AC-1/6 loads, filters dates/status/route/search and paginates', async () => {
    const actor = userEvent.setup();
    schedulesApi.list.mockResolvedValue({
      ...result,
      total: 21,
      totalPages: 3,
    });
    render(<SchedulesPage />);
    expect(screen.getByText('Đang tải lịch trình…')).toBeVisible();
    expect(await screen.findByRole('table')).toHaveTextContent('XE01');
    await actor.type(
      screen.getByRole('textbox', { name: 'Tìm tuyến hoặc xe' }),
      'XE01',
    );
    await actor.selectOptions(
      screen.getByRole('combobox', { name: 'Trạng thái' }),
      'SCHEDULED',
    );
    await actor.selectOptions(
      screen.getByRole('combobox', { name: 'Tuyến chạy', exact: true }),
      '1',
    );
    await actor.click(
      screen.getByRole('button', { name: 'Tìm kiếm', exact: true }),
    );
    expect(schedulesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        search: 'XE01',
        route_id: '1',
        status: 'SCHEDULED',
        page: 1,
      }),
      expect.any(AbortSignal),
    );
    await actor.click(screen.getByRole('button', { name: 'Sau' }));
    expect(schedulesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2 }),
      expect.any(AbortSignal),
    );
  });
  it('AC-6 retries errors, handles empty results and clears filters', async () => {
    const actor = userEvent.setup();
    schedulesApi.list
      .mockRejectedValueOnce(new Error('Mất kết nối'))
      .mockResolvedValue({ ...result, items: [], total: 0, totalPages: 0 });
    render(<SchedulesPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
    await actor.click(
      screen.getByRole('button', { name: 'Thử lại', exact: true }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy lịch trình' }),
    ).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(schedulesApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: '', page: 1 }),
      expect.any(AbortSignal),
    );
  });
  it('AC-2/6 derives arrival from real minutes, submits UTC and preserves inputs after conflict', async () => {
    const actor = userEvent.setup();
    schedulesApi.create
      .mockRejectedValueOnce(new Error('Xe bị trùng lịch'))
      .mockResolvedValue(schedule);
    render(<SchedulesPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: 'Thêm lịch trình mới' }),
    );
    const form = within(await screen.findByRole('dialog'));
    await actor.selectOptions(
      form.getByRole('combobox', { name: 'Tuyến chạy *' }),
      '1',
    );
    await form.findByText(/20 phút/);
    await actor.selectOptions(
      form.getByRole('combobox', { name: 'Xe chạy *' }),
      '2',
    );
    await actor.type(
      form.getByLabelText('Khởi hành (giờ Việt Nam) *'),
      '2099-01-01T08:00:00',
    );
    expect(form.getByLabelText('Sức chứa xe')).toHaveValue('30');
    await actor.click(form.getByRole('button', { name: 'Lưu lịch trình' }));
    expect(await form.findByRole('alert')).toHaveTextContent(
      'Xe bị trùng lịch',
    );
    expect(form.getByLabelText('Khởi hành (giờ Việt Nam) *')).toHaveValue(
      '2099-01-01T08:00',
    );
    expect(schedulesApi.create).toHaveBeenCalledWith({
      route_id: '1',
      vehicle_id: '2',
      departure_at: '2099-01-01T01:00:00.000Z',
      arrival_at: '2099-01-01T01:20:00.000Z',
    });
    await actor.click(form.getByRole('button', { name: 'Lưu lịch trình' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã thêm lịch trình thành công',
    );
  });
  it('AC-2 blocks a legacy route without minutes and retries failed route detail', async () => {
    const actor = userEvent.setup();
    routesApi.detail
      .mockRejectedValueOnce(new Error('Không tải được tuyến'))
      .mockResolvedValue({
        ...route,
        stops: route.stops.map((s) => ({ ...s, minutes_from_origin: null })),
      });
    render(<SchedulesPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: 'Thêm lịch trình mới' }),
    );
    const form = within(await screen.findByRole('dialog'));
    await actor.selectOptions(
      form.getByRole('combobox', { name: 'Tuyến chạy *' }),
      '1',
    );
    expect(await form.findByRole('alert')).toHaveTextContent(
      'Không tải được tuyến',
    );
    await actor.click(form.getByRole('button', { name: 'Tải lại tuyến' }));
    await waitFor(() =>
      expect(form.getByRole('alert')).toHaveTextContent('chưa có đủ số phút'),
    );
    expect(form.getByRole('button', { name: 'Lưu lịch trình' })).toBeDisabled();
    expect(schedulesApi.create).not.toHaveBeenCalled();
  });
  it('AC-4 displays and locks booked schedule history', async () => {
    const actor = userEvent.setup();
    schedulesApi.detail.mockResolvedValue({
      ...schedule,
      can_edit: false,
      has_bookings: true,
      edit_block_reason: 'Lịch trình đã có vé, kể cả đơn đã hủy.',
    });
    render(<SchedulesPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: 'Sửa lịch trình 10' }),
    );
    const form = within(
      await screen.findByRole('dialog', { name: 'Sửa lịch trình #10' }),
    );
    expect(form.getByRole('combobox', { name: 'Tuyến chạy *' })).toBeDisabled();
    expect(form.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled();
    expect(form.getByRole('status')).toHaveTextContent('đã có vé');
  });
  it('AC-1 shows ordered expected times and preserves unknown legacy times', async () => {
    const actor = userEvent.setup();
    schedulesApi.detail.mockResolvedValue({
      ...schedule,
      stops: [schedule.stops[0], { ...schedule.stops[1], expected_at: null }],
    });
    render(<SchedulesPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: 'Chi tiết lịch trình 10' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'Chi tiết lịch trình #10' }),
    ).toBeVisible();
    expect(
      screen.getByText('Chưa có số phút, chưa tính được giờ'),
    ).toBeVisible();
    expect(
      screen.getByText('Asia/Ho_Chi_Minh (UTC+7). Phút/km tính từ bến đầu.'),
    ).toBeVisible();
  });
  it('AC-4/6 keeps status dialog open with specific booking error and confirms a successful transition', async () => {
    const actor = userEvent.setup();
    schedulesApi.setStatus
      .mockRejectedValueOnce(new Error('Còn vé CONFIRMED'))
      .mockResolvedValue({ ...schedule, status: 'CANCELLED' });
    render(<SchedulesPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: 'Đổi trạng thái 10' }),
    );
    const dialog = within(screen.getByRole('dialog'));
    expect(schedulesApi.setStatus).not.toHaveBeenCalled();
    await actor.click(dialog.getByRole('button', { name: 'Xác nhận' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('CONFIRMED');
    await actor.click(dialog.getByRole('button', { name: 'Xác nhận' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Đã hủy');
    expect(schedulesApi.setStatus).toHaveBeenCalledWith('10', 'CANCELLED');
  });
  it('AC-6 retries failed options before allowing form entry', async () => {
    const actor = userEvent.setup();
    schedulesApi.vehicles
      .mockRejectedValueOnce(new Error('Không tải được xe'))
      .mockResolvedValue({
        items: [{ id: '2', vehicle_code: 'XE01', capacity: 30 }],
        totalPages: 1,
      });
    render(<SchedulesPage />);
    await screen.findByRole('alert');
    await actor.click(
      screen.getByRole('button', { name: 'Thêm lịch trình mới' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    await actor.click(dialog.getByRole('button', { name: 'Thử lại biểu mẫu' }));
    expect(
      await screen.findByRole('dialog', { name: 'Thêm lịch trình mới' }),
    ).toBeVisible();
  });
});
