# LingoSwap Changelog

Date Format - (Year/Month/Day)

## [v.0.5.9] - 2025-08-22 
- **Added Content Script Injection Fail Fallback** - If the user opens the popup before content script is injected, it'll display a loading screen until a message is received.
- **Added Language Detection** - Reliably detects the site language and deletes the option in the target language dropdown.

## [v0.0.0 - v0.5.8] - 2025-06-15 to 2025-08-21
- **Initial AI Translator Integration** - Tested Groq, Gemini, and DeepSeek; inevitably chose to integrate Gemini due to a more reliable Free Tier.
- **DOM Manipulation & Translation Logic** - Extracts text from websites and performs placeholder translations; later replaced with real AI translation.
- **Chunking for Large Websites** - Added text chunking to handle big sites without excessive token usage.
- **Popup UI/UX Overhaul** - Redesigned popup with settings tab, dark mode, progress indicators, and cleaner layout.
- **Show Original Button** - Store translated text, restore original text, and toggle between both.
- **Translation State Persistence** - Translate button state persists across popup closes and tab changes.
- **Translation Progress Tracking** - Background script sends progress to popup for better UX.
- **Bug Fixes & Refactoring** - Multiple bug fixes, DOM traversal and chunking code refactored for clarity and performance.
- **Chrome Web Store Draft** - Created first draft listing with placeholders for descriptions, screenshots, logos, and privacy policy.
