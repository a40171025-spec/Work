// Native scrolling helpers: in-page links glide to their section below the fixed header.

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollToEl(el: HTMLElement) {
  const hdr = document.getElementById('hdr')?.offsetHeight ?? 64;
  const y = el.getBoundingClientRect().top + window.scrollY - hdr;
  window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

export function initEngine() {
  // in-page links (#collection, /#faq when already on the home page)
  document.addEventListener('click', (e) => {
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const el = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!el) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    scrollToEl(el);
  });

  // arriving with a hash (e.g. /#faq from another page)
  if (location.hash.length > 1) {
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (el) requestAnimationFrame(() => scrollToEl(el));
  }
}
