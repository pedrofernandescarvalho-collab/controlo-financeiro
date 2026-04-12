const fs = require('fs');
let c = fs.readFileSync('script.js', 'utf8');

c = c.replace(/\.className\s*=\s*['"]item-list empty-state['"]/g, '.classList.add("item-list", "empty-state")');
c = c.replace(/([a-zA-Z0-9_]+)\.className\s*=\s*['"]item-list['"]/g, '$1.classList.remove("empty-state");\n    $1.classList.add("item-list")');

fs.writeFileSync('script.js', c);
console.log('Fixed script.js classes');
