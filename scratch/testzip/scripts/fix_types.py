import os
import re

pages_dir = 'src/pages'

replacements = {
    'MockHost': 'AnalyzedHost',
    'MockThreatEvent': 'LogEventV2',
    'MockCve': 'CveEntry',
    'MockNewsItem': 'ThreatNewsItem',
    'MockActor': 'MalpediaActor',
    'MockIoc': 'any',
    # Property fixes
    'event.srcIp': 'event.src_ip',
    'event.dstPort': 'event.dst_port',
    'event.eventType': 'event.event_type',
    'host.isBlacklisted': "(host.rblStatus === 'LISTED')",
}

for filename in os.listdir(pages_dir):
    if not filename.endswith('.tsx'):
        continue
        
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    # Fix import missing types if they were replaced
    types_to_import = []
    if 'AnalyzedHost' in content and 'AnalyzedHost' not in content[:500]: types_to_import.append('AnalyzedHost')
    if 'LogEventV2' in content and 'LogEventV2' not in content[:500]: types_to_import.append('LogEventV2')
    if 'CveEntry' in content and 'CveEntry' not in content[:500]: types_to_import.append('CveEntry')
    if 'ThreatNewsItem' in content and 'ThreatNewsItem' not in content[:500]: types_to_import.append('ThreatNewsItem')
    if 'MalpediaActor' in content and 'MalpediaActor' not in content[:500]: types_to_import.append('MalpediaActor')
    
    if types_to_import:
        # Add import at top
        import_stmt = f"import {{ {', '.join(types_to_import)} }} from '../../types';\n"
        if "import { LogEventV2 }" in import_stmt:
            import_stmt = import_stmt.replace("LogEventV2", "")
            import_stmt += "import { LogEventV2 } from '../../api/services';\n"
            import_stmt = import_stmt.replace("import {  } from '../../types';\n", "")
            
        content = import_stmt + content
        
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed {filename}")
