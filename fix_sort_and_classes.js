const fs = require('fs');
let content = fs.readFileSync('core-engine.js', 'utf8');
content = content.replace(/\.className = "item-list"/g, '.classList.add("item-list")');
content = content.replace(/\.className = "item-list empty-state"/g, '.classList.add("item-list", "empty-state")');
// Incomes order swap is already done mostly or not? Let's fix incomes order specifically:
content = content.replace(/getItemMonthKey\(a\) \+ String\(a\.day\)\.padStart\(2,'0'\)\)\.localeCompare\(getItemMonthKey\(b\) \+ String\(b\.day\)\.padStart\(2,'0'\)/g, "getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0')");
fs.writeFileSync('core-engine.js', content, 'utf8');
