import os
import re

pages_dir = 'src/pages'
for filename in os.listdir(pages_dir):
    if not filename.endswith('.tsx') or filename in ['DashboardPage.tsx', 'HoneypotLogsPage.tsx', 'PlaceholderPage.tsx']:
        continue
    
    filepath = os.path.join(pages_dir, filename)
    with open(filepath, 'r') as f:
        content = f.read()
    
    if '../data/mockData' not in content and '../../data/mockData' not in content:
        continue
        
    # Find what mocks are imported
    mock_imports = re.search(r'import\s+\{([^}]+)\}\s+from\s+[\'"]\.\./data/mockData[\'"]', content)
    if not mock_imports:
        continue
        
    imports_str = mock_imports.group(1)
    imported_mocks = [m.strip() for m in imports_str.split(',') if m.strip() and m.strip().startswith('MOCK_')]
    
    if not imported_mocks:
        continue
        
    # Replace the import statement
    content = re.sub(
        r'import\s+\{[^}]+\}\s+from\s+[\'"]\.\./data/mockData[\'"];?',
        "import { useAppData } from '../contexts/AppDataContext';",
        content
    )
    
    # Insert the hook inside the component
    # We find "export default function ComponentName(props) {"
    component_pattern = r'(export default function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*\{)'
    hook_str = f"\n  const {{ {', '.join(imported_mocks)} }} = useAppData();\n"
    
    content = re.sub(component_pattern, r'\1' + hook_str, content)
    
    with open(filepath, 'w') as f:
        f.write(content)

    print(f'Migrated {filename}')
