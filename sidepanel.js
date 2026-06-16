// ── State ──────────────────────────────────────────────────────────────────
var allQuestions = [];
var questions    = [];
var current      = 0;
var answers      = [];
var confidences  = [];
var timeTaken    = [];
var timerInterval = null;
var timerOn      = false;
var timerSecs    = 45;
var timerLeft    = 0;
var qStart       = 0;

// ── Screen switching ───────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById('screen-' + id).classList.add('active');
}

// ── Continuous polling — detects new quiz data at any time ─────────────────
function startPolling() {
  function check() {
    chrome.runtime.sendMessage({ type: 'GET_QUIZ_DATA' }, function(res) {
      if (chrome.runtime.lastError) return;
      if (res && res.data && res.data.questions && res.data.questions.length) {
        chrome.runtime.sendMessage({ type: 'CLEAR_QUIZ_DATA' });
        allQuestions = res.data.questions;
        timerOn  = !!(res.data.config && res.data.config.timerOn);
        timerSecs = (res.data.config && res.data.config.timerSecs) || 45;
        buildConfigScreen();
        show('config');
      }
    });
  }
  check(); // immediate check when panel opens
  setInterval(check, 1000);
}

// ── Config screen ──────────────────────────────────────────────────────────
function buildConfigScreen() {
  var total = allQuestions.length;
  document.getElementById('cfg-total-label').textContent = total + ' questions loaded from AI';

  // Dynamic count options: 5, 10, 15 … up to total
  var countSel = document.getElementById('cfg-count');
  countSel.innerHTML = '';
  // Build options: 5, 10, 15 ... up to total
  // Always include the actual total as last option if not already there
  var opts = [];
  for (var n = 5; n < total; n += 5) opts.push(n);
  opts.push(total); // always include full count

  opts.forEach(function(n, idx) {
    var o = document.createElement('option');
    o.value = n;
    o.textContent = n + ' questions';
    // Default: last option (all questions)
    if (idx === opts.length - 1) o.selected = true;
    countSel.appendChild(o);
  });

  // Difficulty options — only show difficulties that actually exist in data
  var diffSel = document.getElementById('cfg-diff');
  diffSel.innerHTML = '<option value="all">All difficulties (mixed)</option>';
  var found = {};
  allQuestions.forEach(function(q) { if (q.difficulty) found[q.difficulty] = true; });
  ['Easy', 'Medium', 'Hard'].forEach(function(d) {
    if (found[d]) {
      var o = document.createElement('option');
      o.value = d;
      o.textContent = d + ' only';
      diffSel.appendChild(o);
    }
  });
}

function launchQuiz() {
  var count    = parseInt(document.getElementById('cfg-count').value) || 10;
  var diff     = document.getElementById('cfg-diff').value;
  timerOn      = document.getElementById('cfg-timer-toggle').classList.contains('on');
  timerSecs    = parseInt(document.getElementById('cfg-timer-secs').value) || 45;

  // Filter by difficulty
  var pool = diff === 'all'
    ? allQuestions.slice()
    : allQuestions.filter(function(q) { return q.difficulty === diff; });

  // Fallback: if filter returns nothing use all
  if (pool.length === 0) pool = allQuestions.slice();

  // Slice to requested count
  questions = pool.slice(0, count);

  // Reset state
  current     = 0;
  answers     = new Array(questions.length).fill(null);
  confidences = new Array(questions.length).fill(null);
  timeTaken   = new Array(questions.length).fill(0);

  show('quiz');
  renderQuestion();
}

