
import React from 'react';
import { ShieldAlert, Terminal, Database, Settings, Infinity as InfinityIcon, Radio } from 'lucide-react';
import { MmdbStatus } from '../types';

interface HeaderProps {
    mmdbStatus?: MmdbStatus;
    liveIntelActive?: boolean;
    onOpenSettings?: () => void;
    productName?: string;
    logoUrl?: string;
}

export const Header: React.FC<HeaderProps> = ({ 
    mmdbStatus = MmdbStatus.OFFLINE, 
    liveIntelActive = false, 
    onOpenSettings,
    productName = 'XYBERAH',
    logoUrl 
}) => {
  
  return (
    <header className="w-full border-b border-cyber-cyan/30 bg-cyber-black/80 backdrop-blur-md sticky top-0 z-50 transition-colors duration-1000">
      <div className="w-full px-6 py-2 flex flex-wrap items-center justify-between gap-y-3">
        
        <div className="flex items-center gap-3 group cursor-pointer" title="Return to Dashboard">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#4361ee] to-[#f72585] rounded-full blur opacity-20 group-hover:opacity-50 transition-opacity duration-300 animate-pulse"></div>
            
            {/* SVG Gradient Definition */}
            <svg width="0" height="0" className="absolute">
              <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop stopColor="#4361ee" offset="0%" />
                <stop stopColor="#f72585" offset="100%" />
              </linearGradient>
            </svg>
            
            {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-9 h-9 relative z-10 object-contain rounded-full bg-black/20" />
            ) : (
                <InfinityIcon className="w-9 h-9 relative z-10 transition-transform duration-500 group-hover:rotate-180" style={{ stroke: 'url(#logo-gradient)' }} strokeWidth={2.5} />
            )}
          </div>
          <div className="flex flex-col">
            <div role="heading" aria-level={1} className="text-2xl font-cyber font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#4361ee] via-[#7209b7] to-[#f72585]">
              {productName}
            </div>
            <span className="hidden md:block text-[9px] tracking-[0.3em] font-mono uppercase text-cyber-purple/80">
              Threat Processor v1.2
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4 ml-auto md:ml-0">
          
          {/* Live Intel Indicator */}
          {liveIntelActive && (
             <div className="flex items-center gap-2 px-2 py-1 rounded border transition-colors duration-500 border-green-500/30 bg-green-900/10" title="Real-time threat intelligence feed is active and updating">
                <Radio size={12} className="text-green-500 animate-pulse"/>
                <span className="text-[9px] md:text-[10px] font-mono whitespace-nowrap text-green-400 hidden sm:block">
                    INTEL FEED ACTIVE
                </span>
             </div>
          )}

          {/* MMDB Status Indicator */}
          <div 
            className={`flex items-center gap-2 px-2 py-1 rounded border transition-all duration-500 ${
              mmdbStatus === MmdbStatus.ONLINE 
              ? 'border-purple-500/30 bg-purple-500/5' 
              : 'border-gray-700 bg-gray-800/30 opacity-50'
            }`}
            title={`MaxMind GeoIP Database is ${mmdbStatus === MmdbStatus.ONLINE ? 'Loaded' : 'Not Loaded'}. Required for offline geolocation.`}
          >
            <Database className={`w-3 h-3 ${mmdbStatus === MmdbStatus.ONLINE ? 'text-purple-400' : 'text-gray-500'}`} />
            <div className={`w-1.5 h-1.5 rounded-full hidden sm:block ${mmdbStatus === MmdbStatus.ONLINE ? 'bg-purple-500 animate-pulse shadow-[0_0_5px_#a855f7]' : 'bg-gray-500'}`}></div>
            <span className={`text-[9px] md:text-[10px] font-mono tracking-wider whitespace-nowrap ${mmdbStatus === MmdbStatus.ONLINE ? 'text-purple-300' : 'text-gray-500'}`}>
                MMDB {mmdbStatus === MmdbStatus.ONLINE ? 'ON' : 'OFF'}
            </span>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-2 px-2 py-1 rounded border transition-colors duration-500 border-cyber-cyan/30 bg-black/20" title="System Status: Operational">
            <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_#22c55e] animate-pulse"></div>
            <span className="text-[9px] md:text-xs font-mono whitespace-nowrap transition-colors duration-500 text-cyber-cyan">
                SYSTEM ONLINE
            </span>
          </div>
          
          {onOpenSettings && (
              <button onClick={onOpenSettings} className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors" title="System Settings & API Configuration">
                  <Settings size={20}/>
              </button>
          )}
        </div>
      </div>
      
      {/* Decorative line scanner */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-50 animate-pulse"></div>
    </header>
  );
};
