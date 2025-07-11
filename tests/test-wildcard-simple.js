// Simplified test for wildcard domain exclusion functionality
// Focus on testing the core functionality without relying on chrome://extensions

const { chromium } = require('playwright');
const path = require('path');

class SimpleDomainTester {
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
        '--enable-logging=stderr',
        '--v=1'
      ]
    });

    console.log('✅ Browser started with extension loaded');
    return this.browser;
  }

  async configureExtensionForTesting() {
    console.log('⚙️ Configuring extension for testing...');
    
    // Create a page to interact with the extension
    const page = await this.browser.newPage();
    
    // Try to access extension popup directly
    try {
      // First, get a list of all extension pages
      const extensionPages = await this.browser.pages();
      console.log(`📋 Found ${extensionPages.length} pages`);
      
      // Look for extension popup or create one
      await page.goto('chrome://extensions/');
      await page.waitForTimeout(2000);
      
      // Enable developer mode first
      try {
        await page.click('#devMode');
        await page.waitForTimeout(1000);
        console.log('✅ Developer mode enabled');
      } catch (error) {
        console.log('ℹ️ Developer mode was already enabled or not found');
      }
      
      await page.close();
      
    } catch (error) {
      console.log('⚠️ Could not configure extension directly:', error.message);
    }
  }

  async testDomainExclusionLogic() {
    console.log('🔍 Testing domain exclusion logic directly...');
    
    // Test cases for wildcard domain exclusion
    const testCases = [
      {
        url: 'https://home.google.com/library',
        domain: 'home.google.com',
        pattern: '*.google.com',
        shouldMatch: true,
        description: 'home.google.com should match *.google.com'
      },
      {
        url: 'https://app.google.com/dashboard',
        domain: 'app.google.com',
        pattern: '*.google.com',
        shouldMatch: true,
        description: 'app.google.com should match *.google.com'
      },
      {
        url: 'https://google.com',
        domain: 'google.com',
        pattern: '*.google.com',
        shouldMatch: false,
        description: 'google.com should NOT match *.google.com (no subdomain)'
      },
      {
        url: 'https://test.google.com.evil.com',
        domain: 'test.google.com.evil.com',
        pattern: '*.google.com',
        shouldMatch: false,
        description: 'test.google.com.evil.com should NOT match *.google.com'
      },
      {
        url: 'https://google.com',
        domain: 'google.com',
        pattern: '*.google.com',
        shouldMatch: false,
        description: 'google.com should NOT match *.google.com'
      }
    ];

    // Test the wildcard logic manually
    const escapeRegex = (string) => {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    const testWildcardPattern = (domain, pattern) => {
      if (pattern.includes('*')) {
        let regexPattern;
        if (pattern.startsWith('*.')) {
          // *.example.com should match subdomains of example.com
          const baseDomain = pattern.substring(2); // Remove "*."
          regexPattern = `^[^.]+\\.${escapeRegex(baseDomain)}$`;
        } else if (pattern.endsWith('.*')) {
          // example.* should match any TLD
          const baseDomain = pattern.substring(0, pattern.length - 2); // Remove ".*"
          regexPattern = `^${escapeRegex(baseDomain)}\\.[^.]+$`;
        } else {
          // General wildcard replacement
          regexPattern = escapeRegex(pattern).replace(/\\\*/g, '.*');
        }
        
        const regex = new RegExp(regexPattern);
        return regex.test(domain);
      }
      
      // Exact match or subdomain match
      return domain === pattern || domain.endsWith('.' + pattern);
    };

    const results = [];
    
    console.log('\n🧪 Testing wildcard pattern matching:');
    console.log('=====================================');
    
    for (const testCase of testCases) {
      const actualResult = testWildcardPattern(testCase.domain, testCase.pattern);
      const passed = actualResult === testCase.shouldMatch;
      
      console.log(`\n📝 ${testCase.description}`);
      console.log(`   Domain: ${testCase.domain}`);
      console.log(`   Pattern: ${testCase.pattern}`);
      console.log(`   Expected: ${testCase.shouldMatch}`);
      console.log(`   Actual: ${actualResult}`);
      console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
      
      results.push({
        ...testCase,
        actualResult,
        passed,
        timestamp: new Date().toISOString()
      });
    }
    
    return results;
  }

  async testWithRealPages() {
    console.log('\n🌐 Testing with real pages and extension behavior...');
    
    const testUrls = [
      'https://example.com',
      'https://httpbin.org/html',
      'https://jsonplaceholder.typicode.com/posts/1',
      `file://${path.join(__dirname, 'test-google-mock.html')}`
    ];
    
    const pages = [];
    
    for (const url of testUrls) {
      console.log(`\n🔗 Loading ${url}...`);
      
      const page = await this.browser.newPage();
      
      // Listen for console logs from the extension
      page.on('console', (msg) => {
        if (msg.text().includes('Domain check') || 
            msg.text().includes('Wildcard check') || 
            msg.text().includes('Timer') ||
            msg.text().includes('Auto-close') ||
            msg.text().includes('excluded')) {
          console.log(`📋 Extension Log: ${msg.text()}`);
          this.consoleLogs.push({
            url: url,
            message: msg.text(),
            timestamp: new Date().toISOString()
          });
        }
      });
      
      try {
        await page.goto(url);
        await page.waitForTimeout(2000);
        
        console.log(`✅ Successfully loaded ${url}`);
        console.log(`   Title: ${await page.title()}`);
        
        pages.push({
          url: url,
          title: await page.title(),
          loaded: true
        });
        
      } catch (error) {
        console.log(`❌ Failed to load ${url}: ${error.message}`);
        pages.push({
          url: url,
          loaded: false,
          error: error.message
        });
      }
    }
    
    // Wait a bit to see extension activity
    console.log('\n⏳ Waiting for extension activity...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test tab switching to trigger timer resets
    console.log('\n🔄 Testing tab switching behavior...');
    const browserPages = await this.browser.pages();
    
    for (let i = 0; i < Math.min(3, browserPages.length); i++) {
      const page = browserPages[i];
      try {
        await page.bringToFront();
        await page.waitForTimeout(1000);
        console.log(`✅ Switched to tab: ${page.url()}`);
      } catch (error) {
        console.log(`⚠️ Could not switch to tab: ${error.message}`);
      }
    }
    
    return {
      pages,
      consoleLogs: this.consoleLogs
    };
  }

  async runAllTests() {
    console.log('🧪 Starting simplified wildcard domain exclusion tests...\n');
    
    try {
      await this.setupBrowser();
      await this.configureExtensionForTesting();
      
      const domainLogicResults = await this.testDomainExclusionLogic();
      const realPagesResults = await this.testWithRealPages();
      
      // Generate test report
      const report = {
        testSuite: 'Simplified Wildcard Domain Exclusion Tests',
        timestamp: new Date().toISOString(),
        domainLogicResults,
        realPagesResults,
        summary: {
          totalDomainTests: domainLogicResults.length,
          passedDomainTests: domainLogicResults.filter(r => r.passed).length,
          failedDomainTests: domainLogicResults.filter(r => !r.passed).length,
          totalConsoleLogs: this.consoleLogs.length,
          loadedPages: realPagesResults.pages.filter(p => p.loaded).length,
          failedPages: realPagesResults.pages.filter(p => !p.loaded).length
        }
      };
      
      console.log('\n📋 SIMPLIFIED TEST REPORT');
      console.log('==========================');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report to file
      const fs = require('fs');
      fs.writeFileSync('simple-test-report.json', JSON.stringify(report, null, 2));
      console.log('\n✅ Test report saved to simple-test-report.json');
      
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
  const tester = new SimpleDomainTester();
  await tester.runAllTests();
};

// Export for use in other files
module.exports = { SimpleDomainTester, runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}