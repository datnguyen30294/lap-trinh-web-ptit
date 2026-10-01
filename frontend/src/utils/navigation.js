export const adminPaths = ['/stations', '/routes', '/schedules'];
export const homePath = (role) =>
  role === 'ADMIN' ? '/stations' : role === 'USER' ? '/user/home' : null;
export const currentPath = () =>
  window.location.pathname.replace(/\/+$/, '') || '/';
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
export function resolvePath(path, user) {
  if (!user) return '/login';
  const home = homePath(user.role);
  if (!home) return path;
  if (path === '/' || path === '/login') return home;
  if (user.role === 'USER' && adminPaths.includes(path)) return home;
  if (user.role === 'ADMIN' && path === '/user/home') return home;
  return path;
}
