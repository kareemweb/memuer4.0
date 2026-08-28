import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { WorldCupWrapper } from './components/WorldCupWrapper';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorldCupWrapper>
      <App />
    </WorldCupWrapper>
  </StrictMode>,
);
