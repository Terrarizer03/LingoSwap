// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        translate();
        sendResponse({ success: true });
    }
});

function translate() {
    const paragraphs = document.querySelectorAll('p');
    
    paragraphs.forEach(paragraph => {
        paragraph.textContent = `Translated: ${paragraph.textContent.trim()}`;
    });

    console.log(`✅ Updated ${paragraphs.length} paragraphs.`);
}