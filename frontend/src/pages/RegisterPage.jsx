import { useEffect, useRef, useState } from "react";
import AppLink from "../components/AppLink";
import { authApi } from "../services/stationsApi";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/latin-700.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-700.css";
import "./register.css";

export default function RegisterPage({ onRegister }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const submitting = useRef(false);
  const mounted = useRef(false);
  const errorRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    const previousTitle = document.title;
    document.title = "Đăng ký | GoBus";
    return () => {
      mounted.current = false;
      document.title = previousTitle;
    };
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    const body = {
      full_name: data.get("full_name").trim(),
      email: data.get("email").trim().toLowerCase(),
      password: data.get("password"),
      confirm_password: data.get("confirm_password"),
      terms_accepted: data.get("terms_accepted") === "on",
    };
    setError("");
    setInvalidField("");
    let field = "";
    let message = "";
    if (!body.full_name) {
      field = "full_name";
      message = "Vui lòng nhập họ và tên.";
    } else if (Array.from(body.password).length < 8) {
      field = "password";
      message = "Mật khẩu cần ít nhất 8 ký tự.";
    } else if (new TextEncoder().encode(body.password).length > 72) {
      field = "password";
      message = "Mật khẩu quá dài. Hãy dùng tối đa 72 byte UTF-8.";
    } else if (body.password !== body.confirm_password) {
      field = "confirm_password";
      message = "Xác nhận mật khẩu không khớp.";
    } else if (!body.terms_accepted) {
      field = "terms_accepted";
      message = "Vui lòng đồng ý với điều khoản sử dụng và chính sách bảo mật.";
    }
    if (message) {
      setInvalidField(field);
      setError(message);
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      const user = await authApi.register(body);
      if (mounted.current) onRegister(user);
    } catch (err) {
      if (mounted.current) {
        setInvalidField(err.status === 409 ? "email" : "");
        setError(err.message);
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const errorProps = (name) => ({
    "aria-invalid": invalidField === name || undefined,
    "aria-describedby": invalidField === name ? "register-error" : undefined,
  });

  return (
    <div className="register-page">
      <a className="skip-link" href="#register-form">
        Đến biểu mẫu đăng ký
      </a>
      <header className="register-header">
        <AppLink
          className="register-brand"
          href="/"
          aria-label="GoBus, trang chủ"
        >
          <span className="register-brand-mark" aria-hidden="true" />
          <span>GoBus</span>
        </AppLink>
        <div className="register-header-login">
          <span>Đã có tài khoản?</span>
          <AppLink href="/login">Đăng nhập</AppLink>
        </div>
      </header>
      <main className="register-content">
        <section className="register-intro" aria-labelledby="register-welcome">
          <p className="register-eyebrow">GOBUS / TÀI KHOẢN</p>
          <h2 id="register-welcome">
            Bắt đầu hành trình
            <br />
            của bạn hôm nay.
          </h2>
          <p className="register-support">
            Tạo tài khoản để đặt vé nhanh hơn, quản lý chuyến đi và lưu thông
            tin tiện lợi.
          </p>
        </section>
        <section className="register-card" aria-labelledby="register-title">
          <h1 id="register-title">Tạo tài khoản mới</h1>
          <p className="register-subtitle">
            Chỉ mất chưa đến một phút để bắt đầu.
          </p>
          <form
            id="register-form"
            onSubmit={submit}
            aria-busy={busy}
            tabIndex={-1}
          >
            <div className="register-fields">
              <label className="register-field">
                <span>Họ và tên</span>
                <input
                  name="full_name"
                  autoComplete="name"
                  placeholder="Nguyễn Văn A"
                  required
                  maxLength={120}
                  disabled={busy}
                  {...errorProps("full_name")}
                />
              </label>
              <label className="register-field">
                <span>Email</span>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  required
                  maxLength={160}
                  disabled={busy}
                  {...errorProps("email")}
                />
              </label>
              <label className="register-field">
                <span>Mật khẩu</span>
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Ít nhất 8 ký tự"
                  required
                  minLength={8}
                  maxLength={72}
                  disabled={busy}
                  {...errorProps("password")}
                />
              </label>
              <label className="register-field">
                <span>Xác nhận mật khẩu</span>
                <input
                  name="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  required
                  maxLength={72}
                  disabled={busy}
                  {...errorProps("confirm_password")}
                />
              </label>
            </div>
            <label className="register-consent">
              <input
                name="terms_accepted"
                type="checkbox"
                required
                disabled={busy}
                {...errorProps("terms_accepted")}
              />
              <span>
                Tôi đồng ý với Điều khoản sử dụng và Chính sách bảo mật.
              </span>
            </label>
            {error && (
              <p
                className="register-error"
                id="register-error"
                role="alert"
                tabIndex={-1}
                ref={errorRef}
              >
                {error}
              </p>
            )}
            <button className="register-submit" type="submit" disabled={busy}>
              {busy ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
            </button>
            {busy && (
              <span className="sr-only" role="status">
                Đang tạo tài khoản. Vui lòng chờ.
              </span>
            )}
          </form>
          <p className="register-login-prompt">
            <span>Đã có tài khoản?</span>
            <AppLink href="/login">Đăng nhập</AppLink>
          </p>
        </section>
      </main>
    </div>
  );
}
