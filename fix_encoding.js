const fs = require('fs');

function fixFile(file) {
    const rawContent = fs.readFileSync(file, 'utf8');
    // Is it double-encoded? We can attempt to decode it.
    try {
        const decoded = Buffer.from(rawContent, 'latin1').toString('utf8');
        // Let's check if decoded looks better (e.g. has 'ç' or 'ã' without 'Ã')
        if (decoded.includes('ã') || decoded.includes('ç')) {
            console.log(`Fixing ${file}`);
            fs.writeFileSync(file, decoded, 'utf8');
        } else {
            console.log(`No clear fix for ${file}`);
        }
    } catch(e) {
        console.error(`Error on ${file}:`, e);
    }
}

['index.html', 'dashboard.html', 'extrato.html', 'configuracao.html', 'pro360.html', 'core-engine.js', 'style.css'].forEach(fixFile);
console.log('Done');
