const fs = require('fs');

const files = ['dashboard.html', 'extrato.html', 'configuracao.html', 'pro360.html'];

files.forEach(f => {
    let lines = fs.readFileSync(f, 'utf8').split('\n');
    let seenScripts = new Set();
    
    // Reverse iterate to keep the last duplicate (which usually has the full cluster + firebase)
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (line.includes('<script src="core-engine.js"></script>') || 
            line.includes('<script src="charts.js"></script>') ||
            line.includes('<script src="pro360.js"></script>') ||
            line.includes('<script src="firebase-config.js"></script>') ||
            line.includes('<script type="module" src="firebase-sync.js"></script>')) {
            
            const match = line.trim();
            if (seenScripts.has(match)) {
                // Remove this duplicate line
                lines.splice(i, 1);
            } else {
                seenScripts.add(match);
            }
        }
    }
    
    fs.writeFileSync(f, lines.join('\n'));
    console.log(f + ' deduplicated');
});
