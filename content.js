var SITE = (function() {
  var h = location.hostname;
  if (h.includes('claude.ai')) return 'claude';
  if (h.includes('chatgpt.com') || h.includes('chat.openai.com')) return 'chatgpt';
  if (h.includes('gemini.google.com')) return 'gemini';
  return 'unknown';
})();

var IS_EDGE = navigator.userAgent.includes('Edg/');

var MSG_SELECTORS = {
  // Claude.ai — tries multiple selectors in order, uses first that returns results
  claude: [
    '[data-testid="assistant-message"]',       // current Claude UI
    '.font-claude-message',                     // older Claude UI
    '[class*="ConversationItem"]:not([class*="Human"])', // fallback
    '.prose',                                   // generic prose blocks
    'div[class*="assistant"]',                  // class containing "assistant"
    'div[data-is-streaming]',                   // streaming responses
    'div[class*="claude"]'                      // any claude-named div
  ],
  chatgpt: [
    '[data-message-author-role="assistant"]',
    '.agent-turn',
    'article',
    '[class*="assistant"]'
  ],
  gemini: [
    '.model-response-text',
    '.response-content',
    'model-response',
    '[class*="model"]'
  ]
};
var INPUT_SELECTORS = {
  claude: [
    'div[contenteditable="true"][data-testid="chat-input"]',  // current Claude
    'div[contenteditable="true"].ProseMirror',
    '#prompt-textarea',
    'div[contenteditable="true"][class*="editor"]',
    'div[contenteditable="true"]'
  ],
  chatgpt: [
    '#prompt-textarea',
    'div[contenteditable="true"]',
    'textarea'
  ],
  gemini: [
    'rich-textarea .ql-editor',
    'div[contenteditable="true"]',
    'textarea'
  ]
};
var SUBMIT_SELECTORS = {
  claude: [
    'button[aria-label="Send message"]',
    'button[data-testid="send-button"]',
    'button[aria-label="Send"]',
    'button[type="button"][class*="send"]',
    'fieldset button:last-of-type'             // last button in the input fieldset
  ],
  chatgpt: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send prompt"]',
    'button[aria-label="Send message"]'
  ],
  gemini: [
    'button[aria-label="Send message"]',
    '.send-button'
  ]
};

var processedBlocks   = new WeakSet();
var observer          = null;
var msgCountBefore    = 0;

function getAllMsgBlocks() {
  var sels = MSG_SELECTORS[SITE] || [];
  for (var i = 0; i < sels.length; i++) {
    var els = document.querySelectorAll(sels[i]);
    if (els.length) return Array.from(els);
  }

  // Last resort fallback: find all large text blocks on the page
  // Filter to ones that look like AI responses (not input boxes)
  if (SITE === 'claude') {
    var allDivs = Array.from(document.querySelectorAll('div, article, section'));
    return allDivs.filter(function(el) {
      var text = el.innerText || '';
      // Must be substantial text, not editable, not tiny
      return text.length > 200
        && el.getAttribute('contenteditable') !== 'true'
        && el.getAttribute('role') !== 'textbox'
        && !el.querySelector('[contenteditable]') // not a parent of input
        && el.children.length > 0;
    });
  }
  return [];
}
function getInput() {
  var sels = INPUT_SELECTORS[SITE] || [];
  for (var i = 0; i < sels.length; i++) {
    var el = document.querySelector(sels[i]);
    if (el) return el;
  }
  return null;
}
function getSubmit() {
  var sels = SUBMIT_SELECTORS[SITE] || [];
  for (var i = 0; i < sels.length; i++) {
    var el = document.querySelector(sels[i]);
    if (el && !el.disabled) return el;
  }
  return null;
}

// ── Robust MCQ counter ─────────────────────────────────────────────────────
function countMCQs(text) {
  // Strategy 1: count lines that look like numbered questions
  // Matches: "1.", "1)", "Q1.", "Q1)", "Question 1." — case insensitive
  var lines = text.split('\n');
  var questionLines = 0;
  var prevWasQuestion = false;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    // Numbered: 1. / 1) / Q1. / Q1) / Question 1.
    if (/^(Q(uestion)?\s*)?\d+[\.\)]\s+\S/.test(line)) {
      // Make sure it's not just "A) B) C) D)" options
      // A question line won't start with a single letter
      if (!/^[A-Da-d][\.\)]\s/.test(line)) {
        questionLines++;
        prevWasQuestion = true;
      }
    } else {
      prevWasQuestion = false;
    }
  }

  // Strategy 2: count option clusters — every 4 options = 1 question
  var optionLines = 0;
  for (var j = 0; j < lines.length; j++) {
    var l = lines[j].trim();
    if (/^[A-Da-d][\.\)]\s+\S/.test(l)) optionLines++;
  }
  var fromOptions = Math.floor(optionLines / 4);

  // Strategy 3: look for "Answer:" lines — each = 1 question
  var answerLines = (text.match(/^\s*(answer|ans|correct\s*answer)\s*[:\-]/gim) || []).length;

  // Take the best estimate
  var best = Math.max(questionLines, fromOptions, answerLines);
  return best;
}

