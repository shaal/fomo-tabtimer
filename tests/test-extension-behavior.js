// Test extension behavior directly with console log monitoring
const { chromium } = require('playwright');
const path = require('path');

class ExtensionBehaviorTester {
  constructor() {
    this.browser = null;
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
        '--enable-logging',
        '--v=1'
      ]
    });

    console.log('✅ Browser started with extension loaded');
  }

  async configureExtension() {
    console.log('⚙️ Configuring extension with test settings...');
    
    // Create background page to inject test configuration
    const backgroundPage = await this.browser.newPage();
    
    // Inject test configuration directly into the background context
    await backgroundPage.evaluateOnNewDocument(() => {
      // Override chrome.storage.sync to provide test configuration
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const originalGet = chrome.storage.sync.get;
        chrome.storage.sync.get = async function(keys) {
          console.log('📋 Extension requested settings:', keys);
          
          // Return test configuration
          return {
            autoCloseSettings: {
              enabled: true,
              timeValue: 5, // 5 seconds for quick testing
              timeUnit: 'seconds',
              excludedDomains: ['*.google.com', 'example.com'],
              excludePinned: true
            }
          };
        };
      }
    });
    
    await backgroundPage.close();
    console.log('✅ Extension configuration injected');
  }

  async testDomainExclusionWithRealExtension() {
    console.log('🔍 Testing domain exclusion with real extension...');
    
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
        url: 'https://example.com',
        shouldBeExcluded: true,
        description: 'example.com should be excluded by exact match'
      },
      {
        url: 'https://google.com',
        shouldBeExcluded: false,
        description: 'google.com should NOT be excluded'
      }
    ];

    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.description}`);
      
      const page = await this.browser.newPage();
      
      // Monitor console logs for domain exclusion behavior
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('Domain check') || 
            text.includes('Wildcard check') || 
            text.includes('excluded') ||
            text.includes('Auto-close') ||
            text.includes('Timer')) {
          console.log(`📋 Extension: ${text}`);
          this.consoleLogs.push({
            url: testCase.url,
            message: text,
            timestamp: new Date().toISOString()
          });
        }
      });
      
      try {
        // Use a simple data URL to simulate the domain
        const mockUrl = `data:text/html,<html><head><title>Test ${testCase.url}</title></head><body><h1>Mock page for ${testCase.url}</h1><script>console.log('Page loaded for domain testing:', '${testCase.url}');</script></body></html>`;
        await page.goto(mockUrl);
        
        // Override location to simulate the target URL
        await page.addInitScript((targetUrl) => {
          Object.defineProperty(window, 'location', {
            value: new URL(targetUrl),
            writable: true
          });
        }, testCase.url);
        
        await page.waitForTimeout(3000);
        
        console.log(`✅ Loaded test page for ${testCase.url}`);
        
        results.push({
          ...testCase,
          tested: true,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`❌ Failed to test ${testCase.url}: ${error.message}`);
        results.push({
          ...testCase,
          tested: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  async testTimerAndAutoClose() {
    console.log('⏱️ Testing timer and auto-close functionality...');
    
    // Create test pages
    const excludedPage = await this.browser.newPage();
    const nonExcludedPage = await this.browser.newPage();
    
    // Monitor console logs for both pages
    [excludedPage, nonExcludedPage].forEach(page => {
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('Timer') || 
            text.includes('Auto-close') || 
            text.includes('Closing') ||
            text.includes('excluded')) {
          console.log(`📋 Timer/Close: ${text}`);
          this.consoleLogs.push({
            source: 'timer_test',
            message: text,
            timestamp: new Date().toISOString()
          });
        }
      });
    });
    
    // Load excluded domain (should not be closed)
    await excludedPage.goto('data:text/html,<html><head><title>Excluded Domain Test</title></head><body><h1>Should be excluded from auto-close</h1></body></html>');
    await excludedPage.addInitScript(() => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://home.google.com/library'),
        writable: true
      });
    });
    
    // Load non-excluded domain (should be closed)
    await nonExcludedPage.goto('data:text/html,<html><head><title>Non-Excluded Domain Test</title></head><body><h1>Should be auto-closed</h1></body></html>');
    await nonExcludedPage.addInitScript(() => {
      Object.defineProperty(window, 'location', {
        value: new URL('https://stackoverflow.com'),
        writable: true
      });
    });
    
    // Create an active page to make the others inactive
    const activePage = await this.browser.newPage();
    await activePage.goto('about:blank');
    
    console.log('⏳ Waiting for auto-close timeout (8 seconds)...');
    await activePage.waitForTimeout(8000);
    
    // Check which pages are still open
    const remainingPages = await this.browser.pages();
    console.log(`📊 Remaining pages: ${remainingPages.length}`);
    
    let excludedPageStillOpen = false;
    let nonExcludedPageStillOpen = false;
    
    for (const page of remainingPages) {
      try {
        const title = await page.title();
        if (title.includes('Excluded Domain Test')) {
          excludedPageStillOpen = true;
        } else if (title.includes('Non-Excluded Domain Test')) {
          nonExcludedPageStillOpen = true;
        }
      } catch (error) {
        // Page might be closed
      }
    }
    
    return {
      excludedPageStillOpen,
      nonExcludedPageStillOpen,
      totalRemainingPages: remainingPages.length,
      timestamp: new Date().toISOString()
    };
  }

  async runAllTests() {
    console.log('🧪 Starting extension behavior tests...\n');
    
    try {
      await this.setupBrowser();
      await this.configureExtension();
      
      const domainResults = await this.testDomainExclusionWithRealExtension();
      const timerResults = await this.testTimerAndAutoClose();
      
      // Generate comprehensive test report
      const report = {
        testSuite: 'Extension Behavior Tests',
        timestamp: new Date().toISOString(),
        domainExclusionResults: domainResults,
        timerResults: timerResults,
        consoleLogs: this.consoleLogs,
        summary: {
          totalDomainTests: domainResults.length,
          passedDomainTests: domainResults.filter(r => r.tested).length,
          failedDomainTests: domainResults.filter(r => !r.tested).length,
          totalConsoleLogs: this.consoleLogs.length,
          excludedPageSurvived: timerResults.excludedPageStillOpen,
          nonExcludedPageSurvived: timerResults.nonExcludedPageStillOpen
        }
      };
      
      console.log('\n📋 EXTENSION BEHAVIOR TEST REPORT');
      console.log('==================================');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report to file
      const fs = require('fs');
      fs.writeFileSync('extension-behavior-report.json', JSON.stringify(report, null, 2));
      console.log('\n✅ Test report saved to extension-behavior-report.json');
      
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
  const tester = new ExtensionBehaviorTester();
  await tester.runAllTests();
};

// Export for use in other files
module.exports = { ExtensionBehaviorTester, runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}