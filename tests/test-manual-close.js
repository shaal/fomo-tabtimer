// Manual test to check if tab closing works at all
const { chromium } = require('playwright');
const path = require('path');

class ManualCloseTest {
  constructor() {
    this.browser = null;
    this.extensionPath = path.dirname(__dirname);
  }

  async setup() {
    console.log('🚀 Setting up manual close test...');
    
    // Launch Chrome with extension
    this.browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${this.extensionPath}`,
        `--disable-extensions-except=${this.extensionPath}`,
        '--disable-web-security',
        '--no-sandbox'
      ]
    });
  }

  async testManualClose() {
    console.log('🧪 Testing manual tab close...');
    
    try {
      // Get extension ID
      const extensionId = await this.getExtensionId();
      if (!extensionId) {
        throw new Error('Extension not found');
      }

      console.log('✅ Extension found:', extensionId);

      // Create test tabs
      const testTab1 = await this.browser.newPage();
      await testTab1.goto('https://example.com');
      console.log('✅ Test tab 1 created');

      const testTab2 = await this.browser.newPage();
      await testTab2.goto('https://httpbin.org/delay/1');
      console.log('✅ Test tab 2 created');

      // Switch to a different tab to make test tabs inactive
      const mainPage = await this.browser.newPage();
      await mainPage.goto('https://google.com');
      console.log('✅ Main page active - test tabs should be inactive');

      // Wait a moment
      await mainPage.waitForTimeout(2000);

      // Now try to manually close one of the test tabs via the extension
      const testResult = await mainPage.evaluate(async (extensionId) => {
        try {
          // First get all tabs
          const allTabs = await chrome.tabs.query({});
          console.log('Available tabs:', allTabs.map(t => ({id: t.id, title: t.title, url: t.url})));
          
          // Find the example.com tab
          const exampleTab = allTabs.find(t => t.url.includes('example.com'));
          if (!exampleTab) {
            return {success: false, error: 'Example tab not found'};
          }
          
          console.log('Found example tab:', exampleTab.id, exampleTab.title);
          
          // Try to close it directly
          await chrome.tabs.remove(exampleTab.id);
          console.log('Tab removal command sent');
          
          // Wait a moment and check if it's still there
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const remainingTabs = await chrome.tabs.query({});
          const stillExists = remainingTabs.find(t => t.id === exampleTab.id);
          
          return {
            success: !stillExists,
            tabId: exampleTab.id,
            stillExists: !!stillExists,
            remainingTabCount: remainingTabs.length
          };
        } catch (error) {
          return {success: false, error: error.message};
        }
      }, extensionId);

      console.log('Manual close test result:', testResult);

      if (testResult.success) {
        console.log('✅ Manual tab close works - the bug is in the extension logic');
      } else {
        console.log('❌ Manual tab close failed - might be a permissions issue');
        console.log('Error:', testResult.error);
      }

      // Also test the extension's close method directly
      const extensionResult = await mainPage.evaluate(async (extensionId) => {
        try {
          // Send message to background script to close tabs
          const response = await chrome.runtime.sendMessage({
            type: 'manualCloseTest'
          });
          
          return {success: true, response};
        } catch (error) {
          return {success: false, error: error.message};
        }
      }, extensionId);

      console.log('Extension close test result:', extensionResult);

    } catch (error) {
      console.log('❌ Test failed:', error.message);
    }
  }

  async getExtensionId() {
    const page = await this.browser.newPage();
    await page.goto('chrome://extensions/');
    
    try {
      const extensions = await page.$$eval('extensions-item', items => 
        items.map(item => ({
          name: item.getAttribute('name'),
          id: item.getAttribute('id')
        }))
      );
      
      const autoCloseExt = extensions.find(ext => 
        ext.name && ext.name.toLowerCase().includes('fomo')
      );
      
      return autoCloseExt ? autoCloseExt.id : null;
    } catch (error) {
      console.log('Could not get extension ID:', error.message);
      return null;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

// Run the test
async function runTest() {
  const test = new ManualCloseTest();
  
  try {
    await test.setup();
    await test.testManualClose();
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await test.cleanup();
  }
}

runTest();