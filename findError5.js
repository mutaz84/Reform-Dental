const fs = require('fs');
const acorn = require('acorn');

const src = fs.readFileSync('block8.js', 'utf8');
const lines = src.split('\n');

// Check what error we get for various slices around the transition
for (const n of [14148, 14149, 14150, 14151, 14152, 14153, 14154, 14155, 14156, 14157, 14158]) {
    const chunk = lines.slice(0, n).join('\n');
    try {
        acorn.parse(chunk, { ecmaVersion: 2020, sourceType: 'script' });
        console.log('Lines 0..' + n + ': OK (no error)');
    } catch(e) {
        console.log('Lines 0..' + n + ': ERROR - ' + e.message.substring(0, 80));
    }
}
