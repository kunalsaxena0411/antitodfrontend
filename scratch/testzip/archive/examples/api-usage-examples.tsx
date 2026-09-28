/**
 * Example Usage of Xyberah API Services
 * 
 * This file demonstrates how to use the various API services
 * in your React components.
 */

import { 
  authService, 
  honeypotServiceV2, 
  adminService 
} from '../api/services';

// ============================================
// Example 1: Authentication
// ============================================

async function loginExample() {
  try {
    const response = await authService.login({
      AdminEmail: 'admin@example.com',
      AdminPassword: '<your-admin-password>'
    });
    
    console.log('Login successful!');
    console.log('Token:', response.token);
    
    // Token is automatically stored by AuthContext
    // and added to all subsequent requests
    
  } catch (error) {
    console.error('Login failed:', error);
  }
}

async function verifyTokenExample() {
  try {
    const response = await authService.verifyToken();
    console.log('Token is valid:', response.message);
  } catch (error) {
    console.error('Token verification failed:', error);
  }
}

// ============================================
// Example 2: Honeypot Logs (V2 API)
// ============================================

async function fetchRecentEventsExample() {
  try {
    const response = await honeypotServiceV2.getLogEvents({
      limit: 50,
      offset: 0,
      // Optional filters
      honeypot: 'cowrie',
      start_time: '2026-02-10T00:00:00Z',
      end_time: '2026-02-11T23:59:59Z'
    });
    
    console.log('Total events:', response.total);
    console.log('Events:', response.events);
    
    // Process events
    response.events.forEach(event => {
      console.log(`${event.timestamp} - ${event.src_ip} - ${event.event_type}`);
    });
    
  } catch (error) {
    console.error('Failed to fetch events:', error);
  }
}

async function fetchStatisticsExample() {
  try {
    const stats = await honeypotServiceV2.getLogStats({
      time_range: '24h',
      group_by: 'honeypot'
    });
    
    console.log('Total events:', stats.total_events);
    console.log('Unique IPs:', stats.unique_source_ips);
    console.log('High threat entities:', stats.high_threat_entities);
    
    // Display top honeypots
    stats.top_honeypots.forEach(hp => {
      console.log(`${hp.name}: ${hp.count} events (${hp.percentage}%)`);
    });
    
    // Display top attacking IPs
    stats.top_attacking_ips.forEach(ip => {
      console.log(`${ip.ip}: ${ip.count} attacks, threat score: ${ip.threat_score}`);
    });
    
  } catch (error) {
    console.error('Failed to fetch stats:', error);
  }
}

async function getThreatIntelExample() {
  try {
    const intel = await honeypotServiceV2.getEntityThreatIntel('192.168.1.100');
    
    console.log('Entity:', intel.entity_id);
    console.log('Threat Score:', intel.threat_score);
    console.log('Risk Level:', intel.risk_level);
    console.log('Total Events:', intel.total_events);
    
    // Display event breakdown
    Object.entries(intel.event_breakdown).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    // Display recommendations
    console.log('\nRecommendations:');
    intel.recommendations.forEach(rec => {
      console.log(`  - ${rec}`);
    });
    
    // Check external threat intel
    if (intel.external_threat_intel?.abuseipdb) {
      const abuse = intel.external_threat_intel.abuseipdb;
      console.log('\nAbuseIPDB:');
      console.log(`  Confidence: ${abuse.abuse_confidence_score}%`);
      console.log(`  Reports: ${abuse.total_reports}`);
    }
    
  } catch (error) {
    console.error('Failed to fetch threat intel:', error);
  }
}

// ============================================
// Example 3: Admin Management
// ============================================

async function listServersExample() {
  try {
    const response = await adminService.listServers();
    
    console.log(`Found ${response.count} servers`);
    
    response.servers.forEach(server => {
      console.log(`\nServer: ${server.ServerId}`);
      console.log(`  Hostname: ${server.Hostname}`);
      console.log(`  Public IP: ${server.PublicIp}`);
      console.log(`  Region: ${server.Region}`);
      console.log(`  Provider: ${server.Provider}`);
    });
    
  } catch (error) {
    console.error('Failed to list servers:', error);
  }
}

async function registerServerExample() {
  try {
    const response = await adminService.registerServer({
      ServerId: 'ec2-honeypot-01',
      Hostname: 'honeypot-prod',
      PublicIp: '13.xxx.xxx.xxx',
      PrivateIp: '172.31.10.5',
      Region: 'ap-south-1',
      Provider: 'aws'
    });
    
    console.log('Server registered:', response.message);
    console.log('Server details:', response.server);
    
  } catch (error) {
    console.error('Failed to register server:', error);
  }
}

async function registerShipperExample() {
  try {
    const response = await adminService.registerShipper({
      ServerId: 'ec2-honeypot-01',
      AllowedIp: '13.xxx.xxx.xxx'
    });
    
    console.log('Shipper registered:', response.message);
    console.log('⚠️ IMPORTANT: Save this token immediately!');
    console.log('Token:', response.shipper.Token);
    console.log('Install command:', response.deployment.installCommand);
    console.log(response.warning);
    
  } catch (error) {
    console.error('Failed to register shipper:', error);
  }
}

