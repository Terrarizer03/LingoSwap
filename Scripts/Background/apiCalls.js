// Listen for tab updates (including reloads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Check if the tab is reloading or has completed loading
    if (changeInfo.status === 'loading') {
        // Clear translation state for this tab
        if (tabTranslationStates[tabId]) {
            console.log(`Tab ${tabId} is reloading, clearing translation state`);
            delete tabTranslationStates[tabId];
        }
        
        // Reset global translation state if this was the active translating tab
        if (currentTranslationState.isTranslating) {
            // You might want to check if this is the currently translating tab
            currentTranslationState.isTranslating = false;
            currentTranslationState.totalItems = 0;
            currentTranslationState.translatedItems = 0;
            currentTranslationState.remainingItems = 0;
        }
    }
});

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

    // Listen for translate request from popup
    if (message.action === 'translate') {
        currentTranslationState.isTranslating = true;
        const { tabId } = message;
        const targetLang  = chrome.storage.local.get(['targetLang'])

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

    // Listen for text to translate from content script
    if (message.action === 'getTextToTranslate') {
        const textArray = message.textArray;
        const tabId = sender.tab.id;
        
        // Initialize state for this tab
        tabTranslationStates[tabId] = {
            isTranslating: true,
            totalItems: textArray.length,
            translatedItems: 0,
            remainingItems: textArray.length
        };
        
        console.log(`Received ${textArray.length} texts to translate from tab ${tabId}`);

        // Get API key and translation request details
        chrome.storage.local.get(['apiKey', 'currentTranslationRequest', 'targetLang'], async (result) => {
            const apiKey = result.apiKey || '';
            const translationRequest = result.currentTranslationRequest;
            const targetLang = result.targetLang || 'English'; // Default to English if not set
            
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

                // Send Initial Progress State 
                sendProgressUpdate(0, textArray.length);

                // Perform translation
                const translatedArray = await performTranslation(textArray, targetLang, apiKey, tabId);
                
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
                        currentTranslationState.isTranslating = false;
                        sendProgressUpdate(textArray.length, 0) // Send Progress Report Once Finished
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

    if (message.action === 'getTranslationProgress') {
        // Get current active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            const state = tabTranslationStates[tabId] || {
                isTranslating: false,
                totalItems: 0,
                translatedItems: 0,
                remainingItems: 0
            };
            
            sendResponse({
                success: true,
                isTranslating: state.isTranslating,
                translated: state.translatedItems,
                remaining: state.remainingItems,
                totalItems: state.totalItems
            });
        });
        return true;
    }
});

let tabTranslationStates = {};

// Translation State
let currentTranslationState = {
    isTranslating: false,
    totalItems: 0,
    translatedItems: 0,
    remainingItems: 0
};

// Function for Sending Progress to Popup
function sendProgressUpdate(translated, remaining, tabId) {
    // Update state for specific tab
    if (tabTranslationStates[tabId]) {
        tabTranslationStates[tabId].translatedItems = translated;
        tabTranslationStates[tabId].remainingItems = remaining;
    }
    
    chrome.runtime.sendMessage({
        action: 'translationProgress',
        translated: translated,
        remaining: remaining
    }).catch(() => {});
}

