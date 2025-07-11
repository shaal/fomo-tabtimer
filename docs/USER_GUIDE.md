# User Guide: FOMO TabTimer Extension

## Quick Start

1. **Install the extension** from the Chrome Web Store or load it in developer mode
2. **Click the extension icon** in your browser toolbar
3. **Enable "FOMO TabTimer"** with the toggle switch
4. **Set your timeout** (e.g., 30 minutes)
5. **Click "Save Settings"**
6. **Start browsing** - inactive tabs will close automatically!

## Understanding How It Works

### The Basic Concept

The extension monitors your tab usage and automatically closes tabs that have been inactive for too long. This helps:
- **Reduce memory usage** by closing unused tabs
- **Improve browser performance** by reducing resource consumption
- **Keep your browser organized** by removing clutter
- **Save your closed tabs** so you can restore them later

### What Counts as "Inactive"?

A tab is considered inactive when:
- ✅ You're not currently viewing it (it's in the background)
- ✅ You haven't interacted with it (no clicks, scrolls, or typing)
- ✅ The page hasn't been updated or refreshed

A tab is considered active when:
- ✅ You're currently viewing it (it's the active tab)
- ✅ You interact with it (click, scroll, type)
- ✅ You switch to it from another tab

### Timer Behavior

- **When you switch away** from a tab, the timer starts counting down
- **When you switch back** to a tab, the timer resets to the full timeout
- **Active tabs never close**, regardless of how long they've been open

## Configuration Options

### Timeout Settings

| Setting | Description | Example Use Case |
|---------|-------------|------------------|
| **Seconds** | Very short timeouts | Testing the extension (10 seconds) |
| **Minutes** | Short to medium timeouts | Active browsing sessions (30 minutes) |
| **Hours** | Long timeouts | Research or work sessions (2 hours) |
| **Days** | Very long timeouts | Reference tabs (1 day) |

### Domain Exclusions

Protect important websites from being closed:

#### Exact Domain Matching
- `github.com` - Only matches github.com
- `google.com` - Only matches google.com

#### Wildcard Subdomain Matching
- `*.google.com` - Matches mail.google.com, docs.google.com, drive.google.com
- `*.github.com` - Matches gist.github.com, pages.github.com

#### Wildcard TLD Matching
- `github.*` - Matches github.com, github.io
- `google.*` - Matches google.com, google.co.uk

### Pinned Tab Protection

- **Enabled by default** - Pinned tabs are never closed
- **Disable if needed** - Uncheck "Exclude Pinned Tabs" in settings

## Debug Mode

Debug mode helps you understand what the extension is doing and troubleshoot issues.

### Enabling Debug Mode

1. **Open extension popup**
2. **Check "Debug Mode"**
3. **Click "Save Settings"**
4. **Refresh your tabs** to see debug information

### Debug Features

#### Tab Title Timers
When debug mode is enabled, you'll see countdown timers in tab titles:

- `⏰ 2:30 - Page Title` - Normal countdown (more than 1 minute)
- `⚠️ 0:45 - Page Title` - Warning (less than 1 minute)
- `🔥 0:15 - Page Title` - Critical (less than 30 seconds)
- `[EXCLUDED] Page Title` - Tab is excluded from closing

#### Debug Overlay Panel
A floating panel appears on each tab showing:
- **Countdown timer** - Time until tab closes
- **Tab status** - Active, Inactive, or Excluded
- **Memory usage** - Current memory consumption
- **Reset button** - Manually reset the timer

#### Console Logging
Open Chrome DevTools Console to see detailed activity logs:
- Timer resets and activations
- Domain exclusion checks
- Tab closing decisions
- Performance metrics

## Managing Closed Tabs

### Viewing Closed Tabs

1. **Click extension icon**
2. **Click "📂 View All Closed Tabs"**
3. **Browse your closed tabs** organized by date

### Restoring Tabs

- **Single tab**: Click the "Restore" button next to any tab
- **Multiple tabs**: Check multiple tabs and click "Restore Selected"
- **All tabs from a day**: Use the "Restore All" button for a date group

### Searching Closed Tabs

- **Use the search box** to find tabs by title or URL
- **Filter by date** using the date picker
- **Sort by** title, URL, or close time

## Troubleshooting

### Extension Not Working

**Problem**: Tabs aren't closing automatically

**Solutions**:
1. **Check if enabled**: Make sure the toggle is ON in the popup
2. **Verify timeout**: Ensure enough time has passed (check your timeout setting)
3. **Test with short timeout**: Try 10 seconds to verify it's working
4. **Check exclusions**: Make sure the domain isn't in your exclusion list
5. **Enable debug mode**: See if timers are counting down properly

