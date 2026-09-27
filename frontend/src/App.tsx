import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import userIcon from "./assets/stations/user.svg";
import routeIcon from "./assets/stations/gitbranch.svg";
import calendarIcon from "./assets/stations/calendar.svg";
import stationIcon from "./assets/stations/mappin.svg";
import fareIcon from "./assets/stations/tag.svg";
import plusIcon from "./assets/stations/plus.svg";
import searchIcon from "./assets/stations/search.svg";
import statusIcon from "./assets/stations/ellipse.svg";
import editIcon from "./assets/stations/edit2.svg";
import deleteIcon from "./assets/stations/trash2.svg";
import "./App.css";

type Station = {
  id: string;
  code: string;
  name: string;
  address: string;
  is_active?: boolean;
};
type Fields = Pick<Station, "code" | "name" | "address">;
const PAGE_SIZE = 5;
const preview =
  new URLSearchParams(window.location.search).get("preview") === "1";
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
const previewStations: Station[] = [
 
];
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target !== ref.current) return;
        const box = ref.current!.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="close-button" onClick={onClose} aria-label="Đóng">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function App() {
  const [stations, setStations] = useState<Station[]>(
    preview ? previewStations : [],
  );
  const [loading, setLoading] = useState(!preview);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Station | "new" | null>(null);
  const [fields, setFields] = useState<Fields>({
    code: "",
    name: "",
    address: "",
  });
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Station | null>(null);
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    async function loadStations() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(apiUrl.replace(/\/$/, "") + "/stations", {
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            "Không tải được danh sách bến xe (HTTP " + response.status + ").",
          );
        const data: unknown = await response.json();
        if (
          !Array.isArray(data) ||
          !data.every(
            (item) =>
              item &&
              (typeof item.id === "string" || typeof item.id === "number") &&
              typeof item.code === "string" &&
              typeof item.name === "string" &&
              typeof item.address === "string",
          )
        )
          throw new Error("Dữ liệu danh sách bến xe không hợp lệ.");
        setStations(data.map((item) => ({ ...item, id: String(item.id) })));
      } catch (err) {
        if (!controller.signal.aborted)
          setError(
            err instanceof TypeError
              ? "Không kết nối được hệ thống. Hãy kiểm tra backend rồi thử lại."
              : err instanceof Error
                ? err.message
                : "Không tải được danh sách bến xe.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadStations();
    return () => controller.abort();
  }, [reload]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const filtered = stations.filter((station) =>
    normalize(
      station.code + " " + station.name + " " + station.address,
    ).includes(normalize(search.trim())),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const visible = filtered.slice(offset, offset + PAGE_SIZE);
  function openEditor(station?: Station) {
    setEditor(station || "new");
    setFormError("");
    setFields(
      station
        ? { code: station.code, name: station.name, address: station.address }
        : { code: "", name: "", address: "" },
    );
  }
  function saveStation(event: FormEvent) {
    event.preventDefault();
    const values = {
      code: fields.code.trim(),
      name: fields.name.trim(),
      address: fields.address.trim(),
    };
    if (!values.code || !values.name || !values.address) {
      setFormError("Vui lòng nhập đầy đủ thông tin bến xe.");
      return;
    }
    if (
      stations.some(
        (station) =>
          station.code.toLowerCase() === values.code.toLowerCase() &&
          station.id !== (editor && editor !== "new" ? editor.id : null),
      )
    ) {
      setFormError("Mã bến xe đã tồn tại. Vui lòng dùng mã khác.");
      return;
    }
    if (editor === "new") {
      setStations((previous) => [
        { id: "local-" + crypto.randomUUID(), ...values },
        ...previous,
      ]);
      setSearch("");
      setPage(1);
    } else if (editor) {
      setStations((previous) =>
        previous.map((station) =>
          station.id === editor.id ? { ...station, ...values } : station,
        ),
      );
    }
    setEditor(null);
    setToast("Đã cập nhật bản xem thử. Thay đổi chưa lưu vào hệ thống.");
  }
  const navItems = [
    { label: "Quản lý tuyến xe", icon: routeIcon },
    { label: "Quản lý lịch trình", icon: calendarIcon },
    { label: "Quản lý bến xe", icon: stationIcon },
    { label: "Quản lý giá vé", icon: fareIcon },
  ];
  return (
    <div className="admin-layout">
      <div className="screen-label">Danh sách bến xe</div>
      <header className="topbar">
        <strong>EGBUS ADMIN</strong>
        <div className="account">
          <span>Nguyễn Minh Trí</span>
          <div className="avatar">
            <img src={userIcon} alt="" />
          </div>
        </div>
      </header>
      <div className="admin-body">
        <aside className="sidebar">
          <nav aria-label="Menu quản trị">
            {navItems.map((item, index) => (
              <button
                key={item.label}
                className={"nav-item" + (index === 2 ? " active" : "")}
                aria-current={index === 2 ? "page" : undefined}
                onClick={() => {
                  if (index !== 2)
                    setToast(item.label + " đang được phát triển.");
                }}
              >
                <img src={item.icon} alt="" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <h1>Quản lý bến xe</h1>
              <p>Quản lý thông tin và danh sách các bến xe trong hệ thống</p>
            </div>
            <button
              className="add-button"
              onClick={() => openEditor()}
              disabled={loading || !!error}
            >
              <img src={plusIcon} alt="" />
              Thêm bến xe
            </button>
          </div>
          <label className="search-box">
            <img src={searchIcon} alt="" />
            <input
              type="search"
              aria-label="Tìm kiếm bến xe"
              placeholder="Tìm kiếm bến xe..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="table-scroll">
            <table className="stations-table">
              <colgroup>
                <col className="col-number" />
                <col className="col-name" />
                <col />
                <col className="col-status" />
                <col className="col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">STT</th>
                  <th scope="col">Tên bến xe</th>
                  <th scope="col">Địa chỉ</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col" className="align-right">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="table-message" role="status">
                      <span className="spinner" />
                      Đang tải danh sách bến xe…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="table-message">
                      <p role="alert">{error}</p>
                      <button
                        className="secondary-button retry-button"
                        onClick={() => setReload((value) => value + 1)}
                      >
                        Thử lại
                      </button>
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="table-message">
                      {search
                        ? "Không tìm thấy bến xe phù hợp."
                        : "Chưa có bến xe trong hệ thống."}
                    </td>
                  </tr>
                ) : (
                  visible.map((station, index) => (
                    <tr key={station.id}>
                      <td>{offset + index + 1}</td>
                      <td className="station-name" title={station.name}>
                        {station.name}
                      </td>
                      <td>
                        <div
                          className="station-address"
                          title={station.address}
                        >
                          {station.address}
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "station-status" +
                            (station.is_active === undefined ? " unknown" : "")
                          }
                        >
                          <img src={statusIcon} alt="" />
                          {station.is_active === undefined
                            ? "Chưa cập nhật"
                            : station.is_active
                              ? "Hoạt động"
                              : "Ngừng hoạt động"}
                        </span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            aria-label={"Sửa " + station.name}
                            title="Sửa bến xe"
                            onClick={() => openEditor(station)}
                          >
                            <img src={editIcon} alt="" />
                          </button>
                          <button
                            className="icon-button delete-button"
                            aria-label={"Xóa " + station.name}
                            title="Xóa bến xe"
                            onClick={() => setDeleting(station)}
                          >
                            <img src={deleteIcon} alt="" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <footer className="table-footer">
            <p aria-live="polite">
              Hiển thị {filtered.length ? offset + 1 : 0}-
              {Math.min(offset + PAGE_SIZE, filtered.length)} trên{" "}
              {filtered.length} kết quả
            </p>
            <nav className="pagination" aria-label="Phân trang">
              <button
                disabled={currentPage <= 1 || loading || !!error}
                onClick={() => setPage(currentPage - 1)}
              >
                Trước
              </button>
              <button
                className="page-current"
                aria-current="page"
                aria-label={"Trang " + currentPage}
              >
                {currentPage}
              </button>
              <button
                disabled={currentPage >= pageCount || loading || !!error}
                onClick={() => setPage(currentPage + 1)}
              >
                Sau
              </button>
            </nav>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Đóng thông báo" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {editor && (
        <Modal
          title={editor === "new" ? "Thêm bến xe" : "Sửa bến xe"}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={saveStation}>
            <p className="preview-note">
              Bản xem thử: thay đổi chỉ áp dụng trong phiên này, chưa lưu vào hệ
              thống.
            </p>
            <label className="form-field">
              Mã bến xe
              <input
                autoFocus
                required
                maxLength={20}
                value={fields.code}
                onChange={(event) =>
                  setFields({ ...fields, code: event.target.value })
                }
                placeholder="Ví dụ: BEN01"
              />
            </label>
            <label className="form-field">
              Tên bến xe
              <input
                required
                maxLength={160}
                value={fields.name}
                onChange={(event) =>
                  setFields({ ...fields, name: event.target.value })
                }
                placeholder="Nhập tên bến xe"
              />
            </label>
            <label className="form-field">
              Địa chỉ
              <textarea
                required
                maxLength={255}
                rows={3}
                value={fields.address}
                onChange={(event) =>
                  setFields({ ...fields, address: event.target.value })
                }
                placeholder="Nhập địa chỉ bến xe"
              />
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setEditor(null)}
              >
                Hủy
              </button>
              <button className="add-button" type="submit">
                Lưu bản xem thử
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleting && (
        <Modal title="Xóa bến xe" onClose={() => setDeleting(null)}>
          <p className="delete-description">
            Bạn muốn xóa <strong>{deleting.name}</strong> khỏi bản xem thử?
          </p>
          <p className="preview-note">
            Thao tác này không xóa dữ liệu trong hệ thống.
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setDeleting(null)}
            >
              Hủy
            </button>
            <button
              className="danger-button"
              onClick={() => {
                setStations((previous) =>
                  previous.filter((station) => station.id !== deleting.id),
                );
                setDeleting(null);
                setToast(
                  "Đã xóa khỏi bản xem thử. Dữ liệu hệ thống vẫn được giữ nguyên.",
                );
              }}
            >
              Xóa khỏi bản xem thử
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
