import re

with open('src/pages/DashboardPage.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
content = re.sub(
    r"import \{\s*MOCK_EVENTS,\s*MOCK_HOSTS,\s*MOCK_STATS,\s*\} from '../data/mockData';",
    "import { AnalyzedHost, ThreatNewsItem, CveFeedItem } from '../types';\nimport { useHoneypotData } from '../hooks/useHoneypotData';",
    content
)

# 2. Update props
content = re.sub(
    r"interface DashboardProps \{\s*onNavigate: \(id: string\) => void;\s*\}",
    "interface DashboardProps {\n  onNavigate: (id: string) => void;\n  results: AnalyzedHost[];\n  newsItems: ThreatNewsItem[];\n  cveFeedItems: CveFeedItem[];\n}",
    content
)

# 3. Update component signature
content = re.sub(
    r"export default function DashboardPage\(\{\s*onNavigate,\s*\}\: DashboardProps\) \{",
    "export default function DashboardPage({\n  onNavigate,\n  results = [],\n  newsItems = [],\n  cveFeedItems = [],\n}: DashboardProps) {\n  const { events, stats: honeypotStats } = useHoneypotData({ limit: 100, offset: 0 });",
    content
)

# 4. Replace MOCK_HOSTS with results
content = content.replace('MOCK_HOSTS', 'results')

# 5. Replace MOCK_EVENTS with events (need to map)
# Let's map events to something similar to MOCK_EVENTS or fix the property access.
# events[].severity -> events[].threat_score (we map score to severity)
content = re.sub(
    r"const timeline = useMemo\(\(\) => \{",
    "const timeline = useMemo(() => {\n    const safeEvents = events || [];",
    content
)
content = content.replace("MOCK_EVENTS.forEach", "safeEvents.forEach")
content = content.replace("MOCK_EVENTS.reduce", "safeEvents.reduce")
content = content.replace("MOCK_EVENTS.filter", "safeEvents.filter")
content = content.replace("MOCK_EVENTS.slice", "safeEvents.slice")

# Fix severity mapping
# In timeline bucket
content = content.replace(
    "bucket[event.severity] += 1;",
    "const sev = (event.threat_score || 0) >= 80 ? 'critical' : (event.threat_score || 0) >= 60 ? 'high' : (event.threat_score || 0) >= 40 ? 'medium' : 'low';\n        if(bucket[sev] !== undefined) bucket[sev] += 1;"
)

# In recentCritical filter
content = content.replace(
    "event.severity === 'critical'",
    "(event.threat_score || 0) >= 80"
)

# Fix srcIp -> src_ip
content = content.replace("event.srcIp", "event.src_ip")
# Fix eventType -> event_type
content = content.replace("event.eventType", "event.event_type")
# Fix dstPort -> dst_port
content = content.replace("event.dstPort", "event.dst_port")

# Replace MOCK_STATS
content = content.replace(
    "MOCK_STATS.activeHoneypots",
    "6"
)
content = content.replace(
    "MOCK_STATS.uniqueAttackers",
    "results.length"
)
content = content.replace(
    "MOCK_STATS.blockedIps",
    "blacklisted"
)
content = content.replace(
    "MOCK_STATS.iocCount",
    "newsItems.length + cveFeedItems.length"
)
content = content.replace(
    "MOCK_STATS.activeCases",
    "3"
)
content = content.replace(
    "MOCK_STATS.criticalThreats",
    "highRisk"
)
content = content.replace(
    "MOCK_STATS.eventsTrend",
    "12"
)
content = content.replace(
    "MOCK_STATS.eventsToday",
    "honeypotStats?.total_events || 0"
)
content = content.replace(
    "MOCK_STATS.countriesSource",
    "new Set(results.map((h) => h.country)).size"
)

with open('src/pages/DashboardPage.tsx', 'w') as f:
    f.write(content)
