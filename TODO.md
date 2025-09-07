# LingoSwap TODO-List

## Progress Indicators:

🟢 - Finished\
🟡 - In Progress\
🔴 - Not Started

## Planned Updates/Improvements:

* 🟡 **Code Cleanup** – Cleaning up content, pop up and background script for better readability and more efficient update times (due to cleaner code). Things like merging similar functions and refactoring large code into smaller, more manageable code bases.
* 🔴 **Auto Translate Feature** – Make it so that if the user toggles “Auto Translate Page”, it’ll automatically start translation on pages of the same url.
* 🟢 **Better Code Chunking** – Adding character count to the chunking code for a more fool-proof chunking logic, this can significantly reduce the possibility of error, with a trade-off of a slight increase in API calls.
* 🔴 **Smarter Chunk Prompts** – Chaining Memory on chunks by asking for a chunk summary and injecting that summary into the next chunk.
* 🔴 **Better Single Chunk Prompts** – Improving single chunk prompts for better results on small sites.
* 🔴 **Lazy Tab Loading** – Translating only on-screen/can be seen text elements to reduce API calls and improve latency.
* 🟢 **Language Detection** – Making the extension able to detect the language of the site to eliminate unnecessary translations.
* 🔴 **Section Selected Translations** – Users can select a portion of text by highlighting and translating only that highlighted section.
* 🔴 **Auto-Retry Failed Translations** – When a chunk fails, a code can run to auto-retry that chunk after a set time.
* 🔴 **Popup Text Translation** – A small section in the popup that has a translation box where you can input your copied text and returns the output in the box beside/below.
* 🔴 **Storage Security** – Storing user-provided API keys more securely.
* 🔴 **Cross Browser Compatibility** – Make sure it can run on all web browsers that support extensions (Chromium-based browsers, Firefox, Microsoft Edge, Brave, Samsung Internet, Lemur Browser, and more…).
* 🔴 **Offline Translations** – Make it possible for users to translate websites offline with no internet or API key by using a fallback AI. If all else fails, be able to do translations with dictionary-based translations. Google Translate (or similar) Integration – Make small chunks (those with less than 100 characters and 10 text elements) be translated by basic translation tools instead of using Gemini.
* 🔴 **Different “Experts”** – Add an option to toggle between different prompts for the AI.
* 🔴 **OCR Translations** – Image translation becomes possible.
* 🔴 **PDF Translations** – Translating PDF and other files.
* 🔴 **Decrease Latency** – Lower translation time between chunks.
* 🔴 **Stronger AI Model** – Find better and stronger alternatives than Gemini for translations.
* 🔴 **Translated Text Storage** – Store common phrases or words being translated by the user into a Local storage, resulting in fewer API calls and faster translations.
* 🔴 **Session Stored Storage** – Store all translations this session and have LingoSwap reuse those translations in case of repetition.
