/* =====================>>> MODULE FOR APICALLS.JS <<<===================== */

import { parseNumberedResponse, sendProgressUpdate, chunkArray, delay } from "./backgroundUtils.js";

// Enhanced translation function with chunking support and abort controller
export async function performTranslation(textArray, targetLang, apiKey, tabId, abortController) {
    console.log(`Translating ${textArray.length} texts to ${targetLang}`);
    
    const CHUNK_SIZE = 100;
    const CHAR_COUNT = 1650;
    const CONCURRENT_REQUESTS = 2;
    
    // If array is small enough, use original method
    if (textArray.length <= CHUNK_SIZE) {
        const result = await translateTextChunk(textArray, targetLang, apiKey, 0, 1, null, abortController);
        // Send final progress for single chunk
        sendProgressUpdate(textArray.length, 0, tabId);
        return result;
    }
    
    // Split into chunks
    const chunks = await chunkArray(textArray, CHUNK_SIZE, CHAR_COUNT);
    console.log(`Split into ${chunks.length} chunks`);

    // Calculate chunk lengths for proper indexing
    const chunksLength = chunks.map(chunk => chunk.length);
    
    // Process chunks in batches with controlled concurrency
    const allTranslatedChunks = new Array(chunks.length); // Pre-allocate array with correct size
    let completedCount = 0;
    
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
            return translateTextChunk(chunk, targetLang, apiKey, globalChunkIndex, chunks.length, textArray, abortController, chunksLength)
                .then(result => {
                    // Store result at correct index (fixed this stupid bug I've had for ages finally)
                    allTranslatedChunks[globalChunkIndex] = result;
                    completedCount++;
                    
                    // Update progress immediately when this chunk completes
                    const totalTranslated = completedCount > 0 ? allTranslatedChunks.slice(0, completedCount).flat().length : 0;
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
            batchChunks.forEach((chunk, batchIndex) => {
                const globalChunkIndex = i + batchIndex;
                allTranslatedChunks[globalChunkIndex] = chunk.map((text, textIndex) => 
                    `[Translation Error - Batch ${globalChunkIndex + 1}] ${text.text}`
                );
            });
        }
    }
    
    // Flatten all chunks back into single array
    const finalTranslatedArray = allTranslatedChunks.flat();
    console.log(`Translation complete: ${finalTranslatedArray.length} items translated`);
    
    return finalTranslatedArray;
}

// Merged Translate Text Function with abort controller
async function translateTextChunk(textArray, targetLang, apiKey, chunkIndex = 0, totalChunks = 1, fullTextArray = null, abortController, chunksLength = null) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const textList = textArray.map((text, index) => `${index + 1}. ${text}`).join('\n');
    // Determines which prompt to use, single chunk prompt or multi chunk prompt
    const prompt = fullTextArray && totalChunks > 1
        ? `${buildContextualPrompt(textArray, chunkIndex, totalChunks, fullTextArray, targetLang, chunksLength)}\n\n${textList}`
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
function buildContextualPrompt(currentChunk, chunkIndex, totalChunks, fullTextArray, targetLang, chunkLengths) {
    let contextPrompt = `Translate the following text to ${targetLang}. `;
    
    if (totalChunks > 1) {
        contextPrompt += `This is part ${chunkIndex + 1} of ${totalChunks} from a web page. `;
        
        // Calculate the starting index of the current chunk
        let currentChunkStartIndex = 0;
        for (let i = 0; i < chunkIndex; i++) {
            currentChunkStartIndex += chunkLengths[i];
        }

        // Add context from previous chunk (last few items)
        if (chunkIndex > 0) {
            const prevChunkStart = Math.max(0, currentChunkStartIndex - 3);
            const prevChunkEnd = currentChunkStartIndex;
            const contextItems = fullTextArray.slice(prevChunkStart, prevChunkEnd);
            
            if (contextItems.length > 0) {
                contextPrompt += `For context, the previous section ended with: "${contextItems.slice(-2).map(item => item.text).join(' ')}" `;
            }
        }
        
        // Add context from next chunk (first few items)
        if (chunkIndex < totalChunks - 1) {
            const nextChunkStart = currentChunkStartIndex + chunkLengths[chunkIndex];
            const nextChunkEnd = Math.min(fullTextArray.length, nextChunkStart + 3);
            const nextItems = fullTextArray.slice(nextChunkStart, nextChunkEnd);
            
            if (nextItems.length > 0) {
                contextPrompt += `The next section will begin with: "${nextItems.slice(0, 2).map(item => item.text).join(' ')}" `;
            }
        }
    }
    
    contextPrompt += `Maintain consistency in terminology and style. Return only the translated text in numbered format (1. 2. 3. etc.), without any additional explanation:`;
    
    return contextPrompt;
}