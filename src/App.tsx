import { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import CommandPalette from './components/layout/CommandPalette';
import CommandNav from './components/layout/CommandNav';

import DashboardPage from './pages/DashboardPage';
import HoneypotLogsPage from './pages/HoneypotLogsPage';
import IocPage from './pages/IocPage';
import InvestigationPage from './pages/InvestigationPage';
import CvePage from './pages/CvePage';
import ActorsPage from './pages/ActorsPage';
import NewsPage from './pages/NewsPage';
import RulesPage from './pages/RulesPage';
import MitreNavigatorPage from './pages/MitreNavigatorPage';
import VulnerabilityManagerPage from './pages/VulnerabilityManagerPage';
import PlaybookPage from './pages/PlaybookPage';
import AttackMapPage from './pages/AttackMapPage';
import AnalysisPage from './pages/AnalysisPage';
import PlaceholderPage from './pages/PlaceholderPage';

import {
  Crosshair,
  Network,
  FileText,
  Briefcase,
  Share2,
  HardDrive,
  PencilLine,
  Zap,
  Box,
  Monitor,
  Bug,
  Skull,
  Fingerprint,
  Globe,
  Mail,
  Search,
  Target,
  MessageSquare,
  HelpCircle,
  Settings,
  MonitorPlay,
  CloudCog,
} from 'lucide-react';

export default function App() {
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('at_view') || 'dashboard';
  });

  const [navigationOpen, setNavigationOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const navigate = useCallback((id: string) => {
    setActiveView(id);
    localStorage.setItem('at_view', id);
    setNavigationOpen(false);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();

        setSearchOpen((prev) => !prev);
        setNavigationOpen(false);
      }

      if ((event.metaKey || event.ctrlKey) && event.key === '1') {
        event.preventDefault();

        setNavigationOpen((prev) => !prev);
        setSearchOpen(false);
      }

      if (event.key === 'Escape') {
        setNavigationOpen(false);
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, []);

  const renderPage = () => {
    switch (activeView) {
      case 'dashboard':
        return <DashboardPage onNavigate={navigate} />;

      case 'honeypot_logs':
        return <HoneypotLogsPage onNavigate={navigate} />;

      case 'ioc':
        return <IocPage />;

      case 'soc_wall':
        return (
          <PlaceholderPage
            title="SOC Wall"
            description="Full-screen cinematic visualization for wall displays. Auto-refreshing attack map, critical activity, and threat counters."
            icon={MonitorPlay}
          />
        );

      case 'attack_map':
        return (
          <AttackMapPage
            onNavigate={navigate}
          />
        );

      case 'infrastructure':
        return (
          <PlaceholderPage
            title="Infrastructure"
            description="Manage servers, agents, log shippers, containers, and honeypot deployments."
            icon={CloudCog}
          />
        );

      case 'analysis':
        return (
          <AnalysisPage
            onNavigate={navigate}
          />
        );

      case 'investigation':
        return <InvestigationPage />;

      case 'investigation_bench':
        return (
          <PlaceholderPage
            title="Investigation Bench"
            description="Case management workspace with evidence, timeline, and audit history."
            icon={Briefcase}
          />
        );

      case 'network':
        return (
          <PlaceholderPage
            title="Network Forensics"
            description="Analyze PCAP files, TCP streams, and packet headers."
            icon={Network}
          />
        );

      case 'topology':
        return (
          <PlaceholderPage
            title="Network Topology"
            description="Security-focused network builder with attack path simulation."
            icon={Share2}
          />
        );

      case 'nettools':
        return (
          <PlaceholderPage
            title="Network Tools"
            description="DNS lookup, Whois, Traceroute, port scanning, and certificate analysis."
            icon={HardDrive}
          />
        );

      case 'threat_canvas':
        return (
          <PlaceholderPage
            title="Threat Canvas"
            description="Interactive threat modeling canvas with attack paths and security context."
            icon={PencilLine}
          />
        );

      case 'cyberchef':
        return (
          <PlaceholderPage
            title="CyberChef"
            description="Tactical data transformation, encoding/decoding, and hash generation."
            icon={Zap}
          />
        );

      case 'dynamic_sandbox':
        return (
          <PlaceholderPage
            title="Dynamic Sandbox"
            description="Detonate files and URLs in a secure isolated environment."
            icon={Box}
          />
        );

      case 'sandbox_browser':
        return (
          <PlaceholderPage
            title="Sandbox Browser"
            description="Secure web browser for inspecting potentially malicious websites."
            icon={Monitor}
          />
        );

      case 'cve':
        return <CvePage />;

      case 'exploit':
        return (
          <PlaceholderPage
            title="Exploit Database"
            description="Database of public exploits, proof-of-concepts, and weaponized vulnerabilities."
            icon={Bug}
          />
        );

      case 'actors':
        return <ActorsPage />;

      case 'news':
        return <NewsPage />;

      case 'ransomware':
        return (
          <PlaceholderPage
            title="Ransomware Monitor"
            description="Track active ransomware groups, leak sites, and recent victims."
            icon={Skull}
          />
        );

      case 'brand_monitor':
        return (
          <PlaceholderPage
            title="Brand Monitor"
            description="Monitor brand impersonation, typosquatting, and domain abuse."
            icon={Fingerprint}
          />
        );

      case 'webcheck':
        return (
          <PlaceholderPage
            title="Web Check"
            description="Deep website analysis including headers, certificates, and technologies."
            icon={Globe}
          />
        );

      case 'email_forensic':
        return (
          <PlaceholderPage
            title="Email Forensic"
            description="Analyze email headers, authentication, and routing hops."
            icon={Mail}
          />
        );

      case 'intel_search':
        return (
          <PlaceholderPage
            title="Intel Search"
            description="Deep research tool using AI-powered search grounding."
            icon={Search}
          />
        );

      case 'recon':
        return (
          <PlaceholderPage
            title="Recon"
            description="Attack surface reconnaissance — targets, assets, vulnerabilities, and exposure."
            icon={Target}
          />
        );

      case 'rules':
        return <RulesPage />;

      case 'mitre':
        return <MitreNavigatorPage />;

      case 'vuln_manager':
        return <VulnerabilityManagerPage />;

      case 'playbook':
        return <PlaybookPage />;

      case 'chat':
        return (
          <PlaceholderPage
            title="AI Assistant"
            description="Interact with the integrated AI security analyst for threat analysis."
            icon={MessageSquare}
          />
        );

      case 'help':
        return (
          <PlaceholderPage
            title="Help & Documentation"
            description="Keyboard shortcuts, user guide, API documentation, and getting started."
            icon={HelpCircle}
          />
        );

      case 'settings':
        return (
          <PlaceholderPage
            title="Settings"
            description="Application settings, API keys, notifications, and preferences."
            icon={Settings}
          />
        );

      default:
        return (
          <PlaceholderPage
            title="Page Not Found"
            description="This page does not exist."
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-at-bg overflow-hidden">
      <div className="at-grid-bg" />

      <Header
        activeView={activeView}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenNavigation={() => setNavigationOpen(true)}
      />

      <CommandNav
        isOpen={navigationOpen}
        activeView={activeView}
        onClose={() => setNavigationOpen(false)}
        onNavigate={navigate}
      />

      <main className="at-app-main flex-1 flex flex-col min-h-0 min-w-0 bg-at-bg">
        {renderPage()}
      </main>

      <CommandPalette
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={navigate}
      />
    </div>
  );
}