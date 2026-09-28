const fs = require('fs');
const path = require('path');

const dashPath = path.join(__dirname, 'src', 'pages', 'DashboardPage.tsx');
let c = fs.readFileSync(dashPath, 'utf8');

c = c.replace(/export default function DashboardPage\(\{[\s\S]*?\}: DashboardProps\) \{/,
`export default function DashboardPage({
  onNavigate
}: Omit<DashboardProps, 'results' | 'newsItems' | 'cveFeedItems'>) {`);

c = c.replace(/const \[metrics, setMetrics\] = useState<any>\(null\);/,
`const [results, setResults] = useState<AnalyzedHost[]>([]);
  const [newsItems, setNewsItems] = useState<ThreatNewsItem[]>([]);
  const [cveFeedItems, setCveFeedItems] = useState<CveFeedItem[]>([]);
  const [metrics, setMetrics] = useState<any>(null);`);

c = c.replace(/dataProvider\.getDashboardMetrics\(\)\.then\(\(m\) => \{[\s\S]*?\}\);/g,
`Promise.all([
      dataProvider.getDashboardMetrics(),
      (dataProvider as any).getHosts(),
      dataProvider.getNews(),
      (dataProvider as any).getCveFeeds()
    ]).then(([m, h, n, c]) => {
      setMetrics(m);
      setResults(h);
      setNewsItems(n);
      setCveFeedItems(c);
    });`);

fs.writeFileSync(dashPath, c);

const viewRouterPath = path.join(__dirname, 'src', 'components', 'ViewRouter.tsx');
let vr = fs.readFileSync(viewRouterPath, 'utf8');
vr = vr.replace(/<DashboardPage[\s\S]*?results=\{results\}[\s\S]*?newsItems=\{newsItems\}[\s\S]*?cveFeedItems=\{cveFeedItems\}[\s\S]*?\/>/, `<DashboardPage\n          onNavigate={onNavigate}\n        />`);
fs.writeFileSync(viewRouterPath, vr);

console.log("Rewrote DashboardPage to fully use dataProvider");
