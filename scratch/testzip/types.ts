
export interface TopologyNodeData {
    id: string;
    label: string;
    description?: string;
    type: 'compute' | 'storage' | 'network' | 'actor' | 'boundary' | 'risk' | 'tactic';
    os?: string;
    vulnerabilities: string[]; // CVE IDs
    iocs: string[]; // IP/Domain/Hash IOCs
    mitreIds: string[]; // Linked MITRE techniques
    criticality: 'LOW' | 'MEDIUM' | 'HIGH' | 'MISSION_CRITICAL';
    sensitivity: 'None' | 'Public' | 'Internal' | 'Confidential' | 'Restricted' | 'Protected' | 'PII' | 'PHI' | 'Financial' | 'Secret';
    isExternal: boolean;
    ipRange?: string;
    status: 'SECURE' | 'COMPROMISED' | 'VULNERABLE';
    iconName?: string;
    colorClass?: string;
    borderClass?: string;
    isReachable?: boolean;
    onLabelChange: (id: string, label: string) => void;
}

export interface TopologyEdgeData {
    protocol: string;
    portRange: string; // e.g. "443", "80-443", "*"
    isPermissive: boolean;
    encryption: 'None' | 'TLS 1.2' | 'TLS 1.3' | 'IPSec' | 'SSH-Encrypted' | 'VPN';
    authentication: 'None' | 'OAuth2' | 'JWT' | 'Basic' | 'mTLS' | 'API Key' | 'Kerberos';
    mitreIds: string[];
}

export interface AttackSimulationResult {
    originId: string;
    reachableNodes: string[];
    criticalPaths: string[][];
    blastRadiusScore: number;
    aiInsights?: string;
}

export interface ThreatRecord {
    id: string;
    model: 'STRIDE' | 'PASTA' | 'LINDDUN' | 'NIST_AI';
    category: string;
    description: string;
    recommendation: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    riskScores?: {
        cvss?: number;
        dread?: {
            damage: number;
            reproducibility: number;
            exploitability: number;
            affectedUsers: number;
            discoverability: number;
            total: number;
        };
    };
    mappings?: {
        mitre?: string[];
        nist?: string[];
        linddun?: string[];
    };
    targetNodeId?: string;
    targetEdgeId?: string;
}

export type StrideThreat = ThreatRecord;

export interface ThreatModelData {
    id: string;
    name: string;
    nodes: any[];
    edges: any[];
    threats: ThreatRecord[];
    lastAnalyzed?: string;
    activeFramework?: 'STRIDE' | 'PASTA' | 'LINDDUN' | 'NIST_AI';
}

export interface SignatureDefinition {
  name: string;
  pattern: RegExp;
  score: number;
  description: string;
  mitreId: string;
  mitreTactic: string;
}

export interface LogEntry {
  ip: string;
  country?: string;
  commands: string[];
  timestamp: string;
}

export interface DetectedSignature {
    name: string;
    score: number;
    matchedCommand: string;
    description: string;
    matchedPart: string;
    matchIndex: number;
    mitreId: string;
    mitreTactic: string;
    count: number;
}

