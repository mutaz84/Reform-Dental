const fs = require('fs');

const html = fs.readFileSync('Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html', 'utf8');
const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
    i++;
    if (i !== 8) continue;
    const src = m[0].replace(/<script[^>]*>/i,'').replace(/<\/script>/i,'');
    const lines = src.split('\n');
    
    // Show last 5 lines with hex dumps
    console.log('Block 8: total lines =', lines.length);
    console.log('Block 8: total chars =', src.length);
    console.log('\nLast 5 lines:');
    for (let j = lines.length - 5; j < lines.length; j++) {
        const hex = Buffer.from(lines[j]).toString('hex').substring(0, 40);
        console.log((j+1) + ': [' + lines[j].substring(0, 50) + '] hex: ' + hex);
    }
    
    // Also check if `</script>` appears in the raw extracted content
    const rawBlock = m[0];
    const scriptTagPattern = /<\/script>/gi;
    let sm;
    let count = 0;
    while ((sm = scriptTagPattern.exec(rawBlock)) !== null) {
        count++;
        console.log('\nFound </script> at index', sm.index, 'in rawBlock, char context:', JSON.stringify(rawBlock.substring(sm.index-20, sm.index+20)));
        if (count > 3) break;
    }
    
    // Check if there might be </script> inside the src before the final one
    const scriptInSrc = /<\/script>/i.exec(src);
    if (scriptInSrc) {
        console.log('\nWARNING: </script> found inside extracted src at index', scriptInSrc.index);
    }
    
    // Show what's in the HTML right after block 8 ends
    const afterBlock = html.substring(m.index + m[0].length, m.index + m[0].length + 200);
    console.log('\nContent right after block 8:', JSON.stringify(afterBlock.substring(0, 200)));
}
