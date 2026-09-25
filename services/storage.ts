export const STORES = {
  ANALYSIS: 'analysis_results',
  ACTORS: 'malpedia_actors',
  CVES: 'cve_data',
  REFS: 'malpedia_refs',
  URLHAUS: 'urlhaus_data',
  BAZAAR: 'malware_bazaar',
  FEODO: 'feodo_tracker',
  SSLBL_SHA1: 'sslbl_sha1',
  SSLBL_JA3: 'sslbl_ja3',
  THREATFOX: 'threatfox_data',
  IPSUM: 'ipsum_data',
  RANSOMWARE_POSTS: 'ransomware_posts',
  RANSOMWARE_GROUPS: 'ransomware_groups',
  BLOCKLIST_DE: 'blocklist_de',
  WHITELIST: 'whitelist_entries',
  C2_INTEL: 'c2_intel_feed',
  NETWORK_FORENSICS: 'network_forensics',
  EMAIL_FORENSICS: 'email_forensics',
  INTEL_RESEARCH: 'intel_research_history',
  THREAT_MODELS: 'threat_models',
  CUSTOM_STENCILS: 'custom_stencils',
  NETWORK_TOPOLOGY_LIBRARY: 'network_topology_library'
};

const DB_NAME = 'XyberahDB';
const DB_VERSION = 11; // Bumped for new library store

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      Object.values(STORES).forEach(store => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      });
    };
  });
};

export const saveToStorage = async (storeName: string, data: any, key: string = 'root') => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const putReq = store.put(data, key);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
    });
  } catch (e) {
      console.error(`Failed to save to ${storeName}`, e);
  }
};

export const loadFromStorage = async (storeName: string, key: string = 'root'): Promise<any> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
  } catch (e) {
      return null;
  }
};

export const clearStorage = async () => {
    try {
        const db = await initDB();
        const stores = Object.values(STORES);
        const transaction = db.transaction(stores, 'readwrite');
        stores.forEach(s => transaction.objectStore(s).clear());
        return new Promise<void>((resolve) => {
            transaction.oncomplete = () => resolve();
        });
    } catch (e) {
        console.error("Failed to clear storage", e);
    }
};