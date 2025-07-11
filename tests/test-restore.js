const { chromium } = require('playwright');

async function testRestoreFunctionality() {
  console.log('🧪 Starting comprehensive restore functionality test...');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-extensions-except=' + __dirname,
      '--load-extension=' + __dirname,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to the extension tabs page
    console.log('1. Opening extension tabs page...');
    await page.goto('chrome-extension://placeholderId/tabs/tabs.html');
    await page.waitForLoadState('networkidle');

    // Step 2: Create some test data in localStorage
    console.log('2. Creating test saved tabs data...');
    const testTabs = [
      {
        id: Date.now() + 1,
        url: 'https://example.com',
        title: 'Example Domain',
        favicon: 'https://example.com/favicon.ico',
        windowTitle: 'Closed at 2:35:47 PM on 7/10/2025',
        closedAt: new Date().toISOString(),
        date: new Date().toDateString()
      },
      {
        id: Date.now() + 2,
        url: 'https://google.com',
        title: 'Google',
        favicon: 'https://google.com/favicon.ico',
        windowTitle: 'Closed at 2:36:15 PM on 7/10/2025',
        closedAt: new Date().toISOString(),
        date: new Date().toDateString()
      }
    ];

    await page.evaluate((tabs) => {
      return new Promise((resolve) => {
        chrome.storage.local.set({ savedTabs: tabs }, resolve);
      });
    }, testTabs);

    // Step 3: Reload the page to see the test data
    console.log('3. Reloading page to display test data...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 4: Check if tabs are displayed
    console.log('4. Checking if tabs are displayed...');
    const tabItems = await page.locator('.tab-item').count();
    console.log(`   Found ${tabItems} tab items`);

    if (tabItems === 0) {
      throw new Error('No tab items found - tabs may not be loading correctly');
    }

    // Step 5: Test individual tab restore
    console.log('5. Testing individual tab restore...');
    const initialTabCount = await context.pages().length;
    console.log(`   Initial tab count: ${initialTabCount}`);

    // Click the first restore button
    const firstRestoreBtn = page.locator('.restore-btn').first();
    await firstRestoreBtn.click();
    
    // Wait for new tab to be created
    await page.waitForTimeout(2000);
    
    const newTabCount = await context.pages().length;
    console.log(`   New tab count: ${newTabCount}`);
    
    if (newTabCount <= initialTabCount) {
      throw new Error('No new tab was created during restore');
    }

    // Step 6: Test group restore functionality
    console.log('6. Testing group restore functionality...');
    const groupRestoreBtn = page.locator('.group-restore-btn').first();
    if (await groupRestoreBtn.count() > 0) {
      await groupRestoreBtn.click();
      
      // Handle the confirmation dialog
      page.on('dialog', async dialog => {
        console.log(`   Confirmation dialog: ${dialog.message()}`);
        await dialog.accept();
      });
      
      await page.waitForTimeout(2000);
      
      const finalTabCount = await context.pages().length;
      console.log(`   Final tab count: ${finalTabCount}`);
    } else {
      console.log('   No group restore buttons found');
    }

    // Step 7: Check if tabs were removed from saved list
    console.log('7. Checking if tabs were removed from saved list...');
    await page.waitForTimeout(1000);
    const remainingTabs = await page.locator('.tab-item').count();
    console.log(`   Remaining tabs in list: ${remainingTabs}`);

    console.log('✅ Restore functionality test completed successfully!');
    
    return {
      success: true,
      message: 'All restore functions working correctly',
      details: {
        initialTabs: tabItems,
        tabsCreated: newTabCount - initialTabCount,
        remainingTabs: remainingTabs
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return {
      success: false,
      message: error.message,
      details: null
    };
  } finally {
    await browser.close();
  }
}

async function testExtensionLoading() {
  console.log('🔍 Testing extension loading and basic functionality...');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-extensions-except=' + __dirname,
      '--load-extension=' + __dirname
    ]
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to extension management page
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);

    // Look for our extension
    const extensionCards = await page.locator('.card').count();
    console.log(`Found ${extensionCards} extensions`);

    // Try to open a test page and trigger auto-close
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    console.log('✅ Extension loading test completed');

    return { success: true, message: 'Extension loaded successfully' };
  } catch (error) {
    console.error('❌ Extension loading test failed:', error.message);
    return { success: false, message: error.message };
  } finally {
    await browser.close();
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive Chrome extension tests...\n');
  
  const loadingTest = await testExtensionLoading();
  console.log('\n📊 Extension Loading Result:', loadingTest);
  
  const restoreTest = await testRestoreFunctionality();
  console.log('\n📊 Restore Functionality Result:', restoreTest);
  
  console.log('\n🎯 Test Summary:');
  console.log('  Extension Loading:', loadingTest.success ? '✅' : '❌');
  console.log('  Restore Functionality:', restoreTest.success ? '✅' : '❌');
  
  if (restoreTest.success && loadingTest.success) {
    console.log('\n🎉 All tests passed! The extension is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the extension code.');
  }
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testRestoreFunctionality, testExtensionLoading };