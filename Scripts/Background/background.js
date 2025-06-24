// Listen to messages from the popup to save the API key
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveAPIKey') {
        chrome.storage.local.set({ apiKey: message.apiKey }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({
                    success: false,
                    message: 'Failed to save API key: ' + chrome.runtime.lastError.message
                });
            } else {
                sendResponse({
                    success: true,
                    message: 'API key saved successfully'
                });
            }
        });

        return true;
    }
});

// Listen for translate request from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'translate') {
        const { tabId, targetLang } = message;

        console.log('Translate requested for tab:', tabId, 'Language:', targetLang);

        // Store the translation request details for later use
        chrome.storage.local.set({ 
            currentTranslationRequest: { tabId, targetLang } 
        }, () => {
            // Forward the translate message to content script
            chrome.tabs.sendMessage(tabId, {
                action: 'translate'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ 
                        success: false, 
                        message: 'Error communicating with content script: ' + chrome.runtime.lastError.message 
                    });
                } else {
                    sendResponse({ success: true, message: 'Translation initiated' });
                }
            });
        });
        
        return true;
    }
});

// Listen for text to translate from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getTextToTranslate') {
        const textArray = message.textArray;
        const tabId = sender.tab.id;
        
        console.log(`Received ${textArray.length} texts to translate from tab ${tabId}`);

        // Get API key and translation request details
        chrome.storage.local.get(['apiKey', 'currentTranslationRequest'], async (result) => {
            const apiKey = result.apiKey || '';
            const translationRequest = result.currentTranslationRequest;
            
            if (!apiKey) {
                sendResponse({ 
                    success: false, 
                    message: 'API key not found. Please set your API key first.' 
                });
                return;
            }

            if (!translationRequest) {
                sendResponse({ 
                    success: false, 
                    message: 'Translation request details not found.' 
                });
                return;
            }

            try {
                // Perform translation
                const translatedArray = await performTranslation(textArray, translationRequest.targetLang, apiKey);
                
                // Send results back to the content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'updateDOM',
                    translatedText: translatedArray
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending translated text to content script:', chrome.runtime.lastError);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log('Successfully sent translated text to content script');
                        sendResponse({ success: true });
                    }
                });
                
            } catch (error) {
                console.error('Translation error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message 
                });
            }
        });
        
        return true; // For async response
    }
});

// Translation function using Gemini API
async function performTranslation(textArray, targetLang, apiKey) {
    console.log(`Translating ${textArray.length} texts to ${targetLang}`);
    
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    
    // Create a batch translation prompt
    const textList = textArray.map((text, index) => `${index + 1}. ${text}`).join('\n');
    
    const prompt = `Translate the following text to ${targetLang}. Keep in mind of context, some / a lot of the text in this list are connected to each other. Once finished, return only the translated text in the same format (numbered list), without any additional explanation or commentary:
    
    ${textList}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.1, // Low temperature for consistent translations
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from Gemini API');
        }

        const translatedText = data.candidates[0].content.parts[0].text;
        
        // Parse the numbered list response back into an array
        const translatedArray = parseNumberedResponse(translatedText, textArray.length);
        
        return translatedArray;
        
    } catch (error) {
        console.error('Gemini API error:', error);
        // Fallback: return original text with error indicator
        return textArray.map(text => `[Translation Error] ${text}`);
    }
}

// Helper function to parse the numbered response from Gemini
function parseNumberedResponse(response, expectedLength) {
    const lines = response.trim().split('\n');
    const translatedArray = [];
    
    for (let i = 0; i < expectedLength; i++) {
        // Look for lines that start with the number (i+1)
        const numberPrefix = `${i + 1}.`;
        const line = lines.find(l => l.trim().startsWith(numberPrefix));
        
        if (line) {
            // Remove the number prefix and trim
            const translated = line.substring(line.indexOf('.') + 1).trim();
            translatedArray.push(translated);
        } else {
            // Fallback if parsing fails
            translatedArray.push(`[Parse Error] Item ${i + 1}`);
        }
    }
    
    return translatedArray;
}