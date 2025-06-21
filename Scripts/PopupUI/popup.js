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
// // Check if DOM is already loaded
// if (document.readyState === 'loading') {
//   // DOM is still loading
//   document.addEventListener('DOMContentLoaded', initScript);  
// } else {
//   // DOM is already loaded
//   initScript();
// }