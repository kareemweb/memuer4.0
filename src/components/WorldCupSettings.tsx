import React, { useState } from 'react';
import { Check, Trophy } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { WORLD_CUP_2026_TEAMS, getAllGroups } from '../data/worldCup2026';

interface WorldCupSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WorldCupSettings({ isOpen, onClose }: WorldCupSettingsProps) {
  const { t, language } = useLanguage();
  const {
    supportedCountries,
    addSupportedCountry,
    removeSupportedCountry,
    themeColors
  } = useWorldCup();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const filteredTeams = WORLD_CUP_2026_TEAMS.filter(team => {
    const query = (searchQuery || '').toLowerCase();
    const matchesSearch = (team.name || '').toLowerCase().includes(query) ||
      (team.nameAr || '').includes(query) ||
      (team.code || '').toLowerCase().includes(query);
    const matchesGroup = !selectedGroup || team.group === selectedGroup;
    return matchesSearch && matchesGroup;
  });

  const teamName = (team: typeof WORLD_CUP_2026_TEAMS[0]) =>
    language === 'ar' ? team.nameAr : team.name;

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full bg-transparent overflow-hidden">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[calc(85vh-160px)]">
        <p className="text-sm text-zinc-400 text-center font-medium">
          {t('selectCountries')}
        </p>

        {/* Search */}
        <input
          type="text"
          placeholder={t('search')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none transition-all duration-200 text-sm"
          style={{
            borderColor: searchQuery ? themeColors.accent : 'rgba(255, 255, 255, 0.1)'
          }}
        />

        {/* Group filter */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          <button
            onClick={() => setSelectedGroup(null)}
            className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200"
            style={!selectedGroup ? {
              backgroundColor: `${themeColors.accent}1f`,
              color: themeColors.accent
            } : {
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: '#a1a1aa'
            }}
          >
            All
          </button>
          {getAllGroups().map(group => (
            <button
              key={group}
              onClick={() => setSelectedGroup(group)}
              className="px-2.5 py-1 rounded-md text-xs font-semibold transition-all duration-200"
              style={selectedGroup === group ? {
                backgroundColor: `${themeColors.accent}1f`,
                color: themeColors.accent
              } : {
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#a1a1aa'
              }}
            >
              {group}
            </button>
          ))}
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2">
          {filteredTeams.map(team => {
            const isSelected = supportedCountries.some(c => c.id === team.id);
            return (
              <button
                key={team.id}
                onClick={() => isSelected ? removeSupportedCountry(team.id) : addSupportedCountry(team.id)}
                className="relative p-2.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center min-h-[72px] sm:min-h-[80px]"
                style={isSelected ? {
                  backgroundImage: `linear-gradient(to right, ${team.primaryColor}, ${team.accentColor || team.primaryColor})`,
                  borderColor: 'transparent',
                  color: 'white',
                  transform: 'scale(1.02)'
                } : {
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#e4e4e7'
                }}
              >
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-white/20 p-0.5 rounded-full">
                    <Check className="w-2.5 h-2.5 text-white stroke-[3px]" />
                  </div>
                )}
                <div className="text-xl sm:text-2xl">{team.flag}</div>
                <div className="text-[10px] font-bold truncate w-full mt-1.5 tracking-tight">{teamName(team)}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 mt-auto bg-transparent">
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl text-white font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-[0.98] select-none hover:brightness-110 cursor-pointer"
          style={{
            backgroundImage: `linear-gradient(to right, ${themeColors.primary}, ${themeColors.accent})`
          }}
        >
          {t('saveChanges')}
        </button>
      </div>
    </div>
  );
}
