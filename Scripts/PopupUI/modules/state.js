/* =====================>>> MODULE FOR POPUP.JS <<<===================== */

// State Object
const state = {
    siteTranslated: false,
    isTranslating: false,
    translatedTextFinished: 0,
    activeTabId: null
};

// Get entire state object
export const getState = () => ({ ...state });

// Update state properties
export const setState = (updates) => {
    Object.assign(state, updates);
};

// Getters
export const getSiteTranslated = () => state.siteTranslated;
export const getIsTranslating = () => state.isTranslating;
export const getTranslatedTextFinished = () => state.translatedTextFinished;
export const getActiveTabId = () => state.activeTabId;

// Setters
export const setSiteTranslated = (value) => {
    state.siteTranslated = value;
};

export const setIsTranslating = (value) => {
    state.isTranslating = value;
};

export const setTranslatedTextFinished = (value) => {
    state.translatedTextFinished = value;
};

export const setActiveTabId = (value) => {
    state.activeTabId = value;
};
