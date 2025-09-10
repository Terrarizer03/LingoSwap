/* =====================>>> MODULE FOR APICALLS.JS <<<===================== */

import { sendContentMessage } from '../../PopupUI/modules/messaging.js'
import { performTranslation } from './textOutput.js'
import { currentTranslationState, tabTranslationStates, tabAbortControllers } from './state.js'
import { resetGlobalTranslationState, getStorageData, setStorageData, getCurrentTab, validateApiKey, sendProgressUpdate  } from './backgroundUtils.js';

export async function handleSaveAPIKey(message, sendResponse) {
    try {
        const apiKey = message.apiKey;
        
        // Validate API key format
        if (!apiKey || !/^[a-zA-Z0-9_-]{10,100}$/.test(apiKey)) {
            sendResponse({
                success: false,
                message: 'Invalid API key format'
            });
            return true;
        }

        await validateApiKey(apiKey);
        
        await setStorageData({ apiKey: apiKey });
        
        sendResponse({
            success: true,
            message: 'API key saved successfully'
        });
    } catch (error) {
        sendResponse({
            success: false,
            message: 'Failed to save API key: ' + error.message
        });
    }
}

export async function handlePerformTranslation(message, sender, sendResponse) {
    try {
        currentTranslationState.isTranslating = true;

        const textArray = message.textArray;
        const tabId = message.tabId;
        const tabLang = `targetLang_${tabId}`;

        // Get required data from storage
        const result = await getStorageData(['apiKey', tabLang]);
        const apiKey = result.apiKey || '';
        const targetLang = result[tabLang];
        
        console.log('Translate requested for tab:', tabId, 'Language:', targetLang);

        if (!apiKey || '') {
            chrome.runtime.sendMessage({
                action: 'APIKeyError',
            });
            
            sendResponse({ 
                success: false, 
                message: 'API key not found. Please set your API key first.' 
            });
            return;
        }

        // Initialize state for this tab
        tabTranslationStates[tabId] = {
            isTranslating: true,
            totalItems: textArray.length,
            translatedItems: 0,
            remainingItems: textArray.length
        };
        
        console.log(`Received ${textArray.length} texts to translate from tab ${tabId}`);

        // Create abort controller for this tab
        const abortController = new AbortController();
        tabAbortControllers[tabId] = abortController;

        // Send initial progress state 
        sendProgressUpdate(0, textArray.length, tabId);

        // Perform translation with abort controller
        const translatedArray = await performTranslation(textArray, targetLang, apiKey, tabId, abortController);
        
        // Clean up abort controller if translation completed successfully
        delete tabAbortControllers[tabId];
        
        // Send results back to the content script
        await sendContentMessage(tabId, {
            action: 'updateDOM',
            translatedText: translatedArray,
            textLength: textArray.length
        });
        
        console.log('Successfully sent translated text to content script');
        currentTranslationState.isTranslating = false;
        sendProgressUpdate(textArray.length, 0, tabId);
        sendResponse({ success: true });
        
    } catch (error) {
        currentTranslationState.isTranslating = false;
        console.error('Translation error:', error);
        
        // Clean up abort controller on error
        delete tabAbortControllers[tabId];
        
        // Check if error was due to abortion
        if (error.name === 'AbortError') {
            console.log(`Translation aborted for tab ${tabId}`);
            resetGlobalTranslationState();
            sendProgressUpdate(0, 0, tabId);
            
            sendResponse({ 
                success: false, 
                error: 'Translation was cancelled' 
            });
        } else {
            sendResponse({ 
                success: false, 
                error: error.message 
            });
        }
    }
}

export async function handleGetTranslationProgress(message, sendResponse) {
    try {
        const currentTab = await getCurrentTab();
        const tabId = currentTab.id;
        
        const state = tabTranslationStates[tabId] || {
            isTranslating: false,
            totalItems: 0,
            translatedItems: 0,
            remainingItems: 0
        };
        
        sendResponse({
            success: true,
            isTranslating: state.isTranslating,
            translated: state.translatedItems,
            remaining: state.remainingItems,
            totalItems: state.totalItems
        });
    } catch (error) {
        sendResponse({
            success: false,
            error: error.message
        });
    }
}