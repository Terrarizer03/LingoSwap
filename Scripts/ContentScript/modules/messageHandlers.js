// Currently an unused module as it's making issues, will integrate once I figure it out. 
// For now though, I'm too lazy... :P

/* =====================>>> MODULE FOR TEXTTRANSLATION.JS <<<===================== */

export async function handleTranslation(message, sendResponse) {
    activeTabId = message.tabId;
    console.log('Received request to get text nodes');

    try {
        isTranslating = true;
        await testTranslation(); // Wait for the full translation process
        sendResponse({ success: true, message: 'Translation complete' });
    } catch (err) {
        sendResponse({ success: false, message: 'Translation failed', error: err.message });
    }

    return true;
}

export async function handleDominantLanguage(message, sendResponse) {
    try {
        const result = await getSiteLanguage(document.body);
        sendResponse({ 
            language: result.language,
            confidence: result.confidence,
            isReliable: result.isReliable
        });
    } catch (error) {
        sendResponse({ 
            language: null, 
            error: error.message 
        });
    }

    return true;
}

export function handleDOMupdates(message, sendResponse) {
    console.log('Received translated text from background');
    const translatedText = message.translatedText;
    textLength = message.textLength;

    try {
        // Get the current elements (should match the ones we sent for translation)
        const elements = getFilteredTextElements(document.body);
        translatedTexts = translatedText;
        replaceWithTranslation(elements, translatedText);
        isTranslating = false;
        isTranslated = true;
        translationState = 'TranslatedText';
        chrome.runtime.sendMessage({
            action: 'translationComplete',
            tabId: activeTabId,
            translationState: isTranslated,
            textLength: textLength
        }); // Notify popup that translation is complete
        console.log('DOM updated with translations');
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error updating DOM:', error);
        sendResponse({ success: false, error: error.message });
    }

    return true;
}

export function handleShowOriginal(message, sendResponse) {
    console.log('Received toggle request for original/translated text.');
    const tabId = message.tabId;

    try {
        if (isTranslated) {
            if (translationState === 'TranslatedText') {
                restoreOriginalText();
                translationState = 'RawText';
                console.log('Restored original text.');
            } else {
                restoreTranslatedText();
                translationState = 'TranslatedText';
                console.log('Restored translated text.');
            }

            chrome.runtime.sendMessage({ 
                action: 'toggleComplete',
                state: translationState,
                tabId: tabId 
            });
        }
        sendResponse({ success: true });
    } catch (error) {
        console.error('Toggle failed:', error.message);
        sendResponse({ success: false, error: error.message });
    }

    return true;
}