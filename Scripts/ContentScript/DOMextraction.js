(() => {
  // Scripts/ContentScript/domUtils.js
  function getFilteredTextElements(root) {
    const elements = [];
    if (root === document.body) {
      if (document.title && document.title.trim() !== "" && shouldIncludeText(document.title.trim())) {
        elements.push({
          node: document.head.querySelector("title"),
          // Still store the element node for consistency
          type: "page-title",
          originalText: document.title,
          trimmedText: sanitizeText(document.title.trim()),
          leadingWhitespace: document.title.match(/^\s*/)[0],
          trailingWhitespace: document.title.match(/\s*$/)[0]
        });
      }
    }
    function pushIfValidAttr(elem, attrName, type) {
      const value = elem.getAttribute(attrName) || "";
      if (value && value.trim() !== "" && shouldIncludeText(value.trim())) {
        elements.push({
          node: elem,
          type,
          originalText: value,
          trimmedText: sanitizeText(value.trim()),
          attribute: attrName,
          leadingWhitespace: value.match(/^\s*/)[0],
          trailingWhitespace: value.match(/\s*$/)[0]
        });
      }
    }
    function move(elem) {
      if (elem.closest && elem.closest("svg")) return;
      const SKIPPED_TAGS = /* @__PURE__ */ new Set(["SCRIPT", "STYLE", "IFRAME", "NOSCRIPT", "OBJECT", "EMBED", "CANVAS"]);
      if (elem.tagName && SKIPPED_TAGS.has(elem.tagName.toUpperCase())) return;
      if (elem.nodeType === Node.ELEMENT_NODE) {
        const computedStyle = getComputedStyle(elem);
        if (elem.isContentEditable) return;
        if (computedStyle.display === "none" || computedStyle.visibility === "hidden") return;
      }
      if (elem.nodeType === Node.ELEMENT_NODE) {
        extractAttributeText(elem);
      }
      Array.from(elem.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const originalText = node.textContent;
          const trimmedText = originalText.trim();
          if (trimmedText !== "" && shouldIncludeText(trimmedText)) {
            const leadingMatch = originalText.match(/^\s*/);
            const trailingMatch = originalText.match(/\s*$/);
            elements.push({
              node,
              type: "text",
              originalText,
              // Store original text with all spacing
              trimmedText: sanitizeText(trimmedText),
              // Store trimmed text for translation
              // Store leading and trailing whitespace patterns
              leadingWhitespace: leadingMatch ? leadingMatch[0] : "",
              trailingWhitespace: trailingMatch ? trailingMatch[0] : ""
            });
          }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          move(node);
        }
      });
    }
    function sanitizeText(text) {
      return text.replace(/[<>&"']/g, function(match) {
        return {
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&#x27;"
        }[match];
      });
    }
    function extractAttributeText(elem) {
      pushIfValidAttr(elem, "title", "title");
      pushIfValidAttr(elem, "alt", "alt");
      pushIfValidAttr(elem, "placeholder", "placeholder");
      pushIfValidAttr(elem, "aria-label", "aria-label");
      if (elem.tagName && (elem.tagName.toUpperCase() === "INPUT" || elem.tagName.toUpperCase() === "BUTTON")) {
        const inputType = elem.type ? elem.type.toLowerCase() : "text";
        if (["button", "submit", "reset"].includes(inputType)) {
          pushIfValidAttr(elem, "value", "value");
        }
      }
    }
    function shouldIncludeText(text) {
      if (text.includes("{") && text.includes("}") && (text.includes("position:") || text.includes("font-size:") || text.includes("background-color:") || text.includes("padding:"))) {
        return false;
      }
      if (text.length > 100 && (text.includes("position:") || text.includes("background-color:"))) {
        return false;
      }
      return true;
    }
    move(root);
    return elements;
  }
  function replaceWithTranslation(elements, translations) {
    if (!elements || !Array.isArray(elements)) {
      throw new Error("Elements must be a valid array");
    }
    if (!translations || !Array.isArray(translations)) {
      throw new Error("Translations must be a valid array");
    }
    if (elements.length !== translations.length) {
      console.error(`Error: Elements count: ${elements.length} and translations count: ${translations.length} mismatch`);
      throw new Error("Element and translation count mismatch");
    }
    elements.forEach((elem, index) => {
      if (translations[index]) {
        restoreTextToElement(elem, translations[index]);
      }
    });
    console.log("Replaced elements with translations");
    return { translationState: "TranslatedText" };
  }
  function createTextStorage(elements) {
    if (!elements || !Array.isArray(elements)) {
      throw new Error("Elements must be a valid array");
    }
    const originalTexts = elements.map((elem) => elem.originalText);
    console.log(`Created storage for ${originalTexts.length} original texts`);
    return {
      originalTexts,
      originalElements: elements,
      // Helper methods for this storage
      restoreOriginal() {
        return restoreTexts(this.originalElements, this.originalTexts);
      }
    };
  }
  function restoreTexts(elements, texts) {
    if (!elements || elements.length === 0) {
      console.error("No elements provided for restoration.");
      return false;
    }
    if (!texts || texts.length === 0) {
      console.error("No texts provided for restoration.");
      return false;
    }
    try {
      if (elements.length !== texts.length) {
        console.warn(`Element count mismatch: ${elements.length} elements vs ${texts.length} texts`);
      }
      elements.forEach((elem, index) => {
        if (texts[index] !== void 0) {
          restoreTextToElement(elem, texts[index]);
        }
      });
      console.log("Texts restored successfully");
      return true;
    } catch (error) {
      console.error("Error restoring texts:", error.message);
      throw error;
    }
  }
  var elementRestorers = {
    "text": (elem, text) => {
      const newText = elem.leadingWhitespace + text + elem.trailingWhitespace;
      elem.node.textContent = newText;
    },
    "title": (elem, text) => elem.node.title = text,
    "alt": (elem, text) => elem.node.alt = text,
    "placeholder": (elem, text) => elem.node.placeholder = text,
    "aria-label": (elem, text) => elem.node.setAttribute("aria-label", text),
    "value": (elem, text) => elem.node.value = text,
    "page-title": (elem, text) => document.title = text
  };
  function restoreTextToElement(elem, text) {
    if (!elem || !elem.type) {
      throw new Error("Invalid element object provided");
    }
    try {
      const restorer = elementRestorers[elem.type];
      if (restorer) {
        restorer(elem, text);
      } else {
        console.warn(`Unknown element type: ${elem.type}`);
        if (elem.attribute) {
          elem.node.setAttribute(elem.attribute, text);
        } else {
          const newText = elem.leadingWhitespace + text + elem.trailingWhitespace;
          elem.node.textContent = newText;
        }
      }
    } catch (error) {
      console.error(`Error restoring text for element type ${elem.type}:`, error);
      throw error;
    }
  }

  // Scripts/ContentScript/languageDetection.js
  async function getSiteLanguage(root) {
    const textElements = getFilteredTextElements(root);
    const textArray = textElements.map((element) => element.trimmedText || element.originalText || "");
    const arrayCombined = textArray.join(" ");
    if (!arrayCombined || arrayCombined.length < 10) {
      return {
        language: "und",
        // undetermined
        isReliable: false,
        confidence: 0
      };
    }
    try {
      const result = await chrome.i18n.detectLanguage(arrayCombined);
      if (result.isReliable && result.languages.length > 0) {
        return {
          language: result.languages[0].language,
          isReliable: result.isReliable,
          confidence: result.languages[0].percentage,
          allDetections: result.languages
          // All detected languages with percentages
        };
      } else {
        return {
          language: result.languages.length > 0 ? result.languages[0].language : "und",
          isReliable: false,
          confidence: result.languages.length > 0 ? result.languages[0].percentage : 0,
          allDetections: result.languages
        };
      }
    } catch (error) {
      console.error("Language detection failed:", error);
      return {
        language: "und",
        isReliable: false,
        confidence: 0,
        error: error.message
      };
    }
  }

  // Scripts/ContentScript/textTranslation.js
  console.log("Translation content script loaded");
  console.log(`Found ${getFilteredTextElements(document.body).length} text elements on page load`);
  var textLength = null;
  var activeTabId = null;
  var isTranslating = false;
  var isTranslated = false;
  var translationState = "RawText";
  var textStorage = null;
  var translatedTexts = [];
  async function testTranslation() {
    console.log("Starting translation test...");
    if (isTranslated) {
      console.log("Page is already translated. Skipping translation.");
      return;
    }
    try {
      const elements = getFilteredTextElements(document.body);
      const texts = elements.map((elem) => elem.trimmedText);
      if (texts.length === 0) {
        console.log("No texts found to translate");
        return;
      }
      console.log(`Processing ${texts.length} texts for translation...`);
      textStorage = createTextStorage(elements);
      chrome.runtime.sendMessage({
        action: "getTextToTranslate",
        textArray: texts
      }, (response) => {
        if (response && response.success) {
          console.log("Text elements sent for translation:", texts.length);
        } else {
          isTranslated = false;
          isTranslating = false;
          textStorage = null;
        }
      });
    } catch (error) {
      console.error("Translation failed:", error.message);
      if (textStorage) {
        console.log("Attempting to restore original text due to translation failure...");
        try {
          textStorage.restoreOriginal();
        } catch (restoreError) {
          console.error("Failed to restore original text:", restoreError.message);
        }
      }
      isTranslated = false;
      textStorage = null;
    }
  }
  function restoreTranslatedText() {
    if (translatedTexts.length === 0) {
      console.error("No translated text stored to restore.");
      return;
    }
    if (!textStorage || !textStorage.originalElements) {
      console.error("No original elements stored.");
      return;
    }
    try {
      restoreTexts(textStorage.originalElements, translatedTexts);
      console.log("Translated text restored successfully");
    } catch (error) {
      console.error("Error restoring translated text:", error.message);
      throw error;
    }
  }
  function restoreOriginalText() {
    if (!textStorage) {
      console.error("No text storage available to restore from.");
      return;
    }
    try {
      textStorage.restoreOriginal();
      console.log("Original text restored successfully");
    } catch (error) {
      console.error("Error restoring original text:", error.message);
      throw error;
    }
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "isInjected") {
      sendResponse({ injected: true });
      return true;
    }
    if (message.action === "dominantLanguage") {
      (async () => {
        try {
          const result = await getSiteLanguage(document.body);
          sendResponse({
            language: result.language,
            confidence: result.confidence,
            isReliable: result.isReliable
          });
        } catch (error) {
          sendResponse({
            language: null,
            error: error.message
          });
        }
      })();
      return true;
    }
    if (message.action === "translate") {
      activeTabId = message.tabId;
      console.log("Received request to get text nodes");
      (async () => {
        try {
          isTranslating = true;
          await testTranslation();
          sendResponse({ success: true, message: "Translation complete" });
        } catch (err) {
          sendResponse({ success: false, message: "Translation failed", error: err.message });
        }
      })();
      return true;
    }
    if (message.action === "translatingOrNot") {
      sendResponse({
        success: true,
        translationStatus: isTranslating
      });
    }
    if (message.action === "updateDOM") {
      console.log("Received translated text from background");
      const translatedText = message.translatedText;
      textLength = message.textLength;
      try {
        const elements = getFilteredTextElements(document.body);
        translatedTexts = translatedText;
        replaceWithTranslation(elements, translatedText);
        isTranslating = false;
        isTranslated = true;
        translationState = "TranslatedText";
        chrome.runtime.sendMessage({
          action: "translationComplete",
          tabId: activeTabId,
          translationState: isTranslated,
          textLength
        });
        console.log("DOM updated with translations");
        sendResponse({ success: true });
      } catch (error) {
        console.error("Error updating DOM:", error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    if (message.action === "showOriginal") {
      console.log("Received toggle request for original/translated text.");
      const tabId = message.tabId;
      try {
        if (isTranslated) {
          if (translationState === "TranslatedText") {
            restoreOriginalText();
            translationState = "RawText";
            console.log("Restored original text.");
          } else {
            restoreTranslatedText();
            translationState = "TranslatedText";
            console.log("Restored translated text.");
          }
          chrome.runtime.sendMessage({
            action: "toggleComplete",
            state: translationState,
            tabId
          });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error("Toggle failed:", error.message);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    }
    if (message.action === "getTranslationState") {
      sendResponse({ isTranslated, translationState, textLength });
    }
  });
})();
