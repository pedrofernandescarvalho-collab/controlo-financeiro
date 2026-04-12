import os, re

# 1. Update script.js
path = 'script.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Make fixed expenses show in the general expenses container
target = '''    // Distribuir para o contentor correto baseado no tipo
    if (expense.kind !== "fixed" && variableContainer) {
        variableContainer.classList.remove("empty-state");
    variableContainer.classList.add("item-list");
        variableContainer.appendChild(node);
    }'''

replacement = '''    // Distribuir para o contentor geral
    if (variableContainer) {
        if (expense.kind === "fixed") {
            node.querySelector(".item-title").innerHTML += ' <span class="badge badge-primary" style="font-size:0.65rem; opacity:0.8; margin-left:6px; background:rgba(13, 148, 136, 0.1); color: var(--primary); padding:2px 6px; border-radius:4px;">Fixa</span>';
        }
        variableContainer.classList.remove("empty-state");
        variableContainer.classList.add("item-list");
        variableContainer.appendChild(node);
    }'''

c = c.replace(target, replacement)
with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

# 2. Update HTML files to add item-list-container to all item-lists
for file in ['dashboard.html', 'extrato.html', 'configuracao.html', 'index.html']:
    if os.path.exists(file):
        with open(file, 'r', encoding='utf-8') as f:
            hc = f.read()
            
        def replacer(match):
            cls = match.group(1)
            if 'item-list-container' not in cls and 'item-list' in cls:
                cls += ' item-list-container'
            return 'class="' + cls + '"'
            
        hc = re.sub(r'class="([^"]*item-list[^"]*)"', replacer, hc)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(hc)

print('Success')
