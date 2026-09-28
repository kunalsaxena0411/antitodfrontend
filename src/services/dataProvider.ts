import {
  DEMO_CVES,
  DEMO_ACTORS,
  DEMO_IOCS,
  DEMO_EVENTS,
  DEMO_INVESTIGATIONS,
  DEMO_RULES,
  DEMO_PLAYBOOKS,
  DEMO_NEWS,
  DEMO_DASHBOARD,
  DEMO_HOSTS,
  DEMO_CVE_FEEDS,
  DEMO_INTEL_HISTORY
} from '../data/demo';

import { fetchThreatNews } from '../../services/news';
import { fetchCveUpdates } from '../../services/cve';
import { fetchRemoteMalpedia } from '../../services/malpedia';

const DEMO_MODE = true; // Temporary flag to indicate we are in design-review fallback mode

// We wrap real API calls with a try/catch. If API is missing or fails, we return the demo data.
export const dataProvider = {
  getHosts: async () => {
    return DEMO_HOSTS;
  },
  getCveFeeds: async () => {
    return DEMO_CVE_FEEDS;
  },
  getDashboardMetrics: async () => {
    return DEMO_DASHBOARD;
  },

  getAttackEvents: async () => {
    return DEMO_EVENTS;
  },

  getInvestigations: async () => {
    return DEMO_INVESTIGATIONS;
  },

  getIntelHistory: async () => {
    return DEMO_INTEL_HISTORY;
  },

  getRules: async () => {
    return DEMO_RULES;
  },

  getPlaybooks: async () => {
    return DEMO_PLAYBOOKS;
  },

  getNews: async () => {
    try {
      const data = await fetchThreatNews();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn("Failed to fetch live news, falling back to demo data.", e);
    }
    return DEMO_NEWS;
  },

  getCves: async () => {
    try {
      const data = await fetchCveUpdates();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn("Failed to fetch live CVEs, falling back to demo data.", e);
    }
    return DEMO_CVES;
  },

  getActors: async () => {
    try {
      const data = await fetchRemoteMalpedia();
      if (data && data.length > 0) return data;
    } catch (e) {
      console.warn("Failed to fetch live actors, falling back to demo data.", e);
    }
    return DEMO_ACTORS;
  },
  
  getIocs: async () => {
    return DEMO_IOCS;
  }
};



