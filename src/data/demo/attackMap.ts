import { SHARED_ENTITIES } from './entities';
import type { LogEventV2 } from '../../../api/services';

export const DEMO_EVENTS: LogEventV2[] = [
  {
    id: SHARED_ENTITIES.event,
    timestamp: new Date().toISOString(),
    src_ip: SHARED_ENTITIES.ip,
    dst_ip: '10.0.0.5',
    dest_port: 3389,
    service: 'RDP',
    protocol: 'TCP',
    action: 'allowed',
    severity: 'high',
    event_type: 'lateral_movement',
    geoip: {
      country_name: 'Russia',
      country_code: 'RU',
      city_name: 'Moscow',
      latitude: 55.7558,
      longitude: 37.6173
    }
  }
];
