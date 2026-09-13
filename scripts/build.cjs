/* Dependency-free static build. Only application assets are published. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (output !== path.join(root, 'dist')) throw Error('Unexpected build output path');
// dist is generated output owned by this script, never the source workspace.
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const files = [
  'index.html', 'help.html', 'styles.css',
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
