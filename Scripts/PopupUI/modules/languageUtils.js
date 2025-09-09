/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

import { saveTargetLanguage } from "./storage.js";

const languageCodeMap = {
    'en': 'English',
    'zh': 'Chinese',
    'zh-CN': 'Chinese',
    'zh-TW': 'Chinese', 
    'ja': 'Japanese',
    'ko': 'Korean',
    'tl': 'Filipino',
    'fil': 'Filipino'
};

export async function hideMatchingLanguageOption(detectedLanguageCode, tabId) {
    const targetDropdown = document.getElementById('target-lang');
    const languageName = languageCodeMap[detectedLanguageCode] || null;
    
    if (languageName && targetDropdown) {
        let foundMatch = false;
        const options = Array.from(targetDropdown.options);
        
        options.forEach(option => {
            if (option.value === languageName) {
                option.style.display = 'none';
                foundMatch = true;
                console.log(`Hidden ${languageName} option - site is already in this language`);
            }
        });

        if (foundMatch) {
            const firstVisible = options.find(opt => opt.style.display !== 'none');
            const targetLang = await chrome.storage.local.get(`targetLang_${tabId}`);
            const tabLang = targetLang[`targetLang_${tabId}`]

            if (firstVisible && firstVisible.value !== tabLang) {
                targetDropdown.value = firstVisible.value;
                saveTargetLanguage(firstVisible.value, tabId);
            } else {
                console.log('No matching language, all options are available.');
            }
        }
    } else {
        console.log('No matching language, all options are available.');
    }
}