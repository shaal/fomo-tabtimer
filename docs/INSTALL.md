# Installation Guide - FOMO TabTimer Chrome Extension

## Quick Installation

1. **Open Chrome Extensions Page**
   - Open Chrome browser
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load Extension**
   - Click "Load unpacked" button
   - Navigate to and select this directory: `/home/shaal/code/test/auto-close-chrome-extension`
   - Click "Select"

3. **Verify Installation**
   - Extension should appear in the extensions list
   - Look for "FOMO TabTimer" extension
   - Click the extension icon in the toolbar to open settings

## First Use

1. **Configure Settings**
   - Click the extension icon in Chrome toolbar
   - Set your preferred auto-close timer (e.g., 30 minutes)
   - Add any domains you want to exclude (e.g., `*.google.com`)
   - Click "Save Settings"

2. **Test the Extension**
   - Open several tabs
   - Make one tab active, leave others inactive
   - Wait for the timer to expire
   - Check if inactive tabs are closed and saved

## Features

- ✅ Auto-close tabs based on inactivity time
- ✅ Configurable timer (minutes/hours/days)
- ✅ Domain exclusion with wildcard support
- ✅ Pinned tab protection
- ✅ Save closed tabs for restoration
- ✅ Date-organized saved tabs list

## Troubleshooting

**Extension doesn't load:**
- Check Chrome Developer mode is enabled
- Ensure all files are in the correct directory
- Look for errors in `chrome://extensions/`

**Tabs not closing:**
- Check extension is enabled
- Verify timer settings are correct
- Check excluded domains list
- Ensure tabs are actually inactive

**Settings not saving:**
- Check storage permissions in manifest
- Look for console errors in extension popup
- Try reloading the extension

## Testing

Follow the detailed testing guide in `manual-test-guide.md` or run automated tests:

```bash
npm test
```