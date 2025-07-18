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
let activeTabId = null;

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
        // Sending messages to fuck all, bro needs to refactor ong
            const currentTabId = tabs[0].id;
            activeTabId = currentTabId

            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'getTranslationState'
            }, (response) => {
                if (response) {
                    updateButtonState(response.isTranslated, response.translationState);
                }
            });
            chrome.tabs.sendMessage(tabs[0].id, {
                action: 'translatingOrNot'
            }, (response) => {
                if (response && response.translationStatus) {
                    translateBtn.textContent = "Translating...";
                    addLoadingState(translateBtn, true);
                } else {
                    translateBtn.textContent = "Translate";
                    addLoadingState(translateBtn, false);
                }
            });
            chrome.runtime.sendMessage({
                action: 'getTranslationProgress',
                tabId: currentTabId
            }, (response) => {
                if (response && response.success) {
                    if (response.totalItems > 0) {
                        updateTranslationReport({
                            translated: response.translated,
                            remaining: response.remaining
                        })
                    }
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
        addLoadingState(translateBtn, false)
        siteTranslated = true;
        
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

    if (message.action === 'translationProgress') {
        updateTranslationReport({
            translated: message.translated,
            remaining: message.remaining
        });
    }
});

// Loading state for UX
function addLoadingState(button, state=false) {
    if (state) {
        button.classList.add('loading');
    } else {
        button.classList.remove('loading');
    }
}

// Translation Reports -----------------
function updateTranslationReport(progress) {
    const translatingDisplay = document.getElementById('translating-count');
    const translatedDisplay = document.getElementById('translated-count');

    // Add null checks to prevent errors
    if (translatedDisplay) {
        translatedDisplay.textContent = progress.translated || 0;
    }
    if (translatingDisplay) {
        translatingDisplay.textContent = progress.remaining || 0;
    }
}
// -------------------------------------

// Update button state
function updateButtonState(isTranslated, translationState) {
    const showOriginalBtn = document.getElementById('show-original-btn');
    
    if (!isTranslated) {
        showOriginalBtn.disabled = true;
        showOriginalBtn.textContent = 'Show Original';
    } else {
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

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check current translation state before proceeding
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tab.id, {
                action: 'getTranslationState'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });

        // If site is already translated, show alert and return
        if (response && response.isTranslated) {
            translateBtn.textContent = "Already Translated";
            translateBtn.disable = true;
            setTimeout(() => {
                translateBtn.textContent = "Translate";
                translateBtn.disable = false;
            }, 750);
            return;
        }

        // Proceed with translation
        addLoadingState(translateBtn, true);
        isTranslating = true;
        translateBtn.disabled = true;
        translateBtn.textContent = "Translating...";

        chrome.runtime.sendMessage({
            action: 'translate',
            tabId: tab.id,
        }, (response) => {
            console.log('Translation initiated:', response);
        });

        // Fallback timeout
        setTimeout(() => {
            if (isTranslating) {
                resetTranslationUI(false);
                addLoadingState(translateBtn, false);
                console.log('Translation reset by timeout fallback');
            }
        }, 45000);

    } catch (error) {
        console.error('Error:', error);
        alert('Please refresh the page and try again.');
        resetTranslationUI(false);
        addLoadingState(translateBtn, false);
    }
});

document.getElementById('saveAPI').addEventListener('click', () => {
    const apiKey = document.getElementById('inputAPI').value;
    chrome.storage.local.set({ apiKey: apiKey });
});