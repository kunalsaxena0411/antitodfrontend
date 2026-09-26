import React, { useState, useMemo, useEffect } from 'react';
import { Search, Filter, Terminal, MapPin, Server, Activity, ChevronRight, X, FileText, Globe, ShieldAlert, Download, ChevronDown, RefreshCw, Layers, AlertTriangle, TrendingUp, Clock, Database } from 'lucide-react';
import { useHoneypotData } from '../../hooks/useHoneypotData';
import { LogEventV2 } from '../../api/services';

interface HoneypotLogsViewProps {
  logoUrl?: string;
}

export const HoneypotLogsView: React.FC<HoneypotLogsViewProps> = ({ logoUrl }) => {
  const {
    events,
    stats,
    entityIntel,
    isLoadingEvents,
    isLoadingStats,
    isLoadingEntityIntel,
    eventsError,
    statsError,
    total,
    limit,
    offset,
    fetchEvents,
    fetchStats,
    fetchEntityIntel,
    setPage,
    setPageSize,
    refresh,
  } = useHoneypotData({ limit: 100, offset: 0 });

  const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('xyberah_honeypot_search') || '');
  const [honeypotFilter, setHoneypotFilter] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  
  const [selectedEvent, setSelectedEvent] = useState<LogEventV2 | null>(null);
  const [detailTab, setDetailTab] = useState<'OVERVIEW' | 'THREAT_INTEL' | 'RAW'>('OVERVIEW');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('xyberah_honeypot_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    fetchStats({ time_range: timeRange });
  }, [timeRange, fetchStats]);

  const filteredEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.filter(event => {
      const matchesSearch = 
        event.src_ip.includes(searchTerm) || 
        event.event_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.username && event.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (event.command && event.command.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesHoneypot = honeypotFilter === 'ALL' || event.honeypot === honeypotFilter;
      const matchesEventType = eventTypeFilter === 'ALL' || event.event_type === eventTypeFilter;

      return matchesSearch && matchesHoneypot && matchesEventType;
    });
  }, [events, searchTerm, honeypotFilter, eventTypeFilter]);

  const uniqueHoneypots = useMemo(() => {
    const types = new Set(events.map(e => e.honeypot));
    return Array.from(types).sort();
  }, [events]);

  const uniqueEventTypes = useMemo(() => {
    const types = new Set(events.map(e => e.event_type));
    return Array.from(types).sort();
  }, [events]);

  const getThreatColor = (score?: number) => {
    if (!score) return 'text-[#888]';
    if (score >= 80) return 'text-red-500';
    if (score >= 60) return 'text-white';
    if (score >= 40) return 'text-white';
    return 'text-red-500';
  };

  const getThreatBg = (score?: number) => {
    if (!score) return 'bg-[#151515] border-[#333]';
    if (score >= 80) return 'bg-red-500/10 border-red-500/30';
    if (score >= 60) return 'bg-neutral-500/10 border-neutral-500/30';
    if (score >= 40) return 'bg-neutral-500/10 border-neutral-500/30';
    return 'bg-[#151515]/10 border-neutral-500/30';
  };

  const handleEventClick = async (event: LogEventV2) => {
    setSelectedEvent(event);
    if (event.src_ip) {
      await fetchEntityIntel(event.src_ip);
    }
  };

  const handleRefresh = async () => {
    await refresh();
  };

  const currentPage = Math.floor(offset / limit);
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col bg-cyber-grid relative">
      {/* Header */}
      <div className="p-4 border-b border-[#222] bg-black/40 backdrop-blur-sm flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-neutral-900/20 rounded-lg border border-neutral-500/30 text-red-400">
            <Database size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-cyber flex items-center gap-2">
              HONEYPOT <span className="text-red-500">LOGS</span>
            </h2>
            <p className="text-xs text-[#888] font-mono">V2 ClickHouse Analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64 group">
            <Search className="absolute left-3 top-2.5 text-[#888] w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search IP, Event, Username..." 
              className="w-full bg-black/50 border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none transition-all font-mono"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 text-[#888] w-4 h-4 pointer-events-none" />
            <select 
              className="bg-black/50 border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none appearance-none cursor-pointer hover:bg-[#0A0A0A] transition-colors"
              value={honeypotFilter}
              onChange={(e) => setHoneypotFilter(e.target.value)}
            >
              <option value="ALL">All Honeypots</option>
              {uniqueHoneypots.map(hp => (
                <option key={hp} value={hp}>{hp}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <Clock className="absolute left-3 top-2.5 text-[#888] w-4 h-4 pointer-events-none" />
            <select 
              className="bg-black/50 border border-[#333] rounded-lg pl-10 pr-4 py-2 text-sm text-neutral-300 focus:border-neutral-500 focus:outline-none appearance-none cursor-pointer hover:bg-[#0A0A0A] transition-colors"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>

          <button 
            onClick={handleRefresh}
            disabled={isLoadingEvents || isLoadingStats}
            className="px-3 py-2 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded-lg text-neutral-300 hover:text-white transition-colors flex items-center gap-2 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoadingEvents || isLoadingStats ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="px-6 pt-6 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/40 border border-[#222] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-[#888] uppercase">Total Events</div>
                <Activity size={16} className="text-red-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">{stats.total_events.toLocaleString()}</div>
            </div>

            <div className="bg-black/40 border border-[#222] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-[#888] uppercase">Unique IPs</div>
                <Globe size={16} className="text-red-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">{stats.unique_source_ips.toLocaleString()}</div>
            </div>

            <div className="bg-black/40 border border-[#222] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-[#888] uppercase">High Threats</div>
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">{stats.high_threat_entities.toLocaleString()}</div>
            </div>

            <div className="bg-black/40 border border-[#222] rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-[#888] uppercase">New Attackers</div>
                <TrendingUp size={16} className="text-white" />
              </div>
              <div className="text-2xl font-mono font-bold text-white">{stats.new_attackers_24h.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-6">
          {eventsError && (
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg flex items-center gap-3">
              <AlertTriangle className="text-red-500" />
              <span className="text-red-200 font-mono text-sm">{eventsError}</span>
            </div>
          )}

          <div className="bg-black/40 border border-[#222] rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#111] text-[#888] uppercase font-bold text-xs sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th className="p-4 w-40">Timestamp</th>
                  <th className="p-4 w-32">Source IP</th>
                  <th className="p-4 w-32">Honeypot</th>
                  <th className="p-4 w-48">Event Type</th>
                  <th className="p-4 w-32">Threat Score</th>
                  <th className="p-4">Details</th>
                  <th className="p-4 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {isLoadingEvents ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <RefreshCw className="w-5 h-5 animate-spin text-red-500" />
                        <span className="text-[#AAA] font-mono">Loading events...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-[#888] font-mono">
                      No events found
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((event, idx) => (
                    <tr 
                      key={`${event.event_id}-${idx}`} 
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                      onClick={() => handleEventClick(event)}
                    >
                      <td className="p-4">
                        <div className="font-mono text-xs text-[#AAA]">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-white font-bold">{event.src_ip}</div>
                        {event.src_port && (
                          <div className="text-[10px] text-[#888] font-mono">:{event.src_port}</div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-neutral-900/30 text-red-400 border border-neutral-500/30 rounded text-xs font-bold">
                          {event.honeypot}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-neutral-300">{event.event_type}</div>
                        {event.dst_port && (
                          <div className="text-[10px] text-[#888] font-mono">Port: {event.dst_port}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {event.threat_score !== undefined ? (
                          <div className="flex items-center gap-3">
                            <span className={`font-bold font-mono ${getThreatColor(event.threat_score)}`}>
                              {event.threat_score}
                            </span>
                            <div className="flex-1 h-1.5 bg-[#151515] rounded-full overflow-hidden max-w-[80px]">
                              <div 
                                className={`h-full ${event.threat_score >= 80 ? 'bg-red-500' : event.threat_score >= 60 ? 'bg-neutral-500' : event.threat_score >= 40 ? 'bg-neutral-500' : 'bg-[#151515]'}`} 
                                style={{ width: `${event.threat_score}%` }}
                              ></div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-neutral-600 text-xs italic">N/A</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {event.username && (
                            <div className="text-xs text-[#AAA]">
                              <span className="text-neutral-600">User:</span> {event.username}
                            </div>
                          )}
                          {event.command && (
                            <div className="text-xs text-[#AAA] truncate max-w-[200px]" title={event.command}>
                              <span className="text-neutral-600">Cmd:</span> {event.command}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button className="p-2 bg-[#151515] hover:bg-[#1C1C1C] text-[#AAA] hover:text-white rounded transition-colors">
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoadingEvents && filteredEvents.length > 0 && (
            <div className="mt-4 flex items-center justify-between bg-black/40 border border-[#222] rounded-lg p-4">
              <div className="text-sm text-[#AAA] font-mono">
                Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} events
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 0}
                  className="px-3 py-1 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded text-neutral-300 hover:text-white transition-colors text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-[#AAA] font-mono px-3">
                  Page {currentPage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage >= totalPages - 1}
                  className="px-3 py-1 bg-[#151515] hover:bg-[#1C1C1C] border border-[#333] rounded text-neutral-300 hover:text-white transition-colors text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Event Detail Panel */}
        {selectedEvent && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex justify-end animate-fade-in">
            <div className="w-full max-w-3xl bg-[#0a0a0a] border-l border-[#222] h-full shadow-2xl flex flex-col animate-slide-in-right">
              <div className="p-6 border-b border-[#222] flex justify-between items-start bg-[#111]">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-2xl font-mono font-bold text-white">{selectedEvent.src_ip}</h2>
                    {selectedEvent.threat_score !== undefined && (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getThreatBg(selectedEvent.threat_score)} ${getThreatColor(selectedEvent.threat_score)}`}>
                        Threat: {selectedEvent.threat_score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[#AAA]">
                    <span className="flex items-center gap-1">
                      <Terminal size={12}/> {selectedEvent.honeypot}
                    </span>
                    <span className="text-neutral-600">|</span>
                    <span className="flex items-center gap-1">
                      <Activity size={12}/> {selectedEvent.event_type}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="p-2 hover:bg-[#151515] rounded text-[#888] hover:text-white transition-colors"
                >
                  <X size={20}/>
                </button>
              </div>

              <div className="flex bg-black/40 border-b border-[#222] px-6">
                <button 
                  onClick={() => setDetailTab('OVERVIEW')} 
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'OVERVIEW' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                >
                  <Activity size={14}/> OVERVIEW
                </button>
                <button 
                  onClick={() => setDetailTab('THREAT_INTEL')} 
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'THREAT_INTEL' ? 'border-red-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                >
                  <ShieldAlert size={14}/> THREAT INTEL
                </button>
                <button 
                  onClick={() => setDetailTab('RAW')} 
                  className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${detailTab === 'RAW' ? 'border-neutral-500 text-white' : 'border-transparent text-[#888] hover:text-neutral-300'}`}
                >
                  <FileText size={14}/> RAW DATA
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-black/20">
                {detailTab === 'OVERVIEW' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/40 border border-[#222] rounded p-3">
                        <div className="text-[10px] text-[#888] uppercase font-bold mb-1">Timestamp</div>
                        <div className="text-xs text-white font-mono">{new Date(selectedEvent.timestamp).toLocaleString()}</div>
                      </div>
                      <div className="bg-black/40 border border-[#222] rounded p-3">
                        <div className="text-[10px] text-[#888] uppercase font-bold mb-1">Event ID</div>
                        <div className="text-xs text-white font-mono truncate">{selectedEvent.event_id}</div>
                      </div>
                    </div>

                    {selectedEvent.username && (
                      <div className="bg-black/40 border border-[#222] rounded p-4">
                        <div className="text-xs text-[#888] uppercase font-bold mb-2">Credentials</div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[#AAA] text-sm">Username:</span>
                            <span className="text-white font-mono text-sm">{selectedEvent.username}</span>
                          </div>
                          {selectedEvent.password && (
                            <div className="flex items-center justify-between">
                              <span className="text-[#AAA] text-sm">Password:</span>
                              <span className="text-white font-mono text-sm">{selectedEvent.password}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedEvent.command && (
                      <div className="bg-black/40 border border-[#222] rounded p-4">
                        <div className="text-xs text-[#888] uppercase font-bold mb-2">Command Executed</div>
                        <div className="bg-black/60 border border-[#333] rounded p-3 font-mono text-sm text-red-400">
                          {selectedEvent.command}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {detailTab === 'THREAT_INTEL' && (
                  <>
                    {isLoadingEntityIntel ? (
                      <div className="flex items-center justify-center py-12">
                        <RefreshCw className="w-6 h-6 animate-spin text-red-500" />
                      </div>
                    ) : entityIntel ? (
                      <>
                        <div className="bg-black/40 border border-[#222] rounded p-4">
                          <div className="text-xs text-[#888] uppercase font-bold mb-3">Threat Assessment</div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-[#AAA]">Risk Level</div>
                              <div className={`text-2xl font-bold ${entityIntel.risk_level === 'high' ? 'text-red-500' : entityIntel.risk_level === 'medium' ? 'text-white' : 'text-white'}`}>
                                {entityIntel.risk_level.toUpperCase()}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-[#AAA]">Total Events</div>
                              <div className="text-2xl font-bold text-white">{entityIntel.total_events}</div>
                            </div>
                          </div>
                        </div>

                        {entityIntel.recommendations.length > 0 && (
                          <div className="bg-black/40 border border-[#222] rounded p-4">
                            <div className="text-xs text-[#888] uppercase font-bold mb-3">Recommendations</div>
                            <ul className="space-y-2">
                              {entityIntel.recommendations.map((rec, idx) => (
                                <li key={idx} className="text-sm text-neutral-300 flex items-start gap-2">
                                  <span className="text-red-500 mt-1">•</span>
                                  <span>{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="text-center py-12 text-[#888]">
                        No threat intelligence available
                      </div>
                    )}
                  </>
                )}

                {detailTab === 'RAW' && (
                  <div className="bg-black/40 border border-[#222] rounded p-4">
                    <div className="text-xs text-[#888] uppercase font-bold mb-3">Raw Event Data</div>
                    <pre className="bg-black/60 border border-[#333] rounded p-4 text-xs text-neutral-300 font-mono overflow-x-auto">
                      {JSON.stringify(selectedEvent, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
