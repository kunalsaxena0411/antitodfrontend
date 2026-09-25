# Xyberah Admin Dashboard - API Integration Guide

## Overview

This dashboard integrates with the Xyberah Honeypot Backend V2 API, providing real-time honeypot log analysis, threat intelligence, and admin management capabilities.

## 🔐 Authentication System

### Architecture

The authentication system uses a **React Context** pattern with **localStorage** persistence and **axios interceptors** for automatic token injection.

#### Components:

1. **AuthContext** (`contexts/AuthContext.tsx`)
   - Manages authentication state
   - Handles token storage/retrieval
   - Provides cross-tab synchronization
   - Exposes `useAuth()` hook

2. **API Client** (`api/client.ts`)
   - Axios instance with base configuration
   - Request interceptor: Adds auth token to headers
   - Response interceptor: Handles 401 errors and auto-logout

3. **AppRouter** (`AppRouter.tsx`)
   - Simple routing logic
   - Protected route wrapper
   - Redirects based on auth state

### Usage

```typescript
import { useAuth } from './contexts/AuthContext';

function MyComponent() {
  const { token, isAuthenticated, saveToken, removeToken } = useAuth();
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    return <div>Please login</div>;
  }
  
  // Use the token (automatically added to API requests)
  return <div>Welcome!</div>;
}
```

## 📡 API Services

### Service Structure

All API services are located in `api/services/`:

- **authService.ts** - Authentication (login, verify token)
- **honeypotService.ts** - Honeypot logs (V1 & V2 endpoints)
- **adminService.ts** - Server & shipper management

### V2 API Endpoints (ClickHouse)

#### 1. Get Log Events
```typescript
import { honeypotServiceV2 } from './api/services';

const events = await honeypotServiceV2.getLogEvents({
  limit: 100,
  offset: 0,
  honeypot: 'cowrie',
  start_time: '2026-02-01T00:00:00Z',
  end_time: '2026-02-10T23:59:59Z'
});
```

#### 2. Get Statistics
```typescript
const stats = await honeypotServiceV2.getLogStats({
  time_range: '24h',
  group_by: 'honeypot'
});
```

#### 3. Get Entity Threat Intel
```typescript
const intel = await honeypotServiceV2.getEntityThreatIntel('192.168.1.100');
```

## 🎣 Custom Hooks

### useHoneypotData

A comprehensive hook for managing honeypot data with built-in loading states, error handling, and pagination.

```typescript
import { useHoneypotData } from './hooks/useHoneypotData';

function HoneypotDashboard() {
  const {
    events,
    stats,
    isLoadingEvents,
    eventsError,
    total,
    fetchEvents,
    setPage,
    refresh
  } = useHoneypotData({ limit: 50 });

  return (
    <div>
      {isLoadingEvents ? (
        <div>Loading...</div>
      ) : (
        <div>
          {events.map(event => (
            <div key={event.event_id}>{event.src_ip}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## 🖥️ Components

### LoginView

Cyber-themed login page with:
- Email/password authentication
- Loading states
- Error handling
- Show/hide password toggle
- Auto-redirect on success

**Location:** `components/views/LoginView.tsx`

### HoneypotLogsView

Full-featured honeypot log viewer with:
- Real-time event streaming
- Advanced filtering (honeypot type, event type, time range)
- Pagination
- Threat intelligence panel
- Statistics dashboard
- Event detail view with tabs

**Location:** `components/views/HoneypotLogsView.tsx`

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Backend URL

Edit `config/config.ts`:

```typescript
export const BACKEND_URL = 'https://13.233.93.49.nip.io';
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Login

Use credentials configured on your backend (never commit real passwords).
- Email: value from your admin user store
- Password: set during backend setup

## 📂 Project Structure

```
xyberah-admin-dashboard/
├── api/
│   ├── client.ts              # Axios instance with interceptors
│   └── services/
│       ├── authService.ts     # Authentication API
│       ├── honeypotService.ts # Honeypot logs API (V1 & V2)
│       ├── adminService.ts    # Admin management API
│       └── index.ts           # Barrel exports
├── config/
│   └── config.ts              # Backend URL & endpoints
├── contexts/
│   └── AuthContext.tsx        # Auth state management
├── hooks/
│   └── useHoneypotData.ts     # Honeypot data hook
├── components/
│   └── views/
│       ├── LoginView.tsx      # Login page
│       ├── HoneypotLogsView.tsx # Honeypot logs viewer
│       └── AnalysisView.tsx   # Original analysis view
├── AppRouter.tsx              # Routing logic
├── App.tsx                    # Main app
└── index.tsx                  # Entry point
```

## 🔒 Security Best Practices

1. **Token Storage**
   - Tokens are stored in `localStorage` with key `admin-auth-token`
   - Automatically cleared on 401 responses
   - Cross-tab synchronization via storage events

2. **API Security**
   - All requests include auth token in `authtoken` header
   - Automatic logout on unauthorized access
   - HTTPS enforced in production

3. **Error Handling**
   - All API errors are caught and displayed to user
   - Network errors handled gracefully
   - Detailed error messages for debugging

## 📊 API Response Types

All TypeScript types are fully defined in `api/services/honeypotService.ts`:

```typescript
interface LogEventV2 {
  event_id: string;
  timestamp: string;
  honeypot: string;
  event_type: string;
  src_ip: string;
  threat_score?: number;
  is_suspicious?: boolean;
  // ... more fields
}

interface LogStatsV2Response {
  success: boolean;
  total_events: number;
  unique_source_ips: number;
  top_honeypots: Array<{ name: string; count: number }>;
  // ... more fields
}
```

## 🎨 Styling

The dashboard uses a **cyber-themed** design system:

- **Primary Color:** Cyan (`#00f3ff`)
- **Secondary Color:** Purple (`#a855f7`)
- **Background:** Dark with grid pattern
- **Effects:** Scanlines, glassmorphism, glows

Custom CSS classes:
- `.cyber-grid-bg` - Animated grid background
- `.scanlines` - CRT scanline effect
- `.animate-fade-in` - Fade in animation
- `.animate-slide-in-up` - Slide up animation

## 🔄 State Management

- **Authentication:** React Context (`AuthContext`)
- **API Data:** Custom hooks (`useHoneypotData`)
- **Local State:** React `useState` for component-level state
- **Persistence:** `localStorage` for auth token

## 🐛 Debugging

### Enable Verbose Logging

All API calls and auth events are logged to console:

```javascript
// In browser console
localStorage.setItem('debug', 'true');
```

### Check Auth State

```javascript
// In browser console
localStorage.getItem('admin-auth-token');
```

### Clear Auth and Reload

```javascript
// In browser console
localStorage.removeItem('admin-auth-token');
window.location.reload();
```

## 📝 TODO / Future Enhancements

- [ ] Add refresh token mechanism
- [ ] Implement role-based access control (RBAC)
- [ ] Add real-time WebSocket updates
- [ ] Export logs to CSV/PDF
- [ ] Advanced filtering with query builder
- [ ] Dashboard customization
- [ ] Multi-language support
- [ ] Dark/light theme toggle

## 🤝 Contributing

When adding new API endpoints:

1. Add endpoint to `config/config.ts`
2. Create TypeScript types in appropriate service file
3. Add service method with proper error handling
4. Update this README with usage examples

## 📄 License

© 2026 Xyberah Security Platform

---

**Need Help?** Check the backend API documentation or contact the development team.
