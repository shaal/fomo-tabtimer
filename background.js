class AutoCloseManager {
  constructor() {
    this.tabActivity = new Map();
    this.memoryUsage = {
      lastCheck: Date.now(),
      peakUsage: 0,
      averageUsage: 0,
      checkCount: 0
    };
    this.settings = {
      enabled: true,
      timeValue: 30,
      timeUnit: 'minutes',
      excludedDomains: [],
      excludePinned: true,
      debugMode: false,
      timerPersistenceMode: 'absolute' // 'absolute' or 'continue'
    };
    this.init();
  }

  async init() {
    this.startTime = Date.now();
    await this.loadSettings();
    await this.loadTabActivity();
    this.setupEventListeners();
    this.startPeriodicCheck();
    
    if (this.settings.debugMode) {
      console.log('🐛 Debug mode enabled - background script initialized');
    }
  }

  async loadSettings() {
    console.log('⚙️ Loading settings...');
    const stored = await chrome.storage.sync.get(['autoCloseSettings']);
    if (stored.autoCloseSettings) {
      this.settings = { ...this.settings, ...stored.autoCloseSettings };
      console.log('✅ Settings loaded:', this.settings);
    } else {
      console.log('⚠️ No stored settings found, using defaults:', this.settings);
    }
    
    // Validate excluded domains
    if (!Array.isArray(this.settings.excludedDomains)) {
      console.log('🔧 Fixing excludedDomains format');
      this.settings.excludedDomains = [];
    }
    
    console.log(`🛡️ Excluded domains: ${this.settings.excludedDomains.length > 0 ? this.settings.excludedDomains.join(', ') : 'none'}`);
  }

  async loadTabActivity() {
    console.log('⏰ Loading tab activity from storage...');
    const stored = await chrome.storage.local.get(['tabActivity']);
    
    if (stored.tabActivity) {
      // Convert stored object back to Map
      this.tabActivity = new Map(Object.entries(stored.tabActivity));
      console.log(`✅ Loaded activity for ${this.tabActivity.size} tabs from storage`);
      
      // Check for tabs that should have been closed during downtime
      await this.checkForExpiredTabs();
    } else {
      console.log('⚠️ No stored tab activity found');
    }
  }

  async checkForExpiredTabs() {
    console.log(`🔍 Checking for tabs that expired during downtime (mode: ${this.settings.timerPersistenceMode})...`);
    
    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    const timeoutMs = this.getTimeoutInMs();
    
    let expiredCount = 0;
    let continuedCount = 0;
    
    for (const tab of tabs) {
      const lastActivity = this.tabActivity.get(tab.id);
      
      if (lastActivity) {
        const timeSinceActivity = now - lastActivity;
        
        if (this.settings.timerPersistenceMode === 'absolute') {
          // Absolute mode: Close tabs that should have been closed during downtime
          const shouldSkipPinned = tab.pinned && this.settings.excludePinned;
          if (timeSinceActivity > timeoutMs && !tab.active && !shouldSkipPinned && !this.isExcludedDomain(tab.url)) {
            console.log(`🗑️ Closing expired tab: ${tab.title} (inactive for ${Math.round(timeSinceActivity/1000)}s)`);
            await this.closeAndSaveTab(tab);
            expiredCount++;
          }
        } else if (this.settings.timerPersistenceMode === 'continue') {
          // Continue mode: Reset timers to continue from where they left off
          if (timeSinceActivity > timeoutMs) {
            console.log(`⏰ Continuing timer for tab: ${tab.title} (was inactive for ${Math.round(timeSinceActivity/1000)}s, resetting to fresh timeout)`);
            this.resetTabTimer(tab.id);
            continuedCount++;
          }
        }
      }
    }
    
    if (this.settings.timerPersistenceMode === 'absolute' && expiredCount > 0) {
      console.log(`✅ Closed ${expiredCount} tabs that expired during downtime`);
    } else if (this.settings.timerPersistenceMode === 'continue' && continuedCount > 0) {
      console.log(`✅ Continued ${continuedCount} timers from where they left off`);
    } else {
      console.log('✅ No timer adjustments needed');
    }
  }

  async saveTabActivity() {
    // Convert Map to object for storage
    const tabActivityObj = Object.fromEntries(this.tabActivity);
    await chrome.storage.local.set({ tabActivity: tabActivityObj });
  }

  setupEventListeners() {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      console.log(`🔄 Tab activated: ${activeInfo.tabId} - resetting timer`);
      this.resetTabTimer(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        console.log(`✅ Tab loaded: ${tab.title} - resetting timer`);
        this.resetTabTimer(tabId);
      }
      // Also reset timer when tab becomes active through updates
      if (changeInfo.active === true) {
        console.log(`🔄 Tab became active via update: ${tabId} - resetting timer`);
        this.resetTabTimer(tabId);
      }
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.tabActivity.delete(tabId);
      // Persist the updated activity to storage
      this.saveTabActivity().catch(err => {
        console.error('❌ Failed to save tab activity after tab removal:', err);
      });
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.autoCloseSettings) {
        const oldDebugMode = this.settings.debugMode;
        this.settings = { ...this.settings, ...changes.autoCloseSettings.newValue };
        
        // Restart the periodic check with new timing
        this.startPeriodicCheck();
        
        // Handle debug mode changes
        if (oldDebugMode !== this.settings.debugMode) {
          console.log(`🐛 Debug mode ${this.settings.debugMode ? 'ENABLED' : 'DISABLED'}`);
          this.handleDebugModeChange();
        }
      }
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'resetTimer' && sender.tab) {
        console.log(`📱 Manual timer reset from tab ${sender.tab.id}`);
        this.resetTabTimer(sender.tab.id);
        sendResponse({ success: true });
      } else if (message.type === 'getMemoryUsage') {
        sendResponse(this.getMemoryStats());
      } else if (message.type === 'getDebugInfo') {
        const tabId = sender.tab ? sender.tab.id : message.tabId;
        if (tabId) {
          const debugInfo = this.getDebugInfoForTab(tabId, sender.tab);
          sendResponse(debugInfo);
        } else {
          sendResponse({ error: 'No tab ID provided' });
        }
      }
    });
  }

  resetTabTimer(tabId) {
    const now = Date.now();
    const previous = this.tabActivity.get(tabId);
    
    // Always reset to current time - this is the key fix!
    this.tabActivity.set(tabId, now);
    
    // Persist the updated activity to storage
    this.saveTabActivity().catch(err => {
      console.error('❌ Failed to save tab activity:', err);
    });
    
    // Get tab title for better logging
    chrome.tabs.get(tabId).then(tab => {
      // Always log timer resets for debugging
      if (previous) {
        const timeSinceLastActivity = Math.round((now - previous) / 1000);
        console.log(`⏰ Timer RESET for "${tab.title}" (ID: ${tabId}) - was inactive for ${timeSinceLastActivity}s, now starts fresh at ${this.getTimeoutInMs()/1000}s`);
      } else {
        console.log(`🆕 New tab timer started: "${tab.title}" (ID: ${tabId}) - timeout: ${this.getTimeoutInMs()/1000}s`);
      }
    }).catch(() => {
      // Fallback if tab info not available
      if (previous) {
        const timeSinceLastActivity = Math.round((now - previous) / 1000);
        console.log(`⏰ Timer RESET for tab ${tabId} (was inactive for ${timeSinceLastActivity}s), now starts fresh at ${this.getTimeoutInMs()/1000}s`);
      } else {
        console.log(`🆕 New tab timer started: ${tabId} - timeout: ${this.getTimeoutInMs()/1000}s`);
      }
    });

    // Notify content script about activity reset if debug mode is enabled
    if (this.settings.debugMode) {
      chrome.tabs.sendMessage(tabId, { type: 'activityReset' }).catch(() => {
        // Ignore errors - content script might not be ready
      });
    }
  }

  updateTabActivity(tabId) {
    // This method is now just an alias for resetTabTimer to maintain compatibility
    this.resetTabTimer(tabId);
  }

  startPeriodicCheck() {
    // Clear any existing alarms
    chrome.alarms.clear('autoCloseCheck');
    
    // Set check frequency based on timeout setting
    const timeoutMs = this.getTimeoutInMs();
    let checkIntervalMinutes;
    
    if (timeoutMs < 60000) { // Less than 1 minute
      checkIntervalMinutes = 0.1; // Check every 6 seconds
    } else if (timeoutMs < 300000) { // Less than 5 minutes
      checkIntervalMinutes = 0.5; // Check every 30 seconds
    } else if (timeoutMs < 1800000) { // Less than 30 minutes
      checkIntervalMinutes = 1; // Check every minute
    } else {
      checkIntervalMinutes = 5; // Check every 5 minutes for longer timeouts
    }
    
    console.log(`🕐 Setting check interval to ${checkIntervalMinutes} minutes for ${timeoutMs}ms timeout`);
    
    chrome.alarms.create('autoCloseCheck', { periodInMinutes: checkIntervalMinutes });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'autoCloseCheck') {
        this.checkAndCloseTabs();
      }
    });
  }

  async checkAndCloseTabs() {
    if (!this.settings.enabled) {
      console.log('⏸️ Auto-close disabled, skipping check');
      return;
    }

    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    const timeoutMs = this.getTimeoutInMs();
    
    console.log(`🔍 Checking ${tabs.length} tabs (timeout: ${timeoutMs}ms, ${timeoutMs/1000}s)`);

    let closedCount = 0;
    for (const tab of tabs) {
      const lastActivity = this.tabActivity.get(tab.id);
      const timeSinceActivity = lastActivity ? now - lastActivity : 0;
      
      if (await this.shouldCloseTab(tab, now, timeoutMs)) {
        console.log(`🗑️ Closing tab: ${tab.title} (inactive for ${Math.round(timeSinceActivity/1000)}s)`);
        await this.closeAndSaveTab(tab);
        closedCount++;
      } else if (lastActivity) {
        const remaining = Math.max(0, timeoutMs - timeSinceActivity);
        if (remaining > 0 && remaining < 30000) { // Log if close to timeout
          console.log(`⏱️ Tab "${tab.title}" will close in ${Math.round(remaining/1000)}s`);
        }
      }
    }
    
    if (closedCount > 0) {
      console.log(`✅ Auto-close check complete: ${closedCount} tabs closed`);
    }
  }

  getTimeoutInMs() {
    const { timeValue, timeUnit } = this.settings;
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };
    return timeValue * multipliers[timeUnit];
  }

  async shouldCloseTab(tab, now, timeoutMs) {
    console.log(`🔍 Checking if tab should close: "${tab.title}" (${tab.url})`);
    
    // Check if pinned
    if (tab.pinned && this.settings.excludePinned) {
      console.log(`📌 Tab is pinned, skipping: ${tab.title}`);
      return false;
    }
    
    // Check domain exclusion
    const isExcluded = this.isExcludedDomain(tab.url);
    if (isExcluded) {
      console.log(`🚫 Tab domain is excluded, skipping: ${tab.title}`);
      return false;
    }
    
    // Check if active - and reset timer if it is
    if (tab.active) {
      console.log(`✨ Tab is active, resetting timer and skipping: ${tab.title}`);
      this.resetTabTimer(tab.id); // RESET TIMER FOR ACTIVE TAB
      return false;
    }

    const lastActivity = this.tabActivity.get(tab.id);
    if (!lastActivity) {
      console.log(`🆕 No activity recorded for tab, initializing: ${tab.title}`);
      this.resetTabTimer(tab.id);
      return false;
    }

    const timeSinceActivity = now - lastActivity;
    const shouldClose = timeSinceActivity > timeoutMs;
    
    console.log(`⏱️ Tab "${tab.title}": inactive for ${Math.round(timeSinceActivity/1000)}s, timeout: ${Math.round(timeoutMs/1000)}s, should close: ${shouldClose}`);
    
    return shouldClose;
  }

  isExcludedDomain(url) {
    if (!url) {
      console.log('❌ No URL provided for domain check');
      return false;
    }
    
    if (!this.settings.excludedDomains || !Array.isArray(this.settings.excludedDomains)) {
      console.log('⚠️ No excluded domains configured or invalid format');
      return false;
    }
    
    if (this.settings.excludedDomains.length === 0) {
      console.log('ℹ️ No excluded domains set');
      return false;
    }
    
    try {
      const domain = new URL(url).hostname;
      console.log(`🔍 Checking domain "${domain}" against ${this.settings.excludedDomains.length} exclusion patterns: [${this.settings.excludedDomains.join(', ')}]`);
      
      const isExcluded = this.settings.excludedDomains.some(pattern => {
        if (pattern.includes('*')) {
          // Handle wildcard patterns like *.example.com
          let regexPattern;
          if (pattern.startsWith('*.')) {
            // *.example.com should match subdomains of example.com
            const baseDomain = pattern.substring(2); // Remove "*."
            regexPattern = `^[^.]+\\.${this.escapeRegex(baseDomain)}$`;
          } else if (pattern.endsWith('.*')) {
            // example.* should match any TLD
            const baseDomain = pattern.substring(0, pattern.length - 2); // Remove ".*"
            regexPattern = `^${this.escapeRegex(baseDomain)}\\.[^.]+$`;
          } else {
            // General wildcard replacement
            regexPattern = this.escapeRegex(pattern).replace(/\\\*/g, '.*');
          }
          
          const regex = new RegExp(regexPattern);
          const matches = regex.test(domain);
          console.log(`🔍 Wildcard check: "${domain}" vs "${pattern}" (regex: ${regexPattern}) = ${matches}`);
          return matches;
        }
        
        // Exact match or subdomain match
        const exactMatch = domain === pattern;
        const subdomainMatch = domain.endsWith('.' + pattern);
        const matches = exactMatch || subdomainMatch;
        console.log(`🔍 Domain check: "${domain}" vs "${pattern}" = ${matches}`);
        return matches;
      });
      
      if (isExcluded) {
        console.log(`🚫 Domain "${domain}" is excluded from auto-close`);
      }
      
      return isExcluded;
    } catch (error) {
      console.error('❌ Error checking domain exclusion:', error);
      return false;
    }
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getMemoryStats() {
    const now = Date.now();
    this.memoryUsage.lastCheck = now;
    this.memoryUsage.checkCount++;

    // Basic memory stats
    const stats = {
      trackedTabs: this.tabActivity.size,
      excludedDomains: this.settings.excludedDomains.length,
      lastCheck: new Date(now).toLocaleTimeString(),
      checkCount: this.memoryUsage.checkCount,
      uptime: Math.round((now - (this.startTime || now)) / 1000)
    };

    return stats;
  }

  getDebugInfoForTab(tabId, tab = null) {
    const now = Date.now();
    const lastActivity = this.tabActivity.get(tabId);
    const timeoutMs = this.getTimeoutInMs();
    
    // Check if domain is excluded
    let isExcluded = false;
    if (tab && tab.url) {
      isExcluded = this.isExcludedDomain(tab.url);
    }
    
    // Calculate time remaining - key fix: only countdown when tab is INACTIVE
    let timeRemaining;
    const isActive = tab ? tab.active : false;
    
    if (isActive) {
      // Tab is active - timer should show full timeout
      timeRemaining = timeoutMs;
      if (this.settings.debugMode) {
        console.log(`🟢 Tab ${tabId} is ACTIVE - showing full timeout: ${Math.round(timeRemaining/1000)}s`);
      }
    } else {
      // Tab is inactive - show countdown
      const timeSinceActivity = lastActivity ? now - lastActivity : 0;
      timeRemaining = lastActivity ? Math.max(0, timeoutMs - timeSinceActivity) : timeoutMs;
      if (this.settings.debugMode) {
        console.log(`🔴 Tab ${tabId} is INACTIVE - time since activity: ${Math.round(timeSinceActivity/1000)}s, remaining: ${Math.round(timeRemaining/1000)}s`);
      }
    }
    
    const debugInfo = {
      tabId,
      lastActivity: lastActivity ? new Date(lastActivity).toLocaleTimeString() : 'Never',
      timeSinceActivity: lastActivity ? now - lastActivity : 0,
      timeoutMs,
      timeRemaining,
      isExcluded,
      isPinned: tab ? tab.pinned : false,
      isActive,
      url: tab ? tab.url : 'unknown',
      title: tab ? tab.title : 'unknown',
      settings: this.settings,
      memoryStats: this.getMemoryStats()
    };

    return debugInfo;
  }

  async handleDebugModeChange() {
    try {
      // Send message to all existing tabs about debug mode change
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            type: 'debugModeChanged',
            debugMode: this.settings.debugMode,
            settings: this.settings
          });
        } catch (error) {
          // Content script may not be loaded yet, ignore error
        }
      }
    } catch (error) {
      console.log('Error handling debug mode change:', error);
    }
  }

  async closeAndSaveTab(tab) {
    const now = new Date();
    const savedTab = {
      id: `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl,
      windowId: tab.windowId,
      windowTitle: `Closed at ${now.toLocaleTimeString()} on ${now.toLocaleDateString()}`,
      closedAt: now.toISOString(),
      date: now.toDateString()
    };

    const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
    savedTabs.unshift(savedTab);

    if (savedTabs.length > 1000) {
      savedTabs.splice(1000);
    }

    await chrome.storage.local.set({ savedTabs });
    await chrome.tabs.remove(tab.id);
    
    this.tabActivity.delete(tab.id);
    
    // Persist the updated activity to storage
    this.saveTabActivity().catch(err => {
      console.error('❌ Failed to save tab activity after tab removal:', err);
    });
  }
}

chrome.runtime.onStartup.addListener(() => {
  new AutoCloseManager();
});

chrome.runtime.onInstalled.addListener(() => {
  new AutoCloseManager();
});

new AutoCloseManager();