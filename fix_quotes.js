const fs = require('fs');
let c = fs.readFileSync('charts.js', 'utf8');
c = c.split('\\"').join('"');
fs.writeFileSync('charts.js', c);
console.log('Fixed charts.js quotes');
