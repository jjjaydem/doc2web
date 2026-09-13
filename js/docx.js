/* DOCX OOXML reader. Source XML is data only; no source HTML is inserted. */
(() => {
  'use strict';
  const C = window.CMS;
  C.readDocx = async zip => {
    const warnings = [], images = [];
    const warn = text => C.warning(warnings, text);
    const doc = await C.xml(zip, 'word/document.xml', true);
    const stylesDoc = await C.xml(zip, 'word/styles.xml');
    const numbering = await C.xml(zip, 'word/numbering.xml');
    const relations = await C.relationships(zip, 'word/document.xml');
    const styleMap = new Map(C.desc(stylesDoc, 'style').map(s => [C.attr(s, 'styleId'), s]));
    const defaultStyle = [...styleMap.values()].find(s => C.attr(s, 'type') === 'paragraph' && ['1', 'true', 'on'].includes(C.attr(s, 'default')));
    const defaults = C.child(C.child(stylesDoc?.documentElement, 'docDefaults'), 'rPrDefault');
    function styleChain(id, seen = new Set()) {
      if (!id || seen.has(id)) return [];
      seen.add(id);
      const style = styleMap.get(id);
      return style ? [...styleChain(C.value(style, 'basedOn'), seen), style] : [];
    }
    function boldFor(run, paragraphStyle) {
      let bold = C.on(C.child(C.child(defaults, 'rPr'), 'b'));
      const runPr = C.child(run, 'rPr');
      for (const style of [...styleChain(paragraphStyle), ...styleChain(C.value(runPr, 'rStyle'))]) {
        // OOXML style-level bold is a toggle, direct run formatting is absolute.
        if (C.on(C.child(C.child(style, 'rPr'), 'b'))) bold = !bold;
      }
      const direct = C.child(runPr, 'b');
      if (direct) bold = C.on(direct);
      return bold;
    }
    const abstract = new Map(C.desc(numbering, 'abstractNum').map(n => [C.attr(n, 'abstractNumId'), n]));
    const nums = new Map(C.desc(numbering, 'num').map(n => [C.attr(n, 'numId'), n]));
    function listInfo(p) {
      const pPr = C.child(p, 'pPr');
      let id, level;
      for (const properties of [...styleChain(C.value(pPr, 'pStyle') || C.attr(defaultStyle, 'styleId')).map(s => C.child(s, 'pPr')), pPr]) {
        const numPr = C.child(properties, 'numPr');
        id = C.value(numPr, 'numId') ?? id;
        level = C.value(numPr, 'ilvl') ?? level;
      }
      if (!id || id === '0') return null;
      const depth = Math.min(8, Math.max(0, Number(level || 0)));
      const num = nums.get(id);
      const def = abstract.get(C.value(num, 'abstractNumId'));
      const override = C.children(num, 'lvlOverride').find(n => C.attr(n, 'ilvl') === String(depth));
      const lvl = C.child(override, 'lvl') || C.children(def, 'lvl').find(n => C.attr(n, 'ilvl') === String(depth));
      const format = C.value(lvl, 'numFmt');
      if (!lvl) warn('An unknown list format was converted to a standard numbered list.');
      const start = C.value(override, 'startOverride') || C.value(lvl, 'start') || '1';
      const text = C.value(lvl, 'lvlText');
      if (format !== 'bullet' && (start !== '1' || format !== 'decimal' || text && text !== `%${depth + 1}.`)) warn('Custom list numbering is converted to standard numbers starting at 1; start/type attributes are not allowed.');
      return { depth, ordered: format !== 'bullet', id };
    }
    async function readImage(node) {
      if (C.desc(node, 'blip').length > 1 || C.desc(node, 'imagedata').length > 1) warn('A grouped drawing contains multiple images. Only the first is read; add the remaining images manually.');
      const blip = C.desc(node, 'blip')[0] || C.desc(node, 'imagedata')[0];
      const rid = C.attr(blip, 'embed') || C.attr(blip, 'id') || C.attr(blip, 'link');
      const rel = relations.get(rid);
      if (!blip || !rel) { warn('An image or chart could not be extracted. Add this content in your CMS.'); return null; }
      const id = images.length;
      let blob = null;
      if (!rel.external) {
        const path = C.resolvePath('word/document.xml', rel.target);
        const entry = zip.file(path);
        const ext = path.split('.').pop().toLowerCase();
        const mime = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp' }[ext];
        if (entry && mime) blob = new Blob([await entry.async('uint8array')], { type: mime });
        else warn(`Image ${id + 1} is missing or cannot be previewed. Enter its CMS URL.`);
      } else warn(`Image ${id + 1} is external and will not be downloaded. Enter its CMS URL.`);
      images.push({ id, blob, name: rel.target.split('/').pop() });
      return { type: 'image', id };
    }
    async function paragraph(p) {
      const tokens = [];
      const style = C.value(C.child(p, 'pPr'), 'pStyle') || C.attr(defaultStyle, 'styleId');
      async function walk(node, bold = false, href) {
        switch (node.localName) {
          case 'pPr': case 'rPr': case 'bookmarkStart': case 'bookmarkEnd': case 'proofErr': case 'lastRenderedPageBreak': return;
          case 'del': case 'moveFrom': warn('Track Changes: inserted text is included; deleted text is omitted.'); return;
          case 'ins': case 'moveTo': warn('Track Changes: inserted text is included; deleted text is omitted.'); break;
          case 'r': bold = boldFor(node, style); break;
          case 't': tokens.push(C.text(node.textContent, bold, href)); return;
          case 'tab': case 'br': case 'cr': tokens.push(C.text(' ', bold, href)); return;
          case 'noBreakHyphen': tokens.push(C.text('\u2011', bold, href)); return;
          case 'softHyphen': tokens.push(C.text('\u00ad', bold, href)); return;
          case 'hyperlink': {
            const rel = relations.get(C.attr(node, 'id'));
            href = rel?.target || '#' + (C.attr(node, 'anchor') || '');
            break;
          }
          case 'drawing': case 'pict': {
            if (C.desc(node, 'txbxContent').length) { warn('Text box content is kept in XML order; its position on the page is not preserved.'); tokens.push(C.text(C.desc(node, 't').map(n => n.textContent).join(' '), bold, href)); }
            const image = await readImage(node);
            if (image) tokens.push(image);
            if (C.desc(node, 'anchor').length) warn('Floating images follow XML anchor order, which may differ from the page layout.');
            return;
          }
          case 'AlternateContent': {
            const branch = C.child(node, 'Choice') || C.child(node, 'Fallback');
            if (branch) for (const child of branch.children) await walk(child, bold, href);
            warn('AlternateContent: the first branch is used. Some Word-specific formatting may be missing.'); return;
          }
          case 'fldChar': return;
          case 'instrText': case 'fldSimple': warn('Word fields: saved display text is kept. Field-code hyperlinks may remain plain text.'); if (node.localName === 'instrText') return; break;
          case 'footnoteReference': case 'endnoteReference': case 'object': case 'oMath': case 'oMathPara': case 'sym':
            warn(`Unsupported DOCX content: ${node.localName}. Please compare with the original.`); return;
        }
        for (const child of node.children) await walk(child, bold, href);
      }
      for (const child of p.children) await walk(child);
      const blocks = [], pending = [];
      const flush = () => { if (pending.some(t => t.text.trim())) blocks.push({ type: 'paragraph', tokens: pending.splice(0) }); else pending.length = 0; };
      for (const token of tokens) {
        if (token.type === 'image') { flush(); blocks.push(token); } else pending.push(token);
      }
      flush();
      if (tokens.some(t => t.type === 'image') && tokens.some(t => t.type === 'text' && t.text.trim())) warn('Inline images are separated into figures, preserving the order of surrounding text.');
      return { blocks, list: listInfo(p) };
    }
    async function table(tbl) {
      const rows = [];
      let width = C.children(C.child(tbl, 'tblGrid'), 'gridCol').length;
      for (const tr of C.children(tbl, 'tr')) {
        const row = [];
        const before = Number(C.value(C.child(tr, 'trPr'), 'gridBefore') || 0);
        for (let i = 0; i < before; i++) row.push([]);
        for (const tc of C.children(tr, 'tc')) {
          const pr = C.child(tc, 'tcPr');
          const span = Math.max(1, Number(C.value(pr, 'gridSpan') || 1));
          if (!Number.isFinite(span) || span > C.MAX_CELLS) throw Error('A DOCX merged range exceeds the supported limit.');
          const vertical = C.child(pr, 'vMerge'), horizontal = C.child(pr, 'hMerge');
          const continuation = vertical && C.attr(vertical, 'val') !== 'restart' || horizontal && C.attr(horizontal, 'val') !== 'restart';
          if (span > 1 || vertical || horizontal) warn('DOCX merged cells expanded: content stays in the first cell; the remaining cells are empty.');
          if (continuation) {
            const hiddenText = C.desc(tc, 't').map(n => n.textContent).join('').trim();
            if (hiddenText) warn('Text in a merged continuation cell was omitted. Please compare with the original.');
            row.push([]);
          } else row.push(await container(tc));
          for (let i = 1; i < span; i++) row.push([]);
        }
        const after = Number(C.value(C.child(tr, 'trPr'), 'gridAfter') || 0);
        for (let i = 0; i < after; i++) row.push([]);
        width = Math.max(width, row.length);
        rows.push(row);
        if (width * rows.length > C.MAX_CELLS) throw Error('A DOCX table exceeds 100,000 cells.');
      }
      for (const row of rows) while (row.length < width) row.push([]);
      return rows.length && width ? { type: 'table', rows } : null;
    }
    async function container(parent) {
      const blocks = [], stack = [];
      const flattened = [];
      function collect(node) {
        for (const child of node.children) {
          if (['p', 'tbl'].includes(child.localName)) flattened.push(child);
          else if (['sdt', 'sdtContent', 'customXml', 'ins'].includes(child.localName)) collect(child);
          else if (child.localName === 'altChunk') warn('Embedded altChunk documents are not supported.');
        }
      }
      collect(parent);
      for (const node of flattened) {
        if (node.localName === 'tbl') { stack.length = 0; const data = await table(node); if (data) blocks.push(data); continue; }
        const parsed = await paragraph(node);
        if (!parsed.list) { stack.length = 0; blocks.push(...parsed.blocks); continue; }
        if (!parsed.blocks.length) continue;
        const info = parsed.list;
        let depth = info.depth;
        if (depth > stack.length) { warn('A list skips a nesting level. It was placed under the nearest available parent.'); depth = stack.length; }
        if (!stack.length && depth) { warn('A list starts at a nested level. It is shown at the top level.'); depth = 0; }
        stack.length = Math.min(stack.length, depth + 1);
        if (stack[depth] && stack[depth].id !== info.id && info.ordered) warn('Consecutive numbered lists are combined. Numbering restarts between lists are not preserved.');
        if (!stack[depth] || stack[depth].ordered !== info.ordered) {
          const list = { type: 'list', ordered: info.ordered, id: info.id, items: [] };
          const host = depth ? stack[depth - 1].items.at(-1) : blocks;
          host.push(list); stack[depth] = list;
        }
        stack[depth].id = info.id;
        stack[depth].items.push(parsed.blocks);
      }
      return blocks;
    }
    warn('DOCX: Headings, italic, underline, color, size and sub/superscript become plain text where their formatting is not allowed.');
    if (Object.keys(zip.files).some(p => /^word\/(header|footer|footnotes|endnotes)/.test(p))) warn('DOCX: Headers, footers and footnotes are omitted. Check for content you need to add manually.');
    const body = C.desc(doc, 'body')[0];
    if (!body) throw Error('No main document body was found in this DOCX file.');
    const blocks = await container(body);
    if (!blocks.length) warn('No supported content was found in this document.');
    return { blocks, warnings, images };
  };
})();
