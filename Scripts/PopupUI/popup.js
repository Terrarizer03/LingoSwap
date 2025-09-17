/* =====================>>> MAIN ENTRY POINT <<<===================== */
import { initializeUI, updateButtonState, addLoadingState } from './modules/ui.js';
import { getState, setState } from "./modules/state.js";
import { handleToggleComplete, handleAPIKeyError, handleReloading, handleTranslationProgress, handleTranslationComplete, updateTranslationProgress } from './modules/messageHandler.js';
import { sendContentMessage } from './modules/messaging.js';
import { hideMatchingLanguageOption } from './modules/languageUtils.js';
import { loadStoredSettings } from './modules/storage.js';
import { setupEventListeners } from './modules/eventHandlers.js';

// Initialize popup when DOM loads
document.addEventListener("DOMContentLoaded", async () => {
    try {
        // Initialize UI elements
        initializeUI();
        
        // Get current tab and set up main functionality
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const currentTabId = tabs[0].id;
        
        // Set active tab ID
        setState({ activeTabId: currentTabId });
        
        console.log(`tabId: ${currentTabId}`);

        // Load stored settings (dark mode, target language)
        await loadStoredSettings(currentTabId);

        // Wait for content script injection
        await waitForContentScript(currentTabId);

        // Setup event listeners with current state
        const currentState = getState();
        setupEventListeners({
            siteTranslated: currentState.siteTranslated,
            isTranslating: currentState.isTranslating,
            activeTabId: currentState.activeTabId,
            setSiteTranslated: (value) => setState({ siteTranslated: value }),
            setIsTranslating: (value) => setState({ isTranslating: value })
        });

        // Initialize page state
        await initializePageState(currentTabId);

        console.log('Popup initialization complete');
    } catch (error) {
        console.error('Failed to initialize popup:', error);
    }
});

async function waitForContentScript(tabId) {
    const loadingContainer = document.getElementById('loading-container');
    const mainContainer = document.getElementById('main-container');
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds max
        
        const timer = setInterval(async () => {
            attempts++;
            
            if (attempts > maxAttempts) {
                clearInterval(timer);
                reject(new Error('Content script injection timeout'));
                return;
            }
            
            try {
                const response = await sendContentMessage(tabId, { action: 'isInjected' });
                if (response?.injected) {
                    console.log("Content script ready!");
                    loadingContainer.classList.add('hidden');
                    mainContainer.classList.remove('hidden');
                    clearInterval(timer);
                    resolve(true);
                }
            } catch (error) {
                // Keep trying, but log errors every ten attempts
                if (attempts % 10 === 0) {
                    console.log(`Still waiting for content script... (attempt ${attempts})`);
                }
            }
        }, 100);
    });
}

async function initializePageState(tabId) {
    try {
        // Get translation state
        console.log('Getting translation state...');
        const translationState = await sendContentMessage(tabId, { action: 'getTranslationState' });
        console.log('Translation state received:', translationState);

        if (translationState) {
            updateButtonState(translationState.isTranslated, translationState.translationState);
            setState({ 
                siteTranslated: translationState.isTranslated,
                translatedTextFinished: translationState.textLength 
            });
        }

        // Get translation progress
        await updateTranslationProgress(tabId);

        // Check if currently translating
        console.log('Checking translation status...');
        const translatingResponse = await sendContentMessage(tabId, { action: 'translatingOrNot' });
        console.log('Translation status received:', translatingResponse);

        const translateBtn = document.getElementById('translate-btn');
        const loadingState = document.getElementById('loading-state');
        if (translatingResponse?.translationStatus) {
            translateBtn.textContent = "Translating...";
            addLoadingState(loadingState, true);
            setState({ isTranslating: true });
        } else {
            translateBtn.textContent = "Translate";
            addLoadingState(loadingState, false);
            setState({ isTranslating: false });
        }

        // Get language detection
        console.log('Getting language detection...');
        const languageResponse = await sendContentMessage(tabId, { action: 'dominantLanguage' });
        console.log('Language response received:', languageResponse);

        if (languageResponse?.language) {
            try {
                console.log(`Detected: ${languageResponse.language} (${languageResponse.confidence}% confidence)`);
                hideMatchingLanguageOption(languageResponse.language, tabId);
            } catch (error) {
                console.error('Failed in getting current tab:', error);
            }
        }
    } catch (error) {
        console.error('Error initializing page state:', error);
    }
}

// Message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'translationComplete':
            handleTranslationComplete(message);
            break;
        case 'APIKeyError':
            handleAPIKeyError();
            break;
        case 'reloading':
            handleReloading();
            break;
        case 'toggleComplete':
            handleToggleComplete(message);
            break;
        case 'translationProgress':
            handleTranslationProgress(message);
            break;
    }
});