// Enhanced translation function with chunking support
async function performTranslation(textArray, targetLang, apiKey, tabId) {
    console.log(`Translating ${textArray.length} texts to ${targetLang}`);
    
    const CHUNK_SIZE = 100;
    const CONCURRENT_REQUESTS = 2;
    
    // If array is small enough, use original method
    if (textArray.length <= CHUNK_SIZE) {
        const result = await translateSingleChunk(textArray, targetLang, apiKey, 0);
        // Send final progress for single chunk
        sendProgressUpdate(textArray.length, 0, tabId)
        return result
    }
    
    // Split into chunks
    const chunks = chunkArray(textArray, CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks of max ${CHUNK_SIZE} items each`);
    
    // Process chunks in batches with controlled concurrency
    const allTranslatedChunks = [];
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_REQUESTS) {
        const batchChunks = chunks.slice(i, i + CONCURRENT_REQUESTS);
        console.log(`Processing batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}: chunks ${i + 1}-${Math.min(i + CONCURRENT_REQUESTS, chunks.length)}`);
        
        // Create promises for concurrent translation
        const batchPromises = batchChunks.map((chunk, batchIndex) => {
            const globalChunkIndex = i + batchIndex;
            return translateChunkWithContext(chunk, targetLang, apiKey, globalChunkIndex, chunks.length, textArray)
                .then(result => {
                    // Update progress immediately when this chunk completes
                    allTranslatedChunks.push(result);
                    const totalTranslated = allTranslatedChunks.flat().length;
                    const totalRemaining = textArray.length - totalTranslated;
                    sendProgressUpdate(totalTranslated, totalRemaining, tabId);
                    return result;
                });
        });

        try {
            // Wait for current batch to complete
            const batchResults = await Promise.all(batchPromises);

            // Add delay between batches to avoid rate limiting
            if (i + CONCURRENT_REQUESTS < chunks.length) {
                await delay(1000); // 1 second delay between batches
            }
        } catch (error) {
            console.error(`Error in batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}:`, error);
            // Continue with remaining batches, mark failed chunks
            const failedResults = batchChunks.map((chunk, batchIndex) => 
                chunk.map((text, textIndex) => `[Translation Error - Batch ${i + batchIndex + 1}] ${text}`)
            );
            allTranslatedChunks.push(...failedResults);
        }
    }
    
    // Flatten all chunks back into single array
    const finalTranslatedArray = allTranslatedChunks.flat();
    console.log(`Translation complete: ${finalTranslatedArray.length} items translated`);
    
    return finalTranslatedArray;
}

// Translate a single chunk with enhanced context
async function translateChunkWithContext(chunk, targetLang, apiKey, chunkIndex, totalChunks, fullTextArray) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
    // Create numbered list for this chunk
    const textList = chunk.map((text, index) => `${index + 1}. ${text}`).join('\n');
    
    // Enhanced context-aware prompt
    const contextPrompt = buildContextualPrompt(chunk, chunkIndex, totalChunks, fullTextArray, targetLang);
    const prompt = `${contextPrompt}\n\n${textList}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.1,
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
        const translatedArray = parseNumberedResponse(translatedText, chunk.length);
        
        console.log(`Chunk ${chunkIndex + 1}/${totalChunks} translated successfully`);
        return translatedArray;
        
    } catch (error) {
        console.error(`Gemini API error for chunk ${chunkIndex + 1}:`, error);
        return chunk.map((text, index) => `[Translation Error - Chunk ${chunkIndex + 1}, Item ${index + 1}] ${text}`);
    }
}

// Build contextual prompt to help maintain coherence across chunks
function buildContextualPrompt(currentChunk, chunkIndex, totalChunks, fullTextArray, targetLang) {
    const CHUNK_SIZE = 100;
    let contextPrompt = `Translate the following text to ${targetLang}. `;
    
    if (totalChunks > 1) {
        contextPrompt += `This is part ${chunkIndex + 1} of ${totalChunks} from a web page. `;
        
        // Add context from previous chunk (last few items)
        if (chunkIndex > 0) {
            const prevChunkStart = Math.max(0, chunkIndex * CHUNK_SIZE - 3);
            const prevChunkEnd = chunkIndex * CHUNK_SIZE;
            const contextItems = fullTextArray.slice(prevChunkStart, prevChunkEnd);
            
            if (contextItems.length > 0) {
                contextPrompt += `For context, the previous section ended with: "${contextItems.slice(-2).join(' ')}" `;
            }
        }
        
        // Add context from next chunk (first few items)
        if (chunkIndex < totalChunks - 1) {
            const nextChunkStart = (chunkIndex + 1) * CHUNK_SIZE;
            const nextChunkEnd = Math.min(fullTextArray.length, nextChunkStart + 3);
            const nextItems = fullTextArray.slice(nextChunkStart, nextChunkEnd);
            
            if (nextItems.length > 0) {
                contextPrompt += `The next section will begin with: "${nextItems.slice(0, 2).join(' ')}" `;
            }
        }
    }
    
    contextPrompt += `Maintain consistency in terminology and style. Return only the translated text in numbered format (1. 2. 3. etc.), without any additional explanation:`;
    
    return contextPrompt;
}

// Fallback for small arrays (original method)
async function translateSingleChunk(textArray, targetLang, apiKey, chunkIndex = 0) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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
            temperature: 0.1,
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
        return parseNumberedResponse(translatedText, textArray.length);
        
    } catch (error) {
        console.error('Gemini API error:', error);
        
        return textArray.map(text => `[Translation Error] ${text}`);
    }
}

// Utility functions
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Enhanced parsing with better error handling
function parseNumberedResponse(response, expectedLength) {
    const lines = response.trim().split('\n');
    const translatedArray = [];
    
    for (let i = 0; i < expectedLength; i++) {
        const numberPrefix = `${i + 1}.`;
        const line = lines.find(l => l.trim().startsWith(numberPrefix));
        
        if (line) {
            const translated = line.substring(line.indexOf('.') + 1).trim();
            translatedArray.push(translated);
        } else {
            // Better fallback - try to find any line that might correspond
            const fallbackLine = lines[i];
            if (fallbackLine && fallbackLine.trim()) {
                // Remove any number prefix if it exists
                const cleaned = fallbackLine.replace(/^\d+\.\s*/, '').trim();
                translatedArray.push(cleaned || `[Parse Error] Item ${i + 1}`);
            } else {
                translatedArray.push(`[Parse Error] Item ${i + 1}`);
            }
        }
    }
    
    return translatedArray;
}