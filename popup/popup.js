class PopupManager {
  constructor() {
    this.settings = {
      enabled: true,
      timeValue: 30,
      timeUnit: 'minutes',
      excludedDomains: [],
      excludePinned: true,
      timerPersistenceMode: 'continue',
      debugMode: false
    };
    this.init();
  }

  debugLog(message, ...args) {
    if (this.settings.debugMode) {
      console.log(`🔤 [PopupManager] ${message}`, ...args);
    }
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    this.updateUI();
    this.updateTabsCount();
  }

  async loadSettings() {
    const stored = await chrome.storage.sync.get(['autoCloseSettings']);
    if (stored.autoCloseSettings) {
      this.settings = { ...this.settings, ...stored.autoCloseSettings };
    }
  }

  setupEventListeners() {
    document.getElementById('enableToggle').addEventListener('change', (e) => {
      this.settings.enabled = e.target.checked;
      this.updateStatusIndicator();
      this.updateSettingsVisibility();
      this.saveSettings();
    });

    document.getElementById('advancedToggle').addEventListener('click', () => {
      this.toggleAdvancedSettings();
    });

    document.getElementById('timeValue').addEventListener('input', (e) => {
      this.settings.timeValue = parseInt(e.target.value) || 1;
      this.saveSettings();
    });

    document.getElementById('timeUnit').addEventListener('change', (e) => {
      this.settings.timeUnit = e.target.value;
      this.saveSettings();
    });


    document.getElementById('debugToggle').addEventListener('change', (e) => {
      this.settings.debugMode = e.target.checked;
      this.updateDebugVisibility();
      this.saveSettings();
    });

    document.getElementById('addDomain').addEventListener('click', () => {
      this.addDomain();
    });

    document.getElementById('domainInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addDomain();
      }
    });


    document.getElementById('viewTabsBtn').addEventListener('click', () => {
      this.openTabsPage();
    });

    document.getElementById('refreshDebugInfo').addEventListener('click', () => {
      this.updateDebugInfo();
    });

    document.getElementById('openDebugConsole').addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/' });
    });

    document.getElementById('openDebugDashboard').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('debug/debug-dashboard.html') });
    });
  }

  updateUI() {
    document.getElementById('enableToggle').checked = this.settings.enabled;
    document.getElementById('timeValue').value = this.settings.timeValue;
    document.getElementById('timeUnit').value = this.settings.timeUnit;
    
    
    document.getElementById('debugToggle').checked = this.settings.debugMode || false;
    this.updateStatusIndicator();
    this.updateSettingsVisibility();
    this.updateDebugVisibility();
    this.renderDomainList();
  }

  updateSettingsVisibility() {
    const mainControls = document.querySelector('.main-controls');
    const timerSetting = document.querySelector('.timer-setting');
    const opacity = this.settings.enabled ? '1' : '0.5';
    const pointerEvents = this.settings.enabled ? 'auto' : 'none';
    
    if (timerSetting) {
      timerSetting.style.opacity = opacity;
      timerSetting.style.pointerEvents = pointerEvents;
    }
  }

  renderDomainList() {
    const domainList = document.getElementById('domainList');
    domainList.innerHTML = '';

    this.settings.excludedDomains.forEach((domain, index) => {
      const domainItem = document.createElement('div');
      domainItem.className = 'domain-item';
      domainItem.innerHTML = `
        <span>${domain}</span>
        <button onclick="popupManager.removeDomain(${index})">Remove</button>
      `;
      domainList.appendChild(domainItem);
    });
  }

  addDomain() {
    const input = document.getElementById('domainInput');
    const domain = input.value.trim();
    
    if (domain && !this.settings.excludedDomains.includes(domain)) {
      this.settings.excludedDomains.push(domain);
      input.value = '';
      this.renderDomainList();
      this.saveSettings();
    }
  }

  removeDomain(index) {
    this.settings.excludedDomains.splice(index, 1);
    this.renderDomainList();
    this.saveSettings();
  }

  async saveSettings() {
    await chrome.storage.sync.set({ autoCloseSettings: this.settings });
  }

  async updateTabsCount() {
    const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
    const count = savedTabs.length;
    document.getElementById('tabsCount').textContent = `${count} tab${count !== 1 ? 's' : ''}`;
  }

  updateStatusIndicator() {
    const indicator = document.getElementById('statusIndicator');
    if (this.settings.enabled) {
      indicator.textContent = 'ON';
      indicator.classList.add('on');
    } else {
      indicator.textContent = 'OFF';
      indicator.classList.remove('on');
    }
  }

  toggleAdvancedSettings() {
    const advancedSettings = document.getElementById('advancedSettings');
    const advancedToggle = document.getElementById('advancedToggle');
    const isVisible = advancedSettings.style.display !== 'none';
    
    if (isVisible) {
      advancedSettings.style.display = 'none';
      advancedToggle.classList.remove('expanded');
    } else {
      advancedSettings.style.display = 'block';
      advancedToggle.classList.add('expanded');
    }
  }

  updateDebugVisibility() {
    const debugInfo = document.getElementById('debugInfo');
    if (this.settings.debugMode) {
      debugInfo.style.display = 'block';
      this.updateDebugInfo();
    } else {
      debugInfo.style.display = 'none';
    }
  }

  async updateDebugInfo() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'getMemoryUsage' });
      if (response) {
        document.getElementById('debugUptime').textContent = `${response.uptime}s`;
        document.getElementById('debugTrackedTabs').textContent = response.trackedTabs;
        document.getElementById('debugExcludedDomains').textContent = response.excludedDomains;
        document.getElementById('debugCheckCount').textContent = response.checkCount;
        document.getElementById('debugLastCheck').textContent = response.lastCheck;
      }
    } catch (error) {
      console.error('Failed to get debug info:', error);
    }
  }

  openTabsPage() {
    chrome.tabs.create({ url: chrome.runtime.getURL('tabs/tabs.html') });
  }
}

const popupManager = new PopupManager();