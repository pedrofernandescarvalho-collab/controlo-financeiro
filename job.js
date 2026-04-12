const fs = require('fs');
const path = require('path');

// 1. Update script.js
const scriptPath = 'script.js';
if (fs.existsSync(scriptPath)) {
    let c = fs.readFileSync(scriptPath, 'utf8');

    const target = `    // Distribuir para o contentor correto baseado no tipo
    if (expense.kind !== "fixed" && variableContainer) {
        variableContainer.classList.remove("empty-state");
    variableContainer.classList.add("item-list");
        variableContainer.appendChild(node);
    }`;

    const replacement = `    // Distribuir para o contentor geral
    if (variableContainer) {
        if (expense.kind === "fixed") {
            node.querySelector(".item-title").innerHTML += ' <span class="badge" style="font-size:0.65rem; opacity:0.9; margin-left:6px; background:rgba(13, 148, 136, 0.1); border: 1px solid rgba(13,148,136,0.3); color: var(--primary); padding:2px 6px; border-radius:4px;">Fixa</span>';
        }
        variableContainer.classList.remove("empty-state");
        variableContainer.classList.add("item-list");
        variableContainer.appendChild(node);
    }`;

    c = c.replace(target, replacement);
    fs.writeFileSync(scriptPath, c);
}

// 2. Update HTML files
const files = ['dashboard.html', 'extrato.html', 'configuracao.html', 'index.html'];
files.forEach(file => {
    if (fs.existsSync(file)) {
        let hc = fs.readFileSync(file, 'utf8');
        
        hc = hc.replace(/class="([^"]*item-list[^"]*)"/g, (match, cls) => {
            if (!cls.includes('item-list-container') && cls.includes('item-list')) {
                return `class="${cls} item-list-container"`;
            }
            return match;
        });
        
        fs.writeFileSync(file, hc);
    }
});

console.log('Success');
