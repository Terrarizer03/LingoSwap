/* ---------------------- Popup Logic ---------------------- */

// constants -----------
const settingsBtn = document.getElementById('settings-btn');
const darkModeBtn = document.getElementById('dark-mode-btn');
const settingsPanel = document.getElementById('settings-panel');
const currentVersion = document.getElementById('header-version');
const headerTitle = document.getElementById('header-extension');
const homePanel = document.getElementById('home-panel');

// Check for settings-icon clicked
// if clicked, toggles each panels visibility
settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    homePanel.classList.toggle('hidden');
    headerTitle.classList.toggle('hidden');
    currentVersion.classList.toggle('hidden');
});

// Check for darkmode-icon clicked
// on click, popup turns darkmode and preference is saved in chrome's local storage
darkModeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('light-mode-icon').classList.toggle('hidden', !isDark);
    document.getElementById('dark-mode-icon').classList.toggle('hidden', isDark);
    
    // Save dark mode preference
    chrome.storage.local.set({ darkMode: isDark });
});

/* ---------------------- Translate Logic ---------------------- */

// variables -------------
let siteTranslated = false;
let isTranslating = false;
let translatedTextFinished = 0;
const translateBtn = document.getElementById('translate-btn');
const showOriginalBtn = document.getElementById('show-original-btn')
const targetLangSelect = document.getElementById('target-lang'); 
const saveAPIBtn = document.getElementById('saveAPI');

// On DOM loaded
document.addEventListener("DOMContentLoaded", () => {
    // loads the target language and dark mode in chrome local 
    // storage when popup is opened and applies them to popup
    chrome.storage.local.get(["darkMode"], (result) => {
        if (result.darkMode) {
            document.body.classList.add('dark-mode');
            document.getElementById('light-mode-icon').classList.remove('hidden');
            document.getElementById('dark-mode-icon').classList.add('hidden');
        }
    });

    chrome.storage.session.get(["targetLang"], (result) => {
        if (result.targetLang) {
            document.getElementById('target-lang').value = result.targetLang || 'English';
        }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        // Sending messages to fuck all, bro needs to refactor ong
        const currentTabId = tabs[0].id;
        activeTabId = currentTabId

        // on dom load, grabs translation state from content script and updates the 
        // Show Original button based on isTranslated and translationState
        chrome.tabs.sendMessage(tabs[0].id, {
            action: 'getTranslationState'
        }, (response) => {
            if (response) {
                updateButtonState(response.isTranslated, response.translationState);
                translatedTextFinished = response.textLength;
                siteTranslated = response.isTranslated; // had to refactor 1/10th of the code base just to get this shit working (finally working bruh)
                // gets translation progress from background script and updates
                // the translation report to the current progress
                if (!siteTranslated) {
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
                            }}
                    });
                } else {
                    updateTranslationReport({
                        translated: translatedTextFinished,
                        remaining: 0
                    })
                }
            };
        })
        // checks if content script is in the middle of translating
        // and applies the translationStatus to the translateBtn
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
    });
});

// Message listener for background and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => { // More messages being sent to narnia. On God I'm boutta crashout
    // when popup recieves a message that translation is complete, it resets
    // popup state to normal
    if (message.action === 'translationComplete') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabId = tabs[0].id;
            if (currentTabId !== message.tabId) {
                console.warn(`Tabs don't match. Function UI won't be called.`)
                return;
            }
            siteTranslated = message.translationState;
            // Reset the UI when translation is complete
            resetTranslationUI(true);
            addLoadingState(translateBtn, false);
            
            // Update button state - so the show original button is enabled.
            updateButtonState(true, 'TranslatedText');
            console.log('Translation completed:', message); 
            
        });  
    }

    if (message.action === 'APIKeyError') {
        addLoadingState(translateBtn, false)
        addShakeAnimation(translateBtn)
        translateBtn.textContent = "No API Key!";
        translateBtn.disabled = true;
        setTimeout(() => {
            translateBtn.textContent = "Translate";
            translateBtn.disabled = false;
            reloadUIState()
        }, 1000)
        
    }
    
    // when site reloads, all states in popup gets reset.
    if (message.action === 'reloading') {
        reloadUIState()
    }
    
    // if show original button is clicked and content script returns
    // toggleComplete, the ShowOriginal button changes state.
    if (message.action === 'toggleComplete') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { 
            const currentTabId = tabs[0].id;
            if (currentTabId !== message.tabId) {
                console.warn(`Tab's don't match. Function UI won't call.`)
                return;
            }

            showOriginalBtn.textContent = 'Done!';
            setTimeout(() => {
                showOriginalBtn.disabled = false
                // Ask content script for the current translation state
                chrome.tabs.sendMessage(currentTabId, { // Nested messages will be the end of me...
                    action: 'getTranslationState'
                }, (response) => {
                    if (response) {
                        updateButtonState(response.isTranslated, response.translationState);
                    }
                    });
            }, 500)
        });    
    }

    // recieves translation progress updates from background script
    // and updates translation report accordingly
    if (message.action === 'translationProgress') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const currentTabId = tabs[0].id;
            if (currentTabId !== message.tabId) {
                return;
            }

            updateTranslationReport({
                translated: message.translated,
                remaining: message.remaining
            });
        })
    }
});

