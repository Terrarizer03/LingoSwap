/* =====================>>> MODULE FOR TEXTTRANSLATION.JS <<<===================== */

import { getFilteredTextElements } from "./domUtils";

// Get Site's dominant language | actual nightmare to implement.
export async function getSiteLanguage(root) {
    const textElements = getFilteredTextElements(root);
    
    // Extract the actual text from the element objects
    const textArray = textElements.map(element => element.trimmedText || element.originalText || '');
    const arrayCombined = textArray.join(" ");
    
    // Check if we have enough text for reliable detection
    if (!arrayCombined || arrayCombined.length < 10) {
        return {
            language: 'und', // undetermined
            isReliable: false,
            confidence: 0
        };
    }
    
    try {
        const result = await chrome.i18n.detectLanguage(arrayCombined);
        
        // Return the primary language with additional info
        if (result.isReliable && result.languages.length > 0) {
            return {
                language: result.languages[0].language,
                isReliable: result.isReliable,
                confidence: result.languages[0].percentage,
                allDetections: result.languages // All detected languages with percentages
            };
        } else {
            return {
                language: result.languages.length > 0 ? result.languages[0].language : 'und',
                isReliable: false,
                confidence: result.languages.length > 0 ? result.languages[0].percentage : 0,
                allDetections: result.languages
            };
        }
    } catch (error) {
        console.error('Language detection failed:', error);
        return {
            language: 'und',
            isReliable: false,
            confidence: 0,
            error: error.message
        };
    }
}