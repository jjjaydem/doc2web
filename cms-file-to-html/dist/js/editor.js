/* Presentation only: textarea remains the sole editable/exported value.
   Tokens are text nodes, never interpreted as document HTML. */
(() => {
  'use strict';
  const input = document.getElementById('output');
  const highlight = document.getElementById('code-highlight');
  function add(parent, text, kind) {
    if (!kind) { parent.append(document.createTextNode(text)); return; }
    const span = document.createElement('span');
    span.className = 'syntax-' + kind;
    span.textContent = text;
    parent.append(span);
  }
  function colorTag(parent, tag) {
    const start = tag.match(/^(<\/?)([\w:-]+)/);
    if (!start) { add(parent, tag); return; }
    add(parent, start[1], 'punctuation'); add(parent, start[2], 'tag');
    let cursor = start[0].length;
    const parts = /"[^"]*"|'[^']*'|[A-Za-z_:][\w:.-]*|[=/>]+/g;
    parts.lastIndex = cursor;
    for (let match; (match = parts.exec(tag));) {
      add(parent, tag.slice(cursor, match.index));
      const text = match[0];
      add(parent, text, /^["']/.test(text) ? 'value' : /^[=/>]/.test(text) ? 'punctuation' : 'attribute');
      cursor = parts.lastIndex;
    }
    add(parent, tag.slice(cursor));
  }
  function syncScroll() {
    highlight.scrollTop = input.scrollTop;
    highlight.scrollLeft = input.scrollLeft;
  }
  window.CMS.highlightEditor = () => {
    const text = input.value, fragment = document.createDocumentFragment();
    const tokens = /<!--[\s\S]*?(?:-->|$)|<\/?[A-Za-z][\w:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*(?:>|$)|&(?:#[xX][\da-fA-F]+|#\d+|[A-Za-z][\w]*);/g;
    let cursor = 0;
    for (const match of text.matchAll(tokens)) {
      add(fragment, text.slice(cursor, match.index));
      if (match[0].startsWith('<!--')) add(fragment, match[0], 'comment');
      else if (match[0].startsWith('&')) add(fragment, match[0], 'entity');
      else colorTag(fragment, match[0]);
      cursor = match.index + match[0].length;
    }
    add(fragment, text.slice(cursor));
    // A final sentinel preserves the last empty line in a pre, as in textarea.
    add(fragment, '\n');
    highlight.replaceChildren(fragment);
    syncScroll();
  };
  input.addEventListener('scroll', syncScroll);
  new ResizeObserver(syncScroll).observe(input);
})();
