import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n/LanguageContext';
import { WorldCupProvider } from './context/WorldCupContext';
import './index.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <WorldCupProvider>
          <App />
        </WorldCupProvider>
      </LanguageProvider>
    </React.StrictMode>
  );
}
