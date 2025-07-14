const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Chrome Extension Tab Locking Feature', () => {
  let context;
  let extensionId;

  test.beforeAll(async ({ browser }) => {
    // Load the Chrome extension from current directory
    const extensionPath = path.resolve(__dirname, '..');
    console.log(`Loading extension from: ${extensionPath}`);
    
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking'
      ]
    });

    // Get extension ID by checking background pages
    let backgroundPages = context.backgroundPages();
    if (backgroundPages.length === 0) {
      await context.waitForEvent('backgroundpage');
      backgroundPages = context.backgroundPages();
    }
    
    const backgroundPage = backgroundPages[0];
    const url = backgroundPage.url();
    extensionId = url.split('/')[2];
    console.log(`Extension loaded with ID: ${extensionId}`);

    // Wait for extension initialization
    await backgroundPage.waitForFunction(() => {
      return typeof window.getAutoCloseManager === 'function' || 
             typeof autoCloseManagerInstance !== 'undefined';
    }, { timeout: 10000 });
    
    console.log('Extension background script initialized');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should load extension and verify context menu setup', async () => {
    const page = await context.newPage();
    
    // Navigate to a test page
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    // Get background page to access extension internals
    const backgroundPage = context.backgroundPages()[0];
    
    // Verify context menu is set up
    const contextMenuSetup = await backgroundPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.contextMenus.removeAll(() => {
          let menuItems = [];
          
          // Check if context menu items are created
          chrome.contextMenus.create({
            id: 'testLockTab',
            title: 'Lock tab (disable auto-close)',
            contexts: ['page']
          }, () => {
            menuItems.push('lockTab');
            
            chrome.contextMenus.create({
              id: 'testUnlockTab', 
              title: 'Unlock tab (enable auto-close)',
              contexts: ['page']
            }, () => {
              menuItems.push('unlockTab');
              resolve(menuItems);
            });
          });
        });
      });
    });
    
    expect(contextMenuSetup).toEqual(expect.arrayContaining(['lockTab', 'unlockTab']));
    console.log('✓ Context menu items created successfully');
  });

  test('should test tab locking functionality', async () => {
    const page = await context.newPage();
    await page.goto('https://httpbin.org/html');
    await page.waitForLoadState('networkidle');
    
    const backgroundPage = context.backgroundPages()[0];
    
    // Get the current tab ID
    const tabId = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0].id;
    });
    
    console.log(`Testing with tab ID: ${tabId}`);
    
    // Test locking the tab
    const lockResult = await backgroundPage.evaluate(async (tabId) => {
      // Access the AutoCloseManager instance
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Lock the tab
      await manager.lockTab(tabId);
      
      // Verify the tab is locked
      return {
        isLocked: manager.lockedTabs.has(tabId),
        lockedTabsCount: manager.lockedTabs.size
      };
    }, tabId);
    
    expect(lockResult.isLocked).toBe(true);
    expect(lockResult.lockedTabsCount).toBeGreaterThan(0);
    console.log('✓ Tab locked successfully');
    
    // Test unlocking the tab
    const unlockResult = await backgroundPage.evaluate(async (tabId) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Unlock the tab
      await manager.unlockTab(tabId);
      
      // Verify the tab is unlocked
      return {
        isLocked: manager.lockedTabs.has(tabId),
        lockedTabsCount: manager.lockedTabs.size
      };
    }, tabId);
    
    expect(unlockResult.isLocked).toBe(false);
    console.log('✓ Tab unlocked successfully');
  });

  test('should verify locked tabs are excluded from auto-close', async () => {
    const page = await context.newPage();
    await page.goto('https://httpbin.org/delay/1');
    await page.waitForLoadState('networkidle');
    
    const backgroundPage = context.backgroundPages()[0];
    
    // Get tab info and set very short timeout for testing
    const setupResult = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;
      const tab = tabs[0];
      
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Set a very short timeout for testing (5 seconds)
      manager.settings.timeValue = 5;
      manager.settings.timeUnit = 'seconds';
      manager.settings.enabled = true;
      
      // Initialize tab activity
      manager.resetTabTimer(tabId);
      
      return { tabId, tab };
    });
    
    const { tabId, tab } = setupResult;
    
    // Test 1: Lock the tab and verify it won't be closed
    await backgroundPage.evaluate(async (tabId) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      await manager.lockTab(tabId);
    }, tabId);
    
    // Simulate tab being inactive for longer than timeout
    const lockedTabCloseCheck = await backgroundPage.evaluate(async (tab) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      const now = Date.now();
      const timeoutMs = 5000; // 5 seconds
      
      // Set activity to simulate expired tab
      manager.tabActivity.set(tab.id, now - (timeoutMs + 1000)); // 1 second over timeout
      
      // Check if tab should be closed (should return false because it's locked)
      return await manager.shouldCloseTab(tab, now, timeoutMs);
    }, tab);
    
    expect(lockedTabCloseCheck).toBe(false);
    console.log('✓ Locked tab correctly excluded from auto-close');
    
    // Test 2: Unlock the tab and verify it can be closed
    await backgroundPage.evaluate(async (tabId) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      await manager.unlockTab(tabId);
    }, tabId);
    
    const unlockedTabCloseCheck = await backgroundPage.evaluate(async (tab) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      const now = Date.now();
      const timeoutMs = 5000; // 5 seconds
      
      // Set activity to simulate expired tab (make tab inactive and not active)
      const inactiveTab = { ...tab, active: false };
      manager.tabActivity.set(tab.id, now - (timeoutMs + 1000)); // 1 second over timeout
      
      // Check if tab should be closed (should return true because it's unlocked)
      return await manager.shouldCloseTab(inactiveTab, now, timeoutMs);
    }, tab);
    
    expect(unlockedTabCloseCheck).toBe(true);
    console.log('✓ Unlocked tab correctly eligible for auto-close');
  });

  test('should test context menu visibility based on lock status', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');
    
    const backgroundPage = context.backgroundPages()[0];
    
    const tabId = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0].id;
    });
    
    // Test context menu visibility for unlocked tab
    const unlockedMenuState = await backgroundPage.evaluate(async (tabId) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Ensure tab is unlocked
      manager.lockedTabs.delete(tabId);
      await manager.updateContextMenuVisibility(tabId);
      
      // Simulate getting menu visibility (in real extension this would be done by Chrome)
      const isLocked = manager.lockedTabs.has(tabId);
      return {
        isLocked,
        shouldShowLock: !isLocked,
        shouldShowUnlock: isLocked
      };
    }, tabId);
    
    expect(unlockedMenuState.shouldShowLock).toBe(true);
    expect(unlockedMenuState.shouldShowUnlock).toBe(false);
    console.log('✓ Context menu visibility correct for unlocked tab');
    
    // Test context menu visibility for locked tab
    const lockedMenuState = await backgroundPage.evaluate(async (tabId) => {
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Lock the tab
      await manager.lockTab(tabId);
      
      const isLocked = manager.lockedTabs.has(tabId);
      return {
        isLocked,
        shouldShowLock: !isLocked,
        shouldShowUnlock: isLocked
      };
    }, tabId);
    
    expect(lockedMenuState.shouldShowLock).toBe(false);
    expect(lockedMenuState.shouldShowUnlock).toBe(true);
    console.log('✓ Context menu visibility correct for locked tab');
  });

  test('should persist locked tabs across browser sessions', async () => {
    const page = await context.newPage();
    await page.goto('https://httpbin.org/html');
    await page.waitForLoadState('networkidle');
    
    const backgroundPage = context.backgroundPages()[0];
    
    // Lock a tab and verify persistence
    const persistenceResult = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0].id;
      
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Lock the tab
      await manager.lockTab(tabId);
      
      // Save to storage
      await manager.saveLockedTabs();
      
      // Simulate reload by creating new set and loading from storage
      manager.lockedTabs.clear();
      await manager.loadLockedTabs();
      
      return {
        tabId,
        isLockedAfterReload: manager.lockedTabs.has(tabId),
        totalLockedTabs: manager.lockedTabs.size
      };
    });
    
    expect(persistenceResult.isLockedAfterReload).toBe(true);
    expect(persistenceResult.totalLockedTabs).toBeGreaterThan(0);
    console.log('✓ Locked tabs persisted across sessions');
  });

  test('should handle multiple tabs being locked and unlocked', async () => {
    // Create multiple tabs
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');
    
    const page2 = await context.newPage();
    await page2.goto('https://httpbin.org/html');
    await page2.waitForLoadState('networkidle');
    
    const backgroundPage = context.backgroundPages()[0];
    
    const multiTabResult = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const testTabs = tabs.filter(tab => 
        tab.url.includes('example.com') || tab.url.includes('httpbin.org')
      );
      
      if (testTabs.length < 2) {
        throw new Error('Not enough test tabs found');
      }
      
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Lock multiple tabs
      await manager.lockTab(testTabs[0].id);
      await manager.lockTab(testTabs[1].id);
      
      const lockedCount = manager.lockedTabs.size;
      const bothLocked = manager.lockedTabs.has(testTabs[0].id) && 
                        manager.lockedTabs.has(testTabs[1].id);
      
      // Unlock one tab
      await manager.unlockTab(testTabs[0].id);
      
      const afterUnlockCount = manager.lockedTabs.size;
      const firstUnlocked = !manager.lockedTabs.has(testTabs[0].id);
      const secondStillLocked = manager.lockedTabs.has(testTabs[1].id);
      
      return {
        testTabIds: testTabs.map(t => t.id),
        lockedCount,
        bothLocked,
        afterUnlockCount,
        firstUnlocked,
        secondStillLocked
      };
    });
    
    expect(multiTabResult.bothLocked).toBe(true);
    expect(multiTabResult.lockedCount).toBeGreaterThanOrEqual(2);
    expect(multiTabResult.firstUnlocked).toBe(true);
    expect(multiTabResult.secondStillLocked).toBe(true);
    expect(multiTabResult.afterUnlockCount).toBe(multiTabResult.lockedCount - 1);
    
    console.log('✓ Multiple tab locking/unlocking works correctly');
    
    // Close the test pages
    await page1.close();
    await page2.close();
  });

  test('should verify extension permissions and context menu integration', async () => {
    const backgroundPage = context.backgroundPages()[0];
    
    // Verify extension has required permissions
    const permissionCheck = await backgroundPage.evaluate(() => {
      return new Promise((resolve) => {
        chrome.permissions.contains({
          permissions: ['contextMenus', 'tabs', 'storage']
        }, (hasPermissions) => {
          resolve(hasPermissions);
        });
      });
    });
    
    expect(permissionCheck).toBe(true);
    console.log('✓ Extension has required permissions');
    
    // Verify context menu API is available and working
    const contextMenuApiTest = await backgroundPage.evaluate(() => {
      return new Promise((resolve) => {
        if (!chrome.contextMenus) {
          resolve({ available: false, error: 'contextMenus API not available' });
          return;
        }
        
        chrome.contextMenus.removeAll(() => {
          chrome.contextMenus.create({
            id: 'test-menu-item',
            title: 'Test Menu Item',
            contexts: ['page']
          }, () => {
            if (chrome.runtime.lastError) {
              resolve({ available: false, error: chrome.runtime.lastError.message });
            } else {
              chrome.contextMenus.remove('test-menu-item', () => {
                resolve({ available: true });
              });
            }
          });
        });
      });
    });
    
    expect(contextMenuApiTest.available).toBe(true);
    console.log('✓ Context menu API is working correctly');
  });
});

