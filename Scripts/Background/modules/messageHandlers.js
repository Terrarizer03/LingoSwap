/* =====================>>> MODULE FOR APICALLS.JS <<<===================== */

import { sendContentMessage } from '../../PopupUI/modules/messaging.js';
import { performTranslation } from './textOutput.js'
import { currentTranslationState, tabTranslationStates, tabAbortControllers } from './state.js'
import { resetGlobalTranslationState, getStorageData, setStorageData, getCurrentTab, validateApiKey, sendProgressUpdate } from './backgroundUtils.js';

export async function handleTranslateRequest(message, sendResponse) {
    try {
        currentTranslationState.isTranslating = true;
        const { tabId } = message;
        
        const result = await getStorageData(['targetLang']);
        const targetLang = result.targetLang || 'English';
        
        console.log('Translate requested for tab:', tabId, 'Language:', targetLang);
        
        // Store the translation request details
        await setStorageData({ 
            currentTranslationRequest: { tabId, targetLang } 
        });
        
        // Forward the translate message to content script
        await sendContentMessage(tabId, {
            action: 'translate',
            tabId: tabId
        });
        
        sendResponse({ success: true, message: 'Translation initiated' });
    } catch (error) {
        sendResponse({ 
            success: false, 
            message: 'Error communicating with content script: ' + error.message 
        });
    }

    return true;
}

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

    return true;
}

export async function handleGetTextToTranslate(message, sender, sendResponse) {
    try {
        const textArray = message.textArray;
        const tabId = sender.tab.id;

        // Get required data from storage
        const result = await getStorageData(['apiKey', 'currentTranslationRequest', 'targetLang']);
        const apiKey = result.apiKey || '';
        const translationRequest = result.currentTranslationRequest;
        const targetLang = result.targetLang || 'English';
        
        if (!apiKey) {
            chrome.runtime.sendMessage({
                action: 'APIKeyError',
            });
            
            sendResponse({ 
                success: false, 
                message: 'API key not found. Please set your API key first.' 
            });
            return;
        }

        if (!translationRequest) {
            sendResponse({ 
                success: false, 
                message: 'Translation request details not found.' 
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
    
    return true;
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

    return true;
}