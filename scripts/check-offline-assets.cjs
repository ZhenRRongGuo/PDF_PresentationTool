const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const required = [
  'vendor/pdfjs/3.2.146/pdf.min.js',
  'vendor/pdfjs/3.2.146/pdf.worker.min.js',
  'index.html',
  'presentation.html',
];

const missing = required.filter((file) => !fs.existsSync(path.join(dist, file)));
if (missing.length) {
  console.error(`Missing offline assets:\n- ${missing.join('\n- ')}`);
  process.exit(1);
}

const disallowed = /https?:\/\/(?:cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/i;
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(html|css|js)$/.test(entry.name)) files.push(file);
  }
}
walk(dist);

const violations = [];
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (disallowed.test(content)) violations.push(path.relative(dist, file));
}
if (violations.length) {
  console.error(`External runtime assets found:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log(`Offline asset check passed (${files.length} HTML/CSS/JS files scanned).`);
