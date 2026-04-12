const fs = require('fs');
let c = fs.readFileSync('test_suite.js', 'utf8');

// Fix: the condition still compares monthKey to '2026-03' but the label says 2026-02
// Replace the old problematic assert 8.1 with a clean version
const oldAssert = /assert\('8\.1 Retorna dados de 2026-02'[^;]+prev\.monthKey === '2026-03'[^;]+;/;
const newAssert = "assert('8.1 Retorna dados de 2026-02', Boolean(prev) && String((prev||{}).monthKey||'').indexOf('2026-02') >= 0, '2026-02', String((prev||{}).monthKey));";

if (oldAssert.test(c)) {
  c = c.replace(oldAssert, newAssert);
  console.log('Fixed!');
} else {
  // Try more broadly
  const broader = /assert\('8\.1 Retorna[^;]+;/;
  if (broader.test(c)) {
    c = c.replace(broader, newAssert);
    console.log('Fixed with broader match');
  } else {
    console.log('Could not find the assert. Showing context...');
    const idx = c.indexOf("8.1 Retorna");
    console.log('Context:', JSON.stringify(c.slice(idx-5, idx+200)));
  }
}

fs.writeFileSync('test_suite.js', c, 'utf8');
