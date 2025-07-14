const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('CLOSING State Bug - Simple Investigation', () => {
  test('should investigate the CLOSING state bug with manual verification', async ({ browser }) => {
    const extensionPath = path.resolve(__dirname);
    console.log(`Loading extension from: ${extensionPath}`);
    
    // Create browser context with extension
    const context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-first-run',
        '--no-default-browser-check'
      ]
    });
    
    try {
      // Create a test page
      const page = await context.newPage();
      await page.goto('https://example.com');
      await page.waitForLoadState('networkidle');
      
      console.log('Test page loaded');
      
      // Wait for background script to initialize
      await page.waitForTimeout(2000);
      
      // Try to access the background script
      const backgroundPages = context.backgroundPages();
      if (backgroundPages.length === 0) {
        console.log('❌ No background pages found - extension may not have loaded');
        return;
      }
      
      const backgroundPage = backgroundPages[0];
      console.log('✅ Background page found');
      
      // Check what's available in the background script
      const backgroundInfo = await backgroundPage.evaluate(() => {
        const info = {
          hasAutoCloseManager: typeof window.getAutoCloseManager === 'function',
          hasInstance: typeof autoCloseManagerInstance !== 'undefined',
          windowKeys: Object.keys(window).filter(key => 
            key.includes('Auto') || key.includes('manager') || key.includes('chrome')
          )
        };
        
        // Try to get the manager
        if (info.hasAutoCloseManager || info.hasInstance) {
          try {
            const manager = window.autoCloseManagerInstance || getAutoCloseManager();
            info.managerReady = true;
            info.settings = manager.settings;
            info.tabActivitySize = manager.tabActivity.size;
          } catch (error) {
            info.managerError = error.message;
          }
        }
        
        return info;
      });
      
      console.log('Background script info:', backgroundInfo);
      
      if (!backgroundInfo.managerReady) {
        console.log('❌ AutoCloseManager not ready - cannot continue test');
        return;
      }
      
      // Now configure the extension for testing
      const testSetup = await backgroundPage.evaluate(async () => {
        const manager = window.autoCloseManagerInstance || getAutoCloseManager();
        
        // Enable debug mode and set short timeout
        manager.settings.debugMode = true;
        manager.settings.enabled = true;
        manager.settings.timeValue = 5;
        manager.settings.timeUnit = 'seconds';
        
        // Save settings
        await chrome.storage.sync.set({ autoCloseSettings: manager.settings });
        
        // Get current tab
        const tabs = await chrome.tabs.query({});
        const testTab = tabs.find(tab => tab.url.includes('example.com'));
        
        if (testTab) {
          // Reset timer for test tab
          manager.resetTabTimer(testTab.id);
          
          console.log('Test setup complete - tab timer reset');
          return {
            success: true,
            tabId: testTab.id,
            settings: manager.settings
          };
        } else {
          return {
            success: false,
            error: 'No test tab found'
          };
        }
      });
      
      console.log('Test setup result:', testSetup);
      
      if (!testSetup.success) {
        console.log('❌ Test setup failed:', testSetup.error);
        return;
      }
      
      // Create another tab to make the test tab inactive
      const secondPage = await context.newPage();
      await secondPage.goto('https://httpbin.org/html');
      await secondPage.waitForLoadState('networkidle');
      
      console.log('Second tab created - test tab should now be inactive');
      
      // Monitor the test tab title for changes
      console.log('\nMonitoring tab title changes...');
      
      let closingStateFound = false;
      let tabClosed = false;
      
      // Monitor for 10 seconds
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        try {
          const title = await page.title();
          console.log(`[${i + 1}s] Title: "${title}"`);
          
          if (title.includes('CLOSING')) {
            closingStateFound = true;
            console.log(`🔥 CLOSING state detected at ${i + 1}s!`);
          }
          
          // Test if page is still accessible
          await page.evaluate(() => document.readyState);
          
        } catch (error) {
          if (error.message.includes('Target closed')) {
            tabClosed = true;
            console.log(`✅ Tab actually closed at ${i + 1}s`);
            break;
          } else {
            console.log(`❌ Error at ${i + 1}s: ${error.message}`);
          }
        }
      }
      
      // Get final state
      const finalCheck = await backgroundPage.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const exampleTabs = tabs.filter(tab => tab.url.includes('example.com'));
        
        const manager = window.autoCloseManagerInstance || getAutoCloseManager();
        
        return {
          remainingExampleTabs: exampleTabs.length,
          tabActivitySize: manager.tabActivity.size,
          settings: manager.settings
        };
      });
      
      console.log('\n=== FINAL RESULTS ===');
      console.log('CLOSING state found:', closingStateFound);
      console.log('Tab actually closed:', tabClosed);
      console.log('Final state:', finalCheck);
      
      if (closingStateFound && !tabClosed) {
        console.log('\n❌ BUG CONFIRMED: Tab showed CLOSING but never closed!');
        
        // Let's try to understand why
        const debugInfo = await backgroundPage.evaluate(async () => {
          const manager = window.autoCloseManagerInstance || getAutoCloseManager();
          
          // Try to manually call the close function
          const tabs = await chrome.tabs.query({});
          const testTab = tabs.find(tab => tab.url.includes('example.com'));
          
          if (testTab) {
            try {
              console.log('Attempting manual close...');
              await manager.closeAndSaveTab(testTab);
              return { manualCloseSuccess: true };
            } catch (error) {
              return { manualCloseError: error.message };
            }
          } else {
            return { error: 'No test tab found for manual close' };
          }
        });
        
        console.log('Manual close test:', debugInfo);
      }
      
      // Clean up
      await secondPage.close();
      if (!tabClosed) {
        await page.close();
      }
      
    } finally {
      await context.close();
    }
  });
  
  test('should test the chrome.tabs.remove API directly', async ({ browser }) => {
    const extensionPath = path.resolve(__dirname);
    console.log('Testing chrome.tabs.remove API...');
    
    const context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });
    
    try {
      const page = await context.newPage();
      await page.goto('https://httpbin.org/delay/1');
      await page.waitForLoadState('networkidle');
      
      await page.waitForTimeout(2000);
      
      const backgroundPages = context.backgroundPages();
      if (backgroundPages.length === 0) {
        console.log('❌ No background pages found');
        return;
      }
      
      const backgroundPage = backgroundPages[0];
      
      // Test direct tab removal
      const removeTest = await backgroundPage.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const testTab = tabs.find(tab => tab.url.includes('httpbin.org'));
        
        if (!testTab) {
          return { error: 'No test tab found' };
        }
        
        console.log(`Found test tab: ${testTab.id} - ${testTab.url}`);
        
        try {
          console.log('Attempting to remove tab...');
          await chrome.tabs.remove(testTab.id);
          console.log('Tab remove command sent');
          
          // Wait a bit and check
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const updatedTabs = await chrome.tabs.query({});
          const stillExists = updatedTabs.find(tab => tab.id === testTab.id);
          
          return {
            success: true,
            tabId: testTab.id,
            stillExists: !!stillExists,
            tabCountBefore: tabs.length,
            tabCountAfter: updatedTabs.length
          };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            tabId: testTab.id
          };
        }
      });
      
      console.log('Direct tab removal test:', removeTest);
      
      if (removeTest.success) {
        // Check if the page is still accessible
        let pageAccessible = true;
        try {
          await page.title();
        } catch (error) {
          pageAccessible = false;
          console.log('Page is no longer accessible - tab was closed');
        }
        
        console.log('Page still accessible:', pageAccessible);
        console.log('Tab still exists in query:', removeTest.stillExists);
        
        if (removeTest.stillExists || pageAccessible) {
          console.log('❌ Tab removal may not have worked properly');
        } else {
          console.log('✅ Tab removal worked correctly');
        }
      }
      
    } finally {
      await context.close();
    }
  });
});