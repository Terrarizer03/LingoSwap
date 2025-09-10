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
            
            // Quick check if tabLang even exists (if not, save a new tabLang)
            let selectedLanguage = result[tabLang]; 
            if (!selectedLanguage) {
                selectedLanguage = "English";
                chrome.storage.local.set({[tabLang]: selectedLanguage});
            }

            // Apply target language
            const targetLangSelect = document.getElementById('target-lang');
            targetLangSelect.value = selectedLanguage;
            
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