const fs = require('fs');
const acorn = require('acorn');

const src = fs.readFileSync('block8.js', 'utf8');

// Count backticks naively (simplified count)
let backtickCount = 0;
for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 96) backtickCount++;
}
console.log('Total backtick chars:', backtickCount, '-> is odd:', backtickCount % 2 !== 0);

// Binary search to find first position where acorn reports "unexpected end of input"
const lines = src.split('\n');
let lo = 0, hi = lines.length;
while (hi - lo > 10) {
    const mid = Math.floor((lo + hi) / 2);
    const chunk = lines.slice(0, mid).join('\n');
    try {
        acorn.parse(chunk, { ecmaVersion: 2020, sourceType: 'script' });
        lo = mid; // no error: first mid lines are complete
    } catch(e) {
        if (e.message && e.message.includes('Unexpected end')) {
            hi = mid; // end-of-input error: unclosed structure in first mid lines
        } else {
            // Different error - might be that partial code has other issues
            // Treat as "complete enough" and move forward
            lo = mid;
        }
    }
}
console.log('\nTransition at line range:', lo, 'to', hi);
console.log('Lines around transition:');
for (let j = Math.max(0, lo-3); j <= Math.min(lines.length-1, Math.min(hi+3, lo+10)); j++) {
    console.log((j+1) + ': ' + lines[j].substring(0, 100));
}
