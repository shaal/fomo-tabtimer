class AutoCloseManager {
  constructor() {
    this.tabActivity = new Map();
    this.shortTimeoutInterval = null;
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

  debugLog(message, ...args) {
    if (this.settings.debugMode) {
      console.log(`🔤 [AutoCloseManager] ${message}`, ...args);
    }
  }

  async init() {
    this.startTime = Date.now();
    
    try {
      await this.loadSettings();
      await this.loadTabActivity();
      this.setupEventListeners();
      this.startPeriodicCheck();
      
      this.debugLog('Background script initialized successfully');
    } catch (error) {
      console.error('❌ Error during AutoCloseManager initialization:', error);
    }
  }

  async loadSettings() {
    this.debugLog('Loading settings...');
    const stored = await chrome.storage.sync.get(['autoCloseSettings']);
    if (stored.autoCloseSettings) {
      this.settings = { ...this.settings, ...stored.autoCloseSettings };
      this.debugLog('Settings loaded:', this.settings);
    } else {
      this.debugLog('No stored settings found, using defaults:', this.settings);
    }
    
    // Validate excluded domains
    if (!Array.isArray(this.settings.excludedDomains)) {
      this.debugLog('Fixing excludedDomains format');
      this.settings.excludedDomains = [];
    }
    
    this.debugLog(`Excluded domains: ${this.settings.excludedDomains.length > 0 ? this.settings.excludedDomains.join(', ') : 'none'}`);
  }

  async loadTabActivity() {
    this.debugLog('Loading tab activity from storage...');
    const stored = await chrome.storage.local.get(['tabActivity']);
    
    if (stored.tabActivity) {
      // Convert stored object back to Map
      this.tabActivity = new Map(Object.entries(stored.tabActivity));
      this.debugLog(`Loaded activity for ${this.tabActivity.size} tabs from storage`);
      
      // Check for tabs that should have been closed during downtime
      await this.checkForExpiredTabs();
    } else {
      this.debugLog('No stored tab activity found');
    }
  }

  async checkForExpiredTabs() {
    this.debugLog(`Checking for tabs that expired during downtime (mode: ${this.settings.timerPersistenceMode})...`);
    
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
            this.debugLog(`Closing expired tab: ${tab.title} (inactive for ${Math.round(timeSinceActivity/1000)}s)`);
            await this.closeAndSaveTab(tab);
            expiredCount++;
          }
        } else if (this.settings.timerPersistenceMode === 'continue') {
          // Continue mode: Reset timers to continue from where they left off
          if (timeSinceActivity > timeoutMs) {
            this.debugLog(`Continuing timer for tab: ${tab.title} (was inactive for ${Math.round(timeSinceActivity/1000)}s, resetting to fresh timeout)`);
            this.resetTabTimer(tab.id);
            continuedCount++;
          }
        }
      }
    }
    
    if (this.settings.timerPersistenceMode === 'absolute' && expiredCount > 0) {
      this.debugLog(`Closed ${expiredCount} tabs that expired during downtime`);
    } else if (this.settings.timerPersistenceMode === 'continue' && continuedCount > 0) {
      this.debugLog(`Continued ${continuedCount} timers from where they left off`);
    } else {
      this.debugLog('No timer adjustments needed');
    }
  }

  async saveTabActivity() {
    // Convert Map to object for storage
    const tabActivityObj = Object.fromEntries(this.tabActivity);
    await chrome.storage.local.set({ tabActivity: tabActivityObj });
  }

  setupEventListeners() {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.debugLog(`Tab activated: ${activeInfo.tabId} - resetting timer`);
      this.resetTabTimer(activeInfo.tabId);
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.debugLog(`Tab loaded: ${tab.title} - resetting timer`);
        this.resetTabTimer(tabId);
      }
      // Also reset timer when tab becomes active through updates
      if (changeInfo.active === true) {
        this.debugLog(`Tab became active via update: ${tabId} - resetting timer`);
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
          this.debugLog(`Debug mode ${this.settings.debugMode ? 'ENABLED' : 'DISABLED'}`);
          this.handleDebugModeChange();
        }
      }
    });

    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'resetTimer' && sender.tab) {
        this.debugLog(`Manual timer reset from tab ${sender.tab.id}`);
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
      } else if (message.type === 'manualCloseTest') {
        // Manual test to check if tab closing works
        this.debugLog('Manual close test triggered');
        this.testTabClosing().then(result => {
          sendResponse(result);
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
      } else if (message.type === 'test') {
        // Basic communication test
        this.debugLog('Test message received from content script');
        sendResponse({ success: true, message: 'Background script is responding' });
      } else {
        this.debugLog(`Unknown message type: ${message.type}`);
        sendResponse({ error: 'Unknown message type' });
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
    // Clear any existing alarms and intervals
    chrome.alarms.clear('autoCloseCheck');
    if (this.shortTimeoutInterval) {
      clearInterval(this.shortTimeoutInterval);
      this.shortTimeoutInterval = null;
    }
    
    // Set check frequency based on timeout setting
    const timeoutMs = this.getTimeoutInMs();
    let checkIntervalMinutes;
    
    if (timeoutMs < 60000) { // Less than 1 minute - use JavaScript interval for precision
      const intervalMs = Math.max(1000, timeoutMs / 10); // Check every 10% of timeout, min 1 second
      this.debugLog(`Using JavaScript interval: ${intervalMs}ms for ${timeoutMs}ms timeout`);
      
      this.shortTimeoutInterval = setInterval(() => {
        this.checkAndCloseTabs();
      }, intervalMs);
      
      // Also set a backup alarm
      checkIntervalMinutes = 1; // Minimum Chrome allows
    } else if (timeoutMs < 300000) { // Less than 5 minutes
      checkIntervalMinutes = 0.5; // Check every 30 seconds
    } else if (timeoutMs < 1800000) { // Less than 30 minutes
      checkIntervalMinutes = 1; // Check every minute
    } else {
      checkIntervalMinutes = 5; // Check every 5 minutes for longer timeouts
    }
    
    this.debugLog(`Setting alarm interval to ${checkIntervalMinutes} minutes for ${timeoutMs}ms timeout`);
    
    chrome.alarms.create('autoCloseCheck', { periodInMinutes: checkIntervalMinutes });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'autoCloseCheck') {
        this.checkAndCloseTabs();
      }
    });
  }

  async checkAndCloseTabs() {
    this.debugLog(`Starting tab check - enabled: ${this.settings.enabled}, debugMode: ${this.settings.debugMode}`);
    
    if (!this.settings.enabled) {
      this.debugLog('Auto-close disabled, skipping check');
      return;
    }

    const tabs = await chrome.tabs.query({});
    const now = Date.now();
    const timeoutMs = this.getTimeoutInMs();
    
    this.debugLog(`Checking ${tabs.length} tabs (timeout: ${timeoutMs}ms, ${timeoutMs/1000}s)`);
    this.debugLog(`Current settings: ${JSON.stringify(this.settings)}`);

    let closedCount = 0;
    for (const tab of tabs) {
      const lastActivity = this.tabActivity.get(tab.id);
      const timeSinceActivity = lastActivity ? now - lastActivity : 0;
      
      // Detailed logging only if debug mode is enabled
      if (this.settings.debugMode) {
        this.debugLog(`Checking tab "${tab.title}" (ID: ${tab.id})`);
        this.debugLog(`  - Active: ${tab.active}, URL: ${tab.url}`);
        this.debugLog(`  - Last activity: ${lastActivity ? new Date(lastActivity).toLocaleTimeString() : 'Never'}`);
        this.debugLog(`  - Time since activity: ${Math.round(timeSinceActivity/1000)}s`);
      }
      
      if (await this.shouldCloseTab(tab, now, timeoutMs)) {
        this.debugLog(`ATTEMPTING TO CLOSE tab: ${tab.title} (inactive for ${Math.round(timeSinceActivity/1000)}s)`);
        try {
          await this.closeAndSaveTab(tab);
          closedCount++;
          this.debugLog(`SUCCESSFULLY CLOSED tab: ${tab.title}`);
        } catch (error) {
          this.debugLog(`FAILED TO CLOSE tab: ${tab.title} - Error: ${error.message}`);
        }
      } else if (lastActivity) {
        const remaining = Math.max(0, timeoutMs - timeSinceActivity);
        if (remaining > 0 && remaining < 30000) { // Log if close to timeout
          this.debugLog(`Tab "${tab.title}" will close in ${Math.round(remaining/1000)}s`);
        }
      }
    }
    
    if (closedCount > 0) {
      this.debugLog(`Auto-close check complete: ${closedCount} tabs closed`);
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
    this.debugLog(`Checking if tab should close: "${tab.title}" (${tab.url})`);
    
    // Check if pinned
    if (tab.pinned && this.settings.excludePinned) {
      this.debugLog(`Tab is pinned, skipping: ${tab.title}`);
      return false;
    }
    
    // Check domain exclusion
    const isExcluded = this.isExcludedDomain(tab.url);
    if (isExcluded) {
      this.debugLog(`Tab domain is excluded, skipping: ${tab.title}`);
      return false;
    }
    
    // Check if active - and reset timer if it is
    if (tab.active) {
      this.debugLog(`Tab is active, resetting timer and skipping: ${tab.title}`);
      this.resetTabTimer(tab.id); // RESET TIMER FOR ACTIVE TAB
      return false;
    }

    const lastActivity = this.tabActivity.get(tab.id);
    if (!lastActivity) {
      this.debugLog(`No activity recorded for tab, initializing: ${tab.title}`);
      this.resetTabTimer(tab.id);
      return false;
    }

    const timeSinceActivity = now - lastActivity;
    const shouldClose = timeSinceActivity > timeoutMs;
    
    this.debugLog(`Tab "${tab.title}": inactive for ${Math.round(timeSinceActivity/1000)}s, timeout: ${Math.round(timeoutMs/1000)}s, should close: ${shouldClose}`);
    
    
    return shouldClose;
  }

  isExcludedDomain(url) {
    if (!url) {
      this.debugLog('No URL provided for domain check');
      return false;
    }
    
    if (!this.settings.excludedDomains || !Array.isArray(this.settings.excludedDomains)) {
      this.debugLog('No excluded domains configured or invalid format');
      return false;
    }
    
    if (this.settings.excludedDomains.length === 0) {
      this.debugLog('No excluded domains set');
      return false;
    }
    
    try {
      const domain = new URL(url).hostname;
      this.debugLog(`Checking domain "${domain}" against ${this.settings.excludedDomains.length} exclusion patterns: [${this.settings.excludedDomains.join(', ')}]`);
      
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
          this.debugLog(`Wildcard check: "${domain}" vs "${pattern}" (regex: ${regexPattern}) = ${matches}`);
          return matches;
        }
        
        // Exact match or subdomain match
        const exactMatch = domain === pattern;
        const subdomainMatch = domain.endsWith('.' + pattern);
        const matches = exactMatch || subdomainMatch;
        this.debugLog(`Domain check: "${domain}" vs "${pattern}" = ${matches}`);
        return matches;
      });
      
      if (isExcluded) {
        this.debugLog(`Domain "${domain}" is excluded from auto-close`);
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
      this.debugLog(`Tab ${tabId} is ACTIVE - showing full timeout: ${Math.round(timeRemaining/1000)}s`);
    } else {
      // Tab is inactive - show countdown
      const timeSinceActivity = lastActivity ? now - lastActivity : 0;
      timeRemaining = lastActivity ? Math.max(0, timeoutMs - timeSinceActivity) : timeoutMs;
      this.debugLog(`Tab ${tabId} is INACTIVE - time since activity: ${Math.round(timeSinceActivity/1000)}s, remaining: ${Math.round(timeRemaining/1000)}s`);
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

  async testTabClosing() {
    this.debugLog('Testing tab closing functionality...');
    
    try {
      const tabs = await chrome.tabs.query({});
      this.debugLog(`Found ${tabs.length} tabs total`);
      
      // Find a tab that we can safely close (not the current active tab)
      const inactiveTabs = tabs.filter(tab => !tab.active && !tab.url.includes('chrome://') && !tab.url.includes('chrome-extension://'));
      
      if (inactiveTabs.length === 0) {
        return { success: false, error: 'No inactive tabs found to test with' };
      }
      
      const testTab = inactiveTabs[0];
      this.debugLog(`Testing with tab: ${testTab.title} (ID: ${testTab.id})`);
      
      // Try to close it
      await chrome.tabs.remove(testTab.id);
      this.debugLog(`Tab removal command sent for ${testTab.id}`);
      
      // Wait and check if it's gone
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const remainingTabs = await chrome.tabs.query({});
      const stillExists = remainingTabs.find(t => t.id === testTab.id);
      
      return {
        success: !stillExists,
        testTabId: testTab.id,
        testTabTitle: testTab.title,
        stillExists: !!stillExists,
        beforeCount: tabs.length,
        afterCount: remainingTabs.length
      };
    } catch (error) {
      this.debugLog(`Error in testTabClosing: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async closeAndSaveTab(tab) {
    try {
      this.debugLog(`Starting to close and save tab: ${tab.title} (ID: ${tab.id})`);
      
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

      this.debugLog(`Saving tab data to storage: ${savedTab.title}`);
      const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
      savedTabs.unshift(savedTab);

      if (savedTabs.length > 1000) {
        savedTabs.splice(1000);
      }

      await chrome.storage.local.set({ savedTabs });
      this.debugLog(`Tab data saved successfully. Now removing tab ${tab.id}`);
      
      await chrome.tabs.remove(tab.id);
      this.debugLog(`Tab ${tab.id} removed successfully`);
      
      this.tabActivity.delete(tab.id);
      
      // Persist the updated activity to storage
      this.saveTabActivity().catch(err => {
        console.error('❌ Failed to save tab activity after tab removal:', err);
      });
    } catch (error) {
      this.debugLog(`Error closing tab ${tab.id}: ${error.message}`);
      console.error('❌ Error in closeAndSaveTab:', error);
    }
  }
}

// Singleton instance
let autoCloseManagerInstance = null;

function getAutoCloseManager() {
  if (!autoCloseManagerInstance) {
    autoCloseManagerInstance = new AutoCloseManager();
  }
  return autoCloseManagerInstance;
}

chrome.runtime.onStartup.addListener(() => {
  getAutoCloseManager();
});

chrome.runtime.onInstalled.addListener(() => {
  getAutoCloseManager();
});

// Initialize immediately
getAutoCloseManager();