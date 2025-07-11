# Changelog

All notable changes to the FOMO TabTimer Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2025-07-10

### Added
- Enhanced debug mode with visual countdown timers in tab titles
- Real-time debug overlay panel with timer information
- Memory usage monitoring and performance metrics
- Comprehensive console logging for troubleshooting
- Settings test page for configuration validation
- Timer behavior test page for development

### Changed
- Improved timer reset logic to always start from full timeout
- Enhanced activity tracking with multiple event listeners
- Better settings persistence and synchronization
- Optimized domain exclusion pattern matching
- Refined debug mode to only show visual feedback when enabled

### Fixed
- Fixed timer not resetting to full timeout when returning to tabs
- Fixed wildcard domain exclusion not working correctly
- Fixed debug mode settings not persisting across popup sessions
- Fixed content script injection issues on some websites
- Fixed timer display showing incorrect countdown values

## [1.2.0] - 2025-07-10

### Added
- Wildcard domain exclusion support (`*.example.com`)
- Advanced domain pattern matching with regex
- Enhanced logging for domain exclusion debugging
- Better error handling for domain checking

### Changed
- Improved domain exclusion algorithm for better performance
- Enhanced exclusion pattern validation
- Better feedback for invalid domain patterns

### Fixed
- Fixed subdomain exclusion not working properly
- Fixed domain exclusion case sensitivity issues
- Fixed regex escaping for special characters in domains

## [1.1.0] - 2025-07-10

### Added
- Debug mode with visual timer displays
- Tab title countdown timers
- Debug overlay panel with real-time information
- Memory usage tracking and display
- Enhanced console logging for development

### Changed
- Improved user interface with debug controls
- Better visual feedback for timer states
- Enhanced popup design with debug information section

### Fixed
- Fixed timer accuracy issues
- Fixed overlay positioning and dragging
- Fixed debug mode toggle persistence

## [1.0.0] - 2025-07-10

### Added
- Initial release of FOMO TabTimer extension
- Configurable timeout periods (seconds, minutes, hours, days)
- Domain exclusion system
- Pinned tab protection
- Tab restoration functionality
- Background tab monitoring
- Chrome storage integration
- Basic popup interface
- Tab management page

### Features
- Automatic tab closing after inactivity timeout
- Smart activity tracking and timer resets
- Saved tab restoration with metadata
- Settings synchronization across Chrome instances
- Lightweight background processing
- Minimal memory footprint

### Technical
- Manifest V3 compliance
- Service worker architecture
- Content script for activity tracking
- Chrome APIs integration (tabs, storage, alarms)
- Efficient timer management with dynamic check intervals

## [Unreleased]

### Planned Features
- Tab grouping and organization
- Smart scheduling with different timeouts
- Usage analytics and insights
- Backup/restore for settings and saved tabs
- Keyboard shortcuts for quick actions
- Enhanced filtering and search for closed tabs
- Export/import functionality for settings

### Technical Improvements
- Web Workers for heavy processing
- Incremental updates for better performance
- Caching for domain exclusion results
- Lazy loading for content scripts
- Enhanced error handling and recovery

---

## Version History Notes

### Version Numbering
- **Major version** (X.0.0): Breaking changes, major feature additions
- **Minor version** (0.X.0): New features, improvements, non-breaking changes
- **Patch version** (0.0.X): Bug fixes, small improvements

### Release Process
1. Development and testing in feature branches
2. Integration testing with multiple Chrome versions
3. User acceptance testing with beta users
4. Performance testing and optimization
5. Documentation updates
6. Release to Chrome Web Store

### Compatibility
- **Chrome 88+**: Manifest V3 support required
- **Chrome 72+**: Basic functionality (with Manifest V2)
- **Chromium-based browsers**: Should work with recent versions

### Known Issues
- Some websites may block content script injection
- Very short timeouts (< 10 seconds) may cause performance issues
- Large numbers of saved tabs may slow down restoration interface
- Debug mode may cause minor performance overhead

### Migration Notes

#### From 1.2.x to 1.3.x
- Settings format unchanged, automatic migration
- Debug mode behavior changed (visual timers now conditional)
- New console logging format may affect automation scripts

#### From 1.1.x to 1.2.x
- Domain exclusion format enhanced but backward compatible
- Wildcard patterns now supported
- Existing exact domain matches continue to work

#### From 1.0.x to 1.1.x
- Debug mode is new optional feature
- Existing functionality unchanged
- New permissions may require user confirmation