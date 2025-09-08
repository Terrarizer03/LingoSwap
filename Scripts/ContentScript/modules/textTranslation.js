/* 

    To any collaborator, please do "npm install -g esbuild" and switch out 
    the DOMextraction.js everytime you do a change in the content script's
    modules. Also remember that textTranslation.js is the entry point for
    the entire content script. So if you're bundling, bundle this file.
    Thank you.

*/

/* =====================>>> MAIN ENTRY POINT <<<===================== */

import { sendRuntimeMessage } from '../../PopupUI/modules/messaging.js';
import { getFilteredTextElements,  replaceWithTranslation,  createTextStorage, restoreTexts } from './domUtils.js';
import { getSiteLanguage } from './languageDetection.js';

// Debug: Log when content script loads
console.log('Translation content script loaded');
console.log(`Found ${getFilteredTextElements(document.body).length} text elements on page load`);

// Translation state management
let textLength = null;
let activeTabId = null;
let isTranslating = false;
let isTranslated = false;
let translationState = 'RawText';
let textStorage = null; // Will hold the storage object from domUtils
let translatedTexts = [];

// Enhanced translation function with error handling and state management (Entrance Point To Translation)
async function testTranslation() {
    console.log('Starting translation test...');

    // Check if already translated
    if (isTranslated) {
        console.log('Page is already translated. Skipping translation.');
        return;
    }

    try {
        // Get elements and texts
        const elements = getFilteredTextElements(document.body);
        const texts = elements.map(elem => elem.trimmedText); // Use trimmedText instead of processing again

        if (texts.length === 0) {
            console.log('No texts found to translate');
            return;
        }

        console.log(`Processing ${texts.length} texts for translation...`);

        // Create storage for original texts before translation
        textStorage = createTextStorage(elements);

        // Send text to background script for translation
        try {
            const getTextToTranslate = await sendRuntimeMessage({ action: 'getTextToTranslate', textArray: texts });
            if (getTextToTranslate && getTextToTranslate.success) {
                console.log('Text elements sent for translation:', texts.length);
            } else {
                // Reset state on failure
                isTranslated = false;
                isTranslating = false;
                textStorage = null;
            };
        } catch (error) {
            console.error('Failed to get text: ', error);
        }

    } catch (error) {
        console.error('Translation failed:', error.message);
        
        // If we had started storing original texts but translation failed,
        // we should restore the page to its original state
        if (textStorage) {
            console.log('Attempting to restore original text due to translation failure...');
            try {
                textStorage.restoreOriginal();
            } catch (restoreError) {
                console.error('Failed to restore original text:', restoreError.message);
            }
        }
        
        // Reset translation state
        isTranslated = false;
        textStorage = null;
    }
}

function restoreTranslatedText() {
    if (translatedTexts.length === 0) {
        console.error('No translated text stored to restore.');
        return;
    }

    if (!textStorage || !textStorage.originalElements) {
        console.error('No original elements stored.');
        return;
    }

    try {
        restoreTexts(textStorage.originalElements, translatedTexts);
        console.log('Translated text restored successfully');
    } catch (error) {
        console.error('Error restoring translated text:', error.message);
        throw error;
    }
}

function restoreOriginalText() {
    if (!textStorage) {
        console.error('No text storage available to restore from.');
        return;
    }

    try {
        textStorage.restoreOriginal();
        console.log('Original text restored successfully');
    } catch (error) {
        console.error('Error restoring original text:', error.message);
        throw error;
    }
}

//Listen for messages from popup via background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "isInjected":
            sendResponse({ injected: true });
            return true;
        case "dominantLanguage":
            handleDominantLanguage(message, sendResponse);
            return true;
        case "translate":
            return handleTranslation(message, sendResponse);
        case "translatingOrNot":
            sendResponse({
                success: true,
                translationStatus: isTranslating
            });
            return true;
        case "updateDOM":
            return handleDOMupdates(message, sendResponse);
        case "showOriginal":
            return handleShowOriginal(message, sendResponse);
        case "getTranslationState":
            sendResponse({ 
                isTranslated, 
                translationState, 
                textLength 
            });
            return true;
    }   
});

async function handleTranslation(message, sendResponse) {
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

async function handleDominantLanguage(message, sendResponse) {
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
}

async function handleDOMupdates(message, sendResponse) {
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

function handleShowOriginal(message, sendResponse) {
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