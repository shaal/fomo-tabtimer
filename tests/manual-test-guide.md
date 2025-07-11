# Manual Testing Guide for FOMO TabTimer Chrome Extension

## Prerequisites
- Google Chrome browser
- The extension source code in `/home/shaal/code/test/auto-close-chrome-extension`

## Setup Instructions

### 1. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the extension directory: `/home/shaal/code/test/auto-close-chrome-extension`
5. Verify the extension appears in the list with "FOMO TabTimer" name

### 2. Verify Extension Icon
- Check that the extension icon appears in the Chrome toolbar
- Click the icon to open the popup interface

## Test Cases

### Test 1: Basic Extension Loading
**Objective**: Verify extension loads correctly
**Steps**:
1. Navigate to `chrome://extensions/`
2. Find "FOMO TabTimer" in the list
3. Verify it shows "Enabled" status
4. Check that no errors are displayed

**Expected Result**: Extension is loaded and enabled without errors

### Test 2: Popup Interface
**Objective**: Verify popup functionality
**Steps**:
1. Click the extension icon in the toolbar
2. Verify popup opens with settings interface
3. Check for the following elements:
   - Enable/disable toggle
   - Time value input field
   - Time unit selector (minutes/hours/days)
   - Excluded domains text area
   - Exclude pinned tabs checkbox

**Expected Result**: Popup displays all settings controls

### Test 3: Multiple Tabs Opening
**Objective**: Test with multiple tabs
**Steps**:
1. Open 5-7 different websites in separate tabs:
   - https://example.com
   - https://google.com
   - https://github.com
   - https://stackoverflow.com
   - https://news.ycombinator.com
2. Switch between tabs to simulate activity
3. Leave some tabs inactive

**Expected Result**: All tabs open successfully

### Test 4: Auto-Close Timer (Short Test)
**Objective**: Test auto-close functionality
**Steps**:
1. Set timer to 1 minute in extension popup
2. Open 3 test tabs
3. Make one tab active, leave others inactive
4. Wait 1 minute
5. Check if inactive tabs are closed

**Expected Result**: Inactive tabs are closed after timeout

### Test 5: Pinned Tab Exclusion
**Objective**: Verify pinned tabs are not closed
**Steps**:
1. Open 2 tabs
2. Pin one tab (right-click tab → "Pin tab")
3. Set timer to 1 minute
4. Wait for timer to expire
5. Check if pinned tab remains open

**Expected Result**: Pinned tab remains open, unpinned tab is closed

### Test 6: Domain Exclusion
**Objective**: Test domain exclusion rules
**Steps**:
1. Add `google.com` to excluded domains in popup
2. Open tabs:
   - https://google.com
   - https://example.com
3. Set timer to 1 minute
4. Wait for timer to expire

**Expected Result**: Google.com tab remains open, example.com tab is closed

### Test 7: Saved Tabs Functionality
**Objective**: Verify closed tabs are saved
**Steps**:
1. Open extension popup
2. Look for "Saved Tabs" or "Recently Closed" section
3. Open several tabs and let them auto-close
4. Check if closed tabs appear in saved list
5. Try restoring a saved tab

**Expected Result**: Closed tabs are saved and can be restored

### Test 8: Settings Persistence
**Objective**: Verify settings are saved
**Steps**:
1. Change settings in popup (timer, excluded domains)
2. Close and reopen Chrome
3. Check if settings are preserved
4. Reload extension and verify settings

**Expected Result**: Settings persist across browser sessions

### Test 9: Background Processing
**Objective**: Test background script functionality
**Steps**:
1. Open Chrome DevTools
2. Navigate to `chrome://extensions/`
3. Find your extension and click "service worker"
4. Check console for any errors
5. Open multiple tabs and monitor background activity

**Expected Result**: Background script runs without errors

### Test 10: Edge Cases
**Objective**: Test edge cases and error handling
**Steps**:
1. Test with 0 tabs open
2. Test with 20+ tabs open
3. Test with invalid URLs
4. Test with chrome:// URLs
5. Test with incognito mode

**Expected Result**: Extension handles edge cases gracefully

## Debugging Tips

### Check Extension Console
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "service worker" to open background script console
4. Look for error messages or debug output

### Check Popup Console
1. Right-click on extension popup
2. Select "Inspect"
3. Check console for errors

### Check Storage
1. In extension console, run:
   ```javascript
   chrome.storage.sync.get(null, console.log);
   chrome.storage.local.get(null, console.log);
   ```

## Performance Testing

### Memory Usage
- Monitor Chrome's task manager while extension is running
- Check for memory leaks with many tabs

### CPU Usage
- Monitor CPU usage during periodic tab checks
- Verify background script doesn't consume excessive resources

## Test Data Collection

Keep track of:
- Test execution time
- Number of tabs tested
- Settings configurations used
- Any errors encountered
- Performance metrics

## Automated Testing Alternative

If you prefer automated testing, install Playwright and use the test runner:

```bash
cd /home/shaal/code/test/auto-close-chrome-extension
npm install
npx playwright install chromium
node test-runner.js
```

This will run comprehensive automated tests covering all the manual test cases above.