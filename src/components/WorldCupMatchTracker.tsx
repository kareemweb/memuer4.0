import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Radio, Clock, RefreshCw, X, Bell, BellOff, Star } from 'lucide-react';
import { useWorldCup } from '../context/WorldCupContext';
import { useLanguage } from '../i18n/LanguageContext';
import { WORLD_CUP_2026_TEAMS, getTeamById, Country } from '../data/worldCup2026';

export interface LiveMatch {
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
  homeEvents?: { text: string }[];
  awayEvents?: { text: string }[];
}

interface MatchTrackerProps {
  compact?: boolean;
  onClose?: () => void;
}

import { WORLD_CUP_MATCHES } from '../data/worldCupMatches';

const INITIAL_WC_MATCHES: LiveMatch[] = WORLD_CUP_MATCHES;

// Initial, ultra-realistic, deterministic Match Schedule for World Cup 2026 (June 11 - June 16)
// Current local date simulated: June 14, 2026
const DEPRECATED_MATCHES: LiveMatch[] = [
  {
    id: 1,
    homeTeam: 'Mexico',
    awayTeam: 'South Africa',
    homeTeamId: 'mexico',
    awayTeamId: 'south_africa',
    homeScore: 2,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-11T16:00:00Z',
    time: '16:00',
    stadium: 'Mexico City Stadium',
    city: 'Mexico City',
    group: 'A',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 24' Hirving Lozano" }, { text: "⚽ 68' Santiago Giménez" }],
    awayEvents: []
  },
  {
    id: 2,
    homeTeam: 'Korea Republic',
    awayTeam: 'Czechia',
    homeTeamId: 'south_korea',
    awayTeamId: 'czechia',
    homeScore: 2,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-11T20:00:00Z',
    time: '20:00',
    stadium: 'Guadalajara Stadium',
    city: 'Guadalajara',
    group: 'A',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 41' Son Heung-min" }, { text: "⚽ 77' Hwang Hee-chan" }],
    awayEvents: [{ text: "⚽ 19' Patrik Schick" }]
  },
  {
    id: 3,
    homeTeam: 'Canada',
    awayTeam: 'Bosnia & Herzegovina',
    homeTeamId: 'canada',
    awayTeamId: 'bosnia',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-12T17:00:00Z',
    time: '17:00',
    stadium: 'Toronto Stadium',
    city: 'Toronto',
    group: 'B',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 55' Jonathan David" }],
    awayEvents: [{ text: "⚽ 61' Edin Džeko" }]
  },
  {
    id: 4,
    homeTeam: 'Qatar',
    awayTeam: 'Switzerland',
    homeTeamId: 'qatar',
    awayTeamId: 'switzerland',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-12T20:00:00Z',
    time: '20:00',
    stadium: 'San Francisco Bay Area Stadium',
    city: 'San Francisco',
    group: 'B',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 45' Akram Afif" }],
    awayEvents: [{ text: "⚽ 82' Breel Embolo" }]
  },
  {
    id: 5,
    homeTeam: 'Haiti',
    awayTeam: 'Scotland',
    homeTeamId: 'haiti',
    awayTeamId: 'scotland',
    homeScore: 0,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-13T16:00:00Z',
    time: '16:00',
    stadium: 'Boston Stadium',
    city: 'Boston',
    group: 'C',
    stage: 'group',
    minute: 90,
    homeEvents: [],
    awayEvents: [{ text: "⚽ 62' Scott McTominay" }]
  },
  {
    id: 6,
    homeTeam: 'Brazil',
    awayTeam: 'Morocco',
    homeTeamId: 'brazil',
    awayTeamId: 'morocco',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-13T19:00:00Z',
    time: '19:00',
    stadium: 'NY/NJ Stadium',
    city: 'East Rutherford',
    group: 'C',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 38' Vinícius Jr." }],
    awayEvents: [{ text: "⚽ 72' Hakim Ziyech" }]
  },
  {
    id: 7,
    homeTeam: 'Australia',
    awayTeam: 'Türkiye',
    homeTeamId: 'australia',
    awayTeamId: 'turkey',
    homeScore: 2,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-14T15:00:00Z',
    time: '15:00',
    stadium: 'BC Place Vancouver',
    city: 'Vancouver',
    group: 'D',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 18' Mitchell Duke" }, { text: "⚽ 84' Craig Goodwin" }],
    awayEvents: []
  },
  {
    id: 8,
    homeTeam: 'USA',
    awayTeam: 'Paraguay',
    homeTeamId: 'usa',
    awayTeamId: 'paraguay',
    homeScore: 4,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-14T18:00:00Z',
    time: '18:00',
    stadium: 'Los Angeles Stadium',
    city: 'Los Angeles',
    group: 'D',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 12' Christian Pulisic" }, { text: "⚽ 34' Folarin Balogun" }, { text: "⚽ 56' Weston McKennie" }, { text: "⚽ 89' Gio Reyna" }],
    awayEvents: [{ text: "⚽ 70' Miguel Almirón" }]
  },
  {
    id: 9,
    homeTeam: 'Germany',
    awayTeam: 'Curaçao',
    homeTeamId: 'germany',
    awayTeamId: 'curacao',
    homeScore: 7,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-15T16:00:00Z',
    time: '16:00',
    stadium: 'Houston Stadium',
    city: 'Houston',
    group: 'E',
    stage: 'group',
    minute: 90,
    homeEvents: [
      { text: "⚽ 8' Florian Wirtz" }, 
      { text: "⚽ 23' Niclas Füllkrug" }, 
      { text: "⚽ 35' Jamal Musiala" },
      { text: "⚽ 44' Leroy Sané" },
      { text: "⚽ 60' Kai Havertz" },
      { text: "⚽ 72' Serge Gnabry" },
      { text: "⚽ 85' Thomas Müller" }
    ],
    awayEvents: [{ text: "⚽ 78' Juninho Bacuna" }]
  },
  {
    id: 10,
    homeTeam: "Côte d'Ivoire",
    awayTeam: 'Ecuador',
    homeTeamId: 'cote_divoire',
    awayTeamId: 'ecuador',
    homeScore: 1,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-15T19:00:00Z',
    time: '19:00',
    stadium: 'Philadelphia Stadium',
    city: 'Philadelphia',
    group: 'E',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 52' Sébastien Haller" }],
    awayEvents: []
  },
  {
    id: 11,
    homeTeam: 'Germany',
    awayTeam: "Côte d'Ivoire",
    homeTeamId: 'germany',
    awayTeamId: 'cote_divoire',
    homeScore: 2,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-16T17:00:00Z',
    time: '17:00',
    stadium: 'Toronto Stadium',
    city: 'Toronto',
    group: 'E',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 24' Deniz Undav" }, { text: "⚽ 78' Deniz Undav" }],
    awayEvents: [{ text: "⚽ 55' Amad Diallo" }]
  },
  {
    id: 12,
    homeTeam: 'Ecuador',
    awayTeam: 'Curaçao',
    homeTeamId: 'ecuador',
    awayTeamId: 'curacao',
    homeScore: 0,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-16T20:00:00Z',
    time: '20:00',
    stadium: 'Kansas City Stadium',
    city: 'Kansas City',
    group: 'E',
    stage: 'group',
    minute: 90,
    homeEvents: [],
    awayEvents: [{ text: "🧤 Eloy Room: 15 Heroic Saves" }]
  },
  {
    id: 13,
    homeTeam: 'Netherlands',
    awayTeam: 'Sweden',
    homeTeamId: 'netherlands',
    awayTeamId: 'sweden',
    homeScore: 5,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-17T16:00:00Z',
    time: '16:00',
    stadium: 'Houston Stadium',
    city: 'Houston',
    group: 'F',
    stage: 'group',
    minute: 90,
    homeEvents: [
      { text: "⚽ 21' Cody Gakpo" },
      { text: "⚽ 42' Crysencio Summerville" },
      { text: "⚽ 56' Cody Gakpo" },
      { text: "⚽ 78' Crysencio Summerville" },
      { text: "⚽ 84' Brian Brobbey" }
    ],
    awayEvents: [{ text: "⚽ 12' Yasin Ayari" }]
  },
  {
    id: 14,
    homeTeam: 'Sweden',
    awayTeam: 'Tunisia',
    homeTeamId: 'sweden',
    awayTeamId: 'tunisia',
    homeScore: 5,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-17T19:00:00Z',
    time: '19:00',
    stadium: 'Monterrey Stadium',
    city: 'Monterrey',
    group: 'F',
    stage: 'group',
    minute: 90,
    homeEvents: [
      { text: "⚽ 15' Alexander Isak" },
      { text: "⚽ 29' Emil Forsberg" },
      { text: "⚽ 44' Viktor Gyökeres" },
      { text: "⚽ 72' Viktor Gyökeres" },
      { text: "⚽ 88' Anthony Elanga" }
    ],
    awayEvents: [{ text: "⚽ 60' Youssef Msakni" }]
  },
  {
    id: 15,
    homeTeam: 'Netherlands',
    awayTeam: 'Japan',
    homeTeamId: 'netherlands',
    awayTeamId: 'japan',
    homeScore: 2,
    awayScore: 2,
    status: 'finished',
    date: '2026-06-18T17:00:00Z',
    time: '17:00',
    stadium: 'Dallas Stadium',
    city: 'Dallas',
    group: 'F',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 42' Frenkie de Jong" }, { text: "⚽ 79' Cody Gakpo" }],
    awayEvents: [{ text: "⚽ 21' Kaoru Mitoma" }, { text: "⚽ 56' Ritsu Doan" }]
  },
  {
    id: 16,
    homeTeam: 'Tunisia',
    awayTeam: 'Japan',
    homeTeamId: 'tunisia',
    awayTeamId: 'japan',
    homeScore: 0,
    awayScore: 4,
    status: 'finished',
    date: '2026-06-18T20:00:00Z',
    time: '20:00',
    stadium: 'Monterrey Stadium',
    city: 'Monterrey',
    group: 'F',
    stage: 'group',
    minute: 90,
    homeEvents: [],
    awayEvents: [
      { text: "⚽ 4' Daichi Kamada" },
      { text: "⚽ 31' Ayase Ueda" },
      { text: "⚽ 69' Junya Ito" },
      { text: "⚽ 83' Ayase Ueda" }
    ]
  },
  {
    id: 17,
    homeTeam: 'New Zealand',
    awayTeam: 'IR Iran',
    homeTeamId: 'new_zealand',
    awayTeamId: 'iran',
    homeScore: 2,
    awayScore: 2,
    status: 'finished',
    date: '2026-06-19T16:00:00Z',
    time: '16:00',
    stadium: 'BC Place Vancouver',
    city: 'Vancouver',
    group: 'G',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 33' Chris Wood" }, { text: "⚽ 84' Chris Wood" }],
    awayEvents: [{ text: "⚽ 19' Mehdi Taremi" }, { text: "⚽ 52' Sardar Azmoun" }]
  },
  {
    id: 18,
    homeTeam: 'Belgium',
    awayTeam: 'Egypt',
    homeTeamId: 'belgium',
    awayTeamId: 'egypt',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-19T19:00:00Z',
    time: '19:00',
    stadium: 'Seattle Stadium',
    city: 'Seattle',
    group: 'G',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "❌ 66' Mohamed Hany (OG)" }],
    awayEvents: [{ text: "⚽ 19' Emam Ashour (Assist: Mohamed Salah)" }]
  },
  {
    id: 19,
    homeTeam: 'Uruguay',
    awayTeam: 'Saudi Arabia',
    homeTeamId: 'uruguay',
    awayTeamId: 'saudi_arabia',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-20T17:00:00Z',
    time: '17:00',
    stadium: 'Miami Stadium',
    city: 'Miami',
    group: 'H',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 43' Darwin Núñez" }],
    awayEvents: [{ text: "⚽ 75' Salem Al-Dawsari" }]
  },
  {
    id: 20,
    homeTeam: 'Spain',
    awayTeam: 'Cabo Verde',
    homeTeamId: 'spain',
    awayTeamId: 'cabo_verde',
    homeScore: 0,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-20T20:00:00Z',
    time: '20:00',
    stadium: 'Boston Stadium',
    city: 'Boston',
    group: 'H',
    stage: 'group',
    minute: 90,
    homeEvents: [],
    awayEvents: []
  },
  {
    id: 21,
    homeTeam: 'Norway',
    awayTeam: 'Iraq',
    homeTeamId: 'norway',
    awayTeamId: 'iraq',
    homeScore: 4,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-21T13:00:00Z',
    time: '13:00',
    stadium: 'Atlanta Stadium',
    city: 'Atlanta',
    group: 'I',
    stage: 'group',
    minute: 90,
    homeEvents: [
      { text: "⚽ 21' Erling Haaland" }, 
      { text: "⚽ 45' Erling Haaland" }, 
      { text: "⚽ 68' Martin Ødegaard" },
      { text: "⚽ 84' Erling Haaland" }
    ],
    awayEvents: [{ text: "⚽ 56' Aymen Hussein" }]
  },
  {
    id: 22,
    homeTeam: 'France',
    awayTeam: 'Senegal',
    homeTeamId: 'france',
    awayTeamId: 'senegal',
    homeScore: 3,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-21T16:00:00Z',
    time: '16:00',
    stadium: 'NY/NJ Stadium',
    city: 'East Rutherford',
    group: 'I',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 12' Kylian Mbappé" }, { text: "⚽ 34' Antoine Griezmann" }, { text: "⚽ 78' Ousmane Dembélé" }],
    awayEvents: [{ text: "⚽ 85' Sadio Mané" }]
  },
  {
    id: 23,
    homeTeam: 'Argentina',
    awayTeam: 'Algeria',
    homeTeamId: 'argentina',
    awayTeamId: 'algeria',
    homeScore: 3,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-21T19:00:00Z',
    time: '19:00',
    stadium: 'Dallas Stadium',
    city: 'Dallas',
    group: 'J',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 14' Lionel Messi" }, { text: "⚽ 58' Lautaro Martínez" }, { text: "⚽ 75' Julián Álvarez" }],
    awayEvents: []
  },
  {
    id: 24,
    homeTeam: 'Austria',
    awayTeam: 'Jordan',
    homeTeamId: 'austria',
    awayTeamId: 'jordan',
    homeScore: 3,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-21T22:00:00Z',
    time: '22:00',
    stadium: 'Kansas City Stadium',
    city: 'Kansas City',
    group: 'J',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 28' Marcel Sabitzer" }, { text: "⚽ 44' Michael Gregoritsch" }, { text: "⚽ 82' Christoph Baumgartner" }],
    awayEvents: [{ text: "⚽ 64' Musa Al-Taamari" }]
  },
  {
    id: 25,
    homeTeam: 'Colombia',
    awayTeam: 'Uzbekistan',
    homeTeamId: 'colombia',
    awayTeamId: 'uzbekistan',
    homeScore: 3,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-21T23:30:00Z',
    time: '23:30',
    stadium: 'Houston Stadium',
    city: 'Houston',
    group: 'K',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 18' Luis Díaz" }, { text: "⚽ 49' Rafael Santos Borré" }, { text: "⚽ 82' James Rodríguez" }],
    awayEvents: [{ text: "⚽ 71' Eldor Shomurodov" }]
  },
  {
    id: 26,
    homeTeam: 'Congo DR',
    awayTeam: 'Portugal',
    homeTeamId: 'congo_dr',
    awayTeamId: 'portugal',
    homeScore: 1,
    awayScore: 1,
    status: 'finished',
    date: '2026-06-21T23:30:00Z',
    time: '23:30',
    stadium: 'Toronto Stadium',
    city: 'Toronto',
    group: 'K',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 68' Yoane Wissa" }],
    awayEvents: [{ text: "⚽ 34' Bruno Fernandes" }]
  },
  {
    id: 27,
    homeTeam: 'England',
    awayTeam: 'Croatia',
    homeTeamId: 'england',
    awayTeamId: 'croatia',
    homeScore: 4,
    awayScore: 2,
    status: 'finished',
    date: '2026-06-21T01:00:00Z',
    time: '01:00',
    stadium: 'Philadelphia Stadium',
    city: 'Philadelphia',
    group: 'L',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 9' Harry Kane" }, { text: "⚽ 24' Jude Bellingham" }, { text: "⚽ 56' Bukayo Saka" }, { text: "⚽ 82' Phil Foden" }],
    awayEvents: [{ text: "⚽ 41' Andrej Kramarić" }, { text: "⚽ 71' Luka Modrić" }]
  },
  {
    id: 28,
    homeTeam: 'Ghana',
    awayTeam: 'Panama',
    homeTeamId: 'ghana',
    awayTeamId: 'panama',
    homeScore: 1,
    awayScore: 0,
    status: 'finished',
    date: '2026-06-21T01:00:00Z',
    time: '01:00',
    stadium: 'Boston Stadium',
    city: 'Boston',
    group: 'L',
    stage: 'group',
    minute: 90,
    homeEvents: [{ text: "⚽ 74' Mohammed Kudus" }],
    awayEvents: []
  },
  {
    id: 49,
      homeTeam: 'Scotland',
      awayTeam: 'Morocco',
      homeTeamId: 'scotland',
      awayTeamId: 'morocco',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-18T21:00:00Z',
      time: '21:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "⚽ 2' Ismael Saibari (71s)" }]
    },
    {
      id: 50,
      homeTeam: 'Canada',
      awayTeam: 'Qatar',
      homeTeamId: 'canada',
      awayTeamId: 'qatar',
      homeScore: 6,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-17T15:00:00Z',
      time: '15:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'B',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 8' Jonathan David" },
        { text: "⚽ 24' Cyle Larin" },
        { text: "⚽ 41' Jonathan David" },
        { text: "⚽ 55' Cyle Larin" },
        { text: "⚽ 71' Jonathan David" },
        { text: "⚽ 83' Nathan Saliba" }
      ],
      awayEvents: []
    },
    {
      id: 51,
      homeTeam: 'Brazil',
      awayTeam: 'Haiti',
      homeTeamId: 'brazil',
      awayTeamId: 'haiti',
      homeScore: 3,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-18T18:00:00Z',
      time: '18:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'C',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 14' Vinícius Júnior" },
        { text: "⚽ 42' Vinícius Júnior" },
        { text: "⚽ 68' Matheus Cunha" }
      ],
      awayEvents: []
    },
    {
      id: 52,
      homeTeam: 'USA',
      awayTeam: 'Australia',
      homeTeamId: 'usa',
      awayTeamId: 'australia',
      homeScore: 2,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-19T15:00:00Z',
      time: '15:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [
        { text: "⚽ 33' Folarin Balogun" },
        { text: "⚽ 75' Folarin Balogun" }
      ],
      awayEvents: []
    },
    {
      id: 53,
      homeTeam: 'Mexico',
      awayTeam: 'South Korea',
      homeTeamId: 'mexico',
      awayTeamId: 'south_korea',
      homeScore: 1,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-17T18:00:00Z',
      time: '18:00',
      stadium: 'Mexico City Stadium',
      city: 'Mexico City',
      group: 'A',
      stage: 'group',
      minute: 90,
      homeEvents: [{ text: "⚽ 62' Julián Quiñones" }],
      awayEvents: []
    },
    {
      id: 54,
      homeTeam: 'Türkiye',
      awayTeam: 'Paraguay',
      homeTeamId: 'turkey',
      awayTeamId: 'paraguay',
      homeScore: 0,
      awayScore: 1,
      status: 'finished',
      date: '2026-06-19T18:00:00Z',
      time: '18:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'D',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: [{ text: "⚽ 45' Maurício" }]
    },
    {
      id: 55,
      homeTeam: 'Ecuador',
      awayTeam: 'Curaçao',
      homeTeamId: 'ecuador',
      awayTeamId: 'curacao',
      homeScore: 0,
      awayScore: 0,
      status: 'finished',
      date: '2026-06-20T18:00:00Z',
      time: '18:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'E',
      stage: 'group',
      minute: 90,
      homeEvents: [],
      awayEvents: []
    },
    {
      id: 56,
      homeTeam: 'Spain',
      awayTeam: 'Saudi Arabia',
      homeTeamId: 'spain',
      awayTeamId: 'saudi_arabia',
      status: 'scheduled',
      date: '2026-06-21T19:00:00Z',
      time: '19:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'H',
      stage: 'group'
    },
    {
      id: 57,
      homeTeam: 'Belgium',
      awayTeam: 'IR Iran',
      homeTeamId: 'belgium',
      awayTeamId: 'iran',
      status: 'scheduled',
      date: '2026-06-21T22:00:00Z',
      time: '22:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'G',
      stage: 'group'
    },
    {
      id: 58,
      homeTeam: 'Uruguay',
      awayTeam: 'Cabo Verde',
      homeTeamId: 'uruguay',
      awayTeamId: 'cabo_verde',
      status: 'scheduled',
      date: '2026-06-22T01:00:00Z',
      time: '01:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'H',
      stage: 'group'
    },
    {
      id: 59,
      homeTeam: 'New Zealand',
      awayTeam: 'Egypt',
      homeTeamId: 'new_zealand',
      awayTeamId: 'egypt',
      status: 'scheduled',
      date: '2026-06-22T04:00:00Z',
      time: '04:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'G',
      stage: 'group'
    },
    {
      id: 60,
      homeTeam: 'Argentina',
      awayTeam: 'Austria',
      homeTeamId: 'argentina',
      awayTeamId: 'austria',
      status: 'scheduled',
      date: '2026-06-22T20:00:00Z',
      time: '20:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'J',
      stage: 'group'
    },
    {
      id: 61,
      homeTeam: 'France',
      awayTeam: 'Iraq',
      homeTeamId: 'france',
      awayTeamId: 'iraq',
      status: 'scheduled',
      date: '2026-06-22T23:00:00Z',
      time: '23:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'I',
      stage: 'group'
    },
    {
      id: 62,
      homeTeam: 'Norway',
      awayTeam: 'Senegal',
      homeTeamId: 'norway',
      awayTeamId: 'senegal',
      status: 'scheduled',
      date: '2026-06-23T03:00:00Z',
      time: '03:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'I',
      stage: 'group'
    },
    {
      id: 63,
      homeTeam: 'Jordan',
      awayTeam: 'Algeria',
      homeTeamId: 'jordan',
      awayTeamId: 'algeria',
      status: 'scheduled',
      date: '2026-06-23T06:00:00Z',
      time: '06:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'J',
      stage: 'group'
    },
    {
      id: 64,
      homeTeam: 'Portugal',
      awayTeam: 'Uzbekistan',
      homeTeamId: 'portugal',
      awayTeamId: 'uzbekistan',
      status: 'scheduled',
      date: '2026-06-23T20:00:00Z',
      time: '20:00',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'K',
      stage: 'group'
    },
    {
      id: 65,
      homeTeam: 'England',
      awayTeam: 'Ghana',
      homeTeamId: 'england',
      awayTeamId: 'ghana',
      status: 'scheduled',
      date: '2026-06-23T23:00:00Z',
      time: '23:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'L',
      stage: 'group'
    },
    {
      id: 66,
      homeTeam: 'Panama',
      awayTeam: 'Croatia',
      homeTeamId: 'panama',
      awayTeamId: 'croatia',
      status: 'scheduled',
      date: '2026-06-24T02:00:00Z',
      time: '02:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'L',
      stage: 'group'
    },
    {
      id: 67,
      homeTeam: 'Colombia',
      awayTeam: 'Congo DR',
      homeTeamId: 'colombia',
      awayTeamId: 'congo_dr',
      status: 'scheduled',
      date: '2026-06-24T05:00:00Z',
      time: '05:00',
      stadium: 'Guadalajara Stadium',
      city: 'Guadalajara',
      group: 'K',
      stage: 'group'
    },
    {
      id: 68,
      homeTeam: 'Switzerland',
      awayTeam: 'Canada',
      homeTeamId: 'switzerland',
      awayTeamId: 'canada',
      status: 'scheduled',
      date: '2026-06-24T20:00:00Z',
      time: '20:00',
      stadium: 'BC Place Vancouver',
      city: 'Vancouver',
      group: 'B',
      stage: 'group'
    },
    {
      id: 69,
      homeTeam: 'Bosnia & Herzegovina',
      awayTeam: 'Qatar',
      homeTeamId: 'bosnia',
      awayTeamId: 'qatar',
      status: 'scheduled',
      date: '2026-06-24T20:00:00Z',
      time: '20:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'B',
      stage: 'group'
    },
    {
      id: 70,
      homeTeam: 'Scotland',
      awayTeam: 'Brazil',
      homeTeamId: 'scotland',
      awayTeamId: 'brazil',
      status: 'scheduled',
      date: '2026-06-24T23:00:00Z',
      time: '23:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'C',
      stage: 'group'
    },
    {
      id: 71,
      homeTeam: 'Morocco',
      awayTeam: 'Haiti',
      homeTeamId: 'morocco',
      awayTeamId: 'haiti',
      status: 'scheduled',
      date: '2026-06-24T23:00:00Z',
      time: '23:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'C',
      stage: 'group'
    },
    {
      id: 72,
      homeTeam: 'Czechia',
      awayTeam: 'Mexico',
      homeTeamId: 'czechia',
      awayTeamId: 'mexico',
      status: 'scheduled',
      date: '2026-06-25T02:00:00Z',
      time: '02:00',
      stadium: 'Mexico City Stadium',
      city: 'Mexico City',
      group: 'A',
      stage: 'group'
    },
    {
      id: 73,
      homeTeam: 'South Africa',
      awayTeam: 'Korea Republic',
      homeTeamId: 'south_africa',
      awayTeamId: 'south_korea',
      status: 'scheduled',
      date: '2026-06-25T02:00:00Z',
      time: '02:00',
      stadium: 'Monterrey Stadium',
      city: 'Monterrey',
      group: 'A',
      stage: 'group'
    },
    {
      id: 74,
      homeTeam: 'Ecuador',
      awayTeam: 'Germany',
      homeTeamId: 'ecuador',
      awayTeamId: 'germany',
      status: 'scheduled',
      date: '2026-06-25T21:00:00Z',
      time: '21:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'E',
      stage: 'group'
    },
    {
      id: 75,
      homeTeam: 'Curaçao',
      awayTeam: "Côte d'Ivoire",
      homeTeamId: 'curacao',
      awayTeamId: 'cote_divoire',
      status: 'scheduled',
      date: '2026-06-25T21:00:00Z',
      time: '21:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'E',
      stage: 'group'
    },
    {
      id: 76,
      homeTeam: 'Japan',
      awayTeam: 'Sweden',
      homeTeamId: 'japan',
      awayTeamId: 'sweden',
      status: 'scheduled',
      date: '2026-06-26T00:00:00Z',
      time: '00:00',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'F',
      stage: 'group'
    },
    {
      id: 77,
      homeTeam: 'Tunisia',
      awayTeam: 'Netherlands',
      homeTeamId: 'tunisia',
      awayTeamId: 'netherlands',
      status: 'scheduled',
      date: '2026-06-26T00:00:00Z',
      time: '00:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'F',
      stage: 'group'
    },
    {
      id: 78,
      homeTeam: 'Türkiye',
      awayTeam: 'USA',
      homeTeamId: 'turkey',
      awayTeamId: 'usa',
      status: 'scheduled',
      date: '2026-06-26T03:00:00Z',
      time: '03:00',
      stadium: 'Los Angeles Stadium',
      city: 'Los Angeles',
      group: 'D',
      stage: 'group'
    },
    {
      id: 79,
      homeTeam: 'Paraguay',
      awayTeam: 'Australia',
      homeTeamId: 'paraguay',
      awayTeamId: 'australia',
      status: 'scheduled',
      date: '2026-06-26T03:00:00Z',
      time: '03:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'D',
      stage: 'group'
    },
    {
      id: 80,
      homeTeam: 'Norway',
      awayTeam: 'France',
      homeTeamId: 'norway',
      awayTeamId: 'france',
      status: 'scheduled',
      date: '2026-06-26T20:00:00Z',
      time: '20:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'I',
      stage: 'group'
    },
    {
      id: 81,
      homeTeam: 'Senegal',
      awayTeam: 'Iraq',
      homeTeamId: 'senegal',
      awayTeamId: 'iraq',
      status: 'scheduled',
      date: '2026-06-26T20:00:00Z',
      time: '20:00',
      stadium: 'Philadelphia Stadium',
      city: 'Philadelphia',
      group: 'I',
      stage: 'group'
    },
    {
      id: 82,
      homeTeam: 'Cabo Verde',
      awayTeam: 'Saudi Arabia',
      homeTeamId: 'cabo_verde',
      awayTeamId: 'saudi_arabia',
      status: 'scheduled',
      date: '2026-06-26T23:00:00Z',
      time: '23:00',
      stadium: 'Boston Stadium',
      city: 'Boston',
      group: 'H',
      stage: 'group'
    },
    {
      id: 83,
      homeTeam: 'Uruguay',
      awayTeam: 'Spain',
      homeTeamId: 'uruguay',
      awayTeamId: 'spain',
      status: 'scheduled',
      date: '2026-06-26T23:00:00Z',
      time: '23:00',
      stadium: 'Miami Stadium',
      city: 'Miami',
      group: 'H',
      stage: 'group'
    },
    {
      id: 84,
      homeTeam: 'New Zealand',
      awayTeam: 'Belgium',
      homeTeamId: 'new_zealand',
      awayTeamId: 'belgium',
      status: 'scheduled',
      date: '2026-06-27T04:00:00Z',
      time: '04:00',
      stadium: 'San Francisco Bay Area Stadium',
      city: 'San Francisco',
      group: 'G',
      stage: 'group'
    },
    {
      id: 85,
      homeTeam: 'Egypt',
      awayTeam: 'IR Iran',
      homeTeamId: 'egypt',
      awayTeamId: 'iran',
      status: 'scheduled',
      date: '2026-06-27T04:00:00Z',
      time: '04:00',
      stadium: 'Seattle Stadium',
      city: 'Seattle',
      group: 'G',
      stage: 'group'
    },
    {
      id: 86,
      homeTeam: 'Panama',
      awayTeam: 'England',
      homeTeamId: 'panama',
      awayTeamId: 'england',
      status: 'scheduled',
      date: '2026-06-27T22:00:00Z',
      time: '22:00',
      stadium: 'NY/NJ Stadium',
      city: 'East Rutherford',
      group: 'L',
      stage: 'group'
    },
    {
      id: 87,
      homeTeam: 'Croatia',
      awayTeam: 'Ghana',
      homeTeamId: 'croatia',
      awayTeamId: 'ghana',
      status: 'scheduled',
      date: '2026-06-27T22:00:00Z',
      time: '22:00',
      stadium: 'Toronto Stadium',
      city: 'Toronto',
      group: 'L',
      stage: 'group'
    },
    {
      id: 88,
      homeTeam: 'Colombia',
      awayTeam: 'Portugal',
      homeTeamId: 'colombia',
      awayTeamId: 'portugal',
      status: 'scheduled',
      date: '2026-06-28T00:30:00Z',
      time: '00:30',
      stadium: 'Houston Stadium',
      city: 'Houston',
      group: 'K',
      stage: 'group'
    },
    {
      id: 89,
      homeTeam: 'Congo DR',
      awayTeam: 'Uzbekistan',
      homeTeamId: 'congo_dr',
      awayTeamId: 'uzbekistan',
      status: 'scheduled',
      date: '2026-06-28T00:30:00Z',
      time: '00:30',
      stadium: 'Dallas Stadium',
      city: 'Dallas',
      group: 'K',
      stage: 'group'
    },
    {
      id: 90,
      homeTeam: 'Algeria',
      awayTeam: 'Austria',
      homeTeamId: 'algeria',
      awayTeamId: 'austria',
      status: 'scheduled',
      date: '2026-06-28T03:00:00Z',
      time: '03:00',
      stadium: 'Atlanta Stadium',
      city: 'Atlanta',
      group: 'J',
      stage: 'group'
    },
    {
      id: 91,
      homeTeam: 'Jordan',
      awayTeam: 'Argentina',
      homeTeamId: 'jordan',
      awayTeamId: 'argentina',
      status: 'scheduled',
      date: '2026-06-28T03:00:00Z',
      time: '03:00',
      stadium: 'Kansas City Stadium',
      city: 'Kansas City',
      group: 'J',
      stage: 'group'
    }
  ];

