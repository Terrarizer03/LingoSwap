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
        
        // Hide the detected language option
        options.forEach(option => {
            if (option.value === languageName) {
                option.style.display = 'none';
                foundMatch = true;
                console.log(`Hidden ${languageName} option, site is already in this language`);
            }
        });

        if (foundMatch) {
            // Get user's preferred target language
            const targetLang = await chrome.storage.local.get(`targetLang_${tabId}`);
            const tabLang = targetLang[`targetLang_${tabId}`];

            console.log(`Detected language: ${languageName}, User preference: ${tabLang}`);

            // Only change the selection if the user's preferred language is the same as the detected language
            if (tabLang === languageName) {
                console.log('User preference matches detected language, selecting fallback option');
                
                // Find the first visible option as fallback
                const firstVisible = options.find(opt => opt.style.display !== 'none');
                
                if (firstVisible) {
                    targetDropdown.value = firstVisible.value;
                    saveTargetLanguage(firstVisible.value, tabId);
                    console.log(`Changed target language to: ${firstVisible.value}`);
                } else {
                    console.error('No visible options available in dropdown');
                }
            } else {
                console.log('User preference is different from detected language, keeping user preference');
            }
        }
    } else {
        console.log('No matching language, all options are available.');
    }
}