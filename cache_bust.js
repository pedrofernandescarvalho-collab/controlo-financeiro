const fs = require('fs');
let h = fs.readFileSync('pro360.html', 'utf8');
const ts = Date.now();
h = h.replace('src="script.js"', `src="script.js?v=${ts}"`);
h = h.replace('src="pro360.js"', `src="pro360.js?v=${ts}"`);
fs.writeFileSync('pro360.html', h, 'utf8');
console.log('Cache busters injected:', ts);
