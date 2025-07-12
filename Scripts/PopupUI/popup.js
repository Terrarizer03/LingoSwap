/* ---------------------- Popup Logic ---------------------- */

// constants -----------
const settingsBtn = document.getElementById('settings-btn');
const darkModeBtn = document.getElementById('dark-mode-btn');
const settingsPanel = document.getElementById('settings-panel');
const homePanel = document.getElementById('home-panel');

// Check for settings-icon clicked
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    homePanel.classList.toggle('hidden');
});

// Check for darkmode-icon clicked
darkModeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('light-mode-icon').classList.toggle('hidden', !isDark);
    document.getElementById('dark-mode-icon').classList.toggle('hidden', isDark);
    
    // Save dark mode preference
    chrome.storage.local.set({ darkMode: isDark });
});

/* ---------------------- Translate Logic ---------------------- */

// variables -------------
let isTranslating = false;
const translateBtn = document.getElementById('translate-btn');
const showOriginalBtn = document.getElementById('show-original-btn')
const indicatorMsg = document.getElementById('current-message')

// On DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(["targetLang", "darkMode"], (result) => {
        if (result.targetLang) {
            document.getElementById('target-lang').value = result.targetLang;
        }
        if (result.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('light-mode-icon').classList.remove('hidden');
            document.getElementById('dark-mode-icon').classList.add('hidden');
        }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'getTranslationState'
            }, (response) => {
                if (response) {
                    updateButtonState(response.isTranslated, response.translationState);
                }
            });
        });
    });
});


// Add message listener to handle translation completion
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translationComplete') {
        // Reset the UI when translation is complete
        resetTranslationUI(true);
        
        // Update button state - so the show original button is enabled.
        updateButtonState(true, 'TranslatedText')
        console.log('Translation completed:', message);
    }
    if (message.action === 'toggleComplete') {
        showOriginalBtn.textContent = 'Done!'
        setTimeout(() => {
            showOriginalBtn.disabled = false
            // Ask content script for the current translation state
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'getTranslationState'
                }, (response) => {
                    if (response) {
                        updateButtonState(response.isTranslated, response.translationState);
                    }
                });
            });
        }, 500)
    }
});

// Update button state
function updateButtonState(isTranslated, translationState) {
    const showOriginalBtn = document.getElementById('show-original-btn');
    
    if (!isTranslated) {
        showOriginalBtn.disabled = true;
        showOriginalBtn.textContent = 'Show Original';
    } else {
        console.log('Translation state:', translationState);
        showOriginalBtn.disabled = false;
        showOriginalBtn.textContent = translationState === 'RawText' ? 'Show Translated' : 'Show Original';
    }
}

// Reset translation UI
function resetTranslationUI(showSuccess = false) {
    if (showSuccess) {
        isTranslating = false;
        translateBtn.textContent = "Done!";

        setTimeout(() => {
            translateBtn.disabled = false;
            translateBtn.textContent = "Translate";
        }, 1000);
    } else {
        isTranslating = false;
        translateBtn.disabled = false;
        translateBtn.textContent = "Translate";
    }
}

// Event listeners -------------
showOriginalBtn.addEventListener('click', async () => {
    if (isTranslating) {
        alert("No translations yet, please wait...");
        return;
    }

    showOriginalBtn.disabled = true

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Use tabs.sendMessage to talk directly to the content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'showOriginal'
        }, (response) => {
            console.log('Toggled original/translated text:', response);
        });
    } catch (error) {
        console.error('Error:', error);
        showOriginalBtn.disabled = false
        alert('Problems with restoring original text, please refresh the page.');
    }
});

document.getElementById('target-lang').addEventListener('change', (event) => {
    const targetLang = event.target.value;

    chrome.storage.local.set({ targetLang: targetLang });
});

translateBtn.addEventListener('click', async () => {
    if (isTranslating) {
        alert("Translation is already in progress. Please wait...");
        return;
    }

    isTranslating = true;
    translateBtn.disabled = true;
    translateBtn.textContent = "Translating...";

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        chrome.runtime.sendMessage({
            action: 'translate',
            tabId: tab.id,
        }, (response) => {
            console.log('Translation initiated:', response);
        });

        // Keep the fallback timeout as a safety net
        setTimeout(() => {
            if (isTranslating) { // Only reset if still translating (not already reset by message)
                resetTranslationUI(false);
                console.log('Translation reset by timeout fallback');
            }
        }, 45000);
    } catch (error) {
        console.error('Error:', error);
        alert('Please refresh the page and try again.');
        resetTranslationUI(false);
    }
});

document.getElementById('saveAPI').addEventListener('click', () => {
    const apiKey = document.getElementById('inputAPI').value;

    chrome.runtime.sendMessage({
        action: 'saveAPIKey',
        apiKey: apiKey
    }, (response) => {
        console.log('API Key saved:', response);
    });
});