(() => {
  'use strict';
  const C = window.CMS;
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['file', 'file-name', 'status', 'sheet', 'sheet-field', 'image-settings', 'image-layout', 'images', 'convert', 'clear', 'output', 'copy', 'download', 'notices', 'notice-list', 'character-count', 'output-state'].map(id => [id, $(id)]));
  let revision = 0, model = null, workbook = null, currentName = '', previewUrls = [], conversionWarnings = [];
  function notices(messages, error = false) {
    ui.notices.hidden = !messages.length;
    ui.notices.classList.toggle('error', error);
    ui['notice-list'].replaceChildren(...[...new Set(messages)].map(text => C.element('li', {}, [document.createTextNode(text)])));
  }
  function releasePreviews() { previewUrls.forEach(url => URL.revokeObjectURL(url)); previewUrls = []; }
  function outputChanged() {
    const value = ui.output.value;
    C.highlightEditor();
    ui['character-count'].textContent = value.length.toLocaleString('en-US') + ' characters';
    ui.copy.disabled = ui.download.disabled = !value.trim();
    ui['output-state'].textContent = value ? 'Review before publishing' : 'Awaiting conversion';
  }
  function invalidateOutput(message) {
    ui.output.value = ''; outputChanged();
    if (message) ui.status.textContent = message;
  }
  function reset() {
    revision++; model = workbook = null; currentName = ''; conversionWarnings = [];
    releasePreviews(); ui.images.replaceChildren(); ui.sheet.replaceChildren();
    ui['sheet-field'].hidden = ui['image-settings'].hidden = true;
    ui['image-layout'].value = '1'; ui.file.value = ''; ui.file.disabled = false;
    ui['file-name'].textContent = 'No file selected'; ui.status.textContent = 'Ready when you are';
    ui.convert.disabled = true; invalidateOutput(); notices([]);
  }
  function showImages(images) {
    releasePreviews(); ui.images.replaceChildren(); ui['image-settings'].hidden = !images.length;
    for (const item of images) {
      const card = C.element('div', { class: 'image-card' });
      if (item.blob) {
        const url = URL.createObjectURL(item.blob); previewUrls.push(url);
        const img = C.element('img', { src: url, alt: 'Preview of image ' + (item.id + 1) });
        img.addEventListener('error', () => { img.replaceWith(document.createTextNode('This image cannot be previewed. Please check the original document.')); });
        card.append(img);
      }
      const id = 'image-url-' + item.id;
      card.append(C.element('label', { for: id }, [document.createTextNode(`Image ${item.id + 1} · ${item.name || 'Embedded image'}`)]));
      const input = C.element('input', { id, type: 'url', placeholder: `IMAGE_${String(item.id + 1).padStart(3, '0')}_URL`, 'aria-label': `URL for image ${item.id + 1}` });
      input.addEventListener('input', () => invalidateOutput('Image URL updated. Convert again to apply your changes.'));
      card.append(input); ui.images.append(card);
    }
  }
  async function loadFile(file) {
    if (!file) return;
    reset();
    const ticket = revision;
    currentName = file.name; ui['file-name'].textContent = file.name;
    ui.status.textContent = 'Reading your file…';
    try {
      const source = await C.openPackage(file);
      if (ticket !== revision) return;
      if (source.type === 'docx') {
        const result = await C.readDocx(source.zip);
        if (ticket !== revision) return;
        model = result; showImages(model.images); notices(model.warnings);
      } else {
        const result = await C.readWorkbook(source.zip, source.buffer);
        if (ticket !== revision) return;
        workbook = result;
        ui.sheet.replaceChildren(...workbook.book.SheetNames.map(name => C.element('option', { value: name }, [document.createTextNode(name)])));
        ui['sheet-field'].hidden = false;
        notices(['Excel images and charts are not exported. Formulas use the results saved in the workbook.']);
      }
      ui.convert.disabled = false; ui.status.textContent = 'File loaded. Ready to convert.';
    } catch (error) {
      if (ticket !== revision) return;
      model = workbook = null; ui.convert.disabled = true;
      ui.status.textContent = 'Unable to read file'; notices([error.message || 'The file is damaged or unsupported. Please check the original.'], true);
    }
  }
  ui.file.addEventListener('change', () => loadFile(ui.file.files[0]));
  const dropZone = document.querySelector('.file-picker');
  let dragDepth = 0;
  const isFileDrag = event => [...(event.dataTransfer?.types || [])].includes('Files');
  function clearDragHighlight() { dragDepth = 0; dropZone.classList.remove('is-dragging'); }
  // Accept files anywhere on the page and prevent the browser from navigating
  // to the dropped document. Text drags within the HTML editor stay untouched.
  document.addEventListener('dragenter', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault(); dragDepth++; dropZone.classList.add('is-dragging');
  });
  document.addEventListener('dragover', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('dragleave', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (--dragDepth <= 0) clearDragHighlight();
  });
  document.addEventListener('drop', event => {
    if (!isFileDrag(event)) return;
    event.preventDefault(); clearDragHighlight();
    const files = [...event.dataTransfer.files];
    if (files.length !== 1) {
      notices([files.length ? 'Please drop one file at a time (.docx or .xlsx).' : 'Please drop a .docx or .xlsx file, not a folder.'], true);
      return;
    }
    loadFile(files[0]);
  });
  window.addEventListener('dragend', clearDragHighlight);
  window.addEventListener('blur', clearDragHighlight);
  document.querySelector('.file-picker').addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); ui.file.click(); }
  });
  ui.sheet.addEventListener('change', () => { revision++; invalidateOutput('Worksheet changed. Convert again to update the HTML.'); ui.convert.disabled = false; });
  ui['image-layout'].addEventListener('change', () => invalidateOutput('Image layout changed. Convert again to apply it.'));
  ui.convert.addEventListener('click', async () => {
    const ticket = ++revision;
    ui.convert.disabled = true; ui.status.textContent = 'Converting and validating HTML…';
    invalidateOutput();
    try {
      // Yield a paint before synchronous formatting of a large worksheet.
      await new Promise(resolve => setTimeout(resolve, 20));
      if (ticket !== revision) return;
      const selected = workbook ? await C.readWorksheet(workbook, ui.sheet.value) : model;
      if (ticket !== revision) return;
      if (!selected) throw Error('Please choose a file first.');
      const result = C.generate(selected, { imagesPerRow: Number(ui['image-layout'].value), imageUrls: selected.images.map(img => $('image-url-' + img.id)?.value || '') });
      ui.output.value = result.html; conversionWarnings = result.warnings;
      notices(result.warnings); outputChanged();
      ui.status.textContent = result.html ? 'Conversion complete. Review your HTML before publishing.' : 'No supported content found';
      ui['output-state'].textContent = result.html ? '✓ Validated HTML' : 'No content';
    } catch (error) { if (ticket === revision) { notices([error.message || 'Unable to convert this file'], true); ui.status.textContent = 'Conversion failed'; } }
    finally { if (ticket === revision) ui.convert.disabled = !model && !workbook; }
  });
  ui.output.addEventListener('input', outputChanged);
  function exportValue() {
    const text = ui.output.value;
    const errors = C.validate(text);
    if (!text.trim()) errors.push('There is no HTML to export yet.');
    if (errors.length) { notices(errors, true); ui.status.textContent = 'Export blocked. Please fix the HTML issues listed below.'; return null; }
    const placeholders = [...new Set(text.match(/IMAGE_\d{3,}_URL/g) || [])];
    notices([...conversionWarnings, ...(placeholders.length ? [`Replace these image placeholders before publishing: ${placeholders.join(', ')}`] : [])]);
    ui['output-state'].textContent = '✓ Validated HTML';
    return text; // Never sanitize, normalize, or reformat the editable export silently.
  }
  ui.copy.addEventListener('click', async () => {
    const text = exportValue(); if (text === null) return;
    let copied = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); copied = true; } } catch { /* file:// permissions vary */ }
    if (!copied) {
      const start = ui.output.selectionStart, end = ui.output.selectionEnd;
      ui.output.focus(); ui.output.select();
      try { copied = document.execCommand('copy'); } catch { copied = false; }
      if (copied) ui.output.setSelectionRange(start, end);
    }
    ui.status.textContent = copied ? 'HTML copied to clipboard.' : 'Automatic copying is unavailable. Press Ctrl+C (Mac: ⌘C) to copy the selected HTML.';
  });
  ui.download.addEventListener('click', () => {
    const text = exportValue(); if (text === null) return;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/html;charset=utf-8' }));
    const link = C.element('a', { href: url, download: (currentName.replace(/\.(docx|xlsx)$/i, '') || 'cms-content') + '.html' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    ui.status.textContent = 'Your HTML download is ready.';
  });
  ui.clear.addEventListener('click', reset);
  window.addEventListener('beforeunload', releasePreviews);
  reset();
})();
