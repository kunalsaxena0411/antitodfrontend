const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');

function refactorInvestigationPage() {
    const file = path.join(pagesDir, 'InvestigationPage.tsx');
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('import { dataProvider }')) {
        content = content.replace("import {\n  Activity", "import { dataProvider } from '../../services/dataProvider';\nimport {\n  Activity");
    }

    if (content.includes('const MOCK_CASES')) {
        // Remove MOCK_CASES and mock data
        const casesStart = content.indexOf('const MOCK_CASES');
        if (casesStart !== -1) {
            let casesEnd = content.indexOf('];', casesStart) + 2;
            content = content.slice(0, casesStart) + content.slice(casesEnd);
        }
    }

    // Replace useMemo filtered with state
    if (!content.includes('const [investigations, setInvestigations]')) {
        const replacement = `export default function InvestigationPage() {
    const [investigations, setInvestigations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        dataProvider.getInvestigations().then(data => {
            setInvestigations(data);
            setIsLoading(false);
        });
    }, []);
`;
        content = content.replace('export default function InvestigationPage() {', replacement);
        content = content.replace(/MOCK_CASES/g, 'investigations');
    }
    
    fs.writeFileSync(file, content);
    console.log("InvestigationPage refactored.");
}

function refactorPlaybookPage() {
    const file = path.join(pagesDir, 'PlaybookPage.tsx');
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('import { dataProvider }')) {
        content = content.replace("import { useMemo, useState", "import { useEffect, useMemo, useState }");
        content = content.replace("import { useAppData", "import { dataProvider } from '../../services/dataProvider';\nimport { useAppData");
    }

    if (content.includes('const { MOCK_PLAYBOOKS } = useAppData();')) {
        content = content.replace(
            'const { MOCK_PLAYBOOKS } = useAppData();',
            `const [MOCK_PLAYBOOKS, setPlaybooks] = useState<any[]>([]);
    useEffect(() => {
        dataProvider.getPlaybooks().then(setPlaybooks);
    }, []);`
        );
    }
    
    fs.writeFileSync(file, content);
    console.log("PlaybookPage refactored.");
}

function refactorIocPage() {
    const file = path.join(pagesDir, 'IocPage.tsx');
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('import { dataProvider }')) {
        content = content.replace("import { useMemo, useState", "import { useEffect, useMemo, useState }");
        content = content.replace("import { useAppData", "import { dataProvider } from '../../services/dataProvider';\nimport { useAppData");
    }

    if (content.includes('const { MOCK_IOCS } = useAppData();')) {
        content = content.replace(
            'const { MOCK_IOCS } = useAppData();',
            `const [MOCK_IOCS, setIocs] = useState<any[]>([]);
    useEffect(() => {
        dataProvider.getIocs().then(setIocs);
    }, []);`
        );
    }
    
    fs.writeFileSync(file, content);
    console.log("IocPage refactored.");
}

refactorInvestigationPage();
refactorPlaybookPage();
refactorIocPage();
