document.addEventListener('DOMContentLoaded', async () => {
  const { config } = await chrome.storage.local.get('config');

  // Dynamic site name
  const siteEl = document.getElementById('site-name');
  if (siteEl && config?.targetDomain) {
    siteEl.textContent = config.targetDomain;
  }

  // Close Tab
  const closeBtn = document.getElementById('close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => window.close());
  }

  // Dynamic Search button redirect
  const searchBtn = document.getElementById('search-btn');
  if (searchBtn) {
    const redirectUrl = config?.searchRedirect || 'https://google.com';
    searchBtn.addEventListener('click', () => {
      window.location.href = redirectUrl;
    });
  }
});