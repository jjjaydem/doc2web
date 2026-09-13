/* Shared intermediate model, safe DOM renderer, allowlist and fragment formatter. */
(() => {
  'use strict';
  const C = window.CMS = {};
  C.MAX_CELLS = 100000;
  C.warning = (warnings, message) => { if (!warnings.includes(message)) warnings.push(message); };
  C.children = (node, name) => [...(node?.children || [])].filter(n => n.localName === name);
  C.child = (node, name) => C.children(node, name)[0];
  C.desc = (node, name) => [...(node?.getElementsByTagNameNS('*', name) || [])];
  C.attr = (node, name) => [...(node?.attributes || [])].find(a => a.localName === name)?.value;
  C.value = (node, name) => C.attr(C.child(node, name), 'val');
  C.on = node => !!node && !['0', 'false', 'off'].includes(C.attr(node, 'val'));
  C.xml = async (zip, path, required = false) => {
    const entry = zip.file(path);
    if (!entry) { if (required) throw Error(`Missing file component: ${path}`); return null; }
    const source = await entry.async('string');
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw Error('XML with DOCTYPE or ENTITY declarations is not supported.');
    const xml = new DOMParser().parseFromString(source, 'application/xml');
    if (xml.getElementsByTagName('parsererror').length) throw Error(`Invalid XML: ${path}`);
    return xml;
  };
  C.resolvePath = (base, target) => {
    const parts = target.startsWith('/') ? [] : base.split('/').slice(0, -1);
    for (const part of target.split('/')) {
      if (part === '..') parts.pop(); else if (part && part !== '.') parts.push(part);
    }
    return parts.join('/');
  };
  C.relationships = async (zip, path) => {
    const bits = path.split('/'), file = bits.pop();
    const xml = await C.xml(zip, [...bits, '_rels', file + '.rels'].join('/'));
    return new Map(C.desc(xml, 'Relationship').map(r => [r.getAttribute('Id'), {
      target: r.getAttribute('Target'), external: r.getAttribute('TargetMode') === 'External', type: r.getAttribute('Type')
    }]));
  };
  C.openPackage = async file => {
    if (!/\.(docx|xlsx)$/i.test(file.name)) throw Error('Only .docx and .xlsx files are supported.');
    if (file.size > 25 * 1024 * 1024) throw Error('This file exceeds 25 MB. Please split the document first.');
    if (!window.JSZip || !window.XLSX) throw Error('Required libraries are missing. Keep the vendor folder alongside index.html.');
    const buffer = await file.arrayBuffer();
    let zip;
    try { zip = await JSZip.loadAsync(buffer); } catch { throw Error('Unable to read the file: it may be damaged, encrypted or not a valid DOCX/XLSX file.'); }
    const entries = Object.values(zip.files);
    if (entries.length > 15000 || entries.reduce((n, e) => n + (e._data?.uncompressedSize || 0), 0) > 150 * 1024 * 1024) {
      throw Error('This archive exceeds the unpacked limit of 150 MB or 15,000 entries.');
    }
    return { zip, buffer, type: file.name.toLowerCase().endsWith('.docx') ? 'docx' : 'xlsx' };
  };
  C.safeLink = raw => {
    const value = String(raw || '').trim();
    if (/[\u0000-\u0020\u007f]/.test(value) && !/^tel:/i.test(value)) return null;
    if (/^https?:\/\//i.test(value)) {
      try { const url = new URL(value); return url.hostname && !url.username && !url.password ? value : null; } catch { return null; }
    }
    if (/^mailto:[^\s@?]+@[^\s@?]+\.[^\s@?]+(?:\?[^\s]*)?$/i.test(value)) return value;
    if (/^tel:/i.test(value)) {
      const phone = value.slice(4).replace(/[\s().-]/g, '');
      return /^\+?\d+(?:;ext=\d+)?$/i.test(phone) ? 'tel:' + phone : null;
    }
    return null;
  };
  C.safeImage = raw => /^IMAGE_\d{3,}_URL$/.test(raw) || /^https?:\/\//i.test(raw) && !!C.safeLink(raw);
  C.text = (text, bold = false, href = undefined) => ({ type: 'text', text: String(text), bold, href });
  // Nodes live in an inert template document until UI code explicitly adopts
  // them. In particular, export img.src must NEVER initiate an HTTP request.
  const inertDocument = document.createElement('template').content.ownerDocument;
  C.element = (tag, attrs = {}, nodes = []) => {
    const element = inertDocument.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, value);
    element.append(...nodes);
    return element;
  };
  function appendText(parent, text, bold, href, warnings) {
    if (!text) return;
    let node = document.createTextNode(text);
    if (bold) node = C.element('strong', {}, [node]);
    if (href !== undefined) {
      const safe = C.safeLink(href);
      if (safe) node = C.element('a', /^https?:/i.test(safe) ? { href: safe, target: '_blank' } : { href: safe }, [node]);
      else C.warning(warnings, `Unsafe or unsupported link removed; display text kept: ${href}`);
    }
    parent.append(node);
  }
  C.renderInline = (tokens, warnings) => {
    const container = C.element('div');
    const joined = [];
    for (const token of tokens || []) {
      if (token.type !== 'text') continue;
      const last = joined.at(-1);
      if (last && last.bold === token.bold && last.href === token.href) last.text += token.text;
      else joined.push({ ...token });
    }
    for (const token of joined) {
      if (token.href !== undefined) { appendText(container, token.text, token.bold, token.href, warnings); continue; }
      const pattern = /https?:\/\/[^\s<>"']+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
      let cursor = 0;
      for (const match of token.text.matchAll(pattern)) {
        let label = match[0];
        if (/^https?:/i.test(label)) {
          label = label.replace(/[.,;:!?]+$/, '');
          while (label.endsWith(')') && (label.match(/\)/g) || []).length > (label.match(/\(/g) || []).length) label = label.slice(0, -1);
        }
        appendText(container, token.text.slice(cursor, match.index), token.bold, undefined, warnings);
        appendText(container, label, token.bold, /^https?:/i.test(label) ? label : 'mailto:' + label, warnings);
        cursor = match.index + label.length;
      }
      appendText(container, token.text.slice(cursor), token.bold, undefined, warnings);
    }
    for (const strong of [...container.querySelectorAll('strong')]) {
      while (strong.nextSibling?.nodeName === 'STRONG') { strong.append(...strong.nextSibling.childNodes); strong.nextSibling.remove(); }
    }
    return [...container.childNodes];
  };
  function imageFigure(block, options, warnings) {
    const fallback = `IMAGE_${String(block.id + 1).padStart(3, '0')}_URL`;
    const raw = options.imageUrls?.[block.id]?.trim();
    let src = raw || fallback;
    if (!C.safeImage(src)) { C.warning(warnings, `Image ${block.id + 1} needs an http:// or https:// URL. Using ${fallback} instead.`); src = fallback; }
    if (src === fallback) C.warning(warnings, `Image ${block.id + 1} has no URL. Replace ${fallback} before publishing.`);
    return C.element('figure', { class: 'text-center' }, [C.element('img', { class: 'img-fluid', src })]);
  }
  C.renderBlocks = (blocks, options, warnings) => {
    const out = [];
    for (let index = 0; index < blocks.length; index++) {
      const block = blocks[index];
      if (block.type === 'paragraph') {
        const p = C.element('p', {}, C.renderInline(block.tokens, warnings));
        if (p.textContent.trim() || p.querySelector('img')) out.push(p);
      } else if (block.type === 'list') {
        out.push(C.element(block.ordered ? 'ol' : 'ul', { class: block.ordered ? 'list-number' : 'list-bullet' }, block.items.map(item => C.element('li', {}, C.renderBlocks(item, options, warnings)))));
      } else if (block.type === 'table') {
        const rows = block.rows.map((row, rowIndex) => C.element('tr', {}, row.map(cell => C.element(rowIndex ? 'td' : 'th', {}, C.renderBlocks(cell, options, warnings)))));
        const table = C.element('table', { class: 'table' }, [C.element('thead', {}, rows.slice(0, 1)), C.element('tbody', {}, rows.slice(1))]);
        out.push(C.element('div', { class: 'row' }, [C.element('div', { class: 'col-12' }, [C.element('div', { class: 'table-responsive' }, [C.element('table-hint'), table])])]));
      } else if (block.type === 'image') {
        const group = [block];
        const perRow = [1, 2, 3].includes(Number(options.imagesPerRow)) ? Number(options.imagesPerRow) : 1;
        while (group.length < perRow && blocks[index + 1]?.type === 'image') group.push(blocks[++index]);
        if (group.length === 1) out.push(imageFigure(block, options, warnings));
        else out.push(C.element('div', { class: 'row' }, group.map(img => C.element('div', { class: group.length === 2 ? 'col-md-6' : 'col-md-4' }, [imageFigure(img, options, warnings)]))));
      }
    }
    // Single paragraph cells/list items can use inline content directly.
    return out;
  };
  const allowed = {
    p: {}, strong: {}, a: { href: true, target: ['_blank'] },
    ul: { class: ['list-bullet'] }, ol: { class: ['list-number'] }, li: {},
    div: { class: ['row', 'col-12', 'table-responsive', 'col-md-6', 'col-md-4'] },
    'table-hint': {}, table: { class: ['table'] }, thead: {}, tbody: {}, tr: {}, th: {}, td: {},
    figure: { class: ['text-center'] }, img: { class: ['img-fluid'], src: true }
  };
  C.validate = source => {
    const errors = [];
    if (/<!|<\?|<\/?(?:html|head|body)(?:\s|>)/i.test(source)) errors.push('Export an HTML fragment only. Document wrappers, comments and declarations are not allowed.');
    // Check balanced markup too: HTML parsing alone silently repairs nested links,
    // duplicate attributes and missing end tags. Generated fragments are XML-safe.
    const xmlSafe = source.replace(/<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi, tag => tag.replace(/\/?\s*>$/, '/>'));
    const syntax = new DOMParser().parseFromString('<fragment>' + xmlSafe + '</fragment>', 'application/xml');
    if (syntax.getElementsByTagName('parsererror').length) errors.push('Invalid HTML: check closing tags, duplicate attributes and entities. Use &amp; or numeric character references.');
    if (C.desc(syntax, 'a').some(a => C.desc(a, 'a').length)) errors.push('Nested links are not allowed.');
    const template = document.createElement('template');
    template.innerHTML = source; // Inert: never attached to the page or used as a preview.
    const walk = node => {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) { errors.push('Comments and special nodes are not allowed.'); return; }
      const tag = node.localName, attrs = allowed[tag];
      if (!attrs || node.namespaceURI !== 'http://www.w3.org/1999/xhtml') { errors.push(`Disallowed tag: ${tag}`); return; }
      for (const attr of node.attributes) {
        if (!Object.hasOwn(attrs, attr.name) || Array.isArray(attrs[attr.name]) && !attrs[attr.name].includes(attr.value)) errors.push(`Disallowed attribute or value: ${tag}[${attr.name}="${attr.value}"]`);
      }
      if (attrs.class && !node.hasAttribute('class')) errors.push(`${tag} requires its specified class.`);
      if (tag === 'a') {
        const href = node.getAttribute('href'), safe = C.safeLink(href);
        if (!safe || safe !== href) errors.push('Links must use an allowed protocol. Remove separators from tel URLs.');
        if (/^https?:/i.test(href || '') ? node.getAttribute('target') !== '_blank' : node.hasAttribute('target')) errors.push('Website links require target="_blank". Do not use target on telephone or email links.');
        if (node.querySelector('a')) errors.push('Nested links are not allowed.');
      }
      if (tag === 'img' && !C.safeImage(node.getAttribute('src') || '')) errors.push('Image src must be an http(s) URL or an IMAGE_001_URL placeholder.');
      if (tag === 'p' && !node.textContent.trim() && !node.querySelector('img')) errors.push('Remove empty paragraphs before exporting.');
      if (tag === 'table') {
        if (node.children.length !== 2 || node.children[0].localName !== 'thead' || node.children[1].localName !== 'tbody') errors.push('Tables must contain thead followed by tbody.');
        if (node.parentElement?.className !== 'table-responsive' || node.previousElementSibling?.localName !== 'table-hint' || node.parentElement?.parentElement?.className !== 'col-12' || node.parentElement?.parentElement?.parentElement?.className !== 'row') errors.push('Tables require the specified CMS wrappers and table-hint.');
        const rows = [...node.querySelectorAll(':scope > thead > tr, :scope > tbody > tr')];
        if (node.querySelectorAll(':scope > thead > tr').length !== 1 || !rows[0]?.children.length) errors.push('Tables must have exactly one header row.');
        if (rows.some(r => r.children.length !== rows[0].children.length)) errors.push('Every table row must contain the same number of cells.');
      }
      const requiredParents = { li: ['ul', 'ol'], thead: ['table'], tbody: ['table'], tr: ['thead', 'tbody'], th: ['tr'], td: ['tr'] };
      if (requiredParents[tag] && !requiredParents[tag].includes(node.parentElement?.localName)) errors.push(`${tag} is in an invalid position.`);
      if (tag === 'th' && node.parentElement?.parentElement?.localName !== 'thead' || tag === 'td' && node.parentElement?.parentElement?.localName !== 'tbody') errors.push('Use th in thead and td in tbody only.');
      for (const child of node.childNodes) walk(child);
    };
    for (const node of template.content.childNodes) walk(node);
    return [...new Set(errors)];
  };
  C.escapeText = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  C.serialize = (node, level = 0) => {
    if (node.nodeType === Node.TEXT_NODE) return C.escapeText(node.textContent);
    const tag = node.localName;
    const attrs = [...node.attributes].map(a => ` ${a.name}="${C.escapeText(a.value).replace(/"/g, '&quot;')}"`).join('');
    const open = `<${tag}${attrs}>`;
    if (tag === 'img') return open;
    const inline = ['p', 'strong', 'a', 'figure'].includes(tag) || [...node.childNodes].some(n => n.nodeType === Node.TEXT_NODE) || [...node.childNodes].every(n => ['strong', 'a', 'img'].includes(n.localName)) || !node.childNodes.length;
    if (inline) return open + [...node.childNodes].map(n => C.serialize(n, level)).join('') + `</${tag}>`;
    return open + '\n' + [...node.childNodes].map(n => '  '.repeat(level + 1) + C.serialize(n, level + 1)).join('\n') + '\n' + '  '.repeat(level) + `</${tag}>`;
  };
  C.generate = (model, options = {}) => {
    const warnings = [...model.warnings];
    const nodes = C.renderBlocks(model.blocks, options, warnings);
    for (const root of nodes) for (const cell of root.querySelectorAll('td,th,li')) {
      if (cell.children.length === 1 && cell.firstChild?.localName === 'p') cell.replaceChildren(...cell.firstChild.childNodes);
    }
    const html = nodes.map(n => C.serialize(n)).join('\n');
    const errors = C.validate(html);
    if (errors.length) throw Error('HTML validation failed: ' + errors.join(' / '));
    return { html, warnings };
  };
})();
