
import { Reader } from 'mmdb-lib';
import { Buffer } from 'buffer';
import { IpDataResponse } from '../types';

// Polyfill Buffer for browser environment if not already present
// mmdb-lib relies on Buffer being available globally in some environments
if (typeof window !== 'undefined') {
    (window as any).Buffer = (window as any).Buffer || Buffer;
}
if (typeof globalThis !== 'undefined') {
    (globalThis as any).Buffer = (globalThis as any).Buffer || Buffer;
}

export class MmdbService {
    private cityReader: Reader<any> | null = null;
    private asnReader: Reader<any> | null = null;

    constructor() {}

    public async loadDatabase(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const buffer = Buffer.from(arrayBuffer);
                    const dbReader = new Reader(buffer);
                    
                    const type = dbReader.metadata.databaseType || 'Unknown';
                    console.log(`Loaded MMDB: ${type}`);

                    if (type.includes('City') || type.includes('Country')) {
                        this.cityReader = dbReader;
                        resolve(type);
                    } else if (type.includes('ASN')) {
                        this.asnReader = dbReader;
                        resolve('ASN');
                    } else {
                        // Fallback heuristic if metadata is vague
                        if (file.name.toLowerCase().includes('city') || file.name.toLowerCase().includes('country')) {
                            this.cityReader = dbReader;
                            resolve('City/Country');
                        } else if (file.name.toLowerCase().includes('asn')) {
                            this.asnReader = dbReader;
                            resolve('ASN');
                        } else {
                             // Default to City/Country if unknown
                             this.cityReader = dbReader;
                             resolve('Unknown (Treated as Geo)');
                        }
                    }
                } catch (err) {
                    console.error("Failed to load MMDB", err);
                    reject(err);
                }
            };
            reader.onerror = () => reject(new Error("Failed to read MMDB file"));
            reader.readAsArrayBuffer(file);
        });
    }

    public getStatus() {
        return {
            city: this.cityReader !== null,
            asn: this.asnReader !== null
        };
    }

    public lookup(ip: string): IpDataResponse | null {
        if (!this.cityReader && !this.asnReader) return null;

        try {
            let cityResult: any = null;
            let asnResult: any = null;

            if (this.cityReader) cityResult = this.cityReader.get(ip);
            if (this.asnReader) asnResult = this.asnReader.get(ip);

            if (!cityResult && !asnResult) return null;

            // Map City Data
            const countryName = cityResult?.country?.names?.en || cityResult?.registered_country?.names?.en || 'Unknown';
            const countryCode = cityResult?.country?.iso_code || cityResult?.registered_country?.iso_code || 'XX';
            const city = cityResult?.city?.names?.en || 'Unknown';
            const region = cityResult?.subdivisions && cityResult?.subdivisions.length > 0 ? cityResult.subdivisions[0].names?.en : 'Unknown';
            
            // Map ASN Data
            const asnData = asnResult ? {
                asn: `AS${asnResult.autonomous_system_number}`,
                name: asnResult.autonomous_system_organization || 'Unknown',
                domain: '', // Not always in simple MMDB
                route: '', 
                type: 'isp'
            } : undefined;

            // Construct merged response
            return {
                ip: ip,
                is_eu: cityResult?.country?.is_in_european_union || false,
                city: city,
                region: region,
                country_name: countryName,
                country_code: countryCode,
                flag: `https://flagcdn.com/w40/${countryCode.toLowerCase()}.png`,
                latitude: cityResult?.location?.latitude,
                longitude: cityResult?.location?.longitude,
                asn: asnData,
                threat: {
                    is_tor: false,
                    is_icloud_relay: false,
                    is_proxy: false,
                    is_datacenter: false,
                    is_anonymous: false,
                    is_known_attacker: false,
                    is_known_abuser: false,
                    is_bot: false
                },
                isMmdbDerived: true
            } as unknown as IpDataResponse;

        } catch (error) {
            console.warn(`MMDB lookup failed for ${ip}`, error);
            return null;
        }
    }
}

export const mmdbService = new MmdbService();

