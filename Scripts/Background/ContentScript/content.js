//Listen for messages from popup via background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        console.log('Received request to get text nodes');

        (async () => {
            try {
                await testTranslation(); // Wait for the full translation process
                sendResponse({ success: true, message: 'Translation complete' });
            } catch (err) {
                sendResponse({ success: false, message: 'Translation failed', error: err.message });
            }
        })();

        return true; // Tell Chrome this response is async
    }
    
    // Listen for translated text from background script
    if (message.action === 'updateDOM') {
        console.log('Received translated text from background');
        const translatedText = message.translatedText;
        
        try {
            // Get the current elements (should match the ones we sent for translation)
            const elements = getFilteredTextElements(document.body);
            replaceWithTranslation(elements, translatedText);
            isTranslated = true;
            console.log('DOM updated with translations');
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error updating DOM:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // For async response
    }
});

// Translation state management
let isTranslated = false;
let originalTexts = [];

function getFilteredTextElements(root) {
    const elements = [];
        
    function move(elem) {
        // Skip script, iframe, and style tags
        if (elem.tagName.toUpperCase() === 'SCRIPT' ||
            elem.tagName.toUpperCase() === 'IFRAME' ||
            elem.tagName.toUpperCase() === 'STYLE') {
            return;
        }

        // If element is hidden, skip it
        const computedStyle = getComputedStyle(elem);
        if (computedStyle.display === 'none' ||
            computedStyle.visibility === 'hidden') {
            return;
        }

        // Process all child nodes (including text nodes)
        Array.from(elem.childNodes).forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
                // Handle text nodes directly
                const text = node.textContent.trim();
                if (text !== "" && shouldIncludeText(text)) {
                    elements.push(node);
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Recursively process element nodes
                move(node);
            }
        });
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
            // Handle both text nodes and element nodes
            if (elem.nodeType === Node.TEXT_NODE) {
                elem.textContent = translations[index];
            } else {
                elem.textContent = translations[index];
            }
       }
    });

    console.log('Replaced elements with translations');
}

// Store original text before translation
function storeOriginalTexts(elements) {
    originalTexts = elements.map(elem => elem.textContent.trim());
    console.log(`Stored ${originalTexts.length} original texts`);
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
        const texts = elements.map(elem => elem.textContent.trim());

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
                console.error('Failed to send text for translation:', response?.error);
                // Reset state on failure
                isTranslated = false;
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

// Store original text for later rollback (kept for backward compatibility)
let originalText = [];
function storeOriginalTexts(elements) {
    originalTexts = elements.map(elem => {
        // Handle both text nodes and element nodes
        if (elem.nodeType === Node.TEXT_NODE) {
            return elem.textContent.trim();
        } else {
            return elem.textContent.trim();
        }
    });
    console.log(`Stored ${originalTexts.length} original texts`);
}

function restoreOriginalText() {
    const textsToRestore = originalTexts.length > 0 ? originalTexts : originalText;
    
    if (textsToRestore.length === 0) {
        console.error('No original text stored to restore.');
        return;
    }

    try {
        const elements = getFilteredTextElements(document.body);
        
        if (elements.length !== textsToRestore.length) {
            console.warn(`Element count mismatch: ${elements.length} elements vs ${textsToRestore.length} stored texts`);
        }
        
        elements.forEach((elem, index) => {
            if (textsToRestore[index]) {
                elem.textContent = textsToRestore[index]; // Restore original text
            }
        });
        
        // Reset translation state
        isTranslated = false;
        console.log('Original text restored successfully');
        
    } catch (error) {
        console.error('Error restoring original text:', error.message);
        throw error;
    }
}

// Debug: Log when content script loads
console.log('Translation content script loaded');
console.log(`Found ${getFilteredTextElements(document.body).length} text elements on page load`);
console.log(getFilteredTextElements(document.body).map(elem => elem.textContent.trim())); // Log first 10 text elements