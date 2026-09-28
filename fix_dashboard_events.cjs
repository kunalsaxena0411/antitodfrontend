const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'src', 'pages', 'DashboardPage.tsx');
let c = fs.readFileSync(dashPath, 'utf8');

c = c.replace(/const \[metrics, setMetrics\] = useState<any>\(null\);/,
`const [metrics, setMetrics] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);`);

c = c.replace(/dataProvider\.getCveFeeds\(\)/,
`dataProvider.getCveFeeds(),
      dataProvider.getAttackEvents()`);

c = c.replace(/setCveFeedItems\(c\);\n    \}\);/,
`setCveFeedItems(c);
      setEvents(e);
    });`);

c = c.replace(/\(dataProvider as any\)\.getCveFeeds\(\)/, `(dataProvider as any).getCveFeeds(),\n      dataProvider.getAttackEvents()`);
c = c.replace(/\]\)\.then\(\(\[m, h, n, c\]\) => \{/, `]).then(([m, h, n, c, e]) => {`);

c = c.replace(/const \{\s*events,\s*stats: honeypotStats,\s*isLoadingEvents,\s*refresh,\s*\} = useHoneypotData\(\{\s*limit: 100,\s*offset: 0,\s*\}\);/,
`const honeypotStats = { total_events: events.length };
  const isLoadingEvents = false;
  const refresh = () => {};`);

fs.writeFileSync(dashPath, c);
console.log("Updated DashboardPage to fetch events from dataProvider");
