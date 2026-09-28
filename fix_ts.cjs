const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const demoDir = path.join(srcDir, 'data', 'demo');
const pagesDir = path.join(srcDir, 'pages');

// Fix dataProvider imports in pages
const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));
for (const page of pages) {
    const p = path.join(pagesDir, page);
    let c = fs.readFileSync(p, 'utf8');
    let changed = false;
    
    if (c.includes('../../services/dataProvider')) {
        c = c.replace(/..\/..\/services\/dataProvider/g, '../services/dataProvider');
        changed = true;
    }

    if (page === 'InvestigationPage.tsx' && c.includes('dataProvider.getInvestigations')) {
        if (!c.includes('import { dataProvider }')) {
             c = "import { dataProvider } from '../services/dataProvider';\n" + c;
             changed = true;
        }
    }

    if (page === 'RulesPage.tsx') {
        c = c.replace(/MOCK_RULES/g, 'rules');
        changed = true;
    }
    
    if (changed) fs.writeFileSync(p, c);
}

// Fix dataProvider imports to real services
const dataProviderPath = path.join(srcDir, 'services', 'dataProvider.ts');
let dp = fs.readFileSync(dataProviderPath, 'utf8');
dp = dp.replace(/'\.\/news'/g, "'../../services/news'");
dp = dp.replace(/'\.\/cve'/g, "'../../services/cve'");
dp = dp.replace(/'\.\/malpedia'/g, "'../../services/malpedia'");
fs.writeFileSync(dataProviderPath, dp);

// Fix demo data types
const vulnsPath = path.join(demoDir, 'vulnerabilities.ts');
if (fs.existsSync(vulnsPath)) {
    let vulns = fs.readFileSync(vulnsPath, 'utf8');
    vulns = vulns.replace(/cvss: \{[\s\S]*?\}/, 'cvss: 9.8');
    vulns = vulns.replace(/references: \['https.*?\]/, "references: [{ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-10443', tags: [] }]");
    fs.writeFileSync(vulnsPath, vulns);
}

const actorsPath = path.join(demoDir, 'actors.ts');
if (fs.existsSync(actorsPath)) {
    let actors = fs.readFileSync(actorsPath, 'utf8');
    actors = actors.replace(/name: SHARED_ENTITIES.actor,/, 'value: SHARED_ENTITIES.actor,');
    fs.writeFileSync(actorsPath, actors);
}

const mapPath = path.join(demoDir, 'attackMap.ts');
if (fs.existsSync(mapPath)) {
    let map = fs.readFileSync(mapPath, 'utf8');
    map = map.replace(/source_ip/g, 'src_ip');
    fs.writeFileSync(mapPath, map);
}

const newsPath = path.join(demoDir, 'news.ts');
if (fs.existsSync(newsPath)) {
    let news = fs.readFileSync(newsPath, 'utf8');
    news = news.replace(/summary:/g, 'description:');
    news = news.replace(/published: new Date\(\)\.toISOString\(\)/g, "date: new Date().toISOString(),\n    published: new Date().toISOString()");
    fs.writeFileSync(newsPath, news);
}
console.log('Fixes applied');
