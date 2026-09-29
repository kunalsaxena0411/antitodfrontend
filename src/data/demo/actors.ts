import { SHARED_ENTITIES } from './entities';
import type { MalpediaActor } from '../../../types';

export const DEMO_ACTORS: MalpediaActor[] = [
  {
    value: SHARED_ENTITIES.actor,
    uuid: 'actor-1',
    description: 'A well-resourced APT group known for targeting critical infrastructure and utilizing advanced persistence mechanisms.',
    synonyms: ['Fancy Bear', 'APT28', 'Iron Twilight'],
    mitre_id: 'G0007',
    mitre_url: 'https://attack.mitre.org/groups/G0007/'
  },
  {
    value: 'Lazarus Group',
    uuid: 'actor-2',
    description: 'A state-sponsored group primarily focused on cyber espionage and financial theft, using custom malware and destructive attacks.',
    synonyms: ['Hidden Cobra', 'Guardians of Peace', 'ZINC'],
    mitre_id: 'G0032',
    mitre_url: 'https://attack.mitre.org/groups/G0032/'
  },
  {
    value: 'Equation Group',
    uuid: 'actor-3',
    description: 'A highly sophisticated threat actor associated with extensive cyber espionage campaigns and the deployment of complex zero-day exploits.',
    synonyms: ['EQGRP'],
    mitre_id: 'G0020',
    mitre_url: 'https://attack.mitre.org/groups/G0020/'
  },
  {
    value: 'Turla',
    uuid: 'actor-4',
    description: 'A long-standing Russian-based threat group known for targeting government, military, and diplomatic entities globally.',
    synonyms: ['Snake', 'Uroburos', 'Venomous Bear'],
    mitre_id: 'G0010',
    mitre_url: 'https://attack.mitre.org/groups/G0010/'
  },
  {
    value: 'Sandworm Team',
    uuid: 'actor-5',
    description: 'A destructive threat actor known for targeting energy sectors and deploying wiper malware, including the infamous NotPetya attack.',
    synonyms: ['Voodoo Bear', 'Electrum', 'Iron Viking'],
    mitre_id: 'G0034',
    mitre_url: 'https://attack.mitre.org/groups/G0034/'
  },
  {
    value: 'APT29',
    uuid: 'actor-6',
    description: 'A sophisticated espionage group focused on intelligence gathering, frequently targeting government networks and think tanks.',
    synonyms: ['Cozy Bear', 'The Dukes', 'YTTRIUM'],
    mitre_id: 'G0016',
    mitre_url: 'https://attack.mitre.org/groups/G0016/'
  }
];
