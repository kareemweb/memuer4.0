import React, { useState, useEffect } from 'react';
import { 
  Trophy, Flag, Shield, Tv, Sparkles, Globe, 
  Check, Play, Calendar, AlertCircle, Info, ChevronRight,
  User, MessageCircle, Heart, Star, Users, MapPin, Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface WorldCupCountry {
  id: string;
  name: string;
  nameAr: string;
  flag: string;
  colors: {
    primary: string; // bg-class or hex
    secondary: string;
    accent: string;
    text: string;
    gradient: string;
  };
  confederation: string;
}

// 48 Countries in World Cup 2026
export const WC_COUNTRIES: WorldCupCountry[] = [
  { id: 'usa', name: 'United States', nameAr: 'الولايات المتحدة', flag: '🇺🇸', colors: { primary: 'from-blue-900 to-slate-900', secondary: 'bg-red-600', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-900 via-slate-950 to-red-950' }, confederation: 'CONCACAF' },
  { id: 'mex', name: 'Mexico', nameAr: 'المكسيك', flag: '🇲🇽', colors: { primary: 'from-emerald-900 to-stone-900', secondary: 'bg-red-600', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-stone-950 to-red-950' }, confederation: 'CONCACAF' },
  { id: 'can', name: 'Canada', nameAr: 'كندا', flag: '🇨🇦', colors: { primary: 'from-red-800 to-neutral-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-neutral-950 to-red-900' }, confederation: 'CONCACAF' },
  { id: 'arg', name: 'Argentina', nameAr: 'الأرجنتين', flag: '🇦🇷', colors: { primary: 'from-sky-600 to-sky-950', secondary: 'bg-amber-400', accent: 'text-sky-450', text: 'text-white', gradient: 'bg-gradient-to-br from-sky-900 via-slate-950 to-sky-950' }, confederation: 'CONMEBOL' },
  { id: 'bra', name: 'Brazil', nameAr: 'البرازيل', flag: '🇧🇷', colors: { primary: 'from-yellow-600 to-emerald-900', secondary: 'bg-blue-600', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-yellow-950' }, confederation: 'CONMEBOL' },
  { id: 'fra', name: 'France', nameAr: 'فرنسا', flag: '🇫🇷', colors: { primary: 'from-blue-800 to-red-900', secondary: 'bg-white', accent: 'text-blue-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-red-950' }, confederation: 'UEFA' },
  { id: 'eng', name: 'England', nameAr: 'إنجلترا', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', colors: { primary: 'from-slate-100 to-slate-205', secondary: 'bg-red-600', accent: 'text-red-500', text: 'text-slate-900', gradient: 'bg-gradient-to-br from-white via-slate-100 to-red-50' }, confederation: 'UEFA' },
  { id: 'esp', name: 'Spain', nameAr: 'إسبانيا', flag: '🇪🇸', colors: { primary: 'from-red-700 to-yellow-800', secondary: 'bg-yellow-500', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-stone-950 to-yellow-950' }, confederation: 'UEFA' },
  { id: 'ger', name: 'Germany', nameAr: 'ألمانيا', flag: '🇩🇪', colors: { primary: 'from-stone-900 to-stone-950', secondary: 'bg-red-600', accent: 'text-yellow-500', text: 'text-white', gradient: 'bg-gradient-to-br from-stone-950 via-red-950 to-yellow-950' }, confederation: 'UEFA' },
  { id: 'ita', name: 'Italy', nameAr: 'إيطاليا', flag: '🇮🇹', colors: { primary: 'from-blue-700 to-emerald-850', secondary: 'bg-white', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-emerald-950' }, confederation: 'UEFA' },
  { id: 'por', name: 'Portugal', nameAr: 'البرتغال', flag: '🇵🇹', colors: { primary: 'from-red-800 to-emerald-900', secondary: 'bg-yellow-500', accent: 'text-amber-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-emerald-950 to-amber-955' }, confederation: 'UEFA' },
  { id: 'ned', name: 'Netherlands', nameAr: 'هولندا', flag: '🇳🇱', colors: { primary: 'from-orange-600 to-blue-900', secondary: 'bg-white', accent: 'text-orange-400', text: 'text-white', gradient: 'bg-gradient-to-br from-orange-950 via-slate-950 to-blue-950' }, confederation: 'UEFA' },
  { id: 'bel', name: 'Belgium', nameAr: 'بلجيكا', flag: '🇧🇪', colors: { primary: 'from-red-850 to-stone-900', secondary: 'bg-yellow-500', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-stone-950 to-yellow-955' }, confederation: 'UEFA' },
  { id: 'cro', name: 'Croatia', nameAr: 'كرواتيا', flag: '🇭🇷', colors: { primary: 'from-red-700 to-blue-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-blue-950' }, confederation: 'UEFA' },
  { id: 'uru', name: 'Uruguay', nameAr: 'الأوروغواي', flag: '🇺🇾', colors: { primary: 'from-sky-500 to-slate-900', secondary: 'bg-yellow-400', accent: 'text-sky-300', text: 'text-white', gradient: 'bg-gradient-to-br from-sky-950 via-slate-950 to-amber-950' }, confederation: 'CONMEBOL' },
  { id: 'col', name: 'Colombia', nameAr: 'كولومبيا', flag: '🇨🇴', colors: { primary: 'from-yellow-500 to-blue-800', secondary: 'bg-red-600', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-yellow-950 via-blue-950 to-red-955' }, confederation: 'CONMEBOL' },
  { id: 'mar', name: 'Morocco', nameAr: 'المغرب', flag: '🇲🇦', colors: { primary: 'from-red-700 to-emerald-800', secondary: 'bg-yellow-500', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-emerald-950' }, confederation: 'CAF' },
  { id: 'sen', name: 'Senegal', nameAr: 'السنغال', flag: '🇸🇳', colors: { primary: 'from-green-700 to-yellow-600', secondary: 'bg-red-600', accent: 'text-green-400', text: 'text-white', gradient: 'bg-gradient-to-br from-green-950 via-yellow-950 to-red-955' }, confederation: 'CAF' },
  { id: 'jpn', name: 'Japan', nameAr: 'اليابان', flag: '🇯🇵', colors: { primary: 'from-blue-900 to-neutral-900', secondary: 'bg-red-600', accent: 'text-blue-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-red-950' }, confederation: 'AFC' },
  { id: 'kor', name: 'South Korea', nameAr: 'كوريا الجنوبية', flag: '🇰🇷', colors: { primary: 'from-red-700 to-blue-900', secondary: 'bg-neutral-900', accent: 'text-red-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-blue-950' }, confederation: 'AFC' },
  { id: 'aus', name: 'Australia', nameAr: 'أستراليا', flag: '🇺🇦', colors: { primary: 'from-green-800 to-yellow-600', secondary: 'bg-yellow-400', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-yellow-950' }, confederation: 'AFC' }, // Green and Gold are standard colors
  { id: 'sau', name: 'Saudi Arabia', nameAr: 'المملكة العربية السعودية', flag: '🇸🇦', colors: { primary: 'from-emerald-700 to-emerald-950', secondary: 'bg-white', accent: 'text-emerald-450', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-900 via-teal-950 to-emerald-950' }, confederation: 'AFC' },
  { id: 'egy', name: 'Egypt', nameAr: 'مصر', flag: '🇪🇬', colors: { primary: 'from-red-700 to-stone-900', secondary: 'bg-amber-400', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-stone-950 to-amber-955' }, confederation: 'CAF' },
  { id: 'nga', name: 'Nigeria', nameAr: 'نيجيريا', flag: '🇳🇬', colors: { primary: 'from-emerald-800 to-emerald-950', secondary: 'bg-white', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-neutral-950' }, confederation: 'CAF' },
  { id: 'cmr', name: 'Cameroon', nameAr: 'الكاميرون', flag: '🇨🇲', colors: { primary: 'from-green-700 to-red-700', secondary: 'bg-yellow-400', accent: 'text-yellow-500', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-stone-950 to-red-955' }, confederation: 'CAF' },
  { id: 'civ', name: 'Ivory Coast', nameAr: 'ساحل العاج', flag: '🇨🇮', colors: { primary: 'from-orange-500 to-emerald-800', secondary: 'bg-white', accent: 'text-orange-400', text: 'text-white', gradient: 'bg-gradient-to-br from-orange-950 via-neutral-950 to-emerald-950' }, confederation: 'CAF' },
  { id: 'alg', name: 'Algeria', nameAr: 'الجزائر', flag: '🇩🇿', colors: { primary: 'from-emerald-700 to-red-700', secondary: 'bg-white', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-stone-950 to-red-950' }, confederation: 'CAF' },
  { id: 'ecu', name: 'Ecuador', nameAr: 'الإكوادور', flag: '🇪🇨', colors: { primary: 'from-yellow-500 to-blue-700', secondary: 'bg-red-600', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-yellow-950 via-slate-950 to-red-950' }, confederation: 'CONMEBOL' },
  { id: 'per', name: 'Peru', nameAr: 'بيرو', flag: '🇵🇪', colors: { primary: 'from-red-650 to-stone-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-stone-950 to-red-900' }, confederation: 'CONMEBOL' },
  { id: 'chi', name: 'Chile', nameAr: 'تشيلي', flag: '🇨🇱', colors: { primary: 'from-red-700 to-blue-800', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-blue-955' }, confederation: 'CONMEBOL' },
  { id: 'sui', name: 'Switzerland', nameAr: 'سويسرا', flag: '🇨🇭', colors: { primary: 'from-red-600 to-red-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-900 via-stone-950 to-red-950' }, confederation: 'UEFA' },
  { id: 'den', name: 'Denmark', nameAr: 'الدانمارك', flag: '🇩🇰', colors: { primary: 'from-red-700 to-neutral-900', secondary: 'bg-white', accent: 'text-red-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-neutral-950 to-red-900' }, confederation: 'UEFA' },
  { id: 'swe', name: 'Sweden', nameAr: 'السويد', flag: '🇸🇪', colors: { primary: 'from-blue-600 to-yellow-600', secondary: 'bg-blue-700', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-yellow-950' }, confederation: 'UEFA' },
  { id: 'pol', name: 'Poland', nameAr: 'بولندا', flag: '🇵🇱', colors: { primary: 'from-red-700 to-neutral-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-white via-neutral-950 to-red-950' }, confederation: 'UEFA' },
  { id: 'ukr', name: 'Ukraine', nameAr: 'أوكرانيا', flag: '🇺🇦', colors: { primary: 'from-blue-600 to-yellow-500', secondary: 'bg-yellow-400', accent: 'text-sky-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-yellow-950' }, confederation: 'UEFA' },
  { id: 'tur', name: 'Turkey', nameAr: 'تركيا', flag: '🇹🇷', colors: { primary: 'from-red-600 to-neutral-950', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-red-900' }, confederation: 'UEFA' },
  { id: 'tun', name: 'Tunisia', nameAr: 'تونس', flag: '🇹🇳', colors: { primary: 'from-red-700 to-slate-900', secondary: 'bg-white', accent: 'text-red-500', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-900 to-stone-950' }, confederation: 'CAF' },
  { id: 'gha', name: 'Ghana', nameAr: 'غانا', flag: '🇬🇭', colors: { primary: 'from-red-800 to-yellow-600', secondary: 'bg-green-600', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-yellow-950 to-green-955' }, confederation: 'CAF' },
  { id: 'crc', name: 'Costa Rica', nameAr: 'كوستاريكا', flag: '🇨🇷', colors: { primary: 'from-red-700 to-blue-800', secondary: 'bg-white', accent: 'text-red-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-slate-950 to-blue-950' }, confederation: 'CONCACAF' },
  { id: 'irn', name: 'Iran', nameAr: 'إيران', flag: '🇮🇷', colors: { primary: 'from-emerald-700 to-red-700', secondary: 'bg-white', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-red-955' }, confederation: 'AFC' },
  { id: 'irq', name: 'Iraq', nameAr: 'العراق', flag: '🇮🇶', colors: { primary: 'from-red-700 to-stone-900', secondary: 'bg-emerald-600', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-red-950 via-stone-950 to-emerald-955' }, confederation: 'AFC' },
  { id: 'qat', name: 'Qatar', nameAr: 'قطر', flag: '🇶🇦', colors: { primary: 'from-rose-900 to-slate-900', secondary: 'bg-white', accent: 'text-rose-450', text: 'text-white', gradient: 'bg-gradient-to-br from-rose-950 via-slate-950 to-rose-955' }, confederation: 'AFC' },
  { id: 'uae', name: 'UAE', nameAr: 'الإمارات العربية المتحدة', flag: '🇦🇪', colors: { primary: 'from-emerald-800 to-red-700', secondary: 'bg-white', accent: 'text-emerald-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-stone-950 to-red-950' }, confederation: 'AFC' },
  { id: 'pan', name: 'Panama', nameAr: 'بنما', flag: '🇵🇦', colors: { primary: 'from-red-650 to-blue-800', secondary: 'bg-white', accent: 'text-blue-400', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-red-950' }, confederation: 'CONCACAF' },
  { id: 'jam', name: 'Jamaica', nameAr: 'جامايكا', flag: '🇯🇲', colors: { primary: 'from-yellow-500 to-emerald-800', secondary: 'bg-neutral-900', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-green-950 via-stone-950 to-yellow-955' }, confederation: 'CONCACAF' },
  { id: 'rsa', name: 'South Africa', nameAr: 'جنوب إفريقيا', flag: '🇿🇦', colors: { primary: 'from-darkgreen to-blue-800', secondary: 'bg-yellow-500', accent: 'text-yellow-400', text: 'text-white', gradient: 'bg-gradient-to-br from-emerald-950 via-slate-950 to-yellow-950' }, confederation: 'CAF' },
  { id: 'nzl', name: 'New Zealand', nameAr: 'نيوزيلندا', flag: '🇳🇿', colors: { primary: 'from-blue-900 to-black', secondary: 'bg-red-600', accent: 'text-slate-300', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-neutral-900' }, confederation: 'OFC' },
  { id: 'sco', name: 'Scotland', nameAr: 'اسكتلندا', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', colors: { primary: 'from-blue-800 to-slate-900', secondary: 'bg-white', accent: 'text-blue-300', text: 'text-white', gradient: 'bg-gradient-to-br from-blue-950 via-slate-950 to-slate-900' }, confederation: 'UEFA' }
];

// Classic World Cup Theme (Red, Green, Blue)
export const CLASSIC_WC_THEME = {
  id: 'classic-wc',
  name: 'Classic World Cup',
  nameAr: 'كأس العالم الكلاسيكي',
  flag: '🏆',
  colors: {
    primary: 'from-emerald-600 via-blue-600 to-red-600',
    secondary: 'bg-yellow-500',
    accent: 'text-emerald-400',
    text: 'text-white',
    gradient: 'bg-gradient-to-br from-emerald-950 via-blue-950 to-red-950'
  }
};

// Full application translations (Arabic & English)
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    title: 'Memuer Chat Client',
    welcome: 'Welcome back,',
    wcMode: 'World Cup 2026 Mode',
    wcModeDesc: 'Support your teams, sync flag themes, and track matches!',
    langName: 'Arabic',
    langAbbr: 'العربية',
    saveSelection: 'Save Profile & Enter App',
    selectSupported: 'Choose Countries You Support',
    selectCountriesTitle: 'Join World Cup 2026',
    selectCountriesDesc: 'Select one or more teams to support. This unlocks custom country themes and real-time live matches!',
    searchPlaceholder: 'Search countries...',
    groupStage: 'Group Stage',
    live: 'LIVE',
    scheduled: 'SCHEDULED',
    finished: 'FINISHED',
    realTimeLoader: 'Syncing Real-time Match Center...',
    matchCenterTitle: 'Supported Teams - Live Feeds',
    noSupportedTeams: 'No live matches found. Support teams inside World Cup settings to see real-time updates here!',
    noUpcoming: 'No live games for your teams at this minute. Simulated dynamic league running...',
    supportedHeader: 'Yalla World Cup!',
    classicTheme: 'Classic World Cup Theme',
    keyMismatchTitle: 'E2EE Key Mismatch Detected',
    keyMismatchDesc: 'Your browser cryptography keys do not match your Firestore coordinates (New Device?). Tap "Heal Vault Keys" to clean.',
    healKeys: 'Heal Vault Keys',
    healSuccess: 'Automatic vault key verification completed successfully! New secure tunnel created.',
    chats: 'Secure Chats',
    contacts: 'Contacts',
    requests: 'Friend Requests',
    settings: 'AppSettings',
    logout: 'Secure Terminate',
    askAI: 'Consult AI Assistant',
    typing: 'composing messages...',
    searchChats: 'Search logs...',
    adminConsole: 'Administrative Console',
    bannedMessage: 'Profile Banned by Moderator',
    maintenanceMessage: 'System Under Secure Optimization',
    joinedMessage: 'Channel secured. Secure symmetric exchange established.',
    activeCall: 'Incoming Secure Sound Wave',
    joinedCall: 'Joint audio/video link streaming',
    language: 'App Interface Language',
    theme: 'App Color Theme',
    bgTheme: 'Ambient Background Design',
    supportedTeamsSetting: 'My Supported Teams',
    currentLanguageName: 'English (US)',
    aboutTitle: 'Memuer Messenger 2026 v3.2',
    arabicNote: 'Arabic interface layout mirror (RTL/LTR) initialized'
  },
  ar: {
    title: 'ميموإر شات الآمن',
    welcome: 'مرحباً بعودتك،',
    wcMode: 'طور كأس العالم 2026',
    wcModeDesc: 'ادعم منتخباتك، غير سمات التطبيق لألوان الأعلام، وتابع المباريات المباشرة!',
    langName: 'English',
    langAbbr: 'EN',
    saveSelection: 'حفظ وتأكيد الدخول',
    selectSupported: 'اختر المنتخبات التي تشجعها',
    selectCountriesTitle: 'انضم لمونديال 2026 🏆',
    selectCountriesDesc: 'اختر منتخبًا واحدًا أو أكثر لدعمه. هذا سيتيج لك الألوان الخاصة بعلم منتخبك ومتابعة مبارياتهم مباشرة ولحظة بلحظة!',
    searchPlaceholder: 'ابحث عن دولة...',
    groupStage: 'دور المجموعات',
    live: 'مباشر الآن',
    scheduled: 'مجدولة',
    finished: 'انتهت',
    realTimeLoader: 'مزامنة مركز المباريات المباشر...',
    matchCenterTitle: 'مباريات منتخباتي المفضلة',
    noSupportedTeams: 'لم يتم العثور على مباريات الآن. فضلاً ادعم منتخبات وطنية من إعدادات كأس العالم لتظهر لك التحديثات المباشرة هنا!',
    noUpcoming: 'لا توجد مباريات حية لمنتخباتك في هذه الدقيقة. تتم الآن محاكاة مباريات الدوري الحي...',
    supportedHeader: 'يلا كورة كأس العالم!',
    classicTheme: 'سمة المونديال الكلاسيكية',
    keyMismatchTitle: 'تم رصد عدم تطابق في مفتاح التشفير الآمن',
    keyMismatchDesc: 'لا تتطابق مفاتيح التشفير المحلية في متصفحك مع الخزنة السحابية (هل سجلت من جهاز جديد؟). اضغط على "إصلاح الخزنة والمفاتيح" لإعادة الربط الآمن.',
    healKeys: 'إصلاح التشفير والمفاتيح',
    healSuccess: 'اكتملت عملية التحقق التلقائية بنجاح! تم إنشاء نفق مشفر آمن جديد الآن.',
    chats: 'المحادثات المشفرة',
    contacts: 'جهات الاتصال',
    requests: 'طلبات الصداقة',
    settings: 'إعدادات ميموإر',
    logout: 'إنهاء الجلسة الآمنة',
    askAI: 'استشارة المساعد الذكي',
    typing: 'يكتب الآن رسالة...',
    searchChats: 'البحث في السجلات...',
    adminConsole: 'لوحة التحكم الإدارية',
    bannedMessage: 'الحساب محظور من قبل المشرف',
    maintenanceMessage: 'النظام تحت الصيانة الآمنة والتحسين',
    joinedMessage: 'تم تأمين القناة. جاري تشغيل تشفير الدفق المتناظر.',
    activeCall: 'مكالمة آمنة واردة الآن',
    joinedCall: 'رابط دفق الصوت والصورة المشترك متصل الآن',
    language: 'لغة واجهة التطبيق',
    theme: 'السمة والألوان العامة',
    bgTheme: 'الخلفية التفاعلية',
    supportedTeamsSetting: 'منتخباتي المفضلة',
    currentLanguageName: 'العربية (RTL)',
    aboutTitle: 'ميموإر ماسنجر 2026 إصدار 3.2',
    arabicNote: 'تم تهيئة اتجاه الواجهة العربية RTL بنجاح'
  }
};

// Interface for simulated matches
export interface WC_Match {
  id: string;
  homeTeam: WorldCupCountry;
  awayTeam: WorldCupCountry;
  homeScore: number;
  awayScore: number;
  minute: number;
  status: 'LIVE' | 'SCHEDULED' | 'FINISHED';
  group: string;
  gameEvent?: string;
  scorers: { name: string; teamId: string; min: number }[];
}

export const WorldCupDashboard: React.FC<{
  userPreferences: any;
  onUpdatePreferences: (pref: any) => Promise<void>;
  appLanguage: 'en' | 'ar';
  setAppLanguage: (lang: 'en' | 'ar') => void;
  onHealKeys?: () => Promise<void>;
  showHealMessage?: boolean;
}> = ({
  userPreferences,
  onUpdatePreferences,
  appLanguage,
  setAppLanguage,
  onHealKeys,
  showHealMessage
}) => {
  const [supportedTeams, setSupportedTeams] = useState<string[]>(userPreferences?.supportedCountries || []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConfederation, setSelectedConfederation] = useState<string>('ALL');
  const [activeMatches, setActiveMatches] = useState<WC_Match[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isRefreshingMatches, setIsRefreshingMatches] = useState(false);

  const t = TRANSLATIONS[appLanguage];

  // 1. Sync local supported state when userPreferences updates
  useEffect(() => {
    if (userPreferences?.supportedCountries) {
      setSupportedTeams(userPreferences.supportedCountries);
    } else {
      // If user joined for the first time, show onboarding selector
      setShowOnboarding(true);
    }
  }, [userPreferences]);

  // 2. Real-time simulated Match Generator
  useEffect(() => {
    // Generate some initial static matches involving supported teams
    const initMatches = () => {
      const list: WC_Match[] = [];
      const teams = supportedTeams.length > 0 ? supportedTeams : ['usa', 'mar', 'bra', 'arg', 'fra'];
      
      // We will construct 4-5 active matches or scheduled matches
      teams.forEach((teamId, index) => {
        const country = WC_COUNTRIES.find(c => c.id === teamId);
        if (!country) return;

        // Find an opposing team
        const opponents = WC_COUNTRIES.filter(c => c.id !== teamId);
        const opponent = opponents[index % opponents.length];

        const matchStatus = index % 3 === 0 ? 'LIVE' : (index % 3 === 1 ? 'SCHEDULED' : 'FINISHED');
        const minVal = matchStatus === 'LIVE' ? Math.floor(Math.random() * 85) + 5 : 90;
        const score1 = matchStatus === 'SCHEDULED' ? 0 : Math.floor(Math.random() * 3);
        const score2 = matchStatus === 'SCHEDULED' ? 0 : Math.floor(Math.random() * 3);

        const initialScorers = [];
        if (score1 > 0) {
          initialScorers.push({ name: `${country.flag} Scorer A`, teamId: country.id, min: Math.floor(minVal / 2) });
        }
        if (score2 > 0) {
          initialScorers.push({ name: `${opponent.flag} Player X`, teamId: opponent.id, min: Math.floor(minVal - 3) });
        }

        list.push({
          id: `match-${index}-${teamId}`,
          homeTeam: country,
          awayTeam: opponent,
          homeScore: score1,
          awayScore: score2,
          minute: minVal,
          status: matchStatus,
          group: `Group ${String.fromCharCode(65 + (index % 12))}`,
          scorers: initialScorers
        });
      });

      setActiveMatches(list);
    };

    initMatches();
  }, [supportedTeams]);

  // 3. Simulated real-time score updates ticking every 12 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMatches(prev => {
        return prev.map(match => {
          if (match.status !== 'LIVE') return match;

          // Increase minute
          let nextMinute = match.minute + 1;
          let nextHomeScore = match.homeScore;
          let nextAwayScore = match.awayScore;
          let nextEvent = '';
          const nextScorers = [...match.scorers];

          if (nextMinute >= 90) {
            match.status = 'FINISHED';
            nextMinute = 90;
            nextEvent = '🚨 Whistle! Full Time whistle has blown!';
          } else {
            // 2% chance of a goal
            const rand = Math.random();
            if (rand < 0.03) {
              const isHomeScoring = Math.random() > 0.5;
              if (isHomeScoring) {
                nextHomeScore++;
                nextScorers.push({
                  name: `⚽ Goal! ${match.homeTeam.name}`,
                  teamId: match.homeTeam.id,
                  min: nextMinute
                });
                nextEvent = `⚽ GOAL FOR ${match.homeTeam.name.toUpperCase()}! Grand stadium uproar! (${nextHomeScore}-${nextAwayScore})`;
              } else {
                nextAwayScore++;
                nextScorers.push({
                  name: `⚽ Goal! ${match.awayTeam.name}`,
                  teamId: match.awayTeam.id,
                  min: nextMinute
                });
                nextEvent = `⚽ GOAL FOR ${match.awayTeam.name.toUpperCase()}! Red alert crowd! (${nextHomeScore}-${nextAwayScore})`;
              }
            } else if (rand > 0.95) {
              nextEvent = `🟨 Yellow Card issued for hard tackles!`;
            }
          }

          return {
            ...match,
            minute: nextMinute,
            homeScore: nextHomeScore,
            awayScore: nextAwayScore,
            gameEvent: nextEvent,
            scorers: nextScorers
          };
        });
      });
    }, 12000);

    return () => clearInterval(interval);
  }, [activeMatches]);

  // Save Supported Teams Selection to Firestore
  const saveSupportedSelection = async () => {
    // If no teams were selected, default to 'usa' and 'mar' to keep onboarding valid
    const teamsToSave = supportedTeams.length > 0 ? supportedTeams : ['usa', 'mar'];
    
    // Default theme based on first supported country flags or classic-wc
    const firstCountry = WC_COUNTRIES.find(c => c.id === teamsToSave[0]);
    const preferredTheme = firstCountry ? `theme-${firstCountry.id}` : 'theme-classic-wc';

    const cleanPreferences = {
      ...userPreferences,
      supportedCountries: teamsToSave,
      theme: preferredTheme,
      language: appLanguage
    };

    setIsRefreshingMatches(true);
    await onUpdatePreferences(cleanPreferences);
    setIsRefreshingMatches(false);
    setShowOnboarding(false);
  };

  const toggleCountrySupport = (countryId: string) => {
    setSupportedTeams(prev => {
      if (prev.includes(countryId)) {
        return prev.filter(id => id !== countryId);
      } else {
        return [...prev, countryId];
      }
    });
  };

  const confederations = ['ALL', 'UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];

  const filteredCountries = WC_COUNTRIES.filter(country => {
    const matchesSearch = (country.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) || 
                          country.nameAr.includes(searchQuery);
    const matchesConf = selectedConfederation === 'ALL' || country.confederation === selectedConfederation;
    return matchesSearch && matchesConf;
  });

  return (
    <div className="w-full h-full flex flex-col relative" dir={appLanguage === 'ar' ? 'rtl' : 'ltr'}>
      {/* Onboarding selector - Triggers on first join */}
      <AnimatePresence>
        {showOnboarding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/95 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl p-6 sm:p-10 shadow-2xl relative flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-yellow-400 to-rose-500 rounded-2xl shadow-lg">
                    <Trophy className="w-8 h-8 text-white animate-bounce" />
                  </div>
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-rose-500 to-emerald-400">
                      {t.selectCountriesTitle}
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">{t.selectCountriesDesc}</p>
                  </div>
                </div>
                
                {/* Language Switch inside Onboarding */}
                <button 
                  onClick={() => setAppLanguage(appLanguage === 'en' ? 'ar' : 'en')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 rounded-xl text-xs hover:bg-slate-700 transition-all font-mono"
                >
                  <Globe className="w-4 h-4 text-emerald-400" />
                  {appLanguage === 'en' ? 'العربية' : 'English'}
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {confederations.map(conf => (
                    <button
                      key={conf}
                      onClick={() => setSelectedConfederation(conf)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                        selectedConfederation === conf 
                          ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-md' 
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-750'
                      }`}
                    >
                      {conf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Grid */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-2 mb-6 custom-scrollbar min-h-[250px]">
                {filteredCountries.map(country => {
                  const isSelected = supportedTeams.includes(country.id);
                  return (
                    <button
                      key={country.id}
                      onClick={() => toggleCountrySupport(country.id)}
                      className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between h-24 group ${
                        isSelected 
                          ? 'bg-gradient-to-br from-slate-800 to-slate-850 border-emerald-550 shadow-lg shadow-emerald-500/10' 
                          : 'bg-slate-850 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <span className="text-3xl filter drop-shadow">{country.flag}</span>
                        {isSelected && (
                          <span className="w-5 h-5 bg-emerald-550 rounded-full flex items-center justify-center text-white scale-110 shadow-lg shadow-emerald-500/20">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-right w-full">
                        <p className="text-xs font-black text-white truncate">{appLanguage === 'ar' ? country.nameAr : country.name}</p>
                        <p className="text-[9px] text-slate-500 font-mono tracking-widest">{country.confederation}</p>
                      </div>
                      <div className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${country.colors.primary} opacity-30 group-hover:opacity-73 transition-all`}></div>
                    </button>
                  );
                })}
              </div>

              {/* Classic World Cup Theme Toggle inside onboarding list */}
              <div className="mt-2 mb-6 p-4 bg-gradient-to-r from-slate-850 to-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚽</span>
                  <div>
                    <h4 className="text-sm font-black text-white">{t.classicTheme}</h4>
                    <p className="text-xs text-slate-500">Enable Red, Green, and Blue stadium colors</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const classicId = 'classic-wc';
                    setSupportedTeams(prev => prev.includes(classicId) ? prev : [...prev, classicId]);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    supportedTeams.includes('classic-wc')
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {supportedTeams.includes('classic-wc') ? 'Activated' : 'Activate'}
                </button>
              </div>

              {/* Action Button */}
              <div className="flex justify-end gap-3 border-t border-slate-800 pt-5">
                <button
                  onClick={saveSupportedSelection}
                  disabled={isRefreshingMatches}
                  className="px-8 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-500 hover:from-emerald-450 hover:to-blue-450 text-white font-black text-sm uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                >
                  {isRefreshingMatches ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Trophy className="w-4 h-4" />
                  )}
                  {t.saveSelection}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flag Security Vault Key mismatched self-healing warning */}
      {showHealMessage && onHealKeys && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border-b border-amber-500/25 p-4 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-md relative z-10"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <h4 className="text-xs font-bold text-amber-400">{t.keyMismatchTitle}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{t.keyMismatchDesc}</p>
            </div>
          </div>
          <button
            onClick={onHealKeys}
            className="px-4 py-2 bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-400 transition-all shadow-md shrink-0 focus:ring-2 focus:ring-amber-500"
          >
            {t.healKeys}
          </button>
        </motion.div>
      )}

      {/* Main World Cup Matches Panel */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 p-5 rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                {t.matchCenterTitle}
              </h3>
              <p className="text-xs text-slate-400">{t.welcome} {t.supportedHeader}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-4 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-bold text-white hover:bg-slate-750 transition-all flex items-center gap-1.5"
            >
              <Flag className="w-4 h-4 text-rose-450" />
              {t.selectSupported}
            </button>
            <button 
              onClick={() => setAppLanguage(appLanguage === 'en' ? 'ar' : 'en')}
              className="px-4 py-2 bg-slate-800 border border-slate-700/80 rounded-xl text-xs font-mono font-bold text-emerald-400 hover:bg-slate-750 transition-all flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" />
              {appLanguage === 'en' ? 'العربية' : 'English'}
            </button>
          </div>
        </div>

        {/* Matches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeMatches.length === 0 ? (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 border border-slate-800 border-dashed rounded-2xl bg-slate-900/10">
              <Tv className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-sm font-medium">{t.noSupportedTeams}</p>
            </div>
          ) : (
            activeMatches.map((match) => {
              const isLive = match.status === 'LIVE';
              const isFinished = match.status === 'FINISHED';
              
              return (
                <div 
                  key={match.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition-all"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">{match.group}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase flex items-center gap-1 font-mono ${
                      isLive 
                        ? 'bg-rose-500/15 text-rose-500 animate-pulse border border-rose-500/20' 
                        : isFinished 
                          ? 'bg-slate-850 text-slate-400 border border-slate-800' 
                          : 'bg-emerald-555/15 text-emerald-450 border border-emerald-500/20'
                    }`}>
                      {isLive && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span>}
                      {isLive ? `${t.live} • ${match.minute}'` : isFinished ? t.finished : t.scheduled}
                    </span>
                  </div>

                  {/* Teams and Score */}
                  <div className="flex items-center justify-between py-2 relative z-10">
                    {/* Home Team */}
                    <div className="flex flex-col items-center text-center w-5/12 overflow-hidden gap-1">
                      <span className="text-4xl filter drop-shadow-md transform group-hover:scale-110 transition-all duration-300">{match.homeTeam.flag}</span>
                      <span className="text-xs font-black text-white truncate max-w-full">
                        {appLanguage === 'ar' ? match.homeTeam.nameAr : match.homeTeam.name}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-mono">{match.homeTeam.confederation}</span>
                    </div>

                    {/* VS / Score Core */}
                    <div className="flex flex-col items-center w-2/12">
                      {isFinished || isLive ? (
                        <div className="flex gap-2.5 items-center">
                          <span className="text-2xl font-black text-white">{match.homeScore}</span>
                          <span className="text-slate-600 font-bold">:</span>
                          <span className="text-2xl font-black text-white">{match.awayScore}</span>
                        </div>
                      ) : (
                        <div className="p-1 px-3 bg-slate-800 rounded-lg text-[10px] font-black text-emerald-400 font-mono tracking-widest">
                          VS
                        </div>
                      )}
                    </div>

                    {/* Away Team */}
                    <div className="flex flex-col items-center text-center w-5/12 overflow-hidden gap-1">
                      <span className="text-4xl filter drop-shadow-md transform group-hover:scale-110 transition-all duration-300">{match.awayTeam.flag}</span>
                      <span className="text-xs font-black text-white truncate max-w-full">
                        {appLanguage === 'ar' ? match.awayTeam.nameAr : match.awayTeam.name}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-mono">{match.awayTeam.confederation}</span>
                    </div>
                  </div>

                  {/* Dynamic Match Events/Scorers */}
                  {(match.scorers.length > 0 || match.gameEvent) && (
                    <div className="mt-4 pt-3 border-t border-slate-800/70 text-[10px] space-y-1 text-slate-400 relative z-10">
                      {match.scorers.map((sc, scIdx) => (
                        <div key={scIdx} className="flex justify-between items-center font-mono">
                          <span>{sc.name}</span>
                          <span>{sc.min}'</span>
                        </div>
                      ))}
                      {match.gameEvent && (
                        <p className="text-[9px] text-emerald-400 italic font-medium pt-1 animate-pulse">
                          {match.gameEvent}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Theme Quick Action */}
                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                    <span className="text-[9px] text-slate-500 italic">Apply themed interface</span>
                    <button
                      onClick={async () => {
                        const customTheme = `theme-${match.homeTeam.id}`;
                        await onUpdatePreferences({
                          ...userPreferences,
                          theme: customTheme
                        });
                      }}
                      className="px-2.5 py-1 bg-slate-800/60 border border-slate-700/50 rounded-lg text-[9px] font-black uppercase tracking-wider text-slate-300 hover:bg-slate-700 transition-all"
                    >
                      Theme
                    </button>
                  </div>

                  {/* Elegant bottom flag lines */}
                  <div className="absolute bottom-0 inset-x-0 h-0.5 flex opacity-20 group-hover:opacity-60 transition-all">
                    <div className={`flex-1 h-full bg-gradient-to-r ${match.homeTeam.colors.primary}`}></div>
                    <div className={`flex-1 h-full bg-gradient-to-r ${match.awayTeam.colors.primary}`}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
