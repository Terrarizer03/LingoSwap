/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

export function initializeUI() {
    // Cache DOM elements that are used frequently
    const elements = {
        settingsBtn: document.getElementById('settings-btn'),
        darkModeBtn: document.getElementById('dark-mode-btn'),
        settingsPanel: document.getElementById('settings-panel'),
        homePanel: document.getElementById('home-panel'),
        headerTitle: document.getElementById('header-extension'),
        currentVersion: document.getElementById('header-version')
    };
    
    // Setup basic UI event listeners
    elements.settingsBtn?.addEventListener('click', toggleSettings);
    elements.darkModeBtn?.addEventListener('click', toggleDarkMode);
    
    return elements;
}

function toggleSettings() {
    const settingsPanel = document.getElementById('settings-panel');
    const homePanel = document.getElementById('home-panel');
    const headerTitle = document.getElementById('header-extension');
    const currentVersion = document.getElementById('header-version');
    
    settingsPanel.classList.toggle('hidden');
    homePanel.classList.toggle('hidden');
    headerTitle.classList.toggle('hidden');
    currentVersion.classList.toggle('hidden');
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    document.getElementById('light-mode-icon').classList.toggle('hidden', !isDark);
    document.getElementById('dark-mode-icon').classList.toggle('hidden', isDark);
    
    // Save dark mode preference
    chrome.storage.local.set({ darkMode: isDark });
}

export function addLoadingState(button, state = false) {
    if (state) {
        button.classList.add('loading');
    } else {
        button.classList.remove('loading');
    }
}

export function addShakeAnimation(button) {
    button.classList.add('shake');
    setTimeout(() => {
        button.classList.remove('shake');
    }, 100);
}

export function updateButtonState(isTranslated, translationState) {
    const showOriginalBtn = document.getElementById('show-original-btn');
    if (!showOriginalBtn) return;
    
    if (!isTranslated) {
        showOriginalBtn.disabled = true;
        showOriginalBtn.textContent = 'Show Original';
    } else {
        showOriginalBtn.disabled = false;
        showOriginalBtn.textContent = translationState === 'RawText' ? 'Show Translated' : 'Show Original';
    }
}

export function resetTranslationUI(showSuccess = false) {
    const translateBtn = document.getElementById('translate-btn');
    if (!translateBtn) return;
    
    if (showSuccess) {
        translateBtn.textContent = "Done!";
        setTimeout(() => {
            translateBtn.disabled = false;
            translateBtn.textContent = "Translate";
        }, 1000);
    } else {
        translateBtn.disabled = false;
        translateBtn.textContent = "Translate";
    }
}

export function updateTranslationReport(progress) {
    const translatingDisplay = document.getElementById('translating-count');
    const translatedDisplay = document.getElementById('translated-count');

    if (translatedDisplay) {
        translatedDisplay.textContent = progress.translated || 0;
    }
    if (translatingDisplay) {
        translatingDisplay.textContent = progress.remaining || 0;
    }
}