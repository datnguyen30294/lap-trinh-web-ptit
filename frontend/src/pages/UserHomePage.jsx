import AppLink from '../components/AppLink';
import { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/manrope';
import { passengerApi } from '../services/passengerApi';
import PassengerRouteResults from '../components/PassengerRouteResults';
import StationDialog from '../components/stations/StationDialog';
import './user-home.css';

const asset = (name) => `/home/${name}.svg`;
const values = [
  [
    'imgLeaf',
    '0% Phát thải',
    'Động cơ điện thông minh hoàn toàn không sinh khí thải độc hại, góp phần bảo vệ môi trường đô thị xanh sạch.',
  ],
  [
    'imgVolume2',
    '0% Tiếng ồn',
    'Công nghệ vận hành êm ái vượt trội mang lại không gian thư giãn yên tĩnh tuyệt đối cho hành khách suốt hành trình.',
  ],
  [
    'imgShieldCheck',
    'Chuẩn dịch vụ 5★',
    'Đội ngũ tài xế, tiếp viên được đào tạo chuyên nghiệp cùng các tiện ích hiện đại như Wifi miễn phí, cổng sạc USB.',
  ],
];

export default function UserHomePage({
  user,
  onLogout,
  logoutBusy,
  logoutError,
}) {
  const [catalog, setCatalog] = useState({
    loading: true,
    stations: [],
    routes: [],
    error: '',
  });
  const [attempt, setAttempt] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [formError, setFormError] = useState('');
  const [criteria, setCriteria] = useState(null);
  const [notice, setNotice] = useState('');
  const startRef = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      passengerApi.stations(controller.signal),
      passengerApi.routes({ limit: 2 }, controller.signal),
    ])
      .then(([stations, routes]) =>
        setCatalog({
          loading: false,
          stations,
          routes: routes.items,
          error: '',
        }),
      )
      .catch((error) => {
        if (!controller.signal.aborted)
          setCatalog({
            loading: false,
            stations: [],
            routes: [],
            error: error.message,
          });
      });
    return () => controller.abort();
  }, [attempt]);
  function findRoute() {
    startRef.current?.scrollIntoView({ block: 'center' });
    startRef.current?.focus();
  }
  function search(event) {
    event.preventDefault();
    if (from === to) {
      setFormError('Điểm xuất phát và điểm đến phải khác nhau.');
      return;
    }
    setFormError('');
    setCriteria({ from_station_id: from, to_station_id: to });
  }
  function unavailable(label) {
    setNotice(label);
  }
  return (
    <div className="user-home" data-figma-node="102:3">
      <AppLink className="skip-link" href="#user-main">
        Đến nội dung chính
      </AppLink>
      <div className="home-utility">
        <span>
          <img src={asset('imgBus')} alt="" />
          GoBus - Vì tương lai xanh cho mọi người
        </span>
        <span>
          <AppLink href="tel:0522077841">
            <img src={asset('imgPhone')} alt="" />
            Hotline: 0522077841
          </AppLink>
          <img className="home-utility-divider" src={asset('imgLine')} alt="" />
        </span>
      </div>
      <header className="home-header">
        <AppLink
          className="home-brand"
          href="/user/home"
          aria-label="GoBus — Trang chủ"
        >
          <strong className="home-logo">GoBus</strong>
          <span>
            <b>DI CHUYỂN XANH</b>
            <small>GoBus ECO-SYSTEM</small>
          </span>
        </AppLink>
        <nav className="home-nav" aria-label="Điều hướng người dùng">
          <AppLink href="/user/home" aria-current="page">
            Trang chủ
          </AppLink>
          <AppLink href="/user/journey-planner">Lộ trình &amp; Bản đồ</AppLink>
          <AppLink href="/user/bookings">Mua vé</AppLink>
        </nav>
        <div className="home-account">
          <AppLink href="/user/tickets">Vé của tôi</AppLink>
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
        <div className="alert alert-error home-logout-error" role="alert">
          {logoutError}
        </div>
      )}
      <main id="user-main" tabIndex={-1}>
        <section className="home-hero" aria-labelledby="home-title">
          <img
            className="home-hero-image"
            src="/home/imgImage2.png"
            alt=""
            fetchPriority="high"
          />
          <div className="home-hero-overlay" />
          <div className="home-hero-copy">
            <span className="home-badge">
              DỊCH VỤ XE BUÝT ĐIỆN ĐẦU TIÊN TẠI VIỆT NAM
            </span>
            <h1 id="home-title">
              Hành Trình Xanh,
              <br />
              <em>Cuộc Sống Số</em>
            </h1>
            <p>
              Trải nghiệm hệ thống giao thông công cộng văn minh, không khí
              thải, không tiếng ồn cùng chất lượng dịch vụ chuẩn 5 sao.
            </p>
          </div>
          <div className="home-search-area">
            <form
              className="home-search"
              onSubmit={search}
              aria-labelledby="home-search-title"
            >
              <div className="home-search-heading">
                <h2 id="home-search-title">Tìm kiếm lộ trình</h2>
                <p>
                  Lên kế hoạch hành trình xanh của bạn với GoBus nhanh chóng
                </p>
              </div>
              <div className="home-search-fields">
                <label className="home-field">
                  <span>Điểm xuất phát</span>
                  <span className="home-input">
                    <img src={asset('imgMapPin')} alt="" />
                    <select
                      ref={startRef}
                      value={from}
                      onChange={(event) => {
                        setFrom(event.target.value);
                        setFormError('');
                      }}
                      required
                      disabled={
                        catalog.loading ||
                        !!catalog.error ||
                        !catalog.stations.length
                      }
                    >
                      <option value="">Nhập vị trí hoặc chọn điểm đi...</option>
                      {catalog.stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name} ({station.code})
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <label className="home-field">
                  <span>Điểm đến</span>
                  <span className="home-input">
                    <img src={asset('imgFlag')} alt="" />
                    <select
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value);
                        setFormError('');
                      }}
                      required
                      disabled={
                        catalog.loading ||
                        !!catalog.error ||
                        !catalog.stations.length
                      }
                    >
                      <option value="">Nhập nơi bạn muốn đến...</option>
                      {catalog.stations.map((station) => (
                        <option key={station.id} value={station.id}>
                          {station.name} ({station.code})
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
                <div className="home-suggestions" aria-label="Tuyến gợi ý">
                  {catalog.loading ? (
                    <span role="status">Đang tải tuyến xe…</span>
                  ) : (
                    catalog.routes.map((route) => (
                      <button
                        className="home-pill"
                        type="button"
                        key={route.id}
                        onClick={() => setCriteria({ route_id: route.id })}
                      >
                        Tuyến {route.code}
                      </button>
                    ))
                  )}
                  {!catalog.loading && !catalog.error && (
                    <button
                      className="home-pill home-pill-all"
                      type="button"
                      onClick={() => setCriteria({})}
                    >
                      Xem tất cả tuyến
                    </button>
                  )}
                </div>
              </div>
              {catalog.error && (
                <div className="home-inline-error" role="alert">
                  {catalog.error}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setCatalog({
                        loading: true,
                        stations: [],
                        routes: [],
                        error: '',
                      });
                      setAttempt(attempt + 1);
                    }}
                  >
                    Thử lại
                  </button>
                </div>
              )}
              {!catalog.loading &&
                !catalog.error &&
                !catalog.stations.length && (
                  <p role="status">Chưa có tuyến xe đang hoạt động.</p>
                )}
              {formError && (
                <p className="home-inline-error" role="alert">
                  {formError}
                </p>
              )}
              <button
                className="home-button home-search-submit"
                disabled={
                  catalog.loading || !!catalog.error || !catalog.stations.length
                }
              >
                <img src={asset('imgSearch')} alt="" />
                Tìm kiếm lộ trình nhanh
              </button>
            </form>
            <div className="home-hero-actions">
              <AppLink className="home-button" href="/user/bookings">
                Đặt vé ngay
              </AppLink>
              <button
                className="home-button home-button-outline"
                onClick={findRoute}
              >
                Tìm Đường
              </button>
            </div>
          </div>
        </section>
        <section className="home-values" aria-labelledby="home-values-title">
          <div className="home-values-title">
            <h2 id="home-values-title">Khác Biệt Đến Từ Xe Buýt GoBus</h2>
            <p>
              GoBus không chỉ là phương tiện di chuyển, đó là phong cách sống
              văn minh và trách nhiệm với tương lai xanh của cộng đồng.
            </p>
          </div>
          <div className="home-value-grid">
            {values.map(([icon, title, description]) => (
              <article className="home-value-card" key={icon}>
                <div className="home-value-icon">
                  <img src={asset(icon)} alt="" />
                </div>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="home-footer">
        <div className="home-footer-columns">
          <div className="home-company">
            <AppLink className="home-brand" href="/user/home">
              <strong className="home-logo">GoBus</strong>
              <b>DI CHUYỂN XANH</b>
            </AppLink>
            <div>
              <p>
                Công ty TNHH Dịch vụ Vận tải Sinh thái GoBus - Thành viên của
                Tập đoàn GoBus.
              </p>
              <p>Văn phòng ĐKKD: 18No5 khu tái định cư triều khúc</p>
            </div>
          </div>
          <div className="home-footer-links">
            <h3>Dịch vụ của chúng tôi</h3>
            <button onClick={findRoute}>Tìm kiếm lộ trình</button>
            {['Bản đồ tuyến xe', 'Giá vé & Loại thẻ'].map((label) => (
              <button key={label} onClick={() => unavailable(label)}>
                {label}
              </button>
            ))}
          </div>
          <div className="home-footer-links">
            <h3>Về GoBus</h3>
            {[
              'Về chúng tôi',
              'Hệ sinh thái GoBus',
              'Tin tức & Hoạt động',
              'Tuyển dụng tài xế',
            ].map((label) => (
              <button key={label} onClick={() => unavailable(label)}>
                {label}
              </button>
            ))}
          </div>
          <div className="home-contact">
            <h3>Liên kết với GoBus</h3>
            <div className="home-social">
              {[
                ['imgFacebook', 'Facebook'],
                ['imgYoutube', 'YouTube'],
                ['imgLinkedin', 'LinkedIn'],
              ].map(([icon, label]) => (
                <button
                  key={icon}
                  aria-label={`${label} — sắp có`}
                  onClick={() => unavailable(label)}
                >
                  <img src={asset(icon)} alt="" />
                </button>
              ))}
            </div>
            <p>
              Nhận thông tin cập nhật mới nhất từ fanpage chính thức của GoBus.
            </p>
          </div>
        </div>
        <div className="home-footer-divider">
          <img src={asset('imgLine1')} alt="" />
        </div>
        <div className="home-footer-bottom">
          <p>
            © 2024 GoBus. Bản quyền thuộc về Công ty TNHH Dịch vụ Vận tải Sinh
            thái GoBus.
          </p>
          <div>
            {['Điều khoản sử dụng', 'Chính sách bảo mật'].map((label) => (
              <button key={label} onClick={() => unavailable(label)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>
      {criteria && (
        <PassengerRouteResults
          criteria={criteria}
          onClose={() => setCriteria(null)}
        />
      )}
      {notice && (
        <StationDialog
          title={`${notice} — Sắp có`}
          onClose={() => setNotice('')}
          className="passenger-dialog"
        >
          <p className="dialog-description">
            Chức năng này chưa được triển khai. Bạn có thể tra cứu các tuyến xe
            đang hoạt động ngay trên trang chủ.
          </p>
          <button className="home-button" onClick={() => setNotice('')}>
            Đã hiểu
          </button>
        </StationDialog>
      )}
    </div>
  );
}
