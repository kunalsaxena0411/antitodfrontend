const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views/WebCheckView.tsx';
let d = fs.readFileSync(p, 'utf8');

d = d
  // Replace explicit hardcoded blue/slate hexes
  .replace(/bg-\[\#0f172a\]/g, 'bg-[#0A0A0A]')
  .replace(/bg-\[\#020617\]/g, 'bg-[#0A0A0A]')
  .replace(/bg-\[\#050b1a\]/g, 'bg-[#151515]')
  .replace(/bg-\[\#1e293b\]/g, 'bg-[#151515]')
  
  // Replace slate classes
  .replace(/bg-slate-900/g, 'bg-[#0A0A0A]')
  .replace(/bg-slate-950/g, 'bg-[#0A0A0A]')
  .replace(/bg-slate-800/g, 'bg-[#151515]')
  .replace(/bg-slate-700/g, 'bg-[#1C1C1C]')
  .replace(/text-slate-200/g, 'text-white')
  .replace(/text-slate-300/g, 'text-[#AAA]')
  .replace(/text-slate-400/g, 'text-[#888]')
  .replace(/text-slate-500/g, 'text-[#666]')
  .replace(/border-slate-800/g, 'border-[#222]')
  .replace(/border-slate-700/g, 'border-[#333]')

  // Replace blue classes
  .replace(/text-blue-200/g, 'text-[#AAA]')
  .replace(/text-blue-300/g, 'text-[#888]')
  .replace(/text-blue-400/g, 'text-[#666]')
  .replace(/text-blue-500/g, 'text-[#555]')
  .replace(/border-blue-500\/30/g, 'border-red-500/30')
  .replace(/border-blue-500\/50/g, 'border-red-500/50')
  .replace(/focus:border-blue-500/g, 'focus:border-red-500')
  .replace(/focus:ring-blue-500\/30/g, 'focus:ring-red-500/30')
  
  // Replace neutral background classes with hex for safety
  .replace(/bg-neutral-900\/[0-9]+/g, 'bg-[#111]')
  .replace(/bg-neutral-900/g, 'bg-[#0A0A0A]')
  .replace(/bg-neutral-800/g, 'bg-[#151515]')
  .replace(/bg-neutral-700/g, 'bg-[#1C1C1C]')
  .replace(/text-neutral-500/g, 'text-[#888]')
  .replace(/text-neutral-400/g, 'text-[#AAA]')
  .replace(/border-neutral-800/g, 'border-[#222]')
  .replace(/border-neutral-700/g, 'border-[#333]')
  
  // Fix the main container background (often it's 'bg-[#0a0f1c]' or similar)
  .replace(/bg-\[\#0a0f1c\]/g, 'bg-[#0A0A0A]')
  .replace(/bg-\[\#0b1120\]/g, 'bg-[#0A0A0A]');

fs.writeFileSync(p, d, 'utf8');
console.log('Replaced all non-compliant colors in WebCheckView');
