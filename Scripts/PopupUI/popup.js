document.getElementById('translateBtn').addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'translate' });
        console.log('Translation completed:', response);
    } catch (error) {
        console.error('Error:', error);
        // Content script not ready or page not supported
        alert('Please refresh the page and try again, or make sure you\'re on a regular website.');
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

