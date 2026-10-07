export default function JourneySearchSkeleton({
  label = 'Đang tìm tuyến phù hợp',
}) {
  return (
    <div className="jp-skeleton-list" role="status" aria-label={label}>
      <span className="jp-sr-only">{label}…</span>
      {[0, 1, 2].map((item) => (
        <div className="jp-skeleton-card" key={item} aria-hidden="true">
          <span className="jp-skeleton-badge" />
          <span className="jp-skeleton-line" />
          <span className="jp-skeleton-line jp-skeleton-short" />
        </div>
      ))}
    </div>
  );
}
