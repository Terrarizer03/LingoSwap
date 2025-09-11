/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

function getLocal(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
} 

function getSession(keys) {
    return new Promise((resolve) => {
        chrome.storage.session.get(keys, resolve);
    });
}

export async function loadStoredSettings(tabId) {
    const tabLang = `targetLang_${tabId}`;

    const local = await getLocal(["darkMode"]);
    const session = await getSession([tabLang]);

    // Apply dark mode
    if (local.darkMode) {
        document.body.classList.add('dark-mode');
        document.getElementById('light-mode-icon')?.classList.remove('hidden');
        document.getElementById('dark-mode-icon')?.classList.add('hidden');
    }

    // Quick check if tabLang even exists (if not, save a new tabLang)
    let selectedLanguage = session[tabLang];
    if (!selectedLanguage) {
        selectedLanguage = "English";
        chrome.storage.session.set({[tabLang]: selectedLanguage});
    }

    const targetLangSelect = document.getElementById('target-lang');

    // Apply target language
    if (targetLangSelect) {
        targetLangSelect.value = selectedLanguage;
    }
    
    return { ...local, ...session };
}

export function saveTargetLanguage(targetLang, tabId) {
    return chrome.storage.session.set({ [`targetLang_${tabId}`]: targetLang });
}

export function saveDarkMode(isDark) {
    chrome.storage.local.set({ darkMode: isDark });
}

export function deleteTargetLanguage(tabId) {
    chrome.storage.session.remove(`targetLang_${tabId}`);
}