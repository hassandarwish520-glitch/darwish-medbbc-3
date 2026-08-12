const PROTECTED_MARKER = "data-medbbc-protected-html";

const PROTECTED_STYLE = `
html, body {
  -webkit-touch-callout: none !important;
  -webkit-tap-highlight-color: transparent !important;
  overscroll-behavior: contain;
}
body, body * {
  -webkit-user-select: text !important;
  -moz-user-select: text !important;
  -ms-user-select: text !important;
  user-select: text !important;
}
img, video, canvas, svg, iframe {
  -webkit-user-select: none !important;
  -moz-user-select: none !important;
  -ms-user-select: none !important;
  user-select: none !important;
  -webkit-user-drag: none !important;
  user-drag: none !important;
}
::selection {
  background: rgba(250, 204, 21, 0.42) !important;
  color: inherit !important;
}
::-moz-selection {
  background: rgba(250, 204, 21, 0.42) !important;
  color: inherit !important;
}
`;

const PROTECTED_SCRIPT = `(function(){
  if (window.__MEDBBC_HTML_PROTECTED__) return;
  window.__MEDBBC_HTML_PROTECTED__ = true;
  function editable(node){
    if (!node || !(node instanceof Element)) return false;
    return Boolean(node.closest('input, textarea, [contenteditable="true"]'));
  }
  function clearSelection(){
    try {
      var active = document.activeElement;
      if (active && editable(active)) return;
      var sel = window.getSelection && window.getSelection();
      if (sel && sel.rangeCount && !sel.toString().trim()) sel.removeAllRanges();
    } catch (_) {}
  }
  ['contextmenu','copy','cut','paste','dragstart'].forEach(function(evt){
    document.addEventListener(evt, function(e){
      if (editable(e.target)) return;
      e.preventDefault();
      clearSelection();
      return false;
    }, {capture:true});
  });
  document.addEventListener('keydown', function(e){
    var key = (e.key || '').toLowerCase();
    var meta = e.ctrlKey || e.metaKey;
    if (e.key === 'F12' || key === 'f12') { e.preventDefault(); return false; }
    if (key === 'printscreen') { e.preventDefault(); clearSelection(); return false; }
    if (meta && ['c','x','v','a','s','p','u'].indexOf(key) !== -1 && !editable(e.target)) {
      e.preventDefault();
      clearSelection();
      return false;
    }
    if (meta && e.shiftKey && ['i','j','c','s'].indexOf(key) !== -1) {
      e.preventDefault();
      return false;
    }
  }, {capture:true});
})();`;

export function injectProtectionIntoHtml(html: string): string {
  if (!html || html.includes(PROTECTED_MARKER)) return html;
  const payload = `<meta ${PROTECTED_MARKER}="1"><style>${PROTECTED_STYLE}</style><script>${PROTECTED_SCRIPT}</script>`;
  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${payload}</head>`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${payload}</head>`);
  return `<!doctype html><html><head>${payload}</head><body>${html}</body></html>`;
}
