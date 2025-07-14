class TitleCountdown {
  constructor() {
    this.originalTitle = document.title;
    this.debugMode = false;
    this.timeoutMs = 30 * 60 * 1000; // Default 30 minutes
    this.lastActivity = Date.now();
    this.isActive = true;
    this.titleUpdateInterval = null;
    this.isLocked = false;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupMessageListener();
    this.trackActivity();
    
    if (this.debugMode) {
      this.startTitleUpdateLoop();
    }
  }

  async loadSettings() {
    try {
      const { autoCloseSettings } = await new Promise((resolve) => {
        chrome.storage.sync.get(['autoCloseSettings'], resolve);
      });
      
      if (autoCloseSettings) {
        this.debugMode = autoCloseSettings.debugMode || false;
        this.timeoutMs = this.calculateTimeoutMs(autoCloseSettings);
      }
    } catch (error) {
      console.log('Could not load settings for title countdown', error);
    }
  }

  calculateTimeoutMs(settings) {
    const { timeValue = 30, timeUnit = 'minutes' } = settings;
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };
    return timeValue * multipliers[timeUnit];
  }

  setupMessageListener() {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'sync' && changes.autoCloseSettings) {
        const newSettings = changes.autoCloseSettings.newValue;
        const wasDebugMode = this.debugMode;
        this.debugMode = newSettings.debugMode || false;
        this.timeoutMs = this.calculateTimeoutMs(newSettings);
        
        if (this.debugMode && !wasDebugMode) {
          this.startTitleUpdateLoop();
        } else if (!this.debugMode && wasDebugMode) {
          this.stopTitleUpdateLoop();
          document.title = this.originalTitle;
        }
      }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'activityReset') {
        this.lastActivity = Date.now();
        this.updateTabTitle();
      } else if (message.type === 'debugModeChanged') {
        const wasDebugMode = this.debugMode;
        this.debugMode = message.debugMode;
        this.timeoutMs = this.calculateTimeoutMs(message.settings);
        
        if (this.debugMode && !wasDebugMode) {
          this.startTitleUpdateLoop();
        } else if (!this.debugMode && wasDebugMode) {
          this.stopTitleUpdateLoop();
          document.title = this.originalTitle;
        }
      } else if (message.type === 'updateTitleLockStatus') {
        this.isLocked = message.isLocked;
        this.updateTabTitle();
      } else if (message.type === 'closeFailedResetTitle') {
        // Reset title when tab close fails
        this.originalTitle = this.cleanTitle(message.originalTitle || document.title);
        document.title = this.originalTitle;
        // Reset activity to prevent immediate re-attempt
        this.lastActivity = Date.now();
      }
    });
  }

  trackActivity() {
    this.isActive = !document.hidden;
    
    const resetActivity = () => {
      this.lastActivity = Date.now();
      this.updateTabTitle();
    };

    ['click', 'keydown', 'mousemove', 'scroll', 'focus'].forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    document.addEventListener('visibilitychange', () => {
      this.isActive = !document.hidden;
      if (this.isActive) {
        this.lastActivity = Date.now();
        chrome.runtime.sendMessage({ type: 'resetTimer' }).catch(() => {});
      }
      this.updateTabTitle();
    });

    window.addEventListener('focus', () => {
      this.isActive = true;
      this.lastActivity = Date.now();
      chrome.runtime.sendMessage({ type: 'resetTimer' }).catch(() => {});
      this.updateTabTitle();
    });
  }

  startTitleUpdateLoop() {
    if (this.titleUpdateInterval) return;
    
    this.titleUpdateInterval = setInterval(() => {
      this.updateTabTitle();
    }, 1000);
  }

  stopTitleUpdateLoop() {
    if (this.titleUpdateInterval) {
      clearInterval(this.titleUpdateInterval);
      this.titleUpdateInterval = null;
    }
  }

  async updateTabTitle() {
    // Get debug info from background script first (needed for lock status)
    let debugInfo = null;
    try {
      debugInfo = await chrome.runtime.sendMessage({ type: 'getDebugInfo' });
    } catch (error) {
      // Background script communication failed, use local fallback
    }

    // Check lock status from both local state and debug info
    const isLocked = this.isLocked || (debugInfo && debugInfo.isLocked);
    
    // Always show lock status when tab is locked
    if (isLocked) {
      const lockPrefix = '🔒 ';
      if (!document.title.startsWith(lockPrefix)) {
        // Only update if not already showing lock status
        const cleanTitle = document.title.replace(/^🔒 /, '');
        document.title = `${lockPrefix}${cleanTitle}`;
      }
      return;
    } else {
      // Remove lock prefix if present and tab is not locked
      if (document.title.startsWith('🔒 ')) {
        document.title = document.title.replace(/^🔒 /, '');
      }
    }

    if (!this.debugMode) {
      if (document.title !== this.originalTitle) {
        document.title = this.originalTitle;
      }
      return;
    }

    // Check if tab is excluded
    if (debugInfo && debugInfo.isExcluded) {
      document.title = `[EXCLUDED] ${this.originalTitle}`;
      return;
    }

    // Determine if tab is active
    const isActive = debugInfo ? debugInfo.isActive : this.isActive;
    
    if (isActive) {
      document.title = this.originalTitle;
    } else {
      // Tab is inactive - show countdown
      let timeRemaining = 0;
      
      if (debugInfo && typeof debugInfo.timeRemaining === 'number') {
        timeRemaining = debugInfo.timeRemaining;
      } else {
        // Fallback to local calculation
        const now = Date.now();
        const timeSinceActivity = now - this.lastActivity;
        timeRemaining = Math.max(0, this.timeoutMs - timeSinceActivity);
      }
      
      if (timeRemaining > 0) {
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Add urgency indicators
        if (timeRemaining < 30000) { // Less than 30 seconds
          document.title = `🔥 ${timeStr} - ${this.originalTitle}`;
        } else if (timeRemaining < 60000) { // Less than 1 minute
          document.title = `⚠️ ${timeStr} - ${this.originalTitle}`;
        } else {
          document.title = `⏰ ${timeStr} - ${this.originalTitle}`;
        }
      } else {
        // Only show CLOSING if background script confirms tab should close
        // This prevents showing CLOSING when the tab won't actually close
        if (debugInfo && debugInfo.shouldClose) {
          document.title = `🔥 CLOSING - ${this.originalTitle}`;
        } else {
          // If we can't confirm it should close, show expired state instead
          document.title = `⏰ EXPIRED - ${this.originalTitle}`;
        }
      }
    }
  }

  cleanTitle(title) {
    // Remove timer prefixes from title
    return title.replace(/^(🔒 |🔥 |⚠️ |⏰ |🔥 CLOSING - |⏰ EXPIRED - |\[[A-Z]+\] )/, '');
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TitleCountdown();
  });
} else {
  new TitleCountdown();
}