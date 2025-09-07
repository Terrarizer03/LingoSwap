/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

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

export function hideMatchingLanguageOption(detectedLanguageCode) {
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
            if (firstVisible) {
                targetDropdown.value = firstVisible.value;
                chrome.storage.local.set({ targetLang: targetDropdown.value });
            }
        }
    } else {
        console.log('No matching language, all options are available.');
    }
}