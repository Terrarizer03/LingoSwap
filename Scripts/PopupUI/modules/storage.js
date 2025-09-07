export async function loadStoredSettings() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["darkMode", "targetLang"], (result) => {
            // Apply dark mode
            if (result.darkMode) {
                document.body.classList.add('dark-mode');
                document.getElementById('light-mode-icon')?.classList.remove('hidden');
                document.getElementById('dark-mode-icon')?.classList.add('hidden');
            }
            
            // Apply target language
            const targetLangSelect = document.getElementById('target-lang');
            if (result.targetLang && targetLangSelect) {
                targetLangSelect.value = result.targetLang;
            }
            
            resolve(result);
        });
    });
}

export function saveTargetLanguage(targetLang) {
    chrome.storage.local.set({ targetLang });
}

export function saveDarkMode(isDark) {
    chrome.storage.local.set({ darkMode: isDark });
}