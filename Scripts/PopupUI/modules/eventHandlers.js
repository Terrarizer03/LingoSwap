/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

import { sendContentMessage, sendRuntimeMessage } from './messaging.js';
import { addLoadingState, addShakeAnimation, resetTranslationUI } from './ui.js';
import { saveTargetLanguage } from './storage.js';

export function setupEventListeners(state) {
    const showOriginalBtn = document.getElementById('show-original-btn');
    const translateBtn = document.getElementById('translate-btn');
    const targetLangSelect = document.getElementById('target-lang');
    const saveAPIBtn = document.getElementById('saveAPI');
    
    showOriginalBtn?.addEventListener('click', () => handleShowOriginal(state));
    translateBtn?.addEventListener('click', () => handleTranslate(state));
    targetLangSelect?.addEventListener('change', handleLanguageChange);
    saveAPIBtn?.addEventListener('click', handleSaveAPI);
}

async function handleShowOriginal(state) {
    if (state.isTranslating) {
        alert("No translations yet, please wait...");
        return;
    }

    const showOriginalBtn = document.getElementById('show-original-btn');
    showOriginalBtn.disabled = true;

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        chrome.tabs.sendMessage(tab.id, {
            action: 'showOriginal',
            tabId: tab.id
        }, (response) => {
            console.log('Toggled original/translated text:', response);
        });
    } catch (error) {
        console.error('Error:', error);
        showOriginalBtn.disabled = false;
        alert('Problems with restoring original text, please refresh the page.');
    }
}

async function handleTranslate(state) {
    if (state.isTranslating) {
        alert("Translation is already in progress. Please wait...");
        return;
    }

    const translateBtn = document.getElementById('translate-btn');

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check current translation state
        const response = await sendContentMessage(tab.id, { action: 'getTranslationState' });
        
        if (response?.isTranslated) {
            addShakeAnimation(translateBtn);
            translateBtn.textContent = "Already Translated";
            translateBtn.disabled = true;
            setTimeout(() => {
                translateBtn.textContent = "Translate";
                translateBtn.disabled = false;
            }, 750);
            return;
        }

        const callTranslate = await sendRuntimeMessage({ action: 'translate', tabId: tab.id });
        
        if (!callTranslate || callTranslate.error) {
            throw new Error(callTranslate?.error || "Unknown error");
        }
        
        addLoadingState(translateBtn, true);
        state.setIsTranslating(true);
        translateBtn.disabled = true;
        translateBtn.textContent = "Translating...";

        // Fallback timeout
        setTimeout(() => {
            if (state.isTranslating) {
                resetTranslationUI(false);
                addLoadingState(translateBtn, false);
                state.setIsTranslating(false);
            }
        }, 45000);
        
    } catch (error) {
        console.error('Error:', error);
        resetTranslationUI(false);
        addLoadingState(translateBtn, false);
        state.setIsTranslating(false);
    }
}

function handleLanguageChange(event) {
    saveTargetLanguage(event.target.value);
}

async function handleSaveAPI() {
    const apiKey = document.getElementById('inputAPI').value.trim();
    
    if (!apiKey) {
        alert('Please enter a valid API key.');
        return;
    }
    
    if (!/^[a-zA-Z0-9_-]{10,100}$/.test(apiKey)) {
        alert('Invalid API key format. Use alphanumeric characters, underscores, or hyphens.');
        return;
    }

    try {
        const saveAPIKey = await sendRuntimeMessage({ action: 'saveAPIKey', apiKey });
        
        if (saveAPIKey?.success) {
            alert('API Key saved successfully.');
            document.getElementById('inputAPI').value = '';
        }
    } catch (error) {
        alert(`Failed to save API key: ${error.message}`);
        console.error('Failed to save API key:', error);
    }
}