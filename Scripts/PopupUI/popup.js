let isTranslating = false;

document.getElementById('translateBtn').addEventListener('click', async () => {
    if (isTranslating) {
        alert("Translation is already in progress. Please wait...");
        return;
    }

    isTranslating = true;

    const translateBtn = document.getElementById('translateBtn');
    translateBtn.disabled = true;
    translateBtn.innerText = "Translating...";

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const targetLang = document.getElementById('targetLang').value;

        chrome.runtime.sendMessage({
            action: 'translate',
            tabId: tab.id,
            targetLang: targetLang
        }, (response) => {
            console.log('Translation initiated:', response);
            // Optionally reset here if you're sure translation ends quickly
        });

        // Wait ~15s as fallback in case no response is returned
        setTimeout(() => {
            isTranslating = false;
            translateBtn.disabled = false;
            translateBtn.innerText = "Translate";
        }, 15000);
    } catch (error) {
        console.error('Error:', error);
        alert('Please refresh the page and try again.');

        isTranslating = false;
        translateBtn.disabled = false;
        translateBtn.innerText = "Translate";
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
