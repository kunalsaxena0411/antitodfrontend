const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views/NetworkToolsView.tsx';
let d = fs.readFileSync(p, 'utf8');

// Replace tab classes
d = d
  .replace(/bg-red-500\/20 border border-red-500 text-red-500 shadow-lg shadow-cyan-900\/20/g, 'bg-[#1a0f0f] border border-red-500 text-red-500 shadow-lg shadow-red-900/20')
  .replace(/bg-purple-900\/20 border border-purple-500\/30 text-red-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-red-900\/20 border border-red-500\/30 text-red-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-neutral-900\/20 border border-blue-500\/30 text-red-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-green-900\/20 border border-green-500\/30 text-green-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-indigo-900\/20 border border-indigo-500\/30 text-red-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-orange-900\/20 border border-orange-500\/30 text-orange-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-yellow-900\/20 border border-yellow-500\/30 text-yellow-400/g, 'bg-[#1a0f0f] border border-red-500/30 text-red-500')
  .replace(/bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white/g, 'bg-[#151515] text-[#888] border border-[#333] hover:text-white')
  
  // Replace input glow
  .replace(/from-blue-600 to-purple-600/g, 'from-red-600 to-red-900')
  .replace(/border-blue-500\/30/g, 'border-red-500/30')
  .replace(/text-blue-300/g, 'text-red-300')
  
  // Replace neutral background classes with hex for safety
  .replace(/bg-neutral-900\/[0-9]+/g, 'bg-[#111]')
  .replace(/bg-neutral-900/g, 'bg-[#0A0A0A]')
  .replace(/bg-neutral-800/g, 'bg-[#151515]')
  .replace(/bg-neutral-700/g, 'bg-[#1C1C1C]')
  .replace(/text-neutral-500/g, 'text-[#888]')
  .replace(/text-neutral-400/g, 'text-[#AAA]')
  .replace(/border-neutral-800/g, 'border-[#222]')
  .replace(/border-neutral-700/g, 'border-[#333]')
  
  // Replace specific blue accents inside the file if they exist
  .replace(/hover:bg-indigo-900\/10 hover:border-indigo-500\/30/g, 'hover:bg-red-900/10 hover:border-red-500/30')
  .replace(/hover:border-indigo-500\/30/g, 'hover:border-red-500/30')
  .replace(/bg-indigo-900\/20/g, 'bg-[#111]')
  .replace(/text-indigo-400/g, 'text-[#AAA]');

fs.writeFileSync(p, d, 'utf8');
console.log('Replaced all non-compliant colors in NetworkToolsView');
