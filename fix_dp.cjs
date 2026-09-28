const fs = require('fs');
const path = require('path');

const dpPath = path.join(__dirname, 'src', 'services', 'dataProvider.ts');
let dp = fs.readFileSync(dpPath, 'utf8');

// Fix dataProvider type errors by defining them in the object directly.
dp = dp.replace(/getDashboardMetrics: async \(\) => \{/g, `getHosts: async () => {\n    return DEMO_HOSTS;\n  },\n  getCveFeeds: async () => {\n    return DEMO_CVE_FEEDS;\n  },\n  getDashboardMetrics: async () => {`);
dp = dp.replace(/dataProvider\.getHosts =[\s\S]*?DEMO_CVE_FEEDS;\n\};/g, '');

fs.writeFileSync(dpPath, dp);

const newsPath = path.join(__dirname, 'src', 'data', 'demo', 'news.ts');
if (fs.existsSync(newsPath)) {
    let n = fs.readFileSync(newsPath, 'utf8');
    n = n.replace(/category: 'news'/g, `category: 'general'`);
    fs.writeFileSync(newsPath, n);
}
console.log("Types fixed in dataProvider and news");
