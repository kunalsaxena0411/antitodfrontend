const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
let c = fs.readFileSync(appPath, 'utf8');

if (!c.includes('import { DEMO_HOSTS, DEMO_ACTORS, DEMO_CVES, DEMO_CVE_FEEDS, DEMO_NEWS } from \'./data/demo\';')) {
    c = c.replace(/import ViewRouter from '.\/components\/ViewRouter';/,
    `import ViewRouter from './components/ViewRouter';\nimport { DEMO_HOSTS, DEMO_ACTORS, DEMO_CVES, DEMO_CVE_FEEDS, DEMO_NEWS } from './data/demo';`);
}

c = c.replace(/results=\{\s*combinedResults\s*\}/g, `results={combinedResults.length > 0 ? combinedResults : DEMO_HOSTS}`);
c = c.replace(/malpediaActors=\{\s*malpediaActors\s*\}/g, `malpediaActors={malpediaActors.length > 0 ? malpediaActors : DEMO_ACTORS}`);
c = c.replace(/cveData=\{cveData\}/g, `cveData={cveData.length > 0 ? cveData : DEMO_CVES}`);
c = c.replace(/cveFeedItems=\{\s*cveFeedItems\s*\}/g, `cveFeedItems={cveFeedItems.length > 0 ? cveFeedItems : DEMO_CVE_FEEDS}`);
c = c.replace(/newsItems=\{\s*newsItems\s*\}/g, `newsItems={newsItems.length > 0 ? newsItems : DEMO_NEWS}`);

fs.writeFileSync(appPath, c);
console.log("App.tsx global fallback injected");
