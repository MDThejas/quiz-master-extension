var isEdge = navigator.userAgent && navigator.userAgent.includes('Edg/');

chrome.runtime.onInstalled.addListener(function() {
  // setPanelBehavior not supported in Edge — wrap in try/catch
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch(e) {
    console.log('QuizMaster: sidePanel.setPanelBehavior not supported, using popup fallback');
  }
});

// On toolbar icon click — open side panel if supported, else open as tab
chrome.action.onClicked.addListener(function(tab) {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ tabId: tab.id }).catch(function() {
        // If sidePanel.open fails (e.g. Edge), open as tab
        chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
      });
    } else {
      chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
    }
  } catch(e) {
    chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  }
});

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type === 'OPEN_SIDEPANEL') {
    sendResponse({ ok: true });
  }

  if (msg.type === 'STORE_QUIZ_DATA') {
    chrome.storage.local.set({ pendingQuiz: msg.data }, function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (msg.type === 'GET_QUIZ_DATA') {
    chrome.storage.local.get('pendingQuiz', function(result) {
      sendResponse({ data: result.pendingQuiz || null });
    });
    return true;
  }

  if (msg.type === 'CLEAR_QUIZ_DATA') {
    chrome.storage.local.remove('pendingQuiz', function() {
      sendResponse({ ok: true });
    });
    return true;
  }

  return true;
});
