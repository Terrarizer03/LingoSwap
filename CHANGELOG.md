# LingoSwap Changelog

`Date Format: (Year-Month-Day)`

## ![v0.6.0](https://img.shields.io/badge/Version-v0.6.0-green) - `2025-09-07 to ???`
### Added Features:
- **Cleaned Up Code** - Code is more modularized and better structured. This should help with updates and scaling in the future.
- **Translation Flow** - Changed the translation flow and got rid of redundant message passing.

### Bug Fixes:
- **Broken Target Language** - Added tab-based target language to stop cross-tab bugs from occuring.

## ![v0.5.9](https://img.shields.io/badge/Version-v0.5.9-blue) - `2025-08-22 to 2025-09-06`
### Added Features:
- **Added Content Script Injection Fail Fallback** - If the user opens the popup before content script is injected, it'll display a loading screen until a message is received.
- **Added Language Detection** - Reliably detects the site language and deletes the option in the target language dropdown.
- **Added Better Text Chunking** - Chunks now have a ~1,650 character limit, reducing token overflow errors with Gemini.

### Bug Fixes:
- **Broken Formatting** - Had a bug where formatting was broken when translating due to chunks getting returned in the wrong order, was fixed in the recent commits.

## ![v0.0.0 - v0.5.8](https://img.shields.io/badge/Version-v0.0.0_to_v0.5.8-blue) - `2025-06-15 to 2025-08-21`
### Added Features:
- **Initial AI Translator Integration** - Tested Groq, Gemini, and DeepSeek; inevitably chose to integrate Gemini due to a more reliable Free Tier.
- **DOM Manipulation & Translation Logic** - Extracts text from websites and performs placeholder translations; later replaced with real AI translation.
- **Chunking for Large Websites** - Added text chunking to handle big sites without excessive token usage.
- **Popup UI/UX Overhaul** - Redesigned popup with settings tab, dark mode, progress indicators, and cleaner layout.
- **Show Original Button** - Store translated text, restore original text, and toggle between both.
- **Translation State Persistence** - Translate button state persists across popup closes and tab changes.
- **Translation Progress Tracking** - Background script sends progress to popup for better UX.
- **Bug Fixes & Refactoring** - Multiple bug fixes, DOM traversal and chunking code refactored for clarity and performance.
- **Chrome Web Store Draft** - Created first draft listing with placeholders for descriptions, screenshots, logos, and privacy policy.

### Bug Fixes:
- **Popup Loading State** – Closing the popup during translation no longer causes the loading animation and “Translating…” text to disappear.
- **Translate Button Updates** – Clicking the translate button after a site is already translated no longer triggers unnecessary “Translating…” updates.
- **Tab Switching Progress** – Translation progress now correctly reflects the current tab and prevents reports from other tabs from appearing.
- **Reload During Translation** – Reloading a tab during translation no longer triggers a ‘Done!’ state if original text wasn’t stored, preventing “Show Original” issues.
- **UI Reset on Reload** – The popup UI now resets properly when the tab reloads while open.
- **Multiple Popups Interaction** – “Show Original” actions no longer affect other open popups in different tabs.
- **No API Key Handling** – Translating without an API key now properly initializes; Translation Reports appear after reopening the popup.
- **Translation Report Persistence** – Reports now persist and do not disappear shortly after closing the popup (future fix: delegate to content script for tab storage).