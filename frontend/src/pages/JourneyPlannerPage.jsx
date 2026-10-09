import { useState } from 'react';
import '@fontsource-variable/manrope';
import { useCurrentPosition } from '../components/journey-planner/useCurrentPosition';
import JourneySidebar from '../components/journey-planner/JourneySidebar';
import { useJourneySearch } from '../components/journey-planner/useJourneySearch';
import JourneyMap from '../components/journey-planner/JourneyMap';
import { useJourneyDetail } from '../components/journey-planner/useJourneyDetail';
import { useJourneyTracking } from '../components/journey-planner/useJourneyTracking';
import JourneyTrackingPanel from '../components/journey-planner/JourneyTrackingPanel';
import JourneyDetailPanel from '../components/journey-planner/JourneyDetailPanel';
import EndJourneyDialog from '../components/journey-planner/EndJourneyDialog';
import { useJourneyPrefill } from '../components/journey-planner/useJourneyPrefill';
import './journey-planner.css';

export default function JourneyPlannerPage({
  user,
  onLogout,
  logoutBusy,
  logoutError,
  initialLocationMode = 'demo',
}) {
  const params = new URLSearchParams(window.location.search);
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const fromText = from ? '' : params.get('from_text') || '';
  const toText = to ? '' : params.get('to_text') || '';
  const hasInput = !!(from || to || fromText || toText);
  const current = useCurrentPosition(
    from || fromText ? 'manual' : initialLocationMode,
  );
  const [selectedDestination, setDestination] = useState(null);
  const tracking = useJourneyTracking();
  const [showTracking, setShowTracking] = useState(!hasInput);
  const activeTracking = showTracking ? tracking.data : null;
  const destination =
    activeTracking?.journey.alighting_station || selectedDestination;
  const position = activeTracking?.origin || current.position;
  const journey = useJourneySearch();
  const prefill = useJourneyPrefill(
    from,
    to,
    current.select,
    setDestination,
    journey.search,
  );
  const selectedJourney =
    journey.result?.items.find(
      (item) => item.route_id === journey.selectedId,
    ) ?? null;
  const detail = useJourneyDetail(
    position,
    destination?.id,
    activeTracking ? null : selectedJourney?.route_id,
    journey.selectionVersion,
  );

  async function endJourney() {
    const ended = await tracking.end();
    if (!ended) return;
    setShowTracking(false);
    setDestination(ended.journey.alighting_station);
    current.select(ended.origin);
    journey.search(
      ended.origin,
      ended.journey.alighting_station,
      ended.journey.route_id,
    );
  }

  return (
    <div className="journey-planner">
      <a className="skip-link" href="#journey-main">
        Đến nội dung chính
      </a>
      <header className="jp-header">
        <a className="jp-brand" href="/user/home">
          <img src="/home/imgBus.svg" alt="" width="24" height="24" />
          <strong>GoBus</strong>
        </a>
        <nav aria-label="Điều hướng lộ trình">
          <a href="/user/home">Trang chủ</a>
          <a href="/user/journey-planner" aria-current="page">
            Lộ trình &amp; Bản đồ
          </a>
          <span aria-disabled="true" title="Sắp có">
            Mua vé
          </span>
        </nav>
        <div className="jp-account">
          <span>{user.full_name}</span>
          <button type="button" onClick={onLogout} disabled={logoutBusy}>
            {logoutBusy ? 'Đang thoát…' : 'Đăng xuất'}
          </button>
        </div>
      </header>
      {logoutError && (
        <p className="jp-error" role="alert">
          {logoutError}
        </p>
      )}
      {hasInput && tracking.data && (
        <div className="jp-prefill-notice">
          <p>
            Bạn có một hành trình đang theo dõi. Các địa điểm vừa chọn được
            giữ riêng cho lần tìm kiếm này.
          </p>
          <button
            className="jp-location-button"
            type="button"
            onClick={() => setShowTracking(!showTracking)}
          >
            {showTracking
              ? 'Quay lại tìm lộ trình'
              : 'Xem hành trình đang theo dõi'}
          </button>
        </div>
      )}
      <main id="journey-main" className="jp-layout" tabIndex={-1}>
        {activeTracking ? (
          tracking.view === 'detail' ? (
            <JourneyDetailPanel
              detail={{ status: 'success', data: tracking.data.journey }}
              backLabel="Quay lại theo dõi"
              tracking={tracking}
              onStart={() => tracking.setView('tracking')}
              onBack={() => tracking.setView('tracking')}
            />
          ) : (
            <JourneyTrackingPanel tracking={tracking} />
          )
        ) : prefill.loading ? (
          <aside className="jp-sidebar" aria-label="Điểm đi và điểm đến">
            <h1>Đang tải địa điểm đã chọn</h1>
            <p role="status">Đang chuyển điểm đi và điểm đến sang bản đồ…</p>
          </aside>
        ) : (
          <JourneySidebar
            prefill={prefill}
            initialOriginQuery={fromText}
            initialDestinationQuery={toText}
            current={current}
            onOriginSelect={(place) => {
              prefill.dismiss();
              journey.reset();
              current.select({ ...place, label: place.name });
            }}
            onOriginClear={() => {
              prefill.dismiss();
              journey.reset();
              current.clear();
            }}
            destination={destination}
            onDestinationSelect={(place) => {
              prefill.dismiss();
              setDestination(place);
              journey.reset();
            }}
            onDestinationClear={() => {
              prefill.dismiss();
              setDestination(null);
              journey.reset();
            }}
            journey={journey}
            detail={detail}
            tracking={tracking}
            onStart={() => {
              setShowTracking(true);
              tracking.start(
                position,
                destination.id,
                selectedJourney.route_id,
              );
            }}
            onLocate={(fallback = false) => {
              prefill.dismiss();
              journey.reset();
              current.locate(fallback);
            }}
            onSearch={() => {
              if (
                current.status === 'success' &&
                destination &&
                current.position?.id !== destination.id
              )
                journey.search(position, destination);
            }}
          />
        )}
        <section className="jp-search-area" aria-label="Khu vực bản đồ">
          <JourneyMap
            position={position}
            destination={destination}
            journey={
              activeTracking?.journey ||
              (detail.status === 'error'
                ? null
                : detail.data || selectedJourney)
            }
            alternatives={journey.result?.items}
          />
        </section>
      </main>
      {activeTracking && tracking.confirmEnd && (
        <EndJourneyDialog tracking={tracking} onEnd={endJourney} />
      )}
    </div>
  );
}
