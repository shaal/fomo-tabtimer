class DebugOverlay {
  constructor() {
    this.overlay = null;
    this.updateInterval = null;
    this.debugMode = false;
    this.timeoutMs = 30 * 60 * 1000; // Default 30 minutes
    this.lastActivity = Date.now();
    this.isActive = true;
    this.originalTitle = document.title;
    this.isInvalidated = false;
    this.init();
  }

  debugLog(message, ...args) {
    if (this.debugMode) {
      console.log(`🔤 [DebugOverlay] ${message}`, ...args);
    }
  }

  async init() {
    await this.loadSettings();
    this.setupMessageListener();
    this.trackActivity();
    
    if (this.debugMode) {
      this.createOverlay();
      this.startUpdateLoop();
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
        this.debugLog(`Settings loaded - timeout: ${this.timeoutMs/1000}s, debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        this.debugLog(`Raw settings:`, autoCloseSettings);
      } else {
        this.debugLog('No settings found, using defaults - timeout: 30 minutes, debug mode disabled');
        // Use default settings if none found
        this.timeoutMs = 30 * 60 * 1000; // 30 minutes default
      }
    } catch (error) {
      this.debugLog('Could not load settings', error);
      this.timeoutMs = 30 * 60 * 1000; // 30 minutes default on error
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
        
        this.debugLog(`Settings changed, debug mode ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        
        if (this.debugMode && !wasDebugMode) {
          this.createOverlay();
          this.startUpdateLoop();
          this.startTitleUpdateLoop();
        } else if (!this.debugMode && wasDebugMode) {
          this.removeOverlay();
          this.stopUpdateLoop();
          this.stopTitleUpdateLoop();
          // Restore original title when debug mode is disabled
          document.title = this.originalTitle;
        }
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'activityReset') {
        console.log(`📱 Content script: Received activity reset - resetting local timer`);
        this.lastActivity = Date.now();
        this.updateOverlay();
      } else if (message.type === 'debugModeChanged') {
        const wasDebugMode = this.debugMode;
        this.debugMode = message.debugMode;
        this.timeoutMs = this.calculateTimeoutMs(message.settings);
        
        console.log(`🐛 Debug overlay: Debug mode changed to ${this.debugMode ? 'ENABLED' : 'DISABLED'}`);
        
        if (this.debugMode && !wasDebugMode) {
          this.createOverlay();
          this.startUpdateLoop();
          this.startTitleUpdateLoop();
        } else if (!this.debugMode && wasDebugMode) {
          this.removeOverlay();
          this.stopUpdateLoop();
          this.stopTitleUpdateLoop();
          // Restore original title when debug mode is disabled
          document.title = this.originalTitle;
        }
      }
    });
  }

  trackActivity() {
    // Initialize isActive state based on current document visibility
    this.isActive = !document.hidden;
    
    // Track user activity to reset timer
    const resetActivity = () => {
      this.lastActivity = Date.now();
      this.updateOverlay();
    };

    // Track various user interactions
    ['click', 'keydown', 'mousemove', 'scroll', 'focus'].forEach(event => {
      document.addEventListener(event, resetActivity, { passive: true });
    });

    // Track visibility changes
    document.addEventListener('visibilitychange', () => {
      this.isActive = !document.hidden;
      console.log(`🔄 Debug overlay: Tab visibility changed - isActive: ${this.isActive}`);
      if (this.isActive) {
        this.lastActivity = Date.now();
        console.log(`⏰ Debug overlay: Tab became active - resetting local timer to full timeout (${this.timeoutMs/1000}s)`);
        // Also notify background script about the activity
        chrome.runtime.sendMessage({ type: 'resetTimer' }).catch(() => {
          // Ignore errors - background script might not be ready
        });
      }
      this.updateOverlay();
    });

    // Also track focus events
    window.addEventListener('focus', () => {
      this.isActive = true;
      this.lastActivity = Date.now();
      console.log(`⏰ Debug overlay: Window focused - resetting local timer to full timeout (${this.timeoutMs/1000}s)`);
      // Also notify background script about the activity
      chrome.runtime.sendMessage({ type: 'resetTimer' }).catch((error) => {
        if (error.message.includes('Extension context invalidated')) {
          console.log('🔄 Extension context invalidated - stopping debug overlay');
          this.handleExtensionInvalidation();
        } else {
          console.log('Background script not ready, ignoring error:', error.message);
        }
      });
      this.updateOverlay();
    });

    window.addEventListener('blur', () => {
      console.log(`⏸️ Debug overlay: Window blurred - tab becoming inactive`);
      // Don't set isActive = false here, rely on visibility change
      this.updateOverlay();
    });
  }

  createOverlay() {
    if (this.overlay) return;

    this.overlay = document.createElement('div');
    this.overlay.id = 'auto-close-debug-overlay';
    this.overlay.innerHTML = `
      <div class="debug-panel">
        <div class="debug-header">🐛 FOMO TabTimer Debug</div>
        <div class="debug-content">
          <div class="timer-display">
            <span class="timer-label">Time until close:</span>
            <span class="timer-value" id="debug-timer">--:--</span>
          </div>
          <div class="status-display">
            <span class="status-label">Status:</span>
            <span class="status-value" id="debug-status">Active</span>
          </div>
          <div class="memory-display">
            <span class="memory-label">Memory:</span>
            <span class="memory-value" id="debug-memory">--</span>
          </div>
          <div class="debug-actions">
            <button id="debug-reset-timer" class="debug-btn">Reset Timer</button>
            <button id="debug-close" class="debug-btn close-btn">×</button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      #auto-close-debug-overlay {
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 999999;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 12px;
        pointer-events: auto;
      }
      
      .debug-panel {
        background: rgba(0, 0, 0, 0.9);
        color: white;
        border-radius: 8px;
        padding: 8px;
        min-width: 200px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      
      .debug-header {
        font-weight: bold;
        margin-bottom: 8px;
        color: #4CAF50;
        text-align: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        padding-bottom: 4px;
      }
      
      .debug-content > div {
        margin: 4px 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .timer-value {
        font-weight: bold;
        color: #FF5722;
        font-family: monospace;
        font-size: 14px;
      }
      
      .timer-value.warning {
        color: #FF9800;
        animation: pulse 1s infinite;
      }
      
      .timer-value.critical {
        color: #F44336;
        animation: pulse 0.5s infinite;
      }
      
      .timer-value.active {
        color: #4CAF50;
        font-weight: bold;
        animation: none;
      }
      
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      .status-value.active {
        color: #4CAF50;
      }
      
      .status-value.inactive {
        color: #FF5722;
      }
      
      .status-value.excluded {
        color: #2196F3;
      }
      
      .memory-value {
        color: #9C27B0;
        font-family: monospace;
      }
      
      .debug-actions {
        margin-top: 8px;
        gap: 4px;
      }
      
      .debug-btn {
        background: #2196F3;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px;
        transition: background 0.2s;
      }
      
      .debug-btn:hover {
        background: #1976D2;
      }
      
      .debug-btn.close-btn {
        background: #f44336;
        padding: 2px 6px;
        margin-left: auto;
      }
      
      .debug-btn.close-btn:hover {
        background: #d32f2f;
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(this.overlay);

    // Add event listeners
    document.getElementById('debug-reset-timer').addEventListener('click', () => {
      this.lastActivity = Date.now();
      this.updateOverlay();
      
      // Notify background script
      chrome.runtime.sendMessage({ type: 'resetTimer' });
    });

    document.getElementById('debug-close').addEventListener('click', () => {
      this.removeOverlay();
    });

    // Make panel draggable
    this.makeDraggable();
  }

  makeDraggable() {
    const panel = this.overlay.querySelector('.debug-panel');
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    panel.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('debug-btn')) return;
      
      initialX = e.clientX - xOffset;
      initialY = e.clientY - yOffset;
      isDragging = true;
      panel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        e.preventDefault();
        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;
        xOffset = currentX;
        yOffset = currentY;
        
        this.overlay.style.transform = `translate(${currentX}px, ${currentY}px)`;
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      panel.style.cursor = 'grab';
    });

    panel.style.cursor = 'grab';
  }

  startUpdateLoop() {
    if (this.updateInterval) return;
    
    this.updateInterval = setInterval(() => {
      this.updateOverlay();
      this.updateMemoryUsage();
    }, 1000);
  }

  startTitleUpdateLoop() {
    if (this.titleUpdateInterval) return;
    
    // Update tab title every second when debug mode is enabled
    this.titleUpdateInterval = setInterval(() => {
      this.updateOverlay(); // This will call updateTabTitle
    }, 1000);
  }

  stopTitleUpdateLoop() {
    if (this.titleUpdateInterval) {
      clearInterval(this.titleUpdateInterval);
      this.titleUpdateInterval = null;
    }
  }

  stopUpdateLoop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  handleExtensionInvalidation() {
    console.log('🛑 Extension context invalidated - cleaning up debug overlay');
    
    // Stop all intervals and timers
    this.stopUpdateLoop();
    this.stopTitleUpdateLoop();
    
    // Remove the overlay
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    
    // Reset title to original
    if (this.originalTitle) {
      document.title = this.originalTitle;
    }
    
    // Mark as invalidated to prevent further operations
    this.isInvalidated = true;
  }

  async updateOverlay() {
    // Check if extension context is invalidated
    if (this.isInvalidated) {
      return;
    }
    
    // Get real-time debug info from background script
    let debugInfo = null;
    try {
      debugInfo = await chrome.runtime.sendMessage({ type: 'getDebugInfo' });
      this.debugLog('Successfully received debug info from background');
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        console.log('🔄 Extension context invalidated - stopping debug overlay');
        this.handleExtensionInvalidation();
        return;
      }
      
      this.debugLog(`Failed to get debug info from background: ${error.message}`);
      console.error('Debug overlay communication error:', error);
      
      // Try to test basic communication
      try {
        const testResponse = await chrome.runtime.sendMessage({ type: 'test' });
        this.debugLog('Basic message test response:', testResponse);
      } catch (testError) {
        if (testError.message.includes('Extension context invalidated')) {
          console.log('🔄 Extension context invalidated during test - stopping debug overlay');
          this.handleExtensionInvalidation();
          return;
        }
        this.debugLog(`Basic communication test failed: ${testError.message}`);
      }
    }

    // Update tab title with countdown (always, regardless of overlay visibility)
    this.updateTabTitle(debugInfo);

    // Update overlay if it exists
    if (this.overlay) {
      const timerElement = document.getElementById('debug-timer');
      const statusElement = document.getElementById('debug-status');
      
      if (timerElement && debugInfo) {
        // Determine if tab is active - prioritize background script info
        const isActive = debugInfo ? debugInfo.isActive : this.isActive;
        
        // Only show countdown if tab is INACTIVE
        if (isActive) {
          // Tab is active - show "ACTIVE" instead of countdown
          timerElement.textContent = 'ACTIVE';
          timerElement.className = 'timer-value active';
        } else {
          // Tab is inactive - show countdown
          const timeRemaining = debugInfo.timeRemaining || 0;
          
          if (timeRemaining > 0) {
            const minutes = Math.floor(timeRemaining / 60000);
            const seconds = Math.floor((timeRemaining % 60000) / 1000);
            timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Add visual warnings
            timerElement.className = 'timer-value';
            if (timeRemaining < 30000) { // Less than 30 seconds
              timerElement.className += ' critical';
            } else if (timeRemaining < 60000) { // Less than 1 minute
              timerElement.className += ' warning';
            }
          } else {
            timerElement.textContent = '0:00';
            timerElement.className = 'timer-value critical';
          }
        }
      } else if (timerElement) {
        // Fallback to local calculation
        if (this.isActive) {
          // Tab is active - show "ACTIVE" instead of countdown
          timerElement.textContent = 'ACTIVE';
          timerElement.className = 'timer-value active';
        } else {
          // Tab is inactive - show countdown  
          const now = Date.now();
          const timeSinceActivity = now - this.lastActivity;
          const timeRemaining = Math.max(0, this.timeoutMs - timeSinceActivity);
          
          const minutes = Math.floor(timeRemaining / 60000);
          const seconds = Math.floor((timeRemaining % 60000) / 1000);
          timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          timerElement.className = 'timer-value';
        }
      }
      
      if (statusElement) {
        // Use the same active state determination
        const isActive = debugInfo ? debugInfo.isActive : this.isActive;
        
        if (debugInfo && debugInfo.isExcluded) {
          statusElement.textContent = 'Excluded';
          statusElement.className = 'status-value excluded';
        } else if (!isActive) {
          statusElement.textContent = 'Inactive';
          statusElement.className = 'status-value inactive';
        } else {
          statusElement.textContent = 'Active';
          statusElement.className = 'status-value active';
        }
      }
    }
  }

  updateTabTitle(debugInfo) {
    if (!this.debugMode) {
      // If debug mode is off, restore original title
      if (document.title !== this.originalTitle) {
        document.title = this.originalTitle;
      }
      return;
    }

    // Check if tab is excluded first
    if (debugInfo && debugInfo.isExcluded) {
      document.title = `[EXCLUDED] ${this.originalTitle}`;
      return;
    }

    // Determine if tab is active - prioritize background script info
    const isActive = debugInfo ? debugInfo.isActive : this.isActive;
    
    // Debug logging for title updates
    this.debugLog(`Title update - isActive: ${isActive}, debugInfo active: ${debugInfo ? debugInfo.isActive : 'none'}, local active: ${this.isActive}`);
    
    // Only show countdown if tab is INACTIVE
    if (isActive) {
      // Tab is active - show original title
      document.title = this.originalTitle;
    } else {
      // Tab is inactive - show countdown in title
      let timeRemaining = 0;
      
      if (debugInfo && typeof debugInfo.timeRemaining === 'number') {
        timeRemaining = debugInfo.timeRemaining;
      } else {
        // Fallback to local calculation - but only if tab is INACTIVE
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
        document.title = `🔥 CLOSING - ${this.originalTitle}`;
      }
    }
  }

  async updateMemoryUsage() {
    try {
      if ('memory' in performance) {
        const memory = performance.memory;
        const used = Math.round(memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
        const total = Math.round(memory.totalJSHeapSize / 1024 / 1024 * 10) / 10;
        
        const memoryElement = document.getElementById('debug-memory');
        if (memoryElement) {
          memoryElement.textContent = `${used}/${total} MB`;
        }
      }
    } catch (error) {
      // Memory API not available
    }
  }

  isExcludedDomain() {
    // This is a simplified check - in reality this would need to communicate with background script
    return false;
  }

  removeOverlay() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.stopUpdateLoop();
    this.stopTitleUpdateLoop();
  }
}

// Initialize debug overlay when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new DebugOverlay();
  });
} else {
  new DebugOverlay();
}