import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { App } from './App';
import { LoginView } from '../components/views/LoginView';
import { routeForView } from './data/routes';

export default function AppRouter() {
  const { isAuthenticated, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) return;

    const pathname = window.location.pathname;

    if (!isAuthenticated) {
      if (pathname !== '/login') {
        window.history.replaceState(
          { view: 'login' },
          '',
          '/login',
        );
      }
      return;
    }

    /*
     * Authentication has completed.
     * The workspace itself owns route resolution, so AppRouter only
     * needs to move an authenticated user away from the login screen.
     */
    if (pathname === '/login' || pathname === '/') {
      const dashboardPath = routeForView('dashboard');

      if (window.location.pathname !== dashboardPath) {
        window.history.replaceState(
          { view: 'dashboard' },
          '',
          dashboardPath,
        );
      }
    }
  }, [initialized, isAuthenticated]);

  if (!initialized) {
    return (
      <div className="at-boot-screen">
        <div className="at-boot-mark">A</div>

        <div className="at-boot-title">
          ANTITODE
        </div>

        <div className="at-boot-status">
          Initializing secure session
        </div>

        <div className="at-boot-bar">
          <span />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  return <App />;
}