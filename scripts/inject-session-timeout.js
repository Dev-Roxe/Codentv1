/**
 * inject-session-timeout.js
 * Inject <script src="../scripts/session-timeout.js"></script>
 * into all protected HTML views (not login or register).
 *
 * Run with: node scripts/inject-session-timeout.js
 */

const fs = require('fs');
const path = require('path');

const VIEWS_DIR = path.join(__dirname, '..', 'src', 'renderer', 'views');

// Views that should NOT have session timeout (unauthenticated pages)
const EXCLUDED = new Set(['login.html', 'register.html']);

const SCRIPT_TAG = '  <script src="../scripts/session-timeout.js"></script>\n';
const MARKER = 'session-timeout.js';

const files = fs.readdirSync(VIEWS_DIR).filter(f => f.endsWith('.html') && !EXCLUDED.has(f));

let injected = 0;
let skipped = 0;

for (const file of files) {
    const fullPath = path.join(VIEWS_DIR, file);
    let content = fs.readFileSync(fullPath, 'utf8');

    if (content.includes(MARKER)) {
        console.log(`  SKIP  (already injected): ${file}`);
        skipped++;
        continue;
    }

    // Insert before the last </body>
    const bodyClose = content.lastIndexOf('</body>');
    if (bodyClose === -1) {
        console.log(`  WARN  (no </body> found):  ${file}`);
        continue;
    }

    content = content.slice(0, bodyClose) + SCRIPT_TAG + content.slice(bodyClose);
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`  OK    Injected into:        ${file}`);
    injected++;
}

console.log(`\nDone. Injected: ${injected} | Already present: ${skipped}`);
