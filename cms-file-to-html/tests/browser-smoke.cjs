/* Real Chromium regression suite. Run: node tests/browser-smoke.cjs
   Requires playwright (or set NODE_PATH to an installed package directory). */
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const appUrl = process.env.CMS_TEST_URL || pathToFileURL(path.join(root, 'index.html')).href;
const hosted = /^https?:/.test(appUrl);
const artifactPrefix = hosted ? 'hosted-' : '';
const result = { browser: 'Microsoft Edge / Chromium', mode: hosted ? 'HTTP production build' : 'file:// (offline, no server)', passed: [], failed: [], consoleErrors: [], networkRequests: [] };

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1080 } });
  const page = await context.newPage();
  page.on('pageerror', error => result.consoleErrors.push(error.message));
  page.on('request', request => { if (/^https?:/.test(request.url()) && (!hosted || new URL(request.url()).origin !== new URL(appUrl).origin)) result.networkRequests.push(request.url()); });
  const test = async (name, fn) => { try { await fn(); result.passed.push(name); console.log('PASS', name); } catch (error) { result.failed.push({ name, error: error.message }); console.log('FAIL', name, error.message); } };
  const readHtml = () => page.locator('#output').inputValue();
  const selectFile = async file => {
    await page.locator('#file').setInputFiles(path.join(__dirname, file));
    await page.waitForFunction(() => !document.querySelector('#convert').disabled || document.querySelector('#status').textContent === 'Unable to read file');
  };
  const convert = async () => {
    await page.locator('#convert').click();
    await page.waitForFunction(() => !document.querySelector('#convert').disabled);
    assert(!((await page.locator('#status').textContent()).includes('failed')), await page.locator('#notice-list').textContent());
    return readHtml();
  };
  await page.goto(appUrl);
  await test('App and vendored libraries load in the selected hosting mode', async () => {
    assert.equal(await page.title(), 'CMS Studio — Document to HTML');
    assert.deepEqual(await page.evaluate(() => [!!window.CMS, !!window.JSZip, XLSX.version]), [true, true, '0.20.3']);
  });
  await test('Interface and user guide are English with a working return link', async () => {
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert(!/[ก-๙]/.test(await page.locator('body').innerText()));
    await page.getByRole('link', { name: 'User guide' }).click();
    assert.equal(await page.title(), 'User guide — CMS Studio');
    assert(!/[ก-๙]/.test(await page.locator('body').innerText()));
    await page.getByRole('link', { name: 'Open converter' }).click();
    assert.equal(await page.title(), 'CMS Studio — Document to HTML');
  });
  const dropFiles = async (names, selector = '.file-picker strong') => {
    const payload = names.map(name => ({ name, bytes: [...fs.readFileSync(path.join(__dirname, name))] }));
    return page.evaluate(({ payload, selector }) => {
      const dataTransfer = new DataTransfer();
      payload.forEach(file => dataTransfer.items.add(new File([new Uint8Array(file.bytes)], file.name)));
      const target = document.querySelector(selector);
      target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer }));
      const highlighted = document.querySelector('.file-picker').classList.contains('is-dragging');
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
      target.dispatchEvent(drop);
      return { highlighted, prevented: drop.defaultPrevented, cleared: !document.querySelector('.file-picker').classList.contains('is-dragging') };
    }, { payload, selector });
  };
  await test('Drop DOCX on picker child highlights, reads and converts without navigation', async () => {
    const url = page.url();
    assert.deepEqual(await dropFiles(['sample.docx']), { highlighted: true, prevented: true, cleared: true });
    await page.waitForFunction(() => !document.querySelector('#convert').disabled);
    assert.equal(await page.locator('#file-name').textContent(), 'sample.docx');
    assert((await convert()).includes('ทดสอบภาษาไทย')); assert.equal(page.url(), url);
  });
  await test('Drop XLSX anywhere on page including editor loads worksheet selector', async () => {
    await dropFiles(['sample.xlsx'], '#output');
    await page.waitForFunction(() => !document.querySelector('#convert').disabled);
    assert.equal(await page.locator('#file-name').textContent(), 'sample.xlsx');
    assert.equal(await page.locator('#sheet option').count(), 3);
    assert((await convert()).includes('2024-01-01'));
  });
  await test('Multiple-file drop is rejected without clearing current output', async () => {
    const before = await readHtml();
    await dropFiles(['sample.docx', 'sample.xlsx']);
    assert((await page.locator('#notice-list').textContent()).includes('one file at a time'));
    assert.equal(await readHtml(), before);
  });
  await test('Non-file text drag remains native and corrupt file drop reports error', async () => {
    assert.equal(await page.evaluate(() => {
      const dataTransfer = new DataTransfer(); dataTransfer.setData('text/plain', 'text');
      const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer });
      document.querySelector('#output').dispatchEvent(event); return event.defaultPrevented;
    }), false);
    await dropFiles(['corrupt.docx']);
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Unable to read file');
    assert((await page.locator('#notice-list').textContent()).includes('may be damaged'));
  });
  await selectFile('sample.docx');
  let html = await convert();
  await test('Syntax colors preserve exact text and never render source HTML', async () => {
    assert.equal(await page.locator('#code-highlight').textContent(), html + '\n');
    assert(await page.locator('#code-highlight .syntax-tag').count() > 0);
    assert(await page.locator('#code-highlight .syntax-attribute').count() > 0);
    assert(await page.locator('#code-highlight .syntax-value').count() > 0);
    assert.equal(await page.locator('#code-highlight img, #code-highlight a, #code-highlight script').count(), 0);
    const long = '<p>ไทย English <strong>bold</strong> &amp; text</p>\n'.repeat(120);
    await page.locator('#output').fill(long);
    await page.locator('#output').evaluate(el => { el.scrollTop = 250; el.dispatchEvent(new Event('scroll')); });
    const metrics = await page.evaluate(() => {
      const a = document.querySelector('#output'), b = document.querySelector('#code-highlight');
      return [a.scrollTop, b.scrollTop, a.clientWidth, b.clientWidth, getComputedStyle(a).lineHeight, getComputedStyle(b).lineHeight];
    });
    assert.equal(metrics[0], metrics[1]); assert.equal(metrics[2], metrics[3]); assert.equal(metrics[4], metrics[5]);
    assert.equal(await readHtml(), long);
    html = await convert();
  });
  await test('Convert controls precede images and remain visible while scrolling', async () => {
    const before = await page.locator('.source-actions').boundingBox();
    const images = await page.locator('#images').boundingBox();
    assert(before.y < images.y);
    await page.evaluate(y => window.scrollTo(0, y + 100), before.y);
    const pinned = await page.locator('.source-actions').boundingBox();
    assert(pinned.y >= 0 && pinned.y < 30, 'Action controls should stick near the viewport top');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(root, 'output/playwright', artifactPrefix + 'syntax-editor.png'), fullPage: true });
  });
  fs.writeFileSync(path.join(root, 'examples', 'docx-output.html'), html, 'utf8');
  await test('DOCX Thai/English and special characters escape once', () => {
    assert(html.includes('ทดสอบภาษาไทย English &amp; &lt; &gt; " \''));
    assert(!html.includes('&amp;amp;'));
  });
  await test('DOCX full/partial bold, adjacent strong merged, inline spacing retained', () => {
    assert(html.includes('<p><strong>ทั้งย่อหน้า Bold</strong></p>'));
    assert(html.includes('<p>ก่อน <strong>ตัวหนา</strong> หลัง</p>'));
  });
  await test('Links: website, tel normalization, mailto and unsafe href removed', () => {
    assert(html.includes('href="tel:021234567">02-123-4567</a>'));
    assert(html.includes('href="mailto:team@example.com">ส่งอีเมล</a>'));
    assert(html.includes('href="https://example.com/?a=1&amp;b=2" target="_blank">เว็บไซต์</a>'));
    assert(html.includes('unsafe')); assert(!html.includes('javascript:'));
    assert(!html.includes('tel:123456'));
  });
  await test('Actual DOCX numbering: consecutive and nested bullet/number lists', async () => {
    const structure = await page.evaluate(html => { const t = document.createElement('template'); t.innerHTML = html; return [t.content.querySelectorAll('ul.list-bullet').length, t.content.querySelectorAll('ol.list-number').length, !!t.content.querySelector('ul > li > ul'), !!t.content.querySelector('ol > li > ol')]; }, html);
    assert.deepEqual(structure, [2, 2, true, true]);
    assert((await page.locator('#notices').textContent()).includes('starting at 1'));
  });
  await test('DOCX merge expansion, rectangular table, single-row empty tbody', async () => {
    const counts = await page.evaluate(html => { const t = document.createElement('template'); t.innerHTML = html; return [...t.content.querySelectorAll('table')].map(table => [...table.rows].map(row => [...row.cells].map(c => c.textContent))); }, html);
    assert.deepEqual(counts, [[['H1','H2','H3'], ['Merged','','Value'], ['','','End']], [['Only header']]]);
    assert(html.includes('<tbody></tbody>')); assert(!/colspan|rowspan/.test(html));
  });
  await test('Empty paragraphs removed and soft line break becomes a space', () => {
    assert(!/<p>\s*(?:<strong>\s*<\/strong>)?\s*<\/p>/.test(html));
    assert(html.includes('บรรทัดหนึ่ง บรรทัดสอง'));
  });
  await test('DOCX image preview and placeholders default to one per row', async () => {
    assert.equal(await page.locator('#images img').count(), 4);
    assert.equal((html.match(/<figure /g) || []).length, 4);
    assert(!html.includes('col-md-')); assert(!/src="(?:blob:|data:)/.test(html));
  });
  for (const count of [2, 3]) await test(`Image grouping ${count} per row keeps text boundary`, async () => {
    await page.locator('#image-layout').selectOption(String(count));
    html = await convert();
    assert.equal((html.match(new RegExp('class="col-md-' + (count === 2 ? 6 : 4) + '"', 'g')) || []).length, count);
    assert(html.indexOf('IMAGE_003_URL') < html.indexOf('ข้อความคั่นรูป'));
    assert(html.indexOf('IMAGE_004_URL') > html.indexOf('ข้อความคั่นรูป'));
  });
  await test('Image URL validation and regeneration', async () => {
    await page.locator('#image-url-0').fill('javascript:alert(1)');
    html = await convert(); assert(html.includes('IMAGE_001_URL'));
    await page.locator('#image-url-0').fill('https://example.com/photo.jpg?a=1&b=2');
    html = await convert(); assert(html.includes('src="https://example.com/photo.jpg?a=1&amp;b=2"'));
  });
  await test('Generated DOCX passes allowlist', async () => assert.deepEqual(await page.evaluate(html => CMS.validate(html), html), []));
  await selectFile('sample.xlsx');
  await test('XLSX worksheet selector includes all sheets', async () => assert.deepEqual(await page.locator('#sheet option').allTextContents(), ['ข้อมูลหลัก', 'Single row', 'Empty']));
  html = await convert();
  fs.writeFileSync(path.join(root, 'examples', 'xlsx-output.html'), html, 'utf8');
  await test('XLSX displayed date, percent, leading zeros, cached and uncached formulas', () => {
    for (const expected of ['2024-01-01', '12.50%', '00007', '<td>3</td>', '=SUM(1,2)']) assert(html.includes(expected), expected);
  });
  await test('XLSX bold, rich text, hyperlink, special characters', () => {
    assert(html.includes('<th><strong>ชื่อ</strong></th>'));
    assert(html.includes('normal <strong>bold</strong>'));
    assert(html.includes('href="https://example.com/?a=1&amp;b=2" target="_blank">เว็บไซต์</a>'));
    assert(html.includes('ไทย &amp; English &lt; &gt; " \''));
  });
  await test('XLSX trimmed outer range, preserved internal blank row and expanded merge', async () => {
    const rows = await page.evaluate(html => { const t = document.createElement('template'); t.innerHTML = html; return [...t.content.querySelectorAll('tr')].map(r => [...r.cells].map(c => c.textContent)); }, html);
    assert.equal(rows.length, 6); assert(rows.every(r => r.length === 7));
    assert(rows[2].every(c => c === '')); assert.equal(rows[4][0], 'merged'); assert(rows[5].every(c => c === ''));
  });
  await test('XLSX warnings state missing formula result, merge and image limits', async () => {
    const text = await page.locator('#notices').textContent();
    assert(text.includes('G4')); assert(text.includes('merged cells')); assert(text.includes('Images, charts'));
  });
  await test('XLSX single-row and empty worksheet handling', async () => {
    await page.locator('#sheet').selectOption('Single row');
    const single = await convert(); assert(single.includes('<th>Only header</th>')); assert(single.includes('<tbody></tbody>'));
    await page.locator('#sheet').selectOption('Empty'); assert.equal(await convert(), ''); assert(await page.locator('#download').isDisabled());
  });
  await test('Security allowlist rejects all prohibited tags, attrs, classes, URLs and nesting', async () => {
    const bad = ['<p style="color:red">x</p>', '<script>alert(1)</script>', '<style>p{}</style>', '<p onclick="x()">x</p>', '<p class="unexpected">x</p>', '<a href="javascript:alert(1)">x</a>', '<a href="data:text/html,test">x</a>', '<a href="file:///x">x</a>', '<a href="https://example.com">x</a>', '<img class="img-fluid" src="blob:abc">', '<img class="img-fluid" src="data:image/png;base64,x">', '<svg><script>x</script></svg>', '<p><em>x</em></p>', '<p><strong> </strong></p>', '<a href="https://example.com" target="_blank"><a href="tel:123">nested</a></a>', '<p>x', '<p title="x">x</p>', '<!doctype html><html><body><p>x</p></body></html>', '<table class="table"><thead><tr><th colspan="2">x</th></tr></thead><tbody></tbody></table>'];
    const outcomes = await page.evaluate(bad => bad.map(s => CMS.validate(s)), bad);
    outcomes.forEach((errors, i) => assert(errors.length, bad[i]));
  });
  await test('Edited unsafe output cannot copy/download', async () => {
    await page.locator('#output').fill('<p onmouseover="alert(1)">bad</p>'); await page.locator('#download').click();
    assert((await page.locator('#status').textContent()).includes('Export blocked'));
  });
  const edited = '<p>แก้ไขแล้ว &amp; <strong>English</strong> " \'</p>\n';
  await test('UTF-8 download is byte-for-byte equal to edited textarea fragment', async () => {
    await page.locator('#output').fill(edited);
    const downloaded = page.waitForEvent('download'); await page.locator('#download').click();
    const download = await downloaded; assert.equal(fs.readFileSync(await download.path(), 'utf8'), edited);
  });
  await test('Real clipboard equals textarea text after Windows CRLF normalization', async () => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.locator('#copy').click();
    assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), edited);
  });
  await test('Clear revokes preview URLs and resets output, worksheets, buttons', async () => {
    await selectFile('sample.docx');
    await page.evaluate(() => { window.revoked = []; const original = URL.revokeObjectURL; URL.revokeObjectURL = value => { window.revoked.push(value); original.call(URL, value); }; });
    await page.locator('#clear').click();
    assert.equal((await page.evaluate(() => window.revoked)).length, 4);
    assert.equal(await readHtml(), ''); assert(await page.locator('#convert').isDisabled()); assert.equal(await page.locator('#images img').count(), 0);
  });
  await test('Corrupt and unsupported files display actionable errors', async () => {
    await selectFile('corrupt.docx'); assert((await page.locator('#notice-list').textContent()).includes('may be damaged'));
    await page.locator('#file').setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from('bad') });
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Unable to read file');
    assert((await page.locator('#notices').textContent()).includes('Only .docx'));
  });
  await page.locator('#clear').click();
  await page.screenshot({ path: path.join(root, 'output/playwright', artifactPrefix + 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(root, 'output/playwright', artifactPrefix + 'mobile.png'), fullPage: true });
  await test('Mobile layout has no horizontal overflow', async () => assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)));
  await test('No external network requests or uncaught JavaScript errors', () => { assert.deepEqual(result.networkRequests, []); assert.deepEqual(result.consoleErrors, []); });
  fs.writeFileSync(path.join(root, 'output/playwright', artifactPrefix + 'test-results.json'), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(`${result.passed.length} passed, ${result.failed.length} failed`);
  process.exitCode = result.failed.length ? 1 : 0;
})().catch(error => { console.error(error); process.exitCode = 1; });
