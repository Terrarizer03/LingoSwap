/* =====================>>> MODULE FOR APICALLS.JS <<<===================== */

import { currentTranslationState, tabTranslationStates } from "./state";

// Helper function to reset global state
export function resetGlobalTranslationState() {
    currentTranslationState.isTranslating = false;
    currentTranslationState.totalItems = 0;
    currentTranslationState.translatedItems = 0;
    currentTranslationState.remainingItems = 0;
    currentTranslationState.tabId = null;
}

// Helper function to get storage data
export async function getStorageData(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
}

// Helper function to set storage data
export async function setStorageData(data) {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

// Helper function to get current active tab
export async function getCurrentTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            resolve(tabs[0]);
        });
    });
}

// Helper function to check if API key is valid
export async function validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('Invalid API key format');
    }
    if (apiKey.length < 10 || apiKey.length > 100) {
        throw new Error('API key length is suspicious');
    }
    // Add more validation as needed
    return true;
}

// Function for Sending Progress to Popup
export function sendProgressUpdate(translated, remaining, tabId) {
    // Update state for specific tab
    if (tabTranslationStates[tabId]) {
        tabTranslationStates[tabId].translatedItems = translated;
        tabTranslationStates[tabId].remainingItems = remaining;
    }
    
    chrome.runtime.sendMessage({
        action: 'translationProgress',
        translated,
        remaining,
        tabId
    }).catch(error => console.error(`Failed to send progress update for tab ${tabId}:`, error));;
};

// Utility functions
export function chunkArray(array, chunkSize, charCount) {
    const chunks = [];
    let currentChunk = [];
    let currentCharCount = 0;

    for (const elem of array) {
        const elemLength = elem.length;

        currentChunk.push(elem);
        currentCharCount += elemLength;

        // Check if either chunkSize or charCount limit is exceeded or met
        if (currentChunk.length >= chunkSize || currentCharCount >= charCount) {
            chunks.push(currentChunk);
            currentChunk = [];
            currentCharCount = 0;
        }
    }  

    // If there's anything left that hasn't met the conditions above,
    // then automatically push to chunks
    if (currentChunk.length > 0) chunks.push(currentChunk);

    return chunks;
}

// Enhanced delay function with abort controller support
export function delay(ms, abortController) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        
        // Listen for abort signal
        if (abortController) {
            abortController.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Translation aborted'));
            });
        }
    });
}

// Enhanced parsing with better error handling
export function parseNumberedResponse(response, expectedLength) {
    const lines = response.trim().split('\n');
    const translatedArray = [];
    
    for (let i = 0; i < expectedLength; i++) {
        const numberPrefix = `${i + 1}.`;
        const line = lines.find(l => l.trim().startsWith(numberPrefix));
        
        if (line) {
            const translated = line.substring(line.indexOf('.') + 1).trim();
            translatedArray.push(translated);
        } else {
            // Better fallback - try to find any line that might correspond
            const fallbackLine = lines[i];
            if (fallbackLine && fallbackLine.trim()) {
                // Remove any number prefix if it exists
                const cleaned = fallbackLine.replace(/^\d+\.\s*/, '').trim();
                translatedArray.push(cleaned || `[Parse Error] Item ${i + 1}`);
            } else {
                translatedArray.push(`[Parse Error] Item ${i + 1}`);
            }
        }
    }
    
    return translatedArray;
}