const fs = require('fs');
const acorn = require('acorn');

const src = fs.readFileSync('block8.js', 'utf8');
const lines = src.split('\n');

// Try adding closing braces/parens at intervals to isolate missing delimiter
// We know 1 "}" fixes it. Find WHERE it's missing.

// Strategy: scan for functions/blocks that might be unclosed
// Go through and track what's at each "depth" level
// Look for a function that opens but doesn't close

// Alternatively: find the line range where adding/removing content matters
// Do a bisection where we try src[0..N] + "}" and see when it stops working vs starts working

let lo = 0, hi = lines.length - 1;
while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const chunk = lines.slice(0, mid).join('\n') + '\n}';
    try {
        acorn.parse(chunk, { ecmaVersion: 2020, sourceType: 'script' });
        hi = mid; // Inserting } at mid works - unclosed thing starts at or after lo
    } catch(e) {
        lo = mid; // Inserting } at mid doesn't fix the error
    }
}

console.log('Missing closing } is most likely around lines', lo, 'to', hi);
for (let j = Math.max(0, lo-5); j <= Math.min(lines.length-1, hi+5); j++) {
    console.log((j+1) + ': ' + lines[j].substring(0, 100));
}
