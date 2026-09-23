# DocToWeb V2 — Article preview and bulk image URLs

Open index.html directly, or run `node scripts/build.cjs` then `node scripts/serve.cjs` for local preview on port 8002. V1 is separate and unchanged.

## Workflow
1. Load a DOCX/XLSX and convert. HTML and the article preview appear together on wide screens; preview sits below HTML on smaller screens.
2. Edit HTML to update the preview. Invalid markup pauses and clears the preview. Copy/download still validate the HTML.
3. For Word images, expand Paste multiple image URLs. Paste one http(s) URL per image in document order. Blank lines are ignored.
4. Review matching shows image thumbnails, names and URLs without changing any fields. Counts must match exactly and every URL must be valid.
5. Apply URLs replaces all image URL fields and clears the current output, including manual edits. Convert again to regenerate HTML. You can still edit individual URL fields.

Preview is approximate: the CMS controls final styling. Links are inactive. Known images use original local document blobs; remote CMS URLs are never fetched. Unknown image sources show a labelled placeholder. Editing HTML does not change the original Word file.

The previous custom HTML rules feature was removed. No rule scripts or custom tag mappings remain active. Existing browser rule storage is unused. No batch image resizing or renaming is included.

Publish contents of dist to a separate static site when ready. V2 has not been deployed publicly; add canonical/social URLs for its actual address before publishing.

Tests: tests/browser-smoke.cjs (original conversion regression) and tests/preview-smoke.cjs (V2 preview/mapping). Both use installed Playwright and Microsoft Edge.

Build adds content hashes to CSS/JS URLs to prevent stale assets after deployment. Upload every file/folder INSIDE dist to the GitHub Pages publishing root, preserving js, vendor and assets folders. Do not upload the ZIP itself as the website.