if (false) {
  console.log(DEPRECATED_MATCHES);
}

export function WorldCupMatchTracker({ compact = false, onClose }: MatchTrackerProps) {
  const { t, language, isRTL } = useLanguage();
  const { supportedCountries, themeMode, themeColors } = useWorldCup();
  
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'live' | 'upcoming' | 'finished'>('live');
  const [filterMode, setFilterMode] = useState<'all' | 'mine'>('all');
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('memuer_wc_match_notifications');
      return saved ? JSON.parse(saved) : {};
    } catch (_) {
      return {};
    }
  });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeAlert, setActiveAlert] = useState<{ matchName: string; text: string; flag: string } | null>(null);
  
  // Track browser notifications opt-in
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem('memuer_wc_browser_alerts') === 'true';
  });
  
  // Modal state when clicked inside the compact widget
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const alertedMatchIds = useRef<Record<string, boolean>>({});

  const getTeamFlag = (teamId: string): string => {
    const team = getTeamById(teamId);
    return team?.flag || '🏳️';
  };

  const getTeamName = (teamId: string, fallback: string): string => {
    const team = getTeamById(teamId);
    if (!team) return fallback;
    return language === 'ar' ? team.nameAr : team.name;
  };

  const toggleBrowserNotifications = async () => {
    if (!browserNotificationsEnabled) {
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setBrowserNotificationsEnabled(true);
          localStorage.setItem('memuer_wc_browser_alerts', 'true');
          new Notification("World Cup 2026 Alerts Enabled", {
            body: "You will now receive desktop alerts for live goals and kickoff statuses!",
            icon: "/favicon.ico"
          });
        } else {
          alert(language === 'ar' ? "يرجى تفعيل صلاحية الإشعارات من إعدادات المتصفح." : "Please enable notification permissions in your browser settings.");
        }
      } else {
        alert("This browser does not support HTML5 desktop notifications.");
      }
    } else {
      setBrowserNotificationsEnabled(false);
      localStorage.setItem('memuer_wc_browser_alerts', 'false');
    }
  };

  const triggerGoalAlert = (match: LiveMatch, isHome: boolean, scorer: string, min: number) => {
    const flag = getTeamFlag(isHome ? match.homeTeamId : match.awayTeamId);
    const scorerTeam = getTeamName(isHome ? match.homeTeamId : match.awayTeamId, isHome ? match.homeTeam : match.awayTeam);
    const matchName = `${getTeamName(match.homeTeamId, match.homeTeam)} vs ${getTeamName(match.awayTeamId, match.awayTeam)}`;
    const textStr = `${language === 'ar' ? 'هدف!' : 'GOAL!'} ⚽ ${scorerTeam} ${language === 'ar' ? 'يسجل' : 'scores'}! ${match.homeScore} - ${match.awayScore} (${min}')`;
    
    // Create goal notification toast
    setActiveAlert({
      matchName,
      text: textStr,
      flag
    });

    // Automatically dismiss alert
    setTimeout(() => {
      setActiveAlert(null);
    }, 6000);

    // Desktop notification if opted-in and involves a supported/starred team
    const isFav = supportedCountries.some(t => t.id === match.homeTeamId || t.id === match.awayTeamId);
    const hasSpecificNotif = notifications[match.id.toString()];
    if (browserNotificationsEnabled && (isFav || hasSpecificNotif) && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`⚽ GOAL! ${matchName}`, {
        body: textStr,
        icon: "/favicon.ico",
        tag: `goal_${match.id}_${match.homeScore}_${match.awayScore}`
      });
    }
  };

  const fetchMatchesData = useCallback(async () => {
    try {
      const res = await fetch('/api/worldcup/matches');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.matches)) {
          setMatches(data.matches);
          localStorage.setItem('memuer_wc_ticker_matches', JSON.stringify(data.matches));
          setLastUpdate(new Date());
          return;
        }
      }
    } catch (e) {
      console.error("Error fetching sports matches from API:", e);
    }
    
    // Fail-safe local fallback
    const saved = localStorage.getItem('memuer_wc_ticker_matches');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasOutdatedMatches = parsed.some((m: any) => 
          ((m.homeTeam === 'Scotland' || m.awayTeam === 'Scotland' || m.homeTeam === 'Brazil' || m.awayTeam === 'Brazil') && m.status !== 'finished') ||
          (m.id >= 51 && m.id <= 70 && m.status === 'scheduled')
        );
        if (hasOutdatedMatches || parsed.length !== INITIAL_WC_MATCHES.length) {
          localStorage.removeItem('memuer_wc_ticker_matches');
          setMatches(INITIAL_WC_MATCHES);
        } else {
          setMatches(parsed);
        }
      } catch (_) {
        setMatches(INITIAL_WC_MATCHES);
      }
    } else {
      setMatches(INITIAL_WC_MATCHES);
    }
    setLastUpdate(new Date());
  }, [language]);

  // Poll & simulate matches in real-time
  useEffect(() => {
    setLoading(true);
    fetchMatchesData().finally(() => {
      setLoading(false);
    });

    // Dynamic Simulator: runs every 12 seconds of active display
    const interval = setInterval(() => {
      setMatches(prev => {
        let hasChanges = false;
        const updated = prev.map(match => {
          if (match.status === 'live') {
            hasChanges = true;
            const nextMin = (match.minute || 0) + 1;
            
            // Reaches full-time
            if (nextMin >= 90) {
              return {
                ...match,
                minute: 90,
                status: 'finished' as const
              };
            }

            // 6% chance of a score update per simulation tick
            const isGoal = Math.random() < 0.06;
            if (isGoal) {
              const isHomeScore = Math.random() < 0.55; // Slightly favor home
              const nextHomeScore = isHomeScore ? (match.homeScore || 0) + 1 : (match.homeScore || 0);
              const nextAwayScore = !isHomeScore ? (match.awayScore || 0) + 1 : (match.awayScore || 0);
              
              const goalEvent = { text: `⚽ ${nextMin}' ${language === 'ar' ? 'هدف مبهر' : 'Magnificent Goal'}` };
              
              const updatedMatch = {
                ...match,
                minute: nextMin,
                homeScore: nextHomeScore,
                awayScore: nextAwayScore,
                homeEvents: isHomeScore ? [...(match.homeEvents || []), goalEvent] : (match.homeEvents || []),
                awayEvents: !isHomeScore ? [...(match.awayEvents || []), goalEvent] : (match.awayEvents || [])
              };

              // Notify the viewer!
              triggerGoalAlert(updatedMatch, isHomeScore, 'Player', nextMin);

              return updatedMatch;
            }

            return {
              ...match,
              minute: nextMin
            };
          }
          return match;
        });

        if (hasChanges) {
          localStorage.setItem('memuer_wc_ticker_matches', JSON.stringify(updated));
          setLastUpdate(new Date());
        }
        return updated;
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [language, fetchMatchesData]);

  // Alert on kickoff (match going live)
  useEffect(() => {
    if (!matches || matches.length === 0) return;
    
    matches.forEach(match => {
      if (match.status === 'live') {
        const isFav = supportedCountries.some(t => t.id === match.homeTeamId || t.id === match.awayTeamId);
        const hasSpecificNotification = notifications[match.id.toString()];
        
        if (isFav || hasSpecificNotification) {
          const alertKey = `${match.id}_live`;
          if (!alertedMatchIds.current[alertKey]) {
            alertedMatchIds.current[alertKey] = true;
            
            if (browserNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
              const team1 = getTeamName(match.homeTeamId, match.homeTeam);
              const team2 = getTeamName(match.awayTeamId, match.awayTeam);
              new Notification("MATCH LIVE 🔴 World Cup 2026", {
                body: `${team1} vs ${team2} is now live! Kickoff at the ${match.stadium}.`,
                icon: "/favicon.ico",
                tag: match.id.toString()
              });
            }
          }
        }
      }
    });
  }, [matches, supportedCountries, notifications, browserNotificationsEnabled, language]);

  const forceManualRefresh = () => {
    setLoading(true);
    fetchMatchesData().finally(() => {
      setLoading(false);
    });
  };

  // Filter matches based on Filter Mode & Tab
  const relevantMatches = matches.filter(match => {
    if (filterMode === 'all') return true;
    return supportedCountries.some(team =>
      team.id === match.homeTeamId || team.id === match.awayTeamId
    );
  });

  const liveMatches = relevantMatches.filter(m => m.status === 'live');
  const upcomingMatches = relevantMatches.filter(m => m.status === 'scheduled');
  const finishedMatches = relevantMatches.filter(m => m.status === 'finished');

  const currentTabMatches = selectedTab === 'live'
    ? liveMatches
    : selectedTab === 'upcoming'
    ? upcomingMatches
    : finishedMatches;

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const toggleNotification = (matchId: string) => {
    setNotifications(prev => {
      const updated = {
        ...prev,
        [matchId]: !prev[matchId]
      };
      localStorage.setItem('memuer_wc_match_notifications', JSON.stringify(updated));
      return updated;
    });
  };

  const MatchCard = ({ match }: { match: LiveMatch; key?: any }) => {
    const isSupportedTeam = supportedCountries.some(t =>
      t.id === match.homeTeamId || t.id === match.awayTeamId
    );

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.25 }}
        className={`relative p-4 rounded-xl border transition-all duration-300 ${
          isSupportedTeam
            ? 'border-amber-500/20 bg-amber-500/[0.02] shadow-sm shadow-black/10'
            : 'border-white/5 bg-zinc-900/40 hover:bg-zinc-900/60 hover:border-white/10'
        }`}
      >
        {isSupportedTeam && (
          <div className="absolute top-3 left-3 flex items-center justify-center text-amber-400" title="Starred Match">
            <Star className="w-3.5 h-3.5 fill-amber-400/80 text-amber-500" />
          </div>
        )}

        {/* Live indicator tag */}
        {match.status === 'live' && (
          <div 
            className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider bg-red-500/10 text-red-400 border border-red-500/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>
              {match.minute ? `${match.minute}'` : t('live')}
            </span>
          </div>
        )}

        {/* Group / Stage Header label */}
        {match.group && (
          <div className="text-[9px] font-medium text-zinc-500 uppercase tracking-widest text-center mb-3">
            {t('group')} {match.group} • {match.stage === 'group' ? (language === 'ar' ? 'دور المجموعات' : 'Group Stage') : match.stage}
          </div>
        )}

        {/* Main Team Arena Row */}
        <div className="grid grid-cols-12 items-center gap-2 py-1">
          {/* Home Team */}
          <div className="col-span-4 flex flex-col items-center text-center">
            <span className="text-3xl mb-1.5 filter drop-shadow-md select-none transition-transform hover:scale-105 duration-200 cursor-pointer">
              {getTeamFlag(match.homeTeamId)}
            </span>
            <span className="text-[12px] font-semibold text-zinc-200 truncate max-w-[100px] w-full">
              {getTeamName(match.homeTeamId, match.homeTeam)}
            </span>
            {match.homeEvents && match.homeEvents.length > 0 && (
              <div className="mt-1.5 space-y-0.5 max-w-[95px] mx-auto">
                {match.homeEvents.map((ev, idx) => (
                  <p key={idx} className="text-[9px] text-zinc-500 font-mono truncate" title={ev.text}>
                    {ev.text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Scores/Middle block */}
          <div className="col-span-4 flex flex-col items-center justify-center">
            {match.status === 'scheduled' ? (
              <div className="text-center">
                <div className="text-[13px] font-semibold text-zinc-100 font-mono tracking-tight">
                  {match.time || 'TBD'}
                </div>
                <div className="text-[9px] text-zinc-500 font-medium uppercase tracking-wider mt-0.5">
                  {formatDate(match.date)}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2 px-3 py-1 bg-black/30 rounded-lg border border-white/[0.03] font-mono text-lg font-bold">
                  <span className={match.status === 'live' ? 'text-red-400' : 'text-zinc-300'}>
                    {match.homeScore ?? 0}
                  </span>
                  <span className="text-zinc-600 font-sans">-</span>
                  <span className={match.status === 'live' ? 'text-red-400' : 'text-zinc-300'}>
                    {match.awayScore ?? 0}
                  </span>
                </div>
                {match.status === 'finished' && (
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest mt-2 bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                    {t('fullTime')}
                  </span>
                )}
                {match.status === 'live' && (
                  <span className="text-[8px] font-bold tracking-widest text-red-400 uppercase mt-2 animate-pulse">
                    {language === 'ar' ? 'مباشر' : 'Live'}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Away Team */}
          <div className="col-span-4 flex flex-col items-center text-center">
            <span className="text-3xl mb-1.5 filter drop-shadow-md select-none transition-transform hover:scale-105 duration-200 cursor-pointer">
              {getTeamFlag(match.awayTeamId)}
            </span>
            <span className="text-[12px] font-semibold text-zinc-200 truncate max-w-[100px] w-full">
              {getTeamName(match.awayTeamId, match.awayTeam)}
            </span>
            {match.awayEvents && match.awayEvents.length > 0 && (
              <div className="mt-1.5 space-y-0.5 max-w-[95px] mx-auto">
                {match.awayEvents.map((ev, idx) => (
                  <p key={idx} className="text-[9px] text-zinc-500 font-mono truncate" title={ev.text}>
                    {ev.text}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stadium Info & Notifications Row */}
        <div className="mt-3.5 pt-2.5 border-t border-white/[0.03] flex items-center justify-between">
          <span className="text-[9px] text-zinc-500 truncate max-w-[75%] font-medium">
            🏟️ {match.stadium} • {language === 'ar' ? 'المدينة' : match.city}
          </span>

          {match.status === 'scheduled' && (
            <button
              onClick={() => toggleNotification(match.id.toString())}
              className={`p-1 rounded-md transition-all ${
                notifications[match.id.toString()]
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-white/10'
              }`}
              title={notifications[match.id.toString()] ? 'Reminder Set' : 'Set Notification Reminder'}
            >
              {notifications[match.id.toString()] ? (
                <Bell className="w-3 h-3 text-amber-400" />
              ) : (
                <BellOff className="w-3 h-3 text-zinc-500" />
              )}
            </button>
          )}
        </div>
      </motion.div>
    );
  };

  if (compact) {
    const compactMatches = 
      selectedTab === 'live' 
        ? matches.filter(m => m.status === 'live')
        : selectedTab === 'upcoming'
        ? matches.filter(m => m.status === 'scheduled')
        : matches.filter(m => m.status === 'finished');

    const sortedCompactMatches = [...compactMatches];
    if (selectedTab === 'finished') {
      sortedCompactMatches.sort((a, b) => b.id - a.id);
    } else if (selectedTab === 'upcoming') {
      sortedCompactMatches.sort((a, b) => a.id - b.id);
    }

    return (
      <div 
        className="p-4 rounded-2xl bg-zinc-900/60 border border-white/5 space-y-3 relative group overflow-hidden" 
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {/* Subtle decorative glow */}
        <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${themeColors.gradient}`} />
        
        {/* Widget Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-yellow-400 animate-pulse" />
            <span className="text-xs font-black uppercase text-zinc-200 tracking-wider">
              {language === 'ar' ? 'مركز المباريات' : 'Match Feed'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Direct Browser Alert Toggle Bell in Sidebar widget! */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleBrowserNotifications();
              }}
              className={`p-1 rounded-lg transition-colors ${
                browserNotificationsEnabled 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-white/5 text-zinc-400 hover:text-zinc-200'
              }`}
              title={browserNotificationsEnabled ? "Browser Alerts Enabled" : "Enable Browser Alerts"}
            >
              <Bell className={`w-3.5 h-3.5 ${browserNotificationsEnabled ? 'animate-pulse' : ''}`} />
            </button>
          </div>
        </div>

        {/* Micro Tab Selector */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-black/40 rounded-xl border border-white/5">
          <button
            onClick={() => setSelectedTab('live')}
            className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
              selectedTab === 'live'
                ? 'bg-red-500/15 text-red-400 border border-red-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {language === 'ar' ? 'مباشر' : 'Live'} {liveMatches.length > 0 && `(${liveMatches.length})`}
          </button>
          <button
            onClick={() => setSelectedTab('upcoming')}
            className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
              selectedTab === 'upcoming'
                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {language === 'ar' ? 'القادمة' : 'Upcoming'}
          </button>
          <button
            onClick={() => setSelectedTab('finished')}
            className={`py-1 text-[10px] font-bold rounded-lg transition-all ${
              selectedTab === 'finished'
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {language === 'ar' ? 'المنتهية' : 'Finished'}
          </button>
        </div>

        {/* Live Badge if match exists */}
        {liveMatches.length > 0 && selectedTab !== 'live' && (
          <div className="p-2 py-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider w-full justify-between">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {language === 'ar' ? 'مباشر الآن!' : 'Match Live Now!'}
              </span>
              <span className="text-zinc-400 font-mono">
                {liveMatches.length} {language === 'ar' ? 'مباريات' : 'Matches'}
              </span>
            </div>
          </div>
        )}

        {/* Dense Feed of matches */}
        <div className="space-y-1.5">
          {sortedCompactMatches.length > 0 ? (
            sortedCompactMatches.slice(0, 4).map(match => {
              const isFav = supportedCountries.some(t => t.id === match.homeTeamId || t.id === match.awayTeamId);
              
              return (
                <div 
                  key={match.id}
                  onClick={() => setIsModalOpen(true)}
                  className={`p-2 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition-all ${
                    isFav 
                      ? 'border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 animate-fade-in' 
                      : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Home */}
                  <div className="flex items-center gap-2 max-w-[42%] min-w-0">
                    <span className="text-base shrink-0 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">{getTeamFlag(match.homeTeamId)}</span>
                    <span className="font-bold text-zinc-300 truncate text-[11px]">{getTeamName(match.homeTeamId, match.homeTeam)}</span>
                  </div>

                  {/* Score vs Time */}
                  <div className="text-center font-mono text-[10.5px] shrink-0 font-bold px-2 py-0.5 rounded bg-black/40 min-w-[54px] border border-white/5">
                    {match.status === 'live' ? (
                      <span className="text-emerald-400 animate-pulse font-extrabold">
                        {match.homeScore ?? 0}-{match.awayScore ?? 0}
                      </span>
                    ) : match.status === 'finished' ? (
                      <span className="text-amber-400 font-extrabold">
                        {match.homeScore ?? 0}-{match.awayScore ?? 0}
                      </span>
                    ) : (
                      <span className="text-zinc-400">{match.time}</span>
                    )}
                  </div>

                  {/* Away */}
                  <div className="flex items-center gap-2 max-w-[42%] min-w-0 justify-end">
                    <span className="font-bold text-zinc-300 truncate text-[11px]">{getTeamName(match.awayTeamId, match.awayTeam)}</span>
                    <span className="text-base shrink-0 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]">{getTeamFlag(match.awayTeamId)}</span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-6 text-center text-[10px] text-zinc-500 italic">
              {selectedTab === 'live' 
                ? (language === 'ar' ? 'لا توجد مباريات مباشرة حالياً.' : 'No matches live right now.') 
                : selectedTab === 'upcoming' 
                ? (language === 'ar' ? 'لا توجد مباريات مجدولة قريباً.' : 'No upcoming matches scheduled.') 
                : (language === 'ar' ? 'لا توجد مباريات منتهية.' : 'No finished matches found.')}
            </div>
          )}
        </div>

        {/* Open Match Feed Modal overlay */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-1.5 text-center text-[10px] font-black uppercase text-zinc-400 hover:text-white transition-all bg-white/5 border border-white/5 rounded-xl cursor-pointer"
        >
          {language === 'ar' ? 'فتح مركز المباريات 🏆' : 'Open Match Center 🏆'}
        </button>

        {/* Compact modal popup overlay if matches menu is open */}
        <AnimatePresence>
          {isModalOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-0 md:p-4"
              onClick={() => setIsModalOpen(false)}
            >
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full h-full md:h-[85vh] md:max-h-[750px] md:max-w-2xl md:rounded-3xl overflow-hidden border-t md:border border-white/10 shadow-2xl flex flex-col bg-zinc-950"
              >
                <WorldCupMatchTracker onClose={() => setIsModalOpen(false)} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden relative" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Dynamic Colored Flag Strip across top of view to apply and show category theme */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${themeColors.gradient}`} />

      {/* Goal Toast Alerts */}
      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 0.97, y: 12, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-12 left-4 right-4 z-50 p-4 rounded-2xl bg-zinc-950 border border-emerald-500/40 text-white font-extrabold flex items-center gap-4.5 shadow-2xl shadow-green-950/40 select-none"
          >
            <span className="text-3xl animate-bounce shrink-0">{activeAlert.flag}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[9px] font-black uppercase text-emerald-400 tracking-[0.25em]">{activeAlert.matchName}</div>
              <div className="text-xs font-bold leading-normal truncate">{activeAlert.text}</div>
            </div>
            <button onClick={() => setActiveAlert(null)} className="p-1.5 hover:bg-white/10 rounded-lg shrink-0 transition-colors">
              <X className="w-4 h-4 text-zinc-400 hover:text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Container */}
      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-zinc-900/40">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase">
            {language === 'ar' ? 'مركز مباريات كأس العالم' : 'World Cup Match Center'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Active Browser Alerts Toggle bell inside main menu */}
          <button
            onClick={toggleBrowserNotifications}
            className={`p-2 rounded-xl border transition-all ${
              browserNotificationsEnabled 
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white hover:bg-white/10'
            }`}
            title={browserNotificationsEnabled ? "Desktop Notifications Enabled" : "Enable Desktop Notifications"}
          >
            <Bell className={`w-4 h-4 ${browserNotificationsEnabled ? 'animate-bounce' : ''}`} />
          </button>

          <button
            onClick={forceManualRefresh}
            disabled={loading}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Segmented Controller: All Matches vs. My Supported Teams */}
      <div className="px-4 py-3 bg-zinc-900/60 border-b border-white/5 flex flex-col gap-3">
        <div className="flex p-1 bg-white/5 rounded-2xl gap-1 border border-white/5 self-center w-full max-w-sm">
          <button
            onClick={() => setFilterMode('all')}
            className={`flex-1 py-1.5 px-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all ${
              filterMode === 'all'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {language === 'ar' ? 'جميع المباريات' : 'All Matches'}
          </button>
          <button
            onClick={() => setFilterMode('mine')}
            className={`flex-1 py-1.5 px-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              filterMode === 'mine'
                ? 'bg-white text-zinc-950 shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${filterMode === 'mine' ? 'fill-yellow-600 text-yellow-600' : ''}`} />
            <span>{language === 'ar' ? 'فِـرقي' : 'My Teams'}</span>
          </button>
        </div>

        {/* Quick List of Supported Countries banner */}
        {supportedCountries.length > 0 && filterMode === 'all' && (
          <div className="flex flex-wrap gap-1.5 items-center justify-center">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider mr-1">{language === 'ar' ? 'تتابع:' : 'Tracking:'}</span>
            {supportedCountries.map(team => (
              <span key={team.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] text-zinc-300">
                <span>{team.flag}</span>
                <span className="font-semibold">{language === 'ar' ? team.nameAr : team.code}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs list (Live, Upcoming, Finished counts) */}
      <div className="flex border-b border-white/5 bg-zinc-900/20 select-none">
        {(['live', 'upcoming', 'finished'] as const).map(tab => {
          const isActive = selectedTab === tab;
          const count = tab === 'live' ? liveMatches.length : tab === 'upcoming' ? upcomingMatches.length : finishedMatches.length;
          
          return (
            <button
               key={tab}
               onClick={() => setSelectedTab(tab)}
               className="flex-1 flex flex-col items-center justify-center gap-1 py-3 px-2 text-[10px] font-black uppercase tracking-[0.15em] border-b-2 transition-all relative"
               style={isActive ? {
                 borderColor: themeColors.accent,
                 color: themeColors.accent,
                 background: `${themeColors.accent}0a`
               } : {
                 borderColor: 'transparent',
                 color: '#a1a1aa'
               }}
            >
              <div className="flex items-center gap-1.5">
                {tab === 'live' && <Radio className="w-3.5 h-3.5 animate-pulse" />}
                {tab === 'upcoming' && <Clock className="w-3.5 h-3.5" />}
                {tab === 'finished' && <Trophy className="w-3.5 h-3.5" />}
                <span>
                  {t(tab === 'live' ? 'liveMatches' : tab === 'upcoming' ? 'upcomingMatches' : 'finishedMatches')}
                </span>
                {count > 0 && (
                  <span 
                    className={`ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full select-none text-white ${tab === 'live' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.45)]' : 'bg-white/10'}`}
                  >
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Scrollable match cards list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-gradient-to-b from-zinc-900/10 to-zinc-950/20 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-indigo-400" />
            <p className="text-zinc-500 text-xs tracking-wider uppercase font-bold">{t('loading')}</p>
          </div>
        ) : currentTabMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Trophy className="w-12 h-12 text-zinc-700 mb-4 animate-bounce" />
            <p className="text-sm font-bold text-zinc-400">
              {selectedTab === 'live' && (language === 'ar' ? 'لا توجد مباريات مباشرة حالياً' : 'No matches live right now')}
              {selectedTab === 'upcoming' && (language === 'ar' ? 'لا توجد مباريات مجدولة' : 'No upcoming matches scheduled')}
              {selectedTab === 'finished' && (language === 'ar' ? 'لا توجد مباريات منتهية' : 'No finished matches')}
            </p>
            {filterMode === 'mine' && (
              <p className="text-[10px] text-zinc-500 mt-2 max-w-xs leading-relaxed">
                {language === 'ar' 
                  ? 'لم يتم العثور على مباريات للفرق التي تدعمها. تحقق من "جميع المباريات" أو أضف المزيد من فرق الدعم في الإعدادات!'
                  : 'No matches found for supported teams. Choose "All Matches" or change your supported teams in World Cup settings!'}
              </p>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {currentTabMatches.map(match => (
              <MatchCard key={match.id} match={match} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Footer bar */}
      {lastUpdate && (
        <div className="p-2 border-t border-white/5 bg-zinc-950/40 text-center flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-ping mr-1" />
          <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase">
            {language === 'ar' ? 'تحديث تلقائي مفعل • آخر تحديث: ' : 'Live Simulation Active • Last synced: '}
            {lastUpdate.toLocaleTimeString(language === 'ar' ? 'ar-SA' : 'en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}
          </span>
        </div>
      )}
    </div>
  );
}
