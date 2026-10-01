import { useEffect, useState } from 'react';
import { allPages, schedulesApi } from '../services/schedulesApi';
import { routesApi } from '../services/routesApi';
import StationDialog from '../components/stations/StationDialog';
import ScheduleForm from '../components/schedules/ScheduleForm';
import ScheduleDetail from '../components/schedules/ScheduleDetail';
import ScheduleStatus from '../components/schedules/ScheduleStatus';
import ScheduleStatusDialog from '../components/schedules/ScheduleStatusDialog';
import { displayTime, statusLabels } from '../utils/scheduleTime';
const filters = {
  search: '',
  route_id: '',
  date_from: '',
  date_to: '',
  status: '',
};
export default function SchedulesPage() {
  const [query, setQuery] = useState({ ...filters, page: 1, limit: 10 }),
    [draft, setDraft] = useState(filters),
    [result, setResult] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revision, setRevision] = useState(0);
  const [options, setOptions] = useState(null),
    [optionsError, setOptionsError] = useState(''),
    [optionsRevision, setOptionsRevision] = useState(0);
  const [view, setView] = useState(null),
    [detail, setDetail] = useState(null),
    [detailError, setDetailError] = useState(''),
    [detailRevision, setDetailRevision] = useState(0),
    [statusModal, setStatusModal] = useState(null);
  useEffect(() => {
    document.title = 'Quản lý lịch trình | GoBus';
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    schedulesApi
      .list(query, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (query.page > Math.max(1, data.totalPages)) {
          setQuery((q) => ({ ...q, page: Math.max(1, data.totalPages) }));
          return;
        }
        setResult(data);
        setLoading(false);
        setError('');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [query, revision]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      allPages(routesApi.list, controller.signal),
      allPages(schedulesApi.vehicles, controller.signal),
    ])
      .then(([routes, vehicles]) => {
        if (!controller.signal.aborted) {
          setOptions({ routes, vehicles });
          setOptionsError('');
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setOptionsError(e.message);
      });
    return () => controller.abort();
  }, [optionsRevision]);
  useEffect(() => {
    if (!view?.id) return;
    const controller = new AbortController();
    schedulesApi
      .detail(view.id, controller.signal)
      .then((d) => {
        if (!controller.signal.aborted) {
          setDetail(d);
          setDetailError('');
        }
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setDetailError(e.message);
      });
    return () => controller.abort();
  }, [view, detailRevision]);
  function open(type, id) {
    setDetail(null);
    setDetailError('');
    setView({ type, id });
    setNotice('');
  }
  function filter(patch) {
    setLoading(true);
    setQuery((q) => ({ ...q, ...patch }));
  }
  function refresh(message) {
    setNotice(message);
    setLoading(true);
    setRevision((v) => v + 1);
    setView(null);
    setStatusModal(null);
  }
  async function save(body) {
    if (view.id) await schedulesApi.update(view.id, body);
    else await schedulesApi.create(body);
    refresh(
      view.id ? 'Đã cập nhật lịch trình.' : 'Đã thêm lịch trình thành công.',
    );
  }
  const panel = view?.type === 'form';
  const detailView = view?.type === 'detail';
  return (
    <main
      className="stations-page routes-page schedules-page"
      id="main-content"
    >
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
      {detailView ? (
        detail ? (
          <ScheduleDetail
            schedule={detail}
            onBack={() => setView(null)}
            onEdit={() => open('form', detail.id)}
            onStatus={() => setStatusModal(detail)}
          />
        ) : (
          <div className="list-state">
            {detailError ? (
              <>
                <p className="alert alert-error" role="alert">
                  {detailError}
                </p>
                <button
                  className="button"
                  onClick={() => {
                    setDetailError('');
                    setDetailRevision((v) => v + 1);
                  }}
                >
                  Thử lại chi tiết
                </button>
              </>
            ) : (
              <p role="status">Đang tải chi tiết…</p>
            )}
            <button className="button" onClick={() => setView(null)}>
              Quay lại danh sách
            </button>
          </div>
        )
      ) : (
        <>
          <div className="page-heading">
            <div>
              <h1>Quản lý lịch trình</h1>
              <p className="muted">
                Theo dõi chuyến chạy, thời gian và phân công phương tiện.
              </p>
            </div>
            <button
              className="button button-primary"
              onClick={() => open('form')}
            >
              <img src="/icons/plus.svg" alt="" />
              Thêm lịch trình mới
            </button>
          </div>
          <p className="schedule-timezone">
            Ngày và giờ hiển thị theo Việt Nam · UTC+7
          </p>
          <form
            className="schedule-filters"
            onSubmit={(e) => {
              e.preventDefault();
              filter({ ...draft, page: 1 });
            }}
          >
            <label className="form-field">
              Tuyến chạy
              <select
                value={draft.route_id}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, route_id: e.target.value }))
                }
              >
                <option value="">Tất cả tuyến</option>
                {options?.routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} · {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Từ ngày
              <input
                type="date"
                value={draft.date_from}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date_from: e.target.value }))
                }
              />
            </label>
            <label className="form-field">
              Đến ngày
              <input
                type="date"
                value={draft.date_to}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, date_to: e.target.value }))
                }
              />
            </label>
            <label className="form-field">
              Trạng thái
              <select
                value={draft.status}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, status: e.target.value }))
                }
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statusLabels).map(([k, v]) => (
                  <option value={k} key={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Tìm tuyến hoặc xe
              <input
                maxLength={255}
                placeholder="Mã/tên tuyến, mã xe…"
                value={draft.search}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, search: e.target.value }))
                }
              />
            </label>
            <button className="button">Tìm kiếm</button>
          </form>
          {optionsError && (
            <div className="alert alert-error" role="alert">
              Không tải được danh sách lựa chọn: {optionsError}
              <button
                className="button"
                onClick={() => {
                  setOptionsError('');
                  setOptionsRevision((v) => v + 1);
                }}
              >
                Tải lại lựa chọn
              </button>
            </div>
          )}
          {loading ? (
            <div className="list-state" role="status">
              <span className="spinner" />
              Đang tải lịch trình…
            </div>
          ) : error ? (
            <div className="list-state">
              <p className="alert alert-error" role="alert">
                {error}
              </p>
              <button
                className="button"
                onClick={() => {
                  setLoading(true);
                  setRevision((v) => v + 1);
                }}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {!result?.items.length ? (
                <div className="list-state">
                  <img
                    className="empty-icon"
                    src="/icons/calendar.svg"
                    alt=""
                  />
                  <h2>Không tìm thấy lịch trình</h2>
                  <p className="muted">
                    Thử thay đổi bộ lọc hoặc thêm lịch trình mới.
                  </p>
                  <button
                    className="button"
                    onClick={() => {
                      setDraft(filters);
                      filter({ ...filters, page: 1 });
                    }}
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              ) : (
                <div className="table-shell">
                  <table className="stations-table schedules-table">
                    <caption className="sr-only">Danh sách lịch trình</caption>
                    <thead>
                      <tr>
                        {[
                          'ID',
                          'Tuyến chạy',
                          'Xe',
                          'Khởi hành',
                          'Giờ đến',
                          'Vé xác nhận / sức chứa xe',
                          'Trạng thái',
                          'Thao tác',
                        ].map((x) => (
                          <th scope="col" key={x}>
                            {x}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.items.map((s) => (
                        <tr key={s.id}>
                          <td data-label="ID">
                            <button
                              className="route-link"
                              onClick={() => open('detail', s.id)}
                              aria-label={`Chi tiết lịch trình ${s.id}`}
                            >
                              #{s.id}
                            </button>
                          </td>
                          <td data-label="Tuyến chạy">
                            <div>
                              <strong>
                                {s.route_code} · {s.route_name}
                              </strong>
                              <p className="muted">
                                {s.origin_name} → {s.destination_name}
                              </p>
                            </div>
                          </td>
                          <td data-label="Xe">{s.vehicle_code}</td>
                          <td
                            data-label="Khởi hành"
                            className="schedule-departure"
                          >
                            {displayTime(s.departure_at)}
                          </td>
                          <td data-label="Giờ đến">
                            {displayTime(s.arrival_at)}
                          </td>
                          <td data-label="Vé / sức chứa">
                            <div>
                              <strong>{s.confirmed_bookings} vé</strong>
                              <p className="muted">Xe {s.capacity} chỗ</p>
                            </div>
                          </td>
                          <td data-label="Trạng thái">
                            <ScheduleStatus status={s.status} />
                          </td>
                          <td data-label="Thao tác">
                            <div className="row-actions">
                              <button
                                className="icon-button"
                                aria-label={`Sửa lịch trình ${s.id}`}
                                title={
                                  s.can_edit
                                    ? 'Sửa lịch trình'
                                    : s.edit_block_reason
                                }
                                onClick={() => open('form', s.id)}
                              >
                                <img src="/icons/schedules/pencil.svg" alt="" />
                              </button>
                              {['SCHEDULED', 'DEPARTED'].includes(s.status) && (
                                <button
                                  className="text-button"
                                  aria-label={`Đổi trạng thái ${s.id}`}
                                  onClick={() => setStatusModal(s)}
                                >
                                  Trạng thái
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result && (
                <>
                  <p className="schedule-timezone">
                    Tổng vé xác nhận có thể thuộc nhiều chặng; không dùng để suy
                    số ghế còn trống.
                  </p>
                  <div className="pagination">
                    <p className="muted">
                      Hiển thị{' '}
                      {result.total ? (query.page - 1) * query.limit + 1 : 0}–
                      {Math.min(query.page * query.limit, result.total)} trên{' '}
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
                        <span className="page-current">
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
                </>
              )}
            </>
          )}
        </>
      )}
      {panel &&
        (options && (!view.id || detail) ? (
          <ScheduleForm
            key={view.id ?? 'new'}
            schedule={view.id ? detail : null}
            options={options}
            onClose={() => setView(null)}
            onSave={save}
          />
        ) : (
          <StationDialog
            className="schedule-panel"
            title="Thông tin lịch trình"
            onClose={() => setView(null)}
          >
            {detailError || optionsError ? (
              <>
                <p role="alert">{detailError || optionsError}</p>
                <button
                  className="button"
                  onClick={() => {
                    setDetailError('');
                    setOptionsError('');
                    setDetailRevision((v) => v + 1);
                    setOptionsRevision((v) => v + 1);
                  }}
                >
                  Thử lại biểu mẫu
                </button>
              </>
            ) : (
              <p role="status">Đang tải thông tin tuyến và xe…</p>
            )}
          </StationDialog>
        ))}
      {statusModal && (
        <ScheduleStatusDialog
          schedule={statusModal}
          onClose={() => setStatusModal(null)}
          onConfirm={async (status) => {
            await schedulesApi.setStatus(statusModal.id, status);
            refresh(`Đã cập nhật trạng thái: ${statusLabels[status]}.`);
          }}
        />
      )}
    </main>
  );
}
