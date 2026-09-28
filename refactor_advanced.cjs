const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

function refactorRulesPage() {
    const file = path.join(pagesDir, 'RulesPage.tsx');
    let content = fs.readFileSync(file, 'utf8');

    // Remove MOCK_RULES
    const mockStart = content.indexOf('const MOCK_RULES: MockRule[] = [');
    if (mockStart !== -1) {
        // Find the end of the array
        let mockEnd = content.indexOf('];', mockStart) + 2;
        content = content.slice(0, mockStart) + content.slice(mockEnd);
    }

    // Add imports
    if (!content.includes('import { dataProvider }')) {
        content = content.replace("import { useMemo, useState", "import { useEffect, useMemo, useState }");
        content = content.replace("import IntelLayout", "import { dataProvider } from '../../services/dataProvider';\nimport IntelLayout");
    }

    // Replace useMemo filtered with state for rules
    if (content.includes('export default function RulesPage() {') && !content.includes('const [rules, setRules]')) {
        const replacement = `export default function RulesPage() {
    const [rules, setRules] = useState<MockRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        dataProvider.getRules().then(data => {
            setRules(data as MockRule[]);
            setIsLoading(false);
        });
    }, []);
`;
        content = content.replace('export default function RulesPage() {', replacement);
        content = content.replace(/MOCK_RULES\.filter/g, 'rules.filter');
    }
    
    fs.writeFileSync(file, content);
    console.log("RulesPage refactored.");
}

function refactorDashboardPage() {
    const file = path.join(pagesDir, 'DashboardPage.tsx');
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('import { dataProvider }')) {
        content = content.replace("import { useMemo", "import { useEffect, useState, useMemo");
        content = content.replace("import PageHeader", "import { dataProvider } from '../../services/dataProvider';\nimport PageHeader");
    }

    if (!content.includes('const [metrics, setMetrics]')) {
        const replacement = `export default function DashboardPage({
    onNavigate,
  }: Omit<DashboardProps, 'results' | 'newsItems' | 'cveFeedItems'>) {
    const [results, setResults] = useState<AnalyzedHost[]>([]);
    const [newsItems, setNewsItems] = useState<ThreatNewsItem[]>([]);
    const [cveFeedItems, setCveFeedItems] = useState<CveFeedItem[]>([]);
    const [metrics, setMetrics] = useState<any>(null);

    useEffect(() => {
        Promise.all([
            // In a real app we'd fetch hosts and feeds from dataProvider
            dataProvider.getDashboardMetrics()
        ]).then(([m]) => {
            setMetrics(m);
        });
    }, []);
`;
        content = content.replace(/export default function DashboardPage\(\{[\s\S]*?\}\s*:\s*DashboardProps\)\s*\{/, replacement);
    }

    fs.writeFileSync(file, content);
    console.log("DashboardPage refactored.");
}

refactorRulesPage();
refactorDashboardPage();
