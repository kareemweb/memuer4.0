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
  sidebarWidgetPinned: boolean;
  setSidebarWidgetPinned: (pinned: boolean) => void;
}

const WorldCupContext = createContext<WorldCupContextType | undefined>(undefined);

const STORAGE_KEY = 'memuer_world_cup_2026';

export function WorldCupProvider({ children }: { children: ReactNode }) {
  const [supportedCountryIds, setSupportedCountryIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.supportedCountries)) {
          return data.supportedCountries;
        }
      }
    } catch (_) {}
    return [];
  });
  const [, setThemeModeState] = useState<ThemeMode>('country');
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [wcEnabled, setWcEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.enabled === 'boolean') {
          return data.enabled;
        }
      }
    } catch (_) {}
    return true; // Default to true!
  });

  const [sidebarWidgetPinned, setSidebarWidgetPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.sidebarWidgetPinned === 'boolean') {
          return data.sidebarWidgetPinned;
        }
      }
    } catch (_) {}
    return false;
  });

  // Computed theme mode: use country if primaryCountry exists and World Cup mode is enabled, else default
  const primaryCountry = React.useMemo(() => {
    const id = supportedCountryIds[0];
    return id ? getTeamById(id) || null : null;
  }, [supportedCountryIds]);

  const themeMode = (wcEnabled && primaryCountry) ? 'country' : 'default';
  const setThemeMode = (mode: ThemeMode) => {
    // Override manual theme modes to stay fully aligned with selected team
  };

  // Save to localStorage whenever config changes
  useEffect(() => {
    const hasSeenOnboarding = !showOnboarding || supportedCountryIds.length > 0;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      supportedCountries: supportedCountryIds,
      enabled: wcEnabled,
      themeMode: 'country',
      hasSeenOnboarding,
      sidebarWidgetPinned
    }));
  }, [supportedCountryIds, wcEnabled, showOnboarding, sidebarWidgetPinned]);

  const supportedCountries = supportedCountryIds
    .map(id => getTeamById(id))
    .filter((c): c is Country => c !== undefined);

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

  // Apply theme to the entire document DOM dynamically!
  useEffect(() => {
    const root = document.documentElement;

    if (themeMode === 'default') {
      root.style.removeProperty('--color-indigo-400');
      root.style.removeProperty('--color-indigo-500');
      root.style.removeProperty('--color-indigo-600');
      root.style.removeProperty('--color-indigo-700');
      root.style.removeProperty('--color-indigo-800');
      root.style.removeProperty('--color-indigo-900');
      root.style.removeProperty('--color-indigo-950');
      root.style.removeProperty('--color-cyan-500');
      root.style.removeProperty('--color-cyan-600');
      root.style.removeProperty('--color-cyan-700');
      root.style.removeProperty('--color-violet-500');
      root.style.removeProperty('--color-violet-600');
      root.style.removeProperty('--theme-gradient-from');
      root.style.removeProperty('--theme-gradient-to');
      return;
    }

    const primary = themeColors.primary;
    const accent = themeColors.accent;

    function adjustColorBrightness(hex: string, percent: number) {
      // Strips empty spaces or hash
      const cleanHex = hex.replace("#", "").trim();
      let num = parseInt(cleanHex, 16);
      if (isNaN(num)) {
        num = 0x6366f1; // fallback
      }
      const amt = Math.round(2.55 * percent);
      let R = (num >> 16) + amt;
      let G = (num >> 8 & 0x00FF) + amt;
      let B = (num & 0x0000FF) + amt;

      R = Math.min(255, Math.max(0, R));
      G = Math.min(255, Math.max(0, G));
      B = Math.min(255, Math.max(0, B));

      return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    const darkPrimary = adjustColorBrightness(primary, -50);
    const deepDarkPrimary = adjustColorBrightness(primary, -75);
    const brightPrimary = adjustColorBrightness(primary, 20);

    // Dynamic Tailwind v4 Theme Color Overrides
    root.style.setProperty('--color-indigo-400', brightPrimary);
    root.style.setProperty('--color-indigo-500', primary);
    root.style.setProperty('--color-indigo-600', primary);
    root.style.setProperty('--color-indigo-700', adjustColorBrightness(primary, -15));
    root.style.setProperty('--color-indigo-800', darkPrimary);
    root.style.setProperty('--color-indigo-900', adjustColorBrightness(darkPrimary, -15));
    root.style.setProperty('--color-indigo-950', deepDarkPrimary);

    root.style.setProperty('--color-cyan-500', accent);
    root.style.setProperty('--color-cyan-600', accent);
    root.style.setProperty('--color-cyan-700', adjustColorBrightness(accent, -15));

    root.style.setProperty('--color-violet-500', accent);
    root.style.setProperty('--color-violet-600', adjustColorBrightness(accent, -15));

    // Custom helper variables to override gradients easily
    root.style.setProperty('--theme-gradient-from', primary);
    root.style.setProperty('--theme-gradient-to', accent);
  }, [themeColors, themeMode]);

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
        themeColors,
        sidebarWidgetPinned,
        setSidebarWidgetPinned
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
