//Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        console.log('Received request to get text nodes');
        testTranslation();
        sendResponse({ success: true, message: 'Translation initiated' });
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
            return; // Skip script, iframe, and style elements
        }

        // If element is hidden, skip it
        const computedStyle = getComputedStyle(elem);
        if (computedStyle.display === 'none' ||
            computedStyle.visibility === 'hidden') {
            return; // Skip hidden elements
        }

        if (elem.children.length > 0) {
            Array.from(elem.children).forEach(move); // Recursively process child elements
        } else if (elem.textContent.trim() !== "") {
            const text = elem.textContent.trim();

            if (shouldIncludeText(text)) {
                elements.push(elem); // Add element if it contains valid text
            }      
        }
    }

    function shouldIncludeText(text) {
        // Skip CSS code (contains specific CSS syntax)
        if (text.includes('{') && text.includes('}') &&
            (text.includes('position:') || text.includes('font-size:') ||
             text.includes('background-color:') || text.includes('padding:'))) {
            return false; // Skip CSS-like text
        }

        // Skip very long CSS-like strings (over 100 chars with lots of CSS properties)
        if (text.length > 100 &&
            (text.includes('position:') || text.includes('background-color:'))) {
            return false; // Skip long CSS-like text
        }
        
        return true;
    }

    move(root); // Start processing from the root element
    return elements;
}

const filteredText = getFilteredTextElements(document.body);
const translateText = filteredText.map(elem => elem.textContent.trim());

console.log(translateText);
console.log(`Found ${getFilteredTextElements(document.body).length} text elements to process`);

// Mock translation function with error simulation
async function mockTranslate(texts) {
    // Prevent API call if already translated
    if (isTranslated) {
        console.log('Already translated - skipping API call to save tokens');
        return [];
    }
    
    try {
        // Simulate potential network/API errors (uncomment to test error handling)
        // if (Math.random() < 0.3) { // 30% chance of error
        //     throw new Error('Translation API failed');
        // }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Replace with actual translation API call
        return texts.map(text => {
            // Mock translation logic
            return `${translatedText}`;
        });
    } catch (error) {
        console.error('Translation API error:', error);
        throw error; // Re-throw to be handled by caller
    }
}

// Replace text elements with translations function
function replaceWithTranslation(elements, translations) {
    if (elements.length !== translations.length) { 
        console.error(`Error: Elements count: ${elements.length} and translations count: ${translations.length} mismatch`);
        throw new Error('Element and translation count mismatch');
    }

    elements.forEach((elem, index) => {
       if (translations[index]) {
            elem.textContent = translations[index]; // Replace element text with translation
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

        // Attempt translation
        const translations = await mockTranslate(texts);

        // Replace in DOM
        replaceWithTranslation(elements, translations);

        // Mark as translated
        isTranslated = true;
        console.log('Translation completed successfully');

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
        
        // You could also show a user notification here
        // alert('Translation failed. Please try again.');
    }
}

// Store original text for later rollback (kept for backward compatibility)
let originalText = [];
function storeOriginalText() {
    const elements = getFilteredTextElements(document.body);
    originalText = elements.map(elem => elem.textContent.trim());
    console.log(`${originalText.length} lines of original text stored.`);
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