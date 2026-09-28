# Quick Integration Guide: Adding HoneypotLogsView to the Dashboard

## Step 1: Import the Component

In `components/ResultsTable.tsx`, add the import:

```typescript
import { HoneypotLogsView } from './views/HoneypotLogsView';
```

## Step 2: Add View Mode Option

Find the view mode buttons section (around line 350-380) and add a new button:

```typescript
<button 
  onClick={() => setViewMode('honeypot')}
  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
    viewMode === 'honeypot' 
      ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/30' 
      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
  }`}
>
  <Database size={16} className="inline mr-2" />
  HONEYPOT LOGS
</button>
```

## Step 3: Add View Rendering

In the view rendering section (around line 379), add:

```typescript
{viewMode === 'honeypot' && <HoneypotLogsView logoUrl={logoUrl} />}
```

## Step 4: Update ViewMode Type

At the top of ResultsTable.tsx, update the viewMode type:

```typescript
type ViewMode = 'dashboard' | 'analysis' | 'investigation' | 'network' | 'honeypot' | ...;
```

## Complete Example

Here's what the updated section should look like:

```typescript
// Import section
import { AnalysisView } from './views/AnalysisView';
import { HoneypotLogsView } from './views/HoneypotLogsView';
import { Database } from 'lucide-react';

// In the component
type ViewMode = 'dashboard' | 'analysis' | 'investigation' | 'network' | 'honeypot' | 'email' | ...;

// View mode buttons
<div className="flex gap-2 flex-wrap">
  <button onClick={() => setViewMode('dashboard')} className={...}>
    DASHBOARD
  </button>
  <button onClick={() => setViewMode('analysis')} className={...}>
    ANALYSIS
  </button>
  <button onClick={() => setViewMode('honeypot')} className={...}>
    <Database size={16} className="inline mr-2" />
    HONEYPOT LOGS
  </button>
  {/* ... other buttons */}
</div>

// View rendering
{viewMode === 'dashboard' && <DashboardView ... />}
{viewMode === 'analysis' && <AnalysisView ... />}
{viewMode === 'honeypot' && <HoneypotLogsView logoUrl={logoUrl} />}
{/* ... other views */}
```

## Alternative: Standalone Page

If you prefer to make it a standalone page instead of a view mode:

### Option A: Add to Header Navigation

In `components/Header.tsx`, add a navigation button that sets a global view state.

### Option B: Create Separate Route

Update `AppRouter.tsx` to handle `/honeypot-logs` route:

```typescript
export const AppRouter: React.FC = () => {
  const { isAuthenticated, initialized } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // ... existing code ...

  // Add route handling
  if (currentPath === '/honeypot-logs') {
    return isAuthenticated ? <HoneypotLogsView /> : <LoginView />;
  }

  // ... rest of routes ...
};
```

## Testing the Integration

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Login with admin credentials**

3. **Navigate to the Honeypot Logs view**

4. **Verify:**
   - Events are loading from the V2 API
   - Filters work correctly
   - Pagination functions
   - Event detail panel opens on click
   - Threat intelligence loads for selected IPs

## Troubleshooting

### Events Not Loading

Check browser console for API errors:
```javascript
// Should see:
[API] Request: GET /HoneyPotRoutes/v2/getLogEvents
[API] Response: 200 /HoneyPotRoutes/v2/getLogEvents
```

If you see 401 errors, verify your auth token is valid:
```javascript
localStorage.getItem('admin-auth-token')
```

### CORS Errors

Ensure the backend allows requests from your frontend origin. The backend should have CORS configured for your development URL.

### TypeScript Errors

If you see type errors, ensure all imports are correct:
```bash
npm run build
```

## Next Steps

After integration, you can:

1. **Customize the view** - Modify `HoneypotLogsView.tsx` to match your needs
2. **Add export functionality** - Implement CSV/PDF export for logs
3. **Add real-time updates** - Use polling or WebSockets for live data
4. **Enhance filtering** - Add more advanced filter options
5. **Add visualizations** - Create charts for event distribution

## Need Help?

- Check `API_INTEGRATION.md` for detailed API documentation
- Review `hooks/useHoneypotData.ts` for data management
- See `api/services/honeypotService.ts` for available API methods
