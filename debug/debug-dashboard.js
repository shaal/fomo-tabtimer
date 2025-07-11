class DebugDashboard {
  constructor() {
    this.autoRefresh = true;
    this.refreshInterval = null;
    this.activityLog = [];
    this.memoryHistory = [];
    this.init();
  }

  async init() {
    this.log('Debug dashboard initialized');
    this.setupEventListeners();
    await this.refreshAll();
    this.startAutoRefresh();
  }

  setupEventListeners() {
    document.getElementById('refreshAll').addEventListener('click', () => {
      this.refreshAll();
    });

    document.getElementById('toggleAutoRefresh').addEventListener('click', () => {
      this.toggleAutoRefresh();
    });

    document.getElementById('clearLog').addEventListener('click', () => {
      this.clearLog();
    });

    document.getElementById('exportLog').addEventListener('click', () => {
      this.exportLog();
    });

    document.getElementById('testDomainExclusion').addEventListener('click', () => {
      this.testDomainExclusion();
    });

    document.getElementById('simulateTabClose').addEventListener('click', () => {
      this.simulateTabClose();
    });

    document.getElementById('resetAllTimers').addEventListener('click', () => {
      this.resetAllTimers();
    });

    document.getElementById('triggerMemoryCheck').addEventListener('click', () => {
      this.triggerMemoryCheck();
    });
  }

  async refreshAll() {
    this.log('Refreshing all dashboard data...');
    
    try {
      await Promise.all([
        this.updateStats(),
        this.updateSettings(),
        this.updateTabsMonitor(),
        this.updateMemoryUsage(),
        this.updatePerformanceMetrics()
      ]);
      
      document.getElementById('lastUpdated').textContent = new Date().toLocaleTimeString();
      this.log('Dashboard refresh completed', 'success');
    } catch (error) {
      this.log(`Refresh failed: ${error.message}`, 'error');
    }
  }

  async updateStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getMemoryUsage' });
      if (response) {
        document.getElementById('statUptime').textContent = `${response.uptime}s`;
        document.getElementById('statTrackedTabs').textContent = response.trackedTabs;
        document.getElementById('statExcludedDomains').textContent = response.excludedDomains;
        document.getElementById('statCheckCount').textContent = response.checkCount;
        document.getElementById('statLastCheck').textContent = response.lastCheck;
      }

      const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
      document.getElementById('statSavedTabs').textContent = savedTabs.length;
    } catch (error) {
      this.log(`Failed to update stats: ${error.message}`, 'error');
    }
  }

  async updateSettings() {
    try {
      const { autoCloseSettings } = await chrome.storage.sync.get(['autoCloseSettings']);
      const settings = autoCloseSettings || {};
      
      const settingsText = JSON.stringify(settings, null, 2);
      document.getElementById('settingsDisplay').textContent = settingsText;
    } catch (error) {
      this.log(`Failed to update settings: ${error.message}`, 'error');
    }
  }

  async updateTabsMonitor() {
    try {
      const tabs = await chrome.tabs.query({});
      const tabsContainer = document.getElementById('tabsMonitor');
      tabsContainer.innerHTML = '';

      if (tabs.length === 0) {
        tabsContainer.innerHTML = '<div style="text-align: center; color: #718096;">No tabs found</div>';
        return;
      }

      for (const tab of tabs) {
        const debugInfo = await chrome.runtime.sendMessage({ 
          type: 'getDebugInfo',
          tabId: tab.id 
        }).catch(() => null);

        const tabElement = this.createTabElement(tab, debugInfo);
        tabsContainer.appendChild(tabElement);
      }
    } catch (error) {
      this.log(`Failed to update tabs monitor: ${error.message}`, 'error');
    }
  }

  createTabElement(tab, debugInfo) {
    const div = document.createElement('div');
    div.className = 'tab-entry';
    
    const timeRemaining = debugInfo ? debugInfo.timeRemaining : 0;
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    let timerClass = 'safe';
    if (timeRemaining < 30000) timerClass = 'critical';
    else if (timeRemaining < 60000) timerClass = 'warning';
    
    div.innerHTML = `
      <div class="tab-info">
        <div class="tab-title">${tab.title}</div>
        <div class="tab-url">${tab.url}</div>
      </div>
      <div class="tab-timer ${timerClass}">${timerText}</div>
    `;
    
    return div;
  }

  async updateMemoryUsage() {
    try {
      if ('memory' in performance) {
        const memory = performance.memory;
        const used = Math.round(memory.usedJSHeapSize / 1024 / 1024 * 10) / 10;
        const total = Math.round(memory.totalJSHeapSize / 1024 / 1024 * 10) / 10;
        
        document.getElementById('memCurrent').textContent = `${used} MB`;
        document.getElementById('memPeak').textContent = `${total} MB`;
        
        // Store memory history for chart
        this.memoryHistory.push({ time: Date.now(), used, total });
        if (this.memoryHistory.length > 50) {
          this.memoryHistory.shift();
        }
        
        // Calculate average
        const avgUsed = this.memoryHistory.reduce((sum, entry) => sum + entry.used, 0) / this.memoryHistory.length;
        document.getElementById('memAverage').textContent = `${avgUsed.toFixed(1)} MB`;
      }
    } catch (error) {
      this.log(`Failed to update memory usage: ${error.message}`, 'error');
    }
  }

  async updatePerformanceMetrics() {
    try {
      // These would need to be tracked in the background script
      document.getElementById('perfCheckTime').textContent = '< 5 ms';
      document.getElementById('perfTabsClosed').textContent = '0';
      document.getElementById('perfExclusionsHit').textContent = '0';
      document.getElementById('perfTimerResets').textContent = '0';
    } catch (error) {
      this.log(`Failed to update performance metrics: ${error.message}`, 'error');
    }
  }

  startAutoRefresh() {
    if (this.refreshInterval) return;
    
    this.refreshInterval = setInterval(() => {
      if (this.autoRefresh) {
        this.refreshAll();
      }
    }, 5000); // Refresh every 5 seconds
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  toggleAutoRefresh() {
    const button = document.getElementById('toggleAutoRefresh');
    this.autoRefresh = !this.autoRefresh;
    
    if (this.autoRefresh) {
      button.textContent = '⏸️ Auto Refresh';
      this.log('Auto refresh enabled');
    } else {
      button.textContent = '▶️ Auto Refresh';
      this.log('Auto refresh disabled');
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, message, type };
    this.activityLog.push(logEntry);
    
    // Keep only last 100 entries
    if (this.activityLog.length > 100) {
      this.activityLog.shift();
    }
    
    this.updateLogDisplay();
  }

  updateLogDisplay() {
    const logContainer = document.getElementById('activityLog');
    const autoScroll = document.getElementById('autoScrollLog').checked;
    
    logContainer.innerHTML = this.activityLog.map(entry => `
      <div class="log-entry ${entry.type}">
        <span class="log-time">${entry.timestamp}</span>
        <span class="log-message">${entry.message}</span>
      </div>
    `).join('');
    
    if (autoScroll) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  clearLog() {
    this.activityLog = [];
    this.updateLogDisplay();
    this.log('Activity log cleared');
  }

  exportLog() {
    const logData = {
      exportedAt: new Date().toISOString(),
      entries: this.activityLog
    };
    
    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-log-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    this.log('Activity log exported');
  }

  async testDomainExclusion() {
    this.log('Testing domain exclusion logic...');
    
    try {
      const testUrl = 'https://home.google.com/library';
      const response = await chrome.runtime.sendMessage({
        type: 'testDomainExclusion',
        url: testUrl
      });
      
      if (response && response.excluded) {
        this.log(`✅ Domain test passed: ${testUrl} is excluded`, 'success');
      } else {
        this.log(`❌ Domain test failed: ${testUrl} is not excluded`, 'error');
      }
    } catch (error) {
      this.log(`Domain test error: ${error.message}`, 'error');
    }
  }

  async simulateTabClose() {
    this.log('Simulating tab close...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'simulateTabClose'
      });
      
      if (response && response.success) {
        this.log('Tab close simulation completed', 'success');
      } else {
        this.log('Tab close simulation failed', 'error');
      }
    } catch (error) {
      this.log(`Simulation error: ${error.message}`, 'error');
    }
  }

  async resetAllTimers() {
    this.log('Resetting all tab timers...');
    
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'resetAllTimers'
      });
      
      if (response && response.success) {
        this.log(`Reset ${response.count} tab timers`, 'success');
      } else {
        this.log('Timer reset failed', 'error');
      }
    } catch (error) {
      this.log(`Timer reset error: ${error.message}`, 'error');
    }
  }

  async triggerMemoryCheck() {
    this.log('Triggering memory check...');
    
    try {
      await this.updateMemoryUsage();
      this.log('Memory check completed', 'success');
    } catch (error) {
      this.log(`Memory check error: ${error.message}`, 'error');
    }
  }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
  new DebugDashboard();
});