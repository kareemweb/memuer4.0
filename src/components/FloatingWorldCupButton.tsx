import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Settings, Radio, X, ArrowLeft } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { WorldCupSettings } from './WorldCupSettings';
import { WorldCupMatchTracker } from './WorldCupMatchTracker';

export function FloatingWorldCupButton() {
  const { t, language, isRTL } = useLanguage();
  const { user } = useAuth();
  const { supportedCountries, showOnboarding, themeMode, primaryCountry, wcEnabled, themeColors, sidebarWidgetPinned, setSidebarWidgetPinned } = useWorldCup();
  const [isOpen, setIsOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<'matches' | 'settings' | null>(null);

  // Don't show if user is not logged in, onboarding is displayed, or WC mode is disabled
  if (!user || showOnboarding || !wcEnabled) return null;

  const teamFlag = primaryCountry?.flag || '⚽';

  return (
    <>
      {/* Floating Button */}
      <motion.button
        id="world-cup-floating-btn"
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 ${
          themeMode === 'country' && primaryCountry
            ? 'bg-gradient-to-r ' + primaryCountry.gradient + ' hover:brightness-110'
            : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500'
        }`}
        title={t('worldCupMode')}
      >
        <span className="text-xl sm:text-2xl">{teamFlag}</span>
        {/* Notification dot for live matches */}
        {isOpen === false && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full animate-pulse border-2 border-zinc-950" />
        )}
      </motion.button>

      {/* Slide-up / Overlay Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-0 md:p-4"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-full md:h-[85vh] md:max-h-[750px] md:max-w-2xl md:rounded-3xl overflow-hidden border-t md:border border-white/10 shadow-2xl flex flex-col bg-zinc-950"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              {/* Sleek Dynamic Glowing Country/Classic Flag stripe across the top header of Category panel */}
              <div 
                className="h-1.5 w-full bg-gradient-to-r shrink-0" 
                style={{
                  backgroundImage: themeMode === 'country' && primaryCountry
                    ? `linear-gradient(to right, ${primaryCountry.primaryColor}, ${primaryCountry.secondaryColor || '#ffffff'}, ${primaryCountry.accentColor || primaryCountry.primaryColor})`
                    : 'linear-gradient(to right, #08b6d4, #4f46e5)'
                }}
              />

              <div 
                className="flex-1 flex flex-col overflow-hidden backdrop-blur-xl transition-all duration-300 bg-zinc-950"
                style={themeMode === 'country' && primaryCountry ? {
                  backgroundImage: `linear-gradient(to bottom right, rgba(9, 9, 11, 0.98), rgba(18, 18, 20, 0.99), ${primaryCountry.primaryColor}22)`
                } : {}}
              >
                {/* Header */}
                <div 
                  className="flex items-center justify-between p-4 border-b border-white/10 shrink-0 bg-black/40"
                  style={themeMode === 'country' && primaryCountry ? {
                    borderBottomColor: `${primaryCountry.primaryColor}25`
                  } : {}}
                >
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-400 font-bold animate-pulse" />
                    <h2 className="text-base font-extrabold text-white tracking-wide uppercase">{t('worldCupMode')}</h2>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {activePanel !== null && (
                      <button
                        onClick={() => setActivePanel(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-zinc-300 hover:text-white transition-all text-xs font-semibold mr-1 cursor-pointer hover:bg-white/10"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                      </button>
                    )}
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Quick nav */}
                {activePanel === null && (
                  <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                    {/* Your Teams */}
                    {supportedCountries.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
                          Your Selected Teams
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                          {supportedCountries.map(team => (
                            <div
                              key={team.id}
                              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                            >
                              <span className="text-lg">{team.flag}</span>
                              <span className="text-sm font-semibold text-white">
                                {team.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setActivePanel('matches')}
                        className="p-6 rounded-2xl border transition-all flex flex-col justify-between items-center bg-white/5 border-white/10 text-center hover:bg-white/8 hover:scale-[1.02] cursor-pointer"
                        style={{
                          backgroundImage: `linear-gradient(to bottom right, ${themeColors.primary}1c, ${themeColors.accent}14)`,
                          borderColor: `${themeColors.accent}40`
                        }}
                      >
                        <Radio className="w-8 h-8 mx-auto mb-2 text-indigo-400" style={{ color: themeColors.accent }} />
                        <p className="text-white font-bold">{t('liveMatches')}</p>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                          Real-time match tracking & events
                        </p>
                      </button>

                      <button
                        onClick={() => setActivePanel('settings')}
                        className="p-6 rounded-2xl border transition-all flex flex-col justify-between items-center bg-white/5 border-white/10 text-center hover:bg-white/8 hover:scale-[1.02] cursor-pointer"
                        style={{
                          backgroundImage: `linear-gradient(to bottom right, ${themeColors.primary}20, ${themeColors.accent}18)`,
                          borderColor: `${themeColors.accent}45`
                        }}
                      >
                        <Settings className="w-8 h-8 mx-auto mb-2 text-indigo-400" style={{ color: themeColors.accent }} />
                        <p className="text-white font-bold">{t('settings')}</p>
                        <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">
                          Manage selected countries & team setup
                        </p>
                      </button>
                    </div>

                    {/* Pin Widget Quick Control */}
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">📌</span>
                        <div>
                          <p className="text-sm font-bold text-white">Chat Sidebar Widget</p>
                          <p className="text-[11px] text-zinc-400">Add live scores & match schedule directly on your main stream</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setSidebarWidgetPinned(!sidebarWidgetPinned)}
                        className={`w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                          sidebarWidgetPinned
                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-indigo-950 font-black'
                        }`}
                      >
                        {sidebarWidgetPinned ? 'Unpin' : 'Pin Widget'}
                      </button>
                    </div>

                    {/* Quick Stats */}
                    <div className="mt-8 grid grid-cols-3 gap-3 text-center">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-3xl font-black text-indigo-400" style={{ color: themeColors.accent }}>{supportedCountries.length}</div>
                        <div className="text-[9px] font-black tracking-wider text-zinc-400 uppercase mt-1">
                          Your Teams
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-3xl font-black text-green-400">104</div>
                        <div className="text-[9px] font-black tracking-wider text-zinc-400 uppercase mt-1">
                          Total Matches
                        </div>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <div className="text-3xl font-black text-yellow-400">48</div>
                        <div className="text-[9px] font-black tracking-wider text-zinc-400 uppercase mt-1">
                          Countries
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Tracker Panel */}
                {activePanel === 'matches' && (
                  <div className="flex-1 overflow-hidden flex flex-col h-full bg-zinc-950/40">
                    <WorldCupMatchTracker compact={false} onClose={() => setActivePanel(null)} />
                  </div>
                )}

                {/* Settings Panel */}
                {activePanel === 'settings' && (
                  <div className="flex-1 overflow-hidden flex flex-col h-full">
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
