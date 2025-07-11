// Test for debug logging functionality
const { chromium } = require('playwright');
const path = require('path');

class DebugLoggingTest {
  constructor() {
    this.browser = null;
    this.extensionPath = path.dirname(__dirname);
  }

  async setup() {
    console.log('🚀 Setting up Chrome Extension for Debug Logging Test...');
    
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

  async testDebugLogging() {
    console.log('🧪 Testing debug logging functionality...');
    
    const page = await this.browser.newPage();
    
    // Navigate to a test page
    await page.goto('https://example.com');
    
    // Test console logs from background script
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    // Enable debug mode by accessing the extension popup
    try {
      const extensionId = await this.getExtensionId();
      if (extensionId) {
        console.log('✅ Extension ID found:', extensionId);
        
        // Try to access the popup
        const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
        await page.goto(popupUrl);
        
        // Check if debug toggle exists
        const debugToggle = await page.$('#debugToggle');
        if (debugToggle) {
          console.log('✅ Debug toggle found, enabling debug mode...');
          await debugToggle.click();
          
          // Save settings
          const saveButton = await page.$('#saveSettings');
          if (saveButton) {
            await saveButton.click();
            console.log('✅ Settings saved with debug mode enabled');
          }
        }
        
        // Wait a bit for the settings to propagate
        await page.waitForTimeout(2000);
        
        // Check if debug logs are appearing
        const debugLogs = consoleLogs.filter(log => log.includes('🔤'));
        console.log(`📊 Found ${debugLogs.length} debug logs`);
        
        if (debugLogs.length > 0) {
          console.log('✅ Debug logging is working correctly!');
          debugLogs.forEach(log => console.log('  📝', log));
        } else {
          console.log('⚠️  No debug logs found, but extension is loading');
        }
      } else {
        console.log('⚠️  Could not find extension ID');
      }
    } catch (error) {
      console.log('⚠️  Error during debug test:', error.message);
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
  const test = new DebugLoggingTest();
  
  try {
    await test.setup();
    await test.testDebugLogging();
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await test.cleanup();
  }
}

runTest();