/* =====================>>> MAIN ENTRY POINT <<<===================== */

// Import all the modular handlers
import { 
    handleTranslateRequest, 
    handleSaveAPIKey, 
    handleGetTextToTranslate,
    handleGetTranslationProgress 
} from './messageHandlers.js';

import { resetGlobalTranslationState } from './backgroundUtils.js';
import { currentTranslationState, tabTranslationStates, tabAbortControllers } from './state.js';

// Listen for tab updates (including reloads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tabTranslationStates[tabId]) {
        console.log(`Tab ${tabId} is reloading, clearing translation state`);

        chrome.runtime.sendMessage({
            action: 'reloading'
        });
        
        // Abort ongoing translation for this tab
        if (tabAbortControllers[tabId]) {
            console.log(`Aborting translation for tab ${tabId}`);
            tabAbortControllers[tabId].abort();
            delete tabAbortControllers[tabId];
        }
        
        // Clear translation state for this tab
        delete tabTranslationStates[tabId];
        
        if (currentTranslationState.isTranslating && currentTranslationState.tabId === tabId) {
            resetGlobalTranslationState();
        }   
    }
});

// Main message listener - clean and simple
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'translate':
            return handleTranslateRequest(message, sendResponse);
            
        case 'saveAPIKey':
            return handleSaveAPIKey(message, sendResponse);
            
        case 'getTextToTranslate':
            return handleGetTextToTranslate(message, sender, sendResponse);
            
        case 'getTranslationProgress':
            return handleGetTranslationProgress(message, sendResponse);
            
        default:
            // Handle unknown actions gracefully
            console.warn(`Unknown action: ${message.action}`);
            sendResponse({ 
                success: false, 
                error: `Unknown action: ${message.action}` 
            });
            return false;
    }
});

