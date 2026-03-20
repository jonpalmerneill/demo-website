// Returns true when either the OS prefers-reduced-motion setting is on
// OR the visitor has enabled "Less Motion" in the site nav.
export function prefersLessMotion() {
  return document.documentElement.classList.contains('is-less-motion')
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
