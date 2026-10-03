export const adminPaths = ['/stations', '/routes', '/schedules'];
export const homePath = (role) =>
  role === 'ADMIN' ? '/stations' : role === 'USER' ? '/user/home' : null;
export const currentPath = () =>
  window.location.pathname.replace(/\/+$/, '') || '/';
export const currentLocation = () => currentPath() + window.location.search;
export function subscribePath(callback) {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
}
export function navigate(path) {
  if (
    window.location.pathname === path &&
    !window.location.search &&
    !window.location.hash
  )
    return;
  window.history.replaceState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
// Liên kết người dùng thêm lịch sử để nút Back vẫn dùng được.
export function pushNavigation(href) {
  const url = new URL(href, window.location.href);
  if (url.href === window.location.href) return;
  window.history.pushState(null, '', url.pathname + url.search + url.hash);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
export function resolvePath(path, user) {
  if (!user) return '/login';
  const home = homePath(user.role);
  if (!home) return path;
  if (path === '/' || path === '/login') return home;
  if (user.role === 'USER' && adminPaths.includes(path)) return home;
  if (user.role === 'ADMIN' && path === '/user/home') return home;
  return path;
}
