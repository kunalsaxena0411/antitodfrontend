const fs = require('fs');
const path = require('path');

const mappings = {
  'MOCK_EVENTS': { type: 'any[]', fetcher: 'dataProvider.getAttackEvents()' },
  'MOCK_CVES': { type: 'any[]', fetcher: 'dataProvider.getCves()' },
  'MOCK_NEWS': { type: 'any[]', fetcher: 'dataProvider.getNews()' },
  'MOCK_ACTORS': { type: 'any[]', fetcher: 'dataProvider.getActors()' },
  'MOCK_IOCS': { type: 'any[]', fetcher: 'dataProvider.getIocs()' },
  'MOCK_PLAYBOOKS': { type: 'any[]', fetcher: 'dataProvider.getPlaybooks()' },
};

const pagesDir = path.join(__dirname, 'src', 'pages');
const pages = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const page of pages) {
  const filePath = path.join(pagesDir, page);
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [mockName, config] of Object.entries(mappings)) {
    const regex = new RegExp(`const\\s+\\{\\s*${mockName}\\s*\\}\\s*=\\s*useAppData\\(\\);`);
    if (regex.test(content)) {
      modified = true;
      content = content.replace(
        regex, 
        `const [${mockName}, set_${mockName}] = React.useState<${config.type}>([]);\n    React.useEffect(() => {\n        ${config.fetcher}.then(set_${mockName});\n    }, []);`
      );
    }
  }

  if (modified) {
    if (!content.includes("import { dataProvider } from")) {
       content = content.replace("import { useAppData }", "import { dataProvider } from '../../services/dataProvider';\nimport { useAppData }");
    }
    if (!content.includes("import React")) {
       content = "import React from 'react';\n" + content;
    }
    fs.writeFileSync(filePath, content);
    console.log(`Refactored ${page}`);
  }
}
