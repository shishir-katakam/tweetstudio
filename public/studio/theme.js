// Apply the selected scheme before first paint. System follows OS changes.
(() => {
  const key = 'tweetstudio.appearance.v1';
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const choices = new Set(['system', 'light', 'dark']);
  let preference = 'system';
  try {
    const stored = localStorage.getItem(key);
    if (choices.has(stored)) preference = stored;
  } catch {}

  function apply() {
    const theme = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#12151c' : '#fafafa');
    document.querySelectorAll('[data-appearance]').forEach(select => { select.value = preference; });
  }
  apply();
  document.addEventListener('DOMContentLoaded', apply, { once: true });
  document.addEventListener('change', event => {
    const select = event.target.closest('[data-appearance]');
    if (!select || !choices.has(select.value)) return;
    preference = select.value;
    try { localStorage.setItem(key, preference); } catch {}
    apply();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    preference = choices.has(event.newValue) ? event.newValue : 'system';
    apply();
  });
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
})();
