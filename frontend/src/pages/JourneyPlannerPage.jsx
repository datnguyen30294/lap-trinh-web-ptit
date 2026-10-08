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
import './journey-planner.css';

export default function JourneyPlannerPage({
  user,
  onLogout,
  logoutBusy,
  logoutError,
  initialLocationMode = 'demo',
}) {
  const current = useCurrentPosition(initialLocationMode);
  const [selectedDestination, setDestination] = useState(null);
  const tracking = useJourneyTracking();
  const destination =
    tracking.data?.journey.alighting_station || selectedDestination;
  const position = tracking.data?.origin || current.position;
  const journey = useJourneySearch();
  const selectedJourney =
    journey.result?.items.find(
      (item) => item.route_id === journey.selectedId,
    ) ?? null;
  const detail = useJourneyDetail(
    position,
    destination?.id,
    tracking.data ? null : selectedJourney?.route_id,
    journey.selectionVersion,
  );

  async function endJourney() {
    const ended = await tracking.end();
    if (!ended) return;
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
      <main id="journey-main" className="jp-layout">
        {tracking.data ? (
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
        ) : (
          <JourneySidebar
            current={current}
            onOriginSelect={(place) => {
              journey.reset();
              current.select({ ...place, label: place.name });
            }}
            onOriginClear={() => {
              journey.reset();
              current.clear();
            }}
            destination={destination}
            onDestinationSelect={(place) => {
              setDestination(place);
              journey.reset();
            }}
            onDestinationClear={() => {
              setDestination(null);
              journey.reset();
            }}
            journey={journey}
            detail={detail}
            tracking={tracking}
            onStart={() =>
              tracking.start(position, destination.id, selectedJourney.route_id)
            }
            onLocate={(fallback = false) => {
              journey.reset();
              current.locate(fallback);
            }}
            onSearch={() => {
              if (current.status === 'success' && destination)
                journey.search(position, destination);
            }}
          />
        )}
        <section className="jp-search-area" aria-label="Khu vực bản đồ">
          <JourneyMap
            position={position}
            destination={destination}
            journey={
              tracking.data?.journey ||
              (detail.status === 'error'
                ? null
                : detail.data || selectedJourney)
            }
            alternatives={journey.result?.items}
          />
        </section>
      </main>
      {tracking.data && tracking.confirmEnd && (
        <EndJourneyDialog tracking={tracking} onEnd={endJourney} />
      )}
    </div>
  );
}
