const fs = require('fs');

global.localStorage = {
  getItem: () => JSON.stringify({ // state representation before the duplicate action
    snapshots: [
      { id: "old1", day: 1, accountId: "acc-1", bankBalance: 100, monthKey: "2026-04" },
      { id: "old2", day: 1, accountId: "acc-2", bankBalance: 50, monthKey: "2026-04" }
    ],
    accounts: [
      { id: "acc-1", name: "Conta A", balance: 100 },
      { id: "acc-2", name: "Conta B", balance: 50 }
    ],
    expenses: [],
    receivables: [],
    analysisMonth: "2026-04"
  }),
  setItem: (k, v) => { fs.writeFileSync('state_out.json', v); }
};

class DummyElement {
  constructor(id) { this.id = id; this.innerHTML = ''; this.value = ''; this.textContent = ''; this.className = ''; this.dataset = {}; this.appendChild = () => {}; }
  addEventListener() {}
  cloneNode() { return new DummyElement(); }
  querySelector() { return new DummyElement(); }
  getAttribute() { return "acc-1"; }
  insertBefore() {}
  remove() {}
}

const evHandlers = {};
global.document = {
  querySelector: (sel) => {
    if (sel.includes("template")) return { content: { firstElementChild: new DummyElement() } };
    const el = new DummyElement(sel);
    if(sel === "#snapshotDate") el.value = "2026-04-10";
    if(sel === "#dyn-global-cash-input") el.value = "0";
    if(sel === "#snapshot-form") {
       el.addEventListener = (ev, cb) => evHandlers[sel] = cb;
    }
    return el;
  },
  querySelectorAll: (sel) => {
     if(sel === ".dyn-bank-input") {
         const e1 = new DummyElement(); e1.getAttribute = () => "acc-1"; e1.value = "100";
         const e2 = new DummyElement(); e2.getAttribute = () => "acc-2"; e2.value = "50";
         return [e1, e2];
     }
     return [];
  },
  createElement: () => new DummyElement(),
  body: new DummyElement()
};
global.crypto = { randomUUID: () => Math.random().toString() };

const code = fs.readFileSync('script.js', 'utf8');
eval(code);

function printValues() {
  console.log("NET WORTH:", getGlobalAccountsTotal());
  console.log("SNAPSHOTS ARRAY LENGTH:", state.snapshots.length);
  const snapRes = getSnapshotsForMonth();
  console.log("GLOBAL SNAPSHOT DAYS:", snapRes);
}

console.log("--- BEFORE NEW REGISTRY ---");
printValues();

if (evHandlers["#snapshot-form"]) {
   console.log("\n--- TRIGGERING SUBMIT ---");
   evHandlers["#snapshot-form"]({ preventDefault: () => {} });
   printValues();
}

