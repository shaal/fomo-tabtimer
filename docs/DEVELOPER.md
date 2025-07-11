# Developer Documentation

## Architecture Overview

The FOMO TabTimer extension follows a standard Chrome extension architecture with these main components:

### Core Components

1. **Background Script** (`background.js`)
   - Service worker that manages tab lifecycle
   - Handles timer logic and tab closing
   - Manages settings and storage
   - Provides debug information

2. **Content Script** (`content/debug-overlay.js`)
   - Injected into all tabs when debug mode is enabled
   - Displays visual countdown timers
   - Tracks user activity for timer resets
   - Manages tab title updates

3. **Popup Interface** (`popup/`)
   - Extension settings and configuration
   - User interface for preferences
   - Debug mode controls

4. **Tab Management** (`tabs/`)
   - Interface for viewing and restoring closed tabs
   - Tab search and filtering
   - Bulk restoration capabilities

## Data Flow

```
User Action → Popup → Background Script → Content Script → Visual Feedback
     ↓              ↓            ↓              ↓
  Settings → Chrome Storage → Timer Logic → Tab Titles
```

## Key Classes and Methods

### AutoCloseManager (background.js)

Main class that orchestrates the extension functionality.

#### Core Methods

- `init()`: Initialize the extension, load settings, set up event listeners
- `loadSettings()`: Load configuration from Chrome storage
- `setupEventListeners()`: Set up Chrome API event handlers
- `startPeriodicCheck()`: Configure alarms for tab checking
- `checkAndCloseTabs()`: Main loop that evaluates and closes tabs
- `shouldCloseTab()`: Determines if a tab should be closed
- `resetTabTimer()`: Resets activity timer for a tab
- `isExcludedDomain()`: Checks if a domain is excluded
- `closeAndSaveTab()`: Closes tab and saves it for restoration

#### Timer Logic

```javascript
// Timer reset conditions
if (tab.active) {
  this.resetTabTimer(tab.id);
  return false; // Don't close active tabs
}

// Calculate remaining time
const timeSinceActivity = now - lastActivity;
const shouldClose = timeSinceActivity > timeoutMs;
```

#### Domain Exclusion Logic

```javascript
// Wildcard patterns
if (pattern.startsWith('*.')) {
  const baseDomain = pattern.substring(2);
  regexPattern = `^[^.]+\\.${this.escapeRegex(baseDomain)}$`;
}

// Exact and subdomain matching
const exactMatch = domain === pattern;
const subdomainMatch = domain.endsWith('.' + pattern);
```

### DebugOverlay (content/debug-overlay.js)

Handles visual feedback and debug information.

#### Key Methods

- `init()`: Initialize overlay and event listeners
- `loadSettings()`: Load current settings from storage
- `trackActivity()`: Monitor user interactions
- `updateTabTitle()`: Update tab title with timer
- `updateOverlay()`: Update debug overlay panel
- `resetTabTimer()`: Reset local timer state

#### Activity Tracking

```javascript
// Track various user interactions
['click', 'keydown', 'mousemove', 'scroll', 'focus'].forEach(event => {
  document.addEventListener(event, resetActivity, { passive: true });
});

// Visibility change detection
document.addEventListener('visibilitychange', () => {
  this.isActive = !document.hidden;
  if (this.isActive) {
    this.resetTimer();
  }
});
```

### PopupManager (popup/popup.js)

Manages the extension popup interface.

#### Key Methods

- `init()`: Initialize popup UI and event handlers
- `loadSettings()`: Load settings for display
- `saveSettings()`: Save user preferences
- `renderDomainList()`: Display excluded domains
- `updateDebugInfo()`: Refresh debug statistics

## Storage Schema

### Chrome Storage Sync

```javascript
{
  autoCloseSettings: {
    enabled: boolean,
    timeValue: number,
    timeUnit: 'seconds' | 'minutes' | 'hours' | 'days',
    excludedDomains: string[],
    excludePinned: boolean,
    debugMode: boolean
  }
}
```

### Chrome Storage Local

```javascript
{
  savedTabs: [
    {
      id: string,
      url: string,
      title: string,
      favicon: string,
      windowId: number,
      windowTitle: string,
      closedAt: string,
      date: string
    }
  ]
}
```

## Event Handling

### Chrome API Events

```javascript
// Tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  this.resetTabTimer(activeInfo.tabId);
});

// Tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    this.resetTabTimer(tabId);
  }
});

// Settings changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (changes.autoCloseSettings) {
    this.handleSettingsChange(changes.autoCloseSettings.newValue);
  }
});
```

### Message Passing

