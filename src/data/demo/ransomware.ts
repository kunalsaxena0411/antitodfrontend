import { RansomWatchPost, RansomWatchGroup } from '../../types';

export const DEMO_RANSOMWARE_POSTS: RansomWatchPost[] = [
    {
        post_title: "Global Logistics Corp",
        group_name: "LockBit 3.0",
        discovered: new Date(Date.now() - 3600000).toISOString(),
        description: "500GB of sensitive corporate data including financial records and employee PII.",
        website: "www.example-logistics.com",
        country: "US",
        activity: "Data Published",
        screenshot: null,
        source: "Ransomware.live"
    },
    {
        post_title: "EuroHealth Systems",
        group_name: "ALPHV",
        discovered: new Date(Date.now() - 7200000).toISOString(),
        description: "Patient records and hospital database.",
        website: "www.example-health.eu",
        country: "DE",
        activity: "Extortion",
        screenshot: null,
        source: "Ransomware.live"
    },
    {
        post_title: "TechManufacturing Inc",
        group_name: "Clop",
        discovered: new Date(Date.now() - 86400000).toISOString(),
        description: "Source code and engineering schematics.",
        website: "www.example-tech.com",
        country: "JP",
        activity: "Data Published",
        screenshot: null,
        source: "RansomWatch"
    }
];

export const DEMO_RANSOMWARE_GROUPS: RansomWatchGroup[] = [
    {
        name: "LockBit 3.0",
        locations: ["http://lockbitxxxxxx.onion"],
        profile: ["http://lockbitxxxxxx.onion"],
        meta: "Highly active RaaS"
    },
    {
        name: "ALPHV",
        locations: ["http://alphvxxxxxx.onion"],
        profile: ["http://alphvxxxxxx.onion"],
        meta: "Also known as BlackCat"
    },
    {
        name: "Clop",
        locations: ["http://clopxxxxxx.onion"],
        profile: ["http://clopxxxxxx.onion"],
        meta: "Exploits zero-days"
    }
];
