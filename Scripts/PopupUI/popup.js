/* ---------------------- Translate Logic ---------------------- */

// variables -------------
let isTranslating = false;
const translateBtn = document.getElementById('translateBtn');

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
        translateBtn.textContent = "Translation completed successfully!";

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
        const targetLang = document.getElementById('targetLang').value;

        chrome.runtime.sendMessage({
            action: 'translate',
            tabId: tab.id,
            targetLang: targetLang
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