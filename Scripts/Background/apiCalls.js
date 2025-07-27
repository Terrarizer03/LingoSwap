// THIS CODE IS ACTUALLY BULLSHIT I UNDERSTAND LIKE 2% OF IT FUCK

// Store abort controllers for each tab
let tabAbortControllers = {};

// Listen for tab updates (including reloads)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'loading' && tabTranslationStates[tabId]) { // Check if the tab is reloading or has completed loading
        console.log(`Tab ${tabId} is reloading, clearing translation state`);

        chrome.runtime.sendMessage({
            action: 'reloading'
        })
        
        // Abort ongoing translation for this tab
        if (tabAbortControllers[tabId]) {
            console.log(`Aborting translation for tab ${tabId}`);
            tabAbortControllers[tabId].abort();
            delete tabAbortControllers[tabId];
        }
        
        // Clear translation state for this tab
        delete tabTranslationStates[tabId];
        if (currentTranslationState.isTranslating && currentTranslationState.tabId === tabId) { // Reset global translation state if this was the active translating tab
            // I should add helper functions to help with my mental state :)
            currentTranslationState.isTranslating = false;
            currentTranslationState.totalItems = 0;
            currentTranslationState.translatedItems = 0;
            currentTranslationState.remainingItems = 0;
            currentTranslationState.tabId = null;
        }   
    }
});

