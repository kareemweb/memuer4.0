import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Radio, Clock, ChevronRight, RefreshCw, X, Bell, BellOff } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { WORLD_CUP_2026_TEAMS, getTeamById, STADIUMS, WC_API_BASE, Country } from '../data/worldCup2026';

interface LiveMatch {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  status: 'scheduled' | 'live' | 'finished';
  date: string;
  time: string;
  stadium: string;
  city: string;
  group?: string;
  stage: string;
  minute?: number;
  homeEvents?: any[];
  awayEvents?: any[];
}

interface MatchTrackerProps {
  compact?: boolean;
  onClose?: () => void;
}

export function WorldCupMatchTracker({ compact = false, onClose }: MatchTrackerProps) {
  const { t, language, isRTL } = useLanguage();
  const { supportedCountries } = useWorldCup();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'live' | 'upcoming' | 'finished'>('live');
  const [notifications, setNotifications] = useState<Record<string, boolean>>({});
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch matches from World Cup API
  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Using the free open-source World Cup 2026 API
      const response = await fetch(`${WC_API_BASE}/matches`);
      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }
      const data = await response.json();
      const formattedMatches = (data.data || data || []).map((match: any) => {
        const homeTeam = WORLD_CUP_2026_TEAMS.find(t =>
          t.code === match.home_team_code ||
          t.id === match.home_team_id?.toLowerCase() ||
          t.name.toLowerCase() === (match.home_team?.name || match.home_team_name || '').toLowerCase()
        );
        const awayTeam = WORLD_CUP_2026_TEAMS.find(t =>
          t.code === match.away_team_code ||
          t.id === match.away_team_id?.toLowerCase() ||
          t.name.toLowerCase() === (match.away_team?.name || match.away_team_name || '').toLowerCase()
        );
        const stadium = STADIUMS.find(s => s.name === match.stadium || s.id === match.stadium_id);
        return {
          id: match.id || match.match_id,
          homeTeam: homeTeam?.name || match.home_team?.name || match.home_team_name || 'TBD',
          awayTeam: awayTeam?.name || match.away_team?.name || match.away_team_name || 'TBD',
          homeTeamId: homeTeam?.id || match.home_team_id?.toLowerCase() || '',
          awayTeamId: awayTeam?.id || match.away_team_id?.toLowerCase() || '',
          homeScore: match.home_score ?? match.home_team_score,
          awayScore: match.away_score ?? match.away_team_score,
          status: match.status || 'scheduled',
          date: match.date || match.match_date,
          time: match.time || match.kickoff_time,
          stadium: stadium?.name || match.stadium || '',
          city: stadium?.city || match.city || '',
          group: match.group || match.group_name,
          stage: match.type || match.stage || 'group',
          minute: match.minute || match.match_minute
        } as LiveMatch;
      }).filter(Boolean);
      setMatches(formattedMatches);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Failed to fetch matches:', err);
      // Use mock data for demo purposes
      const mockData = generateMockMatches(supportedCountries);
      setMatches(mockData);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Generate mock matches for demo
  const generateMockMatches = (teams: Country[]): LiveMatch[] => {
    const allTeams = WORLD_CUP_2026_TEAMS;
    const mockMatches: LiveMatch[] = [];
    const now = new Date();

    allTeams.forEach((team) => {
      const groupMembers = allTeams.filter(t => t.group === team.group);
      if (groupMembers.length >= 2) {
        for (let i = groupMembers.indexOf(team) + 1; i < groupMembers.length; i++) {
          const opponent = groupMembers[i];
          const hourDiff = Math.floor(Math.random() * 168) - 72;
          const matchDate = new Date(now.getTime() + hourDiff * 3600000);
          const isPast = hourDiff < -2;
          const isLive = hourDiff >= -2 && hourDiff <= 0;

          mockMatches.push({
            id: mockMatches.length + 1,
            homeTeam: team.name,
            awayTeam: opponent.name,
            homeTeamId: team.id,
            awayTeamId: opponent.id,
            homeScore: isPast ? Math.floor(Math.random() * 4) : undefined,
            awayScore: isPast ? Math.floor(Math.random() * 4) : undefined,
            status: isLive ? 'live' : isPast ? 'finished' : 'scheduled',
            date: matchDate.toISOString(),
            time: matchDate.toTimeString().slice(0, 5),
            stadium: STADIUMS[Math.floor(Math.random() * STADIUMS.length)].name,
            city: STADIUMS[Math.floor(Math.random() * STADIUMS.length)].city,
            group: team.group,
            stage: 'group',
            minute: isLive ? Math.floor(Math.random() * 90) : undefined
          });
        }
      }
    });
    return mockMatches;
  };

  useEffect(() => {
    fetchMatches();
    // Poll every 60 seconds for live updates
    const interval = setInterval(fetchMatches, 60000);
    return () => clearInterval(interval);
  }, [fetchMatches]);

  // Filter matches based on user's supported teams
  const relevantMatches = matches.filter(match => {
    if (supportedCountries.length === 0) return true;
    return supportedCountries.some(team =>
      team.id === match.homeTeamId || team.id === match.awayTeamId
    );
  });

  // Group matches by tab
  const liveMatches = relevantMatches.filter(m => m.status === 'live');
  const upcomingMatches = relevantMatches.filter(m => m.status === 'scheduled');
  const finishedMatches = relevantMatches.filter(m => m.status === 'finished');

  const currentTabMatches = selectedTab === 'live'
    ? liveMatches
    : selectedTab === 'upcoming'
    ? upcomingMatches
    : finishedMatches;

  const getTeamName = (teamId: string): string => {
    const team = getTeamById(teamId);
    if (!team) return '';
    return language === 'ar' ? team.nameAr : team.name;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleNotification = (matchId: string) => {
    setNotifications(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  const getTeamFlag = (teamId: string): string => {
    const team = getTeamById(teamId);
    return team?.flag || '🏳️';
  };

  const MatchCard = ({ match }: { match: LiveMatch }) => {
    const homeTeam = getTeamById(match.homeTeamId);
    const awayTeam = getTeamById(match.awayTeamId);
    const isSupportedTeam = supportedCountries.some(t =>
      t.id === match.homeTeamId || t.id === match.awayTeamId
    );

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative p-4 rounded-xl border transition-all ${
          isSupportedTeam
            ? 'border-transparent bg-gradient-to-r from-zinc-800 to-zinc-700'
            : 'border-white/10 bg-white/5 hover:bg-white/10'
        }`}
      >
        {/* Live indicator */}
        {match.status === 'live' && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/40">
            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
            <span className="text-[10px] font-bold text-red-400 uppercase">
              {match.minute ? `${match.minute}'` : 'Live'}
            </span>
          </div>
        )}

        {/* Group/Stage label */}
        {match.group && (
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            {t('group')} {match.group}
          </div>
        )}

        {/* Teams */}
        <div className="flex items-center justify-between gap-4">
          {/* Home Team */}
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{getTeamFlag(match.homeTeamId)}</div>
            <div className="text-sm font-semibold text-white truncate">
              {homeTeam ? (language === 'ar' ? homeTeam.nameAr : homeTeam.name) : match.homeTeam}
            </div>
          </div>

          {/* Score / Time */}
          <div className="flex flex-col items-center">
            {match.status === 'scheduled' ? (
              <div className="text-center">
                <div className="text-lg font-bold text-zinc-300">
                  {match.time || 'TBD'}
                </div>
                <div className="text-[10px] text-zinc-500">
                  {formatDate(match.date)}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-2xl font-black">
                <span className={match.status === 'live' ? 'text-white' : 'text-zinc-400'}>
                  {match.homeScore ?? 0}
                </span>
                <span className="text-zinc-500">-</span>
                <span className={match.status === 'live' ? 'text-white' : 'text-zinc-400'}>
                  {match.awayScore ?? 0}
                </span>
              </div>
            )}
            {match.status === 'live' && match.minute && (
              <div className="text-[10px] text-cyan-400 mt-1">
                {match.minute}{t('min')}
              </div>
            )}
            {match.status === 'finished' && (
              <div className="text-[10px] text-zinc-500 mt-1">
                {t('fullTime')}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="flex-1 text-center">
            <div className="text-3xl mb-1">{getTeamFlag(match.awayTeamId)}</div>
            <div className="text-sm font-semibold text-white truncate">
              {awayTeam ? (language === 'ar' ? awayTeam.nameAr : awayTeam.name) : match.awayTeam}
            </div>
          </div>
        </div>

        {/* Stadium */}
        {match.stadium && (
          <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-zinc-500 text-center truncate">
            {match.stadium} • {match.city}
          </div>
        )}

        {/* Notification toggle for scheduled matches */}
        {match.status === 'scheduled' && (
          <button
            onClick={() => toggleNotification(match.id.toString())}
            className={`absolute top-2 left-2 p-1.5 rounded-lg transition-colors ${
              notifications[match.id.toString()]
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'bg-white/5 text-zinc-500 hover:bg-white/10'
            }`}
            title={notifications[match.id.toString()] ? 'Remove notification' : 'Set notification'}
          >
            {notifications[match.id.toString()] ? (
              <Bell className="w-3.5 h-3.5" />
            ) : (
              <BellOff className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </motion.div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
        {liveMatches.length > 0 && (
          <div className="p-3 rounded-xl bg-gradient-to-r from-red-600 via-green-600 to-blue-600 animate-pulse">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Radio className="w-4 h-4" />
              {language === 'ar' ? 'مباراة مباشرة!' : 'Live Match!'}
            </div>
          </div>
        )}
        {upcomingMatches.slice(0, 2).map(match => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h2 className="text-lg font-bold text-white">{t('liveMatches')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchMatches}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Your Teams */}
      {supportedCountries.length > 0 && (
        <div className="p-3 border-b border-white/10">
          <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            {t('yourTeams')}
          </div>
          <div className="flex flex-wrap gap-2">
            {supportedCountries.map(team => (
              <div
                key={team.id}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 border border-white/20"
              >
                <span>{team.flag}</span>
                <span className="text-xs font-medium text-white">
                  {language === 'ar' ? team.nameAr : team.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {(['live', 'upcoming', 'finished'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              selectedTab === tab
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab === 'live' && <Radio className="w-4 h-4" />}
            {tab === 'upcoming' && <Clock className="w-4 h-4" />}
            {tab === 'finished' && <Trophy className="w-4 h-4" />}
            <span>{t(tab === 'live' ? 'liveMatches' : tab === 'upcoming' ? 'upcomingMatches' : 'finishedMatches')}</span>
            {tab === 'live' && liveMatches.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white">
                {liveMatches.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Matches List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
            <p className="text-zinc-400">{t('loading')}</p>
          </div>
        ) : currentTabMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="w-12 h-12 text-zinc-600 mb-4" />
            <p className="text-zinc-500">
              {selectedTab === 'live' && (language === 'ar' ? 'لا توجد مباريات مباشرة حالياً' : 'No live matches right now')}
              {selectedTab === 'upcoming' && (language === 'ar' ? 'لا توجد مباريات قادمة' : 'No upcoming matches')}
              {selectedTab === 'finished' && (language === 'ar' ? 'لا توجد مباريات منتهية' : 'No finished matches')}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {currentTabMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Last Updated */}
      {lastUpdate && (
        <div className="p-2 border-t border-white/5 text-center">
          <span className="text-[10px] text-zinc-500">
            {language === 'ar' ? 'آخر تحديث: ' : 'Last updated: '}
            {lastUpdate.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      )}
    </div>
  );
}
