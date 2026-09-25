import { useAuth } from '../contexts/AuthContext';
import { App } from './App';
import { LoginView } from '../components/views/LoginView';

export default function AppRouter() {
  const { isAuthenticated, initialized } = useAuth();

  if (!initialized) {
    return (
      <div className="at-boot-screen">
        <div className="at-boot-mark">A</div>
        <div className="at-boot-title">ANTITODE</div>
        <div className="at-boot-status">Initializing secure session</div>
        <div className="at-boot-bar"><span /></div>
      </div>
    );
  }

  return isAuthenticated ? <App /> : <LoginView />;
}
