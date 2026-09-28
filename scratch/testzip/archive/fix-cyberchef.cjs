const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views/CyberChefView.tsx';
let d = fs.readFileSync(p, 'utf8');

d = d
  .replace(/bg-neutral-900\/\d+/g, 'bg-[#111]')
  .replace(/bg-neutral-900/g, 'bg-[#0A0A0A]')
  .replace(/bg-neutral-800/g, 'bg-[#151515]')
  .replace(/bg-neutral-700/g, 'bg-[#1C1C1C]')
  .replace(/text-neutral-500/g, 'text-[#888]')
  .replace(/text-neutral-600/g, 'text-[#666]')
  .replace(/text-neutral-400/g, 'text-[#AAA]')
  .replace(/border-neutral-800/g, 'border-[#222]')
  .replace(/border-neutral-700/g, 'border-[#333]');

fs.writeFileSync(p, d, 'utf8');
console.log('Replaced neutral with hard hex codes in CyberChef');
