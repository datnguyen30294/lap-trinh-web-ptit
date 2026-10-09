import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import SchedulesPage from './pages/SchedulesPage';
import RoutesPage from './pages/RoutesPage';
import StationsPage from './pages/StationsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UserHomePage from './pages/UserHomePage';
import BookingLayout from './components/bookings/BookingLayout';
import BookingSearchPage from './pages/BookingSearchPage';
import BookingPage from './pages/BookingPage';
import BookingSuccessPage from './pages/BookingSuccessPage';
import MyTicketsPage from './pages/MyTicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import JourneyPlannerPage from './pages/JourneyPlannerPage';
import { authApi } from './services/stationsApi';
import {
  adminPaths,
  currentPath,
  currentLocation,
  homePath,
  navigate,
  resolvePath,
  subscribePath,
} from './utils/navigation';

export default function App() {
  const location = useSyncExternalStore(subscribePath, currentLocation);
  const path = location.split('?')[0];
  const initialAdminPath = useRef(
    adminPaths.includes(currentPath()) ? currentPath() : null,
  );
  const sessionRequest = useRef(0);
  const invalidateSessionRequest = useCallback(() => {
    sessionRequest.current++;
  }, []);
  const [session, setSession] = useState({
    loading: true,
    user: null,
    error: '',
    message: '',
  });
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const loadSession = useCallback(() => {
    const requestId = ++sessionRequest.current;
    authApi
      .me()
      .then((user) => {
        if (requestId === sessionRequest.current)
          setSession({ loading: false, user, error: '', message: '' });
      })
      .catch((error) => {
        if (requestId !== sessionRequest.current) return;
        setSession((previous) => ({
          loading: false,
          user: null,
          error: error.status === 401 ? '' : error.message,
          message:
            error.status === 401 && previous.user
              ? 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
              : previous.message,
        }));
      });
  }, [setSession]);
  useEffect(() => {
    loadSession();
    function expired() {
      invalidateSessionRequest();
      setSession({
        loading: false,
        user: null,
        error: '',
        message: 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.',
      });
      setLogoutError('');
    }
    function visible() {
      if (document.visibilityState === 'visible') loadSession();
    }
    window.addEventListener('gobus:session-expired', expired);
    window.addEventListener('focus', loadSession);
    window.addEventListener('pageshow', loadSession);
    document.addEventListener('visibilitychange', visible);
    return () => {
      invalidateSessionRequest();
      window.removeEventListener('gobus:session-expired', expired);
      window.removeEventListener('focus', loadSession);
      window.removeEventListener('pageshow', loadSession);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [loadSession, invalidateSessionRequest]);
  const destination = resolvePath(path, session.user);
  useEffect(() => {
    if (!session.loading && !session.error && destination !== path)
      navigate(destination);
  }, [destination, path, session.loading, session.error]);
  const passengerReady =
    !session.loading && !!session.user && path.startsWith('/user/');
  useEffect(() => {
    if (!passengerReady) return;
    const main =
      document.getElementById('booking-main') ||
      document.getElementById('user-main');
    const hashTarget =
      window.location.hash &&
      document.getElementById(window.location.hash.slice(1));
    if (hashTarget) hashTarget.scrollIntoView();
    else window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    main?.focus({ preventScroll: true });
  }, [location, passengerReady]);
  function login(user) {
    sessionRequest.current++;
    setLogoutError('');
    setSession({ loading: false, user, error: '', message: '' });
    navigate(
      user.role === 'ADMIN'
        ? initialAdminPath.current || '/stations'
        : homePath(user.role) || '/login',
    );
    initialAdminPath.current = null;
  }
  async function logout() {
    setLogoutBusy(true);
    setLogoutError('');
    try {
      await authApi.logout();
      sessionRequest.current++;
      initialAdminPath.current = null;
      setSession({
        loading: false,
        user: null,
        error: '',
        message: 'Đã đăng xuất.',
      });
      navigate('/login');
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
    return destination === '/register' ? (
      <RegisterPage onRegister={login} />
    ) : (
      <LoginPage message={session.message} onLogin={login} />
    );
  const user = session.user;
  if (!homePath(user.role))
    return (
      <main className="app-state">
        <h1>Tài khoản không có quyền truy cập</h1>
        <p>Vai trò tài khoản không hợp lệ. Vui lòng liên hệ quản trị viên.</p>
        {logoutError && <p role="alert">{logoutError}</p>}
        <button className="button" onClick={logout} disabled={logoutBusy}>
          Đăng xuất
        </button>
      </main>
    );
  const bookingPages = {
    '/user/bookings': ['Đặt vé trực tuyến', <BookingSearchPage />],
    '/user/bookings/new': ['Xác nhận đặt vé', <BookingPage user={user} />],
    '/user/bookings/success': ['Đặt vé thành công', <BookingSuccessPage />],
    '/user/tickets': ['Vé của tôi', <MyTicketsPage />],
  };
  const ticketMatch = destination.match(
    /^\/user\/tickets\/([1-9][0-9]{0,19})$/,
  );
  const bookingPage =
    bookingPages[destination] ||
    (ticketMatch && ['Chi tiết vé', <TicketDetailPage id={ticketMatch[1]} />]);
  if (bookingPage)
    return (
      <BookingLayout
        user={user}
        title={bookingPage[0]}
        onLogout={logout}
        logoutBusy={logoutBusy}
        logoutError={logoutError}
      >
        <div key={location} className="booking-view">
          {bookingPage[1]}
        </div>
      </BookingLayout>
    );
  if (
    destination !== '/user/home' &&
    destination !== '/user/journey-planner' &&
    !adminPaths.includes(destination)
  )
    return (
      <main className="app-state">
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại trong GoBus.</p>
        <a className="button" href={homePath(user.role)}>
          Về trang chủ
        </a>
      </main>
    );
  if (destination === '/user/journey-planner')
    return (
      <JourneyPlannerPage
        user={user}
        onLogout={logout}
        logoutBusy={logoutBusy}
        logoutError={logoutError}
      />
    );
  if (user.role === 'USER')
    return (
      <UserHomePage
        user={user}
        onLogout={logout}
        logoutBusy={logoutBusy}
        logoutError={logoutError}
      />
    );
  const schedulesPage = destination === '/schedules';
  const routesPage = destination === '/routes';
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
      <div className="admin-body">
        <aside className="sidebar">
          <nav aria-label="Quản trị">
            <a
              href="/routes"
              className={`nav-item ${routesPage ? 'selected' : ''}`}
              aria-current={routesPage ? 'page' : undefined}
            >
              <img src="/icons/gitbranch.svg" alt="" />
              Quản lý tuyến xe
            </a>
            <a
              href="/schedules"
              className={`nav-item ${schedulesPage ? 'selected' : ''}`}
              aria-current={schedulesPage ? 'page' : undefined}
            >
              <img src="/icons/calendar.svg" alt="" />
              Quản lý lịch trình
            </a>
            <a
              href="/stations"
              className={`nav-item ${!routesPage && !schedulesPage ? 'selected' : ''}`}
              aria-current={!routesPage && !schedulesPage ? 'page' : undefined}
            >
              <img src="/icons/mappin.svg" alt="" />
              Quản lý bến xe
            </a>
          </nav>
        </aside>
        {schedulesPage ? (
          <SchedulesPage />
        ) : routesPage ? (
          <RoutesPage />
        ) : (
          <StationsPage />
        )}
      </div>
    </div>
  );
}