// ── Quiz rendering ─────────────────────────────────────────────────────────
function renderQuestion() {
  var q     = questions[current];
  var total = questions.length;
  if (!q) return;

  // Progress
  document.getElementById('prog-fill').style.width = ((current / total) * 100) + '%';
  document.getElementById('q-label').textContent   = (current + 1) + ' / ' + total;

  // Meta badges
  var diffCls = ({ Easy:'easy', Medium:'medium', Hard:'hard' })[q.difficulty] || 'medium';
  var meta    = '<span class="badge badge-' + diffCls + '">' + (q.difficulty || 'Medium') + '</span>';
  if (q.topic) meta += '<span class="badge badge-topic">' + q.topic + '</span>';
  document.getElementById('q-meta').innerHTML = meta;

  // Reset confidence
  document.querySelectorAll('.conf-btn').forEach(function(b) { b.classList.remove('active'); });

  // Question text
  document.getElementById('q-text').textContent = q.question;

  // Options
  var keys    = ['A','B','C','D'];
  var optsEl  = document.getElementById('opts');
  optsEl.innerHTML = '';
  q.options.forEach(function(opt, i) {
    var btn = document.createElement('button');
    btn.className = 'opt';
    btn.id = 'opt-' + i;
    btn.innerHTML = '<span class="opt-key">' + keys[i] + '</span><span>' + escapeHTML(opt) + '</span>';
    btn.addEventListener('click', function() { pickAnswer(i); });
    optsEl.appendChild(btn);
  });

  // Hide explanation + next button
  document.getElementById('expl').classList.remove('show');
  var nextBtn = document.getElementById('btn-next');
  nextBtn.classList.remove('show');
  nextBtn.textContent = current < questions.length - 1 ? 'Next \u2192' : 'See results \u2192';

  qStart = Date.now();

  // Timer
  var pill = document.getElementById('timer-pill');
  if (timerOn) { pill.style.display = 'inline-block'; startTimer(); }
  else          { pill.style.display = 'none'; clearInterval(timerInterval); }
}

function startTimer() {
  clearInterval(timerInterval);
  timerLeft = timerSecs;
  var pill  = document.getElementById('timer-pill');
  pill.className = 'timer-pill';
  pill.textContent = timerLeft + 's';

  timerInterval = setInterval(function() {
    timerLeft--;
    pill.textContent = timerLeft + 's';
    if (timerLeft <= 10)      pill.className = 'timer-pill danger';
    else if (timerLeft <= 20) pill.className = 'timer-pill warn';
    if (timerLeft <= 0) {
      clearInterval(timerInterval);
      if (answers[current] === null) {
        timeTaken[current] = timerSecs;
        answers[current]   = -1;
        revealAnswer(-1);
      }
    }
  }, 1000);
}

function setConfidence(val) {
  confidences[current] = val;
  document.querySelectorAll('.conf-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.conf === val);
  });
}

function pickAnswer(idx) {
  if (answers[current] !== null) return;
  clearInterval(timerInterval);
  timeTaken[current] = Math.round((Date.now() - qStart) / 1000);
  answers[current]   = idx;
  revealAnswer(idx);
}

function revealAnswer(selected) {
  var q = questions[current];
  document.querySelectorAll('.opt').forEach(function(btn, i) {
    btn.disabled = true;
    if (i === q.correctAnswer) btn.classList.add('correct');
    else if (i === selected)   btn.classList.add('wrong');
  });
  if (q.explanation) {
    document.getElementById('expl-text').textContent = q.explanation;
    document.getElementById('expl').classList.add('show');
  }
  document.getElementById('btn-next').classList.add('show');
}

function nextQuestion() {
  current++;
  if (current >= questions.length) showResults();
  else renderQuestion();
}

