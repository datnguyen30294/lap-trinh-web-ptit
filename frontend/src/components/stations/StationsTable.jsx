import StationStatus from './StationStatus';

export default function StationsTable({ stations, offset, onEdit, onStatus }) {
  return (
    <div className="table-shell">
      <table className="stations-table">
        <caption className="sr-only">Danh sách bến xe</caption>
        <thead>
          <tr>
            {[
              'STT',
              'Mã bến',
              'Tên bến xe',
              'Địa chỉ',
              'Trạng thái',
              'Hành động',
            ].map((label) => (
              <th key={label} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stations.map((station, index) => (
            <tr key={station.id}>
              <td data-label="STT">{offset + index + 1}</td>
              <td data-label="Mã bến">
                <span className="station-code">{station.code}</span>
              </td>
              <td data-label="Tên bến xe" className="station-name">
                {station.name}
              </td>
              <td data-label="Địa chỉ" className="station-address">
                {station.address}
              </td>
              <td data-label="Trạng thái">
                <StationStatus active={station.is_active} />
              </td>
              <td data-label="Hành động">
                <div className="row-actions">
                  <button
                    className="icon-button"
                    onClick={() => onEdit(station)}
                    aria-label={`Sửa ${station.name}`}
                    title="Sửa thông tin"
                  >
                    <img src="/icons/edit2.svg" alt="" />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => onStatus(station)}
                    aria-label={`${station.is_active ? 'Ngừng hoạt động' : 'Kích hoạt'} ${station.name}`}
                  >
                    {station.is_active ? 'Ngừng' : 'Kích hoạt'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
