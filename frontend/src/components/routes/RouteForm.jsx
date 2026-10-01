import { useEffect, useState } from 'react';
import { stationsApi } from '../../services/stationsApi';
const newStop = () => ({
  key: crypto.randomUUID(),
  station_id: '',
  minutes_from_origin: '',
  km_from_origin: '',
});
export default function RouteForm({ route, onSave, onBack }) {
  const [values, setValues] = useState({
    code: route?.code ?? '',
    name: route?.name ?? '',
    operating_start: route?.operating_start ?? '05:00',
    operating_end: route?.operating_end ?? '22:00',
    distance_km: route?.distance_km ?? '',
    status: 'ACTIVE',
  });
  const [stops, setStops] = useState(() =>
    route
      ? route.stops.map((s) => ({
          ...s,
          key: s.id,
          minutes_from_origin: s.minutes_from_origin ?? '',
        }))
      : [
          { ...newStop(), minutes_from_origin: 0, km_from_origin: 0 },
          newStop(),
        ],
  );
  const [stations, setStations] = useState([]);
  const [stationState, setStationState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = Boolean(route?.has_bookings);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const all = [];
        let page = 1;
        let data;
        do {
          data = await stationsApi.list(
            { page, limit: 100 },
            controller.signal,
          );
          all.push(...data.items);
          page++;
        } while (page <= data.totalPages);
        if (!controller.signal.aborted) {
          setStations(all);
          setStationState('ready');
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          setStationState('error');
          setError(err.message);
        }
      }
    }
    load();
    return () => controller.abort();
  }, [retry]);
  function field(name, value) {
    setValues((v) => ({ ...v, [name]: value }));
  }
  function changeStop(index, name, value) {
    setStops((s) =>
      s.map((row, i) => (i === index ? { ...row, [name]: value } : row)),
    );
  }
  function move(index, direction) {
    setStops((previous) => {
      const next = [...previous];
      [next[index], next[index + direction]] = [
        next[index + direction],
        next[index],
      ];
      return next;
    });
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = {
      code: values.code.trim(),
      name: values.name.trim(),
      operating_start: values.operating_start,
      operating_end: values.operating_end,
      distance_km: Number(values.distance_km),
      origin_station_id: stops[0].station_id,
      destination_station_id: stops.at(-1).station_id,
      stops: stops.map((s, i) => ({
        station_id: s.station_id,
        stop_order: i + 1,
        minutes_from_origin:
          s.minutes_from_origin === '' ? null : Number(s.minutes_from_origin),
        km_from_origin: Number(s.km_from_origin),
      })),
      ...(!route ? { status: values.status } : {}),
    };
    if (!body.code || !body.name) {
      setError('Mã và tên tuyến không được để trống.');
      return;
    }
    if (new Set(body.stops.map((s) => s.station_id)).size !== stops.length) {
      setError('Không được lặp bến trong hành trình.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSave(body);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  const stationName = (id) =>
    stations.find((s) => s.id === id)?.name ??
    route?.stops.find((s) => s.station_id === id)?.station_name ??
    'Chưa chọn bến';
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {route ? `Cập nhật tuyến xe: ${route.code}` : 'Thêm tuyến xe mới'}
          </h1>
          <p className="muted">
            Tuyến một chiều. Các trường có dấu * là bắt buộc.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="route-card route-form">
        {locked && (
          <p className="route-note">
            Tuyến đã có đơn đặt vé. Mã, tên và hành trình không thể sửa để bảo
            toàn lịch sử. Bạn vẫn có thể điều chỉnh giờ nếu tương thích với lịch
            trình.
          </p>
        )}
        {route?.stops.some((s) => s.minutes_from_origin === null) && (
          <p className="route-note">
            Dữ liệu cũ chưa có số phút. Hệ thống không tự suy đoán thời gian.{' '}
            {locked
              ? 'Hiệu chỉnh thời gian lịch sử nằm ngoài phạm vi biểu mẫu này.'
              : 'Hãy bổ sung đủ số phút trước khi thay đổi hành trình hoặc kích hoạt lại.'}
          </p>
        )}
        <fieldset
          disabled={busy}
          aria-describedby={error ? 'route-form-error' : undefined}
        >
          <h2>Thông tin cơ bản tuyến xe</h2>
          <div className="route-grid">
            <label className="form-field">
              Tên tuyến xe *
              <input
                required
                maxLength={180}
                value={values.name}
                disabled={locked}
                onChange={(e) => field('name', e.target.value)}
                placeholder="Ví dụ: Bác Cổ – Yên Nghĩa"
              />
            </label>
            <label className="form-field">
              Mã tuyến xe *
              <input
                required
                maxLength={20}
                value={values.code}
                disabled={locked}
                onChange={(e) => field('code', e.target.value)}
                placeholder="Ví dụ: 02-DI"
              />
            </label>
            <div className="form-field">
              <span>Bến đầu</span>
              <div className="derived-field">
                {stationName(stops[0].station_id)}
              </div>
            </div>
            <div className="form-field">
              <span>Bến cuối</span>
              <div className="derived-field">
                {stationName(stops.at(-1).station_id)}
              </div>
            </div>
          </div>
          <div className="section-heading">
            <div>
              <h2>Hành trình và điểm dừng</h2>
              <p className="muted">
                Phút và km cộng dồn từ bến đầu. Điểm đầu bằng 0; các điểm sau
                tăng dần.
              </p>
            </div>
            <button
              type="button"
              className="button"
              disabled={
                locked || stationState !== 'ready' || stops.length >= 500
              }
              onClick={() => setStops((s) => [...s, newStop()])}
            >
              Thêm điểm dừng
            </button>
          </div>
          {stationState === 'loading' && (
            <p role="status">Đang tải danh sách bến…</p>
          )}
          {stationState === 'error' && (
            <button
              type="button"
              className="button"
              onClick={() => {
                setStationState('loading');
                setError('');
                setRetry((v) => v + 1);
              }}
            >
              Tải lại danh sách bến
            </button>
          )}
          {stationState === 'ready' && !stations.length && (
            <p role="status">
              Chưa có bến xe. Hãy thêm bến trong mục Quản lý bến xe trước.
            </p>
          )}
          <ol className="stop-editor">
            {stops.map((stop, i) => (
              <li key={stop.key}>
                <span className="stop-number">{i + 1}</span>
                <label className="form-field stop-station">
                  Bến {i + 1} *
                  <select
                    required
                    disabled={locked || stationState !== 'ready'}
                    value={stop.station_id}
                    onChange={(e) =>
                      changeStop(i, 'station_id', e.target.value)
                    }
                  >
                    <option value="">Chọn bến xe</option>
                    {stations.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={stops.some(
                          (other, j) => j !== i && other.station_id === s.id,
                        )}
                      >
                        {s.code} · {s.name}
                        {!s.is_active ? ' (Ngừng hoạt động)' : ''}
                      </option>
                    ))}
                    {stationState !== 'ready' && stop.station_id && (
                      <option value={stop.station_id}>
                        {stop.station_name}
                      </option>
                    )}
                  </select>
                </label>
                <label className="form-field stop-value">
                  Phút từ bến đầu *
                  <input
                    aria-label={`Phút điểm ${i + 1}`}
                    type="number"
                    min="0"
                    max="65535"
                    step="1"
                    required={!route}
                    disabled={locked}
                    value={stop.minutes_from_origin}
                    onChange={(e) =>
                      changeStop(i, 'minutes_from_origin', e.target.value)
                    }
                    placeholder="Chưa có"
                  />
                </label>
                <label className="form-field stop-value">
                  Km từ bến đầu *
                  <input
                    aria-label={`Km điểm ${i + 1}`}
                    type="number"
                    min="0"
                    max="999999.99"
                    step="0.01"
                    required
                    disabled={locked}
                    value={stop.km_from_origin}
                    onChange={(e) =>
                      changeStop(i, 'km_from_origin', e.target.value)
                    }
                  />
                </label>
                <div className="row-actions">
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Đưa điểm ${i + 1} lên`}
                    disabled={locked || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    Lên
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Đưa điểm ${i + 1} xuống`}
                    disabled={locked || i === stops.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    Xuống
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Bỏ điểm ${i + 1}`}
                    disabled={locked || stops.length <= 2}
                    onClick={() => setStops((s) => s.filter((_, j) => j !== i))}
                  >
                    Bỏ
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <h2>Thời gian và khoảng cách</h2>
          <div className="route-grid route-grid-three">
            <label className="form-field">
              Giờ bắt đầu *
              <input
                type="time"
                step="1"
                required
                value={values.operating_start}
                onChange={(e) => field('operating_start', e.target.value)}
              />
            </label>
            <label className="form-field">
              Giờ kết thúc *
              <input
                type="time"
                step="1"
                required
                value={values.operating_end}
                onChange={(e) => field('operating_end', e.target.value)}
              />
            </label>
            <label className="form-field">
              Tổng khoảng cách (km) *
              <input
                type="number"
                min="0.01"
                max="999999.99"
                step="0.01"
                required
                disabled={locked}
                value={values.distance_km}
                onChange={(e) => field('distance_km', e.target.value)}
              />
            </label>
          </div>
          {!route && (
            <label className="form-field">
              Trạng thái ban đầu
              <select
                value={values.status}
                onChange={(e) => field('status', e.target.value)}
              >
                <option value="ACTIVE">Đang hoạt động</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </label>
          )}
        </fieldset>
        {error && (
          <div id="route-form-error" className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onBack}
          >
            Hủy thao tác
          </button>
          <button
            className="button button-primary"
            disabled={busy || stationState !== 'ready' || !stations.length}
          >
            {busy ? 'Đang lưu…' : route ? 'Cập nhật thông tin' : 'Lưu tuyến xe'}
          </button>
        </div>
      </form>
    </>
  );
}
