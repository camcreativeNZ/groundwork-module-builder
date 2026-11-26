/* Groundwork module player. Shared by every module: navigation, progress, interactions,
   marking and SCORM 2004 tracking. Module content lives in index.html, not here. */
(function () {
  'use strict';

  var screens = Array.prototype.slice.call(document.querySelectorAll('.screen'));
  var total = screens.length;
  var current = 0;
  var quizDone = false;
  var moduleName = document.body.dataset.module || document.title;
  var quiz = document.getElementById('quiz');
  var PASS = quiz ? parseInt(quiz.dataset.pass, 10) : 0;
  var QUESTIONS = quiz ? quiz.querySelectorAll('.q').length : 0;
  var bestScore = 0;
  var passed = false;

  /* ---------- SCORM start ---------- */
  SCORM.init();
  if (SCORM.connected) {
    var loc = parseInt(SCORM.get('cmi.location'), 10);
    if (!isNaN(loc) && loc >= 0 && loc < total) current = loc;
    var status = SCORM.get('cmi.completion_status');
    if (status === 'unknown' || status === 'not attempted' || status === '') {
      SCORM.set('cmi.completion_status', 'incomplete');
    }
    if (quiz) {
      SCORM.set('cmi.score.min', 0);
      SCORM.set('cmi.score.max', QUESTIONS);
      passed = SCORM.get('cmi.success_status') === 'passed';
      bestScore = parseInt(SCORM.get('cmi.score.raw'), 10) || 0;
    } else {
      passed = status === 'completed';
    }
    SCORM.commit();
  }

  /* ---------- Navigation ---------- */
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var counter = document.getElementById('counter');
  var progress = document.getElementById('progress');
  var fill = document.getElementById('progressFill');

  function show(i, focus) {
    screens.forEach(function (s, n) { s.hidden = n !== i; });
    current = i;
    counter.textContent = 'Screen ' + (i + 1) + ' of ' + total + ': ' + screens[i].dataset.title;
    progress.setAttribute('aria-valuenow', i + 1);
    fill.style.width = ((i + 1) / total * 100) + '%';
    prevBtn.disabled = i === 0;
    nextBtn.hidden = i === total - 1;
    document.title = screens[i].dataset.title + ' · ' + moduleName;
    if (focus) {
      var h = screens[i].querySelector('h2');
      h.setAttribute('tabindex', '-1');
      h.focus();
      window.scrollTo(0, 0);
    }
    if (SCORM.connected) { SCORM.set('cmi.location', i); SCORM.commit(); }
    if (!quiz && i === total - 1 && !passed) {
      passed = true;
      if (SCORM.connected) { SCORM.set('cmi.completion_status', 'completed'); SCORM.commit(); }
    }
    if (screens[i].querySelector('.finish')) updateFinish();
  }

  prevBtn.addEventListener('click', function () { if (current > 0) show(current - 1, true); });
  nextBtn.addEventListener('click', function () { if (current < total - 1) show(current + 1, true); });

  /* ---------- Reveal buttons ---------- */
  document.querySelectorAll('[data-reveal]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var panel = document.getElementById(btn.dataset.reveal);
      var open = panel.hidden;
      panel.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? (btn.dataset.hideLabel || 'Hide the answer') : (btn.dataset.showLabel || 'Show the answer');
    });
  });

  /* ---------- Flip cards ---------- */
  document.querySelectorAll('.flip').forEach(function (card) {
    card.addEventListener('click', function () {
      var on = card.getAttribute('aria-pressed') === 'true';
      card.setAttribute('aria-pressed', String(!on));
    });
  });

  /* ---------- Try it ---------- */
  document.querySelectorAll('.screen').forEach(function (screen) {
    var fields = Array.prototype.slice.call(screen.querySelectorAll('textarea[data-try]'));
    if (!fields.length) return;
    var joined = screen.querySelector('.joined-prompt');
    var copyStatus = screen.querySelector('.copy-status');
    function text() { return fields.map(function (f) { return f.value.trim(); }).filter(Boolean).join('\n\n'); }
    function update() {
      var t = text();
      joined.textContent = t || joined.dataset.empty;
      joined.classList.toggle('empty', !t);
    }
    fields.forEach(function (f) { f.addEventListener('input', update); });
    update();
    screen.querySelector('.copy-btn').addEventListener('click', function () {
      var t = text();
      if (!t) { copyStatus.textContent = 'Type your prompt first.'; return; }
      function done() { copyStatus.textContent = 'Copied. Paste it into Claude.'; }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { copyStatus.textContent = 'Copy didn\'t work. Select the text and copy it yourself.'; }
        document.body.removeChild(ta);
      }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(t).then(done, fallback);
      } else { fallback(); }
    });
  });

  /* ---------- Matching questions ---------- */
  var allMatchButtons = [];
  var matchSets = Array.prototype.slice.call(document.querySelectorAll('.q.match')).map(function (fs) {
    var chips = Array.prototype.slice.call(fs.querySelectorAll('.chip'));
    var slots = Array.prototype.slice.call(fs.querySelectorAll('.slot'));
    var statusEl = fs.querySelector('.match-status');
    var emptyLabel = slots.length ? slots[0].querySelector('.slot-label').textContent : 'Choose';
    var selected = null;
    allMatchButtons = allMatchButtons.concat(chips, slots);

    function selectChip(chip) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      selected = chip;
      if (chip) {
        chip.setAttribute('aria-pressed', 'true');
        statusEl.textContent = chip.dataset.part + ' selected. Now choose a line.';
      }
    }
    function clearSlot(s) {
      delete s.dataset.value;
      s.querySelector('.slot-label').textContent = emptyLabel;
      s.classList.remove('filled');
      s.removeAttribute('aria-label');
    }
    function place(slot, part) {
      slots.forEach(function (s) { if (s !== slot && s.dataset.value === part) clearSlot(s); });
      slot.dataset.value = part;
      slot.querySelector('.slot-label').textContent = part;
      slot.classList.add('filled');
      slot.setAttribute('aria-label', part + ' placed. Select to change.');
      statusEl.textContent = part + ' placed.';
      selectChip(null);
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { if (!quizDone) selectChip(selected === chip ? null : chip); });
      chip.addEventListener('dragstart', function (e) {
        if (quizDone) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', chip.dataset.part);
      });
    });
    slots.forEach(function (slot) {
      slot.addEventListener('click', function () {
        if (quizDone) return;
        if (selected) place(slot, selected.dataset.part);
        else if (slot.dataset.value) { clearSlot(slot); statusEl.textContent = 'Cleared. Select a part to place.'; }
        else statusEl.textContent = 'Select a part first, then choose this line.';
      });
      slot.addEventListener('dragover', function (e) { if (!quizDone) { e.preventDefault(); slot.classList.add('over'); } });
      slot.addEventListener('dragleave', function () { slot.classList.remove('over'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault(); slot.classList.remove('over');
        var part = e.dataTransfer.getData('text/plain');
        if (part && !quizDone) place(slot, part);
      });
    });
    return {
      el: fs,
      answered: function () { return slots.every(function (s) { return !!s.dataset.value; }); },
      correct: function () { return slots.every(function (s) { return s.dataset.value === s.dataset.correct; }); },
      reset: function () { slots.forEach(clearSlot); selectChip(null); statusEl.textContent = ''; }
    };
  });
  function matchFor(fs) { for (var i = 0; i < matchSets.length; i++) if (matchSets[i].el === fs) return matchSets[i]; return null; }

  /* ---------- Marking ---------- */
  if (quiz) {
    var result = document.getElementById('result');
    var retry = document.getElementById('retryQuiz');
    var submit = document.getElementById('submitQuiz');

    quiz.addEventListener('submit', function (e) {
      e.preventDefault();
      var score = 0, unanswered = 0;
      var fieldsets = Array.prototype.slice.call(quiz.querySelectorAll('.q'));
      fieldsets.forEach(function (fs) {
        var m = matchFor(fs), correct;
        if (m) {
          if (!m.answered()) unanswered++;
          correct = m.correct();
        } else {
          var picked = fs.querySelector('input:checked');
          if (!picked) unanswered++;
          correct = !!picked && picked.value === fs.dataset.answer;
        }
        fs._correct = correct;
      });

      if (unanswered) {
        result.className = 'result warn';
        result.textContent = 'Please answer all ' + quiz.dataset.totalWords + ' questions first. ' + unanswered + (unanswered === 1 ? ' is' : ' are') + ' still blank.';
        result.focus();
        return;
      }

      fieldsets.forEach(function (fs) {
        var fb = fs.querySelector('.feedback');
        fb.hidden = false;
        fb.className = 'feedback ' + (fs._correct ? 'right' : 'wrong');
        fb.innerHTML = '<strong>' + (fs._correct ? 'Correct.' : 'Not quite.') + '</strong> ' + fb.dataset.fb;
        fs.querySelectorAll('input').forEach(function (inp) { inp.disabled = true; });
        if (fs._correct) score++;
      });

      quizDone = true;
      allMatchButtons.forEach(function (b) { b.disabled = true; });
      submit.hidden = true;

      bestScore = Math.max(bestScore, score);
      var thisPass = score >= PASS;
      passed = passed || thisPass;

      result.className = 'result ' + (thisPass ? 'pass' : 'fail');
      result.innerHTML = '<strong>You scored ' + score + ' out of ' + QUESTIONS + '.</strong> ' + (thisPass ? quiz.dataset.passMsg : quiz.dataset.failMsg);
      retry.hidden = thisPass;
      result.focus();

      if (SCORM.connected) {
        SCORM.set('cmi.score.raw', bestScore);
        SCORM.set('cmi.score.scaled', (bestScore / QUESTIONS).toFixed(2));
        SCORM.set('cmi.success_status', passed ? 'passed' : 'failed');
        SCORM.set('cmi.completion_status', 'completed');
        SCORM.commit();
      }
    });

    retry.addEventListener('click', function () {
      quizDone = false;
      quiz.reset();
      quiz.querySelectorAll('input').forEach(function (inp) { inp.disabled = false; });
      quiz.querySelectorAll('.feedback').forEach(function (fb) { fb.hidden = true; });
      allMatchButtons.forEach(function (b) { b.disabled = false; });
      matchSets.forEach(function (m) { m.reset(); });
      result.textContent = ''; result.className = 'result';
      submit.hidden = false; retry.hidden = true;
      quiz.querySelector('legend').scrollIntoView();
      quiz.querySelector('input, .chip').focus();
    });
  }

  /* ---------- Finish message ---------- */
  function updateFinish() {
    var note = document.querySelector('.finish');
    if (!note) return;
    if (passed) { note.className = 'finish done'; note.textContent = note.dataset.done; }
    else { note.className = 'finish todo'; note.textContent = note.dataset.todo; }
  }

  /* ---------- Exit ---------- */
  window.addEventListener('pagehide', function () {
    if (!SCORM.connected) return;
    SCORM.set('cmi.exit', passed ? 'normal' : 'suspend');
    SCORM.finish();
  });

  show(current, false);
})();
