# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension that automatically closes tabs after a specified time period and saves them to a list for later restoration. It's similar to OneTab but with time-based auto-closing functionality.

## Chrome Extension Structure

The extension follows standard Chrome extension architecture:
- `manifest.json`: Extension configuration and permissions
- `background.js`: Service worker for tab management and auto-close logic
- `popup/`: Browser action popup UI for settings and saved tabs list
- `content/`: Content scripts if needed for page interaction
- `options/`: Options page for extension settings

## Key Features to Implement

1. **Auto-close Timer**: User-configurable time intervals (number + unit: minutes/hours/days)
2. **Activity-based Closure**: Tabs close based on time since last viewed/active
3. **Tab Saving**: Store closed tabs with URL, title, and timestamp
4. **Tab Restoration**: Allow users to reopen saved tabs from date-organized list
5. **Exclusion Rules**: 
   - Domain whitelist with wildcard support (e.g., *.google.com)
   - Pinned tabs are automatically excluded
6. **Settings Management**: User preferences for auto-close intervals and exclusions

## Development Commands

For Chrome extension development:
- Load extension: Chrome Developer Mode → Load unpacked
- Test: Manual testing in Chrome browser
- Package: Use Chrome Web Store Developer Dashboard or `chrome.runtime.getPackageDirectoryEntry()`

## Chrome Extension APIs Used

- `chrome.tabs`: Tab management and monitoring
- `chrome.storage`: Persistent settings and saved tabs storage
- `chrome.alarms`: Timer functionality for auto-close
- `chrome.action`: Browser action popup
- `chrome.permissions`: Required permissions for tab access

## Architecture Notes

- Background service worker handles the core auto-close logic
- Track tab activity using chrome.tabs.onActivated and chrome.tabs.onUpdated
- Use chrome.alarms API for reliable timing across browser sessions
- Storage.sync for settings, storage.local for saved tabs list organized by date
- Popup serves as both settings interface and saved tabs manager
- Domain exclusion matching with wildcard support (*.domain.com patterns)

## Required Permissions

- `"tabs"`: Access to tab information
- `"storage"`: Save settings and tab data
- `"alarms"`: Set up auto-close timers
- `"activeTab"`: Access active tab information
- `"host_permissions"`: Access to web pages for tab management