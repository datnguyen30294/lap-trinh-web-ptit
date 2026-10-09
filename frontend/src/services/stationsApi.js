export async function request(path, { method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      signal,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-GoBus-Request': '1' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error(
      'Không kết nối được máy chủ. Vui lòng kiểm tra kết nối và thử lại.',
      { cause: error },
    );
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith('/auth/'))
      window.dispatchEvent(new Event('gobus:session-expired'));
    const message =
      response.status >= 500
        ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.'
        : Array.isArray(data.message)
          ? data.message.join(' ')
          : data.message || 'Thao tác không thành công.';
    const error = new Error(message);
    error.status = response.status;
    error.routes = data.routes;
    throw error;
  }
  return data;
}
export const stationsApi = {
  list: (params, signal) =>
    request(
      `/stations?${new URLSearchParams(Object.entries(params).filter(([, value]) => value !== ''))}`,
      { signal },
    ),
  create: (body) => request('/stations', { method: 'POST', body }),
  update: (id, body) => request(`/stations/${id}`, { method: 'PATCH', body }),
  setStatus: (id, is_active) =>
    request(`/stations/${id}/status`, { method: 'PATCH', body: { is_active } }),
};
export const authApi = {
  me: () => request('/auth/me'),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
};