/* -------------------- Helper Functions -------------------- */

// Loading state for UX
function addLoadingState(button, state=false) {
    if (state) {
        button.classList.add('loading');
    } else {
        button.classList.remove('loading');
    }
}

function addShakeAnimation(button) {
    button.classList.add('shake');
    setTimeout(() => {
        button.classList.remove('shake')
    }, 100);
}

function reloadUIState() {
    isTranslating = false;
    resetTranslationUI(false);
    addLoadingState(translateBtn, false);
    updateButtonState(false, 'TranslatedText');
    updateTranslationReport({ translated: 0, remaining: 0 });
}

// helper function for updating translation reports
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

// helper function for updating show original button state
function updateButtonState(isTranslated, translationState) {
    if (!isTranslated) {
        showOriginalBtn.disabled = true;
        showOriginalBtn.textContent = 'Show Original';
    } else {
        showOriginalBtn.disabled = false;
        showOriginalBtn.textContent = translationState === 'RawText' ? 'Show Translated' : 'Show Original'; // Could've made translationState into a boolean but no, I'm a dumbass.
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
/* ------------------------------------------------------------ */

/* -------------------- Event listeners [ a.k.a random hot mess that I hate >:( ] -------------------- */
// On click ShowOriginal will send a message to content script
// to toggle original and translated text
showOriginalBtn.addEventListener('click', async () => {  
    if (isTranslating) {
        alert("No translations yet, please wait...");
        return;
    }

    showOriginalBtn.disabled = true

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
        showOriginalBtn.disabled = false
        alert('Problems with restoring original text, please refresh the page.');
    }
});

// On language select change, the targetlanguage will be saved to
// chrome's local storage for later use
targetLangSelect.addEventListener('change', (event) => {
    const targetLang = event.target.value;

    chrome.storage.session.set({ targetLang: targetLang });
});

// main logic, on translateBtn click sends message to content script which sends
// a message to background script to start translation, which sends a message again to content
// script for the extracted text, which sends back the extracted text to background script, which lastly sends
// the translated text back to content script to replace the DOM text with the translated text. 
// Fuck.
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
                action: 'getTranslationState',
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
            addShakeAnimation(translateBtn)
            translateBtn.textContent = "Already Translated";
            translateBtn.disabled = true;
            setTimeout(() => {
                translateBtn.textContent = "Translate";
                translateBtn.disabled = false;
            }, 750);
            return;
        }

        chrome.runtime.sendMessage({
            action: 'translate',
            tabId: tab.id,
        }, (response) => {
            console.log('Translation initiated:', response);
            
            if (chrome.runtime.lastError || !response || response.error) {
                console.error('Translation failed to start:', chrome.runtime.lastError || response.error);
                resetTranslationUI(false);
                addLoadingState(translateBtn, false);
                return;
            }

            // Only add loading state if translation truly starts
            addLoadingState(translateBtn, true);
            isTranslating = true;
            translateBtn.disabled = true;
            translateBtn.textContent = "Translating...";

            // Fallback timeout
            setTimeout(() => {
                if (isTranslating) {
                    resetTranslationUI(false);
                    addLoadingState(translateBtn, false);
                    console.log('Translation reset by timeout fallback');
                }
            }, 45000);
        });

    } catch (error) {
        console.error('Error:', error);
        alert('Please refresh the page and try again.');
        resetTranslationUI(false);
        addLoadingState(translateBtn, false);
    }
});

// Saves the api key when saveAPI button is clicked
saveAPIBtn.addEventListener('click', () => {
    const apiKey = document.getElementById('inputAPI').value.trim();
    // Validate API key
    if (!apiKey) {
        alert('Please enter a valid API key.');
        return;
    }
    // Optional: Add more specific validation (e.g., regex for expected format)
    if (!/^[a-zA-Z0-9_-]{10,100}$/.test(apiKey)) {
        alert('Invalid API key format. Use alphanumeric characters, underscores, or hyphens.');
        return;
    }
    chrome.runtime.sendMessage({
        action: 'saveAPIKey',
        apiKey: apiKey
    }, (response) => {
        if (response && response.success) {
            alert('API Key saved successfully.');
            document.getElementById('inputAPI').value = ''; // Clear input after saving
        } else {
            alert('Failed to save API key: ' + (response?.error || 'Unknown error'));
        }
        console.log('API Key save response:', response);
    });
});