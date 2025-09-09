/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

export async function loadStoredSettings(tabId) {
    const tabLang = `targetLang_${tabId}`
    
    return new Promise((resolve) => {
        chrome.storage.local.get(["darkMode", tabLang], (result) => {
            // Apply dark mode
            if (result.darkMode) {
                document.body.classList.add('dark-mode');
                document.getElementById('light-mode-icon')?.classList.remove('hidden');
                document.getElementById('dark-mode-icon')?.classList.add('hidden');
            }
            
            // Apply target language
            const targetLangSelect = document.getElementById('target-lang');
            if (result[tabLang] && targetLangSelect) {
                targetLangSelect.value = result[tabLang] || "English";
            }
            
            resolve(result);
        });
    });
}

export function saveTargetLanguage(targetLang, tabId) {
    return chrome.storage.local.set({ [`targetLang_${tabId}`]: targetLang });
}

export function saveDarkMode(isDark) {
    chrome.storage.local.set({ darkMode: isDark });
}

export function deleteTargetLanguage(tabId) {
    chrome.storage.local.remove(`targetLang_${tabId}`);
}