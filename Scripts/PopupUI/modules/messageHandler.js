/* =====================>>> MODULE FOR POPUP.JS <<<===================== */
import { sendContentMessage } from "./messaging.js";
import { addShakeAnimation, addLoadingState, resetTranslationUI, updateButtonState } from "./ui.js";
import { setState } from "./state.js";


export function handleTranslationComplete(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0].id !== message.tabId) return;
        
        setState({ siteTranslated: message.translationState });
        resetTranslationUI(true);
        addLoadingState(document.getElementById('translate-btn'), false);
        updateButtonState(true, 'TranslatedText');
    });
}

export function handleAPIKeyError() {
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

export function handleReloading() {
    setState({
        siteTranslated: false,
        isTranslating: false,
        translatedTextFinished: 0
    });
    resetTranslationUI(false);
    addLoadingState(document.getElementById('translate-btn'), false);
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