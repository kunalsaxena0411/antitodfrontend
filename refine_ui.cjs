const fs = require('fs');
const file = 'c:/Users/rishi/ANTI AI/ANTI-TODE/Xyberah-redesign/components/views/RansomwareView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Upgrade Stats Row
content = content.replace(
    /className="grid grid-cols-1 md:grid-cols-4 gap-4"/g,
    'className="grid grid-cols-1 md:grid-cols-4 gap-6"'
);

content = content.replace(
    /<div className="bg-\[#111\] border border-\[#222\] rounded p-3 flex items-center justify-between">/g,
    '<div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-xl p-5 flex items-center justify-between shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:border-red-500/30 transition-all duration-300 group">'
);

content = content.replace(
    /<div className="bg-\[#111\] border border-\[#222\] rounded p-3">/g,
    '<div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] border border-[#222] rounded-xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:border-red-500/30 transition-all duration-300 group">'
);

// Stat typography
content = content.replace(
    /<div className="text-2xl font-mono text-white">\{posts\.length\}<\/div>/g,
    '<div className="text-4xl font-mono font-bold text-white group-hover:text-red-400 transition-colors drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{posts.length}</div>'
);
content = content.replace(
    /<div className="text-2xl font-mono text-white">\{groups\.length\}<\/div>/g,
    '<div className="text-4xl font-mono font-bold text-white group-hover:text-red-400 transition-colors drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">{groups.length}</div>'
);
content = content.replace(
    /<div className="text-2xl font-mono text-red-500">\{recentVelocity\}<\/div>/g,
    '<div className="text-4xl font-mono font-bold text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse">{recentVelocity}</div>'
);

// Stat icons
content = content.replace(
    /<Target size=\{20\} className="text-neutral-600"\/>/g,
    '<Target size={32} className="text-neutral-600 group-hover:text-red-500 transition-colors opacity-50"/>'
);
content = content.replace(
    /<Users size=\{20\} className="text-white"\/>/g,
    '<Users size={32} className="text-neutral-500 group-hover:text-red-400 transition-colors opacity-50"/>'
);
content = content.replace(
    /<Activity size=\{20\} className="text-red-900"\/>/g,
    '<Activity size={32} className="text-red-900 group-hover:text-red-500 transition-colors opacity-50"/>'
);


// 2. Upgrade Victim Feed
content = content.replace(
    /className="p-4 border-b border-\[#222\] hover:bg-white\/5 transition-colors group relative"/g,
    'className="p-5 border-b border-[#1a1a1a] hover:bg-gradient-to-r hover:from-red-900/10 hover:to-transparent border-l-2 border-l-transparent hover:border-l-red-500 transition-all duration-300 group relative"'
);

// 3. Upgrade Gang Profiles
content = content.replace(
    /className="bg-\[#111\] border border-\[#222\] rounded-lg p-4 hover:border-red-500\/30 transition-colors flex flex-col h-full"/g,
    'className="bg-black/40 backdrop-blur-md border border-[#222] rounded-xl p-5 hover:bg-black/60 hover:border-red-500/40 hover:shadow-[0_0_30px_rgba(220,38,38,0.1)] transition-all duration-500 flex flex-col h-full group/card"'
);

content = content.replace(
    /<h3 className="text-lg font-bold text-white uppercase tracking-wide">\{group\.name\}<\/h3>/g,
    '<h3 className="text-xl font-bold text-white uppercase tracking-wider group-hover/card:text-red-400 transition-colors flex items-center gap-2"><Globe className="text-neutral-600 group-hover/card:text-red-500 w-4 h-4"/> {group.name}</h3>'
);

content = content.replace(
    /className="text-xs font-mono text-\[#888\] bg-black\/50 px-2 py-1 rounded border border-\[#222\]"/g,
    'className="text-xs font-mono font-bold text-red-400 bg-red-950/30 px-3 py-1 rounded-full border border-red-900/50 shadow-[0_0_10px_rgba(153,27,27,0.2)]"'
);

content = content.replace(
    /className="text-xs text-\[#AAA\] mb-4 italic border-l-2 border-\[#333\] pl-2"/g,
    'className="text-sm text-neutral-400 mb-5 leading-relaxed border-l-2 border-neutral-700 group-hover/card:border-red-500/50 pl-3 transition-colors"'
);

content = content.replace(
    /className="flex items-center justify-between bg-black\/40 p-1\.5 rounded text-xs border border-\[#222\]"/g,
    'className="flex items-center justify-between bg-[#111] p-2 rounded-lg text-xs border border-[#222] group-hover/card:border-[#333] hover:bg-[#1a1a1a] transition-colors"'
);

fs.writeFileSync(file, content);
console.log('Refined UI for RansomwareView');
