# CMS Studio — verification report

Date: 11 September 2026

## Latest result

**33 passed / 0 failed in each mode (66 passing executions):**

- Local `file://`, opening source `index.html` directly.
- HTTP production preview at `http://127.0.0.1:8000/`, serving the generated `dist/` assets.

Environment: Windows, Microsoft Edge / Chromium, headless Playwright 1.62.1. The same regression suite ran in both modes. Actual public Render deployment has not been performed.

Evidence:

- `output/playwright/test-results.json`
- `output/playwright/hosted-test-results.json`
- `output/playwright/desktop.png` and `mobile.png`
- `output/playwright/hosted-desktop.png` and `hosted-mobile.png`

The desktop (1440 px) and mobile (390 px) screenshots of the English redesign were opened and visually inspected. The design has a navy/blue interface and dark HTML editor. No horizontal overflow was detected on the mobile viewport.

## Verified behavior

1. Application and bundled JSZip/SheetJS libraries load without external dependencies.
2. The interface and user guide use English; navigation to the guide and back works.
3. DOCX file drops on a child element of the drop zone highlight the zone, read the file, convert it and do not navigate away.
4. XLSX files dropped onto the HTML editor are read and expose the worksheet selector.
5. Multiple-file drops are rejected while preserving the current output.
6. Plain-text drag events retain native behavior; corrupt document drops show an error.
7. Thai and English DOCX content, ampersands, angle brackets and quotes escape correctly without double escaping.
8. Whole-paragraph and partial bold text are preserved; adjacent strong elements merge without changing inline spacing.
9. Website, normalized telephone and email links work. Unsafe links retain only their text. General numbers are not automatically treated as telephone numbers.
10. Real DOCX numbering definitions produce consecutive and nested bullet and number lists; special numbering produces a warning.
11. DOCX horizontal/vertical merged cells expand into a rectangular table. Single-row tables include an empty tbody.
12. Empty paragraphs, including empty bold paragraphs, are removed. Soft line breaks become spaces.
13. Four embedded Word image occurrences produce local previews and export placeholders, defaulting to one image per row.
14. Two-image rows respect intervening text boundaries.
15. Three-image rows respect intervening text boundaries.
16. Invalid image URLs produce placeholders and warnings. Valid URLs are escaped and regenerated correctly.
17. Generated DOCX output passes the HTML allowlist validator.
18. All three XLSX worksheets appear in the selector.
19. Formatted dates, percentages, leading zeros, saved formula results and missing-result formula text are preserved as tested.
20. XLSX cell bold, inline rich-text bold, hyperlinks and special characters are preserved.
21. Outer whitespace is trimmed while internal blank rows and expanded merge ranges remain intact.
22. Worksheet notes identify missing formula results, merged cells and unsupported images/charts.
23. A one-row worksheet produces an empty tbody; an empty worksheet disables export.
24. Disallowed tags, attributes, classes, protocols, inline styles, scripts, handlers, document wrappers, nested links, incomplete markup and colspan are rejected.
25. Unsafe HTML manually entered in the editor cannot be exported.
26. A downloaded UTF-8 file matches the edited textarea byte-for-byte.
27. The real browser Clipboard matches the edited text after Windows CRLF/LF normalization.
28. Clearing releases all four preview blob URLs and resets controls and output.
29. Corrupt and unsupported file selections show English errors.
30. The mobile layout has no horizontal overflow.
31. No uncaught JavaScript errors or external HTTP(S) requests occur. In HTTP mode, same-origin requests for application assets are expected and excluded from the external-request check.

The drag tests use real browser File/DataTransfer objects and dispatched DragEvents; they do not physically drag from Windows Explorer with a mouse. Source-language preservation is intentional: fixture documents and converted HTML still contain Thai even though the interface is English.

## Build and hosting preparation

The dependency-free Node build produces 12 explicitly allowlisted public files: two HTML pages, CSS, five app scripts, two vendor scripts and two licenses. The generated site excludes fixtures, examples, screenshots, reports and deployment/build scripts.

The supplied Render Blueprint uses `runtime: static`, `node scripts/build.cjs` and `staticPublishPath: ./dist`. Hosting instructions were checked against the official Render Static Sites, Blueprint and response-header documentation. Configuration preparation and local HTTP verification do not establish that a Render service has been deployed.

## Earlier issues resolved

- Export image nodes originally attempted to request external URLs. Creating them in an inert document fixed this; both test modes report no external requests.
- Cells containing only bold text originally gained unnecessary formatting newlines. Inline-only cell content now stays on one line.
- Clipboard on Windows normalizes line endings. Tests compare its actual text after CRLF normalization; downloaded bytes remain an exact match.
- The original file selector had no drag-and-drop handling. Both picker and drop entry points now use the same file-loading function, with file-only event interception.

## Not tested or not supported

- Public Render deployment, account authorization, Git-provider connection, domain configuration or public HTTPS behavior. These remain deployment steps for the user.
- Real business documents supplied by the user; only requirements were provided. Fixtures are deterministic OOXML archives generated with the Python standard library.
- Opening/resaving fixtures in Word, Excel, LibreOffice or other document editors.
- Firefox, Safari, iOS, Android or Chrome directly. Mobile coverage is an Edge viewport simulation.
- Clipboard-denied fallback behavior, organizational browser policies, screen-reader behavior or a full accessibility audit.
- Rapid file switching, files near the size limits, adversarial archives, performance benchmarks and fuzz testing.
- Every OOXML variant, complex-script bold, grouped/floating drawings, advanced numbering, conditional formatting or layout fidelity. Supported limitations are documented in the English guide and README.
- Actual rendering inside the target CMS; the app expects the specified CSS classes to be available there.

Examples generated by the suite are in `examples/docx-output.html` and `examples/xlsx-output.html`. Word image placeholders are intentionally left in the example to demonstrate the URL replacement workflow.

Latest editor update: two additional cases verify syntax text fidelity, safe text-only highlighting, matching scroll/width/line-height, and Convert/Clear controls above images that remain pinned during page scrolling. The populated syntax-editor screenshot was visually inspected.
2026-09-15 phone update: Latest local file:// regression run passed 34/34. Added coverage for plain Thai/international phone numbers, phone labels across bold runs, preserving identifiers and URL paths, and export validation. Previous HTTP results above belong to the preceding version; HTTP was not rerun for this patch. Test titles now match the current DocToWeb branding. Build retains the generated dist directory itself to avoid directory-handle errors from file sync software.
2026-09-15 branding update: 35/35 local browser tests passed. Verified favicon metadata, absolute Open Graph image URL and dimensions, Twitter large-image card, and byte equality of source/dist branding assets. Social preview PNG was visually inspected. Public deployment and third-party link preview cache refresh were not performed.
