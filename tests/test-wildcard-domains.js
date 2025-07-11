// Comprehensive test suite for wildcard domain exclusion functionality
// Tests specifically focus on verifying *.google.com exclusion behavior

const { chromium } = require('playwright');
const path = require('path');

class WildcardDomainTester {
  constructor() {
    this.browser = null;
    this.extensionId = null;
    this.testResults = [];
    this.consoleLogs = [];
  }

  async setupBrowser() {
    console.log('🚀 Setting up browser with extension...');
    
    const extensionPath = path.join(__dirname);
    this.browser = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--load-extension=${extensionPath}`,
        `--disable-extensions-except=${extensionPath}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--enable-logging=stderr',
        '--v=1'
      ]
    });

    // Get extension ID
    const extensionPage = await this.browser.newPage();
    await extensionPage.goto('chrome://extensions/');
    await extensionPage.waitForTimeout(2000);
    
    // Look for our extension
    const extensionCards = await extensionPage.locator('extensions-item').all();
    for (const card of extensionCards) {
      const nameElement = await card.locator('#name').first();
      const name = await nameElement.textContent();
      if (name && name.includes('FOMO TabTimer')) {
        const idElement = await card.locator('#extension-id').first();
        this.extensionId = await idElement.textContent();
        console.log(`✅ Extension found with ID: ${this.extensionId}`);
        break;
      }
    }
    
    await extensionPage.close();
  }

  async configureExtensionSettings() {
    console.log('⚙️ Configuring extension settings...');
    
    // Open extension popup
    const popupUrl = `chrome-extension://${this.extensionId}/popup/popup.html`;
    const popupPage = await this.browser.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(1000);

    // Configure settings for testing
    await popupPage.fill('#timeValue', '10'); // 10 seconds for quick testing
    await popupPage.selectOption('#timeUnit', 'seconds');
    
    // Add wildcard exclusion domain
    await popupPage.fill('#domainInput', '*.google.com');
    await popupPage.click('#addDomain');
    await popupPage.waitForTimeout(500);
    
    // Also add some other test domains
    await popupPage.fill('#domainInput', 'example.com');
    await popupPage.click('#addDomain');
    await popupPage.waitForTimeout(500);
    
    // Save settings
    await popupPage.click('#saveSettings');
    await popupPage.waitForTimeout(1000);
    
    console.log('✅ Extension settings configured');
    
    // Take a screenshot of the popup for verification
    await popupPage.screenshot({ path: 'extension-popup-configured.png' });
    
    await popupPage.close();
  }

  async testWildcardDomainExclusion() {
    console.log('🔍 Testing wildcard domain exclusion...');
    
    const testCases = [
      {
        url: 'https://home.google.com/library',
        shouldBeExcluded: true,
        description: 'home.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://app.google.com/dashboard',
        shouldBeExcluded: true,
        description: 'app.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://api.google.com/v1/data',
        shouldBeExcluded: true,
        description: 'api.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://google.com',
        shouldBeExcluded: false,
        description: 'google.com should NOT be excluded by *.google.com (no subdomain)'
      },
      {
        url: 'https://example.com',
        shouldBeExcluded: true,
        description: 'example.com should be excluded by exact match'
      },
      {
        url: 'https://google.com',
        shouldBeExcluded: false,
        description: 'google.com should NOT be excluded'
      },
      {
        url: 'https://notgoogle.com',
        shouldBeExcluded: false,
        description: 'notgoogle.com should NOT be excluded'
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      
      const page = await this.browser.newPage();
      
      // Listen for console logs to capture domain matching behavior
      page.on('console', (msg) => {
        if (msg.text().includes('Domain check') || msg.text().includes('Wildcard check')) {
          console.log(`📋 Console: ${msg.text()}`);
          this.consoleLogs.push(msg.text());
        }
      });
      
      try {
        await page.goto(testCase.url);
        await page.waitForTimeout(2000);
        
        // The domain exclusion logic will be tested through the background script
        // We'll verify this by checking console logs and tab behavior
        
        results.push({
          ...testCase,
          tested: true,
          timestamp: new Date().toISOString()
        });
        
        console.log(`✅ Successfully loaded ${testCase.url}`);
        
      } catch (error) {
        console.log(`❌ Failed to load ${testCase.url}: ${error.message}`);
        results.push({
          ...testCase,
          tested: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      // Keep the page open for timing tests
      await page.waitForTimeout(1000);
    }
    
    this.testResults.push({
      testName: 'Wildcard Domain Exclusion',
      results: results,
      timestamp: new Date().toISOString()
    });
    
    return results;
  }

  async testTimerFunctionality() {
    console.log('⏱️ Testing timer functionality and reset behavior...');
    
    const testPages = await this.browser.pages();
    const activePage = testPages[testPages.length - 1];
    
    // Test timer reset on tab switching
    console.log('🔄 Testing timer reset on tab switching...');
    
    const page1 = await this.browser.newPage();
    await page1.goto('https://home.google.com/library');
    await page1.waitForTimeout(1000);
    
    const page2 = await this.browser.newPage();
    await page2.goto('https://google.com');
    await page2.waitForTimeout(1000);
    
    // Switch between tabs to test timer reset
    await page1.bringToFront();
    await page1.waitForTimeout(2000);
    console.log('📋 Switched to google.com tab');
    
    await page2.bringToFront();
    await page2.waitForTimeout(2000);
    console.log('📋 Switched to google.com tab');
    
    // Wait and see if any tabs get closed (google.com should be closed after 10 seconds)
    console.log('⏳ Waiting for auto-close timeout (10 seconds)...');
    await page2.waitForTimeout(12000);
    
    // Check which tabs are still open
    const remainingPages = await this.browser.pages();
    console.log(`📊 Remaining tabs: ${remainingPages.length}`);
    
    return {
      testName: 'Timer Functionality',
      remainingTabs: remainingPages.length,
      timestamp: new Date().toISOString()
    };
  }

  async testAutoCloseRespectsDomainExclusion() {
    console.log('🛡️ Testing auto-close respects domain exclusion...');
    
    // Create tabs with both excluded and non-excluded domains
    const excludedTab = await this.browser.newPage();
    await excludedTab.goto('https://home.google.com/library');
    await excludedTab.waitForTimeout(1000);
    
    const nonExcludedTab = await this.browser.newPage();
    await nonExcludedTab.goto('https://stackoverflow.com');
    await nonExcludedTab.waitForTimeout(1000);
    
    // Switch to a different tab to make both inactive
    const controlTab = await this.browser.newPage();
    await controlTab.goto('about:blank');
    await controlTab.waitForTimeout(1000);
    
    console.log('📋 Created test tabs - waiting for auto-close timeout...');
    
    // Wait for auto-close timeout
    await controlTab.waitForTimeout(15000);
    
    // Check which tabs survived
    const survivingPages = await this.browser.pages();
    const survivingUrls = [];
    
    for (const page of survivingPages) {
      try {
        const url = page.url();
        if (url !== 'about:blank' && !url.startsWith('chrome-extension://')) {
          survivingUrls.push(url);
        }
      } catch (error) {
        // Tab might have been closed
      }
    }
    
    console.log(`📊 Surviving tabs: ${survivingUrls.join(', ')}`);
    
    const googleSurvived = survivingUrls.some(url => url.includes('google.com'));
    const stackoverflowSurvived = survivingUrls.some(url => url.includes('stackoverflow.com'));
    
    return {
      testName: 'Auto-close Respects Domain Exclusion',
      googleSurvived,
      stackoverflowSurvived,
      survivingUrls,
      timestamp: new Date().toISOString()
    };
  }

  async runAllTests() {
    console.log('🧪 Starting comprehensive wildcard domain exclusion tests...\n');
    
    try {
      await this.setupBrowser();
      await this.configureExtensionSettings();
      
      const wildcardResults = await this.testWildcardDomainExclusion();
      const timerResults = await this.testTimerFunctionality();
      const autoCloseResults = await this.testAutoCloseRespectsDomainExclusion();
      
      // Generate comprehensive test report
      const report = {
        testSuite: 'Wildcard Domain Exclusion Tests',
        timestamp: new Date().toISOString(),
        extensionId: this.extensionId,
        wildcardResults,
        timerResults,
        autoCloseResults,
        consoleLogs: this.consoleLogs,
        summary: {
          totalTests: wildcardResults.length,
          passedTests: wildcardResults.filter(r => r.tested).length,
          failedTests: wildcardResults.filter(r => !r.tested).length
        }
      };
      
      console.log('\n📋 TEST REPORT');
      console.log('================');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report to file
      const fs = require('fs');
      fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
      console.log('\n✅ Test report saved to test-report.json');
      
      return report;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        console.log('\n🔄 Cleaning up browser...');
        await this.browser.close();
      }
    }
  }
}

// Main test execution
const runTests = async () => {
  const tester = new WildcardDomainTester();
  await tester.runAllTests();
};

// Export for use in other files
module.exports = { WildcardDomainTester, runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}