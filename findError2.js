const fs = require('fs');
const acorn = require('acorn');

const html = fs.readFileSync('Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html', 'utf8');
const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
    i++;
    if (i !== 8) continue;
    const src = m[0].replace(/<script[^>]*>/i,'').replace(/<\/script>/i,'');
    try {
        acorn.parse(src, { ecmaVersion: 2020, sourceType: 'script' });
        console.log('Block 8: No errors');
    } catch(e) {
        console.log('Block 8 error at line', e.loc ? e.loc.line : '?', 'col', e.loc ? e.loc.column : '?');
        console.log('Message:', e.message);
        const lines = src.split('\n');
        const ln = (e.loc ? e.loc.line : 1) - 1;
        for (let j = Math.max(0, ln-5); j <= Math.min(lines.length-1, ln+5); j++) {
            console.log((j+1) + (j === ln ? ' >>>' : '    ') + ': ' + lines[j]);
        }
    }
}
