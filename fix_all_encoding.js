const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'backups' || file === 'scratch' || file === 'node_modules' || file === '.git') continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
            fixFile(fullPath);
        }
    }
}

function fixFile(file) {
    const rawContent = fs.readFileSync(file, 'utf8');
    try {
        const decoded = Buffer.from(rawContent, 'latin1').toString('utf8');
        // Check if double encoding was present by looking for typical patterns
        if (rawContent.includes('ã') || rawContent.includes('ç') || rawContent.includes('ó') || rawContent.includes('í')) {
            console.log(`Fixing ${file}`);
            let newContent = decoded;
            if(newContent.includes('\uFFFD')) {
                newContent = newContent.split('\uFFFD').join('-');
            }
            fs.writeFileSync(file, newContent, 'utf8');
        }
    } catch(e) {}
}

processDir(__dirname);
console.log('All files processed');
