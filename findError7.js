const fs = require('fs');
const src = fs.readFileSync('block8.js', 'utf8');
const lines = src.split('\n');

// Find the line where 8-space indentation starts around the kanban section
// Scan backwards from line 14132 to find what opens at 8-space indent
for (let i = 14131; i >= 0; i--) {
    const line = lines[i];
    const trimmed = line.trimEnd();
    // Look for a line with 8 spaces of indent and a { that could be the outer block
    if (trimmed.match(/^        [^\s]/) && trimmed.endsWith('{')) {
        console.log('Possible opening block at line', (i+1) + ':', trimmed.substring(0, 80));
        if (i < 14100) break; // Found enough context
    }
}

console.log('\nLines 14070-14090:');
for (let j = 14069; j < 14090; j++) {
    console.log((j+1) + ': ' + lines[j]);
}
