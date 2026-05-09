const fs = require('fs');

const html = fs.readFileSync('Update12152025_Manage Roles-Equimpent-Task-Insturments-Supplies-Scheduling System Updated.html', 'utf8');
const re = /<script(?:\s[^>]*)?>[\s\S]*?<\/script>/gi;
let m, i = 0;
while ((m = re.exec(html)) !== null) {
    i++;
    if (i !== 8) continue;
    const src = m[0].replace(/<script[^>]*>/i,'').replace(/<\/script>/i,'');
    fs.writeFileSync('block8.js', src, 'utf8');
    console.log('Written block8.js, length:', src.length, 'chars');
}
