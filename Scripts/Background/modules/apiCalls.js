// WORKS NOW YIPPEE

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
    try {
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
    } catch (error) {
        console.error('Cannot listen to tab updates:', error)
    }
});

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case 'translate':
                handleTranslateRequest(message, sendResponse);
                return true;
                
            case 'saveAPIKey':
                return handleSaveAPIKey(message, sendResponse);
                
            case 'getTextToTranslate':
                handleGetTextToTranslate(message, sender, sendResponse);
                return true;
                
            case 'getTranslationProgress':
                handleGetTranslationProgress(message, sendResponse);
                return true;
            
            case 'toggleComplete':
                sendResponse({ success: true });
                return true;
            
            case 'translationComplete':
                sendResponse({success: true });
                return true;

            default:
                // Handle unknown actions gracefully
                console.warn(`Unknown action: ${message.action}`);
                sendResponse({ 
                    success: false, 
                    error: `Unknown action: ${message.action}` 
                });
                return false;
        }
    } catch (error) {
        console.error('Failed in returning message:', error)
    }
});

