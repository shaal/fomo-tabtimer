# Chrome Extension Tab Locking Feature Tests

This directory contains comprehensive Playwright tests for verifying the Chrome extension's tab locking functionality.

## Overview

The tab locking feature allows users to:
- Right-click on any tab to access context menu options
- Lock tabs to disable auto-close functionality
- Unlock tabs to re-enable auto-close functionality
- See context menu options that change based on lock status

## Test Files

### Main Test File
- **`test-tab-locking.js`** - Complete Playwright test suite covering all tab locking functionality

### Configuration Files
- **`playwright.config.js`** - Playwright configuration optimized for Chrome extension testing
- **`run-tab-locking-test.js`** - Test runner script with dependency checks and helpful output

### Package Management
- **`package.json`** - Updated with tab locking test scripts

## Prerequisites

1. **Node.js** (version 14 or higher)
2. **Chrome browser** installed
3. **Extension files** properly set up:
   - `manifest.json` with `contextMenus` permission
   - `background.js` with AutoCloseManager class
   - All other extension files in place

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npm run install-playwright
   ```

3. Or run the complete setup:
   ```bash
   npm run setup
   ```

## Running Tests

### Method 1: Using the Test Runner (Recommended)
```bash
npm run test-tab-locking
```

This runs the test runner script which:
- Checks all dependencies and required files
- Provides helpful error messages if something is missing
- Runs the tests with proper configuration
- Shows a detailed summary of test results

### Method 2: Direct Playwright Execution
```bash
npm run test-tab-locking-direct
```

This runs Playwright directly without the helper script.

### Method 3: Manual Execution
```bash
npx playwright test test-tab-locking.js
```

## Test Coverage

The test suite includes the following test scenarios:

### 1. Extension Loading and Setup
- ✅ Loads Chrome extension from current directory
- ✅ Verifies extension background script initialization
- ✅ Confirms context menu items are created properly

### 2. Tab Locking Functionality
- ✅ Tests basic tab locking mechanism
- ✅ Tests basic tab unlocking mechanism
- ✅ Verifies locked tabs are tracked correctly

### 3. Auto-Close Exclusion
- ✅ Confirms locked tabs are excluded from auto-close logic
- ✅ Verifies unlocked tabs can be auto-closed when expired
- ✅ Tests timeout logic respects lock status

### 4. Context Menu Integration
- ✅ Verifies context menu visibility changes based on lock status
- ✅ Tests "Lock tab" option appears for unlocked tabs
- ✅ Tests "Unlock tab" option appears for locked tabs

### 5. Persistence
- ✅ Confirms locked tabs persist across browser sessions
- ✅ Tests storage and retrieval of locked tab data

### 6. Multiple Tab Management
- ✅ Tests locking multiple tabs simultaneously
- ✅ Tests unlocking individual tabs while others remain locked
- ✅ Verifies proper state management for multiple tabs

### 7. Extension Permissions
- ✅ Confirms required permissions are available
- ✅ Tests context menu API accessibility and functionality

### 8. Context Menu Simulation
- ✅ Simulates context menu interactions
- ✅ Tests extension response to menu item clicks

## Test Environment

The tests run in a Chrome browser with the following configuration:
- **Non-headless mode** (required for extension testing)
- **Extension loaded** from current directory
- **Special Chrome flags** for testing environment
- **Single worker** to avoid conflicts

## Expected Output

When tests pass successfully, you'll see output like:
```
✅ All tests passed successfully!

📋 Test Summary:
   - Extension loading and context menu setup
   - Tab locking and unlocking functionality
   - Auto-close exclusion for locked tabs
   - Context menu visibility based on lock status
   - Persistence across browser sessions
   - Multiple tab locking/unlocking
   - Extension permissions verification
```

## Troubleshooting

### Common Issues

1. **"Extension not loading"**
   - Ensure all extension files are present
   - Check that `manifest.json` is valid
   - Verify `contextMenus` permission is included

2. **"Tests timing out"**
   - Close all Chrome browsers before running tests
   - Ensure Chrome is properly installed
   - Try running tests in non-headless mode

3. **"Context menu not working"**
   - Verify the `contextMenus` permission in manifest
   - Check that background script initializes properly
   - Ensure AutoCloseManager class has setupContextMenu method

4. **"Playwright not found"**
   - Run `npm run install-playwright`
   - Ensure dependencies are installed with `npm install`

### Debug Mode

To run tests with more verbose output:
```bash
DEBUG=pw:* npm run test-tab-locking-direct
```

## File Structure

```
/Users/ofershaal/code/test/fomo-tabtimer/
├── test-tab-locking.js          # Main test file
├── run-tab-locking-test.js      # Test runner script  
├── playwright.config.js         # Playwright configuration
├── package.json                 # Updated with test scripts
├── manifest.json               # Extension manifest (with contextMenus permission)
├── background.js               # Extension background script
└── TAB-LOCKING-TEST-README.md  # This file
```

## Extension Integration

The tests verify integration with the following extension components:

### Background Script (background.js)
- **AutoCloseManager class** - Main manager for tab auto-close logic
- **setupContextMenu()** - Creates context menu items
- **lockTab(tabId)** - Locks a tab to disable auto-close
- **unlockTab(tabId)** - Unlocks a tab to enable auto-close
- **shouldCloseTab()** - Checks if tab should be closed (respects lock status)
- **updateContextMenuVisibility()** - Updates menu item visibility

### Manifest (manifest.json)
- **contextMenus permission** - Required for context menu functionality
- **tabs permission** - Required for tab management
- **storage permission** - Required for persistence

### Storage
- **lockedTabs** - Set of locked tab IDs persisted in chrome.storage.local

## Notes

- Tests require Chrome browser (not Chromium) for full extension API support
- Extension runs in non-headless mode during testing
- Each test creates fresh browser context to avoid interference
- Tests include both functional verification and error handling scenarios