```javascript
// Background to Content Script
chrome.runtime.sendMessage({
  type: 'debugModeChanged',
  debugMode: boolean,
  settings: object
});

// Content Script to Background
chrome.runtime.sendMessage({
  type: 'getDebugInfo',
  tabId: number
});
```

## Timer Implementation

### Check Frequency Logic

```javascript
// Dynamic check intervals based on timeout
if (timeoutMs < 60000) {
  checkIntervalMinutes = 0.1; // 6 seconds
} else if (timeoutMs < 300000) {
  checkIntervalMinutes = 0.5; // 30 seconds
} else {
  checkIntervalMinutes = 1; // 1 minute
}
```

### Timer Reset Conditions

1. **Tab Activation**: User switches to tab
2. **Tab Updates**: Page load completes
3. **User Interaction**: Click, scroll, keypress
4. **Visibility Change**: Tab becomes visible
5. **Window Focus**: Browser window gains focus

## Debug Mode Features

### Visual Indicators

- **Tab Title Timer**: `⏰ 2:30 - Page Title`
- **Urgency Levels**: 
  - `⏰` Normal (> 1 minute)
  - `⚠️` Warning (< 1 minute)
  - `🔥` Critical (< 30 seconds)

### Debug Overlay Panel

- Real-time countdown display
- Tab status information
- Memory usage statistics
- Manual timer reset button

### Console Logging

```javascript
console.log(`⏰ Timer RESET for "${tab.title}" (ID: ${tabId})`);
console.log(`🔴 Tab ${tabId} is INACTIVE - remaining: ${timeRemaining}s`);
console.log(`🟢 Tab ${tabId} is ACTIVE - showing full timeout`);
```

## Performance Considerations

### Memory Management

- Tab activity data stored in Map for O(1) access
- Saved tabs limited to 1000 entries
- Periodic cleanup of closed tab references

### CPU Optimization

- Dynamic check frequencies based on timeout
- Passive event listeners where possible
- Debounced activity tracking

### Storage Efficiency

- Settings stored in sync storage (small, synced)
- Tab data stored in local storage (larger, local)
- JSON serialization for complex data

## Testing

### Unit Testing

```javascript
// Test timer calculation
const timeoutMs = 10000; // 10 seconds
const timeSinceActivity = 5000; // 5 seconds ago
const remaining = timeoutMs - timeSinceActivity;
assert(remaining === 5000);
```

### Integration Testing

1. **Settings Persistence**: Save/load settings
2. **Timer Logic**: Activity tracking and resets
3. **Domain Exclusion**: Wildcard pattern matching
4. **Tab Management**: Close and restore operations

### Debug Tools

- `test-settings.html`: Settings configuration testing
- `test-timer-logic.html`: Timer behavior verification
- Chrome DevTools Console: Real-time logging
- Debug Dashboard: Performance monitoring

## Common Issues and Solutions

### Timer Not Resetting

**Problem**: Timer continues from previous value
**Solution**: Check activity tracking events

```javascript
// Ensure proper event binding
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    this.resetTimer();
  }
});
```

### Settings Not Persisting

**Problem**: Settings reset on browser restart
**Solution**: Verify storage operations

```javascript
// Proper async storage handling
await chrome.storage.sync.set({ autoCloseSettings: settings });
const stored = await chrome.storage.sync.get(['autoCloseSettings']);
```

### Memory Leaks

**Problem**: Extension using too much memory
**Solution**: Clean up event listeners and timers

```javascript
// Proper cleanup
if (this.updateInterval) {
  clearInterval(this.updateInterval);
  this.updateInterval = null;
}
```

## Extension Lifecycle

### Installation

1. Manifest validation
2. Permission grants
3. Background script initialization
4. Default settings creation

### Runtime

1. Background script runs continuously
2. Content scripts inject on page load
3. Popup creates on user interaction
4. Settings sync across Chrome instances

### Updates

1. Background script reloads
2. Content scripts re-inject
3. Settings preserved in storage
4. Tab activity data reset

## Security Considerations

### Permissions

- Minimal required permissions
- No host permissions (uses `activeTab`)
- No network access required
- Local storage only

### Data Privacy

- No external data transmission
- No user tracking or analytics
- Settings stored locally only
- No sensitive data collection

## Future Enhancements

### Potential Features

1. **Tab Grouping**: Organize tabs by domain or activity
2. **Smart Scheduling**: Different timeouts for different times
3. **Usage Analytics**: Local statistics and insights
4. **Backup/Restore**: Export/import settings and saved tabs
5. **Keyboard Shortcuts**: Quick actions via hotkeys

### Performance Improvements

1. **Web Workers**: Move heavy processing off main thread
2. **Incremental Updates**: Only update changed tabs
3. **Caching**: Cache domain exclusion results
4. **Lazy Loading**: Load content scripts only when needed