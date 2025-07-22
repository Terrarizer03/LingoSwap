//Listen for messages from popup via background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        activeTabId = message.tabId;
        console.log('Received request to get text nodes');

        (async () => {
            try {
                isTranslating = true;
                await testTranslation(); // Wait for the full translation process
                sendResponse({ success: true, message: 'Translation complete' });
            } catch (err) {
                sendResponse({ success: false, message: 'Translation failed', error: err.message });
            }
        })();

        return true; // Tell Chrome this response is async
    }

    if (message.action === 'translatingOrNot') {
        sendResponse({
            success: true,
            translationStatus: isTranslating
        })
    }
    
    // Listen for translated text from background script
    if (message.action === 'updateDOM') {
        console.log('Received translated text from background');
        const translatedText = message.translatedText;
        
        try {
            // Get the current elements (should match the ones we sent for translation)
            const elements = getFilteredTextElements(document.body);
            translatedTexts = translatedText;
            replaceWithTranslation(elements, translatedText);
            isTranslating = false;
            isTranslated = true;
            chrome.runtime.sendMessage({
                action: 'translationComplete',
                tabId: activeTabId
            }); // Notify popup that translation is complete
            console.log('DOM updated with translations');
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error updating DOM:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // For async response
    }

    if (message.action === 'showOriginal') {
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
    if (message.action === 'getTranslationState') {
        sendResponse({ isTranslated, translationState })
    }
});

// Translation state management
let activeTabId = null;
let isTranslating = false;
let isTranslated = false;
let translationState = 'RawText';
let originalTexts = [];
let translatedTexts = [];

function getFilteredTextElements(root) {
    const elements = [];
    
    // If root is document.body, also extract head elements
    if (root === document.body) {
        if (document.title && document.title.trim() !== "" && shouldIncludeText(document.title.trim())) {
            elements.push({
                node: document.head.querySelector('title'), // Still store the element node for consistency
                type: 'page-title',
                originalText: document.title,
                trimmedText: document.title.trim(),
                leadingWhitespace: document.title.match(/^\s*/)[0],
                trailingWhitespace: document.title.match(/\s*$/)[0]
            });
        }
    }

    function pushIfValidAttr(elem, attrName, type) {
        const value = elem.getAttribute(attrName) || '';
        if (value && value.trim() !== "" && shouldIncludeText(value.trim())) {
            elements.push({
                node: elem,
                type: type,
                originalText: value,
                trimmedText: value.trim(),
                attribute: attrName,
                leadingWhitespace: value.match(/^\s*/)[0],
                trailingWhitespace: value.match(/\s*$/)[0]
            });
        }
    }

    function move(elem) {
        // Skip script, iframe, and style tags
        const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME'])
        if (elem.tagName && SKIPPED_TAGS.has(elem.tagName.toUpperCase())) return;

        // If element is hidden, skip it
        if (elem.nodeType === Node.ELEMENT_NODE) {
            const computedStyle = getComputedStyle(elem);
            if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;
        }

        // Extract attribute text from the current element
        if (elem.nodeType === Node.ELEMENT_NODE) {
            extractAttributeText(elem);
        }

        // Process all child nodes (including text nodes)
        Array.from(elem.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const originalText = node.textContent;
                const trimmedText = originalText.trim();
                
                if (trimmedText !== "" && shouldIncludeText(trimmedText)) {
                    elements.push({
                        node: node,
                        type: 'text',
                        originalText: originalText, // Store original text with all spacing
                        trimmedText: trimmedText,   // Store trimmed text for translation
                        // Store leading and trailing whitespace patterns
                        leadingWhitespace: originalText.match(/^\s*/)[0],
                        trailingWhitespace: originalText.match(/\s*$/)[0]
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                move(node);
            }
        });
    }

    function extractAttributeText(elem) {
        pushIfValidAttr(elem, 'title', 'title');
        pushIfValidAttr(elem, 'alt', 'alt');
        pushIfValidAttr(elem, 'placeholder', 'placeholder');
        pushIfValidAttr(elem, 'aria-label', 'aria-label');

        // Extract value attribute for input elements (if it contains user-visible text)
        if (elem.tagName && (elem.tagName.toUpperCase() === 'INPUT' || elem.tagName.toUpperCase() === 'BUTTON')) {    
            const inputType = elem.type ? elem.type.toLowerCase() : 'text';
            if (['button', 'submit', 'reset'].includes(inputType)) {
                pushIfValidAttr(elem, 'value', 'value');
            }
        }
    }

    function shouldIncludeText(text) {
        // Skip CSS code (contains specific CSS syntax)
        if (text.includes('{') && text.includes('}') &&
            (text.includes('position:') || text.includes('font-size:') ||
             text.includes('background-color:') || text.includes('padding:'))) {
            return false;
        }

        // Skip very long CSS-like strings (over 100 chars with lots of CSS properties)
        if (text.length > 100 &&
            (text.includes('position:') || text.includes('background-color:'))) {
            return false;
        }
        
        return true;
    }

    move(root);
    return elements;
}

// Replace text elements with translations function
function replaceWithTranslation(elements, translations) {
    if (elements.length !== translations.length) { 
        console.error(`Error: Elements count: ${elements.length} and translations count: ${translations.length} mismatch`);
        throw new Error('Element and translation count mismatch');
    }

    elements.forEach((elem, index) => {
       if (translations[index]) {
            restoreTextToElement(elem, translations[index]);
       }
    });

    console.log('Replaced elements with translations');
    translationState = 'TranslatedText'
}

// Enhanced translation function with error handling and state management
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

        // Store original texts before translation
        storeOriginalTexts(elements);

        // Send text to background script for translation
        chrome.runtime.sendMessage({
            action: 'getTextToTranslate',
            textArray: texts
        }, (response) => {
            if (response && response.success) {
                console.log('Text elements sent for translation:', texts.length);
            } else {
                // Reset state on failure
                isTranslated = false;
                isTranslating = false;
                originalTexts = [];
            }
        });

    } catch (error) {
        console.error('Translation failed:', error.message);
        
        // If we had started storing original texts but translation failed,
        // we should restore the page to its original state
        if (originalTexts.length > 0) {
            console.log('Attempting to restore original text due to translation failure...');
            try {
                restoreOriginalText();
            } catch (restoreError) {
                console.error('Failed to restore original text:', restoreError.message);
            }
        }
        
        // Reset translation state
        isTranslated = false;
        originalTexts = [];
    };
}

