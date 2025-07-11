// Comprehensive test for Chrome extension timer behavior
// This test specifically focuses on the timer behavior when tabs become active/inactive

const { chromium } = require('playwright');
const path = require('path');

class TimerBehaviorTest {
  constructor() {
    this.browser = null;
    this.extensionPage = null;
    this.testPages = [];
    this.testResults = [];
    this.settings = {
      timeout: 10, // 10 seconds for testing
      timeUnit: 'seconds',
      debugMode: true
    };
  }

  async setup() {
    console.log('🚀 Setting up Chrome extension timer behavior test...');
    
    // Launch Chrome with extension loaded
    const extensionPath = path.join(__dirname);
    this.browser = await chromium.launchPersistentContext('', {
      headless: false, // Keep visible to observe timer behavior
      args: [
        `--load-extension=${extensionPath}`,
        '--disable-extensions-except=' + extensionPath,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });

    console.log('✅ Chrome launched with extension');
    
    // Create extension popup page to configure settings
    this.extensionPage = await this.browser.newPage();
    await this.extensionPage.goto('chrome://extensions/');
    await this.extensionPage.waitForTimeout(2000);
    
    console.log('🔧 Setting up extension configuration...');
    await this.configureExtension();
  }

  async configureExtension() {
    try {
      // Find and click on the extension popup
      const extensionIds = await this.extensionPage.evaluate(() => {
        const extensions = document.querySelectorAll('extensions-item');
        const autoCloseExt = Array.from(extensions).find(ext => 
          ext.shadowRoot?.textContent?.includes('FOMO TabTimer')
        );
        return autoCloseExt ? autoCloseExt.id : null;
      });

      if (extensionIds) {
        console.log('📋 Found extension, attempting to configure...');
        
        // Try to open popup directly
        const popupUrl = `chrome-extension://${extensionIds}/popup/popup.html`;
        const popupPage = await this.browser.newPage();
        await popupPage.goto(popupUrl);
        await popupPage.waitForTimeout(1000);
        
        // Configure settings through popup
        await this.configureSettings(popupPage);
        await popupPage.close();
      } else {
        console.log('⚠️ Extension not found, using default settings');
      }
    } catch (error) {
      console.log('⚠️ Could not configure extension popup, using storage API:', error.message);
      await this.configureViaStorage();
    }
  }

  async configureSettings(popupPage) {
    try {
      // Set timeout to 10 seconds
      await popupPage.fill('#timeout-value', '10');
      await popupPage.selectOption('#timeout-unit', 'seconds');
      
      // Enable debug mode
      await popupPage.check('#debug-mode');
      
      // Save settings
      await popupPage.click('#save-settings');
      await popupPage.waitForTimeout(500);
      
      console.log('✅ Extension configured: 10 seconds timeout, debug mode enabled');
    } catch (error) {
      console.log('⚠️ Could not configure via popup, using storage API');
      await this.configureViaStorage();
    }
  }

  async configureViaStorage() {
    // Configure extension settings directly via storage API
    const page = await this.browser.newPage();
    await page.goto('about:blank');
    
    await page.evaluate((settings) => {
      chrome.storage.sync.set({
        autoCloseSettings: {
          enabled: true,
          timeValue: settings.timeout,
          timeUnit: settings.timeUnit,
          excludedDomains: [],
          excludePinned: true,
          debugMode: settings.debugMode
        }
      });
    }, this.settings);
    
    await page.close();
    await this.browser.pages()[0].waitForTimeout(2000); // Wait for settings to propagate
    console.log('✅ Extension configured via storage API: 10 seconds timeout, debug mode enabled');
  }

  async createTestPages() {
    console.log('📄 Creating test pages...');
    
    const testUrls = [
      'data:text/html,<html><head><title>Test Page 1</title></head><body><h1>Test Page 1</h1><p>This is test page 1</p></body></html>',
      'data:text/html,<html><head><title>Test Page 2</title></head><body><h1>Test Page 2</h1><p>This is test page 2</p></body></html>',
      'data:text/html,<html><head><title>Test Page 3</title></head><body><h1>Test Page 3</h1><p>This is test page 3</p></body></html>'
    ];

    for (const url of testUrls) {
      const page = await this.browser.newPage();
      await page.goto(url);
      await page.waitForTimeout(1000);
      this.testPages.push(page);
    }
    
    console.log(`✅ Created ${this.testPages.length} test pages`);
  }

  async runTimerBehaviorTest() {
    console.log('🧪 Starting timer behavior test...');
    
    // Test 1: Verify initial state - all tabs should show original titles
    console.log('\n📍 Test 1: Initial state verification');
    await this.verifyInitialState();
    
    // Test 2: Make first tab inactive and monitor timer
    console.log('\n📍 Test 2: Testing timer behavior when tab becomes inactive');
    await this.testInactiveTabTimer();
    
    // Test 3: Switch back to tab and verify timer resets
    console.log('\n📍 Test 3: Testing timer reset when tab becomes active');
    await this.testActiveTabTimerReset();
    
    // Test 4: Test multiple tab switching
    console.log('\n📍 Test 4: Testing multiple tab switching behavior');
    await this.testMultipleTabSwitching();
    
    // Test 5: Monitor timer countdown accuracy
    console.log('\n📍 Test 5: Testing timer countdown accuracy');
    await this.testTimerCountdownAccuracy();
  }

  async verifyInitialState() {
    console.log('Verifying initial state of all tabs...');
    
    for (let i = 0; i < this.testPages.length; i++) {
      const page = this.testPages[i];
      await page.bringToFront();
      await page.waitForTimeout(1000);
      
      const title = await page.title();
      console.log(`Tab ${i + 1}: "${title}"`);
      
      // Since all tabs start active, they should show original titles
      if (title.includes('Test Page')) {
        console.log(`✅ Tab ${i + 1} shows correct initial title`);
      } else {
        console.log(`❌ Tab ${i + 1} shows unexpected title: ${title}`);
      }
    }
  }

  async testInactiveTabTimer() {
    console.log('Testing timer behavior when tab becomes inactive...');
    
    // Make first tab active
    const firstTab = this.testPages[0];
    await firstTab.bringToFront();
    await firstTab.waitForTimeout(1000);
    
    console.log('Making first tab inactive by switching to second tab...');
    const secondTab = this.testPages[1];
    await secondTab.bringToFront();
    await secondTab.waitForTimeout(2000);
    
    // Monitor first tab's title for timer behavior
    console.log('Monitoring first tab timer behavior...');
    const timerObservations = [];
    
    for (let i = 0; i < 12; i++) { // Monitor for 12 seconds
      const title = await firstTab.title();
      const timestamp = new Date().toISOString();
      timerObservations.push({ timestamp, title, secondsElapsed: i });
      
      console.log(`${i}s: First tab title: "${title}"`);
      
      // Check if timer is showing correct countdown
      if (title.includes('⏰') || title.includes('⚠️') || title.includes('🔥')) {
        const timeMatch = title.match(/(\d+):(\d+)/);
        if (timeMatch) {
          const minutes = parseInt(timeMatch[1]);
          const seconds = parseInt(timeMatch[2]);
          const totalSeconds = minutes * 60 + seconds;
          const expectedSeconds = Math.max(0, 10 - i);
          
          console.log(`   Timer shows: ${totalSeconds}s, Expected: ${expectedSeconds}s`);
          
          if (Math.abs(totalSeconds - expectedSeconds) <= 1) {
            console.log('   ✅ Timer is accurate');
          } else {
            console.log('   ❌ Timer is inaccurate');
          }
        }
      } else if (i === 0) {
        // First check - timer should start at 10 seconds
        console.log('   ❌ Timer should start immediately when tab becomes inactive');
      }
      
      await firstTab.waitForTimeout(1000);
    }
    
    this.testResults.push({
      test: 'Inactive Tab Timer',
      observations: timerObservations,
      expected: 'Timer should start at 10 seconds when tab becomes inactive',
      passed: timerObservations.some(obs => obs.title.includes('10:00') || obs.title.includes('0:10'))
    });
  }

  async testActiveTabTimerReset() {
    console.log('Testing timer reset when tab becomes active...');
    
    // Switch back to first tab
    const firstTab = this.testPages[0];
    await firstTab.bringToFront();
    await firstTab.waitForTimeout(2000);
    
    const title = await firstTab.title();
    console.log(`First tab title after becoming active: "${title}"`);
    
    // Active tab should show original title (no timer)
    if (title === 'Test Page 1') {
      console.log('✅ Timer correctly reset when tab became active');
      this.testResults.push({
        test: 'Active Tab Timer Reset',
        result: 'PASSED',
        title: title
      });
    } else {
      console.log('❌ Timer did not reset properly when tab became active');
      this.testResults.push({
        test: 'Active Tab Timer Reset',
        result: 'FAILED',
        title: title,
        expected: 'Test Page 1'
      });
    }
  }

  async testMultipleTabSwitching() {
    console.log('Testing multiple tab switching behavior...');
    
    // Switch between tabs rapidly
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < this.testPages.length; j++) {
        const page = this.testPages[j];
        await page.bringToFront();
        await page.waitForTimeout(1000);
        
        const title = await page.title();
        console.log(`Tab ${j + 1} (active): "${title}"`);
        
        // Active tab should show original title
        if (title.includes('Test Page')) {
          console.log(`✅ Tab ${j + 1} shows correct active title`);
        } else {
          console.log(`❌ Tab ${j + 1} shows unexpected title when active: ${title}`);
        }
        
        // Check other tabs for timer behavior
        for (let k = 0; k < this.testPages.length; k++) {
          if (k !== j) {
            const inactiveTab = this.testPages[k];
            const inactiveTitle = await inactiveTab.title();
            console.log(`Tab ${k + 1} (inactive): "${inactiveTitle}"`);
          }
        }
      }
    }
  }

  async testTimerCountdownAccuracy() {
    console.log('Testing timer countdown accuracy...');
    
    // Make first tab active, then switch to second tab
    const firstTab = this.testPages[0];
    const secondTab = this.testPages[1];
    
    await firstTab.bringToFront();
    await firstTab.waitForTimeout(1000);
    
    console.log('Switching to second tab to start timer on first tab...');
    await secondTab.bringToFront();
    await secondTab.waitForTimeout(1000);
    
    // Record precise timer behavior
    const startTime = Date.now();
    const timerReadings = [];
    
    for (let i = 0; i < 10; i++) {
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - startTime) / 1000;
      const title = await firstTab.title();
      
      timerReadings.push({
        elapsedSeconds: elapsedSeconds,
        title: title,
        timestamp: new Date().toISOString()
      });
      
      console.log(`${elapsedSeconds.toFixed(1)}s elapsed: "${title}"`);
      
      await firstTab.waitForTimeout(1000);
    }
    
    this.testResults.push({
      test: 'Timer Countdown Accuracy',
      readings: timerReadings,
      analysis: this.analyzeTimerAccuracy(timerReadings)
    });
  }

  analyzeTimerAccuracy(readings) {
    console.log('\n📊 Analyzing timer accuracy...');
    
    const analysis = {
      startsAtFullTimeout: false,
      countsDownCorrectly: false,
      timerPrecision: 'unknown',
      issues: []
    };
    
    // Check if timer starts at full timeout (10 seconds)
    const firstReading = readings[0];
    if (firstReading.title.includes('0:10') || firstReading.title.includes('10:00')) {
      analysis.startsAtFullTimeout = true;
      console.log('✅ Timer starts at full timeout (10 seconds)');
    } else {
      analysis.startsAtFullTimeout = false;
      analysis.issues.push('Timer does not start at full timeout');
      console.log('❌ Timer does not start at full timeout');
    }
    
    // Check countdown accuracy
    let accurateReadings = 0;
    for (const reading of readings) {
      const timeMatch = reading.title.match(/(\d+):(\d+)/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1]);
        const seconds = parseInt(timeMatch[2]);
        const displayedSeconds = minutes * 60 + seconds;
        const expectedSeconds = Math.max(0, 10 - reading.elapsedSeconds);
        
        if (Math.abs(displayedSeconds - expectedSeconds) <= 1.5) {
          accurateReadings++;
        }
      }
    }
    
    analysis.countsDownCorrectly = accurateReadings / readings.length > 0.7;
    analysis.timerPrecision = `${accurateReadings}/${readings.length} readings accurate`;
    
    if (analysis.countsDownCorrectly) {
      console.log('✅ Timer countdown is accurate');
    } else {
      console.log('❌ Timer countdown is inaccurate');
      analysis.issues.push('Timer countdown is not accurate');
    }
    
    return analysis;
  }

  async generateReport() {
    console.log('\n📋 Generating test report...');
    
    const report = {
      testDate: new Date().toISOString(),
      extensionVersion: '1.0.0',
      testSettings: this.settings,
      results: this.testResults,
      summary: {
        totalTests: this.testResults.length,
        passed: this.testResults.filter(r => r.result === 'PASSED' || r.passed).length,
        failed: this.testResults.filter(r => r.result === 'FAILED' || r.passed === false).length
      }
    };
    
    console.log('\n📊 TEST SUMMARY:');
    console.log('================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed}`);
    console.log(`Failed: ${report.summary.failed}`);
    
    console.log('\n🔍 DETAILED RESULTS:');
    console.log('===================');
    
    for (const result of this.testResults) {
      console.log(`\n${result.test}:`);
      if (result.result) {
        console.log(`  Result: ${result.result}`);
      }
      if (result.passed !== undefined) {
        console.log(`  Passed: ${result.passed}`);
      }
      if (result.title) {
        console.log(`  Title: ${result.title}`);
      }
      if (result.expected) {
        console.log(`  Expected: ${result.expected}`);
      }
      if (result.analysis) {
        console.log('  Analysis:');
        console.log(`    - Starts at full timeout: ${result.analysis.startsAtFullTimeout}`);
        console.log(`    - Counts down correctly: ${result.analysis.countsDownCorrectly}`);
        console.log(`    - Timer precision: ${result.analysis.timerPrecision}`);
        if (result.analysis.issues.length > 0) {
          console.log(`    - Issues: ${result.analysis.issues.join(', ')}`);
        }
      }
    }
    
    return report;
  }

  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    if (this.browser) {
      await this.browser.close();
    }
    
    console.log('✅ Test cleanup complete');
  }
}

// Main test execution
async function runTimerBehaviorTest() {
  const test = new TimerBehaviorTest();
  
  try {
    await test.setup();
    await test.createTestPages();
    await test.runTimerBehaviorTest();
    const report = await test.generateReport();
    
    // Write report to file
    require('fs').writeFileSync(
      path.join(__dirname, 'timer-behavior-test-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Report saved to timer-behavior-test-report.json');
    
    return report;
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await test.cleanup();
  }
}

// Export for use in other scripts
module.exports = { TimerBehaviorTest, runTimerBehaviorTest };

// Run test if called directly
if (require.main === module) {
  runTimerBehaviorTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}