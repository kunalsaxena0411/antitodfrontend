const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
let appContent = fs.readFileSync(appPath, 'utf8');

// Ensure dataProvider is imported
if (!appContent.includes('import { dataProvider }')) {
  appContent = appContent.replace(/import ViewRouter from '.\/components\/ViewRouter';/, 
  `import ViewRouter from './components/ViewRouter';\nimport { DEMO_HOSTS, DEMO_ACTORS, DEMO_CVES, DEMO_CVE_FEEDS, DEMO_NEWS } from './data/demo';`);
}

appContent = appContent.replace(/<ViewRouter\s+activeView=\{([\s\S]*?)\} \/>/g, ''); // just in case

// We'll replace the ViewRouter block to use fallbacks
const viewRouterMatch = appContent.match(/<ViewRouter[\s\S]*?onRefreshAll=\{handleRefreshFeeds\}[\s\S]*?\/>/);
if (viewRouterMatch) {
  let vr = viewRouterMatch[0];
  vr = vr.replace(/results=\{([\s\S]*?)combinedResults([\s\S]*?)\}/, `results={combinedResults.length > 0 ? combinedResults : DEMO_HOSTS}`);
  vr = vr.replace(/malpediaActors=\{([\s\S]*?)malpediaActors([\s\S]*?)\}/, `malpediaActors={malpediaActors.length > 0 ? malpediaActors : DEMO_ACTORS}`);
  vr = vr.replace(/cveData=\{cveData\}/, `cveData={cveData.length > 0 ? cveData : DEMO_CVES}`);
  vr = vr.replace(/cveFeedItems=\{([\s\S]*?)cveFeedItems([\s\S]*?)\}/, `cveFeedItems={cveFeedItems.length > 0 ? cveFeedItems : DEMO_CVE_FEEDS}`);
  vr = vr.replace(/newsItems=\{([\s\S]*?)newsItems([\s\S]*?)\}/, `newsItems={newsItems.length > 0 ? newsItems : DEMO_NEWS}`);
  
  appContent = appContent.replace(viewRouterMatch[0], vr);
  fs.writeFileSync(appPath, appContent);
  console.log("App.tsx updated with global fallbacks!");
} else {
  console.log("Could not find ViewRouter block");
}
