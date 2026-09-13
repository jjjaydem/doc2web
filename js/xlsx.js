/* SheetJS formats cell values; OOXML supplements font/rich-text metadata. */
(() => {
  'use strict';
  const C = window.CMS;
  C.readWorkbook = async (zip, buffer) => {
    const workbookXml = await C.xml(zip, 'xl/workbook.xml', true);
    const relations = await C.relationships(zip, 'xl/workbook.xml');
    const stylesXml = await C.xml(zip, 'xl/styles.xml');
    const sharedXml = await C.xml(zip, 'xl/sharedStrings.xml');
    const fonts = C.children(C.child(stylesXml?.documentElement, 'fonts'), 'font');
    const styles = C.children(C.child(stylesXml?.documentElement, 'cellXfs'), 'xf');
    const shared = C.children(sharedXml?.documentElement, 'si');
    const paths = new Map(C.desc(workbookXml, 'sheet').map(s => [s.getAttribute('name'), C.resolvePath('xl/workbook.xml', relations.get(C.attr(s, 'id'))?.target || '')]));
    const book = XLSX.read(buffer, { type: 'array', cellStyles: true, cellNF: true, cellText: true, cellFormula: true, cellHTML: false, sheetStubs: true });
    return { book, zip, paths, fonts, styles, shared };
  };
  C.readWorksheet = async (source, sheetName) => {
    const warnings = [];
    const warn = message => C.warning(warnings, message);
    const sheet = source.book.Sheets[sheetName];
    if (!sheet) throw Error('The selected worksheet could not be found.');
    const xml = await C.xml(source.zip, source.paths.get(sheetName), true);
    const rawCells = new Map(C.desc(xml, 'c').map(c => [c.getAttribute('r'), c]));
    const cells = new Map();
    let minRow = Infinity, maxRow = -1, minCol = Infinity, maxCol = -1;
    function richTokens(container, inheritedBold) {
      const runs = C.children(container, 'r');
      if (!runs.length) return [C.text(C.children(container, 't').map(t => t.textContent).join(''), inheritedBold)];
      return runs.map(r => {
        const b = C.child(C.child(r, 'rPr'), 'b');
        return C.text(C.children(r, 't').map(t => t.textContent).join(''), b ? C.on(b) : inheritedBold);
      });
    }
    for (const [address, raw] of rawCells) {
      const cell = sheet[address];
      if (!cell) continue;
      const position = XLSX.utils.decode_cell(address);
      const style = source.styles[Number(raw.getAttribute('s') || 0)];
      const font = source.fonts[Number(style?.getAttribute('fontId') || 0)];
      const bold = C.on(C.child(font, 'b'));
      const formulaNode = C.child(raw, 'f');
      const cache = C.child(raw, 'v');
      let text, tokens;
      if (formulaNode && (!cache || cache.textContent === '' && raw.getAttribute('t') !== 'str')) {
        text = '=' + (cell.f || formulaNode.textContent || '[formula unavailable]');
        warn(`Cell ${address}: No saved formula result. The formula is shown as plain text.`);
      } else text = cell.w ?? (cell.v == null ? '' : XLSX.utils.format_cell(cell));
      if (!formulaNode && raw.getAttribute('t') === 's') tokens = richTokens(source.shared[Number(cache?.textContent)], bold);
      else if (!formulaNode && raw.getAttribute('t') === 'inlineStr') tokens = richTokens(C.child(raw, 'is'), bold);
      else tokens = [C.text(text, bold)];
      // Newlines cannot become br: retain a word separator instead.
      tokens.forEach(t => { t.text = t.text.replace(/\r\n|\r|\n/g, ' '); if (cell.l?.Target) t.href = cell.l.Target; });
      if (tokens.some(t => t.text.trim()) || formulaNode) {
        cells.set(address, tokens);
        minRow = Math.min(minRow, position.r); maxRow = Math.max(maxRow, position.r);
        minCol = Math.min(minCol, position.c); maxCol = Math.max(maxCol, position.c);
      }
    }
    const merges = sheet['!merges'] || [];
    // Include the whole merged area only if it intersects actual content.
    const activeMerges = merges.filter(m => [...cells.keys()].some(a => {
      const p = XLSX.utils.decode_cell(a); return p.r >= m.s.r && p.r <= m.e.r && p.c >= m.s.c && p.c <= m.e.c;
    }));
    for (const m of activeMerges) {
      minRow = Math.min(minRow, m.s.r); minCol = Math.min(minCol, m.s.c);
      maxRow = Math.max(maxRow, m.e.r); maxCol = Math.max(maxCol, m.e.c);
    }
    warn('XLSX: Images, charts, objects and conditional formatting are not exported. Bold is read from cell fonts and rich text in the XML.');
    if (C.desc(xml, 'drawing').length || C.desc(xml, 'legacyDrawing').length) warn('This worksheet contains drawings or objects that are not exported. Add them in your CMS.');
    if (C.desc(xml, 'conditionalFormatting').length) warn('This worksheet uses conditional formatting, which is not applied to the HTML.');
    if ((sheet['!rows'] || []).some(r => r?.hidden) || (sheet['!cols'] || []).some(c => c?.hidden)) warn('This worksheet has hidden rows or columns. Their data is included in the export.');
    if (maxRow < 0) return { blocks: [], images: [], warnings: [...warnings, 'This worksheet has no content to convert.'] };
    if ((maxRow - minRow + 1) * (maxCol - minCol + 1) > C.MAX_CELLS) throw Error('The data range exceeds 100,000 cells. Split the worksheet or remove distant data.');
    const covered = new Set();
    for (const m of activeMerges) {
      warn('XLSX merged cells expanded: content stays in the first cell; the remaining cells are empty.');
      for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (cells.has(addr)) warn(`Cell ${addr}: Content in a merged continuation cell was omitted; only the first cell is kept.`);
          covered.add(addr);
        }
      }
    }
    const rows = [];
    for (let r = minRow; r <= maxRow; r++) {
      const row = [];
      for (let c = minCol; c <= maxCol; c++) {
        const address = XLSX.utils.encode_cell({ r, c });
        const tokens = covered.has(address) ? [] : cells.get(address) || [];
        row.push(tokens.length ? [{ type: 'paragraph', tokens }] : []);
      }
      rows.push(row);
    }
    return { blocks: [{ type: 'table', rows }], images: [], warnings };
  };
})();
