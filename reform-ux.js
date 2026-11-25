/* =====================================================================
   ReformDental UX layer: behaviour (reform-ux.js)
   - Esc closes the top form or dialog (asks first if you changed anything)
   - Save / Cancel rows on long forms stay pinned to the bottom
   - Count badges that read 0 are hidden; overdue counts turn red
   - Inline text smaller than 12px is raised to 12px
   - Reset Data moves from the gear menu into Settings, with a typed
     "RESET" confirmation before anything is deleted
   - Buttons are tagged text / icon so they share one size and colour set
   - Inventory add/edit panels share one header, close button and layout
   - The right panel's Quick Calendar opens as a full-size pop-over
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

  /* ---------- Buttons: tag every real button as a text button or an icon button ----------
     so one rule set gives them the same size, corners and colours everywhere.
     Cards, list headers, tabs, menus and the calendar are left alone. */
  var BTN_SKIP_CONTEXT = '.fc, .rd-calendar-time-grid, [class*="calendar-grid"], [role="menu"], .dropdown-menu, [class*="tools-menu"], .rd-view-tab, [class*="rd-view-tab"], #settingsMenu, [class*="context-menu"], .quick-calendar-dropdown, [id^="chatTab"], .copilot-header-actions, .copilot-send-btn, #viewEquipmentModal, #viewInstrumentModal, #viewSupplyModal, #viewUtilityModal, #teamPreviewModal, #vendorSubModal, #userPreviewModal, #rdDetails';
  var BTN_SKIP_CLASS = /(card|kpi|drilldown|chip|pill|badge|tile|menu-item|rd-view-tab|fc-|toggle-switch|status-toggle|warning-icon|floating|swatch|nav-item|rail-tab|tab-btn|svc-tab|svc-date-tab|calendar-corner|favorite)/i;
  var BTN_DELETE = /(delete|remove|trash)/i;
  var ALLOWED_BTN_BG = /^(rgb\(15, 94, 117\)|rgb\(11, 71, 89\)|rgb\(255, 255, 255\)|rgb\(241, 245, 249\)|rgb\(248, 250, 252\)|rgba\(0, 0, 0, 0\)|rgb\(231, 241, 244\)|rgb\(217, 45, 32\)|rgb\(180, 35, 24\)|rgb\(254, 243, 242\)|rgb\(254, 228, 226\))$/;
  function classifyButtons(root) {
    var list = (root && root.querySelectorAll) ? root.querySelectorAll('button, a.btn, input[type="button"], input[type="submit"]') : [];
    Array.prototype.forEach.call(list, function (b) {
      if (b.dataset.rdBtn) return;
      if (!visible(b)) return;                       // classify once it's on screen
      var cls = (b.className || '').toString();
      if (BTN_SKIP_CLASS.test(cls) || b.closest(BTN_SKIP_CONTEXT)) { b.dataset.rdBtn = 'skip'; return; }
      var r = b.getBoundingClientRect();
      if (r.height > 56 && r.width > 160) { b.dataset.rdBtn = 'skip'; return; }   // card-like rows
      if (r.width > 480) { b.dataset.rdBtn = 'skip'; return; }                    // full-width list rows
      if (b.parentElement && b.parentElement.matches('section[class*="drilldown"], :is(#equipmentSection, #instrumentsSection, #suppliesSection, #vendorsSection, #utilitiesSection, #teamsSection) > div')) { b.dataset.rdBtn = 'skip'; return; }  // category rows, summary tiles
      var label = (b.innerText || b.value || '').replace(/\s+/g, ' ').trim();
      var iconOnly = !label || /^[×✕✖+\-–…⋯]$/.test(label);
      b.classList.add(iconOnly ? 'rd-icon-btn' : 'rd-btn');
      if (/^[×✕✖]$/.test(label)) b.classList.add('rd-close-btn');
      if (b.closest('td, tr, li, .table-row, [class*="-row"]') || /btn-mini|btn-sm|cc-btn-sm/.test(cls)) b.classList.add('rd-compact');
      // a button stretched to fill a tall flex/grid row stays its own height
      var pd = b.parentElement ? getComputedStyle(b.parentElement).display : '';
      if (/flex|grid/.test(pd) && r.height > 46) b.classList.add('rd-nostretch');
      // colours outside the system: teal for do-it actions, red for delete, otherwise neutral
      var cs = getComputedStyle(b);
      var bg = cs.backgroundColor, grad = /gradient/.test(cs.backgroundImage);
      if (grad || !ALLOWED_BTN_BG.test(bg)) {
        var isDelete = BTN_DELETE.test(label) || BTN_DELETE.test(b.getAttribute('onclick') || '') || BTN_DELETE.test(b.getAttribute('title') || '') || !!b.querySelector('.fa-trash, .fa-trash-alt, .fa-trash-can');
        b.style.setProperty('background-image', 'none', 'important');
        if (iconOnly) {
          b.style.setProperty('background-color', '#FFFFFF', 'important');
          b.style.setProperty('border', '1px solid #E2E8F0', 'important');
          b.style.setProperty('color', isDelete ? '#B42318' : '#475569', 'important');
        } else if (isDelete) {
          b.style.setProperty('background-color', '#D92D20', 'important'); b.style.setProperty('color', '#FFFFFF', 'important'); b.style.setProperty('border', '1px solid #D92D20', 'important');
        } else if (PRIMARY_ACTION.test(label)) {
          b.style.setProperty('background-color', '#0F5E75', 'important'); b.style.setProperty('color', '#FFFFFF', 'important'); b.style.setProperty('border', '1px solid #0F5E75', 'important');
        } else {
          b.style.setProperty('background-color', '#FFFFFF', 'important'); b.style.setProperty('color', '#0F172A', 'important'); b.style.setProperty('border', '1px solid #CBD5E1', 'important');
        }
      }
      b.dataset.rdBtn = iconOnly ? 'icon' : 'text';
    });
  }

  /* ---------- Inventory forms: same header, close button and layout ----------
     Instruments and Supplies are the reference; Equipment, Vendors, Services and
     Assignments get the pieces they were missing. Text is only changed for the
     known panel titles below. */
  var TITLE_MAP = {
    'Instrument': 'Instruments', 'Instruments Management': 'Instruments',
    'Supply': 'Supplies', 'Supplies Management': 'Supplies',
    'Equipment Management': 'Equipment',
    'Vendor': 'Vendors', 'Vendors Management': 'Vendors',
    'Service': 'Services', 'Services Management': 'Services', 'Utilities Management': 'Services',
    'Add Assignment': 'Assignments', 'Edit Assignment': 'Assignments', 'Assignments Management': 'Assignments', 'Teams Management': 'Assignments'
  };
  function titleTextNode(h3) {
    var span = Array.prototype.find.call(h3.children, function (c) { return c.tagName === 'SPAN' && text(c); });
    if (span) return span;
    return Array.prototype.find.call(h3.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); }) || null;
  }
  function unifyModals() {
    Array.prototype.forEach.call(document.querySelectorAll('[id$="ManagementModal"]'), function (m) {
      if (!visible(m)) return;
      var hdr = m.querySelector('.login-header');
      if (!hdr) return;
      // One close button, top right, on every panel
      var close = Array.prototype.find.call(hdr.children, function (c) { return c.tagName === 'BUTTON'; });
      if (!close) {
        close = document.createElement('button');
        close.type = 'button';
        close.className = 'rd-modal-close';
        close.setAttribute('aria-label', 'Close');
        close.title = 'Close';
        close.textContent = '×';
        close.addEventListener('click', function (e) {
          e.preventDefault();
          if (!confirmDiscard(m)) return;
          m.dataset.rdDirty = '';
          var cancel = Array.prototype.find.call(m.querySelectorAll('button'), function (b) {
            return b !== close && visible(b) && CANCEL_TEXT.test(text(b));
          });
          if (cancel) cancel.click();
        });
        hdr.appendChild(close);
      }
      // Panel titles name the page ("Equipment"), the form heading says Add / Edit
      var h3 = hdr.querySelector('h3');
      var node = h3 && titleTextNode(h3);
      if (node) {
        var current = (node.nodeType === 3 ? node.nodeValue : node.textContent).trim();
        if (TITLE_MAP[current]) {
          h3.dataset.rdTitle = current;
          if (node.nodeType === 3) node.nodeValue = node.nodeValue.replace(current, TITLE_MAP[current]);
          else node.textContent = TITLE_MAP[current];
        }
      }
      if (m.id === 'teamsManagementModal') unifyTeamsForm(m, h3);
    });
  }
  function unifyTeamsForm(m, h3) {
    var section = m.querySelector('#teamsFormSection');
    if (!section) return;
    var heading = section.querySelector(':scope > .rd-form-title');
    if (!heading) {
      heading = document.createElement('h4');
      heading.className = 'rd-form-title';
      section.insertBefore(heading, section.firstChild);
    }
    var mode = /^edit/i.test((h3 && h3.dataset.rdTitle) || '') ? 'Edit Assignment' : 'Add New Assignment';
    if (heading.textContent !== mode) heading.textContent = mode;
    var save = m.querySelector('button[onclick^="saveTeam"]');
    var row = save && save.parentElement;
    if (row && row !== section && !row.classList.contains('rd-sticky-actions') && !row.querySelector('input, select, textarea')) {
      row.classList.add('rd-sticky-actions');
    }
  }
  // Vendors had no item count under the toolbar; show it like the other pages
  function vendorCount() {
    var meta = document.getElementById('vendorsResultsMeta');
    var list = document.getElementById('vendorsPageList');
    if (!meta || !list || !visible(list)) return;
    if (meta.dataset.rdCount === undefined && text(meta)) return;   // the app filled it itself
    var total = 0;
    Array.prototype.forEach.call(list.querySelectorAll('section[class*="drilldown"] > button > span:last-child > span:first-child'), function (s) {
      var n = parseInt(text(s), 10);
      if (!isNaN(n)) total += n;
    });
    var allTile = document.querySelector('#vendorsSummaryCards > button > div:nth-child(2)');
    var all = allTile ? parseInt(text(allTile), 10) : NaN;
    var label = (!isNaN(all) && all !== total ? total + ' of ' + all : String(total)) + (all === 1 || (isNaN(all) && total === 1) ? ' vendor' : ' vendors');
    if (meta.textContent !== label) { meta.textContent = label; meta.dataset.rdCount = '1'; }
  }

  /* ---------- Quick Calendar (right panel): open as a full-size pop-over ----------
     The panel is 210px wide and clips anything wider, which cut off the month name,
     TODAY and Saturday. Open, it is placed on screen above its button, right-aligned. */
  // Writes only when something actually changes: the page watches class and style
  // changes, so re-writing the same values here would wake that watcher again forever.
  function placeQuickCalendar() {
    Array.prototype.forEach.call(document.querySelectorAll('.urr-quick-calendar-host .quick-calendar-dropdown'), function (dd) {
      if (!dd.classList.contains('active')) {
        if (dd.dataset.rdQc) {
          delete dd.dataset.rdQc;
          if (dd.classList.contains('rd-qc-pop')) dd.classList.remove('rd-qc-pop');
          if (dd.style.getPropertyValue('right')) dd.style.removeProperty('right');
          if (dd.style.getPropertyValue('bottom')) dd.style.removeProperty('bottom');
        }
        return;
      }
      var btn = dd.parentElement && dd.parentElement.querySelector('[data-quick-calendar-toggle]');
      var r = btn && btn.getBoundingClientRect();
      if (!r || !r.width) return;
      var right = Math.max(8, Math.round(window.innerWidth - r.right)) + 'px';
      var bottom = Math.max(8, Math.round(window.innerHeight - r.top + 8)) + 'px';
      dd.dataset.rdQc = '1';
      if (!dd.classList.contains('rd-qc-pop')) dd.classList.add('rd-qc-pop');
      if (dd.style.getPropertyValue('right') !== right || dd.style.getPropertyPriority('right') !== 'important') dd.style.setProperty('right', right, 'important');
      if (dd.style.getPropertyValue('bottom') !== bottom || dd.style.getPropertyPriority('bottom') !== 'important') dd.style.setProperty('bottom', bottom, 'important');
    });
  }
  window.addEventListener('resize', function () { try { placeQuickCalendar(); } catch (_) {} });

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
      try { classifyButtons(r); } catch (_) {}
    });
    try { tidyBadges(); } catch (_) {}
    try { unifyModals(); } catch (_) {}
    try { unifyPreviews(); } catch (_) {}
    try { unifyFormActions(); } catch (_) {}
    try { placeQuickCalendar(); } catch (_) {}
    try { vendorCount(); } catch (_) {}
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
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (n.nodeType !== 1) continue;
          pending.add(n);
          if (n.matches && n.matches(PREVIEW_SEL)) { try { unifyPreviews(); } catch (_) {} }
        }
      } else if (r.type === 'attributes' && r.target.nodeType === 1) {
        pending.add(r.target);
        // Place the Quick Calendar right away (before the browser paints), not on the next idle sweep
        // (only on class changes: reacting to style changes would re-trigger on our own placement)
        if (r.attributeName === 'class' && r.target.classList && r.target.classList.contains('quick-calendar-dropdown')) { try { placeQuickCalendar(); } catch (_) {} }
      }
      if (pending.size > 400) { full = true; pending.clear(); break; }
    }
    queue();
  }
  /* ---------- Preview windows: one look ----------
     Equipment, Instruments, Supplies, Services, Vendors, Assignments and Users each built their own
     preview. Tag the header, close button and footer so they all get the details-window look:
     white header with icon tile and a neutral close, and a footer with Close then Edit on the right.
     Existing buttons are moved, never recreated, so their actions keep working. */
  var PREVIEW_SEL = '#viewEquipmentModal, #viewInstrumentModal, #viewSupplyModal, #viewUtilityModal, #teamPreviewModal, #vendorSubModal, #userPreviewModal';
  function pvText(b) { return (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim(); }
  function unifyPreviews() {
    Array.prototype.forEach.call(document.querySelectorAll(PREVIEW_SEL), function (modal) {
      if (modal.dataset.rdPv) return;
      var card = modal.firstElementChild;
      if (!card || !card.firstElementChild) return;
      modal.dataset.rdPv = '1';
      card.classList.add('rd-pv-card');
      var head = card.firstElementChild;
      head.classList.add('rd-pv-head');
      var buttons = Array.prototype.slice.call(card.querySelectorAll('button'));
      var closeBtn = null, editBtn = null, xBtn = null;
      buttons.forEach(function (b) {
        var t = pvText(b);
        if (!closeBtn && /^(×\s*)?close$/i.test(t)) closeBtn = b;
        if (!editBtn && /^edit\b/i.test(t)) editBtn = b;
        if (!xBtn && head.contains(b) && (!t || /^[×✕✖]$/.test(t))) xBtn = b;
      });
      // icon tile: the first small box in the header that only holds an icon
      var tile = Array.prototype.find.call(head.querySelectorAll('div, span'), function (d) {
        return d.children.length === 1 && d.firstElementChild.tagName === 'I' && !pvText(d);
      });
      if (tile) tile.classList.add('rd-pv-icon');
      // footer: where Close lives, unless Close sits in the header (Assignments) - then build one
      var foot = (closeBtn && !head.contains(closeBtn)) ? closeBtn.parentElement : null;
      if (!foot) {
        foot = document.createElement('div');
        card.appendChild(foot);
        Array.prototype.forEach.call(head.querySelectorAll('button'), function (b) {
          if (b !== xBtn && pvText(b)) foot.appendChild(b);
        });
      }
      foot.classList.add('rd-pv-foot');
      if (editBtn) { editBtn.classList.add('rd-pv-edit'); if (editBtn.parentElement !== foot && !card.querySelector('.rd-pv-foot .rd-pv-edit')) foot.appendChild(editBtn); }
      if (closeBtn) {
        closeBtn.classList.add('rd-pv-close');
        if (/^\u00d7\s*close$/i.test(pvText(closeBtn))) closeBtn.textContent = 'Close';
      } else if (xBtn) {
        // every preview gets a Close button next to Edit
        var c = document.createElement('button');
        c.type = 'button';
        c.className = 'rd-pv-close';
        c.textContent = 'Close';
        c.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); xBtn.click(); });
        foot.appendChild(c);
      }
      if (xBtn) {
        xBtn.classList.add('rd-pv-x');
        if (!xBtn.getAttribute('aria-label')) xBtn.setAttribute('aria-label', 'Close');
      } else if (closeBtn) {
        var x = document.createElement('button');
        x.type = 'button';
        x.className = 'rd-pv-x';
        x.setAttribute('aria-label', 'Close');
        x.innerHTML = '&times;';
        x.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); closeBtn.click(); });
        head.appendChild(x);
      }
    });
  }

  /* ---------- Add/edit windows: Cancel then Save, on the right ----------
     Same order as the preview footers (Close then Edit). The buttons are only re-ordered with CSS
     (flex order); nothing is moved, so tab order follows what you see except for that swap. */
  function unifyFormActions() {
    Array.prototype.forEach.call(document.querySelectorAll('[id$="ManagementModal"] button'), function (b) {
      if (b.dataset.rdFa) return;
      var t = pvText(b);
      var isSubmit = b.type === 'submit' || /SubmitBtn$/.test(b.id || '') || /^(save|add|create|update)\b/i.test(t);
      if (!isSubmit || /^cancel$/i.test(t)) return;
      var row = b.parentElement;
      if (!row) return;
      var cancel = Array.prototype.find.call(row.children, function (c) { return c.tagName === 'BUTTON' && /^cancel$/i.test(pvText(c)); });
      if (!cancel) return;
      b.dataset.rdFa = '1';
      row.classList.add('rd-form-actions');
      b.classList.add('rd-form-submit');
      cancel.classList.add('rd-form-cancel');
    });
  }

  /* ---------- Safety net: a Cancel that leaves a management window empty closes it ----------
     Some add/edit windows used to hold a list and a form. The lists moved to their pages, but a few
     Cancel buttons still only hide the form, leaving a blank full-screen window. */
  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!btn || btn.classList.contains('rd-close-btn')) return;
    if ((btn.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase() !== 'cancel') return;
    var modal = btn.closest('[id$="ManagementModal"]');
    if (!modal || modal.dataset.rdClosing) return;
    setTimeout(function () {
      if (getComputedStyle(modal).display === 'none') return;
      var body = modal.querySelector('.modal-body');
      if (!body) return;
      var shown = Array.prototype.some.call(body.children, function (c) {
        return c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT' && c.getClientRects().length > 0;
      });
      if (shown) return;
      modal.dataset.rdClosing = '1';
      var close = modal.querySelector('.login-header button[onclick*="close" i], .modal-header button[onclick*="close" i]');
      try { if (close) close.click(); else modal.style.display = 'none'; } catch (_) { modal.style.display = 'none'; }
      setTimeout(function () { delete modal.dataset.rdClosing; }, 300);
    }, 60);
  }, false);

  function start() {
    sweep();
    new MutationObserver(onMutations).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
