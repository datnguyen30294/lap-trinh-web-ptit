export default function StationStatus({ active }) {
  return (
    <span className={`station-status ${active ? 'is-active' : 'is-inactive'}`}>
      <span className="status-dot" aria-hidden="true" />
      {active ? 'Đang hoạt động' : 'Ngừng hoạt động'}
    </span>
  );
}
