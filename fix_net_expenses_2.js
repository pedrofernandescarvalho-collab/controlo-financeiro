const fs = require('fs');
let c = fs.readFileSync('script.js', 'utf8');

// sumExpensesUntil
c = c.replace(
  /\.reduce\(\(total, expense\) => total \+ Number\(expense\.amount \|\| 0\), 0\);/g,
  '.reduce((total, expense) => total + getNetExpenseAmount(expense), 0);'
);

// getFlexibleSpentInPeriod
c = c.replace(
  /\.reduce\(\(s, e\) => s \+ Number\(e\.amount \|\| 0\), 0\);/g,
  '.reduce((s, e) => s + getNetExpenseAmount(e), 0);'
);

// getDailySpendingData
c = c.replace(
  /if \(d <= daysInMonth\) spending\[d-1\] \+= Number\(e\.amount \|\| 0\);/g,
  'if (d <= daysInMonth) spending[d-1] += getNetExpenseAmount(e);'
);

fs.writeFileSync('script.js', c);
console.log('Fixed script.js');
