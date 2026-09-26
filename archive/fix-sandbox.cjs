const fs = require('fs');
const p = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views/SandboxBrowserView.tsx';
let d = fs.readFileSync(p, 'utf8');

d = d
  // Replace custom blue hexes
  .replace(/bg-\[\#0d1117\]/g, 'bg-[#0A0A0A]')
  
  // Replace getRiskColor function returns
  .replace(/text-orange-500 border-orange-500\/30 bg-orange-900\/20/g, 'text-white border-[#333] bg-[#151515]')
  .replace(/text-green-500 border-green-500\/30 bg-green-900\/20/g, 'text-[#888] border-[#333] bg-[#151515]')
  
  // Replace specific background and border classes
  .replace(/bg-orange-900\/20/g, 'bg-[#151515]')
  .replace(/border-orange-500\/30/g, 'border-[#333]')
  .replace(/bg-green-900\/20/g, 'bg-[#151515]')
  .replace(/border-green-500\/30/g, 'border-[#333]')
  .replace(/bg-green-500\/20/g, 'bg-[#151515]')
  .replace(/bg-green-500\/5/g, 'bg-[#0A0A0A]')
  .replace(/bg-green-500/g, 'bg-white')
  .replace(/bg-orange-500/g, 'bg-[#666]')
  .replace(/bg-purple-500/g, 'bg-white')
  
  // Replace text colors
  .replace(/text-orange-500/g, 'text-white')
  .replace(/text-green-500/g, 'text-white')
  .replace(/text-green-400\/80/g, 'text-[#888]')
  
  // Replace toggle specific neutral-600 to a darker grey
  .replace(/bg-neutral-600/g, 'bg-[#333]')

  // Ensure left-4.5 styling stays for the toggles (they just need red or white instead of purple)
  // DevTools panel was bg-purple-500, now it's bg-white, but when active we can use bg-red-500 to match the others.
  .replace(/showPanels \? 'bg-white'/g, "showPanels ? 'bg-red-500'");

fs.writeFileSync(p, d, 'utf8');
console.log('Purged green, orange, purple, and blue from SandboxBrowserView');
