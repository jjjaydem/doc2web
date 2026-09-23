# V2 validation — 2026-09-23

Microsoft Edge / Chromium, file mode:
- Original conversion regression: 35/35 passed.
- Preview/mapping integration suite passed: live editing, inactive links, tables, count validation, unsafe URL rejection, review before mutation, edit invalidation, applied URLs in exported markup, invalid HTML preview blocking, unknown-image placeholders, clear/reset, mobile overflow and no remote requests or uncaught errors.
- Build: 17 public assets, no custom rule modules.
- Screenshots: output/playwright/preview-desktop.png and preview-mobile.png.

No public deployment, real CMS styling comparison or real customer-document acceptance test performed. Preview uses local source images, not downloaded CMS images.
