import { useEffect, useState } from 'react';
import { stationsApi } from '../services/stationsApi';
import StationsTable from '../components/stations/StationsTable';
import StationForm from '../components/stations/StationForm';
import StationStatusDialog from '../components/stations/StationStatusDialog';

export default function StationsPage() {
  const [query, setQuery] = useState({
    page: 1,
    limit: 10,
    search: '',
    is_active: '',
  });
  const [search, setSearch] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    stationsApi
      .list(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (query.page > Math.max(1, data.totalPages)) {
          setQuery((previous) => ({
            ...previous,
            page: Math.max(1, data.totalPages),
          }));
          return;
        }
        setResult(data);
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
  }, [query, revision]);
  function filter(patch) {
    setLoading(true);
    setError('');
    setQuery((previous) => ({ ...previous, ...patch }));
  }
  function reload(message) {
    setModal(null);
    setNotice(message);
    setLoading(true);
    setError('');
    setRevision((value) => value + 1);
  }
  function reset() {
    setSearch('');
    filter({ page: 1, search: '', is_active: '' });
  }
  async function save(body) {
    if (modal.station) await stationsApi.update(modal.station.id, body);
    else await stationsApi.create(body);
    reload(
      modal.station
        ? 'Đã cập nhật thông tin bến xe.'
        : 'Đã thêm bến xe thành công.',
    );
  }
  async function status() {
    const station = await stationsApi.setStatus(
      modal.station.id,
      !modal.station.is_active,
    );
    // Reflect the confirmed state immediately while refreshing the full result.
    setResult(
      (previous) =>
        previous && {
          ...previous,
          items: previous.items.map((item) =>
            item.id === station.id ? station : item,
          ),
        },
    );
    reload(
      station.is_active
        ? 'Đã kích hoạt lại bến xe.'
        : 'Đã ngừng hoạt động bến xe.',
    );
  }
  return (
    <main id="main-content" className="stations-page">
      <div className="page-heading">
        <div>
          <h1>Quản lý bến xe</h1>
          <p className="muted">
            Quản lý thông tin và danh sách các bến xe trong hệ thống
          </p>
        </div>
        <button
          className="button button-primary"
          onClick={() => {
            setNotice('');
            setModal({ type: 'form' });
          }}
        >
          <img src="/icons/plus.svg" alt="" />
          Thêm bến xe
        </button>
      </div>
      {notice && (
        <div className="alert alert-success" role="status">
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Đóng thông báo"
            onClick={() => setNotice('')}
          >
            ×
          </button>
        </div>
      )}
      <div className="filters">
        <form
          className="search-form"
          onSubmit={(event) => {
            event.preventDefault();
            filter({ page: 1, search: search.trim() });
          }}
        >
          <label className="search-field">
            <span className="sr-only">Tìm kiếm bến xe</span>
            <img src="/icons/search.svg" alt="" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              maxLength={255}
              placeholder="Tìm mã bến, tên hoặc địa chỉ…"
            />
          </label>
          <button className="button" type="submit">
            Tìm kiếm
          </button>
        </form>
        <label className="filter-label">
          <span>Trạng thái</span>
          <select
            value={query.is_active}
            onChange={(event) =>
              filter({ page: 1, is_active: event.target.value })
            }
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Ngừng hoạt động</option>
          </select>
        </label>
      </div>
      <section aria-label="Kết quả tìm kiếm" aria-busy={loading}>
        {loading ? (
          <div className="list-state" role="status">
            <span className="spinner" aria-hidden="true" />
            Đang tải danh sách bến xe…
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
                setRevision((value) => value + 1);
              }}
            >
              Thử lại
            </button>
          </div>
        ) : !result?.items.length ? (
          <div className="list-state">
            <img className="empty-icon" src="/icons/mappin.svg" alt="" />
            <h2>Không tìm thấy bến xe</h2>
            <p className="muted">
              Thử thay đổi từ khóa, bộ lọc hoặc thêm bến xe mới.
            </p>
            <button className="button" onClick={reset}>
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <StationsTable
            stations={result.items}
            offset={(query.page - 1) * query.limit}
            onEdit={(station) => setModal({ type: 'form', station })}
            onStatus={(station) => setModal({ type: 'status', station })}
          />
        )}
      </section>
      {!error && result && (
        <div className="pagination">
          <p className="muted">
            {loading
              ? 'Đang cập nhật…'
              : `Hiển thị ${result.total ? (result.page - 1) * result.limit + 1 : 0}–${Math.min(result.page * result.limit, result.total)} trên ${result.total} kết quả`}
          </p>
          <div className="pagination-controls">
            <label className="page-size">
              <span>Dòng/trang</span>
              <select
                value={query.limit}
                onChange={(event) =>
                  filter({ page: 1, limit: Number(event.target.value) })
                }
              >
                <option>10</option>
                <option>20</option>
                <option>50</option>
              </select>
            </label>
            <nav aria-label="Phân trang">
              <button
                className="button"
                disabled={loading || query.page <= 1}
                onClick={() => filter({ page: query.page - 1 })}
              >
                Trước
              </button>
              <span className="page-current" aria-current="page">
                {query.page} / {Math.max(1, result.totalPages)}
              </span>
              <button
                className="button"
                disabled={loading || query.page >= result.totalPages}
                onClick={() => filter({ page: query.page + 1 })}
              >
                Sau
              </button>
            </nav>
          </div>
        </div>
      )}
      {modal?.type === 'form' && (
        <StationForm
          station={modal.station}
          onClose={() => setModal(null)}
          onSave={save}
        />
      )}
      {modal?.type === 'status' && (
        <StationStatusDialog
          station={modal.station}
          onClose={() => setModal(null)}
          onConfirm={status}
        />
      )}
    </main>
  );
}
