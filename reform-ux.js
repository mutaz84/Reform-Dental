/* =====================================================================
   ReformDental UX layer: behaviour (reform-ux.js)
   - Esc closes the top form or dialog (asks first if you changed anything)
   - Save / Cancel rows on long forms stay pinned to the bottom
   - Count badges that read 0 are hidden; overdue counts turn red
   - Inline text smaller than 12px is raised to 12px
   - Reset Data moves from the gear menu into Settings, with a typed
     "RESET" confirmation before anything is deleted
   No data is read or written here; it only changes presentation.
   ===================================================================== */
(function () {
  'use strict';
  if (window.__rdUxLoaded) return;
  window.__rdUxLoaded = true;

  var OVERLAY_SEL = '[id$="Modal"], .modal-overlay, .cc-modal-overlay, .procedure-modal-overlay, .modal';
  var CLOSE_SEL = '.close-btn, .modal-close, .procedure-modal-close, .svc-form-header-close, [aria-label="Close"], [aria-label="close"], [data-dismiss="modal"]';
  var PRIMARY_TEXT = /^(save|save changes|add|update|create|submit|confirm|apply|done)\b/i;
  var CANCEL_TEXT = /^(cancel|close|discard)\b/i;

  function visible(el) {
    if (!el || !el.isConnected) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  /* ---------- Esc closes the top dialog / form ---------- */
  function topOverlay() {
    var list = Array.prototype.filter.call(document.querySelectorAll(OVERLAY_SEL), function (el) {
      var cs = getComputedStyle(el);
      return (cs.position === 'fixed' || cs.position === 'absolute') && visible(el);
    });
    if (!list.length) return null;
    list.sort(function (a, b) {
      var za = parseInt(getComputedStyle(a).zIndex, 10) || 0, zb = parseInt(getComputedStyle(b).zIndex, 10) || 0;
      if (za !== zb) return za - zb;
      return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
    });
    return list[list.length - 1];
  }
  function findCloser(scope) {
    var explicit = Array.prototype.find.call(scope.querySelectorAll(CLOSE_SEL), visible);
    if (explicit) return explicit;
    var buttons = Array.prototype.filter.call(scope.querySelectorAll('button, [role="button"], span[onclick], a[onclick]'), visible);
    return buttons.find(function (b) { return /^[×✕✖x]$/i.test(text(b)); }) ||
           buttons.find(function (b) { return CANCEL_TEXT.test(text(b)); }) ||
           buttons.find(function (b) { return /(close|cancel|hide)\w*\s*\(/i.test(b.getAttribute('onclick') || ''); }) || null;
  }
  function confirmDiscard(scope) {
    if (!scope || scope.dataset.rdDirty !== '1') return true;
    return window.confirm('You have unsaved changes. Close without saving?');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing) return;
    var target = e.target;
    // Let open native pickers / dropdown menus handle Esc first
    if (target && target.tagName === 'SELECT') return;
    var scope = topOverlay();
    if (!scope) {
      // Docked forms (management pages): Esc acts like the form's Cancel button
      var form = target && target.closest ? target.closest('form') : null;
      if (form) scope = form;
    }
    if (!scope) {
      // Management screens opened as their own page (e.g. Reset Data, Master Settings)
      var page = document.querySelector('.content-view.active.rd-management-view, .content-view.active[id^="view-manage-"]');
      if (page) scope = page;
    }
    if (!scope) return;
    var closer = findCloser(scope);
    if (!closer) return;
    if (!confirmDiscard(scope)) { e.preventDefault(); return; }
    e.preventDefault();
    scope.dataset.rdDirty = '';
    closer.click();
  }, true);

  // Track real edits (programmatic pre-filling doesn't fire these events)
  function markDirty(e) {
    var el = e.target;
    if (!el || !el.closest) return;
    if (el.matches('input[type="search"]')) return;
    var scope = el.closest(OVERLAY_SEL) || el.closest('form');
    if (scope) scope.dataset.rdDirty = '1';
  }
  document.addEventListener('input', markDirty, true);
  document.addEventListener('change', markDirty, true);
  // Saving, cancelling or closing clears the flag
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button, [role="button"], a[onclick], span[onclick]') : null;
    if (!b) return;
    var t = text(b);
    if (b.type === 'submit' || PRIMARY_TEXT.test(t) || CANCEL_TEXT.test(t) || /^[×✕✖x]$/i.test(t) || b.matches(CLOSE_SEL)) {
      setTimeout(function () {
        var scope = b.closest(OVERLAY_SEL) || b.closest('form');
        if (scope) scope.dataset.rdDirty = '';
      }, 0);
    }
  }, true);

  /* ---------- Pinned Save / Cancel row on long forms ---------- */
  function pinActions(root) {
    var forms = (root || document).querySelectorAll('form');
    Array.prototype.forEach.call(forms, function (form) {
      if (form.dataset.rdPinned) return;
      var buttons = Array.prototype.filter.call(form.querySelectorAll('button'), function (b) {
        return b.type === 'submit' || PRIMARY_TEXT.test(text(b));
      });
      var primary = buttons[buttons.length - 1];
      if (!primary) return;
      var row = primary.parentElement;
      // The row must hold the form's actions (a primary + at least one other button), and sit at the end of the form
      if (!row || row === form || row.querySelectorAll('button').length < 2) return;
      if (row.querySelector('input, select, textarea')) return;
      form.dataset.rdPinned = '1';
      row.classList.add('rd-sticky-actions');
    });
  }

  /* ---------- Badges: hide zero, red for overdue ---------- */
  var BADGE_SEL = '.nav-badge, .rd-ops-count-pill, .tab-badge, .badge-count, .count-badge, .notification-badge, .menu-badge, .sidebar-badge';
  function tidyBadges(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll(BADGE_SEL), function (b) {
      var t = text(b);
      b.classList.toggle('rd-zero', t === '0' || t === '');
      var head = b.closest('.rd-ops-section-head, .nav-item, .tab, [class*="tab"]');
      b.classList.toggle('rd-alert', !!head && /overdue/i.test(text(head)) && t !== '0');
    });
  }

  /* ---------- 12px floor for inline font sizes ---------- */
  var SMALL_PX = /font-size\s*:\s*(\d*\.?\d+)(px|rem)/i;
  function floorInline(root) {
    var nodes = (root && root.nodeType === 1 && root.hasAttribute && root.hasAttribute('style')) ? [root] : [];
    if (root && root.querySelectorAll) Array.prototype.push.apply(nodes, root.querySelectorAll('[style*="font-size"]'));
    nodes.forEach(function (el) {
      var m = SMALL_PX.exec(el.getAttribute('style') || '');
      if (!m) return;
      var v = parseFloat(m[1]); var unit = m[2].toLowerCase();
      var px = unit === 'rem' ? v * 16 : v;
      if (px >= 5 && px < 12) el.style.setProperty('font-size', '12px');
    });
  }

  /* ---------- Palette: map hard-coded inline colours onto the system ----------
     Only exact matches are changed; calendars, event blocks, colour pickers and
     charts are skipped because their colours carry meaning. */
  var TEXT_MAP = {
    'rgb(239, 68, 68)': '#B42318', 'rgb(220, 38, 38)': '#B42318', 'rgb(185, 28, 28)': '#B42318',
    'rgb(16, 185, 129)': '#067647', 'rgb(5, 150, 105)': '#067647', 'rgb(22, 163, 74)': '#067647', 'rgb(34, 197, 94)': '#067647', 'rgb(22, 101, 52)': '#067647',
    'rgb(245, 158, 11)': '#B54708', 'rgb(217, 119, 6)': '#B54708', 'rgb(146, 64, 14)': '#93370D', 'rgb(180, 83, 9)': '#B54708',
    'rgb(59, 130, 246)': '#0F5E75', 'rgb(37, 99, 235)': '#0F5E75', 'rgb(29, 78, 216)': '#0F5E75', 'rgb(2, 132, 199)': '#0F5E75', 'rgb(14, 165, 233)': '#0F5E75', 'rgb(8, 145, 178)': '#0F5E75', 'rgb(6, 182, 212)': '#0F5E75', 'rgb(0, 88, 190)': '#0F5E75',
    'rgb(107, 114, 128)': '#475569', 'rgb(100, 116, 139)': '#475569', 'rgb(156, 163, 175)': '#64748B', 'rgb(17, 24, 39)': '#0F172A', 'rgb(55, 65, 81)': '#334155', 'rgb(31, 41, 55)': '#0F172A'
  };
  var BG_MAP = {
    'rgb(239, 68, 68)': '#D92D20', 'rgb(220, 38, 38)': '#D92D20', 'rgb(254, 226, 226)': '#FEF3F2', 'rgb(254, 242, 242)': '#FEF3F2',
    'rgb(16, 185, 129)': '#067647', 'rgb(5, 150, 105)': '#067647', 'rgb(34, 197, 94)': '#067647', 'rgb(209, 250, 229)': '#ECFDF3', 'rgb(220, 252, 231)': '#ECFDF3', 'rgb(236, 253, 245)': '#ECFDF3', 'rgb(240, 253, 244)': '#ECFDF3',
    'rgb(245, 158, 11)': '#DC6803', 'rgb(217, 119, 6)': '#DC6803', 'rgb(254, 243, 199)': '#FFFAEB', 'rgb(255, 251, 235)': '#FFFAEB', 'rgba(245, 158, 11, 0.14)': '#E7F1F4', 'rgba(245, 158, 11, 0.12)': '#E7F1F4', 'rgba(245, 158, 11, 0.15)': '#E7F1F4',
    'rgb(59, 130, 246)': '#0F5E75', 'rgb(37, 99, 235)': '#0F5E75', 'rgb(2, 132, 199)': '#0F5E75', 'rgb(14, 165, 233)': '#0F5E75', 'rgb(6, 182, 212)': '#0F5E75', 'rgb(8, 145, 178)': '#0F5E75', 'rgb(0, 88, 190)': '#0F5E75',
    'rgb(239, 246, 255)': '#E7F1F4', 'rgb(219, 234, 254)': '#E7F1F4', 'rgb(224, 242, 254)': '#E7F1F4', 'rgb(236, 254, 255)': '#E7F1F4', 'rgb(207, 250, 254)': '#E7F1F4', 'rgba(59, 130, 246, 0.1)': '#E7F1F4', 'rgba(59, 130, 246, 0.12)': '#E7F1F4',
    'rgb(243, 244, 246)': '#F1F5F9', 'rgb(249, 250, 251)': '#F8FAFC'
  };
  var PRIMARY_ACTION = /^(save|add|create|upload|submit|update|confirm|apply|send|publish|generate|import)\b/i;
  var DANGER_BG = /^(rgb\(217, 45, 32\)|rgb\(239, 68, 68\)|rgb\(220, 38, 38\)|rgb\(185, 28, 28\)|#D92D20)$/i;
  // Orange "category" icon tiles are decoration, not a warning: show them in the brand tint
  var TILE_ICON_TEXT = { 'rgb(217, 119, 6)': '#0F5E75', 'rgb(245, 158, 11)': '#0F5E75' };
  var SKIP_PALETTE = '.fc, #calendarSection, .rd-calendar-time-grid, [class*="calendar-event"], [class*="fc-"], [class*="swatch"], [class*="color-pick"], [class*="colorPick"], .bi-pro-pane-report, svg, canvas, [data-color], [data-rd-keep-colors]';
  function normalizePalette(root) {
    var nodes = [];
    if (root && root.nodeType === 1 && root.hasAttribute('style')) nodes.push(root);
    if (root && root.querySelectorAll) Array.prototype.push.apply(nodes, root.querySelectorAll('[style]'));
    nodes.forEach(function (el) {
      if (el.dataset.rdPal === el.getAttribute('style')) return;
      if (el.closest(SKIP_PALETTE)) { el.dataset.rdPal = el.getAttribute('style'); return; }
      var st = el.style;
      var bg = st.backgroundColor, c = st.color, bc = st.borderColor;
      var tile = bg && /^rgba\(245, 158, 11, 0\.1[245]\)$/.test(bg);
      if (bg && BG_MAP[bg]) st.backgroundColor = BG_MAP[bg];
      if (c && (tile ? TILE_ICON_TEXT[c] : TEXT_MAP[c])) st.color = tile ? TILE_ICON_TEXT[c] : TEXT_MAP[c];
      if (bc && TEXT_MAP[bc]) st.borderColor = TEXT_MAP[bc];
      // Faint decorative gradients (tints under 20% opacity) become the flat neutral surface
      var bi = st.backgroundImage || '';
      if (/linear-gradient/i.test(bi) && el.tagName !== 'BUTTON' || /linear-gradient/i.test(bi) && !PRIMARY_ACTION.test(text(el))) {
        var alphas = (bi.match(/rgba\([^)]*,\s*([\d.]+)\)/g) || []).map(function (s) { return parseFloat(s.replace(/.*,\s*([\d.]+)\)$/, '$1')); });
        var solid = /#[0-9a-f]{3,6}|rgb\(/i.test(bi.replace(/rgba\([^)]*\)/g, ''));
        if (alphas.length && !solid && alphas.every(function (a) { return a <= 0.2; })) {
          st.backgroundImage = 'none';
          st.backgroundColor = '#F8FAFC';
        }
      }
      // Coloured "do it" buttons (Save, Add, Create, Upload…) become the one teal primary
      if ((el.tagName === 'BUTTON' || el.classList.contains('btn')) && PRIMARY_ACTION.test(text(el)) && !/delete|remove/i.test(text(el))) {
        var hasGradient = /gradient/i.test(st.backgroundImage || '') || /gradient/i.test(el.getAttribute('style') || '');
        var bgNow = st.backgroundColor;
        var coloured = bgNow && !/^(rgb\(255, 255, 255\)|#fff|#ffffff|white|transparent|rgba\(0, 0, 0, 0\))$/i.test(bgNow) && !/^rgb\((2[0-9]{2}), \1, \1\)$/.test(bgNow) && !DANGER_BG.test(bgNow);
        if (hasGradient || coloured) {
          st.backgroundImage = 'none';
          st.backgroundColor = '#0F5E75';
          st.color = '#FFFFFF';
          st.borderColor = '#0F5E75';
        }
      }
      el.dataset.rdPal = el.getAttribute('style');
    });
  }

  /* ---------- Inputs with an icon drawn inside them: keep text clear of the icon ---------- */
  function padIconInputs(root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"])'), function (inp) {
      if (inp.dataset.rdIconPad) return;
      var parent = inp.parentElement; if (!parent) return;
      var icon = Array.prototype.find.call(parent.children, function (c) {
        return c !== inp && (c.tagName === 'I' || c.tagName === 'svg' || c.tagName === 'SPAN' && c.querySelector('i,svg')) && getComputedStyle(c).position === 'absolute';
      });
      if (!icon || !visible(inp) || !visible(icon)) return;
      var ir = icon.getBoundingClientRect(), nr = inp.getBoundingClientRect();
      if (ir.left - nr.left > 40 || ir.right <= nr.left) return;  // icon isn't on the left edge of this input
      inp.style.setProperty('padding-left', Math.round(ir.right - nr.left + 8) + 'px', 'important');
      inp.dataset.rdIconPad = '1';
    });
  }

  /* ---------- Reset Data: Settings danger zone + typed confirmation ---------- */
  function addDangerZone() {
    var view = document.getElementById('view-manage-master-settings');
    if (!view || view.querySelector('.rd-danger-zone')) return;
    if (!view.classList.contains('active') && !visible(view)) return;
    if (typeof window.openResetDataModal !== 'function') return;
    var host = view.querySelector('.rd-management-host, .management-host, form') || view;
    var zone = document.createElement('section');
    zone.className = 'rd-danger-zone';
    zone.innerHTML = '<h3>Danger zone</h3><p>Permanently delete clinics, rooms, users, schedules or other data. This can\'t be undone.</p>';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Reset data…';
    btn.addEventListener('click', function () { window.openResetDataModal(); });
    zone.appendChild(btn);
    host.appendChild(zone);
  }
  // The reset screen can open as a dialog or docked as its own page, so find its
  // "Reset Selected Data" button wherever it is.
  var resetWasVisible = false;
  function guardResetModal() {
    var confirmBtn = Array.prototype.find.call(document.querySelectorAll('button[onclick*="executeResetData"]'), visible);
    if (!confirmBtn) { resetWasVisible = false; return; }
    var row = confirmBtn.parentElement;
    var box = row.parentElement.querySelector('.rd-reset-confirm');
    if (!box) {
      box = document.createElement('div');
      box.className = 'rd-reset-confirm';
      box.innerHTML = '<label for="rdResetConfirmInput">Type <strong>RESET</strong> to confirm</label><input id="rdResetConfirmInput" type="text" autocomplete="off" spellcheck="false" placeholder="RESET">';
      row.parentElement.insertBefore(box, row);
      box.querySelector('input').addEventListener('input', function () { confirmBtn.disabled = this.value.trim() !== 'RESET'; });
    }
    var input = box.querySelector('input');
    if (!resetWasVisible) input.value = '';   // fresh every time the screen opens
    confirmBtn.disabled = input.value.trim() !== 'RESET';
    resetWasVisible = true;
  }
  // Belt and braces: the reset itself refuses to run without the typed confirmation
  function wrapReset() {
    if (typeof window.executeResetData !== 'function' || window.executeResetData.__rdGuarded) return;
    var original = window.executeResetData;
    var guarded = function () {
      var input = document.getElementById('rdResetConfirmInput');
      if (!input || input.value.trim() !== 'RESET') {
        if (input) { input.focus(); input.style.setProperty('border-color', '#D92D20', 'important'); }
        return;
      }
      return original.apply(this, arguments);
    };
    guarded.__rdGuarded = true;
    window.executeResetData = guarded;
  }

  /* ---------- Run on load and on DOM changes (batched) ---------- */
  var queued = false, pending = new Set(), full = true;
  function sweep() {
    queued = false;
    var roots = full ? [document.body] : Array.from(pending).filter(function (n) { return n.isConnected; });
    pending.clear(); full = false;
    roots.forEach(function (r) {
      try { floorInline(r); } catch (_) {}
      try { normalizePalette(r); } catch (_) {}
    });
    try { tidyBadges(); } catch (_) {}
    try { pinActions(); } catch (_) {}
    try { padIconInputs(); } catch (_) {}
    try { addDangerZone(); } catch (_) {}
    try { guardResetModal(); } catch (_) {}
    try { wrapReset(); } catch (_) {}
  }
  function queue() {
    if (queued) return;
    queued = true;
    (window.requestIdleCallback || function (fn) { return setTimeout(fn, 120); })(sweep, { timeout: 400 });
  }
  function onMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) { var n = r.addedNodes[j]; if (n.nodeType === 1) pending.add(n); }
      } else if (r.type === 'attributes' && r.target.nodeType === 1) {
        pending.add(r.target);
      }
      if (pending.size > 400) { full = true; pending.clear(); break; }
    }
    queue();
  }
  function start() {
    sweep();
    new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
