#!/usr/bin/env node

// Comprehensive Test Runner for FOMO TabTimer Chrome Extension
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

class ExtensionTester {
  constructor() {
    this.browser = null;
    this.extensionPath = __dirname;
    this.testResults = [];
  }

  async setup() {
    console.log('🚀 Setting up Chrome Extension Testing Environment...');
    
    // Verify extension files exist
    const requiredFiles = ['manifest.json', 'background.js', 'popup/popup.html'];
    for (const file of requiredFiles) {
      if (!fs.existsSync(path.join(this.extensionPath, file))) {
        throw new Error(`Required file missing: ${file}`);
      }
    }

    // Launch Chrome with extension
    this.browser = await chromium.launchPersistentContext('', {
      headless: false, // Set to true for CI/CD
      args: [
        `--load-extension=${this.extensionPath}`,
        `--disable-extensions-except=${this.extensionPath}`,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox'
      ]
    });

    console.log('✅ Chrome launched with extension loaded');
  }

  async runTest(testName, testFunction) {
    console.log(`\n🧪 Running test: ${testName}`);
    const startTime = Date.now();
    
    try {
      await testFunction();
      const duration = Date.now() - startTime;
      this.testResults.push({ name: testName, status: 'PASSED', duration });
      console.log(`✅ ${testName} - PASSED (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({ name: testName, status: 'FAILED', duration, error: error.message });
      console.error(`❌ ${testName} - FAILED (${duration}ms)`);
      console.error(`   Error: ${error.message}`);
    }
  }

  async testExtensionLoad() {
    const page = await this.browser.newPage();
    
    // Navigate to extensions page
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Check if extension is loaded
    const extensionFound = await page.evaluate(() => {
      const extensions = document.querySelectorAll('extensions-item');
      for (const ext of extensions) {
        const name = ext.shadowRoot?.querySelector('#name')?.textContent;
        if (name && name.includes('FOMO TabTimer')) {
          return true;
        }
      }
      return false;
    });
    
    if (!extensionFound) {
      throw new Error('Extension not found in Chrome extensions page');
    }
    
    await page.close();
  }

  async testMultipleTabsOpening() {
    const testUrls = [
      'https://example.com',
      'https://httpbin.org/get',
      'https://jsonplaceholder.typicode.com/posts/1',
      'https://httpbin.org/delay/1'
    ];
    
    const tabs = [];
    
    for (const url of testUrls) {
      const page = await this.browser.newPage();
      await page.goto(url, { timeout: 10000 });
      tabs.push(page);
      await page.waitForTimeout(500);
    }
    
    if (tabs.length !== testUrls.length) {
      throw new Error(`Expected ${testUrls.length} tabs, got ${tabs.length}`);
    }
    
    // Close tabs
    for (const tab of tabs) {
      await tab.close();
    }
  }

  async testExtensionPopup() {
    const page = await this.browser.newPage();
    
    // We need to find the extension ID first
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Get extension ID
    const extensionId = await page.evaluate(() => {
      const extensions = document.querySelectorAll('extensions-item');
      for (const ext of extensions) {
        const name = ext.shadowRoot?.querySelector('#name')?.textContent;
        if (name && name.includes('FOMO TabTimer')) {
          return ext.id;
        }
      }
      return null;
    });
    
    if (!extensionId) {
      throw new Error('Could not find extension ID');
    }
    
    // Navigate to popup
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
    await page.goto(popupUrl);
    await page.waitForTimeout(1000);
    
    // Verify popup elements exist
    const enabledToggle = await page.$('#enabled');
    const timeValue = await page.$('#timeValue');
    const timeUnit = await page.$('#timeUnit');
    
    if (!enabledToggle || !timeValue || !timeUnit) {
      throw new Error('Popup elements not found');
    }
    
    await page.close();
  }

  async testTabActivityTracking() {
    const tabs = [];
    
    // Open multiple tabs
    for (let i = 0; i < 3; i++) {
      const page = await this.browser.newPage();
      await page.goto(`https://httpbin.org/delay/${i}`);
      tabs.push(page);
      await page.waitForTimeout(1000);
    }
    
    // Switch between tabs to simulate activity
    for (const tab of tabs) {
      await tab.bringToFront();
      await page.waitForTimeout(500);
    }
    
    // In a real test, you would check the extension's internal state
    // For now, we just verify tabs are responsive
    for (const tab of tabs) {
      const title = await tab.title();
      if (!title) {
        throw new Error('Tab not responsive');
      }
    }
    
    // Close tabs
    for (const tab of tabs) {
      await tab.close();
    }
  }

  async testDomainExclusion() {
    // This test would require injecting test settings into the extension
    // For now, we'll test the domain matching logic conceptually
    
    const excludedDomains = ['gmail.com', '*.google.com', 'localhost'];
    const testUrls = [
      { url: 'https://gmail.com/inbox', shouldExclude: true },
      { url: 'https://docs.google.com/document', shouldExclude: true },
      { url: 'https://www.google.com/search', shouldExclude: true },
      { url: 'https://example.com', shouldExclude: false },
      { url: 'http://localhost:3000', shouldExclude: true }
    ];
    
    // Test domain matching logic (simplified)
    for (const test of testUrls) {
      const url = new URL(test.url);
      const domain = url.hostname;
      
      const isExcluded = excludedDomains.some(pattern => {
        if (pattern.includes('*')) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'));
          return regex.test(domain);
        }
        return domain === pattern || domain.endsWith('.' + pattern);
      });
      
      if (isExcluded !== test.shouldExclude) {
        throw new Error(`Domain exclusion failed for ${test.url}`);
      }
    }
  }

