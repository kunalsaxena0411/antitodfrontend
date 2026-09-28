const fs = require('fs');
const path = require('path');

const demoDir = path.join(__dirname, 'src', 'data', 'demo');

// Fix actors.ts
const actorsPath = path.join(demoDir, 'actors.ts');
if (fs.existsSync(actorsPath)) {
    let actors = fs.readFileSync(actorsPath, 'utf8');
    actors = actors.replace(/associated_families: \['malware-1'\],/, '');
    fs.writeFileSync(actorsPath, actors);
}

// Fix attackMap.ts
const attackMapPath = path.join(demoDir, 'attackMap.ts');
if (fs.existsSync(attackMapPath)) {
    let attackMap = fs.readFileSync(attackMapPath, 'utf8');
    attackMap = attackMap.replace(/dest_ip:/g, 'dst_ip:');
    fs.writeFileSync(attackMapPath, attackMap);
}

// Fix news.ts
const newsPath = path.join(demoDir, 'news.ts');
if (fs.existsSync(newsPath)) {
    let news = fs.readFileSync(newsPath, 'utf8');
    news = news.replace(/tags: \[.*?\]/g, "category: 'news'");
    fs.writeFileSync(newsPath, news);
}

// Fix vulnerabilities.ts
const vulnPath = path.join(demoDir, 'vulnerabilities.ts');
if (fs.existsSync(vulnPath)) {
    let vuln = fs.readFileSync(vulnPath, 'utf8');
    vuln = vuln.replace(/assigner: 'cve@mitre.org',/g, '');
    fs.writeFileSync(vulnPath, vuln);
}

// Fix rules.ts to match MockRule
const rulesPath = path.join(demoDir, 'rules.ts');
if (fs.existsSync(rulesPath)) {
    let rules = fs.readFileSync(rulesPath, 'utf8');
    // We need to add format, lastModified, testStatus, mitre
    rules = rules.replace(/tags: \[SHARED_ENTITIES.mitre, 'lateral_movement'\]/, "mitre: [SHARED_ENTITIES.mitre], format: 'sigma', lastModified: new Date().toISOString(), testStatus: 'passing'");
    fs.writeFileSync(rulesPath, rules);
}
console.log('Fixed types');
