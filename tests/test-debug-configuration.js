// Test to verify extension configuration and debug mode
const { chromium } = require('playwright');
const path = require('path');

async function testExtensionConfiguration() {
  console.log('🔍 Testing extension configuration and debug mode...');
  
  const extensionPath = path.join(__dirname);
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--load-extension=${extensionPath}`,
      '--disable-extensions-except=' + extensionPath,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--enable-logging',
      '--v=1'
    ]
  });

  try {
    // Get the extension page to check for background script
    const page = await browser.newPage();
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Check if extension is loaded
    const extensionInfo = await page.evaluate(() => {
      const extensionElements = document.querySelectorAll('extensions-item');
      for (const element of extensionElements) {
        const shadowRoot = element.shadowRoot;
        if (shadowRoot && shadowRoot.textContent.includes('FOMO TabTimer')) {
          return {
            found: true,
            name: shadowRoot.querySelector('#name').textContent,
            enabled: !shadowRoot.querySelector('#enableToggle').hasAttribute('disabled')
          };
        }
      }
      return { found: false };
    });
    
    console.log('Extension info:', extensionInfo);
    
    // Configure extension via storage
    console.log('🔧 Configuring extension via storage...');
    await page.evaluate(() => {
      chrome.storage.sync.set({
        autoCloseSettings: {
          enabled: true,
          timeValue: 10,
          timeUnit: 'seconds',
          excludedDomains: [],
          excludePinned: true,
          debugMode: true
        }
      });
      console.log('Extension settings configured');
    });
    
    await page.waitForTimeout(2000);
    
    // Create a test page and monitor it
    console.log('📄 Creating test page and monitoring debug behavior...');
    const testPage = await browser.newPage();
    await testPage.goto('data:text/html,<html><head><title>Debug Test Page</title></head><body><h1>Debug Test</h1></body></html>');
    await testPage.waitForTimeout(2000);
    
    // Check for debug overlay
    const hasOverlay = await testPage.evaluate(() => {
      return document.querySelector('#auto-close-debug-overlay') !== null;
    });
    
    console.log('Debug overlay present:', hasOverlay);
    
    // Check console logs for debug messages
    testPage.on('console', msg => {
      console.log(`🐛 Console (${msg.type()}): ${msg.text()}`);
    });
    
    // Create second page to make first one inactive
    console.log('📄 Creating second page to make first one inactive...');
    const secondPage = await browser.newPage();
    await secondPage.goto('data:text/html,<html><head><title>Second Test Page</title></head><body><h1>Second Test</h1></body></html>');
    await secondPage.waitForTimeout(2000);
    
    // Monitor first page title changes
    console.log('⏰ Monitoring first page for timer changes...');
    for (let i = 0; i < 15; i++) {
      const title = await testPage.title();
      console.log(`${i}s: First page title: "${title}"`);
      
      // Check if debug overlay is showing timer
      const overlayInfo = await testPage.evaluate(() => {
        const overlay = document.querySelector('#auto-close-debug-overlay');
        if (overlay) {
          const timerElement = overlay.querySelector('#debug-timer');
          const statusElement = overlay.querySelector('#debug-status');
          return {
            present: true,
            timer: timerElement ? timerElement.textContent : 'not found',
            status: statusElement ? statusElement.textContent : 'not found'
          };
        }
        return { present: false };
      });
      
      console.log(`${i}s: Debug overlay:`, overlayInfo);
      
      await testPage.waitForTimeout(1000);
    }
    
    return {
      extensionLoaded: extensionInfo.found,
      extensionEnabled: extensionInfo.enabled,
      debugOverlayPresent: hasOverlay,
      timerWorking: false // Will be determined by the test
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testExtensionConfiguration()
    .then(result => {
      console.log('\n📊 Test Results:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testExtensionConfiguration };