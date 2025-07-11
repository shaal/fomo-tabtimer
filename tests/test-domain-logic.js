// Test the domain exclusion logic directly from the background script
const path = require('path');
const fs = require('fs');

class DomainLogicTester {
  constructor() {
    this.backgroundScript = null;
  }

  loadBackgroundScript() {
    console.log('📄 Loading background script...');
    
    const backgroundPath = path.join(__dirname, 'background.js');
    this.backgroundScript = fs.readFileSync(backgroundPath, 'utf8');
    
    console.log('✅ Background script loaded');
  }

  extractDomainLogic() {
    console.log('🔍 Extracting domain exclusion logic...');
    
    // Extract the isExcludedDomain and escapeRegex functions
    const isExcludedDomainMatch = this.backgroundScript.match(/isExcludedDomain\(url\)\s*\{([\s\S]*?)\n\s*\}/);
    const escapeRegexMatch = this.backgroundScript.match(/escapeRegex\(string\)\s*\{([\s\S]*?)\n\s*\}/);
    
    if (!isExcludedDomainMatch || !escapeRegexMatch) {
      throw new Error('Could not extract domain logic from background script');
    }
    
    // Create a test environment with the extracted functions
    const testEnv = `
      const escapeRegex = (string) => {
        ${escapeRegexMatch[1]}
      };
      
      const isExcludedDomain = (url, excludedDomains) => {
        if (!url) return false;
        
        try {
          const domain = new URL(url).hostname;
          const isExcluded = excludedDomains.some(pattern => {
            if (pattern.includes('*')) {
              // Handle wildcard patterns like *.example.com
              let regexPattern;
              if (pattern.startsWith('*.')) {
                // *.example.com should match subdomains of example.com
                const baseDomain = pattern.substring(2); // Remove "*."
                regexPattern = \`^[^.]+\\\\.\${escapeRegex(baseDomain)}$\`;
              } else if (pattern.endsWith('.*')) {
                // example.* should match any TLD
                const baseDomain = pattern.substring(0, pattern.length - 2); // Remove ".*"
                regexPattern = \`^\${escapeRegex(baseDomain)}\\\\.+$\`;
              } else {
                // General wildcard replacement
                regexPattern = escapeRegex(pattern).replace(/\\\\\*/g, '.*');
              }
              
              const regex = new RegExp(regexPattern);
              const matches = regex.test(domain);
              console.log(\`🔍 Wildcard check: "\${domain}" vs "\${pattern}" (regex: \${regexPattern}) = \${matches}\`);
              return matches;
            }
            
            // Exact match or subdomain match
            const exactMatch = domain === pattern;
            const subdomainMatch = domain.endsWith('.' + pattern);
            const matches = exactMatch || subdomainMatch;
            console.log(\`🔍 Domain check: "\${domain}" vs "\${pattern}" = \${matches}\`);
            return matches;
          });
          
          if (isExcluded) {
            console.log(\`🚫 Domain "\${domain}" is excluded from auto-close\`);
          }
          
          return isExcluded;
        } catch (error) {
          console.error('❌ Error checking domain exclusion:', error);
          return false;
        }
      };
      
      // Export for testing
      module.exports = { isExcludedDomain, escapeRegex };
    `;
    
    // Write test environment to a temporary file
    const testFile = path.join(__dirname, 'temp-domain-logic.js');
    fs.writeFileSync(testFile, testEnv);
    
    console.log('✅ Domain logic extracted and prepared for testing');
    return testFile;
  }

  async testDomainLogic() {
    console.log('🧪 Testing domain exclusion logic...');
    
    const testFile = this.extractDomainLogic();
    const { isExcludedDomain } = require(testFile);
    
    // Test configuration
    const excludedDomains = ['*.google.com', 'example.com', 'localhost'];
    
    const testCases = [
      {
        url: 'https://home.google.com/library',
        expected: true,
        description: 'home.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://app.google.com/dashboard',
        expected: true,
        description: 'app.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://api.google.com/v1/data',
        expected: true,
        description: 'api.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://test.google.com',
        expected: true,
        description: 'test.google.com should be excluded by *.google.com'
      },
      {
        url: 'https://google.com',
        expected: false,
        description: 'google.com should NOT be excluded by *.google.com (no subdomain)'
      },
      {
        url: 'https://example.com',
        expected: true,
        description: 'example.com should be excluded by exact match'
      },
      {
        url: 'https://sub.example.com',
        expected: true,
        description: 'sub.example.com should be excluded by subdomain match'
      },
      {
        url: 'https://google.com',
        expected: false,
        description: 'google.com should NOT be excluded'
      },
      {
        url: 'https://notgoogle.com',
        expected: false,
        description: 'notgoogle.com should NOT be excluded'
      },
      {
        url: 'https://google.com.evil.com',
        expected: false,
        description: 'google.com.evil.com should NOT be excluded'
      },
      {
        url: 'http://localhost:3000',
        expected: true,
        description: 'localhost:3000 should be excluded by exact match'
      },
      {
        url: 'https://sub.localhost',
        expected: true,
        description: 'sub.localhost should be excluded by subdomain match'
      }
    ];
    
    const results = [];
    
    console.log('\n🧪 Testing domain exclusion logic:');
    console.log('===================================');
    
    for (const testCase of testCases) {
      console.log(`\n📝 ${testCase.description}`);
      console.log(`   URL: ${testCase.url}`);
      console.log(`   Expected: ${testCase.expected}`);
      
      try {
        const actual = isExcludedDomain(testCase.url, excludedDomains);
        const passed = actual === testCase.expected;
        
        console.log(`   Actual: ${actual}`);
        console.log(`   Result: ${passed ? '✅ PASS' : '❌ FAIL'}`);
        
        results.push({
          ...testCase,
          actual,
          passed,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`   Error: ${error.message}`);
        console.log(`   Result: ❌ ERROR`);
        
        results.push({
          ...testCase,
          actual: null,
          passed: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Clean up temporary file
    fs.unlinkSync(testFile);
    
    return results;
  }

  async runAllTests() {
    console.log('🧪 Starting domain logic tests...\n');
    
    try {
      this.loadBackgroundScript();
      const results = await this.testDomainLogic();
      
      // Generate test report
      const report = {
        testSuite: 'Domain Logic Tests',
        timestamp: new Date().toISOString(),
        results: results,
        summary: {
          totalTests: results.length,
          passedTests: results.filter(r => r.passed).length,
          failedTests: results.filter(r => !r.passed).length,
          errorTests: results.filter(r => r.error).length
        }
      };
      
      console.log('\n📋 DOMAIN LOGIC TEST REPORT');
      console.log('============================');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report to file
      const fs = require('fs');
      fs.writeFileSync('domain-logic-report.json', JSON.stringify(report, null, 2));
      console.log('\n✅ Test report saved to domain-logic-report.json');
      
      return report;
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      throw error;
    }
  }
}

// Main test execution
const runTests = async () => {
  const tester = new DomainLogicTester();
  await tester.runAllTests();
};

// Export for use in other files
module.exports = { DomainLogicTester, runTests };

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}