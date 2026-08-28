export interface Country {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  flag: string;
  group: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  gradient: string;
}

export const CLASSIC_WC_THEME: Country = {
  id: 'classic',
  name: 'World Cup Classic',
  nameAr: 'كأس العالم الكلاسيكي',
  code: 'CLASSIC',
  flag: '🏆',
  group: 'Gold',
  primaryColor: '#eab308', // gold-500
  secondaryColor: '#f1f5f9', // slate-100
  accentColor: '#3b82f6', // blue-500
  gradient: 'from-yellow-500 via-amber-500 to-yellow-600'
};

export const WORLD_CUP_2026_TEAMS: Country[] = [
  // GROUP A
  {
    id: 'usa',
    name: 'USA',
    nameAr: 'الولايات المتحدة',
    code: 'USA',
    flag: '🇺🇸',
    group: 'A',
    primaryColor: '#3b82f6',
    secondaryColor: '#ef4444',
    accentColor: '#ffffff',
    gradient: 'from-blue-600 via-zinc-100 to-red-600'
  },
  {
    id: 'mexico',
    name: 'Mexico',
    nameAr: 'المكسيك',
    code: 'MEX',
    flag: '🇲🇽',
    group: 'A',
    primaryColor: '#16a34a',
    secondaryColor: '#dc2626',
    accentColor: '#ffffff',
    gradient: 'from-emerald-600 via-zinc-100 to-red-600'
  },
  {
    id: 'canada',
    name: 'Canada',
    nameAr: 'كندا',
    code: 'CAN',
    flag: '🇨🇦',
    group: 'A',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 to-zinc-100'
  },
  {
    id: 'jamaica',
    name: 'Jamaica',
    nameAr: 'جامايكا',
    code: 'JAM',
    flag: '🇯🇲',
    group: 'A',
    primaryColor: '#eab308',
    secondaryColor: '#16a34a',
    accentColor: '#18181b',
    gradient: 'from-yellow-400 via-green-600 to-zinc-900'
  },

  // GROUP B
  {
    id: 'argentina',
    name: 'Argentina',
    nameAr: 'الأرجنتين',
    code: 'ARG',
    flag: '🇦🇷',
    group: 'B',
    primaryColor: '#0ea5e9',
    secondaryColor: '#ffffff',
    accentColor: '#0ea5e9',
    gradient: 'from-sky-400 via-zinc-100 to-sky-400'
  },
  {
    id: 'brazil',
    name: 'Brazil',
    nameAr: 'البرازيل',
    code: 'BRA',
    flag: '🇧🇷',
    group: 'B',
    primaryColor: '#eab308',
    secondaryColor: '#16a34a',
    accentColor: '#2563eb',
    gradient: 'from-yellow-400 via-green-600 to-blue-600'
  },
  {
    id: 'uruguay',
    name: 'Uruguay',
    nameAr: 'أوروغواي',
    code: 'URU',
    flag: '🇺🇾',
    group: 'B',
    primaryColor: '#38bdf8',
    secondaryColor: '#ffffff',
    accentColor: '#eab308',
    gradient: 'from-sky-300 via-zinc-100 to-sky-400'
  },
  {
    id: 'colombia',
    name: 'Colombia',
    nameAr: 'كولومبيا',
    code: 'COL',
    flag: '🇨🇴',
    group: 'B',
    primaryColor: '#eab308',
    secondaryColor: '#2563eb',
    accentColor: '#ef4444',
    gradient: 'from-yellow-400 via-blue-600 to-red-500'
  },

  // GROUP C
  {
    id: 'france',
    name: 'France',
    nameAr: 'فرنسا',
    code: 'FRA',
    flag: '🇫🇷',
    group: 'C',
    primaryColor: '#1d4ed8',
    secondaryColor: '#ffffff',
    accentColor: '#ef4444',
    gradient: 'from-blue-700 via-zinc-100 to-red-600'
  },
  {
    id: 'england',
    name: 'England',
    nameAr: 'إنجلترا',
    code: 'ENG',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    group: 'C',
    primaryColor: '#3b82f6',
    secondaryColor: '#ffffff',
    accentColor: '#ef4444',
    gradient: 'from-blue-800 via-zinc-100 to-red-500'
  },
  {
    id: 'spain',
    name: 'Spain',
    nameAr: 'إسبانيا',
    code: 'ESP',
    flag: '🇪🇸',
    group: 'C',
    primaryColor: '#dc2626',
    secondaryColor: '#facc15',
    accentColor: '#dc2626',
    gradient: 'from-red-600 via-yellow-500 to-red-600'
  },
  {
    id: 'portugal',
    name: 'Portugal',
    nameAr: 'البرتغال',
    code: 'POR',
    flag: '🇵🇹',
    group: 'C',
    primaryColor: '#dc2626',
    secondaryColor: '#15803d',
    accentColor: '#dc2626',
    gradient: 'from-red-600 to-emerald-700'
  },

  // GROUP D
  {
    id: 'germany',
    name: 'Germany',
    nameAr: 'ألمانيا',
    code: 'GER',
    flag: '🇩🇪',
    group: 'D',
    primaryColor: '#18181b',
    secondaryColor: '#dc2626',
    accentColor: '#facc15',
    gradient: 'from-zinc-900 via-red-600 to-yellow-500'
  },
  {
    id: 'italy',
    name: 'Italy',
    nameAr: 'إيطاليا',
    code: 'ITA',
    flag: '🇮🇹',
    group: 'D',
    primaryColor: '#097969',
    secondaryColor: '#ffffff',
    accentColor: '#ef4444',
    gradient: 'from-green-600 via-zinc-100 to-red-600'
  },
  {
    id: 'morocco',
    name: 'Morocco',
    nameAr: 'المغرب',
    code: 'MAR',
    flag: '🇲🇦',
    group: 'D',
    primaryColor: '#c2410c',
    secondaryColor: '#14532d',
    accentColor: '#eab308',
    gradient: 'from-red-700 via-green-800 to-amber-500'
  },
  {
    id: 'belgium',
    name: 'Belgium',
    nameAr: 'بلجيكا',
    code: 'BEL',
    flag: '🇧🇪',
    group: 'D',
    primaryColor: '#dc2626',
    secondaryColor: '#18181b',
    accentColor: '#facc15',
    gradient: 'from-red-600 via-zinc-900 to-yellow-500'
  },

  // GROUP E
  {
    id: 'japan',
    name: 'Japan',
    nameAr: 'اليابان',
    code: 'JPN',
    flag: '🇯🇵',
    group: 'E',
    primaryColor: '#1e3a8a',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-blue-900 via-zinc-100 to-red-500'
  },
  {
    id: 'south_korea',
    name: 'South Korea',
    nameAr: 'كوريا الجنوبية',
    code: 'KOR',
    flag: '🇰🇷',
    group: 'E',
    primaryColor: '#dc2626',
    secondaryColor: '#1e3a8a',
    accentColor: '#ffffff',
    gradient: 'from-red-600 via-white to-blue-800'
  },
  {
    id: 'australia',
    name: 'Australia',
    nameAr: 'أستراليا',
    code: 'AUS',
    flag: '🇦🇺',
    group: 'E',
    primaryColor: '#eab308',
    secondaryColor: '#15803d',
    accentColor: '#eab308',
    gradient: 'from-amber-400 via-emerald-600 to-yellow-500'
  },
  {
    id: 'saudi_arabia',
    name: 'Saudi Arabia',
    nameAr: 'السعودية',
    code: 'KSA',
    flag: '🇸🇦',
    group: 'E',
    primaryColor: '#15803d',
    secondaryColor: '#ffffff',
    accentColor: '#15803d',
    gradient: 'from-emerald-750 over-zinc-100 to-emerald-600'
  },

  // GROUP F
  {
    id: 'croatia',
    name: 'Croatia',
    nameAr: 'كرواتيا',
    code: 'CRO',
    flag: '🇭🇷',
    group: 'F',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#2563eb',
    gradient: 'from-red-600 via-zinc-100 to-blue-600'
  },
  {
    id: 'netherlands',
    name: 'Netherlands',
    nameAr: 'هولندا',
    code: 'NED',
    flag: '🇳🇱',
    group: 'F',
    primaryColor: '#ea580c',
    secondaryColor: '#ffffff',
    accentColor: '#1e3a8a',
    gradient: 'from-orange-500 inside-white to-orange-600'
  },
  {
    id: 'senegal',
    name: 'Senegal',
    nameAr: 'السنغال',
    code: 'SEN',
    flag: '🇸🇳',
    group: 'F',
    primaryColor: '#16a34a',
    secondaryColor: '#eab308',
    accentColor: '#dc2626',
    gradient: 'from-emerald-600 via-yellow-400 to-red-600'
  },
  {
    id: 'ecuador',
    name: 'Ecuador',
    nameAr: 'الإكوادور',
    code: 'ECU',
    flag: '🇪🇨',
    group: 'F',
    primaryColor: '#eab308',
    secondaryColor: '#2563eb',
    accentColor: '#dc2626',
    gradient: 'from-yellow-400 via-blue-600 to-red-600'
  },

  // GROUP G
  {
    id: 'switzerland',
    name: 'Switzerland',
    nameAr: 'سويسرا',
    code: 'SUI',
    flag: '🇨🇭',
    group: 'G',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 via-zinc-100 to-red-600'
  },
  {
    id: 'denmark',
    name: 'Denmark',
    nameAr: 'الدانمارك',
    code: 'DEN',
    flag: '🇩🇰',
    group: 'G',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 to-zinc-100'
  },
  {
    id: 'tunisia',
    name: 'Tunisia',
    nameAr: 'تونس',
    code: 'TUN',
    flag: '🇹🇳',
    group: 'G',
    primaryColor: '#dc2625',
    secondaryColor: '#ffffff',
    accentColor: '#dc2625',
    gradient: 'from-red-600 via-white to-red-600'
  },
  {
    id: 'panama',
    name: 'Panama',
    nameAr: 'بنما',
    code: 'PAN',
    flag: '🇵🇦',
    group: 'G',
    primaryColor: '#dc2626',
    secondaryColor: '#2563eb',
    accentColor: '#ffffff',
    gradient: 'from-red-600 via-zinc-100 to-blue-600'
  },

  // GROUP H
  {
    id: 'poland',
    name: 'Poland',
    nameAr: 'بولندا',
    code: 'POL',
    flag: '🇵🇱',
    group: 'H',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-zinc-50 to-red-600'
  },
  {
    id: 'sweden',
    name: 'Sweden',
    nameAr: 'السويد',
    code: 'SWE',
    flag: '🇸🇪',
    group: 'H',
    primaryColor: '#2563eb',
    secondaryColor: '#eab308',
    accentColor: '#2563eb',
    gradient: 'from-blue-600 via-yellow-400 to-blue-600'
  },
  {
    id: 'iran',
    name: 'Iran',
    nameAr: 'إيران',
    code: 'IRN',
    flag: '🇮🇷',
    group: 'H',
    primaryColor: '#16a34a',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-emerald-600 via-zinc-100 to-red-600'
  },
  {
    id: 'algeria',
    name: 'Algeria',
    nameAr: 'الجزائر',
    code: 'ALG',
    flag: '🇩🇿',
    group: 'H',
    primaryColor: '#16a34a',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-emerald-600 via-zinc-100 to-emerald-700'
  },

  // GROUP I
  {
    id: 'egypt',
    name: 'Egypt',
    nameAr: 'مصر',
    code: 'EGY',
    flag: '🇪🇬',
    group: 'I',
    primaryColor: '#dc2626',
    secondaryColor: '#18181b',
    accentColor: '#ffffff',
    gradient: 'from-red-600 via-zinc-900 to-yellow-500'
  },
  {
    id: 'nigeria',
    name: 'Nigeria',
    nameAr: 'نيجيريا',
    code: 'NGA',
    flag: '🇳🇬',
    group: 'I',
    primaryColor: '#16a34a',
    secondaryColor: '#ffffff',
    accentColor: '#16a34a',
    gradient: 'from-emerald-600 via-white to-emerald-600'
  },
  {
    id: 'cameroon',
    name: 'Cameroon',
    nameAr: 'الكاميرون',
    code: 'CMR',
    flag: '🇨🇲',
    group: 'I',
    primaryColor: '#16a34a',
    secondaryColor: '#dc2626',
    accentColor: '#eab308',
    gradient: 'from-emerald-600 via-red-600 to-yellow-500'
  },
  {
    id: 'ghana',
    name: 'Ghana',
    nameAr: 'غانا',
    code: 'GHA',
    flag: '🇬🇭',
    group: 'I',
    primaryColor: '#eab308',
    secondaryColor: '#16a34a',
    accentColor: '#dc2626',
    gradient: 'from-yellow-400 via-green-600 to-red-600'
  },

  // GROUP J
  {
    id: 'peru',
    name: 'Peru',
    nameAr: 'بيرو',
    code: 'PER',
    flag: '🇵🇪',
    group: 'J',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 via-zinc-100 to-red-600'
  },
  {
    id: 'chile',
    name: 'Chile',
    nameAr: 'تشيلي',
    code: 'CHI',
    flag: '🇨🇱',
    group: 'J',
    primaryColor: '#3b82f6',
    secondaryColor: '#dc2626',
    accentColor: '#ffffff',
    gradient: 'from-blue-600 via-zinc-100 to-red-650'
  },
  {
    id: 'ukraine',
    name: 'Ukraine',
    nameAr: 'أوكرانيا',
    code: 'UKR',
    flag: '🇺🇦',
    group: 'J',
    primaryColor: '#3b82f6',
    secondaryColor: '#eab308',
    accentColor: '#3b82f6',
    gradient: 'from-blue-500 via-yellow-400 to-blue-500'
  },
  {
    id: 'costa_rica',
    name: 'Costa Rica',
    nameAr: 'كوستاريكا',
    code: 'CRC',
    flag: '🇨🇷',
    group: 'J',
    primaryColor: '#dc2626',
    secondaryColor: '#2563eb',
    accentColor: '#ffffff',
    gradient: 'from-red-600 via-zinc-100 to-blue-600'
  },

  // GROUP K
  {
    id: 'new_zealand',
    name: 'New Zealand',
    nameAr: 'نيوزيلندا',
    code: 'NZL',
    flag: '🇳🇿',
    group: 'K',
    primaryColor: '#18181b',
    secondaryColor: '#ffffff',
    accentColor: '#18181b',
    gradient: 'from-zinc-900 via-slate-800 to-zinc-50'
  },
  {
    id: 'iraq',
    name: 'Iraq',
    nameAr: 'العراق',
    code: 'IRQ',
    flag: '🇮🇶',
    group: 'K',
    primaryColor: '#15803d',
    secondaryColor: '#dc2626',
    accentColor: '#18181b',
    gradient: 'from-emerald-700 via-zinc-200 to-red-600'
  },
  {
    id: 'qatar',
    name: 'Qatar',
    nameAr: 'قطر',
    code: 'QAT',
    flag: '🇶🇦',
    group: 'K',
    primaryColor: '#7f1d1d',
    secondaryColor: '#ffffff',
    accentColor: '#7f1d1d',
    gradient: 'from-rose-900 to-zinc-100'
  },
  {
    id: 'uae',
    name: 'UAE',
    nameAr: 'الإمارات',
    code: 'UAE',
    flag: '🇦🇪',
    group: 'K',
    primaryColor: '#15803d',
    secondaryColor: '#dc2626',
    accentColor: '#18181b',
    gradient: 'from-red-600 via-green-600 to-zinc-900'
  },

  // GROUP L
  {
    id: 'turkey',
    name: 'Turkey',
    nameAr: 'تركيا',
    code: 'TUR',
    flag: '🇹🇷',
    group: 'L',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 to-rose-200'
  },
  {
    id: 'wales',
    name: 'Wales',
    nameAr: 'ويلز',
    code: 'WAL',
    flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
    group: 'L',
    primaryColor: '#dc2626',
    secondaryColor: '#16a34a',
    accentColor: '#facc15',
    gradient: 'from-red-600 via-emerald-600 to-yellow-500'
  },
  {
    id: 'scotland',
    name: 'Scotland',
    nameAr: 'اسكتلندا',
    code: 'SCO',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    group: 'L',
    primaryColor: '#1e3a8a',
    secondaryColor: '#ffffff',
    accentColor: '#1e3a8a',
    gradient: 'from-blue-900 via-zinc-100 to-blue-800'
  },
  {
    id: 'austria',
    name: 'Austria',
    nameAr: 'النمسا',
    code: 'AUT',
    flag: '🇦🇹',
    group: 'L',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#dc2626',
    gradient: 'from-red-600 via-zinc-100 to-red-600'
  },
  {
    id: 'cabo_verde',
    name: 'Cabo Verde',
    nameAr: 'الرأس الأخضر',
    code: 'CPV',
    flag: '🇨🇻',
    group: 'H',
    primaryColor: '#1e3a8a',
    secondaryColor: '#dc2626',
    accentColor: '#eab308',
    gradient: 'from-blue-800 via-red-600 to-yellow-500'
  },
  {
    id: 'norway',
    name: 'Norway',
    nameAr: 'النرويج',
    code: 'NOR',
    flag: '🇳🇴',
    group: 'I',
    primaryColor: '#dc2626',
    secondaryColor: '#1e3a8a',
    accentColor: '#ffffff',
    gradient: 'from-red-600 via-blue-800 to-white'
  },
  {
    id: 'jordan',
    name: 'Jordan',
    nameAr: 'الأردن',
    code: 'JOR',
    flag: '🇯🇴',
    group: 'J',
    primaryColor: '#15803d',
    secondaryColor: '#18181b',
    accentColor: '#dc2626',
    gradient: 'from-zinc-900 via-green-750 to-red-600'
  },
  {
    id: 'uzbekistan',
    name: 'Uzbekistan',
    nameAr: 'أوزبكستان',
    code: 'UZB',
    flag: '🇺🇿',
    group: 'K',
    primaryColor: '#0ea5e9',
    secondaryColor: '#16a34a',
    accentColor: '#ffffff',
    gradient: 'from-sky-500 via-zinc-100 to-emerald-600'
  },
  {
    id: 'congo_dr',
    name: 'Congo DR',
    nameAr: 'جمهورية الكونغو الديمقراطية',
    code: 'COD',
    flag: '🇨🇩',
    group: 'K',
    primaryColor: '#0ea5e9',
    secondaryColor: '#dc2626',
    accentColor: '#eab308',
    gradient: 'from-sky-500 via-red-500 to-yellow-500'
  },
  {
    id: 'haiti',
    name: 'Haiti',
    nameAr: 'هايتي',
    code: 'HAI',
    flag: '🇭🇹',
    group: 'C',
    primaryColor: '#1e3a8a',
    secondaryColor: '#dc2626',
    accentColor: '#ffffff',
    gradient: 'from-blue-750 to-red-600'
  },
  {
    id: 'bosnia',
    name: 'Bosnia & Herzegovina',
    nameAr: 'البوسنة والهرسك',
    code: 'BIH',
    flag: '🇧🇦',
    group: 'B',
    primaryColor: '#1e3a8a',
    secondaryColor: '#eab308',
    accentColor: '#ffffff',
    gradient: 'from-blue-850 via-yellow-400 to-blue-700'
  },
  {
    id: 'czechia',
    name: 'Czechia',
    nameAr: 'التشيك',
    code: 'CZE',
    flag: '🇨🇿',
    group: 'A',
    primaryColor: '#1e3a8a',
    secondaryColor: '#dc2626',
    accentColor: '#ffffff',
    gradient: 'from-blue-800 via-zinc-100 to-red-600'
  },
  {
    id: 'south_africa',
    name: 'South Africa',
    nameAr: 'جنوب أفريقيا',
    code: 'RSA',
    flag: '🇿🇦',
    group: 'A',
    primaryColor: '#15803d',
    secondaryColor: '#dc2626',
    accentColor: '#eab308',
    gradient: 'from-emerald-600 via-yellow-400 to-red-600'
  },
  {
    id: 'curacao',
    name: 'Curaçao',
    nameAr: 'كوراساو',
    code: 'CUW',
    flag: '🇨🇼',
    group: 'E',
    primaryColor: '#1e3a8a',
    secondaryColor: '#eab308',
    accentColor: '#ffffff',
    gradient: 'from-blue-700 to-yellow-400'
  },
  {
    id: 'cote_divoire',
    name: "Côte d'Ivoire",
    nameAr: 'ساحل العاج',
    code: 'CIV',
    flag: '🇨🇮',
    group: 'E',
    primaryColor: '#ea580c',
    secondaryColor: '#ffffff',
    accentColor: '#16a34a',
    gradient: 'from-orange-500 via-zinc-50 to-emerald-600'
  },
  {
    id: 'paraguay',
    name: 'Paraguay',
    nameAr: 'باراغواي',
    code: 'PAR',
    flag: '🇵🇾',
    group: 'D',
    primaryColor: '#dc2626',
    secondaryColor: '#ffffff',
    accentColor: '#1e3a8a',
    gradient: 'from-red-650 via-zinc-100 to-blue-805'
  }
];

export function getTeamById(id: string): Country | undefined {
  if (id === 'classic') return CLASSIC_WC_THEME;
  return WORLD_CUP_2026_TEAMS.find(t => t.id === id);
}

export function getAllGroups(): string[] {
  const groupsSet = new Set(WORLD_CUP_2026_TEAMS.map(team => team.group));
  return Array.from(groupsSet).sort();
}

export default WORLD_CUP_2026_TEAMS;
