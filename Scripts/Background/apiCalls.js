// WORKS NOW YIPPEE

/* =====================>>> MAIN ENTRY POINT <<<===================== */

// Import all the modular handlers
import { 
    handleSaveAPIKey, 
    handlePerformTranslation,
    handleGetTranslationProgress 
} from './modules/messageHandlers.js';

import { deleteTargetLanguage } from '../PopupUI/modules/storage.js';
import { resetGlobalTranslationState } from './modules/backgroundUtils.js';
import { currentTranslationState, tabTranslationStates, tabAbortControllers } from './modules/state.js';

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
        console.error('Cannot listen to updated tab updates:', error)
    }
});

// Listen for tab removal updates
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    try {
        // Delete target language for specific tab.
        deleteTargetLanguage(tabId)
        console.log(`Deleted target language for closed tab ${tabId}`);
        
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
    } catch (error) {
        console.error('Cannot listen to tab removal updates:', error)
    }
});

// Main message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        switch (message.action) {
            case 'saveAPIKey':
                return handleSaveAPIKey(message, sendResponse);
                
            case 'performTranslation':
                handlePerformTranslation(message, sender, sendResponse);
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

