import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Country, WORLD_CUP_2026_TEAMS, CLASSIC_WC_THEME, getTeamById } from '../data/worldCup2026';

type ThemeMode = 'country' | 'classic' | 'default';

interface WorldCupContextType {
  supportedCountries: Country[];
  addSupportedCountry: (countryId: string) => void;
  removeSupportedCountry: (countryId: string) => void;
  setSupportedCountries: (countryIds: string[]) => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  currentTheme: Country | null;
  showOnboarding: boolean;
  setShowOnboarding: (show: boolean) => void;
  wcEnabled: boolean;
  setWcEnabled: (enabled: boolean) => void;
  primaryCountry: Country | null;
  themeColors: {
    primary: string;
    secondary: string;
    accent: string;
    gradient: string;
  };
}

const WorldCupContext = createContext<WorldCupContextType | undefined>(undefined);

const STORAGE_KEY = 'memuer_world_cup_2026';

export function WorldCupProvider({ children }: { children: ReactNode }) {
  const [supportedCountryIds, setSupportedCountryIds] = useState<string[]>([]);
  const [themeMode, setThemeMode] = useState<ThemeMode>('default');
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [wcEnabled, setWcEnabled] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.supportedCountries && Array.isArray(data.supportedCountries)) {
          setSupportedCountryIds(data.supportedCountries);
          setWcEnabled(data.enabled !== false);
          setThemeMode(data.themeMode || 'country');
          // Show onboarding only if user hasn't seen it and has no countries selected
          setShowOnboarding(data.hasSeenOnboarding === false);
        } else {
          setShowOnboarding(true);
        }
      } catch (e) {
        setShowOnboarding(true);
      }
    }
    // If no saved data, show onboarding (default state)
  }, []);

  // Save to localStorage whenever config changes
  useEffect(() => {
    const hasSeenOnboarding = !showOnboarding || supportedCountryIds.length > 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      supportedCountries: supportedCountryIds,
      enabled: wcEnabled,
      themeMode,
      hasSeenOnboarding
    }));
  }, [supportedCountryIds, wcEnabled, themeMode, showOnboarding]);

  const supportedCountries = supportedCountryIds
    .map(id => getTeamById(id))
    .filter((c): c is Country => c !== undefined);

  const primaryCountry = supportedCountries[0] || null;
  const currentTheme = themeMode === 'country' ? primaryCountry : null;

  const addSupportedCountry = (countryId: string) => {
    setSupportedCountryIds(prev => {
      if (prev.includes(countryId)) return prev;
      return [...prev, countryId];
    });
  };

  const removeSupportedCountry = (countryId: string) => {
    setSupportedCountryIds(prev => prev.filter(id => id !== countryId));
  };

  const setSupportedCountries = (countryIds: string[]) => {
    setSupportedCountryIds(countryIds);
  };

  // Calculate theme colors based on mode
  const themeColors = React.useMemo(() => {
    if (themeMode === 'classic') {
      return {
        primary: CLASSIC_WC_THEME.primary,
        secondary: CLASSIC_WC_THEME.secondary,
        accent: CLASSIC_WC_THEME.accent,
        gradient: CLASSIC_WC_THEME.gradient
      };
    }

    if (themeMode === 'country' && primaryCountry) {
      return {
        primary: primaryCountry.primaryColor,
        secondary: primaryCountry.secondaryColor,
        accent: primaryCountry.accentColor,
        gradient: primaryCountry.gradient
      };
    }

    // Default Memuer theme (from index.css and existing styles)
    return {
      primary: '#6366f1', // indigo-500
      secondary: '#8b5cf6', // violet-500
      accent: '#06b6d4', // cyan-500
      gradient: 'from-indigo-600 via-violet-600 to-cyan-600'
    };
  }, [themeMode, primaryCountry]);

  return (
    <WorldCupContext.Provider
      value={{
        supportedCountries,
        addSupportedCountry,
        removeSupportedCountry,
        setSupportedCountries,
        themeMode,
        setThemeMode,
        currentTheme,
        showOnboarding,
        setShowOnboarding,
        wcEnabled,
        setWcEnabled,
        primaryCountry,
        themeColors
      }}
    >
      {children}
    </WorldCupContext.Provider>
  );
}

export function useWorldCup() {
  const context = useContext(WorldCupContext);
  if (context === undefined) {
    throw new Error('useWorldCup must be used within a WorldCupProvider');
  }
  return context;
}
