import { SHARED_ENTITIES } from './entities';
import type { LogEventV2 } from '../../../api/services';

const generateMockEvents = (): LogEventV2[] => {
  const events: LogEventV2[] = [];
  const now = Date.now();
  
  // Generate 200 events spread across the last 24 hours
  const countryCodes = ['CN', 'RU', 'US', 'DE', 'NL', 'BR', 'IN', 'VN', 'KR', 'IR', 'KP', 'UA', 'FR', 'JP'];
  const countries = ['China', 'Russia', 'United States', 'Germany', 'Netherlands', 'Brazil', 'India', 'Vietnam', 'South Korea', 'Iran', 'North Korea', 'Ukraine', 'France', 'Japan'];
  for (let i = 0; i < 200; i++) {
    // Randomly pick a time in the last 24h
    const timeOffset = Math.random() * 24 * 60 * 60 * 1000;
    const timestamp = new Date(now - timeOffset).toISOString();
    
    // Pick a severity based on distribution
    const rand = Math.random();
    const severity = rand > 0.95 ? 'critical' : rand > 0.8 ? 'high' : rand > 0.4 ? 'medium' : 'low';
    
    const event_type = rand > 0.8 ? 'lateral_movement' : rand > 0.5 ? 'brute_force' : 'scan';
    const action = rand > 0.9 ? 'allowed' : 'blocked';
    
    const countryIndex = Math.floor(Math.random() * countryCodes.length);
    
    events.push({
      id: `EVT-${10000 + i}`,
      event_id: `EVT-${10000 + i}`,
      timestamp,
      honeypot: 'cowrie',
      src_ip: rand > 0.8 ? SHARED_ENTITIES.ip : `192.168.1.${Math.floor(Math.random() * 255)}`,
      src_port: Math.floor(Math.random() * 65535),
      dst_ip: '10.0.0.5',
      dst_port: rand > 0.7 ? 3389 : 22,
      protocol: 'TCP',
      event_type,
      severity,
      country: countries[countryIndex],
      countryCode: countryCodes[countryIndex]
    });
  }
  
  return events;
};

export const DEMO_EVENTS: LogEventV2[] = generateMockEvents();
