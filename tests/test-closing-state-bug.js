const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('CLOSING State Bug Investigation', () => {
  let context;
  let extensionId;
  let backgroundPage;

  test.beforeAll(async ({ browser }) => {
    // Load the Chrome extension from current directory
    const extensionPath = path.resolve(__dirname);
    console.log(`Loading extension from: ${extensionPath}`);
    
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI'
      ]
    });

    // Get extension ID by checking background pages
    let backgroundPages = context.backgroundPages();
    if (backgroundPages.length === 0) {
      try {
        await context.waitForEvent('backgroundpage', { timeout: 30000 });
        backgroundPages = context.backgroundPages();
      } catch (error) {
        console.log('Timeout waiting for background page, checking existing pages...');
        backgroundPages = context.backgroundPages();
      }
    }
    
    if (backgroundPages.length === 0) {
      throw new Error('No background pages found - extension may not have loaded correctly');
    }
    
    backgroundPage = backgroundPages[0];
    const url = backgroundPage.url();
    extensionId = url.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    // Wait for extension initialization with better error handling
    try {
      await backgroundPage.waitForFunction(() => {
        return typeof window.getAutoCloseManager === 'function' || 
               typeof autoCloseManagerInstance !== 'undefined';
      }, { timeout: 15000 });
    } catch (error) {
      console.log('Extension initialization timeout, checking what is available...');
      const availableObjects = await backgroundPage.evaluate(() => {
        return Object.keys(window).filter(key => key.includes('Auto') || key.includes('manager'));
      });
      console.log('Available objects:', availableObjects);
      throw error;
    }
    
    console.log('Extension background script initialized');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should reproduce and investigate the CLOSING state bug', async () => {
    console.log('\n=== STARTING CLOSING STATE BUG INVESTIGATION ===');
    
    // Create a test page
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    // Enable debug mode and set very short timeout
    const setupResult = await backgroundPage.evaluate(async () => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Enable debug mode to see title changes
      manager.settings.debugMode = true;
      manager.settings.enabled = true;
      manager.settings.timeValue = 5; // 5 seconds
      manager.settings.timeUnit = 'seconds';
      
      // Save settings
      await chrome.storage.sync.set({ autoCloseSettings: manager.settings });
      
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      // Reset timer to start countdown
      manager.resetTabTimer(tab.id);
      
      // Log initial state
      console.log('Initial setup completed');
      console.log('Tab ID:', tab.id);
      console.log('Debug mode:', manager.settings.debugMode);
      console.log('Timeout:', manager.settings.timeValue, manager.settings.timeUnit);
      
      return { tabId: tab.id, title: tab.title };
    });
    
    console.log(`Test tab created: ${setupResult.title} (ID: ${setupResult.tabId})`);
    
    // Monitor background script console for errors
    const consoleMessages = [];
    backgroundPage.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
      if (msg.type() === 'error') {
        console.log(`❌ Background Error: ${msg.text()}`);
      } else if (msg.text().includes('CLOSING') || msg.text().includes('closeAndSaveTab')) {
        console.log(`🔥 Closing-related log: ${msg.text()}`);
      }
    });
    
    // Switch to another tab to make the test tab inactive
    const inactivePage = await context.newPage();
    await inactivePage.goto('https://httpbin.org/html');
    await inactivePage.waitForLoadState('networkidle');
    
    console.log('\nTest tab is now inactive. Waiting for CLOSING state...');
    
    // Wait and monitor the title changes
    let titleHistory = [];
    let closingStateDetected = false;
    let actualTabClosed = false;
    
    for (let i = 0; i < 12; i++) { // Monitor for 12 seconds (more than 5 second timeout)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        const currentTitle = await page.title();
        titleHistory.push({
          time: i + 1,
          title: currentTitle,
          timestamp: new Date().toISOString()
        });
        
        if (currentTitle.includes('CLOSING')) {
          closingStateDetected = true;
          console.log(`🔥 CLOSING state detected at ${i + 1}s: "${currentTitle}"`);
        }
        
        console.log(`[${i + 1}s] Title: "${currentTitle}"`);
        
        // Check if page is still accessible
        const isAccessible = await page.evaluate(() => {
          return document.readyState;
        }).catch(() => false);
        
        if (!isAccessible) {
          actualTabClosed = true;
          console.log(`🗑️ Tab actually closed at ${i + 1}s`);
          break;
        }
        
      } catch (error) {
        // Tab might be closed
        if (error.message.includes('Target closed')) {
          actualTabClosed = true;
          console.log(`🗑️ Tab closed at ${i + 1}s: ${error.message}`);
          break;
        }
        console.log(`❌ Error checking title at ${i + 1}s: ${error.message}`);
      }
    }
    
    // Get final state from background script
    const finalState = await backgroundPage.evaluate(() => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      return {
        tabActivitySize: manager.tabActivity.size,
        autoCloseEnabled: manager.settings.enabled,
        debugMode: manager.settings.debugMode
      };
    });
    
    // Try to get remaining tabs
    const remainingTabs = await backgroundPage.evaluate(async () => {
      try {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(tab => tab.url.includes('example.com')).length;
      } catch (error) {
        return `Error: ${error.message}`;
      }
    });
    
    console.log('\n=== INVESTIGATION RESULTS ===');
    console.log('CLOSING state detected:', closingStateDetected);
    console.log('Tab actually closed:', actualTabClosed);
    console.log('Remaining example.com tabs:', remainingTabs);
    console.log('Final background state:', finalState);
    
    console.log('\n=== TITLE HISTORY ===');
    titleHistory.forEach(entry => {
      console.log(`[${entry.time}s] "${entry.title}"`);
    });
    
    console.log('\n=== CONSOLE MESSAGES ===');
    const relevantMessages = consoleMessages.filter(msg => 
      msg.text.includes('CLOSING') || 
      msg.text.includes('closeAndSaveTab') || 
      msg.text.includes('remove') ||
      msg.text.includes('ERROR') ||
      msg.text.includes('Failed')
    );
    
    relevantMessages.forEach(msg => {
      console.log(`[${msg.type.toUpperCase()}] ${msg.text}`);
    });
    
    // Test assertions
    if (closingStateDetected && !actualTabClosed) {
      console.log('\n❌ BUG CONFIRMED: Tab showed CLOSING state but was never actually closed!');
      
      // Let's investigate what's happening in the closeAndSaveTab function
      const closeDebugInfo = await backgroundPage.evaluate(async () => {
        const manager = window.autoCloseManagerInstance || getAutoCloseManager();
        
        // Try to manually call testTabClosing
        try {
          const testResult = await manager.testTabClosing();
          return { testResult, error: null };
        } catch (error) {
          return { testResult: null, error: error.message };
        }
      });
      
      console.log('\n=== MANUAL CLOSE TEST ===');
      console.log('Test close result:', closeDebugInfo);
      
    } else if (actualTabClosed) {
      console.log('\n✅ Tab was properly closed - no bug detected');
    } else {
      console.log('\n⚠️ CLOSING state was not detected - timeout may be too short or other issue');
    }
    
    // Keep some tabs open for cleanup
    if (!actualTabClosed) {
      await page.close();
    }
    await inactivePage.close();
  });

  test('should analyze the closeAndSaveTab function behavior', async () => {
    console.log('\n=== ANALYZING closeAndSaveTab FUNCTION ===');
    
    // Create a test tab
    const page = await context.newPage();
    await page.goto('https://httpbin.org/delay/1');
    await page.waitForLoadState('networkidle');
    
    // Get tab information and test the closing mechanism
    const closeAnalysis = await backgroundPage.evaluate(async () => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      console.log('Starting closeAndSaveTab analysis...');
      
      // Step 1: Check if tab is considered a "new tab"
      const isNewTab = manager.isNewTab(tab.url);
      console.log(`Is new tab (${tab.url}): ${isNewTab}`);
      
      // Step 2: Test the cleanTitleForSaving function
      const testTitle = "🔥 CLOSING - Test Page";
      const cleanedTitle = manager.cleanTitleForSaving(testTitle);
      console.log(`Title cleaning: "${testTitle}" -> "${cleanedTitle}"`);
      
      // Step 3: Test storage operations
      let storageTest = { success: false, error: null };
      try {
        const testSavedTab = {
          id: 'test_tab_123',
          url: tab.url,
          title: tab.title,
          closedAt: new Date().toISOString()
        };
        
        const { savedTabs = [] } = await chrome.storage.local.get(['savedTabs']);
        savedTabs.unshift(testSavedTab);
        await chrome.storage.local.set({ savedTabs });
        
        storageTest.success = true;
        console.log('Storage test: SUCCESS');
      } catch (error) {
        storageTest.error = error.message;
        console.log('Storage test: FAILED -', error.message);
      }
      
      // Step 4: Test chrome.tabs.remove permissions
      let removeTest = { success: false, error: null };
      try {
        // Don't actually remove the tab yet, just test permissions
        const hasTabsPermission = await new Promise((resolve) => {
          chrome.permissions.contains({ permissions: ['tabs'] }, resolve);
        });
        
        if (hasTabsPermission) {
          removeTest.success = true;
          console.log('Tab removal permissions: SUCCESS');
        } else {
          removeTest.error = 'Missing tabs permission';
          console.log('Tab removal permissions: FAILED - Missing tabs permission');
        }
      } catch (error) {
        removeTest.error = error.message;
        console.log('Tab removal permissions: FAILED -', error.message);
      }
      
      // Step 5: Test actual tab removal (be careful!)
      let actualRemoveTest = { success: false, error: null };
      try {
        console.log(`Attempting to remove tab ${tab.id}...`);
        await chrome.tabs.remove(tab.id);
        actualRemoveTest.success = true;
        console.log('Tab removal: SUCCESS');
      } catch (error) {
        actualRemoveTest.error = error.message;
        console.log('Tab removal: FAILED -', error.message);
      }
      
      return {
        tabId: tab.id,
        tabUrl: tab.url,
        isNewTab,
        cleanedTitle,
        storageTest,
        removeTest,
        actualRemoveTest
      };
    });
    
    console.log('\n=== CLOSE ANALYSIS RESULTS ===');
    console.log('Tab ID:', closeAnalysis.tabId);
    console.log('Tab URL:', closeAnalysis.tabUrl);
    console.log('Is new tab:', closeAnalysis.isNewTab);
    console.log('Title cleaning works:', closeAnalysis.cleanedTitle);
    console.log('Storage test:', closeAnalysis.storageTest);
    console.log('Remove permission test:', closeAnalysis.removeTest);
    console.log('Actual remove test:', closeAnalysis.actualRemoveTest);
    
    // Verify that the tab removal worked
    if (closeAnalysis.actualRemoveTest.success) {
      // Wait a bit and check if tab is gone
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const remainingTabs = await backgroundPage.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(tab => tab.url && tab.url.includes('httpbin.org')).length;
      });
      
      console.log('Remaining httpbin.org tabs after removal:', remainingTabs);
      
      // Check if the page is still accessible
      let pageStillAccessible = false;
      try {
        await page.title();
        pageStillAccessible = true;
      } catch (error) {
        pageStillAccessible = false;
      }
      
      console.log('Page still accessible after removal:', pageStillAccessible);
    }
  });

  test('should check for race conditions in the auto-close logic', async () => {
    console.log('\n=== CHECKING FOR RACE CONDITIONS ===');
    
    // Create multiple tabs and set very short timeout
    const pages = [];
    for (let i = 0; i < 3; i++) {
      const page = await context.newPage();
      await page.goto(`https://example.com?test=${i}`);
      await page.waitForLoadState('networkidle');
      pages.push(page);
    }
    
    // Switch to a different tab to make all test tabs inactive
    const activePage = await context.newPage();
    await activePage.goto('https://httpbin.org/html');
    await activePage.waitForLoadState('networkidle');
    
    // Configure very short timeout and enable debug mode
    const raceConditionTest = await backgroundPage.evaluate(async () => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Enable debug mode and set 3-second timeout
      manager.settings.debugMode = true;
      manager.settings.enabled = true;
      manager.settings.timeValue = 3;
      manager.settings.timeUnit = 'seconds';
      
      // Get all test tabs
      const tabs = await chrome.tabs.query({});
      const testTabs = tabs.filter(tab => tab.url.includes('example.com?test='));
      
      console.log(`Found ${testTabs.length} test tabs`);
      
      // Reset timers for all test tabs
      testTabs.forEach(tab => {
        manager.resetTabTimer(tab.id);
      });
      
      // Force a manual check after 4 seconds (should trigger closing)
      setTimeout(async () => {
        console.log('Manual check triggered...');
        await manager.checkAndCloseTabs();
      }, 4000);
      
      return {
        testTabCount: testTabs.length,
        testTabIds: testTabs.map(t => t.id)
      };
    });
    
    console.log('Race condition test setup:', raceConditionTest);
    
    // Monitor for 8 seconds
    for (let i = 0; i < 8; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check how many test tabs remain
      const remainingTabs = await backgroundPage.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(tab => tab.url && tab.url.includes('example.com?test=')).length;
      });
      
      console.log(`[${i + 1}s] Remaining test tabs: ${remainingTabs}`);
      
      if (remainingTabs === 0) {
        console.log('All test tabs were closed successfully');
        break;
      }
    }
    
    // Final check
    const finalState = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const remaining = tabs.filter(tab => tab.url && tab.url.includes('example.com?test='));
      return {
        remainingCount: remaining.length,
        remainingTabs: remaining.map(t => ({ id: t.id, url: t.url, title: t.title }))
      };
    });
    
    console.log('Final race condition test state:', finalState);
    
    // Clean up any remaining pages
    for (const page of pages) {
      try {
        await page.close();
      } catch (error) {
        // Tab might already be closed by the extension
      }
    }
    await activePage.close();
  });
});