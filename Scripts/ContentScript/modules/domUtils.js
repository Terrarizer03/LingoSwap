/* =====================>>> MODULE FOR TEXTTRANSLATION.JS <<<===================== */

// DOM Traversal function
export function getFilteredTextElements(root) {
    const elements = [];
    
    // If root is document.body, also extract head elements
    if (root === document.body) {
        if (document.title && document.title.trim() !== "" && shouldIncludeText(document.title.trim())) {
            elements.push({
                node: document.head.querySelector('title'), // Still store the element node for consistency
                type: 'page-title',
                originalText: document.title,
                trimmedText: sanitizeText(document.title.trim()),
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
                trimmedText: sanitizeText(value.trim()),
                attribute: attrName,
                leadingWhitespace: value.match(/^\s*/)[0],
                trailingWhitespace: value.match(/\s*$/)[0]
            });
        }
    }

    function move(elem) {
        // Skip svg tags
        if (elem.closest && elem.closest('svg')) return;
        
        // Skip script, iframe, and style tags
        const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'NOSCRIPT', 'OBJECT', 'EMBED', 'CANVAS']);
        if (elem.tagName && SKIPPED_TAGS.has(elem.tagName.toUpperCase())) return;

        // If element is hidden, skip it
        if (elem.nodeType === Node.ELEMENT_NODE) {
            const computedStyle = getComputedStyle(elem);
            if (elem.isContentEditable) return;
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
                    const leadingMatch = originalText.match(/^\s*/);
                    const trailingMatch = originalText.match(/\s*$/);
                    elements.push({
                        node: node,
                        type: 'text',
                        originalText: originalText, // Store original text with all spacing
                        trimmedText: sanitizeText(trimmedText),   // Store trimmed text for translation
                        // Store leading and trailing whitespace patterns
                        leadingWhitespace: leadingMatch ? leadingMatch[0] : '',
                        trailingWhitespace: trailingMatch ? trailingMatch[0] : ''
                    });
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                move(node);
            }
        });
    }

    function sanitizeText(text) {
        return text.replace(/[<>&"']/g, function(match) {
            return {
                '<': '&lt;',
                '>': '&gt;',
                '&': '&amp;',
                '"': '&quot;',
                "'": '&#x27;'
            }[match];
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
export function replaceWithTranslation(elements, translations) {
    if (!elements || !Array.isArray(elements)) {
        throw new Error('Elements must be a valid array');
    }
    
    if (!translations || !Array.isArray(translations)) {
        throw new Error('Translations must be a valid array');
    }

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
    return { translationState : 'TranslatedText' };
}

// Create storage object for original texts and elements
export function createTextStorage(elements) {
    if (!elements || !Array.isArray(elements)) {
        throw new Error('Elements must be a valid array');
    }

    const originalTexts = elements.map(elem => elem.originalText);
    console.log(`Created storage for ${originalTexts.length} original texts`);
    
    return { 
        originalTexts, 
        originalElements: elements,
        // Helper methods for this storage
        restoreOriginal() {
            return restoreTexts(this.originalElements, this.originalTexts);
        }
    };
}

// Generic function to restore any texts to elements
export function restoreTexts(elements, texts) {
    if (!elements || elements.length === 0) {
        console.error('No elements provided for restoration.');
        return false;
    }

    if (!texts || texts.length === 0) {
        console.error('No texts provided for restoration.');
        return false;
    }

    try {
        if (elements.length !== texts.length) {
            console.warn(`Element count mismatch: ${elements.length} elements vs ${texts.length} texts`);
        }
        
        elements.forEach((elem, index) => {
            if (texts[index] !== undefined) {
                restoreTextToElement(elem, texts[index]);
            }
        });
        
        console.log('Texts restored successfully');
        return true;
        
    } catch (error) {
        console.error('Error restoring texts:', error.message);
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

// Restores the text to the element
export function restoreTextToElement(elem, text) {
    if (!elem || !elem.type) {
        throw new Error('Invalid element object provided');
    }

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
        throw error;
    }
}