// ── Results ────────────────────────────────────────────────────────────────
function showResults() {
  show('results');
  var total   = questions.length;
  var correct = answers.filter(function(a, i) { return a === questions[i].correctAnswer; }).length;
  var pct     = Math.round((correct / total) * 100);

  // Score ring
  var ring  = document.getElementById('score-ring');
  var color = pct >= 70 ? '#4ADE80' : pct >= 50 ? '#F59E0B' : '#FF6B6B';
  ring.textContent   = pct + '%';
  ring.style.borderColor = color;
  ring.style.color       = color;

  document.getElementById('res-headline').textContent =
    pct >= 90 ? 'Outstanding! \uD83D\uDD25' :
    pct >= 70 ? 'Well done! \uD83D\uDC4D'   :
    pct >= 50 ? 'Good effort!'               : 'Keep studying!';
  document.getElementById('res-sub').textContent = correct + ' of ' + total + ' correct';

  document.getElementById('st-correct').textContent = correct;
  document.getElementById('st-wrong').textContent   = total - correct;
  var avgT = Math.round(timeTaken.reduce(function(a,b){return a+b;},0) / timeTaken.length);
  document.getElementById('st-time').textContent    = timerOn ? avgT + 's' : '--';

  // Lucky guesses
  var lucky = answers.filter(function(a,i){
    return a === questions[i].correctAnswer && confidences[i] === 'guess';
  }).length;
  document.getElementById('lucky-box').innerHTML = lucky > 0
    ? '<span class="lucky-pill">\u26A0 ' + lucky + ' lucky guess' + (lucky>1?'es':'') + ' \u2014 review these</span>'
    : '';

  // Difficulty breakdown
  var diffs = {};
  questions.forEach(function(q,i){
    var d = q.difficulty || 'Medium';
    if (!diffs[d]) diffs[d] = {c:0,t:0};
    diffs[d].t++;
    if (answers[i] === q.correctAnswer) diffs[d].c++;
  });
  var diffColors = {Easy:'#4ADE80', Medium:'#F59E0B', Hard:'#FF6B6B'};
  document.getElementById('diff-breakdown').innerHTML = ['Easy','Medium','Hard']
    .filter(function(d){ return diffs[d] && diffs[d].t > 0; })
    .map(function(d){
      var v = diffs[d], p = Math.round((v.c/v.t)*100);
      return '<div class="diff-row">' +
        '<span class="badge badge-' + d.toLowerCase() + '" style="min-width:54px;text-align:center">' + d + '</span>' +
        '<div class="diff-bar"><div class="diff-bar-fill" style="width:' + p + '%;background:' + diffColors[d] + '"></div></div>' +
        '<span class="diff-score">' + v.c + '/' + v.t + '</span></div>';
    }).join('');

  // Topic breakdown
  var topics = {};
  questions.forEach(function(q,i){
    var t = q.topic || 'General';
    if (!topics[t]) topics[t] = {c:0,t:0};
    topics[t].t++;
    if (answers[i] === q.correctAnswer) topics[t].c++;
  });
  document.getElementById('topic-breakdown').innerHTML = Object.keys(topics).map(function(t){
    var v = topics[t], p = Math.round((v.c/v.t)*100);
    var cls = p < 50 ? 'weak' : p < 75 ? 'ok' : 'good';
    return '<div class="topic-row"><span class="t-name">' + escapeHTML(t) + '</span>' +
      '<span class="t-score ' + cls + '">' + p + '%</span></div>';
  }).join('');

  // Weakest topic alert
  var entries  = Object.keys(topics).map(function(t){ return {t:t, p: Math.round((topics[t].c/topics[t].t)*100)}; });
  var weakList = entries.filter(function(e){ return e.p < 50; });
  if (weakList.length) {
    weakList.sort(function(a,b){ return a.p - b.p; });
    document.getElementById('weak-banner').innerHTML =
      '<div class="weak-banner"><strong>\u26A0 Focus Area Detected</strong>' +
      'Your weakest topic is <strong>' + escapeHTML(weakList[0].t) + '</strong> \u2014 revise this before your next session.</div>';
  } else {
    document.getElementById('weak-banner').innerHTML = '';
  }

  // Progress history
  saveHistory(pct);
  chrome.storage.local.get('quizHistory', function(r){
    var hist   = r.quizHistory || [];
    var histEl = document.getElementById('history-list');
    if (hist.length <= 1) {
      histEl.innerHTML = '<p style="font-size:12px;color:var(--text3);padding:4px 0">Complete more quizzes to see your trend.</p>';
    } else {
      histEl.innerHTML = hist.slice(-5).reverse().map(function(h, idx){
        var c = h.score >= 70 ? '#4ADE80' : h.score >= 50 ? '#F59E0B' : '#FF6B6B';
        return '<div class="history-row">' +
          '<div class="history-dot" style="background:' + c + '"></div>' +
          '<span class="history-label">' + h.date + (idx===0?' (today)':'') + '</span>' +
          '<span class="history-score">' + h.score + '%</span></div>';
      }).join('');
    }
  });

  // Wrong answer review
  var wrong  = questions.map(function(q,i){ return {q:q,i:i}; })
                        .filter(function(x){ return answers[x.i] !== x.q.correctAnswer; });
  var rvEl   = document.getElementById('review-list');
  if (!wrong.length) {
    rvEl.innerHTML = '<p style="font-size:12px;color:var(--text3);padding:4px 0">All correct \u2014 nothing to review!</p>';
  } else {
    rvEl.innerHTML = wrong.map(function(x){
      var q    = x.q;
      var your = answers[x.i] >= 0 ? escapeHTML(q.options[answers[x.i]]) : 'Timed out';
      var corr = escapeHTML(q.options[q.correctAnswer]);
      return '<div class="review-card">' +
        '<div class="rv-q">' + escapeHTML(q.question) + '</div>' +
        '<div class="rv-pills">' +
          '<span class="rv-pill rv-wrong">\u2717 ' + your + '</span>' +
          '<span class="rv-pill rv-correct">\u2713 ' + corr + '</span>' +
        '</div>' +
        (q.explanation ? '<div class="rv-exp">' + escapeHTML(q.explanation) + '</div>' : '') +
        '</div>';
    }).join('');
  }
}

