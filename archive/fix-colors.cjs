const fs = require('fs');
function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.html')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign');
files.forEach(f => {
    if(f.includes('node_modules') || f.includes('.git')) return;
    let d = fs.readFileSync(f, 'utf8');
    let original = d;
    ['gray', 'slate', 'zinc', 'stone'].forEach(color => {
        const regex = new RegExp(`(?<=[\\s"'\`])(text|bg|border|ring|divide|from|to|via|placeholder|hover:bg|hover:text|hover:border|focus:bg|focus:text|focus:border|active:bg|active:text|active:border)-${color}-`, 'g');
        d = d.replace(regex, `$1-neutral-`);
    });
    // also catch the ones at the start of a string or after a colon like in template literals or object keys
    ['gray', 'slate', 'zinc', 'stone'].forEach(color => {
        const regex2 = new RegExp(`\\b(text|bg|border|ring|divide|from|to|via|placeholder|hover:bg|hover:text|hover:border|focus:bg|focus:text|focus:border|active:bg|active:text|active:border)-${color}-`, 'g');
        d = d.replace(regex2, `$1-neutral-`);
    });
    
    if (d !== original) {
        fs.writeFileSync(f, d, 'utf8');
    }
});
console.log('Replaced all gray/slate/zinc/stone with neutral');
