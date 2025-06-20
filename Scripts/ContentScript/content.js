function initScript() {
  const interval = setInterval(() => {
    const contentDiv = document.getElementById('content');
    if (!contentDiv) return;

    const paragraphs = contentDiv.querySelectorAll('p');
    if (!paragraphs.length) return;

    paragraphs.forEach(paragraph => {
      paragraph.textContent = `Translated: ${paragraph.textContent.trim()}`;
    });

    console.log(`✅ Updated ${paragraphs.length} paragraphs.`);
    clearInterval(interval);
  }, 500);
}

// Check if DOM is already loaded
if (document.readyState === 'loading') {
  // DOM is still loading
  document.addEventListener('DOMContentLoaded', initScript);
} else {
  // DOM is already loaded
  initScript();
}