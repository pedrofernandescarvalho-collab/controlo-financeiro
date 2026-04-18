const fs = require('fs');
let content = fs.readFileSync('core-engine.js', 'utf8');

// Replace all instances of setting className to "item-list" where it's a container.
// Actually, I already changed them to classList.add in the previous script. Let's find those.
content = content.replace(/\.classList\.add\("item-list"\)/g, '.className = "item-list item-list-container"');
content = content.replace(/\.classList\.add\("item-list", "empty-state"\)/g, '.className = "item-list item-list-container empty-state"');

// Fix the toast fallback if any was accidentally hit
content = content.replace('toast.className = "item-list item-list-container"', 'toast.className = "toast"');
content = content.replace('container.className = "item-list item-list-container"\n  toast.className', 'container.className = "toast-container"\n  toast.className');

// Ensure sorting localeCompare is completely descending for incomes and expenses:
// I did: .sort((a, b) => (getItemMonthKey(b) + String(b.day).padStart(2,'0')).localeCompare(getItemMonthKey(a) + String(a.day).padStart(2,'0')));
// in the previous script. Let's make sure it's applied correctly everywhere.

fs.writeFileSync('core-engine.js', content, 'utf8');
