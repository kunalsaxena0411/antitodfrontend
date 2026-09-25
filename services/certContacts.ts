
export interface CertContact {
    country: string;
    name: string;
    email: string;
    website: string;
}

export const CERT_CONTACTS: Record<string, CertContact> = {
    'US': { country: 'United States', name: 'US-CERT / CISA', email: 'cert@cisa.dhs.gov', website: 'https://www.cisa.gov/report' },
    'GB': { country: 'United Kingdom', name: 'NCSC-UK', email: 'incident@ncsc.gov.uk', website: 'https://www.ncsc.gov.uk/' },
    'IN': { country: 'India', name: 'CERT-In', email: 'incident@cert-in.org.in', website: 'https://www.cert-in.org.in/' },
    'CN': { country: 'China', name: 'CNCERT/CC', email: 'cncert@cert.org.cn', website: 'https://www.cert.org.cn/' },
    'RU': { country: 'Russia', name: 'GOV-CERT.RU', email: 'support@gov-cert.ru', website: 'https://gov-cert.ru/' },
    'DE': { country: 'Germany', name: 'CERT-Bund', email: 'certbw@bsi.bund.de', website: 'https://www.bsi.bund.de/' },
    'JP': { country: 'Japan', name: 'JPCERT/CC', email: 'info@jpcert.or.jp', website: 'https://www.jpcert.or.jp/' },
    'FR': { country: 'France', name: 'CERT-FR', email: 'cert-fr.cossi@ssi.gouv.fr', website: 'https://www.cert.ssi.gouv.fr/' },
    'BR': { country: 'Brazil', name: 'CERT.br', email: 'cert@cert.br', website: 'https://www.cert.br/' },
    'CA': { country: 'Canada', name: 'CCCS', email: 'contact@cyber.gc.ca', website: 'https://cyber.gc.ca/' },
    'AU': { country: 'Australia', name: 'ACSC', email: 'asd.assist@defence.gov.au', website: 'https://www.cyber.gov.au/' },
    'NL': { country: 'Netherlands', name: 'NCSC-NL', email: 'cert@ncsc.nl', website: 'https://www.ncsc.nl/' },
    'KR': { country: 'South Korea', name: 'KrCERT/CC', email: 'cert@krcert.or.kr', website: 'https://www.krcert.or.kr/' },
    'TR': { country: 'Turkey', name: 'USOM', email: 'usom@btk.gov.tr', website: 'https://www.usom.gov.tr/' },
    'ID': { country: 'Indonesia', name: 'ID-CERT', email: 'incident@cert.or.id', website: 'https://www.cert.or.id/' },
    'SG': { country: 'Singapore', name: 'SingCERT', email: 'singcert@csa.gov.sg', website: 'https://www.csa.gov.sg/singcert' },
    'UA': { country: 'Ukraine', name: 'CERT-UA', email: 'cert@cert.gov.ua', website: 'https://cert.gov.ua/' },
    'PL': { country: 'Poland', name: 'CERT Polska', email: 'info@cert.pl', website: 'https://www.cert.pl/' },
    'ES': { country: 'Spain', name: 'CCN-CERT', email: 'info@ccn-cert.cni.es', website: 'https://www.ccn-cert.cni.es/' },
    'IT': { country: 'Italy', name: 'CSIRT Italia', email: 'info@csirt.gov.it', website: 'https://csirt.gov.it/' },
    'CH': { country: 'Switzerland', name: 'NCSC-CH', email: 'incident@ncsc.admin.ch', website: 'https://www.ncsc.admin.ch/' },
    'SE': { country: 'Sweden', name: 'CERT-SE', email: 'cert@cert.se', website: 'https://www.cert.se/' },
    'IR': { country: 'Iran', name: 'MAHER', email: 'cert@maher.ir', website: 'https://maher.ir/' },
    'VN': { country: 'Vietnam', name: 'VNCERT', email: 'ir@vncert.vn', website: 'https://vncert.vn/' },
    'ZA': { country: 'South Africa', name: 'CSIRT-ZA', email: 'report@csirt.co.za', website: 'https://csirt.co.za/' },
    'AE': { country: 'UAE', name: 'aeCERT', email: 'info@aecert.ae', website: 'https://www.aecert.ae/' },
    'IL': { country: 'Israel', name: 'CERT-IL', email: 'cert@cert.gov.il', website: 'https://www.gov.il/en/departments/israel_national_cyber_directorate' },
};

export const getCertContact = (countryCode: string): CertContact | null => {
    if (!countryCode) return null;
    // Basic normalization
    const code = countryCode.toUpperCase().trim();
    return CERT_CONTACTS[code] || null;
};
