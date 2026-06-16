const SUPPORTED = {
  'claude.ai': 'Claude.ai',
  'chatgpt.com': 'ChatGPT',
  'chat.openai.com': 'ChatGPT',
  'gemini.google.com': 'Gemini',
};

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  const url = tab?.url || '';
  const siteTag = document.getElementById('site-tag');
  const statusText = document.getElementById('status-text');

  const matched = Object.entries(SUPPORTED).find(([domain]) => url.includes(domain));

  if (matched) {
    siteTag.textContent = '✅ ' + matched[1] + ' detected';
    statusText.textContent = 'Ask the AI about your topic, click ⚡ Launch Quiz below the response, then click this toolbar icon to open the quiz panel.';
  } else {
    siteTag.textContent = '⚠ Not on a supported site';
    statusText.textContent = 'Navigate to Claude.ai, ChatGPT, or Gemini to use Quiz Master.';
  }
});

// Clicking the popup icon itself opens the side panel (via openPanelOnActionClick)
// so this popup just shows status — clicking anywhere outside closes it and opens panel
document.getElementById('open-site-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://claude.ai' });
  window.close();
});
