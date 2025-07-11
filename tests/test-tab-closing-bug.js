// Test specifically for the "closing" tab bug
const { chromium } = require('playwright');
const path = require('path');

class TabClosingBugTest {
  constructor() {
    this.browser = null;
    this.extensionPath = path.dirname(__dirname);
    this.consoleLogs = [];
  }

  async setup() {
    console.log('🚀 Setting up Chrome Extension Test for Tab Closing Bug...');
    
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

  async testTabClosingBug() {
    console.log('🧪 Testing tab closing bug...');
    
    // Create a new page to capture console logs
    const page = await this.browser.newPage();
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      console.log(`📋 Console: ${text}`);
      this.consoleLogs.push(text);
    });

    // First, enable debug mode and set a short timeout
    try {
      const extensionId = await this.getExtensionId();
      if (extensionId) {
        console.log('✅ Extension ID found:', extensionId);
        
        // Configure extension with debug mode and very short timeout
        const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
        await page.goto(popupUrl);
        
        // Enable debug mode
        const debugToggle = await page.$('#debugToggle');
        if (debugToggle) {
          await debugToggle.check();
          console.log('✅ Debug mode enabled');
        }
        
        // Set very short timeout (10 seconds for testing)
        const timeValue = await page.$('#timeValue');
        if (timeValue) {
          await timeValue.fill('10');
        }
        
        const timeUnit = await page.$('#timeUnit');
        if (timeUnit) {
          await timeUnit.selectOption('seconds');
        }
        
        // Save settings
        const saveButton = await page.$('#saveSettings');
        if (saveButton) {
          await saveButton.click();
          console.log('✅ Settings saved: 10 seconds timeout, debug mode enabled');
        }
        
        await page.waitForTimeout(2000);
        
        // Create a test tab
        const testTab = await this.browser.newPage();
        await testTab.goto('https://example.com');
        console.log('✅ Test tab created at example.com');
        
        // Switch back to the first page to make the test tab inactive
        await page.bringToFront();
        console.log('✅ Made test tab inactive');
        
        // Monitor for debug logs and tab title changes
        console.log('⏰ Monitoring for 20 seconds...');
        let tabClosed = false;
        
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(1000);
          
          try {
            const title = await testTab.title();
            console.log(`${i + 1}s: Tab title: "${title}"`);
            
            // Check if tab shows "CLOSING"
            if (title.includes('CLOSING')) {
              console.log('🔥 Found "CLOSING" in tab title!');
              
              // Wait a bit more to see if it actually closes
              await page.waitForTimeout(3000);
              
              try {
                const titleAfterClosing = await testTab.title();
                console.log(`❌ Tab still exists after showing "CLOSING": "${titleAfterClosing}"`);
                console.log('🐛 BUG CONFIRMED: Tab shows "CLOSING" but doesn\'t close');
              } catch (error) {
                console.log('✅ Tab was actually closed successfully');
                tabClosed = true;
                break;
              }
            }
          } catch (error) {
            console.log(`✅ Tab was closed at ${i + 1}s`);
            tabClosed = true;
            break;
          }
        }
        
        if (!tabClosed) {
          console.log('❌ Tab was never closed - potential bug');
        }
        
        // Check debug logs for errors
        const debugLogs = this.consoleLogs.filter(log => log.includes('🔤 [AutoCloseManager]'));
        if (debugLogs.length > 0) {
          console.log('📋 Debug logs captured:');
          debugLogs.forEach(log => console.log('  ', log));
        }
        
        const errorLogs = this.consoleLogs.filter(log => log.includes('Error') || log.includes('❌'));
        if (errorLogs.length > 0) {
          console.log('❌ Error logs found:');
          errorLogs.forEach(log => console.log('  ', log));
        }
        
      } else {
        console.log('❌ Could not find extension ID');
      }
    } catch (error) {
      console.log('❌ Test error:', error.message);
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
  const test = new TabClosingBugTest();
  
  try {
    await test.setup();
    await test.testTabClosingBug();
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await test.cleanup();
  }
}

runTest();