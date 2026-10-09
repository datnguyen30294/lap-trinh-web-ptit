import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RegisterPage from "./RegisterPage";

const newUser = {
  id: "42",
  full_name: "Nguyễn An",
  email: "an@example.test",
  role: "USER",
};
const response = (body, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});
let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(response(newUser, 201));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function fillForm(
  actor,
  {
    name = "Nguyễn An",
    password = "DangKy2026! ",
    confirm = password,
    accept = true,
  } = {},
) {
  await actor.type(screen.getByLabelText("Họ và tên"), name);
  await actor.type(
    screen.getByLabelText("Email", { exact: true }),
    "AN@example.test",
  );
  await actor.type(
    screen.getByLabelText("Mật khẩu", { exact: true }),
    password,
  );
  await actor.type(screen.getByLabelText("Xác nhận mật khẩu"), confirm);
  if (accept) await actor.click(screen.getByRole("checkbox"));
}

describe("Registration form", () => {
  it("AC-2 sends normalized identity, unchanged password and consent, then reports the new session", async () => {
    const actor = userEvent.setup();
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);
    await fillForm(actor, { name: "  Nguyễn An  " });
    await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-GoBus-Request": "1" },
        body: JSON.stringify({
          full_name: "Nguyễn An",
          email: "an@example.test",
          password: "DangKy2026! ",
          confirm_password: "DangKy2026! ",
          terms_accepted: true,
        }),
      }),
    );
    expect(onRegister).toHaveBeenCalledWith(newUser);
  });

  it.each([
    [
      { confirm: "Different2026!" },
      "Xác nhận mật khẩu không khớp.",
      "Xác nhận mật khẩu",
    ],
    [{ password: "ứ".repeat(25) }, "Mật khẩu quá dài.", "Mật khẩu"],
    [{ name: "   " }, "Vui lòng nhập họ và tên.", "Họ và tên"],
  ])(
    "AC-3 focuses an accessible validation error without submitting %j",
    async (fields, message, label) => {
      const actor = userEvent.setup();
      render(<RegisterPage onRegister={vi.fn()} />);
      await fillForm(actor, fields);
      await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      expect(screen.getByRole("alert")).toHaveFocus();
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByLabelText(label, { exact: true })).toHaveAttribute(
        "aria-describedby",
        "register-error",
      );
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("AC-5 requires consent before the browser submits the form", async () => {
    const actor = userEvent.setup();
    render(<RegisterPage onRegister={vi.fn()} />);
    await fillForm(actor, { accept: false });
    await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(screen.getByRole("checkbox")).toBeInvalid();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-4 AC-5 retains values after duplicate email and allows a corrected retry", async () => {
    fetchMock.mockResolvedValueOnce(
      response({ message: "Email đã được đăng ký." }, 409),
    );
    const actor = userEvent.setup();
    const onRegister = vi.fn();
    render(<RegisterPage onRegister={onRegister} />);
    await fillForm(actor);
    await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email đã được đăng ký.",
    );
    expect(screen.getByLabelText("Mật khẩu", { exact: true })).toHaveValue(
      "DangKy2026! ",
    );
    expect(screen.getByLabelText("Họ và tên")).toHaveValue("Nguyễn An");
    const email = screen.getByLabelText("Email", { exact: true });
    expect(email).toHaveAttribute("aria-invalid", "true");
    await actor.clear(email);
    await actor.type(email, "another@example.test");
    await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRegister).toHaveBeenCalledOnce();
  });

  it("AC-5 recovers after a network failure", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const actor = userEvent.setup();
    render(<RegisterPage onRegister={vi.fn()} />);
    await fillForm(actor);
    await actor.click(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không kết nối được máy chủ",
    );
    expect(screen.getByRole("button", { name: "Tạo tài khoản" })).toBeEnabled();
    expect(screen.getByLabelText("Email", { exact: true })).toHaveValue(
      "AN@example.test",
    );
  });

  it("AC-5 prevents repeated submits and ignores completion after leaving the page", async () => {
    let finish;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const actor = userEvent.setup();
    const onRegister = vi.fn();
    const { unmount } = render(<RegisterPage onRegister={onRegister} />);
    await fillForm(actor);
    await actor.dblClick(screen.getByRole("button", { name: "Tạo tài khoản" }));
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Đang tạo tài khoản…" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Email", { exact: true })).toBeDisabled();
    unmount();
    await act(async () => finish(response(newUser, 201)));
    expect(onRegister).not.toHaveBeenCalled();
  });
});
