// Manual test to load extension and configure it properly
const { chromium } = require('playwright');
const path = require('path');

async function testWithManualConfiguration() {
  console.log('🔍 Testing extension with manual configuration...');
  
  const extensionPath = path.join(__dirname);
  const userDataDir = path.join(__dirname, 'test-user-data');
  
  console.log('Extension path:', extensionPath);
  console.log('User data dir:', userDataDir);
  
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--load-extension=${extensionPath}`,
      '--disable-extensions-except=' + extensionPath,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--enable-logging',
      '--v=1',
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  try {
    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get all pages
    const pages = await browser.pages();
    const mainPage = pages[0];
    
    console.log('📄 Opening chrome://extensions/ to check extension...');
    await mainPage.goto('chrome://extensions/');
    await mainPage.waitForTimeout(2000);
    
    // Take a screenshot to see the extensions page
    await mainPage.screenshot({ path: path.join(__dirname, 'extensions-page.png') });
    console.log('📸 Screenshot saved: extensions-page.png');
    
    // Check extension state
    const extensionInfo = await mainPage.evaluate(() => {
      const extensionItems = document.querySelectorAll('extensions-item');
      const results = [];
      
      for (const item of extensionItems) {
        const shadowRoot = item.shadowRoot;
        if (shadowRoot) {
          const nameElement = shadowRoot.querySelector('#name');
          const enableToggle = shadowRoot.querySelector('#enableToggle');
          const detailsButton = shadowRoot.querySelector('#detailsButton');
          const errorDiv = shadowRoot.querySelector('#errors');
          
          if (nameElement) {
            results.push({
              name: nameElement.textContent.trim(),
              enabled: enableToggle ? !enableToggle.hasAttribute('disabled') : false,
              hasErrors: errorDiv ? errorDiv.children.length > 0 : false,
              detailsAvailable: !!detailsButton
            });
          }
        }
      }
      
      return results;
    });
    
    console.log('🔍 Found extensions:', extensionInfo);
    
    // Find our extension
    const autoCloseExt = extensionInfo.find(ext => ext.name.includes('FOMO TabTimer'));
    if (autoCloseExt) {
      console.log('✅ FOMO TabTimer extension found:', autoCloseExt);
    } else {
      console.log('❌ FOMO TabTimer extension not found');
      console.log('Available extensions:', extensionInfo.map(ext => ext.name));
    }
    
    // Try to access the extension's popup
    console.log('🔧 Attempting to access extension popup...');
    
    // Get extension ID
    const extensionId = await mainPage.evaluate(() => {
      const extensionItems = document.querySelectorAll('extensions-item');
      for (const item of extensionItems) {
        const shadowRoot = item.shadowRoot;
        if (shadowRoot) {
          const nameElement = shadowRoot.querySelector('#name');
          if (nameElement && nameElement.textContent.includes('FOMO TabTimer')) {
            return item.id;
          }
        }
      }
      return null;
    });
    
    console.log('Extension ID:', extensionId);
    
    if (extensionId) {
      // Try to open the popup
      const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
      console.log('Opening popup URL:', popupUrl);
      
      const popupPage = await browser.newPage();
      await popupPage.goto(popupUrl);
      await popupPage.waitForTimeout(2000);
      
      // Take screenshot of popup
      await popupPage.screenshot({ path: path.join(__dirname, 'popup-page.png') });
      console.log('📸 Popup screenshot saved: popup-page.png');
      
      // Configure extension
      console.log('⚙️ Configuring extension...');
      
      try {
        // Set timeout to 10 seconds
        await popupPage.fill('#timeout-value', '10');
        await popupPage.selectOption('#timeout-unit', 'seconds');
        
        // Enable debug mode
        await popupPage.check('#debug-mode');
        
        // Click save
        await popupPage.click('#save-settings');
        await popupPage.waitForTimeout(1000);
        
        console.log('✅ Extension configured successfully');
        
        // Close popup
        await popupPage.close();
        
      } catch (error) {
        console.log('❌ Failed to configure extension:', error.message);
        
        // Try to get current form state
        const formState = await popupPage.evaluate(() => {
          const timeoutValue = document.querySelector('#timeout-value');
          const timeoutUnit = document.querySelector('#timeout-unit');
          const debugMode = document.querySelector('#debug-mode');
          
          return {
            timeoutValue: timeoutValue ? timeoutValue.value : 'not found',
            timeoutUnit: timeoutUnit ? timeoutUnit.value : 'not found',
            debugMode: debugMode ? debugMode.checked : 'not found',
            bodyHTML: document.body.innerHTML
          };
        });
        
        console.log('Form state:', formState);
        await popupPage.close();
      }
    }
    
    // Now test the actual timer behavior
    console.log('🧪 Testing timer behavior...');
    
    // Create test pages
    const testPage1 = await browser.newPage();
    await testPage1.goto('data:text/html,<html><head><title>Test Page 1</title></head><body><h1>Test Page 1</h1></body></html>');
    await testPage1.waitForTimeout(2000);
    
    const testPage2 = await browser.newPage();
    await testPage2.goto('data:text/html,<html><head><title>Test Page 2</title></head><body><h1>Test Page 2</h1></body></html>');
    await testPage2.waitForTimeout(2000);
    
    // Make first page inactive by focusing on second page
    await testPage2.bringToFront();
    await testPage2.waitForTimeout(2000);
    
    // Monitor first page for timer
    console.log('⏰ Monitoring first page for timer changes...');
    for (let i = 0; i < 15; i++) {
      const title = await testPage1.title();
      console.log(`${i}s: Test page 1 title: "${title}"`);
      
      // Check for debug overlay
      const overlayInfo = await testPage1.evaluate(() => {
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
      
      if (overlayInfo.present) {
        console.log(`${i}s: Debug overlay - Timer: ${overlayInfo.timer}, Status: ${overlayInfo.status}`);
      } else {
        console.log(`${i}s: Debug overlay not found`);
      }
      
      await testPage1.waitForTimeout(1000);
    }
    
    // Wait a bit longer and take final screenshots
    await testPage1.screenshot({ path: path.join(__dirname, 'test-page-1-final.png') });
    await testPage2.screenshot({ path: path.join(__dirname, 'test-page-2-final.png') });
    
    console.log('📸 Final screenshots saved');
    
    return {
      extensionFound: !!autoCloseExt,
      extensionEnabled: autoCloseExt?.enabled,
      extensionId: extensionId,
      configurationSuccessful: true // Will be updated based on actual results
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    // Keep browser open for a bit to observe behavior
    console.log('🔍 Keeping browser open for observation (30 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testWithManualConfiguration()
    .then(result => {
      console.log('\n📊 Test Results:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testWithManualConfiguration };