// Listen to messages from the popup to save the API key
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Listen for translate request from popup
    if (message.action === 'translate') {
        currentTranslationState.isTranslating = true;
        const { tabId } = message;
        chrome.storage.session.get(['targetLang']).then(result => {
            const targetLang  = result.targetLang || 'English';
            console.log('Translate requested for tab:', tabId, 'Language:', targetLang);
            // Store the translation request details for later use
            chrome.storage.session.set({ 
                currentTranslationRequest: { tabId, targetLang } 
            }, () => {
                // Forward the translate message to content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'translate',
                    tabId: tabId
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
        }) 
        return true;
    }

    if (message.action === 'saveAPIKey') {
        const apiKey = message.apiKey;
        // Validate API key format (adjust regex based on Gemini API key format)
        if (!apiKey || !/^[a-zA-Z0-9_-]{30,40}$/.test(apiKey)) {
            sendResponse({
                success: false,
                message: 'Invalid API key format'
            });
            return true;
        }

        validateApiKey(apiKey)

        chrome.storage.session.set({ apiKey: apiKey }, () => {
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

    // Listen for text to translate from content script
    if (message.action === 'getTextToTranslate') {
        const textArray = message.textArray;
        const tabId = sender.tab.id;

        // Get API key and translation request details
        chrome.storage.session.get(['apiKey', 'currentTranslationRequest', 'targetLang'], async (result) => {
            const apiKey = result.apiKey || '';
            const translationRequest = result.currentTranslationRequest;
            const targetLang = result.targetLang || 'English'; // Default to English if not set
            
            if (!apiKey) {
                chrome.runtime.sendMessage({
                    action: 'APIKeyError',
                });

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

            // Initialize state for this tab
            tabTranslationStates[tabId] = {
                isTranslating: true,
                totalItems: textArray.length,
                translatedItems: 0,
                remainingItems: textArray.length
            };
            
            console.log(`Received ${textArray.length} texts to translate from tab ${tabId}`);

            try {
                // Create abort controller for this tab
                const abortController = new AbortController();
                tabAbortControllers[tabId] = abortController;

                // Send Initial Progress State 
                sendProgressUpdate(0, textArray.length, tabId);

                // Perform translation with abort controller
                const translatedArray = await performTranslation(textArray, targetLang, apiKey, tabId, abortController);
                
                // Clean up abort controller if translation completed successfully
                delete tabAbortControllers[tabId];
                
                // Send results back to the content script
                chrome.tabs.sendMessage(tabId, {
                    action: 'updateDOM',
                    translatedText: translatedArray,
                    textLength: textArray.length
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending translated text to content script:', chrome.runtime.lastError);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log('Successfully sent translated text to content script');
                        currentTranslationState.isTranslating = false;
                        sendProgressUpdate(textArray.length, 0, tabId); // Send Progress Report Once Finished
                        sendResponse({ success: true });
                    }
                });
                
            } catch (error) {
                console.error('Translation error:', error);
                
                // Clean up abort controller on error
                delete tabAbortControllers[tabId];
                
                // Check if error was due to abortion
                if (error.name === 'AbortError') {
                    console.log(`Translation aborted for tab ${tabId}`);
                    
                    // Reset global translation state
                    currentTranslationState.isTranslating = false;
                    currentTranslationState.totalItems = 0;
                    currentTranslationState.translatedItems = 0;
                    currentTranslationState.remainingItems = 0;
                    currentTranslationState.tabId = null;
                    
                    // Send progress update to popup to reflect cancellation
                    sendProgressUpdate(0, 0, tabId);
                    
                    sendResponse({ 
                        success: false, 
                        error: 'Translation was cancelled' 
                    });
                } else {
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                }
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

// Helper function to check if API key is valid
function validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('Invalid API key format');
    }
    if (apiKey.length < 10 || apiKey.length > 100) {
        throw new Error('API key length is suspicious');
    }
    // Add more validation as needed
    return true;
}

// Function for Sending Progress to Popup
function sendProgressUpdate(translated, remaining, tabId) {
    // Update state for specific tab
    if (tabTranslationStates[tabId]) {
        tabTranslationStates[tabId].translatedItems = translated;
        tabTranslationStates[tabId].remainingItems = remaining;
    }
    
    chrome.runtime.sendMessage({
        action: 'translationProgress',
        translated,
        remaining,
        tabId
    }).catch(error => console.error(`Failed to send progress update for tab ${tabId}:`, error));;
};

// Enhanced translation function with chunking support and abort controller
async function performTranslation(textArray, targetLang, apiKey, tabId, abortController) {
    console.log(`Translating ${textArray.length} texts to ${targetLang}`);
    
    const CHUNK_SIZE = 100;
    const CONCURRENT_REQUESTS = 2;
    
    // If array is small enough, use original method
    if (textArray.length <= CHUNK_SIZE) {
        const result = await translateTextChunk(textArray, targetLang, apiKey, 0, 1, null, abortController);
        // Send final progress for single chunk
        sendProgressUpdate(textArray.length, 0, tabId);
        return result;
    }
    
    // Split into chunks
    const chunks = chunkArray(textArray, CHUNK_SIZE);
    console.log(`Split into ${chunks.length} chunks of max ${CHUNK_SIZE} items each`);
    
    // Process chunks in batches with controlled concurrency
    const allTranslatedChunks = [];
    
    for (let i = 0; i < chunks.length; i += CONCURRENT_REQUESTS) {
        // Check if translation was aborted
        if (abortController.signal.aborted) {
            throw new Error('Translation aborted');
        }
        
        const batchChunks = chunks.slice(i, i + CONCURRENT_REQUESTS);
        console.log(`Processing batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}: chunks ${i + 1}-${Math.min(i + CONCURRENT_REQUESTS, chunks.length)}`);
        
        // Create promises for concurrent translation
        const batchPromises = batchChunks.map((chunk, batchIndex) => {
            const globalChunkIndex = i + batchIndex;
            return translateTextChunk(chunk, targetLang, apiKey, globalChunkIndex, chunks.length, textArray, abortController)
                .then(result => { // All this bs just to send progress updates? Fuck
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

            // Add delay between batches to avoid rate limiting (with abort check)
            if (i + CONCURRENT_REQUESTS < chunks.length) {
                await delay(1000, abortController); // 1 second delay between batches
            }
        } catch (error) {
            // If it's an abort error, re-throw it
            if (error.name === 'AbortError' || error.message === 'Translation aborted') {
                throw error;
            }
            
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

// Merged Translate Text Function with abort controller
async function translateTextChunk(textArray, targetLang, apiKey, chunkIndex = 0, totalChunks = 1, fullTextArray = null, abortController) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const textList = textArray.map((text, index) => `${index + 1}. ${text}`).join('\n');
    // Determines which prompt to use, single chunk prompt or multi chunk prompt
    const prompt = fullTextArray && totalChunks > 1
        ? `${buildContextualPrompt(textArray, chunkIndex, totalChunks, fullTextArray, targetLang)}\n\n${textList}`
        : `Translate the following text to ${targetLang}. Keep in mind of context, some / a lot of the text in this list are connected to each other. Once finished, return only the translated text in the same format (numbered list), without any additional explanation or commentary:\n\n${textList}`;

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
            body: JSON.stringify(requestBody),
            signal: abortController.signal // Add abort signal to fetch
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
        const translatedArray = parseNumberedResponse(translatedText, textArray.length);
        
        if (totalChunks > 1) {
            console.log(`Chunk ${chunkIndex + 1}/${totalChunks} translated successfully`);
        }
        return translatedArray;
        
    } catch (error) {
        // Check if it's an abort error
        if (error.name === 'AbortError') {
            console.log(`Translation chunk ${chunkIndex + 1} aborted`);
            throw error;
        }
        
        console.error(`Gemini API error${totalChunks > 1 ? ` for chunk ${chunkIndex + 1}` : ''}:`, error);
        return textArray.map((text, index) => `[Translation Error${totalChunks > 1 ? ` - Chunk ${chunkIndex + 1}, Item ${index + 1}` : ''}] ${text}`);
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

// Utility functions
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// Enhanced delay function with abort controller support
function delay(ms, abortController) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms);
        
        // Listen for abort signal
        if (abortController) {
            abortController.signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new Error('Translation aborted'));
            });
        }
    });
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