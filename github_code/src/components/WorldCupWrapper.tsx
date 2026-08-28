import React, { ReactNode } from 'react';
import { LanguageProvider } from '../i18n/LanguageContext';
import { WorldCupProvider } from '../context/WorldCupContext';
import { WorldCupOnboarding } from './WorldCupOnboarding';

interface WorldCupWrapperProps {
  children: ReactNode;
}

export function WorldCupWrapper({ children }: WorldCupWrapperProps) {
  return (
    <LanguageProvider>
      <WorldCupProvider>
        {children}
        <WorldCupOnboarding />
      </WorldCupProvider>
    </LanguageProvider>
  );
}

export function useWorldCupTheme() {
  // This hook can be used to apply theme colors dynamically
  return {
    getGradientClass: (themeMode: string, gradient: string) => {
      return `bg-gradient-to-r ${gradient}`;
    }
  };
}
