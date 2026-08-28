import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trophy, Palette, Globe, Check, ChevronRight, ChevronLeft, Bell, Monitor, Sun, Moon } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage, Language } from '../i18n/LanguageContext';
import { WORLD_CUP_2026_TEAMS, getAllGroups, CLASSIC_WC_THEME } from '../data/worldCup2026';

interface WorldCupSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorldCupSettings({ isOpen, onClose }: WorldCupSettingsProps) {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const {
    supportedCountries,
    addSupportedCountry,
    removeSupportedCountry,
    themeMode,
    setThemeMode,
    primaryCountry,
    themeColors,
    setWcEnabled
  } = useWorldCup();

  const [activeTab, setActiveTab] = useState<'teams' | 'theme' | 'language'>('teams');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(team => {
    const query = searchQuery.toLowerCase();
    return (team.name.toLowerCase().includes(query) ||
      team.nameAr.includes(query)) &&
      (!selectedGroup || team.group === selectedGroup);
  });

  const teamName = (team: typeof WORLD_CUP_2026_TEAMS[0]) =>
    language === 'ar' ? team.nameAr : team.name;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold text-white">{t('worldCupMode')}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10">
            {(['teams', 'theme', 'language'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                    : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {tab === 'teams' && <Trophy className="w-4 h-4" />}
                {tab === 'theme' && <Palette className="w-4 h-4" />}
                {tab === 'language' && <Globe className="w-4 h-4" />}
                <span>
                  {tab === 'teams' && (language === 'ar' ? 'فرق' : 'Teams')}
                  {tab === 'theme' && t('theme')}
                  {tab === 'language' && t('language')}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-4">
            <AnimatePresence mode="wait">
              {/* Teams Tab */}
              {activeTab === 'teams' && (
                <motion.div
                  key="teams"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-zinc-400 text-center">
                    {t('selectCountries')}
                  </p>

                  {/* Search */}
                  <input
                    type="text"
                    placeholder={t('search')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50"
                  />

                  {/* Group filter */}
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        !selectedGroup ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    {getAllGroups().map(group => (
                      <button
                        key={group}
                        onClick={() => setSelectedGroup(group)}
                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                          selectedGroup === group ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>

                  {/* Team Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {filteredTeams.map(team => {
                      const isSelected = supportedCountries.some(c => c.id === team.id);
                      return (
                        <button
                          key={team.id}
                          onClick={() => isSelected ? removeSupportedCountry(team.id) : addSupportedCountry(team.id)}
                          className={`relative p-2 rounded-lg border transition-all ${
                            isSelected
                              ? 'border-transparent bg-gradient-to-r ' + team.gradient + ' text-white'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          {isSelected && <Check className="absolute top-1 right-1 w-3 h-3" />}
                          <div className="text-xl">{team.flag}</div>
                          <div className="text-[10px] font-medium truncate mt-1">{teamName(team)}</div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Theme Tab */}
              {activeTab === 'theme' && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-zinc-400 text-center">
                    {language === 'ar' ? 'اختر مظهر التطبيق' : 'Choose how the app looks'}
                  </p>

                  <div className="space-y-3">
                    {/* Country Theme */}
                    {primaryCountry && (
                      <button
                        onClick={() => setThemeMode('country')}
                        className={`w-full p-4 rounded-xl border text-left transition-all ${
                          themeMode === 'country'
                            ? 'border-transparent bg-gradient-to-r ' + primaryCountry.gradient + ' text-white'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{primaryCountry.flag}</div>
                          <div className="flex-1">
                            <div className="font-semibold">{t('countryTheme')}</div>
                            <div className="text-xs opacity-70">{teamName(primaryCountry)}</div>
                          </div>
                          {themeMode === 'country' && <Check className="w-5 h-5" />}
                        </div>
                      </button>
                    )}

                    {/* Classic WC Theme */}
                    <button
                      onClick={() => setThemeMode('classic')}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        themeMode === 'classic'
                          ? 'border-transparent bg-gradient-to-r from-red-700 via-green-600 to-blue-700 text-white'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">🏆</div>
                        <div className="flex-1">
                          <div className="font-semibold">{t('classicTheme')}</div>
                          <div className="text-xs opacity-70">Red • Green • Blue</div>
                        </div>
                        {themeMode === 'classic' && <Check className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Default Theme */}
                    <button
                      onClick={() => setThemeMode('default')}
                      className={`w-full p-4 rounded-xl border text-left transition-all ${
                        themeMode === 'default'
                          ? 'border-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">💬</div>
                        <div className="flex-1">
                          <div className="font-semibold">{language === 'ar' ? 'مظهر ميموير' : 'Default Memuer'}</div>
                          <div className="text-xs opacity-70">Indigo • Violet • Cyan</div>
                        </div>
                        {themeMode === 'default' && <Check className="w-5 h-5" />}
                      </div>
                    </button>
                  </div>

                  {/* Theme Preview */}
                  <div className="mt-6 p-4 rounded-xl border border-white/10">
                    <div className="text-xs text-zinc-400 mb-3">{language === 'ar' ? 'معاينة' : 'Preview'}</div>
                    <div className={`h-16 rounded-lg bg-gradient-to-r ${themeColors.gradient} flex items-center justify-center text-white font-bold`}>
                      {language === 'ar' ? 'ميموير' : 'memuer'}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Language Tab */}
              {activeTab === 'language' && (
                <motion.div
                  key="language"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-sm text-zinc-400 text-center">
                    {t('changeLanguage')}
                  </p>

                  <div className="space-y-3">
                    {/* English */}
                    <button
                      onClick={() => setLanguage('en')}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        language === 'en'
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-2xl">🇺🇸</div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-white">English</div>
                        <div className="text-xs text-zinc-400">Default language</div>
                      </div>
                      {language === 'en' && <Check className="w-5 h-5 text-cyan-400" />}
                    </button>

                    {/* Arabic */}
                    <button
                      onClick={() => setLanguage('ar')}
                      className={`w-full p-4 rounded-xl border transition-all flex items-center gap-4 ${
                        language === 'ar'
                          ? 'border-cyan-500/50 bg-cyan-500/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-2xl">🇸🇦</div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-white">العربية</div>
                        <div className="text-xs text-zinc-400">
                          {language === 'ar' ? 'اللغة العربية - دعم RTL كامل' : 'Arabic - Full RTL support'}
                        </div>
                      </div>
                      {language === 'ar' && <Check className="w-5 h-5 text-cyan-400" />}
                    </button>
                  </div>

                  {/* RTL Notice */}
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <p className="text-xs text-yellow-400">
                      {language === 'ar'
                        ? 'عند اختيار العربية، سيتغير اتجاه التطبيق من اليمين إلى اليسار تلقائياً'
                        : 'When Arabic is selected, the app direction will change to right-to-left automatically'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white font-semibold transition-all"
            >
              {t('saveChanges')}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
