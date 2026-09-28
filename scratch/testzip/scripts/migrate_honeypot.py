import re

with open('src/pages/HoneypotLogsPage.tsx', 'r') as f:
    content = f.read()

# 1. Update imports
content = re.sub(
    r"import \{\s*MOCK_EVENTS,\s*type MockThreatEvent,\s*\} from '../data/mockData';",
    "import { LogEventV2 } from '../api/services';\nimport { useHoneypotData } from '../hooks/useHoneypotData';",
    content
)

# 2. Add hook to component body
content = re.sub(
    r"export default function HoneypotLogsPage\(\{\s*onNavigate,\s*\}\: HoneypotLogsProps\) \{",
    "export default function HoneypotLogsPage({\n  onNavigate,\n}: HoneypotLogsProps) {\n  const { events: rawEvents, isLoadingEvents, refresh, offset, limit, total, setPage } = useHoneypotData({ limit: 100, offset: 0 });\n  const MOCK_EVENTS = rawEvents || [];",
    content
)

# 3. Fix Type references
content = content.replace("MockThreatEvent", "LogEventV2")

# 4. Fix MockThreatEvent -> LogEventV2 property maps
content = content.replace("event.srcIp", "event.src_ip")
content = content.replace("selectedEvent.srcIp", "selectedEvent.src_ip")
content = content.replace("event.eventType", "event.event_type")
content = content.replace("selectedEvent.eventType", "selectedEvent.event_type")
content = content.replace("event.dstPort", "event.dst_port")
content = content.replace("selectedEvent.dstPort", "selectedEvent.dst_port")
content = content.replace("event.countryCode", "(event as any).countryCode")
content = content.replace("selectedEvent.countryCode", "(selectedEvent as any).countryCode")
content = content.replace("event.asn", "(event as any).asn")
content = content.replace("selectedEvent.asn", "(selectedEvent as any).asn")
content = content.replace("event.country", "(event as any).country")
content = content.replace("selectedEvent.country", "(selectedEvent as any).country")


# 5. Fix Severity accesses
content = content.replace(
    "event.severity === sevFilter",
    "((event.threat_score || 0) >= 80 ? 'critical' : (event.threat_score || 0) >= 60 ? 'high' : (event.threat_score || 0) >= 40 ? 'medium' : 'low') === sevFilter"
)
content = content.replace(
    "event.severity ===\n          'critical'",
    "(event.threat_score || 0) >= 80"
)
content = content.replace(
    "event.severity === 'high'",
    "(event.threat_score || 0) >= 60 && (event.threat_score || 0) < 80"
)
content = content.replace(
    "SEVERITY_CONFIG[\n                                  event.severity\n                                ]",
    "SEVERITY_CONFIG[(event.threat_score || 0) >= 80 ? 'critical' : (event.threat_score || 0) >= 60 ? 'high' : (event.threat_score || 0) >= 40 ? 'medium' : 'low']"
)
content = content.replace(
    "SEVERITY_CONFIG[\n                          selectedEvent\n                            .severity\n                        ]",
    "SEVERITY_CONFIG[(selectedEvent.threat_score || 0) >= 80 ? 'critical' : (selectedEvent.threat_score || 0) >= 60 ? 'high' : (selectedEvent.threat_score || 0) >= 40 ? 'medium' : 'low']"
)
content = content.replace(
    "event.severity",
    "((event.threat_score || 0) >= 80 ? 'critical' : (event.threat_score || 0) >= 60 ? 'high' : (event.threat_score || 0) >= 40 ? 'medium' : 'low')"
)
content = content.replace(
    "selectedEvent.severity",
    "((selectedEvent.threat_score || 0) >= 80 ? 'critical' : (selectedEvent.threat_score || 0) >= 60 ? 'high' : (selectedEvent.threat_score || 0) >= 40 ? 'medium' : 'low')"
)

content = content.replace("event.id", "event.event_id")
content = content.replace("selectedEvent.id", "selectedEvent.event_id")
content = content.replace("selectedEvent?.id", "selectedEvent?.event_id")

with open('src/pages/HoneypotLogsPage.tsx', 'w') as f:
    f.write(content)
