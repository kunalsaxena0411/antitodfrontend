import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AuthProvider } from '../contexts/AuthContext';
import AppRouter from './AppRouter';

const root = document.getElementById('root');
if (!root) throw new Error('ANTITODE root element is missing.');

createRoot(root).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>,
);
