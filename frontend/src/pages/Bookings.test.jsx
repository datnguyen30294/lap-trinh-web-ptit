import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BookingPage from './BookingPage';
import BookingSearchPage from './BookingSearchPage';
import BookingSuccessPage from './BookingSuccessPage';
import MyTicketsPage from './MyTicketsPage';
import TicketDetailPage from './TicketDetailPage';

const trip = {
  id: '10',
  route_code: '02-DI',
  from_station: 'Bến đầu',
  to_station: 'Bến cuối',
  from_station_id: '1',
  to_station_id: '3',
  pickup_at: '2090-10-12T01:00:00Z',
  capacity: 45,
  remaining: 2,
  unit_price: 9000,
  vehicle_code: 'BUS01',
};
const ticket = {
  ...trip,
  id: '20',
  booking_code: 'GBTEST-00001',
  passenger_name: 'Nguyễn An',
  contact_phone: '0901234567',
  email: 'an@example.test',
  display_status: 'CONFIRMED',
  status: 'CONFIRMED',
  can_cancel: true,
  qr_data_url: 'data:image/png;base64,AA==',
};
const response = (body, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body });
let fetchMock;
beforeEach(() => {
  window.history.replaceState(
    null,
    '',
    '/user/bookings/new?trip=10&from=1&to=3',
  );
  fetchMock = vi.fn(() => response(trip));
  vi.stubGlobal('fetch', fetchMock);
});

