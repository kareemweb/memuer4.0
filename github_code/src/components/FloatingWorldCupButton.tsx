import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Settings, Radio, X } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { WorldCupSettings } from './WorldCupSettings';
import { WorldCupMatchTracker } from './WorldCupMatchTracker';

export function FloatingWorldCupButton() {
  const { t, language, isRTL } = useLanguage();
  const { supportedCountries, showOnboarding, themeMode, primaryCountry, wcEnabled } = useWorldCup();
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'matches' | 'settings' | null>(null);

  // Don't show if onboarding is displayed or WC mode is disabled
  if (showOnboarding || !wcEnabled) return null;

  const teamFlag = primaryCountry?.flag || '⚽';

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          themeMode === 'classic'
            ? 'bg-gradient-to-r from-red-600 via-green-600 to-blue-600 hover:from-red-500 hover:via-green-500 hover:to-blue-500'
            : themeMode === 'country'
            ? 'bg-gradient-to-r ' + (primaryCountry?.gradient || 'from-[#6366f1] via-[#8b5cf6] to-[#06b6d4]')
            : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500'
        }`}
        title={t('worldCupMode')}
      >
        <span className="text-xl sm:text-2xl">{teamFlag}</span>
        {/* Notification dot for live matches */}
        {isOpen === false && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-black" />
        )}
      </motion.button>

      {/* Slide-up Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-3xl overflow-hidden"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className={`min-h-[50vh] max-h-[85vh] flex flex-col ${
                themeMode === 'classic'
                  ? 'bg-gradient-to-br from-red-950/95 via-green-950/95 to-blue-950/95 backdrop-blur-xl'
                  : 'bg-zinc-900/95 backdrop-blur-xl'
              }`}>
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400" />
                    <h2 className="text-lg font-bold text-white">{t('worldCupMode')}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {activePanel !== null && (
                      <button
                        onClick={() => setActivePanel(null)}
                        className="p-2 rounded-lg hover:bg-white/10 text-zinc-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-white/10 text-zinc-400"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick nav */}
                {activePanel === null && (
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {/* Your Teams */}
                    {supportedCountries.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center mb-6">
                        {supportedCountries.map(team => (
                          <div
                            key={team.id}
                            className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 border border-white/20"
                          >
                            <span className="text-lg">{team.flag}</span>
                            <span className="text-sm font-medium text-white">
                              {language === 'ar' ? team.nameAr : team.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setActivePanel('matches')}
                        className="p-6 rounded-xl bg-gradient-to-br from-cyan-600/20 to-indigo-600/20 border border-cyan-500/20 hover:border-cyan-500/40 transition-all"
                      >
                        <Radio className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                        <p className="text-white font-semibold">{t('liveMatches')}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {language === 'ar' ? 'تابع المباريات في الوقت الفعلي' : 'Real-time match tracking'}
                        </p>
                      </button>

                      <button
                        onClick={() => setActivePanel('settings')}
                        className="p-6 rounded-xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 border border-violet-500/20 hover:border-violet-500/40 transition-all"
                      >
                        <Settings className="w-8 h-8 text-violet-400 mx-auto mb-2" />
                        <p className="text-white font-semibold">{t('settings')}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {language === 'ar' ? 'الفريق، المظهر، اللغة' : 'Teams, theme, language'}
                        </p>
                      </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold text-cyan-400">{supportedCountries.length}</div>
                        <div className="text-[10px] text-zinc-400 uppercase">
                          {language === 'ar' ? 'فرقك' : 'Your Teams'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold text-green-400">104</div>
                        <div className="text-[10px] text-zinc-400 uppercase">
                          {language === 'ar' ? 'مباريات' : 'Total Matches'}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-white/5">
                        <div className="text-2xl font-bold text-yellow-400">48</div>
                        <div className="text-[10px] text-zinc-400 uppercase">
                          {language === 'ar' ? 'دولة' : 'Countries'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Tracker Panel */}
                {activePanel === 'matches' && (
                  <div className="flex-1">
                    <WorldCupMatchTracker compact={false} onClose={() => setActivePanel(null)} />
                  </div>
                )}

                {/* Settings Panel */}
                {activePanel === 'settings' && (
                  <div className="flex-1">
                    <WorldCupSettings
                      isOpen={true}
                      onClose={() => setActivePanel(null)}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
