import JourneyRouteCard from './JourneyRouteCard';

export default function JourneyResults({ result, selectedId, onSelect }) {
  if (!result.items.length) {
    return (
      <div className="jp-empty-results" role="status">
        <strong>Chưa có lộ trình phù hợp</strong>
        <p>
          Chưa có chuyến đi thẳng tới điểm đến với bến lên xe trong phạm vi{' '}
          {result.max_walking_distance_m / 1000} km và còn đón khách hôm nay.
        </p>
        <p>Bạn có thể chọn điểm đến khác hoặc tìm lại sau.</p>
      </div>
    );
  }
  return (
    <section className="jp-results" aria-label="Lộ trình gợi ý">
      <p className="jp-results-count" role="status">
        Gợi ý lộ trình ({result.items.length})
      </p>
      <ul className="jp-route-list">
        {result.items.map((journey, index) => (
          <JourneyRouteCard
            key={journey.route_id}
            journey={journey}
            fastest={index === 0}
            selected={selectedId === journey.route_id}
            onSelect={() => onSelect(journey.route_id)}
          />
        ))}
      </ul>
    </section>
  );
}
