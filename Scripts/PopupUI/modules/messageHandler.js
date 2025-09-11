/* =====================>>> MODULE FOR POPUP.JS <<<===================== */
import { sendContentMessage, sendRuntimeMessage } from "./messaging.js";
import { addShakeAnimation, addLoadingState, resetTranslationUI, updateButtonState, updateTranslationReport } from "./ui.js";
import { setState, getState } from "./state.js";

const loadingState = document.getElementById('loading-state');

export function handleTranslationComplete(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        setState({ siteTranslated: message.translationState });
        resetTranslationUI(true);
        addLoadingState(loadingState, false);
        updateButtonState(true, 'TranslatedText');
    });
}

export function handleAPIKeyError() {
    const translateBtn = document.getElementById('translate-btn');
    addLoadingState(loadingState, false);
    addShakeAnimation(translateBtn);
    translateBtn.textContent = "No API Key!";
    translateBtn.disabled = true;
    
    setTimeout(() => {
        translateBtn.textContent = "Translate";
        translateBtn.disabled = false;
    }, 1000);
}

export function handleReloading() {
    setState({
        siteTranslated: false,
        isTranslating: false,
        translatedTextFinished: 0
    });
    resetTranslationUI(false);
    addLoadingState(loadingState, false);
    updateButtonState(false, 'TranslatedText');
}

export function handleToggleComplete(message) {
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

export function handleTranslationProgress(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        const translatingDisplay = document.getElementById('translating-count');
        const translatedDisplay = document.getElementById('translated-count');
        
        if (translatedDisplay) translatedDisplay.textContent = message.translated || 0;
        if (translatingDisplay) translatingDisplay.textContent = message.remaining || 0;
    });
}

export async function updateTranslationProgress(tabId) {
    const currentState = getState();
    
    if (currentState.siteTranslated) {
        // Site is already translated, show completed state
        console.log('Site already translated, showing completed state');
        updateTranslationReport({ 
            translated: currentState.translatedTextFinished, 
            remaining: 0 
        });
        return;
    }

    // Site not translated, get current progress
    try {
        console.log('Getting translation progress...');
        const translationProgress = await sendRuntimeMessage({ 
            action: 'getTranslationProgress', 
            tabId: tabId 
        });
        console.log('Translation progress received:', translationProgress);

        if (translationProgress?.success && translationProgress.totalItems > 0) {
            updateTranslationReport({ 
                translated: translationProgress.translated, 
                remaining: translationProgress.remaining 
            });
        }
    } catch (error) {
        console.error("Failed in getting translation progress", error);
    }
}