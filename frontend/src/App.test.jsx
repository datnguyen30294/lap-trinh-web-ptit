import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { authApi } from './services/stationsApi';

vi.mock('./services/stationsApi', () => ({
  authApi: { me: vi.fn(), login: vi.fn(), logout: vi.fn() },
}));
vi.mock('./pages/UserHomePage', () => ({
  default: ({ user, onLogout, logoutBusy, logoutError }) => (
    <main>
      <h1>Trang chủ hành khách</h1>
      <p>{user.full_name}</p>
      {logoutError && <p role="alert">{logoutError}</p>}
      <button disabled={logoutBusy} onClick={onLogout}>
        Đăng xuất
      </button>
    </main>
  ),
}));
vi.mock('./pages/StationsPage', () => ({
  default: () => <h1>Danh sách bến xe</h1>,
}));
vi.mock('./pages/RoutesPage', () => ({
  default: () => <h1>Danh sách tuyến xe</h1>,
}));
vi.mock('./pages/SchedulesPage', () => ({
  default: () => <h1>Danh sách lịch trình</h1>,
}));
const user = { id: '1', full_name: 'Người dùng GoBus', role: 'USER' };
const admin = { ...user, role: 'ADMIN' };
const unauthorized = Object.assign(new Error('Phiên hết hạn'), { status: 401 });
beforeEach(() => {
  vi.resetAllMocks();
  window.history.replaceState(null, '', '/');
  authApi.me.mockResolvedValue(user);
  authApi.login.mockResolvedValue(user);
  authApi.logout.mockResolvedValue({});
});
async function submitLogin() {
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText('Email'), 'member@example.test');
  await actor.type(screen.getByLabelText('Mật khẩu'), 'test-password');
  await actor.click(
    screen.getByRole('button', { name: 'Đăng nhập', exact: true }),
  );
}
describe('Authentication and role navigation', () => {
  it.each(['/', '/login', '/stations', '/routes', '/schedules', '/user/home'])(
    'restores USER at %s without rendering administration',
    async (path) => {
      window.history.replaceState(null, '', path);
      render(<App />);
      expect(screen.queryByText('GOBUS')).not.toBeInTheDocument();
      await screen.findByRole('heading', { name: 'Trang chủ hành khách' });
      await waitFor(() => expect(window.location.pathname).toBe('/user/home'));
      expect(
        screen.queryByRole('navigation', { name: 'Quản trị' }),
      ).not.toBeInTheDocument();
    },
  );
  it('waits for the session and shows a retryable connection error', async () => {
    let reject;
    authApi.me.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Đang kiểm tra phiên');
    await act(async () => reject(new Error('Không có kết nối')));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không có kết nối',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('heading', { name: 'Trang chủ hành khách' });
  });
  it('redirects an unauthenticated visitor and logs USER into the passenger home', async () => {
    authApi.me.mockRejectedValue(unauthorized);
    window.history.replaceState(null, '', '/schedules');
    render(<App />);
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    expect(window.location.pathname).toBe('/login');
    await submitLogin();
    await screen.findByText(user.full_name);
    expect(window.location.pathname).toBe('/user/home');
  });
  it.each([
    ['/routes', 'Danh sách tuyến xe'],
    ['/schedules', 'Danh sách lịch trình'],
    ['/stations', 'Danh sách bến xe'],
  ])('keeps ADMIN deep links at %s', async (path, title) => {
    authApi.me.mockResolvedValue(admin);
    window.history.replaceState(null, '', path);
    render(<App />);
    await screen.findByRole('heading', { name: title });
    expect(window.location.pathname).toBe(path);
  });
  it('remembers a protected admin destination through login', async () => {
    authApi.me.mockRejectedValue(unauthorized);
    authApi.login.mockResolvedValue(admin);
    window.history.replaceState(null, '', '/routes');
    render(<App />);
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    await submitLogin();
    await screen.findByRole('heading', { name: 'Danh sách tuyến xe' });
    expect(window.location.pathname).toBe('/routes');
  });
  it('uses /stations for a fresh ADMIN login', async () => {
    authApi.me.mockRejectedValue(unauthorized);
    authApi.login.mockResolvedValue(admin);
    render(<App />);
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    await submitLogin();
    await screen.findByRole('heading', { name: 'Danh sách bến xe' });
    expect(window.location.pathname).toBe('/stations');
  });
  it('handles failed login without redirecting', async () => {
    authApi.me.mockRejectedValue(unauthorized);
    authApi.login.mockRejectedValue(
      new Error('Email hoặc mật khẩu không đúng.'),
    );
    render(<App />);
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    await submitLogin();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email hoặc mật khẩu không đúng.',
    );
    expect(window.location.pathname).toBe('/login');
  });
  it('keeps the current session on logout failure, then allows retry', async () => {
    authApi.logout.mockRejectedValueOnce(new Error('Không thể đăng xuất'));
    render(<App />);
    await screen.findByText(user.full_name);
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể đăng xuất',
    );
    expect(window.location.pathname).toBe('/user/home');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    expect(window.location.pathname).toBe('/login');
    expect(screen.getByRole('status')).toHaveTextContent('Đã đăng xuất.');
  });
  it('handles API session expiration and browser Back without exposing cached content', async () => {
    render(<App />);
    await screen.findByText(user.full_name);
    act(() => window.dispatchEvent(new Event('gobus:session-expired')));
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Phiên đăng nhập hết hạn',
    );
    act(() => {
      window.history.pushState(null, '', '/stations');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
    expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
  });
  it('rechecks session on focus and rejects stale responses after logout', async () => {
    render(<App />);
    await screen.findByText(user.full_name);
    let resolve;
    authApi.me.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    act(() => window.dispatchEvent(new Event('focus')));
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    await act(async () => resolve(user));
    expect(screen.queryByText(user.full_name)).not.toBeInTheDocument();
  });
  it('detects a revoked session when returning to the window', async () => {
    render(<App />);
    await screen.findByText(user.full_name);
    authApi.me.mockRejectedValue(unauthorized);
    act(() => window.dispatchEvent(new Event('focus')));
    await screen.findByRole('heading', { name: 'Đăng nhập GoBus' });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Phiên đăng nhập hết hạn',
    );
  });
  it.each(['USER', 'ADMIN'])(
    'shows 404 for unknown routes for %s',
    async (role) => {
      authApi.me.mockResolvedValue({ ...user, role });
      window.history.replaceState(null, '', '/routes-not-a-page');
      render(<App />);
      await screen.findByRole('heading', { name: 'Không tìm thấy trang' });
      expect(
        screen.queryByRole('navigation', { name: 'Quản trị' }),
      ).not.toBeInTheDocument();
    },
  );
  it('never grants access for an unknown role', async () => {
    authApi.me.mockResolvedValue({ ...user, role: undefined });
    render(<App />);
    await screen.findByRole('heading', {
      name: 'Tài khoản không có quyền truy cập',
    });
    expect(screen.queryByText('Trang chủ hành khách')).not.toBeInTheDocument();
  });
});
