# CMS Studio

Convert DOCX and XLSX documents into clean HTML fragments for a CMS. The interface, status messages, validation errors and user guide are in English. Source content stays in its original language, including Thai and English.

## Open locally

Extract the complete project ZIP, then open `index.html` in Microsoft Edge or Chrome. Keep the `js/` and `vendor/` folders alongside it. No installation, build or internet connection is required for local use.

Drop one `.docx` or `.xlsx` file anywhere on the workspace, choose your worksheet or image options, and click **Convert to HTML**. Review and edit the result, then **Copy HTML** or **Download .html**. Read `help.html` for the full user guide.

## Publish a link on Render

This project is a **Static Site**, not a Python Web Service. Render serves the application assets; conversion still happens in each visitor's browser. No document upload API, database, account system or environment secrets are required.

### Option A — Render dashboard

1. Put the contents of this `cms-file-to-html` folder in a Git repository. The repository should contain this app, not the surrounding Obsidian vault. Keep `index.html`, `help.html`, `styles.css`, `js/`, `vendor/`, `scripts/`, `package.json` and `render.yaml`.
2. Push that repository to your Git provider and connect it to Render.
3. In Render, select **New → Static Site** and choose the repository and branch.
4. Use the following settings:

| Render setting | Value |
| --- | --- |
| Name | `cms-studio` or your preferred available name |
| Root Directory | Leave blank if this app is at the repository root |
| Build Command | `node scripts/build.cjs` |
| Publish Directory | `dist` |

5. Create the Static Site and wait for deployment to complete. Render assigns an HTTPS `onrender.com` address. Share that address to use the converter from another device. The exact URL depends on the name assigned by Render.

If your repository keeps this project in a subfolder, set **Root Directory** to that folder, for example `cms-file-to-html` or `05 WebApp/cms-file-to-html`, depending on the actual repository layout. The build command and publish directory remain the same.

The `render.yaml` in the parent `05 WebApp` folder belongs to a different Python app. Use the `render.yaml` supplied inside this project for the static converter.

### Option B — Render Blueprint

Place this project's files, including `render.yaml`, at the root of its own Git repository. In Render, choose **New → Blueprint**, connect the repository, review the single Static Site and deploy it. The supplied Blueprint configures the build, publish directory and response headers.

For a monorepo Blueprint, set the service `rootDir` to the actual project subfolder and select the correct Blueprint path in Render. Do not replace the configuration of unrelated services.

Dashboard setup does not automatically apply the headers from the Blueprint file. If you use Option A, you can add the same headers from `render.yaml` in the site's Headers settings. The application also includes its content security policy in HTML metadata.

