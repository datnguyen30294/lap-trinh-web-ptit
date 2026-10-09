import AppLink from '../AppLink';
import { useEffect } from 'react';
import '@fontsource-variable/manrope';
import '../../pages/user-home.css';
import '../../pages/bookings.css';

export default function BookingLayout({
  user,
  title,
  children,
  onLogout,
  logoutBusy,
  logoutError,
}) {
  useEffect(() => {
    document.title = `${title} | GoBus`;
  }, [title]);
  return (
    <div className="booking-app">
      <AppLink href="#booking-main" className="skip-link">
        Đến nội dung chính
      </AppLink>
      <header className="booking-header user-home">
        <AppLink
          className="home-brand"
          href="/user/home"
          aria-label="GoBus, trang chủ"
        >
          <strong className="home-logo">GoBus</strong>
          <span>
            <b>DI CHUYỂN XANH</b>
            <small>GoBus ECO-SYSTEM</small>
          </span>
        </AppLink>
        <nav className="booking-nav" aria-label="Điều hướng hành khách">
          <AppLink href="/user/home">Trang chủ</AppLink>
          <AppLink href="/user/journey-planner">Lộ trình &amp; Bản đồ</AppLink>
          <AppLink href="/user/bookings" aria-current="page">
            Mua vé
          </AppLink>
        </nav>
        <div className="home-account">
          <AppLink href="/user/tickets">Vé của tôi</AppLink>
          {user.role === 'ADMIN' && (
            <AppLink href="/stations">Quản trị</AppLink>
          )}
          <span title={user.full_name}>{user.full_name}</span>
          <button
            className="home-button"
            onClick={onLogout}
            disabled={logoutBusy}
          >
            {logoutBusy ? 'Đang thoát…' : 'Đăng xuất'}
          </button>
        </div>
      </header>
      {logoutError && (
        <p className="booking-message error" role="alert">
          {logoutError}
        </p>
      )}
      <main id="booking-main" className="booking-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
