const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src', 'pages', 'HoneypotLogsPage.tsx');
let c = fs.readFileSync(pagePath, 'utf8');

if (!c.includes('import { dataProvider }')) {
  c = c.replace(/import PageHeader from '\.\.\/components\/layout\/PageHeader';/, 
  `import PageHeader from '../components/layout/PageHeader';\nimport { dataProvider } from '../services/dataProvider';\nimport { useEffect } from 'react';`);
}

c = c.replace(/import \{ useHoneypotData \} from '\.\.\/\.\.\/hooks\/useHoneypotData';/, '');

c = c.replace(/const \{\s*events: rawEvents,\s*stats,\s*isLoadingEvents,\s*eventsError,\s*refresh,\s*page,\s*limit,\s*total,\s*setPage,\s*\} = useHoneypotData\(\{[\s\S]*?\}\);/g,
`const [rawEvents, setRawEvents] = useState<LogEventV2[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  
  useEffect(() => {
    setIsLoadingEvents(true);
    dataProvider.getAttackEvents().then(e => {
      setRawEvents(e);
      setStats({
        total_events: e.length,
        unique_ips: new Set(e.map((x: any) => x.src_ip)).size,
        unique_countries: new Set(e.map((x: any) => x.geoip?.country_code)).size,
        unique_signatures: new Set(e.map((x: any) => x.event_type)).size,
        top_ips: [],
        top_countries: [],
        top_signatures: [],
        top_ports: []
      });
      setIsLoadingEvents(false);
    });
  }, []);
  
  const eventsError = null;
  const refresh = () => {};
  const page = 1;
  const limit = 100;
  const total = rawEvents.length;
  const setPage = () => {};`);

fs.writeFileSync(pagePath, c);
console.log("Updated HoneypotLogsPage");
