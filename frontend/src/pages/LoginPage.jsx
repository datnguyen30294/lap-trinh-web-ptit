import { useEffect, useRef, useState } from "react";
import { authApi } from "../services/stationsApi";
import AppLink from "../components/AppLink";
export default function LoginPage({ onLogin, message = "" }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const submitting = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const user = await authApi.login({
        email: data.get("email"),
        password: data.get("password"),
      });
      if (mounted.current) onLogin(user);
    } catch (err) {
      if (mounted.current) setError(err.message);
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-intro">
        <a className="wordmark" href="/">
          GOBUS
        </a>
        <div>
          <p className="eyebrow">ĐỒNG HÀNH CÙNG GOBUS</p>
          <h1>
            Hành trình xanh.
            <br />
            Kết nối hành trình.
          </h1>
          <p>
            Đăng nhập để khám phá các tuyến xe và kết nối hành trình của bạn
            cùng GoBus.
          </p>
        </div>
        <p className="login-footer">GoBus · Quản lý vận tải hành khách</p>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <h2>Đăng nhập GoBus</h2>
          <p className="muted">Đăng nhập để tiếp tục hành trình cùng GoBus.</p>
          {message && (
            <div className="alert" role="status">
              {message}
            </div>
          )}
          <label className="form-field">
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={160}
              autoComplete="username"
              placeholder="Nhập email"
              disabled={busy}
            />
          </label>
          <label className="form-field">
            <span>Mật khẩu</span>
            <input
              name="password"
              type="password"
              required
              maxLength={72}
              autoComplete="current-password"
              placeholder="Nhập mật khẩu"
              disabled={busy}
            />
          </label>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="button button-primary login-submit"
            disabled={busy}
          >
            {busy ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
          <p className="login-help muted">
            Chưa có tài khoản?{" "}
            <AppLink href="/register">
              <strong>Đăng ký ngay</strong>
            </AppLink>
          </p>
        </form>
      </section>
    </main>
  );
}
