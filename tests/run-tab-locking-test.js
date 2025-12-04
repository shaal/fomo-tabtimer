#!/usr/bin/env node

/**
 * Simple test runner for Chrome Extension Tab Locking Feature
 * This script runs the Playwright tests for the tab locking functionality
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function checkDependencies() {
  console.log('🔍 Checking dependencies...');

  const rootDir = path.resolve(__dirname, '..');

  // Check if package.json exists
  if (!fs.existsSync(path.join(rootDir, 'package.json'))) {
    console.error('❌ package.json not found. Please run this from the extension directory.');
    process.exit(1);
  }

  // Check if node_modules exists
  if (!fs.existsSync(path.join(rootDir, 'node_modules'))) {
    console.error('❌ node_modules not found. Please run "npm install" first.');
    process.exit(1);
  }

  // Check if playwright is installed
  if (!fs.existsSync(path.join(rootDir, 'node_modules', '.bin', 'playwright'))) {
    console.error('❌ Playwright not found. Please run "npm run setup" first.');
    process.exit(1);
  }

  console.log('✅ Dependencies check passed');
}

function checkExtensionFiles() {
  console.log('🔍 Checking extension files...');

  const rootDir = path.resolve(__dirname, '..');
  const requiredFiles = [
    path.join(rootDir, 'manifest.json'),
    path.join(rootDir, 'background.js'),
    path.join(__dirname, 'test-tab-locking.js')
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`❌ Required file missing: ${file}`);
      process.exit(1);
    }
  }

  console.log('✅ Extension files check passed');
}

function runTests() {
  console.log('🚀 Starting Chrome Extension Tab Locking Tests...');
  console.log('');
  
  const playwrightPath = path.join(__dirname, '..', 'node_modules', '.bin', 'playwright');
  const args = ['test', 'test-tab-locking.js', '--reporter=list'];
  
  console.log(`Command: ${playwrightPath} ${args.join(' ')}`);
  console.log('');
  
  const child = spawn(playwrightPath, args, {
    stdio: 'inherit',
    cwd: __dirname
  });
  
  child.on('error', (error) => {
    console.error('❌ Failed to start test process:', error);
    process.exit(1);
  });
  
  child.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log('✅ All tests passed successfully!');
      console.log('');
      console.log('📋 Test Summary:');
      console.log('   - Extension loading and context menu setup');
      console.log('   - Tab locking and unlocking functionality');
      console.log('   - Auto-close exclusion for locked tabs');
      console.log('   - Context menu visibility based on lock status');
      console.log('   - Persistence across browser sessions');
      console.log('   - Multiple tab locking/unlocking');
      console.log('   - Extension permissions verification');
    } else {
      console.log(`❌ Tests failed with exit code ${code}`);
      console.log('');
      console.log('💡 Troubleshooting:');
      console.log('   - Make sure Chrome is closed before running tests');
      console.log('   - Ensure no other Chrome extensions are interfering');
      console.log('   - Check that all extension files are present');
      console.log('   - Try running "npm run setup" to reinstall dependencies');
    }
    process.exit(code);
  });
}

function main() {
  console.log('🔧 Chrome Extension Tab Locking Test Runner');
  console.log('===========================================');
  console.log('');
  
  try {
    checkDependencies();
    checkExtensionFiles();
    runTests();
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Test terminated');
  process.exit(1);
});

main();