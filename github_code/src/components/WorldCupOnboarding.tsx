import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, Check, Globe, Palette, Trophy, ArrowRight } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { WORLD_CUP_2026_TEAMS, getAllGroups, getTeamsByGroup } from '../data/worldCup2026';
import { WorldCupMatchTracker } from './WorldCupMatchTracker';

export function WorldCupOnboarding() {
  const { t, language, isRTL } = useLanguage();
  const {
    supportedCountries,
    addSupportedCountry,
    removeSupportedCountry,
    setSupportedCountries,
    themeMode,
    setThemeMode,
    showOnboarding,
    setShowOnboarding,
    setWcEnabled
  } = useWorldCup();

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  if (!showOnboarding) return null;

  const steps = ['welcome', 'select', 'theme', 'done'];

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(team => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = team.name.toLowerCase().includes(query) ||
      team.nameAr.includes(query) ||
      team.code.toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || team.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const handleToggleCountry = (countryId: string) => {
    if (supportedCountries.some(c => c.id === countryId)) {
      removeSupportedCountry(countryId);
    } else {
      addSupportedCountry(countryId);
    }
  };

  const handleSkip = () => {
    setWcEnabled(true);
    setShowOnboarding(false);
  };

  const handleContinue = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      setWcEnabled(true);
      setShowOnboarding(false);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const teamName = (team: typeof WORLD_CUP_2026_TEAMS[0]) =>
    language === 'ar' ? team.nameAr : team.name;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-lg p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 shadow-2xl"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-green-600 to-blue-700 opacity-80" />
            <div className="relative px-6 py-8 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-300 drop-shadow-lg" />
              <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-lg">
                {t('worldCupMode')}
              </h1>
              <p className="text-lg text-white/80 mt-2">
                {language === 'ar'
                  ? 'كندا 🇨🇦 • المكسيك 🇲🇽 • الولايات المتحدة 🇺🇸'
                  : 'Canada 🇨🇦 • Mexico 🇲🇽 • USA 🇺🇸'}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center gap-2 py-4 bg-zinc-800/50">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500' : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-280px)] p-6">
            <AnimatePresence mode="wait">
              {/* Step 0: Welcome */}
              {step === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="text-center py-8"
                >
                  <div className="text-7xl mb-6">⚽🏆</div>
                  <h2 className="text-2xl font-bold text-white mb-4">
                    {t('welcomeToMemuer')}
                  </h2>
                  <p className="text-zinc-400 max-w-md mx-auto">
                    {t('worldCupDescription')}
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-8 max-w-md mx-auto">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <Globe className="w-8 h-8 mx-auto text-cyan-400 mb-2" />
                      <p className="text-sm text-white">48 {language === 'ar' ? 'دولة' : 'Teams'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <Trophy className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
                      <p className="text-sm text-white">104 {language === 'ar' ? 'مباراة' : 'Matches'}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <Palette className="w-8 h-8 mx-auto text-purple-400 mb-2" />
                      <p className="text-sm text-white">{language === 'ar' ? 'مظاهر' : 'Themes'}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Select Countries */}
              {step === 1 && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="space-y-4"
                >
                  <h2 className="text-xl font-bold text-white text-center mb-4">
                    {t('selectCountries')}
                  </h2>
                  <p className="text-zinc-400 text-center text-sm mb-4">
                    {t('youCanSelectMultiple')}
                  </p>

                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Group Filter */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        !selectedGroup
                          ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    {getAllGroups().map(group => (
                      <button
                        key={group}
                        onClick={() => setSelectedGroup(group)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          selectedGroup === group
                            ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white'
                            : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>

                  {/* Country Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-4">
                    {filteredTeams.map(team => {
                      const isSelected = supportedCountries.some(c => c.id === team.id);
                      return (
                        <motion.button
                          key={team.id}
                          onClick={() => handleToggleCountry(team.id)}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`relative p-3 rounded-xl border transition-all ${
                            isSelected
                              ? 'border-transparent bg-gradient-to-r ' + team.gradient + ' text-white shadow-lg'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-1 right-1">
                              <Check className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="text-2xl mb-1">{team.flag}</div>
                          <div className="text-xs font-semibold truncate">
                            {teamName(team)}
                          </div>
                          <div className="text-[10px] opacity-70">
                            {t('group')} {team.group}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Theme Selection */}
              {step === 2 && (
                <motion.div
                  key="theme"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="space-y-6"
                >
                  <h2 className="text-xl font-bold text-white text-center mb-2">
                    {language === 'ar' ? 'اختر مظهر التطبيق' : 'Choose App Theme'}
                  </h2>
                  <p className="text-zinc-400 text-center text-sm">
                    {language === 'ar'
                      ? 'سيتم تطبيق المظهر على التطبيق بالكامل'
                      : 'The theme will be applied to the entire app'}
                  </p>

                  <div className="grid gap-4 max-w-md mx-auto">
                    {/* Country Theme */}
                    {supportedCountries[0] && (
                      <button
                        onClick={() => setThemeMode('country')}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          themeMode === 'country'
                            ? 'border-transparent bg-gradient-to-r ' + supportedCountries[0].gradient + ' text-white shadow-lg'
                            : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-3xl">{supportedCountries[0].flag}</div>
                          <div className="flex-1">
                            <div className="font-semibold">{t('countryTheme')}</div>
                            <div className="text-sm opacity-70">
                              {teamName(supportedCountries[0])}
                            </div>
                          </div>
                          {themeMode === 'country' && <Check className="w-5 h-5" />}
                        </div>
                      </button>
                    )}

                    {/* Classic WC Theme */}
                    <button
                      onClick={() => setThemeMode('classic')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        themeMode === 'classic'
                          ? 'border-transparent bg-gradient-to-r from-red-700 via-green-600 to-blue-700 text-white shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">🏆</div>
                        <div className="flex-1">
                          <div className="font-semibold">{t('classicTheme')}</div>
                          <div className="text-sm opacity-70">Red • Green • Blue</div>
                        </div>
                        {themeMode === 'classic' && <Check className="w-5 h-5" />}
                      </div>
                    </button>

                    {/* Default Theme */}
                    <button
                      onClick={() => setThemeMode('default')}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        themeMode === 'default'
                          ? 'border-transparent bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 text-white shadow-lg'
                          : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">💬</div>
                        <div className="flex-1">
                          <div className="font-semibold">{language === 'ar' ? 'مظهر ميموير' : 'Default Memuer'}</div>
                          <div className="text-sm opacity-70">Indigo • Violet • Cyan</div>
                        </div>
                        {themeMode === 'default' && <Check className="w-5 h-5" />}
                      </div>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Step 3: Done */}
              {step === 3 && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  className="text-center py-8"
                >
                  <div className="text-6xl mb-6">🎉⚽</div>
                  <h2 className="text-2xl font-bold text-white mb-4">
                    {language === 'ar' ? 'أنت جاهز!' : "You're All Set!"}
                  </h2>

                  {/* Show selected teams */}
                  {supportedCountries.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {supportedCountries.map(team => (
                        <div
                          key={team.id}
                          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 border border-white/20"
                        >
                          <span className="text-xl">{team.flag}</span>
                          <span className="text-sm font-medium text-white">{teamName(team)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p className="text-zinc-400 max-w-md mx-auto">
                    {language === 'ar'
                      ? 'استمتع بمتابعة مباريات فريقك المفضل!'
                      : 'Enjoy following your favorite teams matches!'}
                  </p>

                  {/* Preview of Match Tracker */}
                  {supportedCountries.length > 0 && (
                    <div className="mt-8">
                      <WorldCupMatchTracker compact />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-4 border-t border-white/10 bg-zinc-800/50">
            <button
              onClick={step === 0 ? handleSkip : handleBack}
              className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              {step === 0 ? t('skipForNow') : language === 'ar' ? 'رجوع' : 'Back'}
            </button>

            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-green-600 to-blue-700 hover:from-red-500 hover:via-green-500 hover:to-blue-600 text-white font-semibold transition-all shadow-lg hover:shadow-xl"
            >
              {step === steps.length - 1 ? t('ok') : t('continueBtn')}
              {step !== steps.length - 1 && (
                <ArrowRight className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
