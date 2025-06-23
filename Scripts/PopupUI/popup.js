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

const apiKey = document.getElementById('inputAPI').value;

console.log('API Key:', apiKey);
