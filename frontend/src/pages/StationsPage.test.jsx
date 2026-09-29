import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StationsPage from './StationsPage';
import { stationsApi } from '../services/stationsApi';
vi.mock('../services/stationsApi', () => ({
  stationsApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setStatus: vi.fn(),
  },
}));
const station = {
  id: '1',
  code: 'BX01',
  name: 'Bến Hà Nội',
  address: 'Hà Nội',
  is_active: true,
};
const result = {
  items: [station],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
};
beforeEach(() => {
  vi.resetAllMocks();
  stationsApi.list.mockResolvedValue(result);
});

describe('Stations user flows', () => {
  it('AC-6 announces loading while the API has not responded', () => {
    stationsApi.list.mockReturnValue(new Promise(() => {}));
    render(<StationsPage />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Đang tải danh sách bến xe',
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('AC-1/6 shows an empty state and allows clearing filters', async () => {
    stationsApi.list.mockResolvedValue({
      ...result,
      items: [],
      total: 0,
      totalPages: 0,
    });
    const actor = userEvent.setup();
    render(<StationsPage />);
    expect(
      await screen.findByRole('heading', { name: 'Không tìm thấy bến xe' }),
    ).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(stationsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: '', is_active: '' }),
      expect.any(AbortSignal),
    );
  });
  it('AC-6 recovers from a failed list request after retry', async () => {
    stationsApi.list
      .mockRejectedValueOnce(new Error('Mất kết nối'))
      .mockResolvedValue(result);
    const actor = userEvent.setup();
    render(<StationsPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Mất kết nối');
    await actor.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('table')).toHaveTextContent(station.name);
  });
  it('AC-1 applies search/status filters and resets the page', async () => {
    const actor = userEvent.setup();
    render(<StationsPage />);
    await screen.findByRole('table');
    await actor.type(
      screen.getByRole('textbox', { name: 'Tìm kiếm bến xe' }),
      'Hà Nội',
    );
    await actor.click(
      screen.getByRole('button', { name: 'Tìm kiếm', exact: true }),
    );
    await actor.selectOptions(
      screen.getByRole('combobox', { name: 'Trạng thái' }),
      'false',
    );
    expect(stationsApi.list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        search: 'Hà Nội',
        is_active: 'false',
      }),
      expect.any(AbortSignal),
    );
  });
  it('AC-2 preserves the form and displays a duplicate code error', async () => {
    stationsApi.create.mockRejectedValue(new Error('Mã bến đã tồn tại.'));
    const actor = userEvent.setup();
    render(<StationsPage />);
    await screen.findByRole('table');
    await actor.click(screen.getByRole('button', { name: 'Thêm bến xe' }));
    const dialog = screen.getByRole('dialog');
    await actor.type(
      within(dialog).getByPlaceholderText('Ví dụ: BX_MY_DINH'),
      'BX01',
    );
    await actor.type(
      within(dialog).getByPlaceholderText('Nhập tên bến xe'),
      'Bến mới',
    );
    await actor.type(
      within(dialog).getByPlaceholderText('Nhập địa chỉ bến xe'),
      'Hà Nội',
    );
    await actor.click(
      within(dialog).getByRole('button', { name: 'Lưu bến xe' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Mã bến đã tồn tại.',
    );
    expect(screen.getByPlaceholderText('Nhập tên bến xe')).toHaveValue(
      'Bến mới',
    );
  });
  it('AC-2 reloads the API after an edit and reports success', async () => {
    stationsApi.update.mockResolvedValue({ ...station, name: 'Bến đã sửa' });
    const actor = userEvent.setup();
    render(<StationsPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: `Sửa ${station.name}` }),
    );
    const input = screen.getByPlaceholderText('Nhập tên bến xe');
    await actor.clear(input);
    await actor.type(input, 'Bến đã sửa');
    stationsApi.list.mockResolvedValue({
      ...result,
      items: [{ ...station, name: 'Bến đã sửa' }],
    });
    await actor.click(screen.getByRole('button', { name: 'Lưu bến xe' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Đã cập nhật thông tin bến xe.',
    );
    expect(await screen.findByRole('table')).toHaveTextContent('Bến đã sửa');
    expect(stationsApi.update).toHaveBeenCalledWith('1', {
      code: station.code,
      name: 'Bến đã sửa',
      address: station.address,
    });
  });
  it('AC-3 requires confirmation before deactivation and refreshes the status text', async () => {
    const actor = userEvent.setup();
    render(<StationsPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: `Ngừng hoạt động ${station.name}` }),
    );
    expect(stationsApi.setStatus).not.toHaveBeenCalled();
    await actor.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(stationsApi.setStatus).not.toHaveBeenCalled();
    await actor.click(
      screen.getByRole('button', { name: `Ngừng hoạt động ${station.name}` }),
    );
    const inactive = { ...station, is_active: false };
    stationsApi.setStatus.mockResolvedValue(inactive);
    stationsApi.list.mockResolvedValue({ ...result, items: [inactive] });
    await actor.click(screen.getByRole('button', { name: 'Xác nhận ngừng' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByRole('table')).toHaveTextContent(
      'Ngừng hoạt động',
    );
    expect(
      screen.getByRole('button', { name: `Kích hoạt ${station.name}` }),
    ).toBeEnabled();
    expect(stationsApi.setStatus).toHaveBeenCalledWith('1', false);
  });
  it('AC-4 explains which active route blocks a state change', async () => {
    const error = Object.assign(new Error('Không thể ngừng hoạt động.'), {
      routes: [{ id: '1', code: '02-DI', name: 'Tuyến 02' }],
    });
    stationsApi.setStatus.mockRejectedValue(error);
    const actor = userEvent.setup();
    render(<StationsPage />);
    await screen.findByRole('table');
    await actor.click(
      screen.getByRole('button', { name: `Ngừng hoạt động ${station.name}` }),
    );
    await actor.click(screen.getByRole('button', { name: 'Xác nhận ngừng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '02-DI — Tuyến 02',
    );
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
