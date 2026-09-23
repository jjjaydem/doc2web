/* Dependency-free static build. Only application assets are published. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (output !== path.join(root, 'dist')) throw Error('Unexpected build output path');
// dist is generated output owned by this script, never the source workspace.
fs.mkdirSync(output, { recursive: true });
// Keep the directory itself: sync clients can hold an open handle to it.
for (const entry of fs.readdirSync(output)) {
  const target = path.resolve(output, entry);
  if (!target.startsWith(output + path.sep)) throw Error('Unexpected build entry');
  fs.rmSync(target, { recursive: true, force: true });
}
const files = [
  'index.html', 'help.html', 'styles.css',
  'favicon.ico', 'assets/favicon.svg', 'assets/favicon-32.png',
  'assets/apple-touch-icon.png', 'assets/social-preview.png',
  'js/core.js', 'js/docx.js', 'js/xlsx.js', 'js/editor.js', 'js/app.js',
  'vendor/jszip.min.js', 'vendor/xlsx.full.min.js',
  'vendor/LICENSE-JSZip.txt', 'vendor/LICENSE-SheetJS.txt'
];
for (const file of files) {
  const destination = path.join(output, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(path.join(root, file), destination);
}
console.log(`Built ${files.length} public assets in ${output}`);
