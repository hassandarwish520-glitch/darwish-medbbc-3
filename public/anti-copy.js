/*!
 * anti-copy.js — Darwish MedBBC v2
 * Blocks copy / right-click / selection / common shortcuts
 * Softens screenshots via blur-on-blur & DevTools detection
 * Adds watermark overlay for document/PDF viewers
 * Fully bypassed for admin users.
 */
(function () {
  'use strict';

  /* ============================================
     1) Admin detection
     ============================================ */
  function isAdmin() {
    try {
      const role = (localStorage.getItem('userRole') || localStorage.getItem('role') || '').toLowerCase();
      if (role === 'admin') return true;
      const cookies = document.cookie.split(';').map(c => c.trim());
      for (const c of cookies) {
        const [k, v] = c.split('=');
        if (!k) continue;
        if (k === 'role' && (v || '').toLowerCase() === 'admin') return true;
        if (k === 'isAdmin' && v === 'true') return true;
      }
      if (window.__USER__ && window.__USER__.role === 'admin') return true;
      if (window.currentUser && window.currentUser.isAdmin) return true;
      if (document.body && document.body.classList.contains('admin-mode')) return true;
      return false;
    } catch (e) { return false; }
  }

  if (isAdmin()) {
    console.log('%c[MedBBC] Admin mode — content protection disabled', 'color:#0a0;font-weight:bold');
    return;
  }

  /* ============================================
     2) Right-click
     ============================================ */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
    return false;
  }, { capture: true });

  /* ============================================
     3) Copy / Cut / Paste / Selection / Drag
     ============================================ */
  ['copy', 'cut', 'paste', 'selectstart', 'dragstart'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
      const t = e.target;
      const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea' || (t && t.isContentEditable)) return;
      e.preventDefault();
      return false;
    }, { capture: true });
  });

  /* ============================================
     4) Keyboard shortcuts
     ============================================ */
  document.addEventListener('keydown', function (e) {
    const key  = (e.key  || '').toLowerCase();
    const code = e.code || '';

    if (key === 'f12' || code === 'F12') { e.preventDefault(); return false; }

    if (key === 'printscreen' || code === 'PrintScreen') {
      e.preventDefault();
      try { navigator.clipboard && navigator.clipboard.writeText('').catch(function(){}); } catch (_) {}
      return false;
    }

    if (e.ctrlKey || e.metaKey) {
      const blocked = ['c', 'x', 'v', 'a', 's', 'u', 'p'];
      if (blocked.indexOf(key) !== -1) {
        const t = e.target;
        const tag = t && t.tagName ? t.tagName.toLowerCase() : '';
        if (tag !== 'input' && tag !== 'textarea' && !(t && t.isContentEditable)) {
          e.preventDefault();
          return false;
        }
      }
      if (e.shiftKey && ['i', 'j', 'c'].indexOf(key) !== -1) {
        e.preventDefault();
        return false;
      }
    }
  }, { capture: true });

  /* ============================================
     5) Global no-select CSS
     ============================================ */
  var style = document.createElement('style');
  style.setAttribute('data-medbbc-protect', '1');
  style.textContent =
    'body.__darwish_blur__ { filter: blur(22px) !important; transition: filter .12s; }' +
    'body { -webkit-user-select:none; -moz-user-select:none; -ms-user-select:none; user-select:none; -webkit-touch-callout:none; }' +
    'input,textarea,[contenteditable="true"] { -webkit-user-select:text !important; user-select:text !important; }' +
    'img,video,canvas,svg { -webkit-user-drag:none; user-drag:none; pointer-events:none; }' +
    '.medbbc-viewer, .medbbc-viewer *, [data-medbbc-viewer], [data-medbbc-viewer] * { pointer-events:auto !important; }' +
    /* Prevent text selection highlight showing */
    '::selection { background: transparent; }' +
    '::-moz-selection { background: transparent; }';
  (document.head || document.documentElement).appendChild(style);

  /* ============================================
     6) Blur on window loss / tab switch
     ============================================ */
  function addBlur()    { document.body && document.body.classList.add('__darwish_blur__'); }
  function removeBlur() { document.body && document.body.classList.remove('__darwish_blur__'); }

  window.addEventListener('blur',  addBlur);
  window.addEventListener('focus', removeBlur);
  document.addEventListener('visibilitychange', function () {
    document.hidden ? addBlur() : removeBlur();
  });

  /* ============================================
     7) Periodic clipboard wipe
     ============================================ */
  setInterval(function () {
    try {
      if (navigator.clipboard && document.hasFocus()) {
        navigator.clipboard.writeText('').catch(function(){});
      }
    } catch (_) {}
  }, 1000);

  /* ============================================
     8) DevTools detection (dimension heuristic)
     ============================================ */
  setInterval(function () {
    var wDiff = window.outerWidth  - window.innerWidth;
    var hDiff = window.outerHeight - window.innerHeight;
    if (wDiff > 160 || hDiff > 160) addBlur();
    else removeBlur();
  }, 900);

  /* ============================================
     9) Dynamic watermark on PDF/document pages
     ============================================ */
  function maybeInjectWatermark() {
    var path = window.location.pathname;
    var isDocPage = /\/(knowledge|documents|lessons|subjects|notes)/.test(path);
    if (!isDocPage) return;

    if (document.getElementById('__medbbc_wm__')) return;

    var wm = document.createElement('div');
    wm.id = '__medbbc_wm__';

    var email = '';
    try {
      var stored = localStorage.getItem('supabase.auth.token') || localStorage.getItem('sb-auth-token');
      if (stored) {
        var parsed = JSON.parse(stored);
        email = (parsed && parsed.user && parsed.user.email) || '';
      }
    } catch (_) {}

    var label = email || 'MedBBC Protected';

    wm.style.cssText = [
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:9999',
      'overflow:hidden',
    ].join(';');

    var text = document.createElement('div');
    text.style.cssText = [
      'position:absolute',
      'inset:0',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:1.15rem',
      'font-weight:700',
      'color:rgba(150,150,150,0.07)',
      'letter-spacing:0.04em',
      'white-space:nowrap',
      'transform:rotate(-30deg) scale(3)',
      'user-select:none',
      '-webkit-user-select:none',
    ].join(';');
    text.textContent = label + ' — MedBBC Confidential';

    wm.appendChild(text);
    document.body.appendChild(wm);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeInjectWatermark);
  } else {
    maybeInjectWatermark();
  }

  // Re-check on navigation (SPA)
  var lastPath = window.location.pathname;
  setInterval(function () {
    if (window.location.pathname !== lastPath) {
      lastPath = window.location.pathname;
      document.getElementById('__medbbc_wm__') && document.getElementById('__medbbc_wm__').remove();
      maybeInjectWatermark();
    }
  }, 500);

  /* ============================================
     10) Block iframe embedding
     ============================================ */
  try {
    if (window.self !== window.top) {
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666">Content cannot be embedded.</div>';
    }
  } catch (_) {}

  /* ============================================
     11) Enhanced protection for PDF / file viewers
         — overlay on every canvas/iframe element
         — blocks long-press on mobile
         — prevents saving via Ctrl+S / Cmd+S
     ============================================ */
  function protectViewerElements() {
    // Block long-press text selection on mobile
    var style = document.createElement('style');
    style.textContent = [
      '.protected-view, .protected-view * { -webkit-user-select:none!important; user-select:none!important; -webkit-touch-callout:none!important; }',
      '.protected-view canvas { pointer-events:auto; -webkit-user-drag:none; }',
      '.protected-view iframe { pointer-events:auto; }',
      'canvas { -webkit-user-select:none!important; user-select:none!important; }',
    ].join('\n');
    document.head.appendChild(style);

    // Block right-click specifically on canvas elements (PDF pages)
    document.addEventListener('contextmenu', function(e) {
      var el = e.target;
      if (el && (el.tagName === 'CANVAS' || el.tagName === 'IMG')) {
        e.preventDefault();
        return false;
      }
    }, { capture: true });

    // Block long-press "save image" popup on CANVAS / IMG only.
    // NOTE: IFRAME is intentionally excluded — preventing default on iframe
    // touches froze scrolling for every student on tablets / iPads / laptops.
    document.addEventListener('touchstart', function(e) {
      var el = e.target;
      if (el && (el.tagName === 'CANVAS' || el.tagName === 'IMG')) {
        var firstTouch = e.touches && e.touches[0];
        el._touchStartX = firstTouch ? firstTouch.clientX : 0;
        el._touchStartY = firstTouch ? firstTouch.clientY : 0;
        el._longPressTimer = setTimeout(function() {
          try { e.preventDefault(); } catch (_) {}
        }, 550);
      }
    }, { passive: false });
    document.addEventListener('touchmove', function(e) {
      var el = e.target;
      if (!el || !el._longPressTimer) return;
      var firstTouch = e.touches && e.touches[0];
      var dx = Math.abs((firstTouch ? firstTouch.clientX : 0) - (el._touchStartX || 0));
      var dy = Math.abs((firstTouch ? firstTouch.clientY : 0) - (el._touchStartY || 0));
      if (dx > 8 || dy > 8) {
        clearTimeout(el._longPressTimer);
        el._longPressTimer = null;
      }
    }, { passive: true });
    document.addEventListener('touchend', function(e) {
      var el = e.target;
      if (el && el._longPressTimer) {
        clearTimeout(el._longPressTimer);
        el._longPressTimer = null;
      }
    });
    document.addEventListener('touchcancel', function(e) {
      var el = e.target;
      if (el && el._longPressTimer) {
        clearTimeout(el._longPressTimer);
        el._longPressTimer = null;
      }
    });

    // Prevent Ctrl+S / Cmd+S (save page)
    document.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        return false;
      }
    }, { capture: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', protectViewerElements);
  } else {
    protectViewerElements();
  }

  console.log('%c[MedBBC] Content protection active', 'color:#c00;font-weight:bold');
})();
