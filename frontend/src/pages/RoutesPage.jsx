import { useEffect, useState } from 'react';
import { routesApi } from '../services/routesApi';
import StationStatus from '../components/stations/StationStatus';
import RouteStatusDialog from '../components/routes/RouteStatusDialog';
import RouteForm from '../components/routes/RouteForm';
import RouteDetail from '../components/routes/RouteDetail';
export default function RoutesPage() {
  const [query, setQuery] = useState({
    page: 1,
    limit: 10,
    search: '',
    status: '',
  });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [view, setView] = useState({ type: 'list' });
  const [route, setRoute] = useState(null);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    document.title = 'Quản lý tuyến xe | GoBus';
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const task =
      view.type === 'list'
        ? routesApi.list(query, controller.signal)
        : view.id
          ? routesApi.detail(view.id, controller.signal)
          : Promise.resolve(null);
    task
      .then((data) => {
        if (controller.signal.aborted) return;
        if (view.type === 'list') {
          if (query.page > Math.max(1, data.totalPages)) {
            setQuery((q) => ({ ...q, page: Math.max(1, data.totalPages) }));
            return;
          }
          setResult(data);
        } else setRoute(data);
        setError('');
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, revision, view]);
  function go(type, id) {
    setLoading(true);
    setError('');
    setRoute(null);
    setView({ type, id });
  }
  function filter(patch) {
    setLoading(true);
    setQuery((q) => ({ ...q, ...patch }));
  }
  function reload(message) {
    setNotice(message);
    setModal(null);
    go('list');
    setRevision((v) => v + 1);
  }
  async function save(body) {
    if (view.id) await routesApi.update(view.id, body);
    else await routesApi.create(body);
    reload(view.id ? 'Đã cập nhật tuyến xe.' : 'Đã thêm tuyến xe thành công.');
  }
  return (
    <main id="main-content" className="stations-page routes-page">
      <p className="breadcrumb">
        Hệ thống <span>/</span>{' '}
        <button onClick={() => go('list')}>Quản lý tuyến xe</button>{' '}
        <span>/</span>{' '}
        {view.type === 'list'
          ? 'Danh sách tuyến'
          : view.type === 'detail'
            ? 'Chi tiết tuyến'
            : view.id
              ? 'Cập nhật tuyến xe'
              : 'Thêm tuyến mới'}
      </p>
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
          <button
            className="icon-button"
            aria-label="Đóng thông báo"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      )}
      {view.type === 'list' && (
        <>
          <div className="page-heading">
            <div>
              <h1>Danh sách tuyến xe</h1>
              <p className="muted">
                Quản lý danh mục các tuyến xe và hành trình trong hệ thống.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => {
                setNotice('');
                go('form');
              }}
            >
              <img src="/icons/plus.svg" alt="" />
              Thêm tuyến mới
            </button>
          </div>
          <div className="filters route-filters">
            <form
              className="search-form"
              onSubmit={(e) => {
                e.preventDefault();
                filter({ page: 1, search: search.trim() });
              }}
            >
              <label className="search-field">
                <span className="sr-only">Tìm kiếm tuyến xe</span>
                <img src="/icons/search.svg" alt="" />
                <input
                  maxLength={255}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm kiếm tên tuyến, mã tuyến…"
                />
              </label>
              <button className="button">Tìm kiếm</button>
            </form>
            <label className="filter-label">
              Trạng thái
              <select
                value={query.status}
                onChange={(e) => filter({ page: 1, status: e.target.value })}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </label>
          </div>
        </>
      )}
      {loading ? (
        <div className="list-state" role="status">
          <span className="spinner" />
          Đang tải dữ liệu tuyến xe…
        </div>
      ) : error ? (
        <div className="list-state">
          <div className="alert alert-error" role="alert">
            {error}
          </div>
          <button
            className="button"
            onClick={() => {
              setLoading(true);
              setRevision((v) => v + 1);
            }}
          >
            Thử lại
          </button>
          {view.type !== 'list' && (
            <button className="button" onClick={() => go('list')}>
              Quay lại danh sách
            </button>
          )}
        </div>
      ) : view.type === 'form' ? (
        <RouteForm route={route} onSave={save} onBack={() => go('list')} />
      ) : view.type === 'detail' ? (
        <RouteDetail
          route={route}
          onEdit={() => go('form', route.id)}
          onBack={() => go('list')}
        />
      ) : (
        <>
          {!result?.items.length ? (
            <div className="list-state">
              <img className="empty-icon" src="/icons/gitbranch.svg" alt="" />
              <h2>Không tìm thấy tuyến xe</h2>
              <p className="muted">
                Thử thay đổi từ khóa, bộ lọc hoặc thêm tuyến xe mới.
              </p>
              <button
                className="button"
                onClick={() => {
                  setSearch('');
                  filter({ page: 1, search: '', status: '' });
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="table-shell">
              <table className="stations-table routes-table">
                <caption className="sr-only">Danh sách tuyến xe</caption>
                <thead>
                  <tr>
                    {[
                      'Mã tuyến',
                      'Tên tuyến',
                      'Bến đầu',
                      'Bến cuối',
                      'Giờ hoạt động',
                      'Khoảng cách',
                      'Điểm dừng',
                      'Trạng thái',
                      'Thao tác',
                    ].map((t) => (
                      <th key={t} scope="col">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Mã tuyến">
                        <button
                          className="route-link"
                          onClick={() => go('detail', r.id)}
                          aria-label={`Chi tiết ${r.code}`}
                        >
                          {r.code}
                        </button>
                      </td>
                      <td data-label="Tên tuyến" className="station-name">
                        {r.name}
                      </td>
                      <td data-label="Bến đầu">{r.origin_name}</td>
                      <td data-label="Bến cuối">{r.destination_name}</td>
                      <td data-label="Giờ hoạt động">
                        {r.operating_start.slice(0, 5)} –{' '}
                        {r.operating_end.slice(0, 5)}
                      </td>
                      <td data-label="Khoảng cách">{r.distance_km} km</td>
                      <td data-label="Điểm dừng">{r.stop_count}</td>
                      <td data-label="Trạng thái">
                        <StationStatus active={r.status === 'ACTIVE'} />
                      </td>
                      <td data-label="Thao tác">
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            onClick={() => go('form', r.id)}
                            aria-label={`Sửa ${r.code}`}
                            title="Sửa tuyến"
                          >
                            <img src="/icons/edit2.svg" alt="" />
                          </button>
                          <button
                            className="text-button"
                            onClick={() => setModal(r)}
                            aria-label={`${r.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'} ${r.code}`}
                          >
                            {r.status === 'ACTIVE' ? 'Ngừng' : 'Kích hoạt'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {result && (
            <div className="pagination">
              <p className="muted">
                Hiển thị {result.total ? (query.page - 1) * query.limit + 1 : 0}
                –{Math.min(query.page * query.limit, result.total)} trên{' '}
                {result.total} kết quả
              </p>
              <div className="pagination-controls">
                <label className="page-size">
                  Dòng/trang
                  <select
                    value={query.limit}
                    onChange={(e) =>
                      filter({ page: 1, limit: Number(e.target.value) })
                    }
                  >
                    {[10, 20, 50].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <nav aria-label="Phân trang">
                  <button
                    className="button"
                    disabled={query.page <= 1}
                    onClick={() => filter({ page: query.page - 1 })}
                  >
                    Trước
                  </button>
                  <span className="page-current" aria-current="page">
                    {query.page} / {Math.max(1, result.totalPages)}
                  </span>
                  <button
                    className="button"
                    disabled={query.page >= result.totalPages}
                    onClick={() => filter({ page: query.page + 1 })}
                  >
                    Sau
                  </button>
                </nav>
              </div>
            </div>
          )}
        </>
      )}
      {modal && (
        <RouteStatusDialog
          route={modal}
          onClose={() => setModal(null)}
          onConfirm={async () => {
            await routesApi.setStatus(
              modal.id,
              modal.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
            );
            reload(
              modal.status === 'ACTIVE'
                ? 'Đã ngừng hoạt động tuyến xe.'
                : 'Đã kích hoạt lại tuyến xe.',
            );
          }}
        />
      )}
    </main>
  );
}