Official references: [Render Static Sites](https://render.com/docs/static-sites), [Blueprint specification](https://render.com/docs/blueprint-spec), [Static Site headers](https://render.com/docs/static-site-headers).

**Deployment status:** The files are prepared and tested locally. No Render account was connected and no public site has been deployed by this task. The local preview address is not a public sharing link.

## Other static hosts

Publish the contents of `dist/` to an HTTPS static host, or extract the separate `cms-studio-static.zip` and publish those files. The package has `index.html` at its root and includes its local dependencies. Relative asset links work from a domain root or a subdirectory. The app does not require a server runtime or SPA rewrite rules.

HTTPS is recommended for browser Clipboard access. The downloaded app still works through `file://`. A hosted page needs network access to load its application files; once loaded, document conversion itself does not require a network request. No service worker or offline cache is installed.

## Build and preview

Node.js 20 or later is needed for the optional build/preview commands. There are no npm build dependencies.

```powershell
npm run build
npm run preview
```

Open `http://127.0.0.1:8000`. Press Ctrl+C to stop the preview. An alternative port can be set with `PORT`.

The build recreates `dist/` from an explicit list of 12 public assets. It excludes source documents, test fixtures, test reports, screenshots, scripts, README files and deployment configuration. Do not put hand-authored files in `dist/`, because it is generated output.

## Privacy and cross-device behavior

- Files are parsed in the browser. The app never sends document contents to the host or another service.
- Embedded Word images use local blob previews. External CMS image URLs are written into exported HTML but are not fetched by the converter.
- Each browser has an independent, temporary workspace. Uploading a new file, refreshing or changing devices does not restore another session's documents or edited HTML.
- Clear workspace releases image previews and resets the state. No localStorage, cookies, analytics or document database is used by the app.
- A public hosted link lets anyone access the converter. It does not publish the documents they convert.

## Output rules

The output is a UTF-8 HTML fragment, without a DOCTYPE or html/head/body wrapper. Allowed tags are `p`, `strong`, `a`, `ul`, `ol`, `li`, `div`, `table-hint`, `table`, `thead`, `tbody`, `tr`, `th`, `td`, `figure` and `img`, with only the specified CMS classes and attributes.

- Bold text is preserved; unsupported formatting becomes plain text.
- Lists use `list-bullet` and `list-number`, with nested lists inside their parent list items.
- Website links require `target="_blank"`. Telephone and email links use tel/mailto without target. Unsupported protocols are removed with a warning; display text is kept.
- Tables use the required row/col-12/table-responsive wrappers, table-hint and table.table. The first row is thead/th; remaining rows are tbody/td. A one-row table has an empty tbody.
- Merged cells are expanded. Only the first cell keeps content; the covered cells are empty. No colspan or rowspan is exported.
- Images use the figure/grid structures. Add their CMS URLs manually. Missing URLs become `IMAGE_001_URL` placeholders and generate warnings.
- Export contains no styles, scripts, event handlers or additional attributes such as alt, rel or id. UI markup is not subject to the export allowlist.
- Block indentation is two spaces. Inline content stays together to preserve text spacing. Special characters are escaped once.
- Editable HTML is validated again before export. Invalid edits are rejected with an English explanation; the app does not silently rewrite the editor text.
- Downloads match the textarea as UTF-8 without a BOM. Windows Clipboard may normalize LF to CRLF. Copy has a fallback for restricted Clipboard permissions.
- Use complete closing tags, quoted attributes, amp/lt/gt/quot/apos or numeric entities. Use `&#160;` instead of `&nbsp;` when editing the HTML.

## Libraries and architecture

[JSZip 3.10.1](https://stuk.github.io/jszip/documentation/api_jszip/load_async.html) opens the OOXML archive. DOMParser reads the XML as data. DOCX numbering, relationships and table structure are read directly rather than inferred from visible bullets.

[SheetJS CE 0.20.3](https://docs.sheetjs.com/docs/getting-started/installation/standalone/) reads workbook values and number formats. Cell font and rich-text metadata are supplemented by direct XML parsing. See [cell objects](https://docs.sheetjs.com/docs/csf/cell/) and [parse options](https://docs.sheetjs.com/docs/api/parse-options/) for the library's capabilities.

```text
index.html               English converter workspace
help.html                English user guide
styles.css               Responsive navy/blue interface and dark HTML editor
js/core.js               Archive/XML helpers, intermediate model, renderer,
                         escaping, validation and formatting
js/docx.js               DOCX paragraphs, numbering, tables and images
js/xlsx.js               Worksheet data, formats, bold, rich text and merges
js/editor.js             Safe syntax coloring over the editable textarea
js/app.js                UI state, drag/drop, images, copy, download and reset
vendor/                  Bundled libraries and their licenses
scripts/build.cjs        Dependency-free build of public assets
scripts/serve.cjs        Local production preview server
render.yaml              Render Static Site Blueprint
package.json             Build, preview and test commands
examples/                HTML generated from test fixtures
tests/                   Repeatable OOXML fixtures and browser regression suite
output/playwright/       Browser test results and screenshots
dist/                    Generated public site, ready for static hosting
TEST-REPORT.md           Tested behavior and known coverage gaps
```

Conversion follows: file validation → ZIP/XML parsing → intermediate model → inert DOM → formatting/escaping → allowlist validation → editable output → export validation. Export DOM is not inserted into the live page, so creating image markup does not trigger a remote image request.

## Real limitations

### DOCX

- Main document XML order is preserved, not the Word page layout. Columns, pagination and floating images can differ. Inline images are separated into figures with a warning.
- Headers, footers, notes, equations, charts, SmartArt, attachments and altChunk are omitted. Some producer-specific OOXML is only partially supported.
- PNG, JPEG, GIF, WebP and BMP can be previewed if the browser can decode them. SVG, EMF, WMF, TIFF, missing and external images require manual CMS URLs. The app does not convert image formats.
- Grouped drawings may expose only the first image. Text box text is kept in XML order without its internal layout. AlternateContent uses its first branch with a warning.
- Track Changes includes inserted text and omits deleted text. Field-code links may retain only saved display text. Internal document anchors are outside the allowed link protocols.
- Standard bold inheritance is read; complex-script typography, conditional table styles and style-linked numbering are not fully emulated.
- Up to nine list levels are read. Skipped nesting levels are adjusted with warnings. Custom numbers become standard numbering starting at 1, and consecutive lists of the same kind are combined.

### XLSX

- Display values depend on the number formats supported by SheetJS; unusual locale, calendar and custom formatting may differ from Excel.
- Formulas are never calculated. Saved results may be stale; missing results are replaced by plain formula text and a cell-specific warning.
- Cell font bold and shared/inline rich-text bold are read. Row/column font inheritance, conditional formatting, themes, charts, images, comments, pivot layout and external workbook refresh are not reproduced.
- Hidden rows and columns in the data range are included. A HYPERLINK formula does not become a link without an actual hyperlink relationship.

### Size and browsers

Only .docx and .xlsx are supported, not .doc, .xls, macro-enabled files, CSV or encrypted/password-protected documents. Input limits are 25 MB, 150 MB unpacked/15,000 entries and 100,000 cells per table. Archive metadata checks reduce accidental overload but are not a sandbox for malicious archives.

Conversion runs on the main thread, so large or complex files may temporarily slow the page. No Web Worker or streaming conversion is implemented. Compare the output with the source before publishing.

## Test again

Normal use and builds need no Playwright installation. To run regression tests, use Python, Node.js, Microsoft Edge and Playwright:

```powershell
python tests/make-fixtures.py
npm install --no-save --package-lock=false playwright@1.62.1
npm test
```

To test the production build, run `npm run build` and `npm run preview`, then in another PowerShell window:

```powershell
$env:CMS_TEST_URL = 'http://127.0.0.1:8000/'
npm test
```

If Playwright is already installed elsewhere, set `NODE_PATH` to that node_modules directory. `BROWSER_CHANNEL=chrome` selects a locally installed Chrome instead of Edge. Fixtures and exported example content intentionally include Thai to verify source-language preservation.

JSZip is used under MIT (the upstream license also offers GPLv3); SheetJS uses Apache-2.0. Preserve the license files in `vendor/` when distributing the app.

