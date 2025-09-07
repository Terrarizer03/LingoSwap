// popup.js - Main entry point
import { initializeUI, updateButtonState, resetTranslationUI, addLoadingState, addShakeAnimation } from './modules/ui.js';
import { sendContentMessage } from './modules/messaging.js';
import { hideMatchingLanguageOption } from './modules/languageUtils.js';
import { loadStoredSettings } from './modules/storage.js';
import { setupEventListeners } from './modules/eventHandlers.js';

// Global state - could also be moved to a state module
let siteTranslated = false;
let isTranslating = false;
let translatedTextFinished = 0;
let activeTabId = null;

// Initialize popup when DOM loads
document.addEventListener("DOMContentLoaded", async () => {
    // Initialize UI elements
    initializeUI();
    
    // Load stored settings (dark mode, target language)
    await loadStoredSettings();
    
    // Get current tab and set up main functionality
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTabId = tabs[0].id;
    
    // Wait for content script injection
    await waitForContentScript();
    
    // Setup all event listeners
    setupEventListeners({
        siteTranslated,
        isTranslating,
        activeTabId,
        // Pass update functions
        setSiteTranslated: (value) => siteTranslated = value,
        setIsTranslating: (value) => isTranslating = value
    });
    
    // Initialize page state
    await initializePageState();
});

async function waitForContentScript() {
    const loadingContainer = document.getElementById('loading-container');
    const mainContainer = document.getElementById('main-container');
    
    return new Promise((resolve) => {
        const timer = setInterval(async () => {
            try {
                const response = await sendContentMessage(activeTabId, { action: 'isInjected' });
                if (response?.injected) {
                    loadingContainer.classList.add('hidden');
                    mainContainer.classList.remove('hidden');
                    clearInterval(timer);
                    resolve(true);
                }
            } catch {
                // Keep trying
            }
        }, 100);
    });
}

async function initializePageState() {
    try {
        // Get translation state
        const translationState = await sendContentMessage(activeTabId, { action: 'getTranslationState' });
        if (translationState) {
            updateButtonState(translationState.isTranslated, translationState.translationState);
            translatedTextFinished = translationState.textLength;
            siteTranslated = translationState.isTranslated;
        }
        
        // Get language detection
        const languageResponse = await sendContentMessage(activeTabId, { action: 'dominantLanguage' });
        if (languageResponse?.language) {
            hideMatchingLanguageOption(languageResponse.language);
        }
        
        // Check if currently translating
        const translatingResponse = await sendContentMessage(activeTabId, { action: 'translatingOrNot' });
        const translateBtn = document.getElementById('translate-btn');
        if (translatingResponse?.translationStatus) {
            translateBtn.textContent = "Translating...";
            addLoadingState(translateBtn, true);
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

function handleTranslationComplete(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        siteTranslated = message.translationState;
        resetTranslationUI(true);
        addLoadingState(document.getElementById('translate-btn'), false);
        updateButtonState(true, 'TranslatedText');
    });
}

function handleAPIKeyError() {
    const translateBtn = document.getElementById('translate-btn');
    addLoadingState(translateBtn, false);
    addShakeAnimation(translateBtn);
    translateBtn.textContent = "No API Key!";
    translateBtn.disabled = true;
    
    setTimeout(() => {
        translateBtn.textContent = "Translate";
        translateBtn.disabled = false;
    }, 1000);
}

function handleReloading() {
    siteTranslated = false;
    isTranslating = false;
    translatedTextFinished = 0;
    resetTranslationUI(false);
    addLoadingState(document.getElementById('translate-btn'), false);
    updateButtonState(false, 'TranslatedText');
}

function handleToggleComplete(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        const showOriginalBtn = document.getElementById('show-original-btn');
        showOriginalBtn.textContent = 'Done!';
        
        setTimeout(async () => {
            showOriginalBtn.disabled = false;
            const response = await sendContentMessage(tabs[0].id, { action: 'getTranslationState' });
            if (response) {
                updateButtonState(response.isTranslated, response.translationState);
            }
        }, 500);
    });
}

function handleTranslationProgress(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        const translatingDisplay = document.getElementById('translating-count');
        const translatedDisplay = document.getElementById('translated-count');
        
        if (translatedDisplay) translatedDisplay.textContent = message.translated || 0;
        if (translatingDisplay) translatingDisplay.textContent = message.remaining || 0;
    });
}