export interface AnalyzedHost {
    ip: string;
    country: string;
    totalScore: number;
    signatures: DetectedSignature[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    rawCommands: string[];
    enrichmentData?: IpDataResponse;
    activeDays: number;
    firstSeen: string;
    lastSeen: string;
    timeline: Record<string, number>;
    isMalwareBazaar?: boolean;
    isFeodo?: boolean;
    isThreatFox?: boolean;
    isIpsum?: boolean;
    isUrlHaus?: boolean;
    isC2Intel?: boolean;
    dnsHostname?: string | null;
    extendedSecurity?: ExtendedSecurityInfo;
    rblStatus?: 'LISTED' | 'CLEAN' | 'CHECKING' | 'FAILED';
    rblListedIn?: string[];
    otxData?: OtxAnalysis | null;
    scoreBreakdown?: {
        base: number;
        persistenceBonus: number;
        frequencyBonus?: number;
        rarityBonus?: number;
        tacticBonus?: number;
        aptBonus: number;
        threatIntelBonus: number;
        rblPenalty: number;
        multiSourceBonus: number;
    };
    isMmdbDerived?: boolean;
    countryCode?: string;
    asn?: string;
    org?: string;
    eventCount?: number;
    isBlacklisted?: boolean;
    ports?: any[];
}

export interface CaseFile {
  id: string;
  title: string;
  playbookId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'ESCALATED' | 'CLOSED' | 'CONTAINED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  currentStepId: string;
  artifacts: CaseArtifact[];
  history: { stepId: string, action: string, timestamp: string, user: string }[];
  comments?: CaseComment[];
  context: any; 
  created: string;
  updated: string;
  assignedTo?: string[];
  tags?: string[];
  linkedCaseIds?: string[];
}

export interface CaseComment {
    id: string;
    author: string;
    text: string;
    timestamp: string;
    attachments?: string[];
}

export interface CaseArtifact {
    id: string;
    type: 'IP' | 'IP:PORT' | 'DOMAIN' | 'FILE' | 'USER' | 'URL' | 'TEXT' | 'HASH' | 'EMAIL' | 'PCAP';
    value: string;
    note?: string;
    addedAt: string;
    tags?: string[];
    isMalicious?: boolean;
    enrichmentData?: any;
}

export interface WhitelistEntry {
    id: string;
    value: string;
    type: 'IP' | 'CIDR' | 'DOMAIN' | 'URL';
    note: string;
    addedAt: string;
}

export interface C2IntelFeedEntry {
    ip: string;
    Source: string;
    FirstSeen: string;
    LastSeen?: string;
    BeaconType?: string;
    C2Server?: string;
    C2Url?: string | string[];
    Port?: string;
    ASN?: string;
    ASNName?: string;
    Jitter?: string;
    SleepTime?: string;
    KillDate?: string;
    Watermark?: string;
    UserAgent?: string;
    HostHeader?: string;
    Key?: string | string[];
    HttpPostUri?: string;
    PipeName?: string;
}

export interface WebCheckResult {
    target: string;
    inputType: 'DOMAIN' | 'IP' | 'URL';
    dns: { a: string[]; aaaa: string[]; mx: string[]; txt: string[]; ns: string[]; cname: string[]; soa: string[] };
    http: { status: number; statusText: string; headers: Record<string, string>; redirects: string[]; securityHeaders: { name: string; value: string; valid: boolean }[]; server?: string; };
    page: { metaTags: Record<string, string>; techStack: string[]; hasRobotsTxt: boolean; hasSitemap: boolean; title?: string; };
    timestamp: number;
    visuals?: { screenshot: string; favicon: string };
    dnsSecurity: DnsBlockResult[];
    ipInfo?: IpDataResponse;
    blocklist?: { summary: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS'; sources: { name: string; detected: boolean; type: string; reference?: string }[] };
    otx?: OtxAnalysis | null;
    ct?: { subdomains: string[]; total: number; latest: CrtShEntry };
    archive?: WaybackResult;
    carbon?: { g: number; rating: string };
}

export interface DnsBlockResult {
    provider: string;
    status: 'BLOCKED' | 'CLEAN' | 'FAILED';
    type: 'RBL' | 'DNS_FILTER';
    filterType?: 'MALWARE' | 'ADS' | 'FAMILY' | 'GENERAL';
    details?: string;
}

export interface CrtShEntry {
    id: number;
    entry_timestamp: string;
    not_before: string;
    not_after: string;
    common_name: string;
    issuer_name: string;
    name_value: string;
}

export interface WaybackResult {
    available: boolean;
    url?: string;
    timestamp?: string;
    status?: string;
}

export enum MmdbStatus {
    OFFLINE = 'OFFLINE',
    ONLINE = 'ONLINE'
}

export interface MalpediaActor {
    value: string;
    description: string;
    uuid: string;
    threatScore: number;
    sophistication: 'Low' | 'Medium' | 'High' | 'Critical';
    scoreBreakdown: { activityScore: number; capabilityScore: number; impactScore: number };
    meta: { country?: string; refs: string[]; synonyms: string[] };
    mitreIds?: string[];
    malwareFamilies?: string[];
    source?: 'Malpedia' | 'MITRE';
    mitreAttackId?: string;
    ttpDetails?: { id: string; name: string; tactic: string; description?: string }[];
    ttps?: any[];
}

export interface MalpediaEntry {
    id: string;
    title: string;
    author?: string;
    date?: string;
    organization?: string;
    url?: string;
    language?: string;
    note?: string;
    year?: string;
}

export interface CveEntry {
    id: string;
    sourceIdentifier: string;
    published: string;
    lastModified: string;
    status: string;
    description: string;
    cvssScore: number;
    severity: string;
    vectorString: string;
    weaknesses: string[];
    references: { url: string; tags: string[] }[];
    configurations: string[];
    vendor: string;
    product: string;
    cweCategory: string;
    hasExploit: boolean;
    isKev: boolean;
    tags: string[];
    vector: { AV?: string; AC?: string; PR?: string; UI?: string; S?: string; C?: string; I?: string; A?: string; };
    epss?: { score: number; percentile: number };
    exploitAvailable?: boolean;
    cvss?: number;
}

export interface CveFeedItem {
    title: string;
    link: string;
    description: string;
    pubDate: string;
    source: 'CVEFeed' | 'ZDI' | 'CISA';
    category: 'Latest' | 'News' | 'High Sev' | 'Upcoming' | 'Advisory';
    cveIds: string[];
}

export type NewsCategory = 'Ransomware' | 'APT' | 'Phishing' | 'Vulnerability' | 'Breach' | 'Malware' | 'Cybercrime' | 'General';

export interface ThreatNewsItem {
    title: string;
    link: string;
    source: string;
    date: string;
    timestamp: number;
    description: string;
    category: NewsCategory;
    subCategory?: string; 
    isCve?: boolean; 
    cveIds?: string[];
    id?: string;
    published?: string;
    url?: string;
}

export interface ExploitEntry {
    id: string;
    timestamp: string;
    cveId: string;
    description: string;
    link: string;
}

export interface UrlHausEntry {
    id: string;
    dateadded: string;
    url: string;
    url_status: string;
    last_online: string;
    threat: string;
    tags: string[] | null;
    urlhaus_link: string;
    reporter: string;
}

export interface MalwareBazaarEntry {
    first_seen_utc: string;
    sha256_hash: string;
    md5_hash: string;
    sha1_hash: string;
    reporter: string;
    file_name: string;
    file_type_mime: string;
    signature: string;
    clamav: string;
    vtpercent: string;
    imphash: string;
    ssdeep: string;
    tlsh: string;
}

export interface FeodoTrackerEntry {
    ip_address: string;
    port: number;
    status: string;
    hostname: string;
    as_number: number;
    as_name: string;
    country: string;
    first_seen: string;
    last_online: string;
    malware: string;
}

export interface SslBlEntry {
    listingdate: string;
    sha1: string;
    listingreason: string;
}

export interface Ja3FingerprintEntry {
    ja3_md5: string;
    first_seen: string;
    last_seen: string;
    listingreason: string;
}

export interface ThreatFoxEntry {
    id: string;
    ioc_value: string;
    ioc_type: string;
    threat_type: string;
    malware: string;
    malware_printable: string;
    first_seen_utc: string;
    last_seen_utc: string | null;
    confidence_level: number;
    reference: string | null;
    tags: string[] | null;
    reporter: string;
}

export interface RansomWatchPost {
    post_title: string;
    group_name: string;
    discovered: string;
    description: string;
    website: string;
    country: string;
    activity: string;
    screenshot: string | null;
    source: string;
}

export interface RansomWatchGroup {
    name: string;
    locations: { slug: string; available: boolean; fqdn: string; version: number }[];
    meta: string | null;
}

export interface IpsumEntry {
    ip: string;
    blacklistCount: number;
}

export interface BlocklistDeEntry {
    ip: string;
    service: string;
    lastAttack: string;
    updated: string;
}

export interface MaliciousHashEntry {
    hash: string;
}

export enum AppState {
    IDLE = 'IDLE',
    ANALYZING = 'ANALYZING',
    RESULTS = 'RESULTS'
}

export type AppTheme = 'CYBER' | 'NORDIC' | 'EMBER' | 'SENTINEL' | 'FORTRESS' | 'DARK' | 'LIGHT' | 'TERMINAL';

export interface AppSettings {
    theme: AppTheme;
    animationsEnabled: boolean;
    retentionMinutes: number;
    showMap: boolean;
    productName: string;
    logoUrl: string;
}

export interface SystemLogEntry {
    id: string;
    timestamp: Date;
    level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';
    message: string;
    source: string;
}

export interface IpDataResponse {
    ip: string;
    is_eu: boolean;
    city: string;
    region: string;
    region_code: string;
    region_type: string | null;
    country_name: string;
    country_code: string;
    continent_name: string | null;
    continent_code: string | null;
    latitude: number;
    longitude: number;
    postal: string | null;
    calling_code: string | null;
    flag: string | null;
    emoji_flag: string | null;
    emoji_unicode: string | null;
    asn?: { asn: string; name: string; domain: string | null; route: string; type: string };
    company?: { name: string; domain: string | null; type: string; network: string };
    carrier?: { name: string; mcc: string; mnc: string };
    time_zone?: { name: string | null; abbr: string | null; offset: string | null; is_dst: boolean | null; current_time: string | null };
    currency?: { name: string; code: string; symbol: string; native: string; plural: string };
    languages?: { name: string; native: string; code: string }[];
    count?: number;
    threat: {
        is_tor: boolean;
        is_vpn: boolean;
        is_icloud_relay: boolean;
        is_proxy: boolean;
        is_datacenter: boolean;
        is_anonymous: boolean;
        is_known_attacker: boolean;
        is_known_abuser: boolean;
        is_bot: boolean;
        is_threat: boolean;
        is_bogon: boolean;
        blocklists?: any[];
        scores?: { threat_score: number; trust_score: number };
    };
    shodan?: ShodanData;
    isMmdbDerived?: boolean;
}

export interface ExtendedSecurityInfo {
    rblBlockStatus: DnsBlockResult[];
    domain?: string;
}

export interface ShodanData {
    cpes: string[];
    hostnames: string[];
    ip: string;
    ports: number[];
    tags: string[];
    vulns: string[];
}

export type NodeType = 'ROOT' | 'IP' | 'THREAT' | 'MALWARE' | 'STIX_ACTOR' | 'STIX_MALWARE' | 'STIX_TOOL' | 'STIX_CAMPAIGN' | 'STIX_INDICATOR' | 'STIX_VULN' | 'STIX_IDENTITY' | 'ASN' | 'COUNTRY';

export interface GraphNode {
    id: string;
    label: string;
    type: NodeType;
    val: number;
    color: string;
    data?: any;
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
}

export interface GraphLink {
    source: string | GraphNode;
    target: string | GraphNode;
    color?: string;
    value?: number;
    label?: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export interface NetworkAnalysisResult {
    packets: NetworkPacket[];
    streams: TcpStream[];
    files: ExtractedFile[];
    stats: any;
    dns: { query: string; type: string; count: number; clientIp: string }[];
    fileType: string;
    tlsFingerprints: Ja3Info[];
    anomalies: AnomalyRecord[];
    dnsGraph: GraphData;
    iocs: IocCollection;
    forensicStats: {
        credentials: number;
        dns: number;
        httpHeaders: number;
        connections: number;
        openPorts: number;
        sslTls: number;
        pictures: number;
        http: number;
        smb: number;
        servers: number;
        documents: number;
        network: number;
        ftp: number;
        telnet: number;
        ssdp: number;
        sip: number;
        arp: number;
        ethernet: number;
        wifi: number;
        hosts: number;
    };
    actorMatches: ActorMatch[];
    ipEnrichment: Record<string, IpDataResponse>;
}

export interface EmailAnalysisResult {
    subject: string;
    from: string;
    to: string;
    date: string;
    messageId: string;
    returnPath: string;
    replyTo?: string;
    hops: EmailHop[];
    auth: EmailAuthResult;
    securityHeaders: Record<string, string>;
    client: { userAgent: string; mailer: string; mimeVersion: string; originatingIp?: string };
    riskScore: number;
    riskFactors: string[];
    bodyPreview: string;
    attachments: EmailAttachment[];
    rawHeaders: string;
    iocs: { value: string; type: string }[];
    pgpInfo: { hasPgp: boolean; method: string; keyData: string };
}

export interface EmailHop {
    hopNum: number;
    from: string;
    by: string;
    with?: string;
    ip?: string;
    date: string;
    timestamp: number;
    isPrivate: boolean;
    delaySeconds: number;
    enrichment?: IpDataResponse;
    country?: string;
    asn?: string;
}

export interface EmailAuthResult {
    spf: { status: string; detail: string };
    dkim: { status: string; detail: string };
    dmarc: { status: string; detail: string };
    arc: { status: string; detail: string };
}

export interface EmailAttachment {
    filename: string;
    fileType: string;
    size: string;
    hash: string;
    entropy: number;
    magic: string;
}

export interface NetworkPacket {
    id: number;
    timestamp: number;
    displayTime: string;
    source: string;
    destination: string;
    protocol: string;
    length: number;
    info: string;
    sourcePort: string;
    destPort: string;
    raw: Uint8Array;
    details: any;
}

export interface TcpStream {
    id: string;
    packetCount: number;
    bytes: number;
    startTime: number;
    endTime: number;
    duration: number;
    srcIp: string;
    dstIp: string;
    srcPort: number;
    dstPort: number;
    protocol: string;
    application: string;
    state: string;
    retransmissions: number;
    payloads: { direction: 'CLIENT_TO_SERVER' | 'SERVER_TO_CLIENT'; data: Uint8Array; timestamp: number; seq: number }[];
    anomalyScore: number;
    metadata?: any;
}

export interface ExtractedFile {
    id: string;
    name: string;
    type: string;
    size: number;
    sourceStream: string;
    entropy: number;
    hash: any;
    data: Blob;
    isCompressed: boolean;
}

export interface IocCollection {
    ips: string[];
    domains: string[];
    urls: string[];
    userAgents: string[];
    emails: string[];
}

export interface ActorMatch {
    actor: MalpediaActor;
    trigger: string;
    type: 'IOC' | 'TTP';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface Ja3Info {
    hash: string;
    string: string;
    count: number;
    riskScore: number;
}

export interface AnomalyRecord {
    id: string;
    type: string;
    description: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    flowId?: string;
    packetId?: number;
    timestamp: number;
    value: number | string;
}

export interface OtxAnalysis {
    reputation: number;
    pulse_count: number;
    tags: string[];
    malware_families: string[];
    adversaries: string[];
    industries: string[];
    attack_ids: string[];
    pulses: OtxPulse[];
    targeted_countries: string[];
}

export interface OtxPulse {
    id: string;
    name: string;
    description: string;
    tags: string[];
    malware_families: string[];
    adversary: string;
    industries: string[];
    attack_ids: string[];
    created: string;
    author_name: string;
    targeted_countries: string[];
    modified?: string;
    TLP?: string;
    upvotes_count?: number;
    downvotes_count?: number;
    votes_count?: number;
}

export type RuleType = 'YARA' | 'SIGMA' | 'SURICATA' | 'KQL' | 'ZEEK' | 'OSSEC' | 'SNORT' | 'SYSMON';

export interface SocRule {
    id: string;
    name: string;
    type: RuleType;
    content: string;
    source: string;
    tags: string[];
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
    status: 'DRAFT' | 'REVIEW' | 'STAGING' | 'ACTIVE' | 'DEPRECATED';
    author?: string;
    date: string;
    mitreAttack?: string[];
    versions?: SocRuleVersion[];
    testCases?: RuleTestCase[];
}

export interface SocRuleVersion {
    version: number;
    content: string;
    date: string;
    author: string;
}

export interface RuleTestCase {
    id: string;
    name: string;
    log: string;
    shouldMatch: boolean;
    lastResult?: { match: boolean; passed: boolean; timestamp: string; details: string };
}

export interface RuleSource {
    id: string;
    name: string;
    url: string;
    type: RuleType | 'MIXED';
    enabled: boolean;
    lastSync: number | null;
    count: number;
    description: string;
}

export interface OtxSandboxReport {
    analysis: {
        info: {
            results: {
                sha256: string;
                md5: string;
                file_type: string;
                filesize: number;
                start_time: string;
                end_time: string;
            }
        };
        plugins: {
            yarad?: { results: { detection: { rule_name: string; description?: string; strings?: string[] }[] } };
            clamav?: { results: { detection: string } };
            msdefender?: { results: { detection: string } };
            suricata?: { results: { alerts: { signature: string; category: string; severity: string }[] } };
            cuckoo?: { result: { network: { dns: { request: string; type: string }[]; http: { uri: string; method: string; host: string }[] } } };
            pe32info?: { results: { sections: { Name: string; SizeOfRawData: number; entropy: number }[]; imports: { dll: string; name: string }[]; version_information?: { name: string; value: string }[]; resource_strings?: string[] } };
            peanomal?: { results: { anomalies: number; detection: { name: string }[] } };
            exiftool?: { results: Record<string, any> };
            strings?: { results: string[] };
            disa_entrypoint?: { results: { instructions: string[] } };
        };
    };
}

export interface SandboxNetworkLog {
    id: string;
    timestamp: string;
    method: string;
    url: string;
    status: number;
    type: string;
    size: number;
    blocked: boolean;
}

export interface DomMutationLog {
    id: string;
    timestamp: string;
    type: 'ADD' | 'REMOVE' | 'MODIFY';
    target: string;
    detail: string;
}

export interface DarkwebScreenshot {
    imageBase64: string;
    extractedText: string;
    title: string;
    timestamp: string;
}

export interface SandboxTab {
    id: string;
    url: string;
    title: string;
    loading: boolean;
    threatScore: number;
    threatCategory: 'SAFE' | 'SUSPICIOUS' | 'MALICIOUS' | 'UNKNOWN';
    threatSignatures?: string[];
    isDarkweb: boolean;
}

export interface CertStreamEvent {
    message_type: string;
    data: {
        leaf_cert: {
            all_domains: string[];
            issuer: { O: string };
        };
    };
}

export interface SuspiciousCert {
    id: string;
    timestamp: number;
    domain: string;
    issuer: string;
    score: number;
    keywordMatched: string;
    isTypo: boolean;
}

export interface TyposquatResult {
    original: string;
    variation: string;
    type: 'OMISSION' | 'REPETITION' | 'TRANSPOSITION' | 'REPLACEMENT' | 'INSERTION' | 'HOMOGLYPH' | 'COMBO' | 'BITSQUATTING' | 'VOWEL_SWAP' | 'HYPHENATION' | 'SUBDOMAIN' | 'TLD';
    isRegistered: boolean;
    ip?: string;
    country?: string;
    dns?: { a: string[]; mx: string[]; ns: string[] };
    screenshotUrl?: string;
    logoMatchScore?: number;
    hasMx?: boolean;
    phoneticMatch?: boolean;
}

export interface PlaybookStep {
    id: string;
    title: string;
    description: string;
    type: 'ACTION' | 'DECISION' | 'AUTOMATION' | 'INPUT';
    nextStepId?: string;
    options?: { label: string; nextStepId: string; style: 'positive' | 'negative' | 'neutral' }[];
    automationId?: string;
    inputType?: string;
}

export interface Playbook {
    id: string;
    name: string;
    description: string;
    severity: 'Medium' | 'High' | 'Critical' | 'Low';
    tags: string[];
    startStepId: string;
    steps: Record<string, PlaybookStep>;
}

export interface InventoryAsset {
    id: string;
    vendor: string;
    product: string;
    version: string;
    criticality: 'Low' | 'Medium' | 'High' | 'Critical';
    tags: string[];
    addedAt: string;
    cpe: string;
}

export interface VulnMatch {
    assetId: string;
    cveId: string;
    cve: CveEntry;
    priorityScore: number;
    remediationStatus: 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
    matchDetails: string;
    factors: string[];
}

export interface ClusterGroup {
    id: string;
    label: string;
    count: number;
    riskScore: number;
    items: AnalyzedHost[];
}

export interface DnsLayer {
    transactionId: number;
    flags: number;
    questions: { name: string; type: string; class: string }[];
    answers: { name: string; type: string; ttl: number; data: string }[];
}

export interface TlsLayer {
    contentType: number;
    version: string;
    sni?: string;
    cipherSuites: number[];
    extensions: number[];
    ja3: string;
}

export interface DhcpLayer {
    type: string;
    transactionId: number;
    clientMac: string;
    hostname?: string;
    requestedIp?: string;
    options: Record<number, any>;
}

export interface LdapLayer {
    messageId: number;
    operation: string;
    dn?: string;
}

export interface HttpLayer {
    method: string;
    uri: string;
    host?: string;
    userAgent?: string;
    contentType?: string;
    responseCode?: number;
}
