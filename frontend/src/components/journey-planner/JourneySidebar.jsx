import JourneySearchSkeleton from './JourneySearchSkeleton';
import JourneyResults from './JourneyResults';
import JourneyDetailPanel from './JourneyDetailPanel';
import OriginAutocomplete from './OriginAutocomplete';
import PlaceAutocomplete from './PlaceAutocomplete';

export default function JourneySidebar({
  current,
  destination,
  journey,
  detail,
  tracking,
  onStart,
  onLocate,
  onSearch,
  onOriginSelect,
  onOriginClear,
  onDestinationSelect,
  onDestinationClear,
}) {
  const ready = current.status === 'success' && !!destination;
  const idle = journey.status === 'idle';
  const loading = journey.status === 'loading';
  if (journey.detailOpen && journey.selectedId) {
    const selected = journey.result.items.find(
      (item) => item.route_id === journey.selectedId,
    );
    return (
      <JourneyDetailPanel
        detail={detail}
        routeCode={selected?.route_code}
        onBack={journey.closeDetail}
        onStart={onStart}
        tracking={tracking}
      />
    );
  }
  return (
    <aside className="jp-sidebar" aria-label="Điểm đi và điểm đến">
      <h1>
        {loading
          ? 'Đang tìm tuyến phù hợp'
          : idle
            ? 'Hôm nay bạn đi đâu?'
            : 'Lộ trình dành cho bạn'}
      </h1>
      <p className="jp-intro">
        {loading
          ? 'Giữ nguyên điểm đi và điểm đến của bạn.'
          : idle
            ? 'Tìm địa điểm và chọn nơi bạn muốn đến.'
            : 'Hà Nội · Khởi hành ngay'}
      </p>
      <OriginAutocomplete
        current={current}
        onSelect={onOriginSelect}
        onClear={onOriginClear}
        onLocate={onLocate}
      />
      <PlaceAutocomplete
        selected={destination}
        onSelect={onDestinationSelect}
        onClear={onDestinationClear}
      />
      {loading && <JourneySearchSkeleton />}
      {journey.status === 'success' && (
        <JourneyResults
          result={journey.result}
          selectedId={journey.selectedId}
          onSelect={journey.select}
        />
      )}
      {journey.status === 'error' && (
        <p className="jp-error" role="alert">
          {journey.error}
        </p>
      )}
      {!loading && (
        <div
          className={
            idle
              ? 'jp-search-actions'
              : 'jp-search-actions jp-search-actions-after'
          }
        >
          {idle && destination && (
            <p className="jp-destination-address">{destination.address}</p>
          )}
          <button
            className="jp-location-button"
            type="button"
            disabled={current.status === 'loading'}
            onClick={() => onLocate()}
          >
            {current.mode === 'demo'
              ? 'Dùng vị trí hiện tại'
              : 'Lấy lại vị trí của tôi'}
          </button>
          {current.status === 'loading' && (
            <p className="jp-hint" role="status">
              Hãy cho phép trình duyệt sử dụng vị trí của bạn.
            </p>
          )}
          {current.error && (
            <p className="jp-error" role="alert">
              {current.error}
            </p>
          )}
          <button
            className="jp-find-button"
            type="button"
            disabled={!ready}
            onClick={onSearch}
            aria-describedby={idle ? 'journey-ready-hint' : undefined}
          >
            {idle
              ? 'Tìm lộ trình'
              : journey.status === 'error'
                ? 'Thử lại tìm lộ trình'
                : 'Tìm lại lộ trình'}
          </button>
          {idle && (
            <p className="jp-hint" id="journey-ready-hint" role="status">
              {ready
                ? 'Đã có điểm đi và điểm đến.'
                : 'Cần vị trí điểm đi và một điểm đến để tiếp tục.'}
            </p>
          )}
        </div>
      )}
      {idle && (
        <div className="jp-travel-note">
          <strong>Tìm tuyến nhanh, hành trình dễ dàng</strong>
          <p>GoBus – Kết nối mọi hành trình.</p>
        </div>
      )}
    </aside>
  );
}
