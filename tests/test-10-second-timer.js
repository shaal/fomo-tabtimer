// Test with 10 second timer to reproduce the "closing" bug
const { chromium } = require('playwright');
const path = require('path');

class TenSecondTimerTest {
  constructor() {
    this.browser = null;
    this.extensionPath = path.dirname(__dirname);
    this.consoleLogs = [];
  }

  async setup() {
    console.log('🚀 Setting up Chrome Extension Test with 10 second timer...');
    
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

  async testTenSecondTimer() {
    console.log('🧪 Testing 10 second timer with closing bug reproduction...');
    
    // Create a new page to capture console logs
    const page = await this.browser.newPage();
    
    // Capture console logs
    page.on('console', msg => {
      const text = msg.text();
      console.log(`📋 Console: ${text}`);
      this.consoleLogs.push(text);
    });

    try {
      const extensionId = await this.getExtensionId();
      if (!extensionId) {
        throw new Error('Extension ID not found');
      }

      console.log('✅ Extension ID found:', extensionId);

      // Configure extension with 10 second timeout and debug mode
      await this.configureExtension(page, extensionId);

      // Create test tab
      const testTab = await this.browser.newPage();
      await testTab.goto('https://example.com');
      console.log('✅ Test tab created at example.com');

      // Switch back to main page to make test tab inactive
      await page.bringToFront();
      console.log('✅ Made test tab inactive');

      // Monitor tab for 15 seconds
      await this.monitorTab(page, testTab, extensionId);

      // Check for debug logs
      this.analyzeDebugLogs();

    } catch (error) {
      console.log('❌ Test error:', error.message);
    }
  }

  async configureExtension(page, extensionId) {
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
    await page.goto(popupUrl);

    // Enable debug mode
    const debugToggle = await page.$('#debugToggle');
    if (debugToggle) {
      await debugToggle.check();
      console.log('✅ Debug mode enabled');
    }

    // Set 10 second timeout
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
  }

  async monitorTab(page, testTab, extensionId) {
    console.log('⏰ Monitoring tab for 15 seconds...');
    
    let tabClosed = false;
    let showedClosing = false;

    // Also monitor the debug dashboard
    const dashboardUrl = `chrome-extension://${extensionId}/debug/debug-dashboard.html`;
    const dashboardPage = await this.browser.newPage();
    await dashboardPage.goto(dashboardUrl);
    console.log('✅ Debug dashboard opened');

    for (let i = 0; i < 15; i++) {
      await page.waitForTimeout(1000);
      
      try {
        // Check tab title
        const title = await testTab.title();
        console.log(`${i + 1}s: Tab title: "${title}"`);
        
        // Check if tab shows "CLOSING"
        if (title.includes('CLOSING')) {
          console.log(`🔥 FOUND "CLOSING" at ${i + 1}s!`);
          showedClosing = true;
          
          // Check debug dashboard for this tab
          await dashboardPage.reload();
          const dashboardContent = await dashboardPage.content();
          if (dashboardContent.includes('example.com')) {
            console.log('📊 Tab still visible in debug dashboard');
          }
        }
        
        // Check if tab is still accessible
        await testTab.evaluate(() => document.title);
        
      } catch (error) {
        console.log(`✅ Tab was closed at ${i + 1}s`);
        tabClosed = true;
        break;
      }
    }

    if (showedClosing && !tabClosed) {
      console.log('🐛 BUG CONFIRMED: Tab showed "CLOSING" but was never actually closed!');
    } else if (tabClosed) {
      console.log('✅ Tab was properly closed');
    } else {
      console.log('⚠️ Tab never showed "CLOSING" - may be a different issue');
    }
  }

  analyzeDebugLogs() {
    console.log('\n📋 Analyzing debug logs...');
    
    const debugLogs = this.consoleLogs.filter(log => log.includes('🔤 [AutoCloseManager]'));
    const errorLogs = this.consoleLogs.filter(log => log.includes('Error') || log.includes('❌'));
    const closingLogs = this.consoleLogs.filter(log => log.includes('Closing tab') || log.includes('closeAndSaveTab'));

    console.log(`📊 Debug logs captured: ${debugLogs.length}`);
    console.log(`❌ Error logs found: ${errorLogs.length}`);
    console.log(`🗑️ Closing logs found: ${closingLogs.length}`);

    if (debugLogs.length > 0) {
      console.log('\n🔍 Debug logs:');
      debugLogs.slice(-5).forEach(log => console.log('  ', log));
    }

    if (errorLogs.length > 0) {
      console.log('\n❌ Error logs:');
      errorLogs.forEach(log => console.log('  ', log));
    }

    if (closingLogs.length > 0) {
      console.log('\n🗑️ Closing logs:');
      closingLogs.forEach(log => console.log('  ', log));
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
  const test = new TenSecondTimerTest();
  
  try {
    await test.setup();
    await test.testTenSecondTimer();
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  } finally {
    await test.cleanup();
  }
}

runTest();