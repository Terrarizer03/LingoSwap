//Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        console.log('Received request to get text nodes');
        testTranslation(); // Call the translation function
        sendResponse({ success: true, message: 'Translation initiated' });
    }
});


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
    } // <-- This closing brace was missing!

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

const filteredElements = getFilteredTextElements(document.body);
const textsToTranslate = filteredElements.map(elem => elem.textContent.trim());

console.log(`Found ${filteredElements.length} elements to translate`);

// Mock translation function
// =========================
async function mockTranslate(texts) {
    // Replace with actual translation API call
    return texts.map(text => {
        // Mock translation logic
        return `[EN]: ${text}`
    });
}

// Replace text elements with translations function
// =========================================
function replaceWithTranslation(elements, translations) {
    if (elements.length !== translations.length) { 
        console.error(`Error: Elements count: ${elements.length} and translations count: ${translations.length} mismatch`);
        return;
    }

    elements.forEach((elem, index) => {
       if (translations[index]) {
            elem.textContent = translations[index]; // Replace element text with translation
       }
    });

    console.log('Replaced elements with translations');
}

async function testTranslation() {
    console.log('Starting translation test...');

    // Get elements and texts
    const elements = getFilteredTextElements(document.body);
    const texts = elements.map(elem => elem.textContent.trim());

    console.log(`Processing ${texts.length} texts for translation...`);

    // Mock translation
    const translations = await mockTranslate(texts);

    // Replace in DOM
    replaceWithTranslation(elements, translations);

    console.log('Translation test completed');
}

// Store original text for later rollback
let originalText = [];
function storeOriginalText() {
    const elements = getFilteredTextElements(document.body);
    originalText = elements.map(elem => elem.textContent.trim());
    console.log(`${originalText.length} lines of original text stored.`);
}

function restoreOriginalText() {
    if (originalText.length === 0) {
        console.error('No original text stored to restore.');
        return;
    }

    const elements = getFilteredTextElements(document.body);
    elements.forEach((elem, index) => {
        if (originalText[index]) {
            elem.textContent = originalText[index]; // Restore original text
        }
    });
}