function looksLikeMCQ(text) {
  return countMCQs(text) >= 2;
}

// ── Inject a clean single button per block ─────────────────────────────────
function tryInjectButton(block) {
  if (processedBlocks.has(block)) return;
  var text = (block.innerText || '').trim();
  if (text.length < 80) return;
  if (!looksLikeMCQ(text)) return;

  processedBlocks.add(block);

  var mcqCount = countMCQs(text);

  var wrap = document.createElement('div');
  wrap.className = 'qm-btn-wrap';
  wrap.innerHTML =
    '<div class="qm-detected-label">&#9889; ' + mcqCount + ' MCQs detected</div>' +
    '<button class="qm-launch-btn"><span class="qm-icon">&#9889;</span> Launch Quiz</button>' +
    '<div class="qm-status"></div>';

  var btn    = wrap.querySelector('.qm-launch-btn');
  var status = wrap.querySelector('.qm-status');

  btn.addEventListener('click', function() {
    btn.disabled = true;
    btn.textContent = 'Requesting JSON from AI...';
    status.textContent = '';

    // Store mcqCount so sidepanel knows max available
    fetchJSONFromAI(text, mcqCount, btn, status);
  });

  var parent = block.parentElement;
  if (parent) parent.insertBefore(wrap, block.nextSibling);
}

// ── Clean raw AI text before JSON.parse ───────────────────────────────────
function cleanJSON(raw) {
  // 1. Extract just the [...] portion
  var s = raw.indexOf('[');
  var e = raw.lastIndexOf(']');
  if (s === -1 || e === -1) return null;
  var str = raw.slice(s, e + 1);

  // 2. Remove all emoji and non-ASCII characters that break JSON
  str = str.replace(/[\u007F-\uFFFF]/g, function(ch) {
    // Keep only safe Latin extended chars, replace everything else with space
    return ch.charCodeAt(0) < 256 ? ch : ' ';
  });

  // 3. Remove control characters (newlines inside strings are fine, others break parse)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ');

  // 4. Fix common AI mistakes: trailing commas before ] or }
  str = str.replace(/,\s*}/g, '}');
  str = str.replace(/,\s*]/g, ']');

  // 5. Fix unescaped double-quotes inside string values
  // Strategy: replace any " that is NOT preceded by \ and NOT a structural quote
  // We do a simple pass: replace smart/curly quotes with straight quotes first
  str = str.replace(/[\u201C\u201D\u201E\u201F]/g, '"');
  str = str.replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  return str;
}

