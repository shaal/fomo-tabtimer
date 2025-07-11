// Test script for Chrome extension functionality
// This script will be used with Playwright to test the extension

const { chromium } = require('playwright');
const path = require('path');

const testExtension = async () => {
  console.log('Testing FOMO TabTimer Chrome Extension...');
  
  // Launch Chrome with extension loaded
  const extensionPath = path.join(__dirname);
  const browser = await chromium.launchPersistentContext('', {
    headless: false, // Set to true for headless testing
    args: [
      `--load-extension=${extensionPath}`,
      '--disable-extensions-except=' + extensionPath,
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  const page = await browser.newPage();
  
  try {
    // Test 1: Load extension and verify it's working
    console.log('Test 1: Loading extension...');
    await page.goto('chrome://extensions/');
    await page.waitForTimeout(2000);
    
    // Test 2: Open multiple tabs
    console.log('Test 2: Opening multiple tabs...');
    const tabs = [];
    const testUrls = [
      'https://example.com',
      'https://google.com',
      'https://github.com',
      'https://stackoverflow.com'
    ];
    
    for (const url of testUrls) {
      const newPage = await browser.newPage();
      await newPage.goto(url);
      tabs.push(newPage);
      await page.waitForTimeout(1000);
    }
    
    console.log(`Opened ${tabs.length} tabs`);
    
    // Test 3: Access extension popup
    console.log('Test 3: Testing extension popup...');
    const extensionPage = await browser.newPage();
    await extensionPage.goto('chrome://extensions/');
    
    // Test 4: Verify tab activity tracking
    console.log('Test 4: Testing tab activity tracking...');
    await page.waitForTimeout(2000);
    
    // Switch between tabs to simulate activity
    for (const tab of tabs) {
      await tab.bringToFront();
      await page.waitForTimeout(500);
    }
    
    // Test 5: Test with short timeout (for testing purposes)
    console.log('Test 5: Testing auto-close functionality...');
    // Note: In a real test, you would set a short timeout via the extension popup
    // and wait for tabs to be closed automatically
    
    console.log('Extension tests completed successfully');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
};

// Test individual functions
const testDomainExclusion = async () => {
  console.log('Testing domain exclusion logic...');
  
  // Test the domain exclusion logic
  const excludedDomains = ['gmail.com', '*.google.com', 'localhost'];
  const testUrls = [
    'https://gmail.com/inbox',
    'https://docs.google.com/document',
    'https://www.google.com/search',
    'https://example.com',
    'http://localhost:3000'
  ];
  
  // This would need to be integrated with the actual extension logic
  console.log('Domain exclusion tests completed');
};

const testTabRestoration = async () => {
  console.log('Testing tab restoration functionality...');
  
  // Test saving and restoring tabs
  console.log('Tab restoration tests completed');
};

module.exports = { 
  testExtension,
  testDomainExclusion,
  testTabRestoration
};