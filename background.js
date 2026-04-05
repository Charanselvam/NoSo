const TARGET_MATCH = (url, domainsArray) => {
  if (!url || !domainsArray || !Array.isArray(domainsArray)) return false;
  const lowerUrl = url.toLowerCase();
  return domainsArray.some(domain => lowerUrl.includes(domain.toLowerCase()));
};

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['config', 'timeSpent', 'lastResetDay']);

  if (!result.config) {
    await chrome.storage.local.set({
      config: {
        targetDomain: "instagram.com",
        limitMinutes: 30,
        searchRedirect: "https://google.com"
      },
      timeSpent: 0,
      lastResetDay: new Date().getDate()
    });
  }

  // Alarm runs every 1 minute to increment time
  chrome.alarms.create("checkTime", { periodInMinutes: 1 });
});

// 1. Increment time every minute
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkTime") {
    handleTimeTracking();
  }
});

// 2. INSTANT BLOCK: Catch when they navigate to the site
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    enforceInstantBlock(tabId, changeInfo.url);
  }
});

// 3. INSTANT BLOCK: Catch when they switch back to an already open tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url) {
    enforceInstantBlock(activeInfo.tabId, tab.url);
  }
});

// Helper Function: Instantly block if they are already over the limit
async function enforceInstantBlock(tabId, url) {
  const data = await chrome.storage.local.get(['config', 'timeSpent', 'lastResetDay']);
  const config = data.config;

  if (!config?.targetDomain || !TARGET_MATCH(url, config.targetDomain)) return;

  const today = new Date().getDate();
  let currentTimeSpent = data.timeSpent || 0;

  // If it's a new day, don't block them (let the alarm reset the timer)
  if (today !== data.lastResetDay) return;

  // If they are out of time, block immediately
  if (currentTimeSpent >= config.limitMinutes) {
    const blockedUrl = chrome.runtime.getURL("blocked.html");
    if (url !== blockedUrl) {
      await chrome.tabs.update(tabId, { url: blockedUrl });
    }
  }
}

// Helper Function: The 1-minute timer that actually counts the time spent
async function handleTimeTracking() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.url) return;

    const data = await chrome.storage.local.get(['config', 'timeSpent', 'lastResetDay']);
    const config = data.config;
    let domainsToTrack = config.targetDomains || [];
    if (config.targetDomain && domainsToTrack.length === 0) {
      domainsToTrack = [config.targetDomain];
    }

    if (!TARGET_MATCH(tab.url, domainsToTrack)) {
      // Clear badge if not on target site
      chrome.action.setBadgeText({ text: '' });
      return;
    }

    let currentTimeSpent = data.timeSpent || 0;
    const today = new Date().getDate();

    // Reset at midnight
    if (today !== data.lastResetDay) {
      currentTimeSpent = 0;
    }

    currentTimeSpent++;

    // Update extension badge to show minutes spent
    chrome.action.setBadgeText({ text: `${currentTimeSpent}m` });
    chrome.action.setBadgeBackgroundColor({ color: currentTimeSpent >= config.limitMinutes ? '#dc2743' : '#0095f6' });

    if (currentTimeSpent >= config.limitMinutes) {
      const blockedUrl = chrome.runtime.getURL("blocked.html");
      if (tab.url !== blockedUrl) {
        await chrome.tabs.update(tab.id, { url: blockedUrl });

        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          title: 'Limit Reached',
          message: `Your time on ${config.targetDomain} is up! 🏃‍♂️`,
          priority: 2
        });
      }
    }

    await chrome.storage.local.set({
      timeSpent: currentTimeSpent,
      lastResetDay: today
    });
  } catch (error) {
    console.error("Time tracking error:", error);
  }
}