// ── Ask AI to convert MCQs to JSON (no difficulty/count yet — sidepanel decides) ──
function fetchJSONFromAI(originalText, mcqCount, btn, status) {
  var prompt =
    'Convert ALL the MCQs from your previous response into a JSON array. ' +
    'STRICT RULES — follow exactly or the output will break: ' +
    '1. Output ONLY the raw JSON array. No markdown, no backticks, no explanation, no extra text. ' +
    '2. Start your response with [ and end with ] and nothing else. ' +
    '3. Do NOT use emoji or special characters anywhere in the JSON. ' +
    '4. Use only plain straight double quotes " for JSON strings. ' +
    '5. Each string value must not contain unescaped double quotes. ' +
    '6. Each item schema (copy exactly): ' +
    '{"id":1,"question":"question text here","options":["option A","option B","option C","option D"],' +
    '"correctAnswer":0,"topic":"specific subtopic name","difficulty":"Easy","explanation":"detailed explanation here","sourcePage":null} ' +
    '7. correctAnswer is 0-based index (0=A, 1=B, 2=C, 3=D). ' +
    '8. difficulty must be exactly one of: Easy Medium Hard. ' +
    '9. topic must be a SPECIFIC subtopic — not the broad subject. ' +
    'For example: if the subject is DSA, topic should be Arrays, Linked Lists, Binary Trees, Sorting Algorithms, Graph Traversal, Dynamic Programming, Stack, Queue, Hashing, etc. ' +
    'If the subject is OS, topic should be CPU Scheduling, Deadlocks, Memory Management, Virtual Memory, etc. ' +
    'Never use the broad subject name as the topic. Always use the specific concept being tested. ' +
    '10. explanation must be 3-4 sentences minimum. Explain WHY the correct answer is right, WHY the other options are wrong, and the underlying concept behind the question. ' +
    'Output ONLY the JSON array starting with [ — nothing before or after.';

  msgCountBefore = getAllMsgBlocks().length;

  typeAndSend(prompt, function(captured) {
    if (!captured) {
      btn.disabled = false;
      btn.innerHTML = '<span class="qm-icon">&#9889;</span> Launch Quiz';
      status.textContent = 'No response captured. Try again.';
      return;
    }

    var cleaned = cleanJSON(captured);
    if (!cleaned) {
      btn.disabled = false;
      btn.innerHTML = '<span class="qm-icon">&#9889;</span> Launch Quiz';
      status.textContent = 'Could not find JSON in response. Try clicking again.';
      return;
    }

    var arr;
    try {
      arr = JSON.parse(cleaned);
    } catch(err) {
      // Last resort: try to salvage partial JSON by finding complete objects
      try {
        var objects = [];
        var depth = 0, objStart = -1;
        for (var i = 0; i < cleaned.length; i++) {
          if (cleaned[i] === '{') { if (depth === 0) objStart = i; depth++; }
          else if (cleaned[i] === '}') {
            depth--;
            if (depth === 0 && objStart !== -1) {
              try {
                var obj = JSON.parse(cleaned.slice(objStart, i + 1));
                if (obj.question && obj.options) objects.push(obj);
              } catch(e2) {}
              objStart = -1;
            }
          }
        }
        if (objects.length > 0) { arr = objects; }
        else throw new Error('No valid question objects found');
      } catch(e3) {
        btn.disabled = false;
        btn.innerHTML = '<span class="qm-icon">&#9889;</span> Launch Quiz';
        status.textContent = 'Parse failed. Click again to retry.';
        return;
      }
    }

    if (!Array.isArray(arr) || arr.length === 0) {
      btn.disabled = false;
      btn.innerHTML = '<span class="qm-icon">&#9889;</span> Launch Quiz';
      status.textContent = 'Empty response. Click again to retry.';
      return;
    }

    chrome.runtime.sendMessage({
      type: 'STORE_QUIZ_DATA',
      data: { questions: arr, config: { timerOn: false, timerSecs: 45 } }
    }, function() {
      btn.disabled = false;
      btn.innerHTML = '<span class="qm-icon">&#9989;</span> ' + arr.length + ' questions ready — click toolbar icon';
      btn.style.background = '#1a7f3c';
      status.textContent = IS_EDGE ? 'Opens in a new tab.' : 'Opens in the side panel.';
      setTimeout(function() {
        btn.innerHTML = '<span class="qm-icon">&#9889;</span> Launch Quiz';
        btn.style.background = '';
        status.textContent = '';
      }, 15000);
    });
  });
}

function typeAndSend(text, onResponse) {
  var input = getInput();
  if (!input) { alert('Could not find chat input. Click the input field first.'); return; }

  var isEditable = input.getAttribute('contenteditable') === 'true' || input.getAttribute('role') === 'textbox';
  try {
    if (isEditable) {
      input.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      document.execCommand('insertText', false, text);
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    } else {
      var setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, text);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  } catch(e) { console.warn('QM input error:', e); }

  setTimeout(function() {
    var sub = getSubmit();
    if (sub) sub.click();
    else input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    waitForStableJSON(onResponse);
  }, 500);
}

function waitForStableJSON(callback) {
  var lastText = '', stableCount = 0, attempts = 0;
  var poll = setInterval(function() {
    attempts++;
    if (attempts > 250) { clearInterval(poll); callback(''); return; }

    var blocks = getAllMsgBlocks();
    if (blocks.length <= msgCountBefore) return;

    var text = (blocks[blocks.length-1].innerText || '').trim();
    if (text !== lastText) { lastText = text; stableCount = 0; return; }
    stableCount++;

    var hasJSON = text.includes('"question"') && text.includes('"options"');
    if (stableCount >= 4 && hasJSON) { clearInterval(poll); callback(text); }
    else if (stableCount >= 15)      { clearInterval(poll); callback(text); }
  }, 800);
}

function scanAll() { getAllMsgBlocks().forEach(tryInjectButton); }
function startObserver() {
  if (observer) observer.disconnect();
  observer = new MutationObserver(function() { scanAll(); });
  observer.observe(document.body, { childList: true, subtree: true });
}

setTimeout(function() { scanAll(); startObserver(); }, 2000);
