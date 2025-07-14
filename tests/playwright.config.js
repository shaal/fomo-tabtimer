// playwright.config.js
const path = require('path');

module.exports = {
  testDir: './',
  testMatch: ['test-tab-locking.js', 'test-closing-state-bug.js', 'test-closing-bug-simple.js'],
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    // Use Chromium for Chrome extension testing
    browserName: 'chromium',
    headless: false, // Extensions require non-headless mode
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
        '--disable-popup-blocking',
        '--disable-extensions-except=' + path.resolve(__dirname, '..'),
        '--load-extension=' + path.resolve(__dirname, '..')
      ]
    }
  },
  projects: [
    {
      name: 'Chrome Extension Tests',
      use: {
        browserName: 'chromium',
        channel: 'chrome' // Use actual Chrome if available
      }
    }
  ],
  reporter: [
    ['list'],
    ['html', { outputFolder: 'test-results' }]
  ]
};