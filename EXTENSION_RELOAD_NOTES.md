# Extension Reload Notes

## What happens when you reload the extension?

When you reload/refresh the extension in Chrome's extension management page:

1. **Background script restarts** - This is good and expected
2. **Existing content scripts become invalid** - This causes errors

## Common Errors After Reload

You might see these errors in existing tab consoles:
- `Extension context invalidated`
- `Debug overlay: Failed to get debug info from background`

## How to Fix

**Option 1: Refresh the tabs**
- Simply refresh any tabs showing errors
- The content script will reload and reconnect properly

**Option 2: Wait for auto-recovery**
- The extension now handles context invalidation gracefully
- Old content scripts will stop running automatically
- New page loads will use the fresh extension context

## For Development

When developing and testing:
1. Make your changes
2. Reload the extension in Chrome
3. **Refresh any test tabs** to get clean content scripts
4. The extension should now work properly

## Normal Operation

Once the extension is installed and not being reloaded:
- No context invalidation errors should occur
- All communication should work smoothly
- Tabs should close properly when timers expire