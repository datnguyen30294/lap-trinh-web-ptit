import { useEffect, useState } from 'react';
import StationsPage from './pages/StationsPage';
import LoginPage from './pages/LoginPage';
import { authApi } from './services/stationsApi';

export default function App() {
  const [session, setSession] = useState({
    loading: true,
    user: null,
    error: '',
  });
  const [message, setMessage] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  function loadSession() {
    authApi
      .me()
      .then((user) => setSession({ loading: false, user, error: '' }))
      .catch((error) =>
        setSession({
          loading: false,
          user: null,
          error: error.status === 401 ? '' : error.message,
        }),
      );
  }
  useEffect(() => {
    loadSession();
    function expired() {
      setSession({ loading: false, user: null, error: '' });
      setMessage('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
    }
    window.addEventListener('gobus:session-expired', expired);
    return () => window.removeEventListener('gobus:session-expired', expired);
  }, []);
  async function logout() {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await authApi.logout();
      setSession({ loading: false, user: null, error: '' });
      setMessage('Đã đăng xuất.');
    } catch (error) {
      setLogoutError(error.message);
    } finally {
      setLogoutBusy(false);
    }
  }
  if (session.loading)
    return (
      <main className="app-state" role="status">
        Đang kiểm tra phiên đăng nhập…
      </main>
    );
  if (session.error)
    return (
      <main className="app-state">
        <h1>Không thể kết nối GoBus</h1>
        <p role="alert">{session.error}</p>
        <button className="button" onClick={loadSession}>
          Thử lại
        </button>
      </main>
    );
  if (!session.user)
    return (
      <LoginPage
        message={message}
        onLogin={(user) => setSession({ loading: false, user, error: '' })}
      />
    );
  const user = session.user;
  return (
    <div className="admin-app">
      <a href="#main-content" className="skip-link">
        Đến nội dung chính
      </a>
      <header className="topbar">
        <a className="wordmark" href="/stations">
          GOBUS <span>ADMIN</span>
        </a>
        <div className="user-menu">
          <span>{user.full_name}</span>
          <span className="user-avatar">
            <img src="/icons/user.svg" alt="" />
          </span>
          <button className="button" disabled={logoutBusy} onClick={logout}>
            {logoutBusy ? 'Đang thoát…' : 'Đăng xuất'}
          </button>
        </div>
      </header>
      {logoutError && (
        <div className="alert alert-error" role="alert">
          {logoutError}
        </div>
      )}
      {user.role !== 'ADMIN' ? (
        <main className="app-state" id="main-content">
          <h1>Bạn không có quyền quản trị</h1>
          <p>
            Tài khoản này chưa có quyền ADMIN. Hãy đăng xuất và sử dụng tài
            khoản quản trị.
          </p>
        </main>
      ) : (
        <div className="admin-body">
          <aside className="sidebar">
            <nav aria-label="Quản trị">
              {[
                ['gitbranch', 'Quản lý tuyến xe'],
                ['calendar', 'Quản lý lịch trình'],
              ].map(([icon, label]) => (
                <span
                  className="nav-item unavailable"
                  key={icon}
                  title="Chưa triển khai trong module này"
                  aria-disabled="true"
                >
                  <img src={`/icons/${icon}.svg`} alt="" />
                  {label}
                </span>
              ))}
              <a
                href="/stations"
                className="nav-item selected"
                aria-current="page"
              >
                <img src="/icons/mappin.svg" alt="" />
                Quản lý bến xe
              </a>
              <span
                className="nav-item unavailable"
                title="Chưa triển khai trong module này"
                aria-disabled="true"
              >
                <img src="/icons/tag.svg" alt="" />
                Quản lý giá vé
              </span>
            </nav>
          </aside>
          <StationsPage />
        </div>
      )}
    </div>
  );
}