function saveHistory(score) {
  chrome.storage.local.get('quizHistory', function(r){
    var hist = r.quizHistory || [];
    hist.push({
      score: score,
      date: new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short'}),
      ts: Date.now()
    });
    chrome.storage.local.set({ quizHistory: hist.slice(-20) });
  });
}

// ── PDF Export ─────────────────────────────────────────────────────────────
function exportPDF() {
  if (!window.jspdf) { alert('PDF library not ready, try again.'); return; }
  var doc    = new window.jspdf.jsPDF();
  var total  = questions.length;
  var correct = answers.filter(function(a,i){ return a === questions[i].correctAnswer; }).length;
  var pct    = Math.round((correct/total)*100);

  doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text('Quiz Results Report', 20, 22);
  doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(100);
  doc.text('Score: ' + correct + '/' + total + ' (' + pct + '%)    Date: ' + new Date().toLocaleDateString(), 20, 32);
  doc.setTextColor(0); doc.setDrawColor(200); doc.line(20, 37, 190, 37);

  var y = 46;
  questions.forEach(function(q, i) {
    if (y > 255) { doc.addPage(); y = 20; }
    var ok = answers[i] === q.correctAnswer;

    doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(80);
    doc.text('Q' + (i+1) + '  [' + (q.difficulty||'Medium') + ']  ' + strip(q.topic||''), 20, y); y += 5;

    doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(0);
    var qLines = doc.splitTextToSize(strip(q.question||''), 170);
    doc.text(qLines, 20, y); y += qLines.length * 5 + 2;

    if (ok) {
      doc.setTextColor(34,139,34);
      doc.text('CORRECT: ' + strip(q.options[q.correctAnswer]||''), 22, y);
    } else {
      doc.setTextColor(180,0,0);
      var ya = answers[i] >= 0 ? strip(q.options[answers[i]]||'') : 'Timed out';
      doc.text('YOUR ANSWER: ' + ya, 22, y); y += 5;
      doc.setTextColor(34,139,34);
      doc.text('CORRECT:     ' + strip(q.options[q.correctAnswer]||''), 22, y);
    }
    doc.setTextColor(0); y += 5;

    if (q.explanation && !ok) {
      doc.setFontSize(9); doc.setTextColor(100);
      var eLines = doc.splitTextToSize(strip(q.explanation||''), 165);
      doc.text(eLines, 24, y); y += eLines.length * 4;
      doc.setTextColor(0);
    }
    y += 6;
    if (y < 270) { doc.setDrawColor(230); doc.line(20, y, 190, y); }
    y += 5;
  });
  doc.save('quiz-results.pdf');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function strip(str) { return (str||'').replace(/[^\x00-\x7F]/g, '').trim(); }
function escapeHTML(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  // Quiz screen
  document.getElementById('btn-next').addEventListener('click', nextQuestion);
  document.querySelectorAll('.conf-btn').forEach(function(b) {
    b.addEventListener('click', function() { setConfidence(b.dataset.conf); });
  });

  // Config screen
  document.getElementById('btn-start-quiz').addEventListener('click', launchQuiz);

  // Timer toggle in config screen
  document.getElementById('cfg-timer-toggle').addEventListener('click', function() {
    var tog = document.getElementById('cfg-timer-toggle');
    var lbl = document.getElementById('cfg-timer-label');
    var sel = document.getElementById('cfg-timer-secs');
    var isOn = tog.classList.toggle('on');
    lbl.textContent = isOn ? 'On' : 'Off';
    sel.style.display = isOn ? 'inline-block' : 'none';
  });

  // Results screen
  document.getElementById('btn-retake').addEventListener('click', function() { buildConfigScreen(); show('config'); });
  document.getElementById('btn-new').addEventListener('click',    function() { show('waiting'); });
  document.getElementById('btn-pdf').addEventListener('click',    exportPDF);

  show('waiting');
  startPolling();
});