describe('Passenger booking screens', () => {
  it('keeps the ticket area in place while filters load and ignores an older response', async () => {
    const actor = userEvent.setup();
    const pending = {};
    fetchMock.mockImplementation((url) => {
      const filter = new URL(url, 'http://localhost').searchParams.get(
        'filter',
      );
      if (filter === 'ALL') return response({ items: [ticket], totalPages: 1 });
      return new Promise((resolve) => {
        pending[filter] = resolve;
      });
    });
    render(<MyTicketsPage />);
    const original = await screen.findByText(ticket.booking_code);
    await actor.click(screen.getByRole('button', { name: 'Đã đặt' }));
    expect(screen.getByText(ticket.booking_code)).toBe(original);
    expect(original.closest('[aria-busy]')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(original.closest('[inert]')).toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Đã hủy' }));
    await act(async () =>
      pending.CANCELLED(await response({ items: [], totalPages: 1 })),
    );
    await screen.findByText('Chưa có vé trong danh sách này');
    await act(async () =>
      pending.CONFIRMED(await response({ items: [ticket], totalPages: 1 })),
    );
    expect(screen.queryByText(ticket.booking_code)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đã hủy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('AC-2 adds separate passenger fields, computes the total and respects remaining capacity', async () => {
    const actor = userEvent.setup();
    render(<BookingPage user={{ full_name: 'Người đặt' }} />);
    await screen.findByRole('heading', { name: 'Thông tin hành khách' });
    await actor.type(screen.getByLabelText('Họ và tên *'), 'Nguyễn An');
    await actor.click(screen.getByRole('button', { name: 'Tăng số vé' }));
    const second = screen.getByRole('group', { name: 'Hành khách 2' });
    await actor.type(within(second).getByLabelText('Họ và tên *'), 'Trần Bình');
    expect(
      screen.getAllByLabelText('Họ và tên *').map((input) => input.value),
    ).toEqual(['Nguyễn An', 'Trần Bình']);
    expect(screen.getByText('18.000 đ')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Tăng số vé' })).toBeDisabled();
    await actor.click(screen.getByRole('button', { name: 'Giảm số vé' }));
    expect(screen.getByLabelText('Họ và tên *')).toHaveValue('Nguyễn An');
    expect(screen.getByRole('button', { name: 'Giảm số vé' })).toBeDisabled();
  });
  it('AC-3 preserves entered passengers and retries with the same request ID after a lost response', async () => {
    const actor = userEvent.setup();
    fetchMock.mockImplementation((url, options) =>
      options?.method === 'POST'
        ? response({ message: 'Chưa nhận được kết quả' }, 503)
        : response(trip),
    );
    render(<BookingPage user={{ full_name: 'Người đặt' }} />);
    await screen.findByRole('heading', { name: 'Thông tin hành khách' });
    await actor.type(screen.getByLabelText('Họ và tên *'), 'Nguyễn An');
    await actor.type(screen.getByLabelText('Số điện thoại *'), '0901234567');
    await actor.click(screen.getByRole('button', { name: 'Xác nhận đặt vé' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Máy chủ đang gặp sự cố',
    );
    expect(screen.getByLabelText('Họ và tên *')).toHaveValue('Nguyễn An');
    await actor.click(screen.getByRole('button', { name: 'Xác nhận đặt vé' }));
    const bodies = fetchMock.mock.calls
      .filter(([, options]) => options?.method === 'POST')
      .map(([, options]) => JSON.parse(options.body));
    expect(bodies).toHaveLength(2);
    expect(bodies[1]).toEqual(bodies[0]);
    expect(bodies[0].passengers).toEqual([
      { passenger_name: 'Nguyễn An', contact_phone: '0901234567' },
    ]);
  });
  it('AC-1 rejects the same station without asking for trips and retries a failed station catalog', async () => {
    const actor = userEvent.setup();
    const stations = [
      { id: '1', name: 'Bến đầu' },
      { id: '3', name: 'Bến cuối' },
    ];
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Không tải được bến' }),
      })
      .mockImplementation(() => response(stations));
    render(<BookingSearchPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Máy chủ đang gặp sự cố',
    );
    await actor.click(screen.getByRole('button', { name: 'Thử tải lại bến' }));
    await within(screen.getByLabelText('Điểm đi *')).findByRole('option', {
      name: 'Bến đầu',
    });
    await actor.selectOptions(screen.getByLabelText('Điểm đi *'), '1');
    await actor.selectOptions(screen.getByLabelText('Điểm đến *'), '1');
    await actor.click(screen.getByRole('button', { name: 'Tìm chuyến xe' }));
    expect(screen.getByRole('alert')).toHaveTextContent('phải khác nhau');
    expect(
      fetchMock.mock.calls.every(([url]) =>
        url.includes('/passenger/stations'),
      ),
    ).toBe(true);
  });
  it('AC-4 shows the actual receipt without claiming payment or email delivery', async () => {
    window.history.replaceState(
      null,
      '',
      '/user/bookings/success?request=00000000-0000-4000-8000-000000000000',
    );
    fetchMock.mockImplementation(() =>
      response([
        ticket,
        {
          ...ticket,
          id: '21',
          booking_code: 'GBTEST-00002',
          passenger_name: 'Trần Bình',
        },
      ]),
    );
    render(<BookingSuccessPage />);
    expect(
      await screen.findByRole('heading', { name: 'Đặt vé thành công!' }),
    ).toBeVisible();
    expect(screen.getByText('18.000 đ')).toBeVisible();
    expect(screen.getByRole('link', { name: /Trần Bình/ })).toHaveAttribute(
      'href',
      '/user/tickets/21',
    );
    expect(
      screen.queryByText(/đã thanh toán|đã gửi qua email/i),
    ).not.toBeInTheDocument();
  });
  it('AC-5 keeps the selected filter usable and refetches a different status', async () => {
    const actor = userEvent.setup();
    fetchMock.mockImplementation((url) =>
      response({
        items: url.includes('filter=CANCELLED') ? [] : [ticket],
        total: 1,
        totalPages: 1,
      }),
    );
    render(<MyTicketsPage />);
    await screen.findByRole('link', { name: 'Xem chi tiết' });
    await actor.click(screen.getByRole('button', { name: 'Tất cả' }));
    expect(screen.getByRole('link', { name: 'Xem chi tiết' })).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Đã hủy' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Chưa có vé trong danh sách này',
      }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Đã hủy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
  it('AC-5 returns to available tickets after cancelling the last ticket on a filtered page', async () => {
    const actor = userEvent.setup();
    let cancelled = false;
    fetchMock.mockImplementation((url, options) => {
      if (options?.method === 'PATCH') {
        cancelled = true;
        return response({ ...ticket, status: 'CANCELLED', can_cancel: false });
      }
      const params = new URL(url, 'http://localhost').searchParams;
      const secondPage = params.get('page') === '2';
      return response({
        items: secondPage
          ? cancelled
            ? []
            : [ticket]
          : [{ ...ticket, id: '19', booking_code: 'GBEARLIER-00001' }],
        total: cancelled ? 10 : 11,
        totalPages: cancelled ? 1 : 2,
      });
    });
    render(<MyTicketsPage />);
    await screen.findByRole('link', { name: 'Xem chi tiết' });
    await actor.click(screen.getByRole('button', { name: 'Đã đặt' }));
    await screen.findByText('GBEARLIER-00001');
    await actor.click(screen.getByRole('button', { name: 'Sau' }));
    await screen.findByText('GBTEST-00001');
    await actor.click(screen.getByRole('button', { name: 'Hủy vé' }));
    await actor.click(screen.getByRole('button', { name: 'Có, hủy vé' }));
    expect(await screen.findByText('GBEARLIER-00001')).toBeVisible();
    expect(
      screen.queryByText('Chưa có vé trong danh sách này'),
    ).not.toBeInTheDocument();
  });
  it('AC-6 displays the QR and cancels only after confirming the dialog', async () => {
    const actor = userEvent.setup();
    fetchMock.mockImplementation((url, options) =>
      response(
        options?.method === 'PATCH'
          ? {
              ...ticket,
              status: 'CANCELLED',
              display_status: 'CANCELLED',
              can_cancel: false,
              cancelled_at: '2026-10-02T01:00:00Z',
            }
          : ticket,
      ),
    );
    render(<TicketDetailPage id="20" />);
    expect(
      await screen.findByRole('img', { name: 'Mã QR vé GBTEST-00001' }),
    ).toBeVisible();
    await actor.click(screen.getByRole('button', { name: 'Hủy vé này' }));
    const dialog = screen.getByRole('dialog', { name: 'Hủy vé này?' });
    await actor.click(within(dialog).getByRole('button', { name: 'Không' }));
    expect(
      fetchMock.mock.calls.some(([, options]) => options?.method === 'PATCH'),
    ).toBe(false);
    await actor.click(screen.getByRole('button', { name: 'Hủy vé này' }));
    await actor.click(screen.getByRole('button', { name: 'Có, hủy vé' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Số chỗ đã được hoàn lại',
    );
    expect(
      screen.queryByRole('button', { name: 'Hủy vé này' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('AC-7 reports an inaccessible ticket and allows retry', async () => {
    fetchMock.mockImplementationOnce(() =>
      response({ message: 'Không tìm thấy vé của bạn.' }, 404),
    );
    render(<TicketDetailPage id="999" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không tìm thấy vé của bạn',
    );
    fetchMock.mockImplementation(() => response(ticket));
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByRole('img')).toBeVisible();
  });
});
