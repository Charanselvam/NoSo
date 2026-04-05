function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

async function updateDisplay() {
  const { timeSpent = 0 } = await chrome.storage.local.get('timeSpent');
  document.getElementById('time').textContent = formatTime(timeSpent);
}

async function loadConfigIntoForm() {
  const { config } = await chrome.storage.local.get('config');
  if (config) {
    // Support older configs that used 'targetDomain' string
    let domains = config.targetDomains || [];
    if (config.targetDomain && domains.length === 0) {
      domains = [config.targetDomain];
    }

    document.getElementById('target-input').value = domains.join(', ');
    document.getElementById('limit-input').value = config.limitMinutes || 30;
    document.getElementById('search-redirect-input').value = config.searchRedirect || 'https://google.com';
  }
}

async function updateTimerCircle() {
  const { timeSpent = 0 } = await chrome.storage.local.get('timeSpent');
  const { config } = await chrome.storage.local.get('config');
  
  const limit = config?.limitMinutes || 30;
  const progress = Math.min((timeSpent / (limit * 60)) * 100, 100);

  const circle = document.getElementById('timer-circle');
  if (circle) {
    circle.style.setProperty('--progress', progress);
  }

  const timeEl = document.getElementById('time');
  if (progress > 80 && timeEl) {
    timeEl.style.color = '#ff9800';
  } else if (timeEl) {
    timeEl.style.color = 'white';
  }
}

async function loadHistorySuggestions() {
  const suggestionsDiv = document.getElementById('suggestions');
  suggestionsDiv.innerHTML = '<div style="padding:12px;color:#888;font-size:13px;">Loading your top sites...</div>';

  try {
    // Explicit check for the API to provide a clearer error
    if (!chrome.history) {
      throw new Error("Missing 'history' permission in manifest.json");
    }

    const items = await chrome.history.search({
      text: '',
      maxResults: 150,
      startTime: Date.now() - 90 * 24 * 60 * 60 * 1000
    });

    const domainMap = new Map();

    items.forEach(item => {
      if (!item.url) return;
      try {
        let hostname = new URL(item.url).hostname.replace(/^www\./i, '');
        if (!hostname || hostname.includes('chrome-extension') || hostname.length < 4) return;
        
        const count = domainMap.get(hostname) || 0;
        domainMap.set(hostname, count + (item.visitCount || 1));
      } catch (e) {}
    });

    const topSites = Array.from(domainMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12);

    suggestionsDiv.innerHTML = '';

    if (topSites.length === 0) {
      suggestionsDiv.innerHTML = '<div style="padding:12px;color:#888;font-size:13px;">No history found yet.</div>';
      return;
    }

    topSites.forEach(([domain]) => {
      const div = document.createElement('div');
      div.className = 'suggestion';
      div.textContent = domain;
      div.addEventListener('click', () => {
        // Append to existing input instead of replacing
        const input = document.getElementById('target-input');
        const currentDomains = input.value.split(',').map(d => d.trim()).filter(Boolean);
        
        if (!currentDomains.includes(domain)) {
          currentDomains.push(domain);
          input.value = currentDomains.join(', ');
        }
      });
      suggestionsDiv.appendChild(div);
    });

  } catch (err) {
    suggestionsDiv.innerHTML = `<div style="padding:12px;color:#f55;font-size:13px;">Failed: ${err.message}</div>`;
    console.error(err);
  }
}

async function saveSettings() {
  const rawInput = document.getElementById('target-input').value;
  
  // Split by comma, clean up whitespace, remove empty items, convert to lowercase
  const targetDomains = rawInput.split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  let limitMinutes = parseInt(document.getElementById('limit-input').value);
  let searchRedirect = document.getElementById('search-redirect-input').value.trim();

  if (targetDomains.length === 0) {
    alert("Please enter at least one website domain (e.g., instagram.com)");
    return;
  }

  if (!limitMinutes || limitMinutes < 1) limitMinutes = 30;
  if (!searchRedirect) searchRedirect = "https://google.com";

  await chrome.storage.local.set({
    config: { targetDomains, limitMinutes, searchRedirect } // Saved as targetDomains array
  });

  const saveBtn = document.getElementById('save-btn');
  const originalText = saveBtn.textContent;
  saveBtn.textContent = "✅ Saved!";
  saveBtn.style.background = "#00c853";

  setTimeout(() => {
    saveBtn.textContent = originalText;
    saveBtn.style.background = "";
  }, 1800);
}

document.addEventListener('DOMContentLoaded', () => {
  updateDisplay();
  updateTimerCircle();
  loadConfigIntoForm();

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.timeSpent) {
      document.getElementById('time').textContent = formatTime(changes.timeSpent.newValue);
      updateTimerCircle();
    }
  });

  document.getElementById('load-history-btn').addEventListener('click', loadHistorySuggestions);
  document.getElementById('save-btn').addEventListener('click', saveSettings);
});