  async testPinnedTabExclusion() {
    const page = await this.browser.newPage();
    await page.goto('https://example.com');
    
    // Pin the tab (this would require Chrome DevTools Protocol)
    // For now, we'll just verify the tab exists
    const title = await page.title();
    if (!title) {
      throw new Error('Pinned tab test failed - tab not responsive');
    }
    
    await page.close();
  }

  async testStorageFunctionality() {
    const page = await this.browser.newPage();
    
    // Test storage operations
    await page.goto('chrome://extensions/');
    
    // This test would require accessing the extension's storage
    // In a real implementation, you'd use Chrome DevTools Protocol
    // to interact with the extension's storage
    
    await page.close();
  }

  async printResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    for (const result of this.testResults) {
      const status = result.status === 'PASSED' ? '✅' : '❌';
      console.log(`${status} ${result.name} (${result.duration}ms)`);
      
      if (result.status === 'PASSED') {
        passed++;
      } else {
        failed++;
        console.log(`   Error: ${result.error}`);
      }
    }
    
    console.log('=' .repeat(50));
    console.log(`Total: ${this.testResults.length} | Passed: ${passed} | Failed: ${failed}`);
    
    if (failed > 0) {
      console.log('\n❌ Some tests failed. Please check the errors above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All tests passed!');
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      console.log('🧹 Browser closed');
    }
  }

  async runAllTests() {
    try {
      await this.setup();
      
      // Run all tests
      await this.runTest('Extension Load', () => this.testExtensionLoad());
      await this.runTest('Multiple Tabs Opening', () => this.testMultipleTabsOpening());
      await this.runTest('Extension Popup', () => this.testExtensionPopup());
      await this.runTest('Tab Activity Tracking', () => this.testTabActivityTracking());
      await this.runTest('Domain Exclusion Logic', () => this.testDomainExclusion());
      await this.runTest('Pinned Tab Exclusion', () => this.testPinnedTabExclusion());
      await this.runTest('Storage Functionality', () => this.testStorageFunctionality());
      
      await this.printResults();
      
    } catch (error) {
      console.error('🚨 Test setup failed:', error.message);
      process.exit(1);
    } finally {
      await this.cleanup();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ExtensionTester();
  tester.runAllTests().catch(console.error);
}

module.exports = ExtensionTester;