### Timer Issues

**Problem**: Timer not resetting when switching tabs

**Solutions**:
1. **Enable debug mode**: See the actual timer values
2. **Check browser focus**: Make sure the browser window is active
3. **Refresh the tab**: Sometimes content script needs to reload
4. **Restart browser**: Clear any stuck states

### Settings Not Saving

**Problem**: Settings reset after closing browser

**Solutions**:
1. **Click "Save Settings"**: Make sure you save after making changes
2. **Check Chrome sync**: Ensure Chrome sync is enabled for extensions
3. **Try incognito mode**: Test if the issue is profile-specific
4. **Reinstall extension**: Sometimes helps with corrupted settings

### Debug Mode Issues

**Problem**: Debug timers not visible

**Solutions**:
1. **Enable debug mode**: Make sure it's checked and saved
2. **Refresh tabs**: Close and reopen tabs to reload content script
3. **Check permissions**: Ensure extension has permission to access tabs
4. **Test on different sites**: Some sites might block content scripts

### Performance Issues

**Problem**: Browser running slowly with extension

**Solutions**:
1. **Increase timeout**: Longer timeouts reduce background activity
2. **Limit exclusions**: Too many exclusions can slow domain checking
3. **Clear saved tabs**: Old saved tabs can consume memory
4. **Disable debug mode**: Debug features use additional resources

## Advanced Usage

### Power User Tips

1. **Multiple timeout strategies**:
   - Short timeouts (5-10 minutes) for active browsing
   - Long timeouts (2-4 hours) for research sessions
   - Very long timeouts (1 day) for reference material

2. **Strategic exclusions**:
   - Exclude work domains during work hours
   - Exclude streaming sites to prevent interruptions
   - Exclude email and messaging platforms

3. **Debug mode for optimization**:
   - Monitor memory usage trends
   - Identify which tabs consume the most resources
   - Fine-tune timeout settings based on actual usage

### Workflow Examples

#### Research Session
- **Timeout**: 2 hours
- **Exclusions**: `*.google.com`, `*.wikipedia.org`
- **Debug mode**: OFF (clean interface)

#### Active Browsing
- **Timeout**: 30 minutes
- **Exclusions**: Email, social media domains
- **Debug mode**: ON (monitor activity)

#### Testing/Development
- **Timeout**: 10 seconds
- **Exclusions**: `localhost`, `*.dev`
- **Debug mode**: ON (immediate feedback)

## Privacy and Security

### Data Collection
- **No data sent to servers** - Everything stays on your device
- **No tracking** - Extension doesn't monitor your browsing habits
- **No analytics** - No usage statistics collected

### Data Storage
- **Settings**: Stored in Chrome sync storage (syncs across devices)
- **Closed tabs**: Stored locally on your device only
- **Activity data**: Stored in memory only (cleared on restart)

### Permissions
- **Tabs**: Required to monitor and close tabs
- **Storage**: Required to save settings and closed tabs
- **Alarms**: Required for periodic background checks

## Frequently Asked Questions

### Will this extension slow down my browser?
No, the extension is designed to be lightweight and actually improves performance by closing unused tabs.

### Can I restore tabs after the browser closes?
Yes, closed tabs are saved locally and persist between browser sessions.

### What happens to tabs with unsaved data?
The extension only closes tabs that have been inactive. If you're actively using a tab, it won't be closed.

### Can I use this extension with other tab managers?
Yes, this extension works alongside other tab management tools.

### Does this work in incognito mode?
The extension needs to be enabled for incognito mode in Chrome's extension settings.

### Can I exclude specific pages, not just domains?
Currently, exclusions work at the domain level. Page-specific exclusions may be added in future versions.

## Getting Help

### Self-Help Resources
1. **Enable debug mode** to see what's happening
2. **Check console logs** for error messages
3. **Try different settings** to isolate the issue
4. **Test with a fresh browser profile**

### Common Solutions
- **Restart browser** for permission issues
- **Reload extension** in developer mode
- **Clear extension data** to reset to defaults
- **Check Chrome version** compatibility

### Reporting Issues
When reporting issues, please include:
- Chrome version
- Extension version
- Steps to reproduce
- Console error messages (if any)
- Settings configuration

## Tips for Best Results

1. **Start with longer timeouts** (30-60 minutes) and adjust based on usage
2. **Use debug mode initially** to understand the behavior
3. **Add exclusions gradually** as you identify important sites
4. **Monitor memory usage** to see the performance benefits
5. **Review closed tabs regularly** to ensure important content isn't lost
6. **Customize per workflow** - different settings for different activities