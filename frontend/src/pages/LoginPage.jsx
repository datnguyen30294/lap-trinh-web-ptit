import { useState } from 'react';
import { authApi } from '../services/stationsApi';
export default function LoginPage({ onLogin, message = '' }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      onLogin(
        await authApi.login({
          email: data.get('email'),
          password: data.get('password'),
        }),
      );
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  return (
    <main className="login-page">
      <section className="login-intro">
        <a className="wordmark" href="/">
          GOBUS <span>ADMIN</span>
        </a>
        <div>
          <p className="eyebrow">HỆ THỐNG QUẢN TRỊ</p>
          <h1>
            Quản lý bến xe.
            <br />
            Kết nối hành trình.
          </h1>
          <p>
            Quản lý thông tin và trạng thái các bến xe trong hệ thống GoBus, tập
            trung tại một nơi.
          </p>
        </div>
        <p className="login-footer">GoBus · Quản lý vận tải hành khách</p>
      </section>
      <section className="login-panel">
        <form className="login-form" onSubmit={submit}>
          <h2>Đăng nhập quản trị</h2>
          <p className="muted">Sử dụng tài khoản được cấp trong hệ thống.</p>
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
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
          <p className="login-help muted">
            Chỉ tài khoản có quyền quản trị mới có thể quản lý bến xe.
          </p>
        </form>
      </section>
    </main>
  );
}
