const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views';
const files = fs.readdirSync(dir);

files.forEach(f => {
  if (f.endsWith('.tsx')) {
    const p = path.join(dir, f);
    let d = fs.readFileSync(p, 'utf8');
    let modified = false;

    // Purge explicit slate hex colors and tailwind slate classes
    if (d.match(/bg-\[\#0f172a\]|bg-\[\#020617\]|bg-\[\#050b1a\]|bg-slate-[0-9]{3}|text-slate-[0-9]{3}/)) {
      d = d.replace(/bg-\[\#0f172a\]|bg-\[\#020617\]|bg-\[\#050b1a\]/g, 'bg-[#0A0A0A]')
           .replace(/bg-slate-9[05]0/g, 'bg-[#0A0A0A]')
           .replace(/bg-slate-[78]00/g, 'bg-[#151515]')
           .replace(/text-slate-[234]00/g, 'text-[#AAA]')
           .replace(/text-slate-[56]00/g, 'text-[#666]');
      modified = true;
    }

    // Purge ambiguous neutral background colors to enforce pure hex values
    if (d.match(/bg-neutral-[789]00/)) {
      d = d.replace(/bg-neutral-900\/\d+/g, 'bg-[#111]')
           .replace(/bg-neutral-900/g, 'bg-[#0A0A0A]')
           .replace(/bg-neutral-800/g, 'bg-[#151515]')
           .replace(/bg-neutral-700/g, 'bg-[#1C1C1C]')
           .replace(/text-neutral-500/g, 'text-[#888]')
           .replace(/text-neutral-400/g, 'text-[#AAA]')
           .replace(/border-neutral-800/g, 'border-[#222]')
           .replace(/border-neutral-700/g, 'border-[#333]');
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(p, d, 'utf8');
      console.log('Purged ' + f);
    }
  }
});
console.log('Global purge complete.');
