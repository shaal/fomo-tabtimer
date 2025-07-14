# FOMO TabTimer - Tests

This directory contains all test-related files for the FOMO TabTimer Chrome Extension.

## 📁 Directory Structure

```
tests/
├── README.md                           # This file
├── TAB-LOCKING-TEST-README.md         # Tab locking test documentation
├── playwright.config.js               # Playwright configuration
├── run-tab-locking-test.js            # Tab locking test runner
├── test-tab-locking.js                # Tab locking tests
├── test-closing-bug-simple.js         # Simple closing bug tests
├── test-closing-state-bug.js          # Closing state bug tests
├── test-results/                      # Test results and reports
└── [other test files...]              # Additional test files
```

## 🧪 Running Tests

### Prerequisites
```bash
npm install
npm run setup
```

### Available Test Commands

From the **root directory** of the project:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test-basic
npm run test-domain
npm run test-restore
npm run test-tab-locking

# Run tab locking tests directly with Playwright
npm run test-tab-locking-direct
```

### Individual Test Files

From the **tests directory**:

```bash
# Tab locking functionality
node run-tab-locking-test.js

# Manual test execution
npx playwright test test-tab-locking.js
```

## 📋 Test Types

- **Unit Tests**: Individual component testing
- **Integration Tests**: Extension component interaction
- **End-to-End Tests**: Full browser automation with Playwright
- **Manual Tests**: Interactive testing guides

## 🔧 Configuration

- **Playwright Config**: `playwright.config.js`
- **Extension Path**: Tests load the extension from the parent directory (`../`)
- **Test Results**: Saved to `test-results/` directory

## 📝 Notes

- All tests require Chrome/Chromium browser
- Extension must be loaded in non-headless mode
- Tests automatically load the extension from the project root
- Test results include HTML reports and console output