/* ---------------------- Translate Logic ---------------------- */

// variables -------------
let isTranslating = false;
const translateBtn = document.getElementById('translateBtn');

// On DOM loaded
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["targetLang"], (result) => {
    if (result.targetLang) {
      document.getElementById('targetLang').value = result.targetLang;
    }
  });
});

// Add message listener to handle translation completion
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translationComplete') {
        // Reset the UI when translation is complete
        resetTranslationUI(true);
        console.log('Translation completed:', message);
    }
});

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

document.getElementById('targetLang').addEventListener('change', (event) => {
    const targetLang = event.target.value;

    chrome.storage.local.set({ targetLang: targetLang });
});

document.getElementById('translateBtn').addEventListener('click', async () => {
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