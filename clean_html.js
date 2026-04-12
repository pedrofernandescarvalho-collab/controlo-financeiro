const fs = require('fs');
const files = ['configuracao.html', 'dashboard.html', 'extrato.html', 'investimentos.html', 'index.html'];

const fixHtml = (filename) => {
    if (!fs.existsSync(filename)) return;
    
    let content = fs.readFileSync(filename, 'utf8');

    // 1. Remove PowerShell or accidental injections
    content = content.replace(/\`n/g, '');
    content = content.replace(/\`r/g, '');
    
    // 2. Fix the specific "Configurao" corruption (common in my previous view)
    content = content.replace(/Configurao/g, 'Configuração');
    content = content.replace(/Configurao/g, 'Configuração');
    content = content.replace(/Configurao/g, 'Configuração');

    // 3. Fix NavBar icons and text to be consistent and correct
    const navPatterns = [
        { from: /<a href="index.html" class="nav-link(.*?)">Registos<\/a>/g, to: '<a href="index.html" class="nav-link$1">Registos</a>' },
        { from: /<a href="dashboard.html" class="nav-link(.*?)">Dashboards<\/a>/g, to: '<a href="dashboard.html" class="nav-link$1">Dashboards</a>' },
        { from: /<a href="extrato.html" class="nav-link(.*?)">Extrato<\/a>/g, to: '<a href="extrato.html" class="nav-link$1">Extrato</a>' },
        { from: /<a href="investimentos.html" class="nav-link(.*?)">Investimentos<\/a>/g, to: '<a href="investimentos.html" class="nav-link$1">Investimentos</a>' },
        { from: /<a href="configuracao.html" class="nav-link(.*?)">.*?<\/a>/g, to: '<a href="configuracao.html" class="nav-link$1">Configuração</a>' }
    ];
    
    navPatterns.forEach(p => {
        content = content.replace(p.from, p.to);
    });

    // Fix the sync button icon
    content = content.replace(/<span class="sync-icon">.*?<\/span>/g, '<span class="sync-icon">🔄</span>');

    // 4. Script management: Remove any duplicate or badly formatted google-drive-sync
    // Remove all versions we might have added
    content = content.replace(/<script src="google-drive-sync\.js"><\/script>/gi, '');
    content = content.replace(/<script src='google-drive-sync\.js'><\/script>/gi, '');
    
    // Ensure it's added cleanly before </body>
    if (content.includes('</body>')) {
        content = content.replace('</body>', '<script src="google-drive-sync.js"></script>\n</body>');
    }

    // 5. Clean up any trailing backticks or garbage at the very end of file
    content = content.trim();
    if (content.endsWith('`') || content.endsWith('`n')) {
        content = content.substring(0, content.lastIndexOf('<')); // Hacky but safe if we know the last tag is </html>
        // Safer approach:
        const lastHtml = content.lastIndexOf('</html>');
        if (lastHtml !== -1) {
            content = content.substring(0, lastHtml + 7);
        }
    }

    fs.writeFileSync(filename, content, 'utf8');
    console.log(`Ficheiro ${filename} limpo com sucesso.`);
};

files.forEach(fixHtml);
console.log('--- Limpeza concluída ---');
