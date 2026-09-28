import { SHARED_ENTITIES } from './entities';
import type { MalpediaActor } from '../../../types';

export const DEMO_ACTORS: MalpediaActor[] = [
  {
    value: SHARED_ENTITIES.actor,
    uuid: 'actor-1',
    description: 'A well-resourced APT group known for targeting critical infrastructure and utilizing advanced persistence mechanisms.',
    
    synonyms: ['Fancy Bear', 'APT28'],
    mitre_id: 'G0007',
    mitre_url: 'https://attack.mitre.org/groups/G0007/'
  }
];