// Store both original text AND the elements themselves
function storeOriginalTexts(elements) {
    originalTexts = elements.map(elem => elem.originalText);
    // Store the actual elements for precise restoration
    originalElements = elements; // Keep reference to the exact elements
    console.log(`Stored ${originalTexts.length} original texts`);
}

function restoreTranslatedText() {
    if (translatedTexts.length === 0) {
        console.error('No translated text stored to restore.');
        return;
    }

    if (!originalElements || originalElements.length === 0) {
        console.error('No original elements stored.');
        return;
    }

    try {
        if (originalElements.length !== translatedTexts.length) {
            console.warn(`Element count mismatch: ${originalElements.length} elements vs ${translatedTexts.length} translated texts`);
        }

        originalElements.forEach((elem, index) => {
            if (translatedTexts[index] !== undefined) {
                restoreTextToElement(elem, translatedTexts[index]);
            }
        });

        console.log('Translated text restored successfully');
    } catch (error) {
        console.error('Error restoring translated text:', error.message);
        throw error;
    }
}

function restoreOriginalText() {
    const textsToRestore = originalTexts.length > 0 ? originalTexts : [];
    
    if (textsToRestore.length === 0) {
        console.error('No original text stored to restore.');
        return;
    }

    if (!originalElements || originalElements.length === 0) {
        console.error('No original elements stored.');
        return;
    }

    try {
        if (originalElements.length !== textsToRestore.length) {
            console.warn(`Element count mismatch: ${originalElements.length} elements vs ${textsToRestore.length} stored texts`);
        }
        
        originalElements.forEach((elem, index) => {
            if (textsToRestore[index] !== undefined) {
                restoreTextToElement(elem, textsToRestore[index]);
            }
        });
        
        console.log('Original text restored successfully');
        
    } catch (error) {
        console.error('Error restoring original text:', error.message);
        throw error;
    }
}

const elementRestorers = {
    'text': (elem, text) => {
        const newText = elem.leadingWhitespace + text + elem.trailingWhitespace;
        elem.node.textContent = newText;
    },
    'title': (elem, text) => elem.node.title = text,
    'alt': (elem, text) => elem.node.alt = text,
    'placeholder': (elem, text) => elem.node.placeholder = text,
    'aria-label': (elem, text) => elem.node.setAttribute('aria-label', text),
    'value': (elem, text) => elem.node.value = text,
    'page-title': (elem, text) => document.title = text
};


// Helper function to restore text to the correct location based on element type
function restoreTextToElement(elem, text) {
    try {
        const restorer = elementRestorers[elem.type];
        
        if (restorer) {
            restorer(elem, text);
        } else {
            // Fallback for unknown types
            console.warn(`Unknown element type: ${elem.type}`);
            if (elem.attribute) {
                elem.node.setAttribute(elem.attribute, text);
            } else {
                const newText = elem.leadingWhitespace + text + elem.trailingWhitespace;
                elem.node.textContent = newText;
            }
        }
    } catch (error) {
        console.error(`Error restoring text for element type ${elem.type}:`, error);
    }
}

// Debug: Log when content script loads
console.log('Translation content script loaded');
console.log(`Found ${getFilteredTextElements(document.body).length} text elements on page load`);