#!/bin/bash

# Setup script for FOMO TabTimer Chrome Extension Testing

echo "🚀 Setting up Chrome Extension Testing Environment..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js $(node -v) and npm $(npm -v) are available"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install chromium

# Make test runner executable
chmod +x test-runner.js

# Check if Chrome is installed
if command -v google-chrome &> /dev/null; then
    echo "✅ Google Chrome is available"
elif command -v chromium &> /dev/null; then
    echo "✅ Chromium is available"
else
    echo "⚠️  Warning: Chrome/Chromium not found. Please install Chrome for manual testing."
fi

echo ""
echo "🎉 Setup complete! You can now run tests:"
echo ""
echo "Automated Testing:"
echo "  npm test              # Run all automated tests"
echo "  node test-runner.js   # Run comprehensive test suite"
echo ""
echo "Manual Testing:"
echo "  1. Open Chrome and go to chrome://extensions/"
echo "  2. Enable Developer mode"
echo "  3. Click 'Load unpacked' and select this directory"
echo "  4. Follow the manual-test-guide.md"
echo ""
echo "Files created:"
echo "  📄 package.json          # Project configuration"
echo "  🧪 test-runner.js        # Automated test suite"
echo "  📖 manual-test-guide.md  # Manual testing guide"
echo "  ⚙️  setup-testing.sh     # This setup script"
echo ""
echo "Extension files:"
echo "  📱 manifest.json         # Extension manifest"
echo "  🔧 background.js         # Background service worker"
echo "  🎨 popup/               # Popup interface"
echo "  🖼️  icons/               # Extension icons"
echo ""