async function listShippersExample() {
  try {
    const response = await adminService.listShippers();
    
    console.log(`Found ${response.count} shippers`);
    
    response.shippers.forEach(shipper => {
      console.log(`\nShipper: ${shipper.ShipperId}`);
      console.log(`  Server: ${shipper.ServerId}`);
      console.log(`  IP: ${shipper.AllowedIp}`);
      console.log(`  Active: ${shipper.Active ? 'Yes' : 'No'}`);
      console.log(`  Last Seen: ${shipper.LastSeenAt || 'Never'}`);
    });
    
  } catch (error) {
    console.error('Failed to list shippers:', error);
  }
}

// ============================================
// Example 4: React Component Usage
// ============================================

import React, { useState, useEffect } from 'react';

function HoneypotDashboardExample() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Fetch events and stats in parallel
        const [eventsRes, statsRes] = await Promise.all([
          honeypotServiceV2.getLogEvents({ limit: 100 }),
          honeypotServiceV2.getLogStats({ time_range: '24h' })
        ]);
        
        setEvents(eventsRes.events);
        setStats(statsRes);
        
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Honeypot Dashboard</h1>
      
      {stats && (
        <div>
          <p>Total Events: {stats.total_events}</p>
          <p>Unique IPs: {stats.unique_source_ips}</p>
          <p>High Threats: {stats.high_threat_entities}</p>
        </div>
      )}
      
      <h2>Recent Events</h2>
      <ul>
        {events.map(event => (
          <li key={event.event_id}>
            {event.timestamp} - {event.src_ip} - {event.event_type}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================
// Example 5: Using the Custom Hook
// ============================================

import { useHoneypotData } from '../hooks/useHoneypotData';

function HoneypotDashboardWithHook() {
  const {
    events,
    stats,
    isLoadingEvents,
    isLoadingStats,
    eventsError,
    total,
    fetchEvents,
    setPage,
    refresh
  } = useHoneypotData({ limit: 50 });

  const handleFilterChange = (honeypot: string) => {
    fetchEvents({ 
      limit: 50, 
      offset: 0, 
      honeypot 
    });
  };

  const handlePageChange = (page: number) => {
    setPage(page);
  };

  if (isLoadingEvents) return <div>Loading events...</div>;
  if (eventsError) return <div>Error: {eventsError}</div>;

  return (
    <div>
      <h1>Honeypot Dashboard</h1>
      
      <button onClick={refresh}>Refresh</button>
      
      {stats && (
        <div>
          <p>Total Events: {stats.total_events}</p>
          <p>Unique IPs: {stats.unique_source_ips}</p>
        </div>
      )}
      
      <select onChange={(e) => handleFilterChange(e.target.value)}>
        <option value="">All Honeypots</option>
        <option value="cowrie">Cowrie</option>
        <option value="dionaea">Dionaea</option>
      </select>
      
      <ul>
        {events.map(event => (
          <li key={event.event_id}>
            {event.src_ip} - {event.event_type}
          </li>
        ))}
      </ul>
      
      <p>Total: {total} events</p>
    </div>
  );
}

// ============================================
// Example 6: Error Handling
// ============================================

import { handleApiError } from '../api/client';

async function robustApiCallExample() {
  try {
    const events = await honeypotServiceV2.getLogEvents({ limit: 100 });
    console.log('Success:', events);
    
  } catch (error) {
    // handleApiError extracts user-friendly error message
    const errorMessage = handleApiError(error);
    
    console.error('API Error:', errorMessage);
    
    // Show to user
    alert(`Failed to fetch events: ${errorMessage}`);
  }
}

// ============================================
// Example 7: Pagination
// ============================================

async function paginationExample() {
  const pageSize = 50;
  let currentPage = 0;
  
  async function loadPage(page: number) {
    const offset = page * pageSize;
    
    const response = await honeypotServiceV2.getLogEvents({
      limit: pageSize,
      offset: offset
    });
    
    console.log(`Page ${page + 1}:`);
    console.log(`Showing ${offset + 1} to ${offset + response.events.length} of ${response.total}`);
    
    return response;
  }
  
  // Load first page
  const firstPage = await loadPage(0);
  
  // Calculate total pages
  const totalPages = Math.ceil(firstPage.total / pageSize);
  console.log(`Total pages: ${totalPages}`);
  
  // Load next page
  if (currentPage < totalPages - 1) {
    currentPage++;
    await loadPage(currentPage);
  }
}

// ============================================
// Example 8: Advanced Filtering
// ============================================

async function advancedFilteringExample() {
  // Filter by multiple criteria
  const response = await honeypotServiceV2.getLogEvents({
    limit: 100,
    offset: 0,
    honeypot: 'cowrie',
    event_type: 'ssh_login_attempt',
    start_time: '2026-02-10T00:00:00Z',
    end_time: '2026-02-10T23:59:59Z'
  });
  
  console.log(`Found ${response.total} SSH login attempts on Cowrie`);
  
  // Further filter in JavaScript if needed
  const highThreatEvents = response.events.filter(
    event => event.threat_score && event.threat_score >= 80
  );
  
  console.log(`${highThreatEvents.length} high-threat events`);
}

// ============================================
// Export examples for use in other files
// ============================================

export {
  loginExample,
  fetchRecentEventsExample,
  fetchStatisticsExample,
  getThreatIntelExample,
  listServersExample,
  HoneypotDashboardExample,
  HoneypotDashboardWithHook
};
