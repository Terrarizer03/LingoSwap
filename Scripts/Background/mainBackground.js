// Currently doesn't work... I don't know why >:(

(() => {
  // Scripts/PopupUI/modules/messaging.js
  function sendContentMessage(activeTabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(activeTabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Scripts/Background/modules/state.js
  var currentTranslationState = {
    isTranslating: false,
    totalItems: 0,
    translatedItems: 0,
    remainingItems: 0
  };
  var tabTranslationStates = {};
  var tabAbortControllers = {};

  // Scripts/Background/modules/backgroundUtils.js
  function resetGlobalTranslationState() {
    currentTranslationState.isTranslating = false;
    currentTranslationState.totalItems = 0;
    currentTranslationState.translatedItems = 0;
    currentTranslationState.remainingItems = 0;
    currentTranslationState.tabId = null;
  }
  async function getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }
  async function setStorageData(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }
  async function getCurrentTab() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0]);
      });
    });
  }
  async function validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string") {
      throw new Error("Invalid API key format");
    }
    if (apiKey.length < 10 || apiKey.length > 100) {
      throw new Error("API key length is suspicious");
    }
    return true;
  }
  function sendProgressUpdate(translated, remaining, tabId2) {
    if (tabTranslationStates[tabId2]) {
      tabTranslationStates[tabId2].translatedItems = translated;
      tabTranslationStates[tabId2].remainingItems = remaining;
    }
    chrome.runtime.sendMessage({
      action: "translationProgress",
      translated,
      remaining,
      tabId: tabId2
    }).catch((error) => console.error(`Failed to send progress update for tab ${tabId2}:`, error));
    ;
  }
  function chunkArray(array, chunkSize, charCount) {
    const chunks = [];
    let currentChunk = [];
    let currentCharCount = 0;
    for (const elem of array) {
      const elemLength = elem.length;
      currentChunk.push(elem);
      currentCharCount += elemLength;
      if (currentChunk.length >= chunkSize || currentCharCount >= charCount) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentCharCount = 0;
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk);
    return chunks;
  }
  function parseNumberedResponse(response, expectedLength) {
    const lines = response.trim().split("\n");
    const translatedArray = [];
    for (let i = 0; i < expectedLength; i++) {
      const numberPrefix = `${i + 1}.`;
      const line = lines.find((l) => l.trim().startsWith(numberPrefix));
      if (line) {
        const translated = line.substring(line.indexOf(".") + 1).trim();
        translatedArray.push(translated);
      } else {
        const fallbackLine = lines[i];
        if (fallbackLine && fallbackLine.trim()) {
          const cleaned = fallbackLine.replace(/^\d+\.\s*/, "").trim();
          translatedArray.push(cleaned || `[Parse Error] Item ${i + 1}`);
        } else {
          translatedArray.push(`[Parse Error] Item ${i + 1}`);
        }
      }
    }
    return translatedArray;
  }

  // Scripts/Background/modules/textOutput.js
  async function performTranslation(textArray, targetLang, apiKey, tabId2, abortController) {
    console.log(`Translating ${textArray.length} texts to ${targetLang}`);
    const CHUNK_SIZE = 100;
    const CHAR_COUNT = 1650;
    const CONCURRENT_REQUESTS = 2;
    if (textArray.length <= CHUNK_SIZE) {
      const result = await translateTextChunk(textArray, targetLang, apiKey, 0, 1, null, abortController);
      sendProgressUpdate(textArray.length, 0, tabId2);
      return result;
    }
    const chunks = await chunkArray(textArray, CHUNK_SIZE, CHAR_COUNT);
    console.log(`Split into ${chunks.length} chunks`);
    const chunksLength = chunks.map((chunk) => chunk.length);
    const allTranslatedChunks = new Array(chunks.length);
    let completedCount = 0;
    for (let i = 0; i < chunks.length; i += CONCURRENT_REQUESTS) {
      if (abortController.signal.aborted) {
        throw new Error("Translation aborted");
      }
      const batchChunks = chunks.slice(i, i + CONCURRENT_REQUESTS);
      console.log(`Processing batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}: chunks ${i + 1}-${Math.min(i + CONCURRENT_REQUESTS, chunks.length)}`);
      const batchPromises = batchChunks.map((chunk, batchIndex) => {
        const globalChunkIndex = i + batchIndex;
        return translateTextChunk(chunk, targetLang, apiKey, globalChunkIndex, chunks.length, textArray, abortController, chunksLength).then((result) => {
          allTranslatedChunks[globalChunkIndex] = result;
          completedCount++;
          const totalTranslated = completedCount > 0 ? allTranslatedChunks.slice(0, completedCount).flat().length : 0;
          const totalRemaining = textArray.length - totalTranslated;
          sendProgressUpdate(totalTranslated, totalRemaining, tabId2);
          return result;
        });
      });
      try {
        const batchResults = await Promise.all(batchPromises);
        if (i + CONCURRENT_REQUESTS < chunks.length) {
          await delay(1e3, abortController);
        }
      } catch (error) {
        if (error.name === "AbortError" || error.message === "Translation aborted") {
          throw error;
        }
        console.error(`Error in batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1}:`, error);
        batchChunks.forEach((chunk, batchIndex) => {
          const globalChunkIndex = i + batchIndex;
          allTranslatedChunks[globalChunkIndex] = chunk.map(
            (text, textIndex) => `[Translation Error - Batch ${globalChunkIndex + 1}] ${text.text}`
          );
        });
      }
    }
    const finalTranslatedArray = allTranslatedChunks.flat();
    console.log(`Translation complete: ${finalTranslatedArray.length} items translated`);
    return finalTranslatedArray;
  }
  async function translateTextChunk(textArray, targetLang, apiKey, chunkIndex = 0, totalChunks = 1, fullTextArray = null, abortController, chunksLength = null) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const textList = textArray.map((text, index) => `${index + 1}. ${text}`).join("\n");
    const prompt = fullTextArray && totalChunks > 1 ? `${buildContextualPrompt(textArray, chunkIndex, totalChunks, fullTextArray, targetLang, chunksLength)}

${textList}` : `Translate the following text to ${targetLang}. Keep in mind of context, some / a lot of the text in this list are connected to each other. Once finished, return only the translated text in the same format (numbered list), without any additional explanation or commentary:

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
        maxOutputTokens: 2048
      }
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
        // Add abort signal to fetch
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error("Invalid response format from Gemini API");
      }
      const translatedText = data.candidates[0].content.parts[0].text;
      const translatedArray = parseNumberedResponse(translatedText, textArray.length);
      if (totalChunks > 1) {
        console.log(`Chunk ${chunkIndex + 1}/${totalChunks} translated successfully`);
      }
      return translatedArray;
    } catch (error) {
      if (error.name === "AbortError") {
        console.log(`Translation chunk ${chunkIndex + 1} aborted`);
        throw error;
      }
      console.error(`Gemini API error${totalChunks > 1 ? ` for chunk ${chunkIndex + 1}` : ""}:`, error);
      return textArray.map((text, index) => `[Translation Error${totalChunks > 1 ? ` - Chunk ${chunkIndex + 1}, Item ${index + 1}` : ""}] ${text}`);
    }
  }
  function buildContextualPrompt(currentChunk, chunkIndex, totalChunks, fullTextArray, targetLang, chunkLengths) {
    let contextPrompt = `Translate the following text to ${targetLang}. `;
    if (totalChunks > 1) {
      contextPrompt += `This is part ${chunkIndex + 1} of ${totalChunks} from a web page. `;
      let currentChunkStartIndex = 0;
      for (let i = 0; i < chunkIndex; i++) {
        currentChunkStartIndex += chunkLengths[i];
      }
      if (chunkIndex > 0) {
        const prevChunkStart = Math.max(0, currentChunkStartIndex - 3);
        const prevChunkEnd = currentChunkStartIndex;
        const contextItems = fullTextArray.slice(prevChunkStart, prevChunkEnd);
        if (contextItems.length > 0) {
          contextPrompt += `For context, the previous section ended with: "${contextItems.slice(-2).map((item) => item.text).join(" ")}" `;
        }
      }
      if (chunkIndex < totalChunks - 1) {
        const nextChunkStart = currentChunkStartIndex + chunkLengths[chunkIndex];
        const nextChunkEnd = Math.min(fullTextArray.length, nextChunkStart + 3);
        const nextItems = fullTextArray.slice(nextChunkStart, nextChunkEnd);
        if (nextItems.length > 0) {
          contextPrompt += `The next section will begin with: "${nextItems.slice(0, 2).map((item) => item.text).join(" ")}" `;
        }
      }
    }
    contextPrompt += `Maintain consistency in terminology and style. Return only the translated text in numbered format (1. 2. 3. etc.), without any additional explanation:`;
    return contextPrompt;
  }

  // Scripts/Background/modules/messageHandlers.js
  async function handleTranslateRequest(message, sendResponse) {
    try {
      currentTranslationState.isTranslating = true;
      const { tabId: tabId2 } = message;
      const result = await getStorageData(["targetLang"]);
      const targetLang = result.targetLang || "English";
      console.log("Translate requested for tab:", tabId2, "Language:", targetLang);
      await setStorageData({
        currentTranslationRequest: { tabId: tabId2, targetLang }
      });
      await sendContentMessage(tabId2, {
        action: "translate",
        tabId: tabId2
      });
      sendResponse({ success: true, message: "Translation initiated" });
    } catch (error) {
      sendResponse({
        success: false,
        message: "Error communicating with content script: " + error.message
      });
    }
    return true;
  }
  async function handleSaveAPIKey(message, sendResponse) {
    try {
      const apiKey = message.apiKey;
      if (!apiKey) {
        sendResponse({
          success: false,
          message: "Invalid API key format"
        });
        return true;
      }
      await validateApiKey(apiKey);
      await setStorageData({ apiKey: apiKey });
      sendResponse({
        success: true,
        message: "API key saved successfully"
      });
    } catch (error) {
      sendResponse({
        success: false,
        message: "Failed to save API key: " + error.message
      });
    }
    return true;
  }
  async function handleGetTextToTranslate(message, sender, sendResponse) {
    try {
      const textArray = message.textArray;
      const tabId2 = sender.tab.id;
      const result = await getStorageData(["apiKey", "currentTranslationRequest", "targetLang"]);
      const apiKey = result.apiKey || "";
      const translationRequest = result.currentTranslationRequest;
      const targetLang = result.targetLang || "English";
      if (!apiKey) {
        chrome.runtime.sendMessage({
          action: "APIKeyError"
        });
        sendResponse({
          success: false,
          message: "API key not found. Please set your API key first."
        });
        return;
      }
      if (!translationRequest) {
        sendResponse({
          success: false,
          message: "Translation request details not found."
        });
        return;
      }
      tabTranslationStates[tabId2] = {
        isTranslating: true,
        totalItems: textArray.length,
        translatedItems: 0,
        remainingItems: textArray.length
      };
      console.log(`Received ${textArray.length} texts to translate from tab ${tabId2}`);
      const abortController = new AbortController();
      tabAbortControllers[tabId2] = abortController;
      sendProgressUpdate(0, textArray.length, tabId2);
      const translatedArray = await performTranslation(textArray, targetLang, apiKey, tabId2, abortController);
      delete tabAbortControllers[tabId2];
      await sendContentMessage(tabId2, {
        action: "updateDOM",
        translatedText: translatedArray,
        textLength: textArray.length
      });
      console.log("Successfully sent translated text to content script");
      currentTranslationState.isTranslating = false;
      sendProgressUpdate(textArray.length, 0, tabId2);
      sendResponse({ success: true });
    } catch (error) {
      console.error("Translation error:", error);
      delete tabAbortControllers[tabId];
      if (error.name === "AbortError") {
        console.log(`Translation aborted for tab ${tabId}`);
        resetGlobalTranslationState();
        sendProgressUpdate(0, 0, tabId);
        sendResponse({
          success: false,
          error: "Translation was cancelled"
        });
      } else {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    }
    return true;
  }
  async function handleGetTranslationProgress(message, sendResponse) {
    try {
      const currentTab = await getCurrentTab();
      const tabId2 = currentTab.id;
      const state = tabTranslationStates[tabId2] || {
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
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
    return true;
  }

  // Scripts/Background/apiCalls.js
  chrome.tabs.onUpdated.addListener((tabId2, changeInfo, tab) => {
    if (changeInfo.status === "loading" && tabTranslationStates[tabId2]) {
      console.log(`Tab ${tabId2} is reloading, clearing translation state`);
      chrome.runtime.sendMessage({
        action: "reloading"
      });
      if (tabAbortControllers[tabId2]) {
        console.log(`Aborting translation for tab ${tabId2}`);
        tabAbortControllers[tabId2].abort();
        delete tabAbortControllers[tabId2];
      }
      delete tabTranslationStates[tabId2];
      if (currentTranslationState.isTranslating && currentTranslationState.tabId === tabId2) {
        resetGlobalTranslationState();
      }
    }
  });
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case "translate":
        return handleTranslateRequest(message, sendResponse);
      case "saveAPIKey":
        return handleSaveAPIKey(message, sendResponse);
      case "getTextToTranslate":
        return handleGetTextToTranslate(message, sender, sendResponse);
      case "getTranslationProgress":
        return handleGetTranslationProgress(message, sendResponse);
      default:
        console.warn(`Unknown action: ${message.action}`);
        sendResponse({
          success: false,
          error: `Unknown action: ${message.action}`
        });
        return false;
    }
  });
})();
