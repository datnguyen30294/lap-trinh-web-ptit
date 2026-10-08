import { pushNavigation } from '../utils/navigation';

// Chuyển trang trong React, vẫn giữ Ctrl + click và mở tab mới như liên kết thường.
export default function AppLink({ href, onClick, children, ...props }) {
  function follow(event) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = event.currentTarget;
    const url = new URL(link.href);
    if (
      link.hasAttribute('download') ||
      (link.target && link.target !== '_self') ||
      url.origin !== window.location.origin
    )
      return;
    if (url.href === window.location.href && !url.hash) {
      event.preventDefault();
      return;
    }
    if (
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    )
      return;
    event.preventDefault();
    pushNavigation(url.href);
  }
  return (
    <a href={href} onClick={follow} {...props}>
      {children}
    </a>
  );
}
