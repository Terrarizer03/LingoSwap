# LingoSwap Chrome Extension

A Chrome extension that automatically translates websites / web-pages to the selected language using AI to keep the correct tone, context, and ideas.

Main focus:
- To have web-pages load and the extension automatically translate any non-selected language that’s detected to the selected language.
- To lessen misunderstandings when reading foreign languages in websites.
- For the translation to be as close in idea to the non-translated text as possible.

What problem(s) does this solve?:
- Traditional translator tools often struggle in maintaining natural fluency and context when translating different languages. Thus, when reading articles, literature, or texts in a foreign language, it becomes easy to misunderstand the original text.

When do you use this extension?:
- The extension is used for needing accurate translations from web-pages or websites that are not in the specified language. Do note that this extension cannot translate text inside images.

Where can this extension be usable?:
- It can be used in Chrome, all Chromium-based browsers and other browser types that support Chrome Extensions or have extensions of their own.

Why create this extension?:
- The creation of this extension stems from my love of light novels. I read light novels extremely often, but it frustrated me that I couldn’t read untranslated chapters of light novels from different languages. And it certainly didn’t help when translating using Google Translate or any translation software as the output generated would always be confusing or downright unreadable. Thus, after a bit of thinking, I deduced that using AI would be the right solution.

Who is the target for this extension?:
- The target audience for this extension are mainly light novel readers like me, people who want more accurate translations on text from websites, journalists in need of accurate information on articles, and so on.

How does it solve the specified problem(s)?:
- This extension is built to use AI as it was intended to do. ChatBots are built for conversation, thus it has much higher accuracy when translating different languages, which helps in retaining the key concepts, ideas, and context of the text.

How it works:
- When a webpage opens, a script is sent and extracts every HTML tag with text and text nodes. These tags are then pushed into an array, which is then sent to an AI to be translated. Once the AI returns the translated text as an Array, it replaces the old text with the new, translated one.
