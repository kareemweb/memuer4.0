import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Globe, Palette, Trophy, ArrowRight } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { WORLD_CUP_2026_TEAMS, getAllGroups } from '../data/worldCup2026';
import { WorldCupMatchTracker } from './WorldCupMatchTracker';

export function WorldCupOnboarding() {
  const { t, language, isRTL } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const {
    supportedCountries,
    addSupportedCountry,
    removeSupportedCountry,
    showOnboarding,
    setShowOnboarding,
    setWcEnabled
  } = useWorldCup();

  const [step, setStep] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  if (authLoading || !user || !showOnboarding) return null;

  const steps = ['welcome', 'select', 'done'];

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(team => {
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = (team.name || '').toLowerCase().includes(query) ||
      (team.nameAr || '').includes(query) ||
      (team.code || '').toLowerCase().includes(query);
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
        className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-[96vw] max-w-2xl h-[92vh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-900 shadow-2xl relative"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          {/* Header */}
          <div className="relative overflow-hidden shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600 via-green-600 to-blue-700 opacity-75" />
            <div className="relative px-3 py-1.5 sm:px-6 sm:py-3.5 text-center">
              <Trophy className="w-4 h-4 sm:w-8 sm:h-8 mx-auto mb-0.5 sm:mb-1 text-yellow-300 drop-shadow" />
              <h1 className="text-sm sm:text-base font-black text-white drop-shadow uppercase tracking-wide">
                {t('worldCupMode')}
              </h1>
              <p className="text-[8px] sm:text-xs text-white/90 mt-0.5 font-medium">
                {language === 'ar'
                  ? 'كندا 🇨🇦 • المكسيك 🇲🇽 • الولايات المتحدة 🇺🇸'
                  : 'Canada 🇨🇦 • Mexico 🇲🇽 • USA 🇺🇸'}
              </p>
            </div>
            <button
              onClick={handleSkip}
              className="absolute top-1.5 right-1.5 p-1 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center gap-1.5 py-1 bg-zinc-950/60 border-b border-white/5 shrink-0">
            {steps.map((s, i) => (
              <div
                key={s}
                className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full transition-all duration-300 ${
                  i <= step ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 scale-110' : 'bg-white/15'
                }`}
              />
            ))}
          </div>

          {/* Content area: scrolls dynamically, keeping header and footer anchored */}
          <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-6 sm:py-5 custom-scrollbar bg-zinc-950/20 text-white min-h-0">
            <AnimatePresence mode="wait">
              {/* Step 0: Welcome */}
              {step === 0 && (
                <motion.div
                  key="welcome"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center py-1 sm:py-4 flex flex-col items-center justify-center h-full max-w-md mx-auto space-y-2 sm:space-y-3.5"
                >
                  <div className="text-3xl sm:text-5xl animate-pulse">⚽🏆</div>
                  <div>
                    <h2 className="text-sm sm:text-lg font-extrabold text-white mb-0.5 sm:mb-1">
                      {t('welcomeToMemuer')}
                    </h2>
                    <p className="text-[10px] sm:text-xs text-zinc-400 leading-normal font-medium">
                      {t('worldCupDescription')}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 w-full pt-1">
                    <div className="p-1 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                      <Globe className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-cyan-400 mb-0.5 sm:mb-1" />
                      <p className="text-[8px] sm:text-[9px] font-bold text-zinc-200 uppercase tracking-wide">48 {language === 'ar' ? 'دولة' : 'Teams'}</p>
                    </div>
                    <div className="p-1 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                      <Trophy className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-yellow-400 mb-0.5 sm:mb-1" />
                      <p className="text-[8px] sm:text-[9px] font-bold text-zinc-200 uppercase tracking-wide">104 {language === 'ar' ? 'مباراة' : 'Matches'}</p>
                    </div>
                    <div className="p-1 sm:p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center">
                      <Palette className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-purple-400 mb-0.5 sm:mb-1" />
                      <p className="text-[8px] sm:text-[9px] font-bold text-zinc-200 uppercase tracking-wide">{language === 'ar' ? 'سمات' : 'Themes'}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Step 1: Select Countries */}
              {step === 1 && (
                <motion.div
                  key="select"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-2 max-w-xl mx-auto"
                >
                  <div className="text-center">
                    <h2 className="text-xs sm:text-base font-extrabold text-white">
                      {t('selectCountries')}
                    </h2>
                    <p className="text-[9px] sm:text-xs text-zinc-400 mt-0.5">
                      {t('youCanSelectMultiple')}
                    </p>
                  </div>

                  {/* Search */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder={t('search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/50 text-xs transition-all"
                    />
                  </div>

                  {/* Group Filter */}
                  <div className="flex flex-wrap gap-1 px-1 justify-center max-h-[36px] sm:max-h-[72px] overflow-y-auto custom-scrollbar">
                    <button
                      onClick={() => setSelectedGroup(null)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                        !selectedGroup
                          ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white shadow'
                          : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      {language === 'ar' ? 'الكل' : 'All'}
                    </button>
                    {getAllGroups().map(group => (
                      <button
                        key={group}
                        onClick={() => setSelectedGroup(group)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                          selectedGroup === group
                            ? 'bg-gradient-to-r from-red-500 via-green-500 to-blue-500 text-white shadow'
                            : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>

                  {/* Country Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1 mt-1.5 max-h-[140px] sm:max-h-[260px] overflow-y-auto pr-1 parsed-grid custom-scrollbar">
                    {filteredTeams.map(team => {
                      const isSelected = supportedCountries.some(c => c.id === team.id);
                      return (
                        <motion.button
                          key={team.id}
                          onClick={() => handleToggleCountry(team.id)}
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          className={`relative p-1 rounded-lg border transition-all text-center flex flex-col items-center justify-center min-h-[44px] sm:min-h-[64px] cursor-pointer ${
                            isSelected
                              ? 'border-transparent bg-gradient-to-r ' + team.gradient + ' text-white shadow-md'
                              : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-0.5 right-0.5 bg-white/20 p-0.5 rounded-full">
                              <Check className="w-2 h-2 text-white stroke-[3px]" />
                            </div>
                          )}
                          <div className="text-sm sm:text-lg mb-0.5">{team.flag}</div>
                          <div className="text-[9px] font-bold truncate w-full px-1">
                            {teamName(team)}
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Step 2: Done */}
              {step === 2 && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center py-1 sm:py-4 max-w-md mx-auto space-y-2 sm:space-y-4"
                >
                  <div className="text-3xl sm:text-5xl">🎉⚽</div>
                  <div>
                    <h2 className="text-base sm:text-xl font-extrabold text-white mb-0.5 sm:mb-1">
                      {language === 'ar' ? 'أنت جاهز!' : "You're All Set!"}
                    </h2>
                    <p className="text-[10px] sm:text-sm text-zinc-400 leading-normal sm:leading-relaxed font-semibold">
                      {language === 'ar'
                        ? 'استمتع بمتابعة مباريات فريقك المفضل وتلقي التحديثات فورا!'
                        : 'Enjoy following your favorite teams matches & tracking real-time events!'}
                    </p>
                  </div>

                  {/* Show selected teams */}
                  {supportedCountries.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-widest text-center">
                        {language === 'ar' ? 'الفرق المختارة' : 'Your Selected Teams'}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1">
                        {supportedCountries.map(team => (
                          <div
                            key={team.id}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10"
                          >
                            <span className="text-xs">{team.flag}</span>
                            <span className="text-[8px] sm:text-[10px] font-semibold text-zinc-200">{teamName(team)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview of Match Tracker */}
                  {supportedCountries.length > 0 && (
                    <div className="hidden sm:block mt-2 border border-white/5 rounded-2xl bg-black/30 p-2 text-left max-h-[160px] overflow-y-auto custom-scrollbar">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 text-center">
                        {language === 'ar' ? 'معاينة متعقب المباريات' : 'Match Tracker Preview'}
                      </p>
                      <WorldCupMatchTracker compact />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center p-3 sm:p-4 border-t border-white/10 bg-zinc-950/60 shrink-0">
            <button
              onClick={step === 0 ? handleSkip : handleBack}
              className="px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {step === 0 ? t('skipForNow') : language === 'ar' ? 'رجوع' : 'Back'}
            </button>

            <button
              onClick={handleContinue}
              className="flex items-center gap-1.5 px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-green-600 to-blue-700 hover:brightness-110 text-white text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <span>{step === steps.length - 1 ? t('ok') : t('continueBtn')}</span>
              {step !== steps.length - 1 && (
                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
