const fs = require('fs');

['index.html', 'dashboard.html', 'extrato.html', 'configuracao.html', 'pro360.html', 'core-engine.js', 'firebase-sync.js', 'style.css'].forEach(f => {
    try {
        let c = fs.readFileSync(f, 'utf8');
        if(c.includes('\uFFFD')) {
            c = c.split('\uFFFD').join('-');
            fs.writeFileSync(f, c);
            console.log(f + ' fixed UFFFD');
        }
    } catch(e){}
});
