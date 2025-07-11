class TabsManager {
  constructor() {
    this.currentPage = 1;
    this.itemsPerPage = 50;
    this.allTabs = [];
    this.filteredTabs = [];
    this.currentFilter = 'all';
    this.searchQuery = '';
    this.debugMode = false;
    this.init();
  }

  debugLog(message, ...args) {
    if (this.debugMode) {
      console.log(`🔤 [TabsManager] ${message}`, ...args);
    }
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    await this.loadTabs();
    this.renderTabs();
    this.updateStats();
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(['autoCloseSettings']);
      if (stored.autoCloseSettings) {
        this.debugMode = stored.autoCloseSettings.debugMode || false;
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.applyFilters();
    });

    document.getElementById('searchBtn').addEventListener('click', () => {
      this.applyFilters();
    });

    document.getElementById('dateFilter').addEventListener('change', (e) => {
      this.currentFilter = e.target.value;
      this.applyFilters();
    });

    document.getElementById('restoreAllBtn').addEventListener('click', () => {
      this.restoreAllTabs();
    });

    document.getElementById('clearAllBtn').addEventListener('click', () => {
      this.clearAllTabs();
    });

    document.getElementById('exportBtn').addEventListener('click', () => {
      this.exportTabs();
    });

    ['prevPage', 'prevPage2'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderTabs();
        }
      });
    });

    ['nextPage', 'nextPage2'].forEach(id => {
      document.getElementById(id).addEventListener('click', () => {
        const totalPages = Math.ceil(this.filteredTabs.length / this.itemsPerPage);
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.renderTabs();
        }
      });
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.savedTabs) {
        this.loadTabs();
      }
    });

    // Add event delegation for tab actions
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('restore-btn')) {
        const tabId = e.target.getAttribute('data-tab-id');
        if (tabId) {
          this.restoreTab(tabId);
        }
      } else if (e.target.classList.contains('copy-btn')) {
        const url = e.target.getAttribute('data-url');
        if (url) {
          this.copyUrl(url);
        }
      } else if (e.target.classList.contains('delete-btn')) {
        const tabId = e.target.getAttribute('data-tab-id');
        if (tabId) {
          this.deleteTab(tabId);
        }
      }
    });
  }

  async loadTabs() {
    const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
    this.allTabs = savedTabs;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.allTabs];

    if (this.searchQuery) {
      filtered = filtered.filter(tab => 
        tab.title.toLowerCase().includes(this.searchQuery) ||
        tab.url.toLowerCase().includes(this.searchQuery)
      );
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    switch (this.currentFilter) {
      case 'today':
        filtered = filtered.filter(tab => new Date(tab.closedAt) >= today);
        break;
      case 'yesterday':
        filtered = filtered.filter(tab => {
          const closedDate = new Date(tab.closedAt);
          return closedDate >= yesterday && closedDate < today;
        });
        break;
      case 'week':
        filtered = filtered.filter(tab => new Date(tab.closedAt) >= weekAgo);
        break;
      case 'month':
        filtered = filtered.filter(tab => new Date(tab.closedAt) >= monthAgo);
        break;
    }

    this.filteredTabs = filtered;
    this.currentPage = 1;
    this.renderTabs();
    this.updateStats();
  }

  renderTabs() {
    const container = document.getElementById('tabsList');
    
    if (this.filteredTabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📭</div>
          <h3>No tabs found</h3>
          <p>${this.searchQuery ? 'Try a different search term' : 'No closed tabs match your filters'}</p>
        </div>
      `;
      this.updatePagination();
      return;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const pageItems = this.filteredTabs.slice(startIndex, endIndex);

    const tabsByDateAndWindow = this.groupTabsByDateAndWindow(pageItems);
    
    let html = '';
    Object.keys(tabsByDateAndWindow).forEach(date => {
      const dateTabCount = Object.values(tabsByDateAndWindow[date]).reduce((sum, tabs) => sum + tabs.length, 0);
      html += `<div class="date-group">
        <div class="date-header">
          ${date}
          <div class="group-actions">
            <span class="tab-count">${dateTabCount} tabs</span>
            <button class="group-restore-btn" onclick="tabsManager.restoreDateGroup('${date}')">Restore All</button>
          </div>
        </div>`;
      
      Object.keys(tabsByDateAndWindow[date]).forEach(windowTitle => {
        const windowTabCount = tabsByDateAndWindow[date][windowTitle].length;
        html += `<div class="window-group">
          <div class="window-header">
            ${windowTitle}
            <div class="group-actions">
              <span class="tab-count">${windowTabCount} tabs</span>
              <button class="group-restore-btn" onclick="tabsManager.restoreWindowGroup('${date}', '${windowTitle.replace(/'/g, "\\'")}')">Restore Group</button>
            </div>
          </div>`;
        
        tabsByDateAndWindow[date][windowTitle].forEach(tab => {
          html += this.createTabItemHTML(tab);
        });
        
        html += '</div>';
      });
      
      html += '</div>';
    });

    container.innerHTML = html;
    this.updatePagination();
  }

  groupTabsByDateAndWindow(tabs) {
    const grouped = {};
    tabs.forEach(tab => {
      const date = tab.date || new Date(tab.closedAt).toDateString();
      const windowTitle = tab.windowTitle || 'Unknown Window';
      
      if (!grouped[date]) {
        grouped[date] = {};
      }
      if (!grouped[date][windowTitle]) {
        grouped[date][windowTitle] = [];
      }
      grouped[date][windowTitle].push(tab);
    });
    return grouped;
  }

  createTabItemHTML(tab) {
    const favicon = tab.favicon || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMkMxMS4zMTM3IDIgMTQgNC42ODYzIDE0IDhDMTQgMTEuMzEzNyAxMS4zMTM3IDE0IDggMTRDNC42ODYzIDE0IDIgMTEuMzEzNyAyIDhDMiA0LjY4NjMgNC42ODYzIDIgOCAyWiIgZmlsbD0iIzMzMzMzMyIvPgo8L3N2Zz4K';
    const time = new Date(tab.closedAt).toLocaleTimeString();
    const safeId = `tab-${tab.id}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    return `
      <div class="tab-item" data-tab-id="${tab.id}">
        <img src="${favicon}" class="tab-favicon" alt="favicon">
        <div class="tab-content">
          <div class="tab-title">${this.escapeHtml(tab.title)}</div>
          <div class="tab-url">
            <a href="${tab.url}" target="_blank" class="tab-link" title="Click to open in new tab">
              ${this.escapeHtml(tab.url)}
            </a>
          </div>
        </div>
        <div class="tab-meta">
          <div class="tab-time">${time}</div>
          <div class="tab-actions">
            <button class="tab-action restore-btn" data-tab-id="${tab.id}">Restore</button>
            <button class="tab-action copy-btn" data-url="${this.escapeHtml(tab.url)}">Copy</button>
            <button class="tab-action delete-btn" data-tab-id="${tab.id}">Delete</button>
          </div>
        </div>
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updatePagination() {
    const totalPages = Math.ceil(this.filteredTabs.length / this.itemsPerPage);
    const pageInfo = `Page ${this.currentPage} of ${totalPages}`;
    
    document.getElementById('pageInfo').textContent = pageInfo;
    document.getElementById('pageInfo2').textContent = pageInfo;
    
    ['prevPage', 'prevPage2'].forEach(id => {
      document.getElementById(id).disabled = this.currentPage === 1;
    });
    
    ['nextPage', 'nextPage2'].forEach(id => {
      document.getElementById(id).disabled = this.currentPage === totalPages || totalPages === 0;
    });
  }

  updateStats() {
    const total = this.allTabs.length;
    const today = this.allTabs.filter(tab => {
      const closedDate = new Date(tab.closedAt);
      const todayDate = new Date();
      return closedDate.toDateString() === todayDate.toDateString();
    }).length;
    
    const sizeInBytes = JSON.stringify(this.allTabs).length;
    const sizeInKB = (sizeInBytes / 1024).toFixed(1);
    
    document.getElementById('totalTabs').textContent = total;
    document.getElementById('todayTabs').textContent = today;
    document.getElementById('totalSize').textContent = `${sizeInKB} KB`;
  }

  async restoreTab(tabId) {
    this.debugLog('Attempting to restore tab with ID:', tabId);
    
    // Refresh the tab list first to ensure we have the latest data
    await this.loadTabs();
    
    const tab = this.allTabs.find(t => String(t.id) === String(tabId));
    this.debugLog('Found tab:', tab);
    
    if (!tab) {
      console.error('❌ Tab not found with ID:', tabId);
      this.debugLog('Available tab IDs:', this.allTabs.map(t => t.id));
      this.showNotification('Tab not found. It may have already been restored.', 'error');
      return;
    }
    
    if (!tab.url) {
      console.error('❌ Tab has no URL:', tab);
      this.showNotification('Tab has no URL to restore.', 'error');
      return;
    }
    
    try {
      this.debugLog('Creating new tab with URL:', tab.url);
      
      // Create the new tab
      const newTab = await chrome.tabs.create({ 
        url: tab.url,
        active: true 
      });
      
      this.debugLog('New tab created successfully:', newTab.id);
      
      // Remove the tab from storage AFTER successful creation
      this.debugLog('Removing tab from storage...');
      const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
      const originalCount = savedTabs.length;
      const filteredTabs = savedTabs.filter(t => String(t.id) !== String(tabId));
      
      this.debugLog(`Tabs before removal: ${originalCount}, after: ${filteredTabs.length}`);
      
      await chrome.storage.local.set({ savedTabs: filteredTabs });
      this.debugLog('Storage updated successfully');
      
      // Reload the tabs list to reflect changes
      await this.loadTabs();
      
      // Show success notification
      this.showNotification(`Tab "${tab.title}" restored successfully`, 'success');
      
    } catch (error) {
      console.error('❌ Failed to restore tab:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        tab: tab
      });
      this.showNotification(`Failed to restore tab: ${error.message}`, 'error');
    }
  }

  async deleteTab(tabId) {
    const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
    const filteredTabs = savedTabs.filter(t => String(t.id) !== String(tabId));
    await chrome.storage.local.set({ savedTabs: filteredTabs });
    await this.loadTabs();
  }

  async restoreAllTabs() {
    if (this.filteredTabs.length === 0) return;
    
    const confirmed = confirm(`Are you sure you want to restore ${this.filteredTabs.length} tabs?`);
    if (!confirmed) return;
    
    const button = document.getElementById('restoreAllBtn');
    button.disabled = true;
    button.textContent = 'Restoring...';
    
    try {
      for (const tab of this.filteredTabs) {
        await chrome.tabs.create({ url: tab.url });
        await this.deleteTab(tab.id);
      }
    } catch (error) {
      console.error('Failed to restore tabs:', error);
      alert('Some tabs failed to restore. Check the console for details.');
    } finally {
      button.disabled = false;
      button.textContent = 'Restore All';
    }
  }

  async clearAllTabs() {
    if (this.allTabs.length === 0) return;
    
    const confirmed = confirm(`Are you sure you want to clear all ${this.allTabs.length} saved tabs? This cannot be undone.`);
    if (!confirmed) return;
    
    await chrome.storage.local.set({ savedTabs: [] });
    await this.loadTabs();
  }

  copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
      const notification = document.createElement('div');
      notification.textContent = 'URL copied to clipboard';
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 1000;
        font-size: 14px;
      `;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    });
  }

  exportTabs() {
    const data = {
      exportedAt: new Date().toISOString(),
      totalTabs: this.allTabs.length,
      tabs: this.allTabs.map(tab => ({
        title: tab.title,
        url: tab.url,
        closedAt: tab.closedAt,
        windowTitle: tab.windowTitle
      }))
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auto-close-tabs-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
  }

  async restoreWindowGroup(date, windowTitle) {
    const windowTabs = this.filteredTabs.filter(tab => 
      (tab.date || new Date(tab.closedAt).toDateString()) === date && 
      (tab.windowTitle || 'Unknown Window') === windowTitle
    );
    
    if (windowTabs.length === 0) return;
    
    const confirmed = confirm(`Are you sure you want to restore ${windowTabs.length} tabs from "${windowTitle}"?`);
    if (!confirmed) return;
    
    try {
      for (const tab of windowTabs) {
        await chrome.tabs.create({ url: tab.url });
        
        // Remove from storage
        const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
        const filteredTabs = savedTabs.filter(t => String(t.id) !== String(tab.id));
        await chrome.storage.local.set({ savedTabs: filteredTabs });
      }
      
      await this.loadTabs();
      this.showNotification(`${windowTabs.length} tabs restored successfully`, 'success');
    } catch (error) {
      console.error('Failed to restore window group:', error);
      this.showNotification('Failed to restore some tabs: ' + error.message, 'error');
    }
  }

  async restoreDateGroup(date) {
    const dateTabs = this.filteredTabs.filter(tab => 
      (tab.date || new Date(tab.closedAt).toDateString()) === date
    );
    
    if (dateTabs.length === 0) return;
    
    const confirmed = confirm(`Are you sure you want to restore all ${dateTabs.length} tabs from ${date}?`);
    if (!confirmed) return;
    
    try {
      for (const tab of dateTabs) {
        await chrome.tabs.create({ url: tab.url });
        
        // Remove from storage
        const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
        const filteredTabs = savedTabs.filter(t => String(t.id) !== String(tab.id));
        await chrome.storage.local.set({ savedTabs: filteredTabs });
      }
      
      await this.loadTabs();
      this.showNotification(`${dateTabs.length} tabs restored successfully`, 'success');
    } catch (error) {
      console.error('Failed to restore date group:', error);
      this.showNotification('Failed to restore some tabs: ' + error.message, 'error');
    }
  }
}

const tabsManager = new TabsManager();