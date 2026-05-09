const fs = require('fs');
const html = fs.readFileSync('Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html', 'utf8');
const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
    i++;
    if (i !== 8) continue;
    const src = m[0].replace(/<script[^>]*>/i,'').replace(/<\/script>/i,'');
    
    let line = 1;
    let state = 'code';
    let templateDepth = 0;
    let parenDepth = 0, braceDepth = 0;
    let lastOpenParen = null, lastOpenBrace = null;
    // Track all open positions
    let parenStack = [], braceStack = [];
    
    for (let k = 0; k < src.length; k++) {
        const c = src[k];
        const nc = src[k+1];
        if (c === '\n') line++;
        
        if (state === 'code') {
            if (c === '/' && nc === '/') { state = 'linecomment'; k++; }
            else if (c === '/' && nc === '*') { state = 'blockcomment'; k++; }
            else if (c === "'") state = 'sq';
            else if (c === '"') state = 'dq';
            else if (c === '`') { state = 'tpl'; templateDepth++; }
            else if (c === '(') { parenDepth++; parenStack.push(line); }
            else if (c === ')') { parenDepth--; if (parenStack.length) parenStack.pop(); }
            else if (c === '{') { braceDepth++; braceStack.push(line); }
            else if (c === '}') { braceDepth--; if (braceStack.length) braceStack.pop(); }
        } else if (state === 'sq') {
            if (c === '\\') k++;
            else if (c === "'") state = 'code';
        } else if (state === 'dq') {
            if (c === '\\') k++;
            else if (c === '"') state = 'code';
        } else if (state === 'tpl') {
            if (c === '\\') k++;
            else if (c === '`') { state = 'code'; templateDepth--; }
            else if (c === '$' && nc === '{') { state = 'code'; k++; braceDepth++; braceStack.push(line); }
        } else if (state === 'linecomment') {
            if (c === '\n') state = 'code';
        } else if (state === 'blockcomment') {
            if (c === '*' && nc === '/') { state = 'code'; k++; }
        }
    }
    
    console.log('Final state:', state);
    console.log('Template depth:', templateDepth);
    console.log('Paren depth:', parenDepth);
    console.log('Brace depth:', braceDepth);
    if (parenStack.length > 0) console.log('Last unclosed parens at lines:', parenStack.slice(-5));
    if (braceStack.length > 0) console.log('Last unclosed braces at lines:', braceStack.slice(-5));
    
    // Try to report which function/area has the last unclosed brace
    const srcLines = src.split('\n');
    if (braceStack.length > 0) {
        const lastBraceLine = braceStack[braceStack.length-1];
        console.log('\nLast unclosed brace context:');
        for (let j = Math.max(0, lastBraceLine-3); j <= Math.min(srcLines.length-1, lastBraceLine+3); j++) {
            console.log((j+1) + ': ' + srcLines[j]);
        }
    }
}
