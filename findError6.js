const fs = require('fs');
const acorn = require('acorn');

const src = fs.readFileSync('block8.js', 'utf8');
const lines = src.split('\n');

// Find where the error transitions from "unexpected token at line X+1" to "unexpected token at line X"
// i.e., find the smallest N where error line <= N
// This means after N lines, the parser is waiting at or before line N

// Binary search for the actual broken line
// The acorn error position tells us WHERE it stopped - that should be close to the issue
// But with incremental testing, we want to find when error pos stops advancing

// Instead: try adding closing delimiters and see what fixes it
const tryWith = (extra) => {
    try {
        acorn.parse(src + extra, { ecmaVersion: 2020, sourceType: 'script' });
        return null;
    } catch(e) {
        return e.message;
    }
};

console.log('Add }:', tryWith('}'));
console.log('Add }}:', tryWith('}}'));
console.log('Add }}}:', tryWith('}}}'));
console.log('Add }}}}:', tryWith('}}}}'));
console.log('Add }}}}}:', tryWith('}}}}}'));
console.log('Add }}}}}}:', tryWith('}}}}}}'));
console.log('Add }}}}}}}:', tryWith('}}}}}}}'));
console.log('Add }):', tryWith('})'));
console.log('Add });:', tryWith('});'));
console.log('Add })}):', tryWith('})})'));
console.log('Add });}:', tryWith('});}'));