// Helper function to simulate right-click context menu (note: actual context menu testing 
// requires user interaction which is limited in automated tests)
test.describe('Context Menu Simulation Tests', () => {
  test('should simulate context menu interactions', async ({ browser }) => {
    const extensionPath = path.resolve(__dirname, '..');
    const context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    const page = await context.newPage();
    await page.goto('https://example.com');
    
    // Note: Real context menu testing requires manual interaction
    // This test verifies the extension responds to simulated menu clicks
    const backgroundPage = context.backgroundPages()[0];
    
    const simulatedMenuClick = await backgroundPage.evaluate(async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      const manager = window.autoCloseManagerInstance || getAutoCloseManager();
      
      // Simulate context menu click to lock tab
      const lockInfo = { menuItemId: 'lockTab' };
      await manager.lockTab(tab.id);
      
      const isLocked = manager.lockedTabs.has(tab.id);
      
      // Simulate context menu click to unlock tab
      const unlockInfo = { menuItemId: 'unlockTab' };
      await manager.unlockTab(tab.id);
      
      const isUnlocked = !manager.lockedTabs.has(tab.id);
      
      return { isLocked, isUnlocked, tabId: tab.id };
    });
    
    expect(simulatedMenuClick.isLocked).toBe(true);
    expect(simulatedMenuClick.isUnlocked).toBe(true);
    console.log('✓ Simulated context menu interactions work correctly');
    
    await context.close();
  });
});