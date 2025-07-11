# FOMO TabTimer Chrome Extension

A Chrome extension that automatically closes inactive tabs after a configurable timeout period and saves them for later restoration. Perfect for managing tab clutter and improving browser performance.

## Features

- 🕐 **Configurable Timeouts**: Set custom timeout periods (seconds, minutes, hours, or days)
- 🔄 **Smart Activity Tracking**: Resets timer when you return to a tab
- 🛡️ **Domain Exclusions**: Exclude specific domains or use wildcards (e.g., `*.github.com`)
- 📌 **Pinned Tab Protection**: Automatically excludes pinned tabs from being closed
- 💾 **Tab Restoration**: Saves closed tabs with timestamps for easy restoration
- 🐛 **Debug Mode**: Visual countdown timers and performance monitoring
- 🚀 **Lightweight**: Minimal memory footprint and efficient background processing

## Installation

### From Source (Developer Mode)

1. **Download or clone this repository**
2. **Open Chrome and navigate to** `chrome://extensions/`
3. **Enable Developer Mode** (toggle in top-right corner)
4. **Click "Load unpacked"** and select the extension directory
5. **The extension icon** should appear in your toolbar

### Configuration

1. **Click the extension icon** in your toolbar
2. **Enable FOMO TabTimer** toggle
3. **Set your preferred timeout** (e.g., 30 minutes, 10 seconds)
4. **Add domain exclusions** if needed (optional)
5. **Click "Save Settings"**

## Usage

### Basic Operation

1. **Configure your timeout** using the popup interface
2. **Enable the extension** with the toggle switch
3. **Browse normally** - the extension works silently in the background
4. **Inactive tabs** will be automatically closed after the configured timeout
5. **Closed tabs** are saved and can be restored from the "View All Closed Tabs" page

### Debug Mode

Enable debug mode to see visual feedback:

- **Tab Title Timers**: Shows countdown in inactive tab titles (e.g., `⏰ 2:30 - Page Title`)
- **Debug Overlay**: Floating panel with timer information and controls
- **Console Logging**: Detailed activity logs for troubleshooting

### Domain Exclusions

Protect important sites from being closed:

- **Exact domain**: `github.com`
- **Wildcard subdomains**: `*.google.com` (matches mail.google.com, docs.google.com, etc.)
- **Wildcard TLDs**: `github.*` (matches github.com, github.io, etc.)

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable FOMO TabTimer** | Master toggle for the extension | `true` |
| **Timeout** | How long tabs stay inactive before closing | `30 minutes` |
| **Excluded Domains** | Domains that won't be auto-closed | `[]` |
| **Exclude Pinned Tabs** | Protect pinned tabs from being closed | `true` |
| **Debug Mode** | Show visual timers and debug information | `false` |

## How It Works

### Timer Logic

1. **Tab becomes inactive**: Timer starts counting down from your configured timeout
2. **Tab becomes active**: Timer resets to full timeout period
3. **Tab stays inactive**: After timeout expires, tab is closed and saved
4. **Active tabs**: Never closed, regardless of how long they've been open

### Activity Detection

The extension considers a tab "active" when:
- It's the currently focused tab
- User interacts with it (clicks, scrolls, types)
- Tab receives focus or becomes visible

### Storage

- **Settings**: Stored in `chrome.storage.sync` (syncs across Chrome instances)
- **Closed Tabs**: Stored in `chrome.storage.local` (limited to 1000 entries)
- **Activity Data**: Stored in memory (reset on browser restart)

## Troubleshooting

### Extension Not Working

1. **Check if enabled**: Make sure the toggle is ON in the popup
2. **Verify settings**: Confirm your timeout is set correctly
3. **Check exclusions**: Make sure the domain isn't in your exclusion list
4. **Restart browser**: Sometimes helps with permission issues

### Tabs Not Closing

1. **Check if tabs are active**: Active tabs won't close
2. **Verify timeout**: Make sure enough time has passed
3. **Enable debug mode**: See real-time timer information
4. **Check console**: Look for error messages in developer tools

### Timer Not Visible

1. **Enable debug mode**: Timer only shows in debug mode
2. **Check settings**: Make sure debug mode is enabled and saved
3. **Refresh tabs**: Sometimes content script needs to reload

### Performance Issues

1. **Reduce check frequency**: Use longer timeouts to reduce background activity
2. **Limit exclusions**: Too many exclusions can slow down domain checking
3. **Clear saved tabs**: Old saved tabs accumulate over time

## Development

### Project Structure

```
fomo-tabtimer/
├── manifest.json              # Extension manifest
├── background.js              # Main extension logic
├── popup/                     # Extension popup interface
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── content/                   # Content scripts
│   └── debug-overlay.js       # Debug mode overlay
├── tabs/                      # Tab management interface
│   ├── tabs.html
│   ├── tabs.js
│   └── tabs.css
├── debug/                     # Debug dashboard
│   ├── debug-dashboard.html
│   ├── debug-dashboard.js
│   └── debug-dashboard.css
├── icons/                     # Extension icons
└── test/                      # Test files
```

### Key Components

- **`background.js`**: Main extension logic, tab monitoring, and auto-close functionality
- **`popup.js`**: Settings interface and user controls
- **`debug-overlay.js`**: Visual timer display and debug features
- **`tabs.js`**: Saved tab management and restoration

### Building

No build process required - this is a standard Chrome extension that can be loaded directly.

### Testing

1. **Load extension** in developer mode
2. **Use test pages**: `test-settings.html`, `test-timer-logic.html`
3. **Enable debug mode** for detailed logging
4. **Check console** for error messages and activity logs

### API Usage

The extension uses these Chrome APIs:
- `chrome.tabs`: Tab management and monitoring
- `chrome.storage`: Settings and data persistence
- `chrome.alarms`: Periodic background checks
- `chrome.runtime`: Message passing between scripts

## Privacy

- **No data collection**: Extension doesn't send any data to external servers
- **Local storage only**: All data stays on your device
- **No tracking**: No analytics or user behavior tracking
- **No network requests**: Extension works entirely offline

## Permissions

- **`tabs`**: Required to monitor and close tabs
- **`storage`**: Required to save settings and closed tabs
- **`alarms`**: Required for periodic background checks
- **`activeTab`**: Required to detect current tab activity

## License

This project is open source. Feel free to modify and distribute according to your needs.

## Support

For issues, questions, or feature requests, please check the troubleshooting section above or review the console logs with debug mode enabled.

## Version History

- **v1.0.0**: Initial release with basic auto-close functionality
- **v1.1.0**: Added debug mode and visual timer display
- **v1.2.0**: Enhanced domain exclusion with wildcard support
- **v1.3.0**: Improved timer reset logic and settings persistence