const fs = require('fs');
let c = fs.readFileSync('src/components/ViewRouter.tsx', 'utf8');

c = c.replace("import DashboardPage from '../pages/DashboardPage';", "import { AppDataProvider } from '../contexts/AppDataContext';\nimport DashboardPage from '../pages/DashboardPage';");

const dispatchStart = c.indexOf('  switch (activeView) {');
const dispatchEnd = c.lastIndexOf('}');

let dispatchBlock = c.substring(dispatchStart, dispatchEnd);

// Replace returns with renderedView assignment
dispatchBlock = dispatchBlock.replace(/return <([A-Za-z]+)([^>]*)>;/g, 'renderedView = <$1$2>; break;');

// Replace legacy wrapper returns
dispatchBlock = dispatchBlock.replace(/return \(\s*<LegacyWrapper>\s*<([A-Za-z]+)([^>]*)>\s*<\/LegacyWrapper>\s*\);/g, 'renderedView = (\n        <LegacyWrapper>\n          <$1$2>\n        </LegacyWrapper>\n      );\n      break;');

// Update return 
const replacement = `let renderedView = null;\n${dispatchBlock}\n  return (\n    <AppDataProvider value={{ results, malpediaActors, cveData, cveFeedItems, exploitData, newsItems, urlHausItems, malwareBazaarItems, feodoItems, sslBlItems, ja3Items, threatFoxItems, onNavigate }}>\n      {renderedView}\n    </AppDataProvider>\n  );`;

c = c.substring(0, dispatchStart) + replacement + '\n}\n';

fs.writeFileSync('src/components/ViewRouter.tsx', c);
