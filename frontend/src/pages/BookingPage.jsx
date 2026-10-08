import AppLink from '../components/AppLink';
import { pushNavigation } from '../utils/navigation';
import { useEffect, useRef, useState } from 'react';
import { bookingsApi } from '../services/bookingsApi';
import BookingState from '../components/bookings/BookingState';
import {
  money,
  searchParams,
  tripDate,
  tripDateTime,
  tripTime,
} from '../utils/bookingFormat';

const newPassenger = () => ({ passenger_name: '', contact_phone: '' });

export default function BookingPage({ user }) {
  const [params] = useState(searchParams);
  const [state, setState] = useState({ loading: true, trip: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  const [passengers, setPassengers] = useState([newPassenger()]);
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const requestRef = useRef(null);
  useEffect(() => {
    const controller = new AbortController();
    if (!params.trip || !params.from || !params.to) return;
    bookingsApi
      .trip(
        params.trip,
        { from_station_id: params.from, to_station_id: params.to },
        controller.signal,
      )
      .then((trip) => setState({ loading: false, trip, error: '' }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ loading: false, trip: null, error: error.message });
      });
    return () => controller.abort();
  }, [params, attempt]);
  function updatePassenger(index, field, value) {
    setPassengers(
      passengers.map((passenger, i) =>
        i === index ? { ...passenger, [field]: value } : passenger,
      ),
    );
  }
  function changeQuantity(delta) {
    const quantity = passengers.length + delta;
    if (quantity < 1 || quantity > state.trip.remaining || busy) return;
    setPassengers(
      delta > 0
        ? [...passengers, newPassenger()]
        : passengers.slice(0, quantity),
    );
    setSubmitError('');
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = {
      schedule_id: state.trip.id,
      from_station_id: params.from,
      to_station_id: params.to,
      unit_price: state.trip.unit_price,
      passengers: passengers.map((passenger) => ({
        passenger_name: passenger.passenger_name.trim(),
        contact_phone: passenger.contact_phone.trim(),
      })),
    };
    if (body.passengers.some((passenger) => !passenger.passenger_name)) {
      setSubmitError('Vui lòng nhập họ và tên của từng hành khách.');
      return;
    }
    if (
      body.passengers.some(
        (passenger) =>
          !/^(?=(?:\D*\d){8,15}\D*$)\+?[0-9 ()-]+$/.test(
            passenger.contact_phone,
          ),
      )
    ) {
      setSubmitError(
        'Vui lòng nhập số điện thoại hợp lệ cho từng hành khách, từ 8 đến 15 chữ số.',
      );
      return;
    }
    const payload = JSON.stringify(body);
    if (requestRef.current?.payload !== payload)
      requestRef.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setSubmitError('');
    try {
      await bookingsApi.create({ ...body, request_id: requestRef.current.id });
      pushNavigation(`/user/bookings/success?request=${requestRef.current.id}`);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setBusy(false);
    }
  }
  const validParams = params.trip && params.from && params.to;
  const trip = state.trip;
  return (
    <>
      <AppLink
        className="booking-back"
        href={`/user/bookings?${new URLSearchParams({ from: params.from || '', to: params.to || '' })}`}
      >
        ←&nbsp; Quay lại kết quả tìm kiếm
      </AppLink>
      <div className="booking-heading">
        <h1>Xác nhận thông tin đặt vé</h1>
        <p>
          Kiểm tra thông tin chuyến đi và nhập thông tin hành khách để hoàn tất
          đặt vé.
        </p>
      </div>
      <BookingState
        loading={validParams && state.loading}
        error={
          !validParams
            ? 'Vui lòng chọn một chuyến xe trước khi đặt vé.'
            : state.error
        }
        onRetry={
          validParams
            ? () => {
                setState({ loading: true, trip: null, error: '' });
                setAttempt(attempt + 1);
              }
            : undefined
        }
      />
      {trip && (
        <form className="booking-columns" onSubmit={submit}>
          <div className="booking-left">
            <section
              className="booking-card booking-trip-summary"
              aria-labelledby="trip-summary-title"
            >
              <div className="booking-card-title">
                <h2 id="trip-summary-title">
                  Tuyến {trip.route_code}: {trip.from_station} →{' '}
                  {trip.to_station}
                </h2>
                <span className="booking-status confirmed">
                  Còn {trip.remaining} chỗ
                </span>
              </div>
              <hr />
              <dl className="booking-trip-facts">
                <div>
                  <dt>Ngày đi</dt>
                  <dd>{tripDate(trip.pickup_at)}</dd>
                </div>
                <div>
                  <dt>Giờ khởi hành</dt>
                  <dd>{tripTime(trip.pickup_at)}</dd>
                </div>
                <div>
                  <dt>Bến đón</dt>
                  <dd>{trip.from_station}</dd>
                </div>
                <div>
                  <dt>Loại xe</dt>
                  <dd>Ghế ngồi {trip.capacity} chỗ</dd>
                </div>
              </dl>
            </section>
            <section
              className="booking-card booking-passenger-form"
              aria-labelledby="passenger-title"
            >
              <h2 id="passenger-title">Thông tin hành khách</h2>
              {passengers.map((passenger, index) => (
                <fieldset
                  className="booking-passenger"
                  key={index}
                  disabled={busy}
                >
                  {passengers.length > 1 && (
                    <legend>Hành khách {index + 1}</legend>
                  )}
                  <label className="booking-field">
                    <span>Họ và tên *</span>
                    <input
                      required
                      maxLength={120}
                      autoComplete={index === 0 ? 'name' : 'off'}
                      placeholder="Nhập họ và tên hành khách"
                      value={passenger.passenger_name}
                      onChange={(event) =>
                        updatePassenger(
                          index,
                          'passenger_name',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                  <label className="booking-field">
                    <span>Số điện thoại *</span>
                    <input
                      required
                      type="tel"
                      minLength={8}
                      maxLength={20}
                      autoComplete={index === 0 ? 'tel' : 'off'}
                      placeholder="Nhập số điện thoại"
                      value={passenger.contact_phone}
                      onChange={(event) =>
                        updatePassenger(
                          index,
                          'contact_phone',
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </fieldset>
              ))}
              <fieldset disabled={busy} className="booking-quantity-field">
                <legend>Số lượng vé *</legend>
                <div className="booking-quantity">
                  <button
                    type="button"
                    aria-label="Giảm số vé"
                    disabled={passengers.length === 1 || busy}
                    onClick={() => changeQuantity(-1)}
                  >
                    −
                  </button>
                  <output aria-live="polite">
                    {String(passengers.length).padStart(2, '0')}
                  </output>
                  <button
                    type="button"
                    aria-label="Tăng số vé"
                    disabled={passengers.length >= trip.remaining || busy}
                    onClick={() => changeQuantity(1)}
                  >
                    +
                  </button>
                </div>
              </fieldset>
              <p className="booking-muted booking-small">
                Mỗi vé lưu thông tin của một hành khách riêng.
              </p>
            </section>
          </div>
          <aside
            className="booking-card booking-order"
            aria-labelledby="order-title"
          >
            <h2 id="order-title">Tóm tắt đơn hàng</h2>
            <dl className="booking-details">
              <div>
                <dt>Tuyến</dt>
                <dd>
                  {trip.from_station} → {trip.to_station}
                </dd>
              </div>
              <div>
                <dt>Ngày đi</dt>
                <dd>{tripDateTime(trip.pickup_at)}</dd>
              </div>
              <div>
                <dt>Số lượng vé</dt>
                <dd>{String(passengers.length).padStart(2, '0')} vé</dd>
              </div>
              <div>
                <dt>Đơn giá</dt>
                <dd>{money(trip.unit_price)}</dd>
              </div>
            </dl>
            <hr />
            <div className="booking-total">
              <strong>Tổng tiền</strong>
              <strong>{money(trip.unit_price * passengers.length)}</strong>
            </div>
            {submitError && (
              <p className="booking-error" role="alert">
                {submitError}
              </p>
            )}
            <button
              className="booking-button"
              disabled={busy || trip.remaining === 0}
            >
              {busy ? 'Đang đặt vé…' : 'Xác nhận đặt vé'}
            </button>
            <p className="booking-muted booking-small">
              Vé điện tử được lưu trong Vé của tôi ngay sau khi đặt thành công.
            </p>
            <span className="sr-only">Người đặt vé: {user.full_name}</span>
          </aside>
        </form>
      )}
    </>
  );
}
