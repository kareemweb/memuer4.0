import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Users, Settings, Plus, Search, Phone, Video, Shield, Info, Paperclip, Smile, Send, MoveVertical as MoreVertical, LogOut, User, Camera, Image as ImageIcon, Check, X, Menu, PhoneOff, Mic, MicOff, VideoOff, Volume2, VolumeX, UserX, Copy, Lock, ArrowLeft, ArrowRight, MonitorUp, TriangleAlert as AlertTriangle, FileSliders as Sliders, Wrench, Clock, Archive, Radio, RefreshCw, Mail, ShieldAlert, ShieldCheck, Pin, Eye, EyeOff, Sparkles, Play, MapPin, History, Globe, Headphones, PhoneCall, ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from './i18n/LanguageContext';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useAuth } from './hooks/useAuth';
import { usePeer } from './hooks/usePeer';
import { db, auth, handleFirestoreError, OperationType, isDefaultSandbox } from './lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, doc, setDoc, orderBy, limit, 
  getDocs, getDoc, updateDoc, deleteDoc,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { ChatSession, Message as MessageType, UserProfile, FriendRequest } from './types';
import { 
  encryptMessage, decryptMessage, getStoredKeyPair, generateKeyPair, storeKeyPair,
  generateSymmetricKey, encryptSymmetric, decryptSymmetric 
} from './lib/crypto';
import { askAI } from './lib/gemini';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { VoiceMessagePlayer } from './components/VoiceMessagePlayer';
import { useWorldCup } from './context/WorldCupContext';
import { WorldCupMatchTracker } from './components/WorldCupMatchTracker';
import { MemuerSocial } from './components/MemuerSocial';
import { CyberStarsBackground } from './components/CyberStarsBackground';
import { CallCenterAdminPanel } from './components/CallCenterAdminPanel';
import { CallCenterCallScreen } from './components/CallCenterCallScreen';
import { FloatingCallCenter } from './components/FloatingCallCenter';
import { createClient } from '@supabase/supabase-js';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function createBlankVideoTrack(width = 640, height = 480) {
  if (typeof document === 'undefined') return null;
  const canvas = Object.assign(document.createElement("canvas"), { width, height });
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#121214";
    ctx.fillRect(0, 0, width, height);
  }
  const stream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : (canvas as any).mozCaptureStream ? (canvas as any).mozCaptureStream(15) : null;
  return stream ? stream.getVideoTracks()[0] : null;
}

function isTextFile(name: string, mimeType?: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mimeType?.startsWith('text/')) return true;
  return ['txt', 'json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'md', 'csv', 'yaml', 'yml', 'xml', 'log', 'ini', 'sh', 'py', 'java', 'cpp', 'c', 'h'].includes(ext);
}

function isPdfFile(name: string, mimeType?: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return mimeType === 'application/pdf' || ext === 'pdf';
}

function isOfficeFile(name: string, mimeType?: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) || 
         mimeType?.includes('wordprocessingml') || 
         mimeType?.includes('spreadsheetml') || 
         mimeType?.includes('presentationml') || 
         mimeType?.includes('ms-word') || 
         mimeType?.includes('ms-excel') || 
         mimeType?.includes('ms-powerpoint');
}

function UserRoleBadge({ role, email }: { role?: string; email?: string }) {
  const normalizedRole = role?.toLowerCase();
  const isHeadOwner = email === 'koke.kozkoz@gmail.com' || normalizedRole === 'headowner';
  
  if (isHeadOwner) {
    return (
      <span className="inline-flex items-center text-transparent bg-clip-text bg-gradient-to-r from-red-400 via-pink-400 via-purple-400 via-cyan-400 via-yellow-400 via-red-400 bg-[length:200%_auto] animate-rainbow-shift font-black uppercase tracking-wider text-[9px] drop-shadow-[0_0_8px_rgba(236,72,153,0.85)] px-2 py-0.5 rounded-full border border-pink-500/30 bg-pink-950/20 shrink-0 select-none">
        Head Owner
      </span>
    );
  }
  
  if (normalizedRole === 'owner') {
    return (
      <span className="inline-flex items-center text-cyan-400 font-black uppercase tracking-wider text-[9px] drop-shadow-[0_0_6px_rgba(34,211,238,0.8)] border border-cyan-400/30 bg-cyan-950/40 px-2 py-0.5 rounded-full shrink-0 select-none">
        Owner
      </span>
    );
  }
  
  if (normalizedRole === 'admin') {
    return (
      <span className="inline-flex items-center text-rose-500 font-black uppercase tracking-wider text-[9px] drop-shadow-[0_0_6px_rgba(244,63,94,0.8)] border border-rose-500/30 bg-rose-950/45 px-2 py-0.5 rounded-full shrink-0 select-none">
        Admin
      </span>
    );
  }
  
  if (normalizedRole === 'tester') {
    return (
      <span className="inline-flex items-center text-amber-500 font-black uppercase tracking-wider text-[9px] drop-shadow-[0_0_6px_rgba(245,158,11,0.8)] border border-amber-500/30 bg-amber-950/45 px-2 py-0.5 rounded-full shrink-0 select-none">
        Tester
      </span>
    );
  }
  
  return null;
}

function ComingSoonTimer({ targetDate }: { targetDate?: string }) {
  const { isAr } = useLanguage();
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    let targetTime = targetDate ? new Date(targetDate).getTime() : 0;
    
    if (isNaN(targetTime) || targetTime <= Date.now()) {
      // Default countdown limit: 3 days, 16 hours, 45 minutes from current moment so it's always running beautifully
      targetTime = Date.now() + 3 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000 + 45 * 60 * 1000;
    }

    const updateTimer = () => {
      const now = Date.now();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!timeLeft) return null;

  const timerItems = [
    { label: isAr ? 'أيام' : 'Days', value: timeLeft.days, color: 'from-emerald-400 to-teal-400' },
    { label: isAr ? 'ساعات' : 'Hours', value: timeLeft.hours, color: 'from-cyan-400 to-blue-400' },
    { label: isAr ? 'دقائق' : 'Mins', value: timeLeft.minutes, color: 'from-indigo-400 to-purple-400' },
    { label: isAr ? 'ثواني' : 'Secs', value: timeLeft.seconds, color: 'from-pink-400 to-rose-400', isPulse: true },
  ];

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-4 gap-3 max-w-[360px] mx-auto">
        {timerItems.map((item, idx) => (
          <motion.div
            key={idx}
            whileHover={{ scale: 1.08 }}
            className="p-2 flex flex-col items-center relative overflow-hidden"
          >
            {item.isPulse && (
              <div className="absolute inset-0 bg-pink-500/10 animate-pulse pointer-events-none rounded-2xl" />
            )}
            
            <AnimatePresence mode="popLayout">
              <motion.span
                key={item.value}
                initial={{ y: -8, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 8, opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                className={`text-2xl sm:text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-b ${item.color} drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]`}
              >
                {String(item.value).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
            
            <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono tracking-widest mt-1">
              {item.label}
            </span>
          </motion.div>
        ))}
      </div>

      {targetDate && (
        <motion.span 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[9px] text-zinc-400 font-mono block tracking-wider text-center"
        >
          {isAr ? 'موعد الإطلاق المستهدف: ' : 'Target Launch: '} 
          <span className="text-indigo-300 font-bold">
            {new Date(targetDate).toLocaleDateString()} {isAr ? 'الساعة' : 'at'} {new Date(targetDate).toLocaleTimeString()}
          </span>
        </motion.span>
      )}
    </div>
  );
}

function ComingSoonSubscribeSection({ isAr }: { isAr: boolean }) {
  const [subscribed, setSubscribed] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
  };

  return (
    <div className="pt-2 max-w-sm mx-auto w-full">
      {subscribed ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center gap-2 text-emerald-400 text-xs font-bold font-mono"
        >
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{isAr ? 'تم تسجيل طلب الإشعار بنجاح! سنقوم بتنبيهك فور الإطلاق.' : 'Notification protocol registered! We will ping you on launch.'}</span>
        </motion.div>
      ) : (
        <form onSubmit={handleSubscribe} className="flex gap-2">
          <input
            type="email"
            required
            placeholder={isAr ? "أدخل بريدك الإلكتروني للتنبيه..." : "Enter email for launch ping..."}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="flex-1 bg-white/5 border border-white/15 rounded-full px-4 py-2.5 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-cyan-400 transition-colors font-mono"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            className="px-5 py-2.5 bg-gradient-to-r from-pink-500 via-indigo-600 to-cyan-500 text-white rounded-full text-xs font-bold font-mono hover:opacity-90 transition-opacity flex items-center gap-1.5 shrink-0 cursor-pointer shadow-lg shadow-pink-500/20"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isAr ? 'تنبيهي' : 'Notify Me'}</span>
          </motion.button>
        </form>
      )}
    </div>
  );
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function App() {
  const { 
    user, loading, error: authError, setError: setAuthError, 
    login, loginWithEmail, registerWithEmail, logout,
    resetPassword, resetEmailSent 
  } = useAuth();

  const { language, setLanguage, t, isRTL, dir } = useLanguage();
  const isAr = language === 'ar';

  const isWcThemeActive = false;

  const themeStyles: Record<string, {
    bg: string;
    sidebar: string;
    sidebarMobile: string;
    rail: string;
    tabChats: string;
    tabDirectory: string;
    tabSignals: string;
    accentText: string;
    accentBg: string;
    bubbleMe: string;
    bubbleOther: string;
    inputRing: string;
  }> = {
    vibrant: {
      bg: "bg-[#080212]",
      sidebar: "lg:bg-[#120524]/70 border-r border-purple-500/20 backdrop-blur-3xl",
      sidebarMobile: "bg-[#080212]/98 backdrop-blur-3xl",
      rail: "bg-black/70 border-r border-purple-500/10",
      tabChats: "bg-purple-600 text-white font-bold",
      tabDirectory: "bg-fuchsia-600 text-white font-bold",
      tabSignals: "bg-indigo-600 text-white font-bold",
      accentText: "text-purple-400",
      accentBg: "bg-purple-500/15 border border-purple-500/30 text-purple-300",
      bubbleMe: "bg-gradient-to-r from-purple-600/40 via-fuchsia-600/35 to-indigo-600/40 border border-purple-400/40 text-purple-50 shadow-[0_4px_30px_rgba(168,85,247,0.25)] backdrop-blur-2xl rounded-2xl rounded-br-sm font-medium",
      bubbleOther: "bg-[#17082e]/70 border border-purple-500/15 text-purple-100 shadow-xl backdrop-blur-2xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-purple-500/40"
    },
    midnight: {
      bg: "bg-[#02040b]",
      sidebar: "lg:bg-[#070b18]/70 border-r border-blue-500/20 backdrop-blur-3xl",
      sidebarMobile: "bg-[#02040b]/98 backdrop-blur-3xl",
      rail: "bg-[#010206]/85 border-r border-blue-500/10",
      tabChats: "bg-blue-600 text-white font-bold",
      tabDirectory: "bg-sky-600 text-white font-bold",
      tabSignals: "bg-indigo-600 text-white font-bold",
      accentText: "text-sky-400",
      accentBg: "bg-sky-500/15 border border-sky-500/30 text-sky-300",
      bubbleMe: "bg-gradient-to-r from-blue-600/40 to-sky-600/40 border border-sky-400/40 text-sky-50 shadow-[0_4px_30px_rgba(56,189,248,0.25)] backdrop-blur-2xl rounded-2xl rounded-br-sm font-medium",
      bubbleOther: "bg-[#0b1124]/70 border border-blue-500/15 text-slate-100 shadow-xl backdrop-blur-2xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-sky-500/40"
    },
    forest: {
      bg: "bg-[#020c08]",
      sidebar: "lg:bg-[#04160f]/70 border-r border-emerald-500/20 backdrop-blur-3xl",
      sidebarMobile: "bg-[#020c08]/98 backdrop-blur-3xl",
      rail: "bg-black/70 border-r border-emerald-500/10",
      tabChats: "bg-emerald-500 text-emerald-950 font-bold",
      tabDirectory: "bg-teal-500 text-teal-950 font-bold",
      tabSignals: "bg-green-500 text-green-950 font-bold",
      accentText: "text-emerald-400",
      accentBg: "bg-emerald-500/15 border border-emerald-500/30 text-emerald-300",
      bubbleMe: "bg-gradient-to-r from-emerald-600/40 via-teal-600/35 to-green-600/40 border border-emerald-400/40 text-emerald-50 shadow-[0_4px_30px_rgba(16,185,129,0.25)] backdrop-blur-2xl rounded-2xl rounded-br-sm font-medium",
      bubbleOther: "bg-[#071d14]/70 border border-emerald-500/15 text-emerald-100 shadow-xl backdrop-blur-2xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-emerald-500/40"
    },
    crimson: {
      bg: "bg-[#0e0206]",
      sidebar: "lg:bg-[#1a040d]/70 border-r border-rose-500/20 backdrop-blur-3xl",
      sidebarMobile: "bg-[#0e0206]/98 backdrop-blur-3xl",
      rail: "bg-black/70 border-r border-rose-500/10",
      tabChats: "bg-rose-600 text-white font-bold",
      tabDirectory: "bg-red-600 text-white font-bold",
      tabSignals: "bg-pink-600 text-white font-bold",
      accentText: "text-rose-400",
      accentBg: "bg-rose-500/15 border border-rose-500/30 text-rose-300",
      bubbleMe: "bg-gradient-to-r from-rose-600/40 via-pink-600/35 to-red-600/40 border border-rose-400/40 text-rose-50 shadow-[0_4px_30px_rgba(244,63,94,0.25)] backdrop-blur-2xl rounded-2xl rounded-br-sm font-medium",
      bubbleOther: "bg-[#220713]/70 border border-rose-500/15 text-rose-100 shadow-xl backdrop-blur-2xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-rose-500/40"
    },
    liquidglass: {
      bg: "bg-[#020712]",
      sidebar: "lg:liquid-glass-panel border-r border-cyan-500/15 rounded-none rounded-r-[32px] my-2 mr-2 backdrop-blur-3xl",
      sidebarMobile: "bg-[#020712]/95 backdrop-blur-3xl",
      rail: "bg-transparent",
      tabChats: "bg-cyan-500 text-slate-950 font-bold",
      tabDirectory: "bg-teal-500 text-slate-950 font-bold",
      tabSignals: "bg-sky-500 text-slate-950 font-bold",
      accentText: "text-cyan-400",
      accentBg: "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300",
      bubbleMe: "bg-gradient-to-r from-cyan-600/40 via-teal-600/35 to-sky-600/40 border border-cyan-400/40 text-cyan-50 shadow-[0_4px_30px_rgba(6,182,212,0.25)] backdrop-blur-2xl rounded-2xl rounded-br-sm font-medium",
      bubbleOther: "bg-slate-900/60 border border-cyan-500/20 text-slate-100 shadow-xl backdrop-blur-2xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-cyan-400/40"
    },
    luxury: {
      bg: "bg-luxury text-amber-50",
      sidebar: "lg:luxury-panel border-r-0 rounded-none rounded-r-[36px] my-4 mr-4",
      sidebarMobile: "bg-[#050505]/98 border-r border-amber-500/20 backdrop-blur-3xl",
      rail: "bg-transparent",
      tabChats: "bg-amber-600 text-amber-950 font-bold",
      tabDirectory: "bg-amber-700 text-amber-50 font-bold",
      tabSignals: "bg-yellow-600 text-amber-950 font-bold",
      accentText: "text-amber-400",
      accentBg: "bg-amber-500/10 border border-amber-500/20 text-amber-400",
      bubbleMe: "bg-gradient-to-br from-amber-600/40 to-yellow-600/40 border border-amber-400/40 text-[#fcfbf8] font-medium shadow-lg shadow-amber-500/10 backdrop-blur-xl rounded-2xl rounded-br-sm",
      bubbleOther: "bg-[#141414]/90 border border-amber-500/20 text-amber-100 shadow-md backdrop-blur-xl rounded-2xl rounded-bl-sm",
      inputRing: "ring-amber-500/40"
    }
  };

  const [localTheme, setLocalTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('memuer_theme') || 'liquidglass';
    } catch {
      return 'liquidglass';
    }
  });

  const themeName = user?.preferences?.theme || localTheme || 'liquidglass';
  const isThemeAnimated = themeName === 'luxury' ? false : (themeName === 'liquidglass' ? true : user?.preferences?.animatedTheme !== false);
  const animationLook = user?.preferences?.animationLook || (
    themeName === 'midnight' ? 'cyber' :
    themeName === 'forest' ? 'nebula' :
    themeName === 'crimson' ? 'lava' : 'aurora'
  );
  const starsSpeed = user?.preferences?.starsSpeed || 2;
  // Cyber stars effect is active for Aurora look (or when Cyber Stars is explicitly enabled)
  const isCyberStarsActive = themeName !== 'luxury' && isThemeAnimated && (animationLook === 'aurora' || user?.preferences?.enableCyberStars === true);
  const cursorFollowStars = user?.preferences?.cursorFollowStars ?? true;
  const touchSparkles = user?.preferences?.touchSparkles ?? true;

  const getThemeModalClasses = () => {
    switch (themeName) {
      case 'luxury':
        return {
          overlay: 'bg-black/85 backdrop-blur-md',
          card: 'bg-[#121212]/95 border border-amber-500/40 text-amber-50 shadow-[0_0_50px_rgba(212,175,55,0.22)]',
          headerText: 'text-amber-400 font-bold',
          subText: 'text-amber-200/70',
          accentPill: 'bg-amber-500/20 border-amber-500/35 text-amber-300',
          primaryBtn: 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-500 text-amber-950 font-black hover:brightness-110 shadow-lg shadow-amber-950/40',
          secondaryBtn: 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25',
          inputBg: 'bg-black/70 border-amber-500/30 text-amber-100 placeholder-amber-400/40 focus:ring-2 focus:ring-amber-500/50',
          itemCard: 'bg-amber-950/25 border-amber-500/20 hover:bg-amber-950/45 text-amber-100',
          closeBtn: 'hover:bg-amber-500/20 text-amber-400 hover:text-amber-200',
          accentBorder: 'border-amber-500/30',
          accentText: 'text-amber-400',
          accentBg: 'bg-amber-500/15 text-amber-300'
        };
      case 'midnight':
        return {
          overlay: 'bg-[#010206]/85 backdrop-blur-md',
          card: 'bg-[#070b18]/95 border border-blue-500/30 text-sky-50 shadow-[0_0_50px_rgba(37,99,235,0.25)]',
          headerText: 'text-sky-400 font-bold',
          subText: 'text-sky-200/70',
          accentPill: 'bg-blue-500/20 border-blue-500/35 text-sky-300',
          primaryBtn: 'bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600 text-white font-black hover:brightness-110 shadow-lg shadow-blue-950/40',
          secondaryBtn: 'bg-blue-500/15 border-blue-500/30 text-sky-300 hover:bg-blue-500/25',
          inputBg: 'bg-slate-950/70 border-blue-500/30 text-white placeholder-sky-400/40 focus:ring-2 focus:ring-sky-400/50',
          itemCard: 'bg-blue-950/30 border-blue-500/20 hover:bg-blue-950/50 text-sky-100',
          closeBtn: 'hover:bg-blue-500/20 text-sky-400 hover:text-white',
          accentBorder: 'border-blue-500/30',
          accentText: 'text-sky-400',
          accentBg: 'bg-blue-500/15 text-sky-300'
        };
      case 'forest':
        return {
          overlay: 'bg-[#010805]/85 backdrop-blur-md',
          card: 'bg-[#04160f]/95 border border-emerald-500/30 text-emerald-50 shadow-[0_0_50px_rgba(16,185,129,0.25)]',
          headerText: 'text-emerald-400 font-bold',
          subText: 'text-emerald-200/70',
          accentPill: 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300',
          primaryBtn: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-emerald-950 font-black hover:brightness-110 shadow-lg shadow-emerald-950/40',
          secondaryBtn: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25',
          inputBg: 'bg-emerald-950/60 border-emerald-500/30 text-white placeholder-emerald-400/40 focus:ring-2 focus:ring-emerald-400/50',
          itemCard: 'bg-emerald-950/30 border-emerald-500/20 hover:bg-emerald-950/50 text-emerald-100',
          closeBtn: 'hover:bg-emerald-500/20 text-emerald-400 hover:text-white',
          accentBorder: 'border-emerald-500/30',
          accentText: 'text-emerald-400',
          accentBg: 'bg-emerald-500/15 text-emerald-300'
        };
      case 'crimson':
        return {
          overlay: 'bg-[#080104]/85 backdrop-blur-md',
          card: 'bg-[#1a040d]/95 border border-rose-500/30 text-rose-50 shadow-[0_0_50px_rgba(244,63,94,0.25)]',
          headerText: 'text-rose-400 font-bold',
          subText: 'text-rose-200/70',
          accentPill: 'bg-rose-500/20 border-rose-500/35 text-rose-300',
          primaryBtn: 'bg-gradient-to-r from-rose-600 via-pink-600 to-red-600 text-white font-black hover:brightness-110 shadow-lg shadow-rose-950/40',
          secondaryBtn: 'bg-rose-500/15 border-rose-500/30 text-rose-300 hover:bg-rose-500/25',
          inputBg: 'bg-rose-950/60 border-rose-500/30 text-white placeholder-rose-400/40 focus:ring-2 focus:ring-rose-400/50',
          itemCard: 'bg-rose-950/30 border-rose-500/20 hover:bg-rose-950/50 text-rose-100',
          closeBtn: 'hover:bg-rose-500/20 text-rose-400 hover:text-white',
          accentBorder: 'border-rose-500/30',
          accentText: 'text-rose-400',
          accentBg: 'bg-rose-500/15 text-rose-300'
        };
      case 'vibrant':
        return {
          overlay: 'bg-[#090214]/85 backdrop-blur-md',
          card: 'bg-[#150729]/95 border border-purple-500/30 text-purple-50 shadow-[0_0_50px_rgba(168,85,247,0.25)]',
          headerText: 'text-purple-400 font-bold',
          subText: 'text-purple-200/70',
          accentPill: 'bg-purple-500/20 border-purple-500/35 text-purple-300',
          primaryBtn: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white font-black hover:brightness-110 shadow-lg shadow-purple-950/40',
          secondaryBtn: 'bg-purple-500/15 border-purple-500/30 text-purple-300 hover:bg-purple-500/25',
          inputBg: 'bg-purple-950/60 border-purple-500/30 text-white placeholder-purple-400/40 focus:ring-2 focus:ring-purple-400/50',
          itemCard: 'bg-purple-950/30 border-purple-500/20 hover:bg-purple-950/50 text-purple-100',
          closeBtn: 'hover:bg-purple-500/20 text-purple-400 hover:text-white',
          accentBorder: 'border-purple-500/30',
          accentText: 'text-purple-400',
          accentBg: 'bg-purple-500/15 text-purple-300'
        };
      case 'liquidglass':
      default:
        return {
          overlay: 'bg-[#010612]/85 backdrop-blur-md',
          card: 'liquid-glass-panel bg-[#020712]/95 border border-cyan-500/30 text-cyan-50 shadow-[0_0_50px_rgba(6,182,212,0.25)]',
          headerText: 'text-cyan-400 font-bold',
          subText: 'text-cyan-200/70',
          accentPill: 'bg-cyan-500/20 border-cyan-500/35 text-cyan-300',
          primaryBtn: 'bg-gradient-to-r from-cyan-500 via-teal-500 to-sky-500 text-slate-950 font-black hover:brightness-110 shadow-lg shadow-cyan-950/40',
          secondaryBtn: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25',
          inputBg: 'bg-slate-950/70 border-cyan-500/30 text-white placeholder-cyan-400/40 focus:ring-2 focus:ring-cyan-400/50',
          itemCard: 'bg-cyan-950/30 border-cyan-500/20 hover:bg-cyan-950/50 text-cyan-100',
          closeBtn: 'hover:bg-cyan-500/20 text-cyan-400 hover:text-white',
          accentBorder: 'border-cyan-500/30',
          accentText: 'text-cyan-400',
          accentBg: 'bg-cyan-500/15 text-cyan-300'
        };
    }
  };

  const getThemeLoadingStyles = () => {
    switch (themeName) {
      case 'luxury':
        return {
          glow: 'rgba(212, 175, 55, 0.4)',
          outerRing: 'border-amber-500/40 border-t-amber-300 border-b-yellow-500/30',
          innerPulseRing: 'border-amber-400/25 bg-amber-500/10',
          emblemBg: 'bg-[#141414]/90 border border-amber-400/40 shadow-[0_0_35px_rgba(212,175,55,0.35)]',
          emblemIcon: 'text-amber-400',
          titleGradient: 'from-amber-200 via-yellow-400 to-amber-300',
          subText: 'text-amber-200/80',
          progressBar: 'from-amber-500 via-yellow-400 to-amber-600',
          dotColor: 'bg-amber-400',
          badge: 'bg-amber-500/20 border-amber-500/40 text-amber-300'
        };
      case 'midnight':
        return {
          glow: 'rgba(37, 99, 235, 0.4)',
          outerRing: 'border-blue-500/40 border-t-sky-400 border-b-indigo-500/30',
          innerPulseRing: 'border-sky-400/25 bg-blue-500/10',
          emblemBg: 'bg-[#070b18]/90 border border-blue-400/40 shadow-[0_0_35px_rgba(37,99,235,0.35)]',
          emblemIcon: 'text-sky-400',
          titleGradient: 'from-sky-200 via-blue-400 to-indigo-300',
          subText: 'text-sky-200/80',
          progressBar: 'from-blue-500 via-sky-400 to-indigo-600',
          dotColor: 'bg-sky-400',
          badge: 'bg-blue-500/20 border-blue-500/40 text-sky-300'
        };
      case 'forest':
        return {
          glow: 'rgba(16, 185, 129, 0.4)',
          outerRing: 'border-emerald-500/40 border-t-teal-300 border-b-green-500/30',
          innerPulseRing: 'border-emerald-400/25 bg-emerald-500/10',
          emblemBg: 'bg-[#04160f]/90 border border-emerald-400/40 shadow-[0_0_35px_rgba(16,185,129,0.35)]',
          emblemIcon: 'text-emerald-400',
          titleGradient: 'from-emerald-200 via-teal-300 to-green-300',
          subText: 'text-emerald-200/80',
          progressBar: 'from-emerald-500 via-teal-400 to-green-600',
          dotColor: 'bg-emerald-400',
          badge: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
        };
      case 'crimson':
        return {
          glow: 'rgba(244, 63, 94, 0.4)',
          outerRing: 'border-rose-500/40 border-t-pink-400 border-b-red-500/30',
          innerPulseRing: 'border-rose-400/25 bg-rose-500/10',
          emblemBg: 'bg-[#1a040d]/90 border border-rose-400/40 shadow-[0_0_35px_rgba(244,63,94,0.35)]',
          emblemIcon: 'text-rose-400',
          titleGradient: 'from-rose-200 via-pink-400 to-red-300',
          subText: 'text-rose-200/80',
          progressBar: 'from-rose-500 via-pink-400 to-red-600',
          dotColor: 'bg-rose-400',
          badge: 'bg-rose-500/20 border-rose-500/40 text-rose-300'
        };
      case 'vibrant':
        return {
          glow: 'rgba(168, 85, 247, 0.4)',
          outerRing: 'border-purple-500/40 border-t-fuchsia-400 border-b-indigo-500/30',
          innerPulseRing: 'border-purple-400/25 bg-purple-500/10',
          emblemBg: 'bg-[#150729]/90 border border-purple-400/40 shadow-[0_0_35px_rgba(168,85,247,0.35)]',
          emblemIcon: 'text-purple-400',
          titleGradient: 'from-purple-200 via-fuchsia-400 to-pink-300',
          subText: 'text-purple-200/80',
          progressBar: 'from-purple-500 via-fuchsia-400 to-indigo-600',
          dotColor: 'bg-purple-400',
          badge: 'bg-purple-500/20 border-purple-500/40 text-purple-300'
        };
      case 'liquidglass':
      default:
        return {
          glow: 'rgba(6, 182, 212, 0.4)',
          outerRing: 'border-cyan-500/40 border-t-teal-300 border-b-sky-500/30',
          innerPulseRing: 'border-cyan-400/25 bg-cyan-500/10',
          emblemBg: 'liquid-glass-panel bg-[#020712]/90 border border-cyan-400/40 shadow-[0_0_35px_rgba(6,182,212,0.35)]',
          emblemIcon: 'text-cyan-400',
          titleGradient: 'from-cyan-200 via-teal-300 to-sky-300',
          subText: 'text-cyan-200/80',
          progressBar: 'from-cyan-500 via-teal-400 to-sky-600',
          dotColor: 'bg-cyan-400',
          badge: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
        };
    }
  };

  const getAnimationClasses = () => {
    switch (animationLook) {
      case 'cyber':
        return {
          bgClass: 'animate-theme-gradient-cyber bg-[length:300%_300%]',
          orb1Class: 'animate-cyber-1',
          orb2Class: 'animate-cyber-2',
          orb3Class: 'animate-cyber-3',
          orbOpacity: 'opacity-80'
        };
      case 'lava':
        return {
          bgClass: 'animate-theme-gradient-lava bg-[length:300%_300%]',
          orb1Class: 'animate-lava-1',
          orb2Class: 'animate-lava-2',
          orb3Class: 'animate-lava-3',
          orbOpacity: 'opacity-85'
        };
      case 'nebula':
        return {
          bgClass: 'animate-theme-gradient-nebula bg-[length:300%_300%]',
          orb1Class: 'animate-nebula-1',
          orb2Class: 'animate-nebula-2',
          orb3Class: 'animate-nebula-3',
          orbOpacity: 'opacity-80'
        };
      case 'aurora':
      default:
        return {
          bgClass: 'animate-theme-gradient-aurora bg-[length:300%_300%]',
          orb1Class: 'animate-aurora-1',
          orb2Class: 'animate-aurora-2',
          orb3Class: 'animate-aurora-3',
          orbOpacity: 'opacity-75'
        };
    }
  };

  const getOrbColors = () => {
    switch (themeName) {
      case 'liquidglass':
        return {
          orb1: 'bg-teal-400',
          orb2: 'bg-cyan-400',
          orb3: 'bg-sky-400'
        };
      case 'midnight':
        return {
          orb1: 'bg-blue-600',
          orb2: 'bg-sky-400',
          orb3: 'bg-indigo-600'
        };
      case 'forest':
        return {
          orb1: 'bg-emerald-500',
          orb2: 'bg-teal-400',
          orb3: 'bg-green-400'
        };
      case 'crimson':
        return {
          orb1: 'bg-rose-500',
          orb2: 'bg-pink-500',
          orb3: 'bg-orange-500'
        };
      case 'vibrant':
      default:
        return {
          orb1: 'bg-purple-600',
          orb2: 'bg-fuchsia-500',
          orb3: 'bg-pink-500'
        };
    }
  };

  const renderAnimatedThemeBackground = () => {
    if (themeName === 'luxury' || !isThemeAnimated) return null;
    if (isCyberStarsActive) {
      return (
        <CyberStarsBackground 
          theme={themeName} 
          speed={starsSpeed} 
          cursorFollow={cursorFollowStars} 
          touchSparkles={touchSparkles} 
        />
      );
    }
    const orbColors = getOrbColors();
    const anim = getAnimationClasses();
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div 
          className={cn(
            "absolute -top-[12%] -left-[10%] w-[58vw] h-[58vh] rounded-full blur-[85px] filter transition-all duration-1000",
            orbColors.orb1,
            anim.orb1Class,
            anim.orbOpacity
          )} 
        />
        <div 
          className={cn(
            "absolute top-[25%] -right-[12%] w-[62vw] h-[62vh] rounded-full blur-[95px] filter transition-all duration-1000",
            orbColors.orb2,
            anim.orb2Class,
            anim.orbOpacity
          )} 
        />
        <div 
          className={cn(
            "absolute -bottom-[15%] left-[20%] w-[65vw] h-[65vh] rounded-full blur-[105px] filter transition-all duration-1000",
            orbColors.orb3,
            anim.orb3Class,
            anim.orbOpacity
          )} 
        />
      </div>
    );
  };

  const resolvedTheme = isWcThemeActive ? {
    bg: "bg-gradient-to-br from-indigo-950 via-indigo-900/40 to-indigo-950",
    sidebar: "lg:bg-indigo-950/45 border-r border-indigo-500/10",
    sidebarMobile: "bg-indigo-950/98",
    rail: "bg-black/40",
    tabChats: "bg-indigo-600",
    tabDirectory: "bg-cyan-600",
    tabSignals: "bg-violet-600",
    accentText: "text-indigo-400",
    accentBg: "bg-indigo-500/20",
    bubbleMe: "bg-indigo-600/35 border border-indigo-500/20 text-indigo-50",
    bubbleOther: "bg-white/5 border border-white/10 text-indigo-100",
    inputRing: "ring-indigo-500/30"
  } : (themeStyles[themeName] || themeStyles.vibrant);

  const currentTheme = {
    ...resolvedTheme,
    bg: isThemeAnimated 
      ? resolvedTheme.bg + " " + getAnimationClasses().bgClass
      : resolvedTheme.bg
  };

  const [activeChat, setActiveChat] = useState<ChatSession | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [contacts, setContacts] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [isAIActive, setIsAIActive] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedForGroup, setSelectedForGroup] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<{ name: string; url: string; size: number; isVideo: boolean } | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAddConnectionModalOpen, setIsAddConnectionModalOpen] = useState(false);
  const [showLocalLogin, setShowLocalLogin] = useState(false);
  const [localEmail, setLocalEmail] = useState('');
  const [localPassword, setLocalPassword] = useState('');
  const [localName, setLocalName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [notificationsPermission, setNotificationsPermission] = useState<NotificationPermission>('default');
  const notificationSound = useRef<HTMLAudioElement | null>(null);

  const [isSocialOpen, setIsSocialOpen] = useState(false);
  const [sidebarWidgetPinned, setSidebarWidgetPinned] = useState(false);

  // Initialize Sound and Permissions
  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    notificationSound.current.volume = 0.5;

    if ("Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Sync theme with user preferences and localStorage
  useEffect(() => {
    if (user?.preferences?.theme) {
      if (user.preferences.theme !== localTheme) {
        setLocalTheme(user.preferences.theme);
      }
      try {
        localStorage.setItem('memuer_theme', user.preferences.theme);
      } catch (_) {}
    }
  }, [user?.preferences?.theme]);

  // Keep meta theme-color and document background in sync with active theme
  useEffect(() => {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    const themeMetaColors: Record<string, string> = {
      vibrant: '#080212',
      midnight: '#02040b',
      forest: '#020c08',
      crimson: '#0e0206',
      luxury: '#0a0a0a',
      liquidglass: '#020712'
    };
    const bg = themeMetaColors[themeName] || '#020712';
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', bg);
    }
    if (document.documentElement) {
      document.documentElement.style.backgroundColor = bg;
    }
  }, [themeName]);
  const [calling, setCalling] = useState<{ 
    type: 'voice' | 'video', 
    user: UserProfile, 
    isIncoming?: boolean, 
    isConnecting?: boolean,
    callObj?: any 
  } | null>(null);
  const [activeCallStream, setActiveCallStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Non-image file preview states
  const [previewingFile, setPreviewingFile] = useState<{
    name: string;
    size: number;
    mimeType: string;
    storagePath: string;
  } | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  // Fetch text attachments automatically when preview container is mounted
  useEffect(() => {
    if (!previewingFile) {
      setPreviewTextContent('');
      setPreviewLoading(false);
      return;
    }
    const isText = isTextFile(previewingFile.name, previewingFile.mimeType);
    if (isText) {
      setPreviewLoading(true);
      fetch(previewingFile.storagePath)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to fetch content stream');
          return res.text();
        })
        .then((text) => {
          setPreviewTextContent(text);
          setPreviewLoading(false);
        })
        .catch((err) => {
          console.error('Error fetching file preview content:', err);
          setPreviewTextContent('Could not retrieve secure archive content. Please check connection and try again.');
          setPreviewLoading(false);
        });
    }
  }, [previewingFile]);

  // Maximize calling screen & programmatically fix buffering by cycling srcObjects
  const handleMaximizeAndFixBuffering = () => {
    setIsCallMinimized(false);
    setErrorMessage("Restored. Realignment protocol initialized...");
    setTimeout(() => setErrorMessage(null), 3000);

    if (remoteVideoRef.current && remoteStream) {
      const oldRemoteStream = remoteStream;
      console.log("Cycling Remote video srcObject to resolve buffering latency...");
      remoteVideoRef.current.srcObject = null;
      setTimeout(() => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = oldRemoteStream;
          remoteVideoRef.current.play().catch(err => console.log('Remote buffer restore trigger error:', err));
        }
      }, 50);
    }

    if (localVideoRef.current && activeCallStream) {
      const oldLocalStream = activeCallStream;
      localVideoRef.current.srcObject = null;
      setTimeout(() => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = oldLocalStream;
          localVideoRef.current.play().catch(err => console.log('Local buffer restore trigger error:', err));
        }
      }, 50);
    }
  };
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isVaultWarningOpen, setIsVaultWarningOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatInfoOpen, setIsChatInfoOpen] = useState(false);
  const [callUIStyle, setCallUIStyle] = useState({ width: 480, height: 360 });
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isCallCenterPanelOpen, setIsCallCenterPanelOpen] = useState(false);
  const [incomingCallCount, setIncomingCallCount] = useState<number>(0);
  const prevQueuedCallsRef = useRef<number>(0);
  const [adminAllUsers, setAdminAllUsers] = useState<UserProfile[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminActiveTab, setAdminActiveTab] = useState<'users' | 'support' | 'maintenance' | 'social' | 'audit' | 'callcenter'>('users');
  const [isCallCenterCallActive, setIsCallCenterCallActive] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [roleMenuUserId, setRoleMenuUserId] = useState<string | null>(null);

  // Social+ moderation states
  const [adminPosts, setAdminPosts] = useState<any[]>([]);
  const [adminShorts, setAdminShorts] = useState<any[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<any[]>([]);
  const [adminReports, setAdminReports] = useState<any[]>([]);
  const [adminRemovalReason, setAdminRemovalReason] = useState<string>('');
  const [adminSelectedContent, setAdminSelectedContent] = useState<{ type: 'post' | 'short'; id: string; userId?: string; username: string } | null>(null);
  const [adminSocialSubTab, setAdminSocialSubTab] = useState<'posts' | 'shorts' | 'reports'>('posts');
  const [socialDeepLinkShortId, setSocialDeepLinkShortId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserBioId, setEditingUserBioId] = useState<string | null>(null);
  const [editingUserBio, setEditingUserBio] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  
  interface SystemConfig {
    maintenanceMode?: boolean;
    maintenanceUntil?: string;
    disableAI?: boolean;
    disableAIUntil?: string;
    updatedBy?: string;
    updatedAt?: string;
    serverRestartTrigger?: number;
    globalAnnouncement?: {
      message: string;
      createdAt: number;
      active: boolean;
    } | null;
    systemAnnouncement?: {
      active: boolean;
      emoji: string;
      title: string;
      message: string;
      badge: string;
      theme: string;
      createdAt: number;
    } | null;
    appLocked?: boolean;
    appLockedReason?: string;
    appLockedUntil?: string;
    contactSupportEmail?: string;
  }
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  // New administrative operations and lockout states
  const [declinedGroupCalls, setDeclinedGroupCalls] = useState<string[]>([]);
  const [isRestartingSimulation, setIsRestartingSimulation] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState(7);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<number | null>(null);
  const [globalMsgInput, setGlobalMsgInput] = useState('');
  const [announcementEmojiInput, setAnnouncementEmojiInput] = useState('🇪🇬');
  const [announcementTitleInput, setAnnouncementTitleInput] = useState('Official System Announcement: World Cup Removal');
  const [announcementMessageInput, setAnnouncementMessageInput] = useState(
    'We have completely deactivated and removed all FIFA World Cup features, live trackers, and themed widgets from the platform. This action is taken in solid protest against systemic bias, racism, and unfairness shown towards the Egypt National Team. We refuse to host or facilitate features for any organization or tournament that treats nations with partiality or injustice.'
  );
  const [announcementBadgeInput, setAnnouncementBadgeInput] = useState('Solidarity Active');
  const [announcementThemeInput, setAnnouncementThemeInput] = useState('egypt-solidarity');
  const [dismissedSystemAnnouncementAt, setDismissedSystemAnnouncementAt] = useState<number | null>(null);
  const [lockoutReasonInput, setLockoutReasonInput] = useState('');
  const [lockoutDateInput, setLockoutDateInput] = useState('');
  const lastRestartTriggerRef = useRef<number>(Date.now());

  // Contact Us States
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [isSendingContact, setIsSendingContact] = useState(false);
  const [contactProgressStep, setContactProgressStep] = useState<string | null>(null);
  const [contactSendSuccess, setContactSendSuccess] = useState(false);
  const [adminContactEmailInput, setAdminContactEmailInput] = useState('');

  interface ContactMessage {
    id: string;
    senderName: string;
    senderEmail: string;
    subject: string;
    message: string;
    uid: string;
    createdAt?: any;
    replied?: boolean;
    replyMessage?: string;
    userHasSeenReply?: boolean;
  }
  const [adminContactMessages, setAdminContactMessages] = useState<ContactMessage[]>([]);
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null);
  const [adminSupportReplyText, setAdminSupportReplyText] = useState('');
  const [userContactMessages, setUserContactMessages] = useState<ContactMessage[]>([]);
  const [contactActiveTab, setContactActiveTab] = useState<'create' | 'inbox'>('create');

  useEffect(() => {
    if (systemConfig?.contactSupportEmail) {
      setAdminContactEmailInput(systemConfig.contactSupportEmail);
    }
  }, [systemConfig?.contactSupportEmail]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      setIsDesktop(window.innerWidth >= 1024);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Automatically open mobile sidebar when no active chat is selected, but don't force it to stay open
  useEffect(() => {
    if (!activeChat && !isDesktop) {
      setIsMobileSidebarOpen(true);
    }
  }, [activeChat]);

  // Secret Admin Panel trigger
  useEffect(() => {
    if (searchQuery === 'Kareem_8826admin') {
      if (auth.currentUser?.email !== 'koke.kozkoz@gmail.com') {
        setErrorMessage("Access Denied: Administrative console restricted to the group owner.");
        setTimeout(() => setErrorMessage(null), 3000);
        setSearchQuery('');
        return;
      }
      setIsAdminPanelOpen(true);
      setSearchQuery(''); // Clear instantly
      
      // If we are logged in, make sure we have the 'owner' role in our firestore profile
      if (user && user.role !== 'owner') {
        const userRef = doc(db, 'users', user.uid);
        updateDoc(userRef, { role: 'owner' })
          .then(() => console.log("Owner security credentials registered."))
          .catch((err) => console.error("Owner registration error:", err));
      }
    }
  }, [searchQuery, user]);

  // Sync System Config globally
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'system', 'config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemConfig;
        setSystemConfig(data);
        if (data.appLockedReason) {
          setLockoutReasonInput(data.appLockedReason);
        }
        if (data.appLockedUntil) {
          setLockoutDateInput(data.appLockedUntil);
        }
        if (data.systemAnnouncement) {
          setAnnouncementEmojiInput(data.systemAnnouncement.emoji || '🇪🇬');
          setAnnouncementTitleInput(data.systemAnnouncement.title || 'Official System Announcement: World Cup Removal');
          setAnnouncementMessageInput(data.systemAnnouncement.message || '');
          setAnnouncementBadgeInput(data.systemAnnouncement.badge || 'Solidarity Active');
          setAnnouncementThemeInput(data.systemAnnouncement.theme || 'egypt-solidarity');
        }
      } else {
        setSystemConfig({
          maintenanceMode: false,
          disableAI: false
        });
      }
    }, (err) => {
      // Ignore if missing permissions during initial start before doc is created
      console.warn("Failed to subscribe to system config:", err);
    });
    return () => unsubscribe();
  }, [user]);

  // Handle administrator requested restart/reboot simulation
  useEffect(() => {
    if (systemConfig?.serverRestartTrigger) {
      const trigger = systemConfig.serverRestartTrigger;
      // Only reload if the trigger is greater than the page's load time
      if (trigger > lastRestartTriggerRef.current) {
        lastRestartTriggerRef.current = trigger;
        setIsRestartingSimulation(true);
        setRestartCountdown(7);
      }
    }
  }, [systemConfig?.serverRestartTrigger]);

  useEffect(() => {
    if (!isRestartingSimulation) return;
    if (restartCountdown <= 0) {
      window.location.reload();
      return;
    }
    const timer = setTimeout(() => {
      setRestartCountdown(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [isRestartingSimulation, restartCountdown]);

  // Sync all users for structural Admin Panel tracking
  useEffect(() => {
    if (!user || !isAdminPanelOpen) return;
    const isAllowed = user.role === 'admin' || user.role === 'owner' || auth.currentUser?.email === 'koke.kozkoz@gmail.com';
    if (!isAllowed) return;
    
    const unsubscribe = onSnapshot(query(collection(db, 'users')), (snap) => {
      const allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }) as UserProfile);
      setAdminAllUsers(allUsers);
    }, (err) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded') || err?.message?.includes('Quota exceeded')) {
        console.warn("Admin user sync paused due to environment quota limits.");
      } else {
        console.error("Admin user sync error:", err);
      }
    });
    
    return () => unsubscribe();
  }, [user, isAdminPanelOpen]);

  // Sync support/contact messages for Admin Panel
  useEffect(() => {
    if (!user || !isAdminPanelOpen) return;
    const isAllowed = user.role === 'admin' || user.role === 'owner' || auth.currentUser?.email === 'koke.kozkoz@gmail.com';
    if (!isAllowed) return;

    const unsubscribe = onSnapshot(collection(db, 'contact_messages'), (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any) as ContactMessage[];
      // Sort in memory to avoid index requirements
      messages.sort((a, b) => {
        const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setAdminContactMessages(messages);
    }, (err) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded') || err?.message?.includes('Quota exceeded')) {
        console.warn("Admin support messages sync paused due to environment quota limits.");
      } else {
        console.error("Admin support messages sync error:", err);
      }
    });

    return () => unsubscribe();
  }, [user, isAdminPanelOpen]);

  // Listen to current user's contact inquiries to show support replies inline in-app
  useEffect(() => {
    if (!user?.uid) {
      setUserContactMessages([]);
      return;
    }
    const q = query(
      collection(db, 'contact_messages'),
      where('uid', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }) as any) as ContactMessage[];
      // Sort newest first
      messages.sort((a, b) => {
        const timeA = a.createdAt?.seconds || a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.seconds || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      setUserContactMessages(messages);
    }, (err) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded') || err?.message?.includes('Quota exceeded')) {
        console.warn("User support messages sync paused due to environment quota limits.");
      } else {
        console.error("User support messages sync error:", err);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Mark admin support answers as seen when user visits support/contact us inbox
  useEffect(() => {
    if (!isContactModalOpen || contactActiveTab !== 'inbox' || !user?.uid || userContactMessages.length === 0) return;
    
    userContactMessages.forEach(async (m) => {
      if (m.replied && !m.userHasSeenReply) {
        try {
          const docRef = doc(db, 'contact_messages', m.id);
          await updateDoc(docRef, { userHasSeenReply: true });
        } catch (error) {
          console.error("Failed to mark support ticket reply as seen:", error);
        }
      }
    });
  }, [isContactModalOpen, contactActiveTab, userContactMessages, user?.uid]);

  const isUserExempt = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (
      user.role === 'headowner' ||
      user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'tester'
    ))
  );

  const isHeadOwnerMe = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    user?.role === 'headowner'
  );

  const isUserOwnerMe = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (user.role === 'owner' || user.role === 'headowner'))
  );

  const isUserAdminMe = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (user.role === 'admin' || user.role === 'owner' || user.role === 'headowner'))
  );

  const isUserCallCenterMe = !!(
    user && user.role === 'callcenter'
  );

  useEffect(() => {
    if (!db || !isUserCallCenterMe) {
      setIncomingCallCount(0);
      return;
    }

    const q = query(
      collection(db, 'call_center_calls'),
      where('status', 'in', ['queued', 'greeting_playing', 'selecting_option'])
    );

    const unsub = onSnapshot(q, (snap) => {
      const count = snap.docs.length;
      setIncomingCallCount(count);

      if (count > prevQueuedCallsRef.current) {
        try {
          const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const now = actx.currentTime;
          
          const playRingTone = (startTime: number) => {
            const osc1 = actx.createOscillator();
            const osc2 = actx.createOscillator();
            const gain = actx.createGain();

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(800, startTime);
            osc2.frequency.setValueAtTime(1060, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.35, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(actx.destination);

            osc1.start(startTime);
            osc2.start(startTime);
            osc1.stop(startTime + 0.45);
            osc2.stop(startTime + 0.45);
          };

          playRingTone(now);
          playRingTone(now + 0.25);
          playRingTone(now + 0.65);
          playRingTone(now + 0.9);
        } catch (e) {
          console.warn("Audio notification error:", e);
        }
      }
      prevQueuedCallsRef.current = count;
    }, (err) => {
      console.warn("Call center queue snapshot error:", err);
    });

    return () => unsub();
  }, [db, isUserCallCenterMe]);
  
  const isCurrentlyBanned = !!(user?.bannedUntil && (user.bannedUntil === 'permanent' || new Date(user.bannedUntil) > new Date()));
  const isUnderMaintenanceObj = !!(systemConfig?.maintenanceMode && (!systemConfig.maintenanceUntil || new Date(systemConfig.maintenanceUntil) > new Date()));
  const isUnderMaintenance = !!(isUnderMaintenanceObj && !isUserExempt);

  const resetKeyPair = async () => {
    if (!user) return;
    const newKeyPair = generateKeyPair();
    storeKeyPair(user.uid, newKeyPair);
    try {
      await updateDoc(doc(db, 'users', user.uid), { publicKey: newKeyPair.publicKey });
      setErrorMessage("New vault established. Future messages will be secured with this key.");
      setTimeout(() => setErrorMessage(null), 5000);
      setIsVaultWarningOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  useEffect(() => {
    if (user && user.vaultSynced === false) {
      setIsVaultWarningOpen(true);
    }
  }, [user?.vaultSynced]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isCallSettingsOpen, setIsCallSettingsOpen] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('default');
  const callTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioDevices(outputs);
      } catch (err) {
        console.warn("Failed to enumerate audio output devices:", err);
      }
    };

    loadDevices();
    navigator.mediaDevices.addEventListener('devicechange', loadDevices);
    return () => {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
      }
    };
  }, []);

  const changeAudioOutput = async (deviceId: string) => {
    setSelectedAudioDevice(deviceId);
    
    const videoEl = remoteVideoRef.current;
    if (videoEl && 'setSinkId' in videoEl) {
      try {
        await (videoEl as any).setSinkId(deviceId);
        console.log(`Audio output switched to device: ${deviceId}`);
        setErrorMessage("Audio output updated successfully.");
        setTimeout(() => setErrorMessage(null), 3000);
      } catch (err: any) {
        console.error("Failed to set audio output device:", err);
        setErrorMessage(`Audio router error: ${err.message || err}`);
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } else {
      console.warn("setSinkId is not supported by this browser element.");
      setErrorMessage("System routed audio to requested device.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const [typingStatus, setTypingStatus] = useState<Record<string, boolean>>({});
  const [myTyping, setMyTyping] = useState(false);
  const [displayLetter, setDisplayLetter] = useState('M');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordDurationRef = useRef<number>(0);
  const [audioRecordingState, setAudioRecordingState] = useState<'idle' | 'recording' | 'review'>('idle');
  const [previewAudio, setPreviewAudio] = useState<{ base64: string; duration: number } | null>(null);
  const shouldDiscardAudioRef = useRef(false);
  const tempStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const outgoingToneRef = useRef<HTMLAudioElement | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [callQuality, setCallQuality] = useState({
    resolution: '720p' as '360p' | '720p' | '1080p',
    noiseSuppression: true,
    echoCancellation: true
  });

  const { 
    peer, 
    myPeerId,
    incomingCall, 
    peerError, 
    startCall, 
    answerCall, 
    connectToPeer,
    dataConnection,
    setDataConnection,
    clearIncomingCall, 
    clearPeerError, 
    streamRef 
  } = usePeer(user?.uid);

  useEffect(() => {
    if (authError) {
      setErrorMessage(authError);
      // Clear auth error after showing it
      setTimeout(() => setAuthError(null), 5000);
    }
  }, [authError, setAuthError]);

  const handleLogout = async () => {
    if (user?.uid) {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          currentPeerId: null,
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
      } catch (err) {
        console.error("Cleanup before logout failed", err);
      }
    }
    logout();
  };

  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMessage.trim()) return;

    setIsSendingContact(true);
    setContactSendSuccess(false);
    try {
      setContactProgressStep('Encrypting inquiry payload...');
      await new Promise((r) => setTimeout(r, 650));

      setContactProgressStep('Establishing secure support link...');
      await new Promise((r) => setTimeout(r, 650));

      setContactProgressStep('Transmitting secure data packets...');
      await addDoc(collection(db, 'contact_messages'), {
        senderName: user?.displayName || 'Anonymous User',
        senderEmail: contactEmail || user?.email || 'no-email@provided.com',
        subject: contactSubject || 'General Inquiry',
        message: contactMessage,
        uid: user?.uid || 'unauthenticated',
        createdAt: serverTimestamp()
      });
      await new Promise((r) => setTimeout(r, 600));

      setContactProgressStep('Transaction completed successfully!');
      setContactSendSuccess(true);

      // Clear input fields
      setContactSubject('');
      setContactMessage('');
      setContactEmail('');
    } catch (err: any) {
      console.error("Failed to process contact inquiry", err);
      setErrorMessage(`Inquiry failed: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3500);
      setContactProgressStep(null);
    } finally {
      setIsSendingContact(false);
    }
  };

  // Typing Indicator Logic
  useEffect(() => {
    if (!activeChat || !user) return;
    
    const sendTypingStatus = async (isTyping: boolean) => {
      try {
        await updateDoc(doc(db, 'chats', activeChat.id), {
          [`typing.${user.uid}`]: isTyping
        });
      } catch (e) {
        // Silently fail typing updates to avoid noise
      }
    };

    if (messageInput.trim().length > 0) {
      if (!myTyping) {
        setMyTyping(true);
        sendTypingStatus(true);
      }
      
      const timeout = setTimeout(() => {
        setMyTyping(false);
        sendTypingStatus(false);
      }, 3000);
      
      return () => clearTimeout(timeout);
    } else if (myTyping) {
      setMyTyping(false);
      sendTypingStatus(false);
    }
  }, [messageInput, activeChat?.id, user?.uid]);

  // Letter Glitch Effect for Logo
  useEffect(() => {
    if (loading) {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*?";
      const interval = setInterval(() => {
        setDisplayLetter(letters[Math.floor(Math.random() * letters.length)]);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setDisplayLetter(user?.displayName?.[0]?.toUpperCase() || 'E');
    }
  }, [loading, user?.displayName]);

  // Sync Peer ID to Firestore with Heartbeat
  useEffect(() => {
    if (user?.uid && myPeerId) {
      const userRef = doc(db, 'users', user.uid);
      
      const syncStatus = async () => {
        try {
          await updateDoc(userRef, { 
            currentPeerId: myPeerId,
            isOnline: true,
            lastSeen: new Date().toISOString()
          });
        } catch (e) {
          console.error("Failed to sync status", e);
        }
      };

      syncStatus();
      const heartbeat = setInterval(syncStatus, 60000); // Heartbeat every 60s

      const cleanup = async () => {
        clearInterval(heartbeat);
        try {
          // Verify we are still using this peer ID before clearing it
          const docSnap = await getDoc(userRef);
          if (docSnap.exists() && docSnap.data().currentPeerId === myPeerId) {
            await updateDoc(userRef, { 
              currentPeerId: null,
              isOnline: false,
              lastSeen: new Date().toISOString()
            });
          }
        } catch (e) {
          console.error("Cleanup failed", e);
        }
      };

      window.addEventListener('beforeunload', cleanup);
      return () => {
        window.removeEventListener('beforeunload', cleanup);
        cleanup();
      };
    }
  }, [user?.uid, myPeerId]);

  useEffect(() => {
    if (peerError) {
      setErrorMessage(peerError);
      setCalling(null);
      setTimeout(() => {
        setErrorMessage(null);
        clearPeerError();
      }, 5000);
    }
  }, [peerError, clearPeerError]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileImageInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState('');
  const [directorySearchQuery, setDirectorySearchQuery] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'contacts' | 'requests'>('chats');
  const [activeVideoFilter, setActiveVideoFilter] = useState(0);
  const [remoteVideoFilter, setRemoteVideoFilter] = useState(0);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [isArchiveExpanded, setIsArchiveExpanded] = useState(false);

  useEffect(() => {
    if (!dataConnection) return;

    const handleData = (data: any) => {
      console.log('Received peer data:', data);
      if (data.type === 'filter') {
        setRemoteVideoFilter(data.value);
      } else if (data.type === 'call_upgrade') {
        if (data.value === 'video') {
          setCalling(prev => prev ? { ...prev, type: 'video' } : null);
        }
      } else if (data.type === 'call_signaling') {
        const action = data.action;
        if (action === 'declined') {
          setErrorMessage("The user declined your request.");
          setTimeout(() => setErrorMessage(null), 5000);
          cleanupCall();
        } else if (action === 'busy') {
          setErrorMessage("The other line is currently busy.");
          setTimeout(() => setErrorMessage(null), 5000);
          cleanupCall();
        } else if (action === 'timeout') {
          setErrorMessage("Call timed out on response.");
          setTimeout(() => setErrorMessage(null), 5000);
          cleanupCall();
        } else if (action === 'hangup') {
          setErrorMessage("Secure session terminated by peer.");
          setTimeout(() => setErrorMessage(null), 5000);
          cleanupCall();
        } else if (action === 'cancelled') {
          setErrorMessage("Connection cancelled by caller.");
          setTimeout(() => setErrorMessage(null), 5000);
          cleanupCall();
        }
      }
    };

    dataConnection.on('data', handleData);
    dataConnection.on('close', () => setDataConnection(null));
    dataConnection.on('error', () => setDataConnection(null));

    // Send current filter immediately after connecting
    dataConnection.on('open', () => {
      dataConnection.send({ type: 'filter', value: activeVideoFilter });
    });

    // If it's already open, send it
    if (dataConnection.open) {
      dataConnection.send({ type: 'filter', value: activeVideoFilter });
    }

    return () => {
      dataConnection.off('data', handleData);
    };
  }, [dataConnection, activeVideoFilter, setDataConnection]);

  // Sync filter changes
  useEffect(() => {
    if (dataConnection && dataConnection.open) {
      dataConnection.send({ type: 'filter', value: activeVideoFilter });
    }
  }, [activeVideoFilter, dataConnection]);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [isChangelogOpen, setIsChangelogOpen] = useState(false);

  const UPDATES = isAr ? [
    {
      title: "نجوم السايبر التفاعلية ومتابعة المؤشر",
      description: "تفاعل ذكي ومغناطيسي للنجوم مع مؤشر الفأرة (PC) واللمس المتناثر (Mobile) مع خيارات تفعيل وإيقاف وانزلاق النجوم بسلاسة إلى مكانها، وضبط السرعة من 1 إلى 3.",
      icon: <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />,
      date: "أغسطس 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "إعدادات النجوم والحركة"
    },
    {
      title: "تطابق ألوان النوافذ وجهات الاتصال مع الثيم",
      description: "أصبحت نافذة الإعدادات وسجل التحديثات وإضافة جهات الاتصال متناسقة تماماً مع الثيم المختار (Liquidglass, Midnight, Forest, Crimson, Luxury, Vibrant).",
      icon: <Eye className="w-5 h-5 text-indigo-400" />,
      date: "أغسطس 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "تخصيص الثيم والمظهر"
    },
    {
      title: "منصة Memuer Social+ وانتقالات سلسة",
      description: "تصميم فائق الأناقة مع تأثيرات دخول وخروج وانتقالات فائقة السلاسة بين التبويبات والمقاطع والقصص وفلاتر المحتوى الحية.",
      icon: <Globe className="w-5 h-5 text-pink-400" />,
      date: "أغسطس 2026",
      action: () => { setIsSocialOpen(true); setIsChangelogOpen(false); },
      actionLabel: "استكشف Social+"
    },
    {
      title: "مركز الاتصال والدعم الحي",
      description: "منظومة اتصالات متطورة مع طوابير الانتظار الفورية، وتوزيع المكالمات الصوتية والمرئية، وتتبع سجلات الدعم.",
      icon: <Headphones className="w-5 h-5 text-indigo-400 animate-pulse" />,
      date: "أغسطس 2026",
      action: () => { setIsCallCenterPanelOpen(true); setIsChangelogOpen(false); },
      actionLabel: "مركز الاتصال"
    },
    {
      title: "الضغط التكيفي وتشفير الوسائط",
      description: "إضافة ضغط الصور تلقائياً وتحسين رفع الوسائط دون أي انقطاع مع ضمان الحماية والتشفير الكامل للبيانات.",
      icon: <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />,
      date: "يوليو 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "إعدادات الأمان والوسائط"
    },
    {
      title: "أرشيف المحادثات والخصوصية",
      description: "إمكانية إخفاء وأرشفة المحادثات الجانبية بسهولة والوصول إليها مجدداً في أي وقت بنقرة واحدة.",
      icon: <Archive className="w-5 h-5 text-indigo-400" />,
      date: "يونيو 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "الأرشيف والخصوصية"
    }
  ] : [
    {
      title: "Interactive Cyber Stars & Cursor Controls",
      description: "Refined magnetic cursor follower stars on PC and touch sparkles on mobile, featuring granular ON/OFF toggles with smooth return-to-place transitions and velocity speed controls (1 to 3).",
      icon: <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />,
      date: "August 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Configure Stars & Controls"
    },
    {
      title: "Theme-Matched Modals & Contacts Hub",
      description: "The Settings window, System Changelog, Add Contacts modal, and directory elements now dynamically inherit and adapt to the active theme palette and glowing accents.",
      icon: <Eye className="w-5 h-5 text-indigo-400" />,
      date: "August 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Explore Themes"
    },
    {
      title: "Memuer Social+ & Fluid Transitions",
      description: "Enhanced social media experience with spring physics entry, smooth tab switches, interactive feed filters (All, Trending, Following), and short video reels.",
      icon: <Globe className="w-5 h-5 text-pink-400" />,
      date: "August 2026",
      action: () => { setIsSocialOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Explore Social+"
    },
    {
      title: "Live Dispatch & Call Center Hub",
      description: "Built-in customer support switchboard with live queue management, priority hotline routing, and operator agent consoles.",
      icon: <Headphones className="w-5 h-5 text-indigo-400 animate-pulse" />,
      date: "August 2026",
      action: () => { setIsCallCenterPanelOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Open Call Center"
    },
    {
      title: "Adaptive Compression & E2EE Fallback",
      description: "Added real-time client-side image compression via canvas and automatic Base64 direct-sync upload fallback. Safeguards and guarantees that your media uploads never fail.",
      icon: <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />,
      date: "July 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Media Settings"
    },
    {
      title: "Archive Enclaves & Privacy",
      description: "Effortlessly archive side conversations with 1-click restore, keeping your active chat inbox clean and distraction-free.",
      icon: <Archive className="w-5 h-5 text-indigo-400" />,
      date: "June 2026",
      action: () => { setIsSettingsOpen(true); setIsChangelogOpen(false); },
      actionLabel: "Privacy & Archive"
    }
  ];

  const videoFilters = [
    { name: 'Normal', filter: 'none' },
    { name: 'Noir', filter: 'grayscale(100%) contrast(1.2)' },
    { name: 'Vintage', filter: 'sepia(0.6) contrast(1.1) brightness(0.9)' },
    { name: 'Neon', filter: 'hue-rotate(180deg) saturate(2)' },
    { name: 'Dreamy', filter: 'blur(1px) brightness(1.2) saturate(1.5)' },
    { name: 'Ghost', filter: 'invert(1) brightness(0.9)' }
  ];

  const filteredMessages = messages.filter(m => {
    return m.type === 'text' && (m.content || '').toLowerCase().includes(msgSearchQuery.toLowerCase());
  });

  const filteredDirectory = contacts
    .filter(c => {
      if (c.isHiddenFromDirectory) {
        // Only show if mutual connection (friend) exists in active chats
        const isConnect = chats.some(chat => chat.type === 'direct' && chat.participants.includes(c.uid));
        return isConnect;
      }
      return true;
    })
    .filter(c => 
      (c.displayName || '').toLowerCase().includes(directorySearchQuery.toLowerCase()) || 
      (c.uid || '').toLowerCase() === directorySearchQuery.toLowerCase()
    );

  const bgConfigs: Record<string, string> = {
    geometric: "opacity-10",
    aurora: "opacity-30 blur-[150px]",
    'digital grid': "opacity-20",
    'deep void': "opacity-5"
  };

  const currentBgClass = bgConfigs[user?.preferences?.chatBackground || 'geometric'] || bgConfigs.geometric;

  // UI scale adjustments for mobile
  const responsivePadding = "p-4 sm:p-8";
  const responsiveGap = "gap-4 sm:gap-6";
  const responsiveRounded = "rounded-3xl sm:rounded-[40px]";
  const responsiveTextHeading = "text-2xl sm:text-4xl";
  const responsiveTextGiant = "text-4xl sm:text-6xl";
  const responsiveButtonSize = "w-10 h-10 sm:w-12 sm:h-12";
  const responsiveIconSize = "w-4 h-4 sm:w-5 sm:h-5";

  const handleStartCall = async (type: 'voice' | 'video') => {
    if (!activeChat || !user) return;

    if (activeChat.participants?.includes('memuer-call-center') || activeChat.id?.includes('memuer-call-center')) {
      setIsCallCenterCallActive(true);
      return;
    }

    setIsCameraOff(type === 'voice');
    setIsScreenSharing(false);

    // Support for Group Calls
    if (activeChat.type === 'group') {
      try {
        // Signal everyone in the group that a call is starting
        await updateDoc(doc(db, 'chats', activeChat.id), {
          activeCall: {
            callerId: user.uid,
            callerName: user.displayName,
            type,
            status: 'active',
            createdAt: new Date().toISOString()
          }
        });

        // For now, the caller just sits in a "waiting" state or calls whoever is online
        // In a simple mesh, the caller starts by initiating local media
        const constraints = getMediaConstraints(type, callQuality);
        let stream: MediaStream;
        if (type === 'video') {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
          const blankTrack = createBlankVideoTrack();
          if (blankTrack) {
            stream.addTrack(blankTrack);
          }
        }
        streamRef.current = stream;
        setActiveCallStream(stream);
        
        // We set a mock "group" recipient so the UI knows we are calling
        setCalling({ 
          type, 
          user: { 
            uid: activeChat.id, 
            displayName: activeChat.name || 'Group Call',
            photoURL: '',
            status: 'Group Call Active',
            isOnline: true,
            lastSeen: new Date().toISOString(),
            publicKey: ''
          } 
        });

        // Participants will listen to the chat doc and join
        return;
      } catch (err) {
        console.error("Failed to signal group call:", err);
        setErrorMessage("Could not initiate group signal.");
        return;
      }
    }

    const recipientId = activeChat.participants.find(id => id !== user.uid);
    const recipient = contacts.find(c => c.uid === recipientId);
    if (!recipient) return;

    const isFresh = recipient.lastSeen ? (new Date().getTime() - new Date(recipient.lastSeen).getTime()) < 180000 : false;
    if (!recipient.isOnline || !isFresh) {
      console.warn(`${recipient.displayName} may be backgrounded/offline, but attempting call anyway.`);
    }

    setCalling({ type, user: recipient });
    try {
      const targetPeerId = recipient.currentPeerId;
      if (!targetPeerId) {
        setErrorMessage(`${recipient.displayName} has no active secure signaling ID. Try refreshing or wait for them to reconnect.`);
        setTimeout(() => setErrorMessage(null), 5000);
        setCalling(null);
        return;
      }
      const constraints = getMediaConstraints(type, callQuality);
      const { call, stream } = await startCall(targetPeerId, type, constraints);
      setActiveCallStream(stream);
      // Establish data connection for syncing filters, etc.
      connectToPeer(targetPeerId);
      // Store the call object for the caller too, so we can hang up correctly
      setCalling(prev => ({ ...prev!, callObj: call }));

      // Set call response timeout (e.g., 45 seconds of ringing)
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        console.log("Call timed out - no response from recipient");
        handleDeclineCall('timeout');
      }, 45000);

      call.on('stream', (rStream: MediaStream) => {
        console.log("Remote stream received");
        setRemoteStream(rStream);
      });
      call.on('error', (err: any) => {
        console.error("Call error:", err);
        setErrorMessage("Connection failed. The other user might have disconnected.");
        cleanupCall();
      });
      call.on('close', () => cleanupCall());
    } catch (err: any) {
      console.error("Call failed:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMessage("Could not start audio/video. Please check your camera/microphone permissions.");
      } else {
        setErrorMessage("Could not start audio/video source. Please check hardware and permissions.");
      }
      setTimeout(() => setErrorMessage(null), 5000);
      setCalling(null);
    }
  };

  const handleAnswerCall = async () => {
    if (!calling?.callObj) {
      console.warn("No call object found to answer");
      return;
    }
    console.log("Answering call from:", calling.callObj.peer);
    
    setIsCameraOff(calling.type === 'voice');
    setIsScreenSharing(false);

    // Mark as connecting to stop ringtone and show stay in full screen until stream arrives
    setCalling(prev => prev ? { ...prev, isIncoming: false, isConnecting: true } : null);
    
    // Ensure close listener is active for incoming call as well
    calling.callObj.on('close', () => {
      console.log("Call closed by remote while answering");
      cleanupCall();
    });
    calling.callObj.on('error', (err: any) => {
      console.error("Call error while answering:", err);
      setErrorMessage("Disconnected while answering the call.");
      cleanupCall();
    });

    try {
      const constraints = getMediaConstraints(calling.type, callQuality);
      const stream = await answerCall(calling.callObj, constraints);
      setActiveCallStream(stream);
      calling.callObj.on('stream', (rStream: MediaStream) => {
        console.log("Remote stream received (answered side)");
        setRemoteStream(rStream);
        setCalling(prev => prev ? { ...prev, isConnecting: false } : null);
      });
    } catch (err: any) {
      console.error("Answer failed:", err);
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMessage("Could not start audio/video. Please check your camera/microphone permissions.");
      } else {
        setErrorMessage("Could not start audio/video source. Please check hardware and permissions.");
      }
      setTimeout(() => setErrorMessage(null), 5000);
      cleanupCall();
    }
  };

  const getMediaConstraints = (type: 'voice' | 'video', quality: typeof callQuality): MediaStreamConstraints => {
    const resolutions = {
      '360p': { width: { ideal: 640 }, height: { ideal: 360 } },
      '720p': { width: { ideal: 1280 }, height: { ideal: 720 } },
      '1080p': { width: { ideal: 1920 }, height: { ideal: 1080 } }
    };
    
    return {
      video: type === 'video' ? {
        ...resolutions[quality.resolution],
        frameRate: { ideal: 30 }
      } : false,
      audio: {
        echoCancellation: quality.echoCancellation,
        noiseSuppression: quality.noiseSuppression
      }
    };
  };

  const stopAllSounds = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
    if (outgoingToneRef.current) {
      outgoingToneRef.current.pause();
      outgoingToneRef.current.currentTime = 0;
    }
  };

  const cleanupCall = async () => {
    stopAllSounds();

    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Explicitly close the call object if it exists to signal the other party
    if (calling?.callObj) {
      try {
        calling.callObj.close();
      } catch (e) {
        console.warn("Error closing call object:", e);
      }
    }

    // Clear active call signal from Firestore if this was a group call initiated by us
    if (activeChat?.type === 'group' && activeChat.activeCall?.callerId === user?.uid) {
      try {
        await updateDoc(doc(db, 'chats', activeChat.id), {
          activeCall: null
        });
      } catch (e) {
        console.error("Failed to clear group call signal:", e);
      }
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (dataConnection) {
      dataConnection.close();
      setDataConnection(null);
    }
    clearIncomingCall();
    setActiveCallStream(null);
    setRemoteStream(null);
    setCalling(null);
    setIsCallSettingsOpen(false);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsCallMinimized(false);
    setActiveVideoFilter(0);
    setRemoteVideoFilter(0);
  };

  const handleDeclineCall = async (reason: 'declined' | 'busy' | 'timeout' | 'hangup' | 'cancelled') => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    if (dataConnection && dataConnection.open) {
      try {
        dataConnection.send({ type: 'call_signaling', action: reason });
      } catch (e) {
        console.warn("Could not send call signalling:", e);
      }
    }

    // Block future incoming ring notifications for this specific group call session if declined
    if (activeChat?.type === 'group' && activeChat.activeCall) {
      const callId = activeChat.activeCall.createdAt || activeChat.id;
      setDeclinedGroupCalls(prev => [...prev, callId]);
    }

    if (reason === 'declined') {
      setErrorMessage("Call declined.");
    } else if (reason === 'busy') {
      setErrorMessage("Line busy.");
    } else if (reason === 'timeout') {
      setErrorMessage("Call timed out.");
    } else if (reason === 'hangup') {
      setErrorMessage("Call ended.");
    } else if (reason === 'cancelled') {
      setErrorMessage("Call cancelled.");
    }
    setTimeout(() => {
      setErrorMessage(null);
    }, 4000);

    cleanupCall();
  };

  const toggleCallMinimize = () => {
    setIsCallMinimized(!isCallMinimized);
  };

  const toggleMute = () => {
    if (activeCallStream) {
      const audioTrack = activeCallStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = async () => {
    if (!activeCallStream || !calling?.callObj) return;

    let videoTrack = activeCallStream.getVideoTracks()[0];
    
    if (isCameraOff) {
      // TURN CAMERA ON
      try {
        const constraints = getMediaConstraints('video', callQuality);
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video });
        const realVideoTrack = cameraStream.getVideoTracks()[0];
        
        if (realVideoTrack) {
          // Replace track in activeCallStream
          if (videoTrack) {
            activeCallStream.removeTrack(videoTrack);
            videoTrack.stop();
          }
          activeCallStream.addTrack(realVideoTrack);
          
          // Replace track in RTCRtpSenders
          const pc = calling.callObj.peerConnection;
          if (pc) {
            pc.getSenders().forEach((sender: any) => {
              if (sender.track && sender.track.kind === 'video') {
                sender.replaceTrack(realVideoTrack);
              }
            });
          }
          
          setIsCameraOff(false);
          setCalling(prev => prev ? { ...prev, type: 'video' } : null);
          
          // Notify remote peer to upgrade layout to video call
          if (dataConnection && dataConnection.open) {
            dataConnection.send({ type: 'call_upgrade', value: 'video' });
          }
        }
      } catch (err) {
        console.error("Failed to access camera:", err);
        setErrorMessage("Could not start camera source. Check permissions.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } else {
      // TURN CAMERA OFF
      // Stop and remove current video track to turn off browser camera light
      if (videoTrack) {
        videoTrack.enabled = false;
        videoTrack.stop();
        activeCallStream.removeTrack(videoTrack);
      }
      
      // Inject silent canvas blank video track
      const blankTrack = createBlankVideoTrack();
      if (blankTrack) {
        activeCallStream.addTrack(blankTrack);
        
        const pc = calling.callObj.peerConnection;
        if (pc) {
          pc.getSenders().forEach((sender: any) => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(blankTrack);
            }
          });
        }
      }
      setIsCameraOff(true);
    }
  };

  const toggleScreenShare = async () => {
    if (!activeCallStream || !calling?.callObj) return;

    if (isScreenSharing) {
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia(getMediaConstraints('video', callQuality));
        const videoTrack = cameraStream.getVideoTracks()[0];
        
        const pc = calling.callObj.peerConnection;
        if (pc) {
          pc.getSenders().forEach((sender: any) => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(videoTrack);
            }
          });
        }
        
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
          screenStreamRef.current = null;
        }

        const oldVideoTrack = activeCallStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          activeCallStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        activeCallStream.addTrack(videoTrack);
        
        setIsScreenSharing(false);
        setIsCameraOff(false);
      } catch (err) {
        console.error("Failed to switch back to camera:", err);
      }
    } else {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setErrorMessage("Screen sharing is not supported in this environment. Try opening the app in a new tab or using a compatible browser.");
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false
        });
        
        const screenTrack = screenStream.getVideoTracks()[0];
        
        screenTrack.onended = () => {
          if (isScreenSharing) {
            toggleScreenShare();
          }
        };

        const pc = calling.callObj.peerConnection;
        if (pc) {
          pc.getSenders().forEach((sender: any) => {
            if (sender.track && sender.track.kind === 'video') {
              sender.replaceTrack(screenTrack);
            }
          });
        }

        screenStreamRef.current = screenStream;
        
        const oldVideoTrack = activeCallStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          activeCallStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        activeCallStream.addTrack(screenTrack);
        
        setIsScreenSharing(true);
        setIsCameraOff(false);
      } catch (err) {
        console.error("Failed to start screen share:", err);
        if (err instanceof Error && err.name !== 'NotAllowedError') {
          setErrorMessage("Failed to share screen.");
        }
      }
    }
  };

  const startRecording = async () => {
    shouldDiscardAudioRef.current = false;
    setPreviewAudio(null);
    try {
      let stream: MediaStream;
      let isMocked = false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        console.warn("Microphone permission denied or not available, falling back to simulated audio stream:", err);
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const dest = ctx.createMediaStreamDestination();
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();
          
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, ctx.currentTime);
          gainNode.gain.setValueAtTime(0.01, ctx.currentTime);
          
          oscillator.connect(gainNode);
          gainNode.connect(dest);
          oscillator.start();
          
          stream = dest.stream;
          isMocked = true;
          
          const audioTrack = stream.getTracks()[0];
          if (audioTrack) {
            const originalStop = audioTrack.stop;
            audioTrack.stop = () => {
              try { oscillator.stop(); } catch (_) {}
              try { ctx.close(); } catch (_) {}
              if (originalStop) originalStop.call(audioTrack);
            };
          }
        } else {
          throw err;
        }
      }

      tempStreamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (shouldDiscardAudioRef.current) {
          stream.getTracks().forEach(track => track.stop());
          setRecordDuration(0);
          setAudioRecordingState('idle');
          setPreviewAudio(null);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        const finalDuration = recordDurationRef.current || 1;
        
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setPreviewAudio({ base64: base64Audio, duration: finalDuration });
          setAudioRecordingState('review');
        };
        stream.getTracks().forEach(track => track.stop());
        setRecordDuration(0);
      };

      recordDurationRef.current = 0;
      setRecordDuration(0);

      mediaRecorder.start();
      setIsRecording(true);
      setAudioRecordingState('recording');

      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration(prev => {
          const next = prev + 1;
          recordDurationRef.current = next;
          return next;
        });
      }, 1000);

      if (isMocked) {
        setErrorMessage("Microphone permission denied - using simulated recording fallback.");
        setTimeout(() => setErrorMessage(null), 4000);
      }
    } catch (err) {
      console.error("Error starting recording:", err);
      setErrorMessage("Microphone access denied. Recording failed.");
      setTimeout(() => setErrorMessage(null), 3000);
      setAudioRecordingState('idle');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    shouldDiscardAudioRef.current = true;
    if (mediaRecorderRef.current && isRecording) {
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
      mediaRecorderRef.current.stop();
    } else {
      setAudioRecordingState('idle');
      setPreviewAudio(null);
    }
  };

  const sendRecordedVoiceMessage = async () => {
    if (previewAudio && activeChat && user) {
      await sendAudioMessage(previewAudio.base64, previewAudio.duration);
      setPreviewAudio(null);
      setAudioRecordingState('idle');
    }
  };

  const sendAudioMessage = async (base64Audio: string, duration: number) => {
    if (!activeChat || !user) return;
    
    // Encryption logic
    const localKeys = getStoredKeyPair(user.uid);
    let encryptedData: { content: string; nonce: string } | null = null;
    let isEncrypted = false;

    if (activeChat.type === 'direct') {
      const recipientId = activeChat.participants.find(id => id !== user.uid);
      const recipient = contacts.find(c => c.uid === recipientId);
      if (recipient && recipient.publicKey && localKeys) {
        encryptedData = encryptMessage(base64Audio, recipient.publicKey, localKeys.secretKey);
        isEncrypted = true;
      } else {
        encryptedData = encryptMessage(base64Audio, '', '');
        isEncrypted = true;
      }
    } else if (activeChat.type === 'group') {
      if (activeGroupKey) {
        encryptedData = encryptSymmetric(base64Audio, activeGroupKey);
        isEncrypted = true;
      } else {
        encryptedData = encryptMessage(base64Audio, '', '');
        isEncrypted = true;
      }
    }

    if (isEncrypted && encryptedData) {
      try {
        // Ensure parent chat doc exists
        const chatDocRef = doc(db, 'chats', activeChat.id);
        const chatSnap = await getDoc(chatDocRef);
        if (!chatSnap.exists()) {
          await setDoc(chatDocRef, {
            type: activeChat.type,
            participants: activeChat.participants,
            participantKeys: activeChat.participantKeys || { [user.uid]: user.publicKey || 'mock-key' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }

        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          content: encryptedData.content,
          nonce: encryptedData.nonce,
          type: 'audio',
          duration: Math.round(duration || 0),
          createdAt: new Date().toISOString()
        });
        
        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: '🎤 Audio communication',
          updatedAt: new Date().toISOString()
        });
      } catch (e) {
        console.error("Failed to send audio message:", e);
        handleFirestoreError(e, OperationType.WRITE, `chats/${activeChat.id}/messages`);
      }
    }
  };

  const applyCallQuality = async (newQuality: typeof callQuality) => {
    if (!activeCallStream) return;

    const videoTrack = activeCallStream.getVideoTracks()[0];
    const audioTrack = activeCallStream.getAudioTracks()[0];

    try {
      if (videoTrack) {
        const resolutions = {
          '360p': { width: 640, height: 360 },
          '720p': { width: 1280, height: 720 },
          '1080p': { width: 1920, height: 1080 }
        };
        await videoTrack.applyConstraints({
          ...resolutions[newQuality.resolution],
          frameRate: { ideal: 30 }
        });
      }

      if (audioTrack) {
        await audioTrack.applyConstraints({
          echoCancellation: newQuality.echoCancellation,
          noiseSuppression: newQuality.noiseSuppression
        });
      }
      
      setCallQuality(newQuality);
    } catch (err) {
      console.error("Failed to apply constraints:", err);
      setErrorMessage("Hardware does not support requested quality settings.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
        remoteVideoRef.current.play().catch(e => console.log("Video play failed", e));
      }
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && activeCallStream) {
      if (localVideoRef.current.srcObject !== activeCallStream) {
        localVideoRef.current.srcObject = activeCallStream;
        localVideoRef.current.play().catch(e => console.log("Local video play failed", e));
      }
    }
  }, [activeCallStream]);

  // Initialize call sounds
  useEffect(() => {
    const ringtone = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    ringtone.loop = true;
    ringtoneRef.current = ringtone;

    const outgoingTone = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
    outgoingTone.loop = true;
    outgoingToneRef.current = outgoingTone;

    return () => {
      ringtone.pause();
      outgoingTone.pause();
    };
  }, []);

  // Handle ringtone playback
  useEffect(() => {
    if (calling?.isIncoming) {
      ringtoneRef.current?.play().catch(e => console.log("Audio play blocked", e));
      outgoingToneRef.current?.pause();
    } else if (calling && !calling.isIncoming && !calling.isConnecting && !remoteStream) {
      // Outgoing call and not connected yet
      outgoingToneRef.current?.play().catch(e => console.log("Audio play blocked", e));
      ringtoneRef.current?.pause();
    } else {
      ringtoneRef.current?.pause();
      if (ringtoneRef.current) ringtoneRef.current.currentTime = 0;
      outgoingToneRef.current?.pause();
      if (outgoingToneRef.current) outgoingToneRef.current.currentTime = 0;
    }
  }, [calling, remoteStream]);

  useEffect(() => {
    const decryptActiveGroupKey = () => {
      if (!activeChat || activeChat.type !== 'group' || !activeChat.groupKeys || !user) {
        setActiveGroupKey(null);
        return;
      }

      const localKeys = getStoredKeyPair(user.uid);
      if (!localKeys) return;

      const myEncryptedKey = activeChat.groupKeys[user.uid];
      if (!myEncryptedKey) {
        console.warn("No group key found for current user in this chat");
        setActiveGroupKey(null);
        return;
      }

      const potentialSenders = activeChat.ownerId 
        ? [activeChat.ownerId, ...activeChat.participants.filter(id => id !== activeChat.ownerId)]
        : activeChat.participants;

      for (const pId of potentialSenders) {
        const p = contacts.find(c => c.uid === pId) || (pId === user.uid ? user : null);
        if (p?.publicKey) {
          try {
            const key = decryptMessage(myEncryptedKey.content, myEncryptedKey.nonce, p.publicKey, localKeys.secretKey);
            if (key) {
              setActiveGroupKey(key);
              return;
            }
          } catch (e) {
            // Silently try next sender
          }
        }
      }
      setActiveGroupKey(null);
    };

    decryptActiveGroupKey();
  }, [activeChat?.id, activeChat?.groupKeys, user?.uid, contacts]);

  const onEmojiClick = (emojiData: any) => {
    setMessageInput(prev => prev + emojiData.emoji);
  };

  // Listen for Group Call joined states or handle mesh join
  useEffect(() => {
    if (!activeChat || activeChat.type !== 'group' || !user || calling) return;

    if (activeChat.activeCall?.status === 'active' && activeChat.activeCall.callerId !== user.uid) {
      // Someone started a call in this group! Ensure we haven't declined this session.
      const callId = activeChat.activeCall.createdAt || activeChat.id;
      if (declinedGroupCalls.includes(callId)) return;

      const callerId = activeChat.activeCall.callerId;
      const caller = contacts.find(c => c.uid === callerId);
      
      setCalling({
        type: activeChat.activeCall.type || 'video',
        user: {
          uid: activeChat.id,
          displayName: `${activeChat.name} (Started by ${activeChat.activeCall.callerName || 'Participant'})`,
          photoURL: caller?.photoURL || '',
          status: 'Join Group Call',
          isOnline: true,
          lastSeen: new Date().toISOString(),
          publicKey: ''
        },
        isIncoming: true
      });
    }
  }, [activeChat?.activeCall, user?.uid, calling, contacts, declinedGroupCalls]);

  const handleJoinGroupCall = async () => {
    if (!activeChat || !user || !activeChat.activeCall) return;

    // Explicitly set the calling screen as active, and reset any previous declined states
    const callId = activeChat.activeCall.createdAt || activeChat.id;
    setDeclinedGroupCalls(prev => prev.filter(id => id !== callId));

    setCalling({
      type: activeChat.activeCall.type || 'video',
      isIncoming: false,
      isConnecting: true,
      user: {
        uid: activeChat.id,
        displayName: `${activeChat.name} (Started by ${activeChat.activeCall.callerName || 'Participant'})`,
        photoURL: '',
        status: 'Joining Group Call...',
        isOnline: true,
        lastSeen: new Date().toISOString(),
        publicKey: ''
      }
    });

    try {
      const type = activeChat.activeCall.type || 'video';
      const constraints = getMediaConstraints(type, callQuality);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setActiveCallStream(stream);

      // In a mesh implementation, we would now call everyone else in the group
      // For this simplified logic, we call the person who started the call
      const callerId = activeChat.activeCall.callerId;
      const caller = contacts.find(c => c.uid === callerId);
      if (caller && caller.currentPeerId) {
        const targetPeerId = caller.currentPeerId;
        const { call } = await startCall(targetPeerId, type, constraints);
        // Establish data connection
        connectToPeer(targetPeerId);
        setCalling(prev => ({ ...prev!, callObj: call }));
        call.on('stream', (rStream: MediaStream) => {
          setRemoteStream(rStream);
          setCalling(prev => prev ? { ...prev, isConnecting: false } : null);
        });
        call.on('error', (err: any) => {
          console.error("Group call error:", err);
          setErrorMessage("Failed to connect to the call. The host might have disconnected.");
          cleanupCall();
        });
        call.on('close', () => cleanupCall());
      }
    } catch (err) {
      console.error("Failed to join group call:", err);
      cleanupCall();
    }
  };

  // ... (rest of the component)

  // Connection listener (handles direct calls and group auto-answering)
  useEffect(() => {
    if (!incomingCall) return;

    // Check if we are currently hosting an active group call in the active group chat
    const isHostingGroup = activeChat?.type === 'group' && 
                          activeChat.activeCall?.status === 'active' && 
                          activeChat.activeCall.callerId === user?.uid;

    if (isHostingGroup) {
      // Auto-answer incoming peer connections from people joining this group call!
      const answerGroupCall = async () => {
        try {
          console.log("Auto-answering incoming group peer stream:", incomingCall.peer);
          const type = activeChat.activeCall?.type || 'video';
          let stream = streamRef.current;
          if (!stream) {
            const constraints = getMediaConstraints(type, callQuality);
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            setActiveCallStream(stream);
          }
          
          incomingCall.answer(stream);
          
          incomingCall.on('stream', (rStream) => {
            console.log("Remote group participant stream received");
            setRemoteStream(rStream);
            setCalling(prev => prev ? { ...prev, isConnecting: false } : null);
          });

          incomingCall.on('error', (err) => {
            console.error("Group peer call error:", err);
          });

          // Store the call object in calling so we can close/teardown correctly
          setCalling(prev => prev ? { ...prev, callObj: incomingCall } : null);
        } catch (err) {
          console.error("Failed to auto-answer group participant:", err);
        }
      };
      answerGroupCall();
    } else if (!calling) {
      // Normal 1-1 direct incoming call flow
      const callerUid = incomingCall.peer.split('_')[0];
      if (user?.preferences?.blockedUsers?.includes(callerUid)) {
        console.log(`Auto-rejecting call signal from blocked workspace user: ${callerUid}`);
        incomingCall.close();
        return;
      }
      const caller = contacts.find(c => c.uid === callerUid);
      const callerProfile: UserProfile = caller || {
        uid: callerUid,
        displayName: `Unknown Unit (${callerUid.slice(0, 4)})`,
        photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${callerUid}`,
        publicKey: '',
        status: 'Identity Pending',
        isOnline: true,
        lastSeen: new Date().toISOString()
      };
      
      setCalling({ 
        type: 'video', // PeerJS default for this app
        user: callerProfile, 
        isIncoming: true, 
        callObj: incomingCall 
      });

      // Set incoming ring timeout (e.g., 45 sec of unanswered ringing)
      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        console.log("Incoming call ring timeout");
        handleDeclineCall('timeout');
      }, 45000);

      incomingCall.on('close', () => {
        console.log("Peer call closed by remote");
        cleanupCall();
      });
      incomingCall.on('error', (err: any) => {
        console.error("Call object error:", err);
        cleanupCall();
      });
    }
  }, [incomingCall, contacts, calling, activeChat, user, callQuality]);

  // Clear ringing timeout when the audio/video stream is established
  useEffect(() => {
    if (remoteStream && callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, [remoteStream]);

  // Presence Heartbeat & Window Events
  useEffect(() => {
    if (!user) return;
    
    const userRef = doc(db, 'users', user.uid);
    
    const setPresence = async (online: boolean) => {
      try {
        await updateDoc(userRef, { 
          isOnline: online, 
          lastSeen: new Date().toISOString() 
        });
      } catch (err: any) {
      console.error("Presence update failed", err);
      if (err.message?.includes('Quota exceeded')) {
        setErrorMessage("Firestore Quota Exceeded. The app will resume once limits reset (usually daily at midnight).");
      }
    }
  };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPresence(true);
      } else {
        // We don't necessarily want to set offline just because tab is inactive
        // but it can help PeerJS stability if we know they aren't actively looking
      }
    };

    const handleUnload = () => {
      // Use navigator.sendBeacon if needed, but Firestore update is async and might fail here
      // But we can try one last updateDoc. Fire and forget basically.
      updateDoc(userRef, { isOnline: false, lastSeen: new Date().toISOString() });
    };

    window.addEventListener('beforeunload', handleUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Heartbeat to keep online status fresh
    const heartbeat = setInterval(() => {
      const data: any = { isOnline: true, lastSeen: new Date().toISOString() };
      // Also re-sync myPeerId just in case it was cleared by another tab
      if (myPeerId) data.currentPeerId = myPeerId;
      
      updateDoc(userRef, data).catch(err => {
        if (err.message?.includes('Quota exceeded')) {
          setErrorMessage("Firestore Quota Exceeded.");
        }
      });
    }, 60000); // every minute

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (heartbeat) clearInterval(heartbeat);
      // We don't set presence to false here because it triggers on every tab switch/inactive state
      // We rely on the initial useAuth cleanup or explicit logout for offline status
    };
  }, [user?.uid]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const prevChatsRef = useRef<ChatSession[]>([]);

  // Load Chats and Notifications
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const chatData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
      
      // Check for updates in chats that are not the current one
      chatData.forEach(chat => {
        const prevChat = prevChatsRef.current.find(pc => pc.id === chat.id);
        const isMuted = user?.preferences?.mutedChats?.includes(chat.id);
        const lastMessageSender = chat.lastMessage?.split(':')[0]?.trim() || '';
        const isSenderBlocked = user?.preferences?.blockedUsers?.includes(lastMessageSender);

        if (prevChat && chat.updatedAt !== prevChat.updatedAt && chat.id !== activeChat?.id && !isMuted && !isSenderBlocked) {
          // A different chat was updated!
          if (notificationSound.current) {
            notificationSound.current.play().catch(() => {});
          }

          if (document.visibilityState === 'hidden' && "Notification" in window && Notification.permission === "granted") {
            new Notification(`New message in ${chat.name || 'Secure Chat'}`, {
              body: chat.lastMessage || "Identity payload received.",
              icon: '/favicon.ico'
            });
          }
        }
      });
      
      prevChatsRef.current = chatData;
      setChats(chatData);

      // Dynamically sync active chat fields when they update in Firestore
      if (activeChat) {
        const found = chatData.find(c => c.id === activeChat.id);
        if (found) {
          const hasChanged = JSON.stringify(found.typing) !== JSON.stringify(activeChat.typing) ||
                            found.lastMessage !== activeChat.lastMessage ||
                            found.updatedAt !== activeChat.updatedAt ||
                            JSON.stringify(found.activeCall) !== JSON.stringify(activeChat.activeCall);
          if (hasChanged) {
            setActiveChat(found);
          }
        }
      }
    }, (error) => {
      if (!error.message.includes('Quota exceeded')) {
        handleFirestoreError(error, OperationType.LIST, 'chats');
      } else {
        setErrorMessage("Secure sync paused due to environment limits.");
      }
    });
    return unsubscribe;
  }, [user?.uid, activeChat?.id]);

  useEffect(() => {
    if ("Notification" in window) {
      Notification.requestPermission();
    }
  }, []);

  // Load Messages for Active Chat
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, `chats/${activeChat.id}/messages`), 
      orderBy('createdAt', 'asc'),
      limit(50)
    );
    
    const loadedIds = new Set<string>();
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageType));
      
      // Mark unread messages as read when active chat is open
      if (user?.uid) {
        msgData.forEach(async (msg) => {
          if (msg.senderId !== user.uid && !msg.isRead) {
            try {
              await updateDoc(doc(db, `chats/${activeChat.id}/messages`, msg.id), {
                isRead: true
              });
            } catch (e) {
              console.warn("Could not mark message as read:", e);
            }
          }
        });
      }

      // Notification for new messages
      if (!isInitialLoad && msgData.length > 0) {
        const lastMsg = msgData[msgData.length - 1];
        const isNewMessage = !loadedIds.has(lastMsg.id);
        if (isNewMessage) {
          const isMuted = user?.preferences?.mutedChats?.includes(activeChat.id);
          const isBlocked = user?.preferences?.blockedUsers?.includes(lastMsg.senderId);

          if (lastMsg.senderId !== user?.uid && !isMuted && !isBlocked) {
            // Play notification sound
            if (notificationSound.current) {
              notificationSound.current.play().catch(() => {});
            }

            if (document.visibilityState === 'hidden' && "Notification" in window && Notification.permission === "granted") {
              new Notification("New Message in Memuer", {
                body: lastMsg.senderId === 'memuer-ai' ? "Memuer AI replied" : "Secure Message Received",
                icon: '/favicon.ico'
              });
            }
          }
        }
      }
      
      // Populate seen IDs
      msgData.forEach(m => loadedIds.add(m.id));
      isInitialLoad = false;
      
      setMessages(msgData);
    }, (error) => {
      if (!error.message.includes('Quota exceeded')) {
        handleFirestoreError(error, OperationType.LIST, `chats/${activeChat.id}/messages`);
      }
    });
    return unsubscribe;
  }, [activeChat?.id, user?.uid]);

  // Ensure we have current profiles for all participants in the active chat
  useEffect(() => {
    if (!activeChat || !user) return;
    activeChat.participants.forEach(async (uid) => {
      if (uid === user.uid) return;
      if (!contacts.some(c => c.uid === uid)) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const profile = userDoc.data() as UserProfile;
            setContacts(prev => prev.some(c => c.uid === profile.uid) ? prev : [...prev, profile]);
          }
        } catch (err) {
          console.error("Failed to fetch participant profile:", err);
        }
      }
    });
  }, [activeChat?.id, user?.uid]);

  // Load Users/Directory
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'users'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const userData = snap.docs
        .map(doc => doc.data() as UserProfile)
        .filter(u => u.uid !== user?.uid);
      setContacts(userData);
    }, (error) => {
      if (!error.message.includes('Quota exceeded')) {
        handleFirestoreError(error, OperationType.LIST, 'users');
      }
    });
    return unsubscribe;
  }, [user?.uid]);

  // Load Friend Requests
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'friendRequests'), 
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, async (snap) => {
      const requests = await Promise.all(snap.docs.map(async (d) => {
        const data = d.data() as FriendRequest;
        const senderSnap = await getDoc(doc(db, 'users', data.from));
        return { 
          id: d.id, 
          ...data, 
          senderProfile: senderSnap.exists() ? senderSnap.data() as UserProfile : undefined 
        };
      }));
      setFriendRequests(requests);
      
      if (requests.length > friendRequests.length) {
        // Notification for new request
        if ("Notification" in window && Notification.permission === 'granted' && document.visibilityState === 'hidden') {
          new Notification("New Connection Request", {
            body: `${requests[requests.length - 1].senderProfile?.displayName || 'Someone'} wants to connect securely.`,
            icon: '/favicon.ico'
          });
        }
      }
    }, (error) => {
      if (!error.message.includes('Quota exceeded')) {
        handleFirestoreError(error, OperationType.LIST, 'friendRequests');
      }
    });
    return unsubscribe;
  }, [user?.uid]);

  const sendFriendRequest = async (targetUid: string) => {
    if (!user) return;
    try {
      // Check if already friends or request pending
      const existingReqQ = query(
        collection(db, 'friendRequests'),
        where('from', '==', user.uid),
        where('to', '==', targetUid),
        where('status', 'in', ['pending', 'accepted'])
      );
      const existingReqSnap = await getDocs(existingReqQ);
      if (!existingReqSnap.empty) {
        setErrorMessage("Request already exists or already connected.");
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }

      await addDoc(collection(db, 'friendRequests'), {
        from: user.uid,
        to: targetUid,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setErrorMessage("Handshake signal sent.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'friendRequests');
    }
  };

  const acceptFriendRequest = async (request: FriendRequest) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'friendRequests', request.id), {
        status: 'accepted'
      });
      
      // Start DM automatically
      const senderProfile = request.senderProfile || await getDoc(doc(db, 'users', request.from)).then(d => d.data() as UserProfile);
      if (senderProfile) {
        startDM(senderProfile);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `friendRequests/${request.id}`);
    }
  };

  const declineFriendRequest = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'friendRequests', requestId), {
        status: 'declined'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `friendRequests/${requestId}`);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!messageInput.trim() || !activeChat || !user) return;

    const currentInput = messageInput;
    setMessageInput('');

    // If AI mentioned
    if (currentInput.startsWith('@ai') || currentInput.startsWith('@memuer')) {
      const prompt = currentInput.replace(/^@\w+\s*/, '');
      // Add user's message (plain for AI for now, but encrypted for others)
      // For simplicity in this E2EE demo, we'll store AI interaction as a special type or just plaintext for the "Memuer AI" user
    }

    // Encryption logic
    let localKeys = getStoredKeyPair(user.uid);
    if (!localKeys) {
      localKeys = generateKeyPair();
      storeKeyPair(user.uid, localKeys);
    }

    let encryptedData: { content: string; nonce: string } | null = null;
    let isEncrypted = false;
    const isAIChat = activeChat.id.startsWith('ai_');
    const recipientId = activeChat.type === 'direct' ? activeChat.participants.find(id => id !== user.uid) : undefined;
    const isDMWithAI = activeChat.type === 'direct' && recipientId === 'memuer-ai';

    if (isAIChat) {
      encryptedData = encryptMessage(currentInput, '', '');
      isEncrypted = true;
    } else if (activeChat.type === 'direct') {
      const recipient = contacts.find(c => c.uid === recipientId);
      if (recipient && recipient.publicKey && localKeys) {
        encryptedData = encryptMessage(currentInput, recipient.publicKey, localKeys.secretKey);
        isEncrypted = true;
      } else if (recipientId === 'memuer-ai') {
        encryptedData = encryptMessage(currentInput, '', '');
        isEncrypted = true;
      } else {
        // Safe encoding fallback so message sending is NEVER blocked
        encryptedData = encryptMessage(currentInput, '', '');
        isEncrypted = true;
      }
    } else if (activeChat.type === 'group') {
      if (activeGroupKey) {
        encryptedData = encryptSymmetric(currentInput, activeGroupKey);
        isEncrypted = true;
      } else {
        // Safe encoding fallback so group messages can be sent even if key-sharing is pending
        encryptedData = encryptMessage(currentInput, '', '');
        isEncrypted = true;
      }
    }
    
    if (isEncrypted && encryptedData) {
      try {
        await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
          chatId: activeChat.id,
          senderId: user.uid,
          content: encryptedData.content,
          nonce: encryptedData.nonce,
          type: 'text',
          createdAt: new Date().toISOString()
        });

        // Update last message in chat (plaintext for preview if desired, or encrypted)
        // We'll use plaintext for the sidebar preview as a fallback in this demo
        await updateDoc(doc(db, 'chats', activeChat.id), {
          lastMessage: currentInput.slice(0, 50),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}/messages`);
      }
    }

    // AI Trigger
    if (isAIChat || isDMWithAI || currentInput.includes('@ai') || currentInput.includes('@memuer')) {
      const chatRef = doc(db, 'chats', activeChat.id);
      
      // Update typing indicator with robust fallback if 'typing' Map is missing on document
      try {
        await updateDoc(chatRef, { [`typing.memuer-ai`]: true });
      } catch (typingErr) {
        console.warn("Retrying typing indicator with whole map structure");
        try {
          await updateDoc(chatRef, { typing: { 'memuer-ai': true } });
        } catch (e) {
          console.error("Failed to set typing status", e);
        }
      }

      try {
        // Safe context preparation: decrypt history so Gemini receives plaintext not base64 gibberish
        const localKeys = getStoredKeyPair(user.uid);
        const decryptedHistory = messages.slice(-6).map(m => {
          const isMsgMe = m.senderId === user.uid;
          const isMsgAI = m.senderId === 'memuer-ai';
          let contentStr = m.content;
          
          if (!isMsgAI && m.nonce && m.nonce !== 'system-msg' && localKeys) {
            try {
              if (activeChat.type === 'direct') {
                const otherParticipantId = activeChat.participants.find(id => id !== user.uid);
                const otherUser = contacts.find(c => c.uid === m.senderId);
                const historicalKey = activeChat.participantKeys?.[m.senderId === user.uid ? (otherParticipantId || '') : m.senderId];
                const liveKey = otherUser?.publicKey || contacts.find(c => c.uid === (isMsgMe ? otherParticipantId : m.senderId))?.publicKey;

                let dec = null;
                if (historicalKey && !historicalKey.startsWith('mock-')) {
                  dec = decryptMessage(m.content, m.nonce, historicalKey, localKeys.secretKey);
                }
                if (!dec && liveKey && liveKey !== historicalKey && !liveKey.startsWith('mock-')) {
                  dec = decryptMessage(m.content, m.nonce, liveKey, localKeys.secretKey);
                }
                if (!dec && isMsgMe && user.publicKey) {
                  dec = decryptMessage(m.content, m.nonce, user.publicKey, localKeys.secretKey);
                }
                if (dec) contentStr = dec;
              } else if (activeChat.type === 'group' && activeGroupKey) {
                const dec = decryptSymmetric(m.content, m.nonce, activeGroupKey);
                if (dec) contentStr = dec;
              }
            } catch (e) {
              try {
                contentStr = atob(m.content);
              } catch (_) {}
            }
          } else if (!isMsgAI && !m.nonce && m.content) {
            try {
              if (/^[A-Za-z0-9+/=\s]+$/.test(m.content) && !m.content.includes(' ')) {
                const dec = decryptMessage(m.content, '', '', '');
                if (dec !== "[Undecryptable Message due to key mismatch]") {
                  contentStr = dec;
                }
              }
            } catch (_) {
              try {
                contentStr = atob(m.content);
              } catch (__) {}
            }
          } else if (m.nonce === 'plain') {
            try {
              contentStr = atob(m.content);
            } catch (_) {}
          }
          
          const senderLabel = isMsgAI ? 'Memuer AI' : (isMsgMe ? 'User' : 'Other Participant');
          return `${senderLabel}: ${contentStr}`;
        }).join('\n');

        // Clean user prompt (strip out AI mention tags)
        const cleanPrompt = currentInput.replace(/@memuer/gi, '').replace(/@ai/gi, '').trim();

        const isAIShutDownObj = systemConfig?.disableAI && 
          (!systemConfig.disableAIUntil || new Date(systemConfig.disableAIUntil) > new Date()) &&
          !isUserExempt;
        
        const aiResponse = isAIShutDownObj 
          ? "⚠️ [AI Subsystem Offline] The administrators have temporarily suspended neural services for optimization or maintenance."
          : await askAI(cleanPrompt, decryptedHistory);
        
        await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
          chatId: activeChat.id,
          senderId: 'memuer-ai',
          content: aiResponse,
          nonce: '',
          type: 'text',
          createdAt: new Date().toISOString()
        });

        // Update last message
        await updateDoc(chatRef, { 
          lastMessage: aiResponse.slice(0, 50),
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error("AI Response error:", error);
      } finally {
        // Clear AI typing safely
        try {
          await updateDoc(chatRef, { [`typing.memuer-ai`]: false });
        } catch (e) {
          // Ignore
        }
      }
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
    let timeoutId: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error("Storage handshake threshold reached. Initiating secure base64 local proxy..."));
      }, ms);
    });
    return Promise.race([promise, timeoutPromise]).then(
      (result) => {
        clearTimeout(timeoutId);
        return result;
      },
      (error) => {
        clearTimeout(timeoutId);
        throw error;
      }
    );
  }

  const compressImageForDirectSync = (file: File): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          
          // Maintain aspect ratio with max dimension 1000px for conservative size
          const MAX_DIM = 1000;
          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress to 0.65 quality JPG for an extremely lightweight payload (< 300KB usually)
            const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
            resolve(dataUrl);
          } else {
            resolve(event.target?.result as string);
          }
        };
        img.onerror = () => {
          resolve(event.target?.result as string);
        };
      };
      reader.onerror = (readErr) => reject(readErr);
    });
  };

  const uploadInChunksWithRetries = async (file: File, maxRetries = 3): Promise<string> => {
    const chunkSize = 1024 * 512; // 512KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize);
    const uploadId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunkBlob = file.slice(start, end);

      const chunkData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(chunkBlob);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
      });

      let attempt = 0;
      let success = false;
      let resData: any = null;

      while (attempt < maxRetries && !success) {
        try {
          const response = await fetch("/api/upload/chunk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              uploadId,
              chunkIndex: index,
              totalChunks,
              chunkData,
              filename: file.name
            })
          });

          if (!response.ok) {
            throw new Error(`Status ${response.status}`);
          }

          resData = await response.json();
          success = true;
        } catch (err) {
          attempt++;
          console.warn(`Chunk ${index + 1}/${totalChunks} upload attempt ${attempt} failed:`, err);
          if (attempt >= maxRetries) {
            throw new Error(`Chunk upload ${index + 1}/${totalChunks} failed after ${maxRetries} attempts.`);
          }
          // Exponential backoff
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
        }
      }

      if (resData?.completed && resData?.url) {
        return resData.url;
      }
    }

    throw new Error("Upload succeeded but no completed file URL was returned.");
  };

  const uploadImageToImgBB = async (file: File): Promise<string> => {
    // 1. Try server-side proxy upload first
    try {
      console.log("Attempting server-side ImgBB proxy upload...");
      const fileData = await fileToBase64(file);
      const res = await fetch("/api/upload-imgbb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      if (res.ok) {
        const resJson = await res.json();
        if (resJson && resJson.url) {
          console.log("Server-side ImgBB proxy upload succeeded:", resJson.url);
          return resJson.url;
        }
      }
    } catch (err) {
      console.warn("Server-side ImgBB proxy upload failed, attempting client direct upload:", err);
    }

    // 2. Fall back to client-side direct upload
    const apiKey = import.meta.env.VITE_IMGBB_API_KEY;
    if (!apiKey) {
      throw new Error("Neither server-side nor client-side ImgBB is configured.");
    }

    const formData = new FormData();
    formData.append("image", file);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `ImgBB API status ${response.status}`);
    }

    const data = await response.json();
    if (data && data.success && data.data && data.data.url) {
      return data.data.url;
    } else {
      throw new Error("ImgBB did not return a valid direct image URL.");
    }
  };

  const uploadVideoToSupabase = async (file: File): Promise<string> => {
    // 1. Try server-side proxy upload first
    try {
      console.log("Attempting server-side Supabase video proxy upload...");
      const fileData = await fileToBase64(file);
      const res = await fetch("/api/upload-supabase-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, fileData, mimeType: file.type }),
      });
      if (res.ok) {
        const resJson = await res.json();
        if (resJson && resJson.url) {
          console.log("Server-side Supabase video proxy upload succeeded:", resJson.url);
          return resJson.url;
        }
      }
    } catch (err) {
      console.warn("Server-side Supabase video proxy upload failed, attempting client direct upload:", err);
    }

    // 2. Fall back to client-side direct upload
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Supabase is not configured. VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const uniquePath = `${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('videos')
      .upload(uniquePath, file);

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Supabase storage upload completed but returned no data.");
    }

    const publicUrlResult = supabase.storage.from('videos').getPublicUrl(data.path);
    const publicUrl = publicUrlResult?.data?.publicUrl;
    if (!publicUrl) {
      throw new Error("Could not retrieve a valid public URL for the uploaded video.");
    }

    return publicUrl;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;

    const isVideoFile = file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);
    const tempUrl = URL.createObjectURL(file);

    try {
      setUploading(true);
      setUploadPreview({
        name: file.name,
        url: tempUrl,
        size: file.size,
        isVideo: isVideoFile
      });

      let url = "";
      let fileData = "";

      if (isVideoFile) {
        // Strict Supabase upload routing for videos
        try {
          console.log("Initiating Supabase Storage upload for chat video:", file.name);
          const supabaseUrl = await uploadVideoToSupabase(file);
          console.log("Uploaded successfully via Supabase Storage:", supabaseUrl);
          url = supabaseUrl;
        } catch (supabaseErr: any) {
          console.error("Supabase video upload failed:", supabaseErr);
          throw new Error(`Supabase video upload failed: ${supabaseErr.message || supabaseErr}`);
        }
      } else {
        // 1. Try ImgBB if it's an image and key is configured
        if (file.type.startsWith("image/")) {
          try {
            console.log("Initiating ImgBB upload for chat image:", file.name);
            url = await uploadImageToImgBB(file);
            console.log("Uploaded successfully via ImgBB:", url);
          } catch (imgbbErr) {
            console.warn("ImgBB upload failed, falling back to local server:", imgbbErr);
          }
        }

        // 2. If not uploaded yet, use local chunked server upload
        if (!url) {
          try {
            console.log("Initiating robust chunked upload for: ", file.name);
            url = await uploadInChunksWithRetries(file, 3);
            console.log("Successfully uploaded via chunked retry engine: ", url);
          } catch (chunkError) {
            console.warn("Chunked upload pipeline failed, attempting single payload endpoint fallback...", chunkError);
            
            fileData = await fileToBase64(file);
            let singleAttempt = 0;
            const maxSingleAttempts = 3;
            while (singleAttempt < maxSingleAttempts && !url) {
              try {
                const response = await fetch("/api/upload", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    filename: file.name,
                    fileData,
                    mimeType: file.type
                  })
                });

                if (response.ok) {
                  const data = await response.json();
                  if (data && data.url) {
                    url = data.url;
                    console.log("Successfully uploaded to local container via single POST: ", url);
                  }
                } else {
                  throw new Error(`Status ${response.status}`);
                }
              } catch (singleErr) {
                singleAttempt++;
                console.warn(`Single POST upload attempt ${singleAttempt} failed:`, singleErr);
                if (singleAttempt < maxSingleAttempts) {
                  await new Promise((r) => setTimeout(r, singleAttempt * 1000));
                }
              }
            }
          }
        }

        // 3. Last resort local / Firestore binary payload fallback (so it NEVER fails)
        if (!url) {
          if (!fileData) {
            fileData = await fileToBase64(file);
          }
          // If it is an image, we can adaptively compress it so it ALWAYS fits in the 1MB Firestore document limit
          if (file.type.startsWith("image/")) {
            try {
              console.log("Compressing image client-side to fit within direct-sync Firestore size constraints...");
              url = await compressImageForDirectSync(file);
            } catch (compressErr) {
              console.warn("Image compression failed, using raw base64 data:", compressErr);
              if (file.size < 950 * 1024) {
                url = fileData;
              } else {
                url = URL.createObjectURL(file);
                setErrorMessage("File exceeds 1MB limit for direct-sync. Storing local preview in active session.");
                setTimeout(() => setErrorMessage(null), 5000);
              }
            }
          } else {
            // If file is under 1.5MB, we can store it directly in Firestore as the Base64 data URL
            if (file.size < 1.5 * 1024 * 1024) {
              url = fileData;
            } else {
              // If the file is too large for Firestore limit, use standard object URL
              // This keeps the file accessible in their current dashboard session safely.
              url = URL.createObjectURL(file);
              setErrorMessage("File exceeds size limit for direct-sync. Storing local preview in active session.");
              setTimeout(() => setErrorMessage(null), 5000);
            }
          }
        }
      }

      if (!url) {
        throw new Error("Could not assemble a secure URL for the file.");
      }

      // In a real E2EE app, we'd encrypt the file itself or at least the URL.
      // For this demo, we'll store the metadata and just encrypt a notice.
      const localKeys = getStoredKeyPair(user.uid);
      if (!localKeys) return;

      let encryptedData: { content: string; nonce: string } | null = null;
      let isEncrypted = false;
      const notice = `Shared a file: ${file.name}`;

      if (activeChat.type === 'direct') {
        const recipientId = activeChat.participants.find(id => id !== user.uid);
        const recipient = contacts.find(c => c.uid === recipientId);
        if (recipient && recipient.publicKey) {
          encryptedData = encryptMessage(notice, recipient.publicKey, localKeys.secretKey);
          isEncrypted = true;
        }
      } else if (activeChat.type === 'group' && activeGroupKey) {
        encryptedData = encryptSymmetric(notice, activeGroupKey);
        isEncrypted = true;
      }

      if (isEncrypted && encryptedData) {
        try {
          await addDoc(collection(db, `chats/${activeChat.id}/messages`), {
            chatId: activeChat.id,
            senderId: user.uid,
            content: encryptedData.content,
            nonce: encryptedData.nonce,
            type: 'file',
            fileMetadata: {
              name: file.name,
              size: file.size,
              mimeType: file.type,
              storagePath: url // Direct secure URL (never a blob: for video!)
            },
            createdAt: new Date().toISOString()
          });
          
          await updateDoc(doc(db, 'chats', activeChat.id), {
            lastMessage: `📁 ${file.name}`,
            updatedAt: new Date().toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `chats/${activeChat.id}/messages`);
        }
      }

      // Cleanup preview state
      URL.revokeObjectURL(tempUrl);
      setUploadPreview(null);
    } catch (err: any) {
      console.error("Upload failed entirely:", err);
      setErrorMessage(`Upload failed: ${err.message || err}`);
      setTimeout(() => setErrorMessage(null), 5000);
      URL.revokeObjectURL(tempUrl);
      setUploadPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const createGroup = async () => {
    if (!user || selectedForGroup.length === 0) return;
    
    const localKeys = getStoredKeyPair(user.uid);
    if (!localKeys || !user.publicKey) {
      setErrorMessage("Encryption profile required. Check settings.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    
    try {
      const participants = [user.uid, ...selectedForGroup];
      const groupSymmetricKey = generateSymmetricKey();
      
      const groupKeys: Record<string, { content: string; nonce: string }> = {};
      const participantKeys: Record<string, string> = {
        [user.uid]: user.publicKey
      };
      
      // Encrypt group key for each participant
      for (const pId of participants) {
        let pubKey = '';
        if (pId === user.uid) {
           pubKey = user.publicKey;
        } else {
           const contact = contacts.find(c => c.uid === pId);
           pubKey = contact?.publicKey || '';
           if (pubKey) participantKeys[pId] = pubKey;
        }

        if (pubKey) {
          const encrypted = encryptMessage(groupSymmetricKey, pubKey, localKeys.secretKey);
          groupKeys[pId] = encrypted;
        }
      }

      await addDoc(collection(db, 'chats'), {
        name: groupName || 'New Group Chat',
        type: 'group',
        ownerId: user.uid,
        participants,
        groupKeys,
        participantKeys,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      setIsGroupModalOpen(false);
      setGroupName('');
      setSelectedForGroup([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const startDM = useCallback(async (otherUser: UserProfile) => {
    if (!user?.uid) return;
    
    // Deterministic ID for direct chats to avoid duplicates
    const participants = [user.uid, otherUser.uid].sort();
    const dmId = `dm_${participants[0]}_${participants[1]}`;
    
    try {
      const chatDoc = await getDoc(doc(db, 'chats', dmId));
      
      if (chatDoc.exists()) {
        const existing = { id: chatDoc.id, ...chatDoc.data() } as ChatSession;
        setActiveChat(existing);
        return;
      }

      // Create new with deterministic ID
      const chatData = {
        type: 'direct',
        participants,
        participantKeys: {
          [user.uid]: user.publicKey || 'mock-primary-key',
          [otherUser.uid]: otherUser.publicKey || 'mock-target-key'
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'chats', dmId), chatData);
      setActiveChat({ id: dmId, ...chatData } as ChatSession);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${dmId}`);
    }
  }, [user?.uid]);

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!activeChat || !user) return;
    const messageDoc = doc(db, `chats/${activeChat.id}/messages`, messageId);
    try {
      const snap = await getDoc(messageDoc);
      if (!snap.exists()) return;
      const data = snap.data();
      const currentReactions = (data.reactions || {}) as Record<string, string[]>;
      const emojiUsers = currentReactions[emoji] || [];
      
      let nextEmojiUsers = [...emojiUsers];
      if (emojiUsers.includes(user.uid)) {
        nextEmojiUsers = nextEmojiUsers.filter(uid => uid !== user.uid);
      } else {
        nextEmojiUsers.push(user.uid);
      }

      const nextReactions = { ...currentReactions };
      if (nextEmojiUsers.length > 0) {
        nextReactions[emoji] = nextEmojiUsers;
      } else {
        delete nextReactions[emoji];
      }

      await updateDoc(messageDoc, { reactions: nextReactions });
    } catch (err) {
      console.error("Failed to update reaction:", err);
    } finally {
      setReactingTo(null);
    }
  };

  // --- Admin Console Operations ---
  const handleAdminBanUser = async (uid: string, durationMinutes: number | 'perm', targetRole?: string, targetEmail?: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const isTargetHeadOwner = targetEmail === 'koke.kozkoz@gmail.com' || targetRole?.toLowerCase() === 'headowner';
    if (isTargetHeadOwner && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can ban or suspend a Head Owner.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      let bannedUntilStr = '';
      if (durationMinutes === 'perm') {
        bannedUntilStr = 'permanent';
      } else {
        const d = new Date();
        d.setMinutes(d.getMinutes() + durationMinutes);
        bannedUntilStr = d.toISOString();
      }
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { bannedUntil: bannedUntilStr });
      setErrorMessage(`User suspended successfully.`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to suspend user: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminUnbanUser = async (uid: string, targetRole?: string, targetEmail?: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const isTargetHeadOwner = targetEmail === 'koke.kozkoz@gmail.com' || targetRole?.toLowerCase() === 'headowner';
    if (isTargetHeadOwner && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can lift suspension for a Head Owner.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { bannedUntil: '' });
      setErrorMessage("Suspension lifted successfully.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to lift suspension: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminToggleHideFromDirectory = async (uid: string, currentValue?: boolean) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { isHiddenFromDirectory: !currentValue });
      setErrorMessage(`User visibility updated: ${!currentValue ? 'Hidden from Global Directory' : 'Visible globally'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to change visibility: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminToggleCanMessageAnyone = async (uid: string, currentValue?: boolean) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { canMessageAnyone: !currentValue });
      setErrorMessage(`User message privileges updated: ${!currentValue ? 'Can Message Anyone' : 'Standard Connection Limits'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update msg privilege: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminRenameUser = async (uid: string, newName: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!newName.trim()) return;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { displayName: newName });
      setEditingUserId(null);
      setEditingUserName('');
      setErrorMessage(`User renamed to: ${newName}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to rename user: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminUpdateUserBio = async (uid: string, newBio: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { status: newBio });
      setEditingUserBioId(null);
      setEditingUserBio('');
      setErrorMessage("User biography updated successfully.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update biography: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminDeleteContactMessage = async (msgId: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'contact_messages', msgId));
      setErrorMessage("Support inquiry purged from database successfully.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to delete support inquiry: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminReplySupport = async (msgId: string, reply: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!reply.trim()) return;
    try {
      const msgRef = doc(db, 'contact_messages', msgId);
      await updateDoc(msgRef, {
        replied: true,
        replyMessage: reply.trim(),
        repliedAt: serverTimestamp(),
        repliedBy: user?.displayName || 'Administrator',
        userHasSeenReply: false
      });
      setReplyingToMessageId(null);
      setAdminSupportReplyText('');
      setErrorMessage("Reply successfully synced to support vaults.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to submit support reply: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminSetRole = async (uid: string, newRole: string, targetEmail?: string, currentRole?: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const isTargetHeadOwner = targetEmail === 'koke.kozkoz@gmail.com' || currentRole?.toLowerCase() === 'headowner';
    if (isTargetHeadOwner && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can modify the role of a Head Owner.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (newRole === 'headowner' && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can grant the Head Owner role.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { role: newRole });
      setErrorMessage(`Role modified to ${newRole}`);
      setTimeout(() => setErrorMessage(null), 3000);
      setRoleMenuUserId(null);
    } catch (err: any) {
      setErrorMessage(`Failed to change role: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminToggleRole = async (uid: string, currentRole?: string, targetEmail?: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const isTargetHeadOwner = targetEmail === 'koke.kozkoz@gmail.com' || currentRole?.toLowerCase() === 'headowner';
    if (isTargetHeadOwner && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can modify the role of a Head Owner.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      let nextRole = 'user';
      if (!currentRole || currentRole === 'user') {
        nextRole = 'tester';
      } else if (currentRole === 'tester') {
        nextRole = 'callcenter';
      } else if (currentRole === 'callcenter') {
        nextRole = 'admin';
      } else if (currentRole === 'admin') {
        nextRole = 'owner';
      } else if (currentRole === 'owner') {
        if (isHeadOwnerMe) {
          nextRole = 'headowner';
        } else {
          nextRole = 'user';
        }
      } else if (currentRole === 'headowner') {
        if (isHeadOwnerMe) {
          nextRole = 'user';
        } else {
          setErrorMessage("Only a Head Owner can modify a Head Owner.");
          setTimeout(() => setErrorMessage(null), 3000);
          return;
        }
      }
      await updateDoc(userRef, { role: nextRole });
      setErrorMessage(`Role modified to ${nextRole}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to change role: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminDeleteUser = async (uid: string, targetRole?: string, targetEmail?: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Restricted to structural owners.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    const isTargetHeadOwner = targetEmail === 'koke.kozkoz@gmail.com' || targetRole?.toLowerCase() === 'headowner';
    if (isTargetHeadOwner && !isHeadOwnerMe) {
      setErrorMessage("Forbidden: Only a Head Owner can delete a Head Owner.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', uid));
      setErrorMessage("User completely purged from the directory database.");
      setTimeout(() => setErrorMessage(null), 3000);
      if (deletingUserId === uid) {
        setDeletingUserId(null);
      }
    } catch (err: any) {
      setErrorMessage(`Failed to purge user: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Load Admin Social+ moderation feeds in real-time
  useEffect(() => {
    if (!db || !isUserAdminMe || !isAdminPanelOpen) return;

    const handleSnapshotErr = (err: any) => {
      if (err?.code === 'resource-exhausted' || err?.message?.includes('Quota limit exceeded') || err?.message?.includes('Quota exceeded')) {
        console.warn("Admin social moderation feed sync paused due to environment limits.");
      } else {
        console.warn("Admin social moderation feed sync error:", err);
      }
    };

    const postsQuery = collection(db, 'social_posts');
    const unsubscribePosts = onSnapshot(postsQuery, (snapshot) => {
      const postsData: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        postsData.push({
          id: doc.id,
          username: data.username || '',
          userAvatar: data.userAvatar || '',
          image: data.image || '',
          caption: data.caption || '',
          location: data.location || '',
          likes: data.likes || 0,
          likedBy: data.likedBy || [],
          comments: data.comments || [],
          createdAt: data.createdAt || '',
          ownerId: data.ownerId || ''
        });
      });
      postsData.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setAdminPosts(postsData);
    }, handleSnapshotErr);

    const shortsQuery = collection(db, 'social_shorts');
    const unsubscribeShorts = onSnapshot(shortsQuery, (snapshot) => {
      const shortsData: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        shortsData.push({
          id: doc.id,
          username: data.username || '',
          userAvatar: data.userAvatar || '',
          videoUrl: data.videoUrl || '',
          caption: data.caption || '',
          musicTitle: data.musicTitle || '',
          likes: data.likes || 0,
          likedBy: data.likedBy || [],
          commentsCount: data.commentsCount || 0,
          createdAt: data.createdAt || '',
          ownerId: data.ownerId || ''
        });
      });
      shortsData.sort((a, b) => b.id.localeCompare(a.id));
      setAdminShorts(shortsData);
    }, handleSnapshotErr);

    const auditQuery = collection(db, 'social_audit_logs');
    const unsubscribeAudit = onSnapshot(auditQuery, (snapshot) => {
      const auditData: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        auditData.push({ id: doc.id, ...data });
      });
      auditData.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setAdminAuditLogs(auditData);
    }, handleSnapshotErr);

    const reportsQuery = collection(db, 'social_reports');
    const unsubscribeReports = onSnapshot(reportsQuery, (snapshot) => {
      const reportsData: any[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        reportsData.push({ id: doc.id, ...data });
      });
      reportsData.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      setAdminReports(reportsData);
    }, handleSnapshotErr);

    return () => {
      unsubscribePosts();
      unsubscribeShorts();
      unsubscribeAudit();
      unsubscribeReports();
    };
  }, [db, isUserAdminMe, isAdminPanelOpen]);

  const handleAdminRemoveSocialContent = async (type: 'post' | 'short', id: string, creatorUsername: string, creatorId?: string) => {
    if (!adminRemovalReason.trim()) {
      alert("Please provide a reason for removing this content.");
      return;
    }

    try {
      if (type === 'post') {
        await deleteDoc(doc(db, 'social_posts', id));
      } else {
        await deleteDoc(doc(db, 'social_shorts', id));
      }

      // Record to audit logs collection
      await addDoc(collection(db, 'social_audit_logs'), {
        itemId: id,
        itemType: type,
        creatorUsername: creatorUsername,
        creatorId: creatorId || 'unknown',
        moderatorUsername: user?.displayName || user?.email || auth.currentUser?.email || 'System Admin',
        moderatorId: auth.currentUser?.uid || 'system',
        reason: adminRemovalReason,
        createdAt: new Date().toISOString()
      });

      // Automatically resolve associated pending reports
      const pendingReportsToResolve = adminReports.filter(r => r.itemId === id && r.status === 'pending');
      for (const rep of pendingReportsToResolve) {
        await updateDoc(doc(db, 'social_reports', rep.id), {
          status: 'resolved',
          resolvedAt: new Date().toISOString(),
          resolvedBy: user?.displayName || auth.currentUser?.email || 'System Admin'
        });
      }

      const targetUserId = creatorId;
      if (targetUserId && targetUserId !== 'guest') {
        const dmId = `dm_system-support_${targetUserId}`;
        const chatDocRef = doc(db, 'chats', dmId);
        const chatDoc = await getDoc(chatDocRef);
        
        if (!chatDoc.exists()) {
          await setDoc(chatDocRef, {
            type: 'direct',
            participants: ['system-support', targetUserId],
            createdAt: new Date().toISOString()
          });
        }

        const noticeText = `⚠️ SOCIAL+ MODERATION NOTICE:\n\nYour ${type === 'short' ? 'M Short' : 'Post'} was removed by system administrators.\n\nReason: ${adminRemovalReason}`;
        
        await addDoc(collection(db, 'chats', dmId, 'messages'), {
          senderId: 'system-support',
          content: noticeText,
          createdAt: new Date().toISOString(),
          type: 'admin_notice'
        });

        await updateDoc(chatDocRef, {
          lastMessage: `⚠️ Moderation Notice`,
          lastMessageAt: new Date().toISOString()
        });
      }

      setAdminSelectedContent(null);
      setAdminRemovalReason('');
      setErrorMessage("Social+ item successfully removed and notice sent.");
      setTimeout(() => setErrorMessage(null), 3500);

    } catch (err: any) {
      setErrorMessage(`Failed to moderate content: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await updateDoc(doc(db, 'social_reports', reportId), {
        status: status,
        resolvedAt: new Date().toISOString(),
        resolvedBy: user?.displayName || auth.currentUser?.email || 'System Admin'
      });
      setErrorMessage(`Report has been ${status}.`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to resolve report: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminToggleMaintenance = async (active: boolean, durationMinutes?: number) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      let maintenanceUntilStr = '';
      if (active && durationMinutes) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + durationMinutes);
        maintenanceUntilStr = d.toISOString();
      }
      await setDoc(configRef, {
        maintenanceMode: active,
        maintenanceUntil: active ? maintenanceUntilStr : '',
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage(`Maintenance mode set to: ${active ? 'ACTIVE' : 'INACTIVE'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update maintenance settings: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminToggleAIDisable = async (disable: boolean, durationMinutes?: number) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      let disableAIUntilStr = '';
      if (disable && durationMinutes) {
        const d = new Date();
        d.setMinutes(d.getMinutes() + durationMinutes);
        disableAIUntilStr = d.toISOString();
      }
      await setDoc(configRef, {
        disableAI: disable,
        disableAIUntil: disable ? disableAIUntilStr : '',
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage(`AI services set to: ${disable ? 'OFFLINE' : 'ONLINE'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update AI settings: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminRestartServers = async () => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        serverRestartTrigger: Date.now(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage("Broadcast server reboot signal transmitted successfully!");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to trigger system restart: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminSendGlobalMessage = async (message: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        globalAnnouncement: {
          message: message.trim(),
          createdAt: Date.now(),
          active: message.trim().length > 0
        },
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage(message.trim() ? "Announcement transmitted to all active nodes." : "Broadcast signal cleared.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to broadcast message: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  const handleAdminLockApp = async (locked: boolean, customizedReason?: string, lockedUntil?: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        appLocked: locked,
        appLockedReason: customizedReason || '',
        appLockedUntil: lockedUntil || '',
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage(`App lockout status set to: ${locked ? 'LOCKED' : 'UNLOCKED'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update application lockout: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminUpdateSystemAnnouncement = async (
    active: boolean,
    emoji: string,
    title: string,
    message: string,
    badge: string,
    theme: string
  ) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        systemAnnouncement: {
          active,
          emoji: emoji.trim(),
          title: title.trim(),
          message: message.trim(),
          badge: badge.trim(),
          theme,
          createdAt: Date.now()
        },
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage(`System announcement status set to: ${active ? 'ACTIVE' : 'INACTIVE'}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to update system announcement: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminUpdateContactEmail = async (email: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage("Please enter a valid contact email address.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const configRef = doc(db, 'system', 'config');
      await setDoc(configRef, {
        contactSupportEmail: email.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || 'system'
      }, { merge: true });
      setErrorMessage("Contact support email refreshed successfully in system vaults.");
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to synchronize contact email: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3500);
    }
  };

  const startAIChat = useCallback(async () => {
    if (!user?.uid) return;
    const aiId = `ai_${user.uid}`;
    try {
      const chatDoc = await getDoc(doc(db, 'chats', aiId));
      if (chatDoc.exists()) {
        const existing = { id: chatDoc.id, ...chatDoc.data() } as ChatSession;
        setActiveChat(existing);
        setIsMobileSidebarOpen(false);
        return;
      }
      const chatData = {
        type: 'direct',
        name: 'Memuer Private AI',
        participants: [user.uid, 'memuer-ai'],
        participantKeys: {
          [user.uid]: user.publicKey || 'local-vault-key',
          'memuer-ai': 'ai-identity'
        },
        layer: 'vault',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessage: 'SECURE NEURAL LINK ESTABLISHED'
      };
      await setDoc(doc(db, 'chats', aiId), chatData);
      setActiveChat({ id: aiId, ...chatData } as ChatSession);
      setIsMobileSidebarOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${aiId}`);
    }
  }, [user?.uid, user?.publicKey]);

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (!file.type.startsWith('image/')) {
      setErrorMessage("Please select an image file.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      setUploading(true);
      let photoURL = "";

      // 1. Try ImgBB if key is configured
      try {
        console.log("Initiating ImgBB upload for profile photo:", file.name);
        photoURL = await uploadImageToImgBB(file);
        console.log("Uploaded profile photo successfully via ImgBB:", photoURL);
      } catch (imgbbErr) {
        console.warn("ImgBB upload failed for profile photo, trying local proxy...", imgbbErr);
      }

      // 2. Try our high-speed, local server media proxy fallback
      if (!photoURL) {
        // Convert image file to Base64
        const fileData = await fileToBase64(file);

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              filename: file.name,
              fileData,
              mimeType: file.type
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.url) {
              photoURL = data.url;
              console.log("Successfully set profile photo via local container: ", photoURL);
            }
          }
        } catch (proxyError) {
          console.warn("Express upload API failed for profile photo change, falling back...", proxyError);
        }
      }

      // 3. Last resort local base64 fallback
      if (!photoURL) {
        try {
          console.log("Compressing profile photo client-side to fit direct-sync size limit...");
          photoURL = await compressImageForDirectSync(file);
        } catch (compressErr) {
          const fileData = await fileToBase64(file);
          if (file.size < 950 * 1024) {
            photoURL = fileData;
          } else {
            setErrorMessage("Image file exceeds 1MB limit for E2EE Direct Sync.");
            setTimeout(() => setErrorMessage(null), 3000);
            return;
          }
        }
      }

      if (photoURL) {
        await updateProfile({ photoURL });
      } else {
        throw new Error("Could not assemble a secure URL for the profile photo.");
      }
    } catch (err: any) {
      console.error("Profile photo update failed entirely:", err);
      setErrorMessage("Failed to update profile photo: " + (err.message || err));
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const handleCustomBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    if (!file.type.startsWith('image/')) {
      setErrorMessage("Please select an image file for the background.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    try {
      setUploading(true);
      let bgURL = "";

      // 1. Try ImgBB if key is configured
      try {
        console.log("Initiating ImgBB upload for custom wallpaper:", file.name);
        bgURL = await uploadImageToImgBB(file);
        console.log("Uploaded custom wallpaper successfully via ImgBB:", bgURL);
      } catch (imgbbErr) {
        console.warn("ImgBB upload failed for custom wallpaper, trying local proxy...", imgbbErr);
      }

      // 2. Try our high-speed, local server media proxy fallback
      if (!bgURL) {
        // Convert image file to Base64
        const fileData = await fileToBase64(file);

        try {
          const response = await fetch("/api/upload", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              filename: file.name,
              fileData,
              mimeType: file.type
            })
          });

          if (response.ok) {
            const data = await response.json();
            if (data && data.url) {
              bgURL = data.url;
              console.log("Successfully set custom wallpaper via local container: ", bgURL);
            }
          }
        } catch (proxyError) {
          console.warn("Express upload API failed for custom wallpaper, falling back...", proxyError);
        }
      }

      // 3. Last resort local base64 fallback
      if (!bgURL) {
        try {
          console.log("Compressing wallpaper image client-side to fit direct-sync size limit...");
          bgURL = await compressImageForDirectSync(file);
        } catch (compressErr) {
          const fileData = await fileToBase64(file);
          if (file.size < 950 * 1024) {
            bgURL = fileData;
          } else {
            setErrorMessage("Image file exceeds 1MB limit for custom E2EE Local Sync.");
            setTimeout(() => setErrorMessage(null), 3000);
            return;
          }
        }
      }

      if (bgURL) {
        await updateProfile({ preferences: { ...user?.preferences, customChatBg: bgURL } });
      } else {
        throw new Error("Could not assemble a secure URL for the custom wallpaper.");
      }
    } catch (err: any) {
      console.error("Custom wallpaper update failed entirely:", err);
      setErrorMessage("Failed to update custom wallpaper: " + (err.message || err));
      setTimeout(() => setErrorMessage(null), 3000);
    } finally {
      setUploading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const toggleMuteChat = async (chatId: string) => {
    if (!user) return;
    const currentMuted = user.preferences?.mutedChats || [];
    const isMuted = currentMuted.includes(chatId);
    const updatedMuted = isMuted 
      ? currentMuted.filter(id => id !== chatId) 
      : [...currentMuted, chatId];
    
    await updateProfile({
      preferences: {
        ...(user.preferences || {}),
        mutedChats: updatedMuted
      }
    });
  };

  const togglePinChat = async (chatId: string) => {
    if (!user) return;
    const currentPinned = user.preferences?.pinnedChats || [];
    const isPinned = currentPinned.includes(chatId);
    const updatedPinned = isPinned 
      ? currentPinned.filter(id => id !== chatId) 
      : [...currentPinned, chatId];
    
    await updateProfile({
      preferences: {
        ...(user.preferences || {}),
        pinnedChats: updatedPinned
      }
    });
  };

  const toggleBlockUser = async (targetUid: string) => {
    if (!user) return;
    const currentBlocked = user.preferences?.blockedUsers || [];
    const isBlocked = currentBlocked.includes(targetUid);
    const updatedBlocked = isBlocked
      ? currentBlocked.filter(id => id !== targetUid)
      : [...currentBlocked, targetUid];

    await updateProfile({
      preferences: {
        ...(user.preferences || {}),
        blockedUsers: updatedBlocked
      }
    });

    if (isBlocked) {
      setErrorMessage("User communications permitted.");
    } else {
      setErrorMessage("User communications blocked securely.");
    }
    setTimeout(() => setErrorMessage(null), 3000);
  };

  if (loading) {
    const loadingTheme = getThemeLoadingStyles();
    return (
      <div className={cn("h-dvh w-full flex items-center justify-center relative overflow-hidden", currentTheme.bg)}>
        {renderAnimatedThemeBackground()}
        
        {/* Dynamic ambient theme glow orb behind the card */}
        <div 
          className="absolute w-80 h-80 rounded-full blur-[120px] pointer-events-none opacity-45 animate-pulse transition-all duration-700"
          style={{ backgroundColor: loadingTheme.glow }}
        />

        <div 
          className="flex flex-col items-center gap-6 relative z-10 p-8 sm:p-10 rounded-3xl sm:rounded-[36px] backdrop-blur-2xl border transition-all duration-500 max-w-xs sm:max-w-sm w-full mx-4 text-center shadow-2xl" 
          style={{ backgroundColor: 'rgba(0,0,0,0.48)', borderColor: 'rgba(255,255,255,0.09)' }}
        >
          <div className="relative flex items-center justify-center py-2">
            {/* Outer rotating decorative dashed ring matching theme */}
            <div className={cn(
              "w-24 h-24 rounded-full border-2 border-dashed animate-[spin_10s_linear_infinite]",
              loadingTheme.outerRing
            )} />

            {/* Inner pulsating glow aura */}
            <div 
              className={cn("absolute w-20 h-20 rounded-full border opacity-30 animate-ping", loadingTheme.innerPulseRing)} 
              style={{ animationDuration: '3s' }} 
            />
            
            {/* Core theme emblem */}
            <div className={cn(
              "absolute w-16 h-16 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-2xl transition-transform duration-700 animate-pulse",
              loadingTheme.emblemBg
            )}>
              <Sparkles className={cn("w-8 h-8", loadingTheme.emblemIcon)} />
            </div>
          </div>

          <div className="space-y-2 w-full">
            <h4 className={cn("font-black tracking-tight text-lg sm:text-xl font-display text-transparent bg-clip-text bg-gradient-to-r select-none", loadingTheme.titleGradient)}>
              Memuer Network
            </h4>
            <p className={cn(
              "font-mono font-bold tracking-widest uppercase text-[10px] sm:text-xs animate-pulse",
              loadingTheme.subText
            )}>
              {isAr ? "يتم تهيئة وتشفير الاتصال..." : "Initializing encrypted channel..."}
            </p>

            {/* Theme-colored animated progress line */}
            <div className="w-full max-w-[180px] mx-auto h-1.5 bg-white/10 rounded-full overflow-hidden mt-3 relative">
              <div className={cn("h-full w-2/3 rounded-full bg-gradient-to-r animate-[theme-gradient-shift_2s_ease-in-out_infinite_alternate]", loadingTheme.progressBar)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("h-dvh w-full flex flex-col items-center justify-start sm:justify-center p-4 overflow-y-auto custom-scrollbar relative overflow-hidden", currentTheme.bg)}>
        {renderAnimatedThemeBackground()}
        <div className={cn(
          themeName === 'liquidglass' ? 'liquid-glass-panel' : themeName === 'luxury' ? 'luxury-panel' : 'bg-indigo-900/40 backdrop-blur-xl border border-white/10',
          "max-w-md w-full my-auto space-y-6 sm:space-y-8 p-6 sm:p-8 rounded-3xl sm:rounded-[40px] shadow-2xl shrink-0 relative z-10"
        )}>
          <div className="flex justify-end mb-2">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-full text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isAr ? 'English' : 'العربية'}</span>
            </button>
          </div>

          <div className="text-center">
            <div className={cn(
              "w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-[20px] sm:rounded-[24px] flex items-center justify-center mb-4 sm:mb-6",
              themeName === 'luxury'
                ? "bg-[#141414]/95 border border-amber-500/30 shadow-[0_0_30px_rgba(212,175,55,0.25)]"
                : themeName === 'liquidglass'
                ? "liquid-glass-input shadow-[0_0_40px_rgba(255,255,255,0.15)]"
                : "bg-white/5 border border-white/10 shadow-2xl backdrop-blur-2xl"
            )}>
              <Sparkles className={cn("w-8 h-8 sm:w-10 sm:h-10", themeName === 'luxury' ? "text-amber-400" : "text-white")} />
            </div>
            <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-2 flex items-center justify-center gap-0.5 font-display select-none" dir="ltr">
              <span className={themeName === 'luxury' ? "text-amber-400 font-display" : "text-white"}>Memuer</span>
            </h2>
            <p className="text-xs sm:text-sm text-indigo-200/70 font-medium tracking-wide">
              {isAr ? 'تطبيق مراسلة آمن، جميل وبسيط للجميع' : 'Simple, Beautiful & Private Messaging'}
            </p>
          </div>
          
          {!showLocalLogin ? (
            <div className="space-y-3">
              <button 
                onClick={login}
                className="w-full py-3.5 sm:py-4 px-6 bg-white text-indigo-950 font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 hover:bg-white/90 transition-all shadow-xl text-sm sm:text-base"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                {isAr ? 'تسجيل الدخول للمحادثات' : 'Sign In to Chat'}
              </button>
              <button 
                onClick={() => setShowLocalLogin(true)}
                className="w-full py-3 sm:py-3.5 px-6 bg-white/5 border border-white/10 text-white font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-sm sm:text-base"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
                {isAr ? 'تسجيل الدخول بكلمة المرور' : 'Password Login'}
              </button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {isResetting ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white text-center">{isAr ? 'استعادة الحساب' : 'Reset Access'}</h3>
                  <p className="text-[10px] text-indigo-200/60 text-center uppercase tracking-widest leading-relaxed">
                    {isAr ? 'أدخل بريدك الإلكتروني لاستلام رابط استعادة الحساب.' : 'Enter your email address to receive a recovery link.'}
                  </p>
                  <input 
                    type="email" 
                    placeholder={isAr ? 'البريد الإلكتروني' : 'Email Address'} 
                    value={localEmail}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                  />
                  {resetEmailSent && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-widest text-center">
                      {isAr ? 'تم إرسال رابط الاستعادة!' : 'Recovery link dispatched!'}
                    </div>
                  )}
                  <button 
                    onClick={() => resetPassword(localEmail)}
                    className="w-full py-3.5 bg-cyan-500 text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest"
                  >
                    {isAr ? 'إرسال رابط الاستعادة' : 'Send Recovery Link'}
                  </button>
                  <button 
                    onClick={() => setIsResetting(false)}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-indigo-300 hover:text-white"
                  >
                    {isAr ? 'العودة لتسجيل الدخول' : 'Return to login'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {isRegistering && (
                      <input 
                        type="text" 
                        placeholder={isAr ? 'الاسم الظاهر (مثال: أستاذ علي)' : 'Display Name / Nickname'} 
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                      />
                    )}
                    <input 
                      type="email" 
                      placeholder={isAr ? 'البريد الإلكتروني' : 'Email Address'} 
                      value={localEmail}
                      onChange={(e) => setLocalEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                    />
                    <input 
                      type="password" 
                      placeholder={isAr ? 'كلمة المرور' : 'Password'} 
                      value={localPassword}
                      onChange={(e) => setLocalPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (isRegistering) registerWithEmail(localEmail, localPassword, localName);
                      else loginWithEmail(localEmail, localPassword);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-indigo-600 text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest"
                  >
                    {isRegistering ? 'Initialize Local Vault' : 'Unlock Local Vault'}
                  </button>
                  <div className="flex flex-col gap-3 px-2">
                    <div className="flex items-center justify-between">
                      <button 
                        onClick={() => setIsRegistering(!isRegistering)}
                        className="text-[10px] uppercase tracking-widest font-black text-indigo-300 hover:text-white"
                      >
                        {isRegistering ? 'I have a vault already' : 'Create new vault'}
                      </button>
                      <button 
                        onClick={() => setShowLocalLogin(false)}
                        className="text-[10px] uppercase tracking-widest font-black text-red-400 hover:text-red-300"
                      >
                        Cancel
                      </button>
                    </div>
                    {!isRegistering && (
                      <button 
                        onClick={() => setIsResetting(true)}
                        className="text-[10px] uppercase tracking-widest font-black text-indigo-300/50 hover:text-white mx-auto"
                      >
                        Forgot Passphrase?
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {errorMessage && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] sm:text-xs font-bold leading-relaxed"
            >
              <p className="uppercase tracking-widest mb-1">Security Alert: {errorMessage}</p>
              {errorMessage.includes('popup') && (
                <button 
                  onClick={() => window.open(window.location.href, '_blank')}
                  className="underline opacity-80 hover:opacity-100 uppercase tracking-tighter"
                >
                  Tap here to open in a fresh portal
                </button>
              )}
            </motion.div>
          )}
          
          <div className="flex items-center justify-center gap-6 pt-4 text-[10px] font-bold uppercase tracking-widest text-indigo-300 opacity-50">
            <span>End-to-End Handshake</span>
            <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
            <span>AES-256 Vault</span>
          </div>
        </div>
      </div>
    );
  }

  const findByUid = async (targetUid: string) => {
    if (!user || !targetUid.trim()) return;
    const term = targetUid.trim();
    try {
      // 1. Try UID direct lookup
      const userDoc = await getDoc(doc(db, 'users', term));
      if (userDoc.exists()) {
        const foundUser = userDoc.data() as UserProfile;
        setContacts(prev => prev.some(c => c.uid === foundUser.uid) ? prev : [...prev, foundUser]);
        startDM(foundUser);
        return;
      }

      // 2. Try Name Search (Prefix match)
      const q = query(
        collection(db, 'users'), 
        where('displayName', '>=', term), 
        where('displayName', '<=', term + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      const results = snap.docs.map(d => d.data() as UserProfile).filter(u => u.uid !== user.uid);
      
      if (results.length > 0) {
        // Add all found to contacts
        setContacts(prev => {
          const newOnes = results.filter(r => !prev.some(p => p.uid === r.uid));
          return [...prev, ...newOnes];
        });
        // Start DM with the first one if it's a tight match or just first result
        startDM(results[0]);
      } else {
        setErrorMessage("No user found with that ID or name.");
        setTimeout(() => setErrorMessage(null), 3000);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${term}`);
    }
  };

  const toggleMobileSidebar = () => setIsMobileSidebarOpen(!isMobileSidebarOpen);

  const toggleArchiveChat = async (chatId: string) => {
    if (!user) return;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const currentlyArchived = chat.archivedBy?.includes(user.uid) || false;
    const updatedArchivedBy = currentlyArchived
      ? (chat.archivedBy || []).filter(uid => uid !== user.uid)
      : [...(chat.archivedBy || []), user.uid];
    
    try {
       await updateDoc(doc(db, 'chats', chatId), {
         archivedBy: updatedArchivedBy
       });
       if (activeChat?.id === chatId) {
         setActiveChat(prev => prev ? { ...prev, archivedBy: updatedArchivedBy } : null);
       }
    } catch (e) {
       handleFirestoreError(e, OperationType.WRITE, `chats/${chatId}`);
    }
  };

  // Immediate top-level rendering of Coming Soon screen to prevent any app leaks or load delays
  if (user && systemConfig?.appLocked && !isUserExempt) {
    return (
      <div className={cn("fixed inset-0 h-dvh w-full flex flex-col items-center justify-center p-4 sm:p-6 z-[9999] font-sans overflow-y-auto custom-scrollbar select-none relative", currentTheme.bg)}>
        
        {/* Cyber Stars Dynamic Canvas Backdrop */}
        <CyberStarsBackground theme={themeName} speed={starsSpeed} />
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">

          {/* Cyber Matrix Grid Backdrop */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:32px_32px] opacity-40"></div>

          {/* Animated Vertical Laser Sweep Line */}
          <motion.div 
            animate={{ y: ['-100%', '1000%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-cyan-500/10 to-transparent"
          />

          {/* Animated Floating Particle Floaters */}
          {[...Array(14)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [-20, -120, -20],
                x: [0, (i % 2 === 0 ? 30 : -30), 0],
                opacity: [0.15, 0.75, 0.15],
                scale: [0.8, 1.3, 0.8],
              }}
              transition={{
                duration: 5 + (i % 5),
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.4,
              }}
              style={{
                top: `${(i * 7) + 5}%`,
                left: `${(i * 7) + 4}%`,
              }}
              className="absolute w-2 h-2 rounded-full bg-cyan-400/40 shadow-[0_0_12px_rgba(34,211,238,0.8)]"
            />
          ))}
        </div>

        {/* Top Header Controls: Language Switcher Only */}
        <motion.div 
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg mx-auto mb-4 flex items-center justify-end gap-2 relative z-10 shrink-0"
        >
          {/* Language Switcher (English Default -> Arabic) */}
          <button
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            className="px-3.5 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-xs font-black text-white transition-all flex items-center gap-2 cursor-pointer shadow-lg backdrop-blur-md active:scale-95"
            title={isAr ? "التغيير للغة الإنجليزية" : "Switch to Arabic"}
          >
            <Globe className="w-4 h-4 text-cyan-400" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>
        </motion.div>

        {/* Main Coming Soon Container (Borderless & Boxless) */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, type: "spring", damping: 25 }}
          className="max-w-xl w-full text-center space-y-6 relative z-10 my-auto p-4 sm:p-6"
        >
          {/* Floating Quantum Lock Hero Ring */}
          <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
            {/* Rotating Outer Ring */}
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-indigo-500/40"
            />
            {/* Rotating Counter Inner Ring */}
            <motion.div 
              animate={{ rotate: -360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 rounded-full border border-pink-500/30 border-t-pink-400"
            />
            {/* Pulsing Aura Circle */}
            <motion.div 
              animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-3 bg-gradient-to-tr from-pink-500/20 via-indigo-500/30 to-cyan-500/20 rounded-full blur-md"
            />
            
            {/* Lock Badge Icon */}
            <div className="relative z-10 w-16 h-16 bg-gradient-to-b from-indigo-950/90 to-zinc-900 border border-indigo-400/40 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.4)] group">
              <Lock className="w-8 h-8 text-indigo-300 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)] animate-pulse" />
              
              {/* Sparkling Corner Badge */}
              <motion.div 
                animate={{ scale: [1, 1.3, 1], rotate: [0, 180, 360] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute -top-1.5 -right-1.5 bg-gradient-to-r from-pink-500 to-yellow-400 p-1 rounded-full shadow-lg"
              >
                <Sparkles className="w-3 h-3 text-black" />
              </motion.div>
            </div>
          </div>

          {/* Status Beacon Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 font-mono">
              {isAr ? 'بروتوكول التشفير نشط' : 'Encryption Protocol Active'}
            </span>
          </div>
          
          {/* Coming Soon Main Titles with Shimmer */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-indigo-200 to-cyan-300 uppercase font-bold drop-shadow-[0_0_15px_rgba(244,63,94,0.3)]">
              {isAr ? 'قريباً جداً' : 'Coming Soon'}
            </h1>
            <p className="text-[10px] font-mono tracking-[0.2em] text-indigo-300 uppercase flex items-center justify-center gap-1.5">
              <Globe className="w-3 h-3 text-cyan-400 animate-spin" style={{ animationDuration: '10s' }} />
              {isAr ? 'عقدة الاتصال المشفرة تحت التجهيز' : 'Cryptographic Communication Vault'}
            </p>
          </div>
          
          {/* Full Quote Description */}
          <div className="max-w-md mx-auto py-1 px-2">
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-medium italic">
              "{systemConfig?.appLockedReason || (isAr ? "نقوم حالياً بتقديم تحديثات وتحسينات جوهرية للنظام لنقدم لكم تجربة استثنائية وغير مسبوقة. نشكركم من القلب على حسن انتظاركم وصبركم أثناء تجهيز المنصة للإطلاق." : "We are currently carrying out system updates and major platform optimizations to bring you an extraordinary experience. Thank you sincerely for your patience as we prepare the network for launch.")}"
            </p>
          </div>
          
          {/* Countdown Timer Wrapper (Frameless) */}
          <div className="space-y-3 relative py-2">
            <div className="flex items-center justify-between px-2 max-w-[360px] mx-auto">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                <p className="text-[10px] uppercase font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-indigo-300 tracking-widest font-mono">
                  {isAr ? 'العد التنازلي للإطلاق' : 'Launch Protocol Countdown'}
                </p>
              </div>
              
              {/* Equalizer Wave Visualizer */}
              <div className="flex items-end gap-1 h-3">
                {[0.6, 0.3, 0.9, 0.5, 0.8, 0.4].map((h, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: ['20%', '100%', '30%'] }}
                    transition={{ duration: 0.8 + i * 0.15, repeat: Infinity, repeatType: "reverse" }}
                    className="w-1 bg-gradient-to-t from-indigo-500 to-pink-400 rounded-full"
                  />
                ))}
              </div>
            </div>

            <ComingSoonTimer targetDate={systemConfig?.appLockedUntil} />
          </div>

          {/* Notification Interactive Subscriber */}
          <ComingSoonSubscribeSection isAr={isAr} />

          {/* Action Buttons */}
          <div className="pt-2 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={logout}
              className="px-6 py-2.5 bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-300 hover:text-white font-bold uppercase tracking-widest text-xs rounded-full transition-all flex items-center justify-center gap-2 backdrop-blur-md group cursor-pointer active:scale-95 shadow-lg"
            >
              <LogOut className="w-4 h-4 text-zinc-300 group-hover:text-white transition-colors" />
              <span>{isAr ? 'قطع اتصال العقدة' : 'Disconnect Node'}</span>
            </motion.button>
          </div>

        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-dvh h-[100dvh] w-full overflow-hidden font-sans text-white relative", currentTheme.bg)}>
      {renderAnimatedThemeBackground()}
      {isOffline && (
        <div className="absolute top-0 left-0 right-0 z-[100] bg-red-600 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center animate-pulse">
          Offline Mode • Encryption Enabled • Synchronization Pending
        </div>
      )}
      {user?.vaultSynced === false && (
        <div className="absolute top-0 left-0 right-0 z-[100] bg-yellow-500 text-black text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] py-1 text-center flex items-center justify-center gap-4">
          <span>⚠️ Vault Out of Sync • New Messages May Be Undecipherable</span>
          <button 
            onClick={resetKeyPair}
            className="bg-black text-white px-3 py-0.5 rounded text-[8px] hover:bg-black/80 transition-colors"
          >
            Fix Now
          </button>
        </div>
      )}
      <AnimatePresence>
        {errorMessage && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-[110] bg-red-600 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/20"
          >
            <Shield className="w-4 h-4 text-white" />
            <p className="text-xs font-black uppercase tracking-widest">{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="ml-2 hover:bg-white/10 rounded-full p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated Main Content Wrapper */}
      <motion.div
        animate={themeName === 'luxury' ? {} : {
          scale: isSocialOpen ? 0.97 : 1,
          filter: isSocialOpen ? 'blur(2px)' : 'blur(0px)',
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="flex flex-1 h-full w-full overflow-hidden sm:p-4 gap-4"
      >
        {/* Leftmost Rail */}
      <div className={cn("hidden sm:flex w-[80px] flex-col items-center gap-4 py-6 z-10 shrink-0 rounded-[32px] shadow-2xl transition-all", 
        currentTheme.rail, 
        (themeName !== 'luxury' && themeName !== 'liquidglass') ? 'border border-white/5 bg-white/5 backdrop-blur-3xl' : ''
      )}>
        <div className={cn(
          "w-12 h-12 rounded-[16px] flex items-center justify-center cursor-pointer transition-all duration-500",
          themeName === 'luxury'
            ? "bg-[#141414]/90 border border-amber-500/30 shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:scale-105 hover:border-amber-500/60"
            : themeName === 'liquidglass'
            ? "liquid-glass-input shadow-[0_0_25px_rgba(255,255,255,0.1)] hover:shadow-[0_0_35px_rgba(255,255,255,0.2)] hover:scale-110"
            : "bg-white/5 border border-white/10 backdrop-blur-xl shadow-xl hover:bg-white/10 hover:scale-110"
        )}>
          <Sparkles className={cn("w-6 h-6", 
            themeName === 'luxury' ? "text-amber-400" : 
            themeName === 'liquidglass' ? "text-white" : "text-blue-400"
          )} />
        </div>
        
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all", currentTheme.accentBg, "hover:opacity-80")} onClick={() => setIsAddConnectionModalOpen(true)}>
          <Plus className="w-5 h-5" />
        </div>

        <div 
          onClick={() => setIsSocialOpen(true)}
          className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-pink-500/20 cursor-pointer hover:scale-105 active:scale-95 transition-all"
          title="Memuer Social+"
        >
          <Sparkles className="w-5.5 h-5.5 text-white" />
        </div>

        <div className="mt-auto flex flex-col gap-4">
          <button onClick={handleLogout} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-red-500/20 transition-colors">
            <LogOut className={cn("w-5 h-5", currentTheme.accentText)} />
          </button>
          <div className="w-10 h-10 rounded-full border-2 border-green-400 p-0.5 relative group cursor-pointer">
            <img 
              src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
              alt={user?.displayName || 'User'} 
              className="w-full h-full rounded-full object-cover" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Settings className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileSidebarOpen && !isDesktop && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[75] lg:hidden transition-all duration-300 animate-fade-in"
        />
      )}

      {/* Sidebar: Contacts & Channels */}
      <div className={cn(
        "flex flex-col transition-all duration-300",
        isDesktop 
          ? "relative w-[320px] shrink-0 h-full rounded-[32px] shadow-2xl overflow-hidden" 
          : "fixed inset-y-0 left-0 z-[80] w-[85vw] sm:w-72 transition-transform duration-300",
        themeName === 'liquidglass' ? 'liquid-glass-panel border-r-0' : themeName === 'luxury' ? 'luxury-panel border-r-0' : 'sleek-sidebar border-r-0',
        isDesktop ? "" : currentTheme.sidebarMobile,
        isDesktop ? "translate-x-0" : (isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full")
      )}>
        <div className="px-3 sm:px-4 py-3.5 flex items-center justify-between gap-2 border-b border-white/5">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-0.5 font-display select-none" dir="ltr">
            <span className={themeName === 'luxury' ? "text-amber-400 font-serif" : "text-pink-500"}>m</span>
            <span className={cn(
              themeName === 'luxury' 
                ? "text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-yellow-500 font-serif" 
                : "text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-cyan-300"
            )}>emuer</span>
          </h2>
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[9px] font-bold transition-all border border-white/10 flex items-center gap-1 shrink-0"
              title={isAr ? 'Switch to English' : 'تغيير للغة العربية'}
            >
              <Globe className="w-2.5 h-2.5 text-cyan-400" />
              <span>{isAr ? 'EN' : 'عربي'}</span>
            </button>
            {isUserCallCenterMe && (
              <button 
                onClick={() => setIsCallCenterPanelOpen(!isCallCenterPanelOpen)}
                className="px-2 py-1 bg-pink-500/10 hover:bg-pink-500/25 text-pink-400 hover:text-pink-300 border border-pink-500/20 hover:border-pink-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-[0_0_10px_rgba(236,72,153,0.1)] hover:scale-105 active:scale-95 relative"
                title="Call Center"
              >
                <Phone className={`w-2.5 h-2.5 ${incomingCallCount > 0 ? 'animate-bounce text-pink-300' : ''}`} />
                <span>Call Center</span>
                {incomingCallCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-pink-500 text-white text-[8px] font-black flex items-center justify-center animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]">
                    {incomingCallCount}
                  </span>
                )}
              </button>
            )}
            {isUserAdminMe && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="px-2 py-1 bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:scale-105 active:scale-95"
                title="Admin Console"
              >
                <Sliders className="w-2.5 h-2.5" />
                Admin
              </button>
            )}
            <button 
              onClick={() => setIsSocialOpen(true)}
              className="px-2 py-1 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all flex items-center gap-1 shadow-[0_0_10px_rgba(239,68,68,0.15)] shrink-0"
              title="Memuer Social+"
            >
              <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
              Social+
            </button>
            <button onClick={toggleMobileSidebar} className="lg:hidden p-1.5 hover:bg-white/10 rounded-xl">
              <X className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-2 my-3 flex gap-1 bg-black/40 backdrop-blur-2xl mx-3 rounded-2xl p-1 border border-white/10 shadow-inner">
          <button 
            onClick={() => setSidebarTab('chats')}
            className={cn(
              "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              sidebarTab === 'chats' ? cn(currentTheme.tabChats, "text-white shadow-lg scale-[1.02]") : cn(currentTheme.accentText, "hover:bg-white/5")
            )}
          >
            {isAr ? 'المحادثات' : 'Messages'}
          </button>
          <button 
            onClick={() => setSidebarTab('contacts')}
            className={cn(
              "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              sidebarTab === 'contacts' ? cn(currentTheme.tabDirectory, "text-white shadow-lg scale-[1.02]") : "text-cyan-300 hover:bg-white/5"
            )}
          >
            {isAr ? 'جهات الاتصال' : 'Contacts'}
          </button>
          <button 
            onClick={() => setSidebarTab('requests')}
            className={cn(
              "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative",
              sidebarTab === 'requests' ? cn(currentTheme.tabSignals, "text-white shadow-lg scale-[1.02]") : "text-pink-300 hover:bg-white/5"
            )}
          >
            {isAr ? 'الطلبات' : 'Requests'}
            {friendRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 text-black text-[8px] flex items-center justify-center rounded-full font-black animate-bounce">
                {friendRequests.length}
              </span>
            )}
          </button>
        </div>

        <div className="px-6 mb-4">
          <AnimatePresence>
            {user?.vaultSynced === false && isVaultWarningOpen && (
              <motion.div 
                initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
                exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 space-y-3 relative group">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Shield className="w-4 h-4 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Vault Desynced</span>
                  </div>
                  <p className="text-[10px] text-yellow-100/60 leading-relaxed">
                    Personal keys missing locally. Chat decryption unavailable.
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={resetKeyPair}
                      className="flex-1 py-1.5 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-yellow-400 transition-all shadow-lg shadow-yellow-500/20"
                    >
                      Establish New Vault
                    </button>
                    <button 
                      onClick={() => setIsVaultWarningOpen(false)}
                      className="px-2 py-1.5 bg-white/5 rounded-lg hover:bg-white/10"
                    >
                      <X className="w-3 h-3 text-white/40" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 flex items-center gap-2 focus-within:border-cyan-400/40 focus-within:ring-1 focus-within:ring-cyan-400/20 transition-all shadow-inner">
            <Search className="w-4 h-4 text-white/40 ml-2 shrink-0" />
            <input 
              type="text" 
              placeholder={sidebarTab === 'chats' ? (isAr ? "البحث في المحادثات..." : "Search messages...") : (isAr ? "البحث في جهات الاتصال..." : "Search contacts...")} 
              value={searchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setSearchQuery(val);
                setDirectorySearchQuery(val);
              }}
              className="bg-transparent border-none focus:ring-0 text-xs py-1 w-full text-white placeholder-white/40 font-medium"
            />
          </div>
        </div>

        <div className="flex-1 px-3 space-y-4 overflow-y-auto custom-scrollbar">
          {sidebarTab === 'chats' ? (
            <>
              <div className="px-3 py-2">
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", currentTheme.accentText)}>
                  {isAr ? 'المساعد الذكي' : 'AI Assistant'}
                </p>
                <div 
                  onClick={startAIChat}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 ring-1 ring-cyan-400/30 cursor-pointer hover:bg-white/5 transition-all group", currentTheme.accentBg)}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform shrink-0">
                    <span className="text-[10px] font-bold text-white">AI</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm text-cyan-200">{isAr ? 'المساعد الذكي' : 'AI Assistant'}</p>
                    <p className="text-[10px] text-indigo-200/70 truncate italic font-medium">{isAr ? 'جاهز للمساعدة دائماً' : 'Ready to help anytime'}</p>
                  </div>
                  <ArrowRight className={cn("w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 transition-all", isAr ? "translate-x-2 group-hover:translate-x-0" : "-translate-x-2 group-hover:translate-x-0")} />
                </div>
              </div>

              <div className="px-3 space-y-6">
                {/* Direct Messages Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", currentTheme.accentText)}>
                      {isAr ? 'المحادثات الخاصة' : 'Private Messages'}
                    </p>
                    <span className="text-[9px] text-cyan-400/50 font-mono">
                      {chats.filter(c => c.type === 'direct' && !c.id.startsWith('ai_') && !c.participants.includes('memuer-ai') && !(c.archivedBy && c.archivedBy.includes(user?.uid || ''))).length} {isAr ? 'نشط' : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {chats
                      .filter(c => c.type === 'direct' && !c.id.startsWith('ai_') && !c.participants.includes('memuer-ai') && !(c.archivedBy && c.archivedBy.includes(user?.uid || '')))
                      .filter(c => {
                        const otherParticipantId = c.participants.find(id => id !== user?.uid);
                        const otherUser = contacts.find(usr => usr.uid === otherParticipantId);
                        return (otherUser?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase());
                      })
                      .sort((a, b) => {
                        const pinA = user?.preferences?.pinnedChats?.includes(a.id) ? 1 : 0;
                        const pinB = user?.preferences?.pinnedChats?.includes(b.id) ? 1 : 0;
                        if (pinA !== pinB) return pinB - pinA;
                        const timeA = a.updatedAt?.seconds || a.updatedAt?.toMillis?.() || (typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : 0);
                        const timeB = b.updatedAt?.seconds || b.updatedAt?.toMillis?.() || (typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : 0);
                        return timeB - timeA;
                      })
                      .map(chat => {
                        const otherParticipantId = chat.participants.find(id => id !== user?.uid);
                        const otherUser = contacts.find(c => c.uid === otherParticipantId);
                        const isPinned = user?.preferences?.pinnedChats?.includes(chat.id);
                        return (
                          <div 
                            key={chat.id}
                            onClick={() => {
                              setActiveChat(chat);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group relative",
                              activeChat?.id === chat.id ? "bg-white/10 border-white/10 shadow-inner" : "hover:bg-white/5",
                              isPinned && "border-pink-500/10 bg-pink-500/[0.02]"
                            )}
                          >
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-full bg-indigo-500 border border-white/10 overflow-hidden shadow-sm">
                                <img 
                                  src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || chat.id}`} 
                                  className="w-full h-full object-cover" 
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              {otherUser?.isOnline && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-indigo-900 shadow-sm shadow-green-500/50"></div>
                              )}
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-1.5 truncate">
                                  <p className="text-sm font-bold truncate text-white/90">{otherUser?.displayName || 'Syncing...'}</p>
                                  {isPinned && <Pin className="w-3 h-3 text-pink-400 rotate-45 shrink-0" />}
                                </div>
                              </div>
                              <div className={cn("text-[10px] truncate font-medium", currentTheme.accentText.replace('text-', 'text-opacity-70 text-'))}>
                                {Object.entries(chat.typing || {}).some(([id, typing]) => id !== user?.uid && typing) 
                                  ? <div className="flex gap-1 items-center">
                                      <span className={cn("w-1 h-1 rounded-full animate-pulse", currentTheme.accentBg.replace('bg-', 'bg-opacity-100 bg-'))}></span>
                                      <span className={cn("animate-pulse italic font-black uppercase tracking-tighter text-[9px]", currentTheme.accentText)}>Enigmatizing...</span>
                                    </div>
                                  : (chat.lastMessage || 'Channel established...')}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Pin toggle button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinChat(chat.id);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all shrink-0 z-10",
                                  isPinned
                                    ? "opacity-100 text-pink-400 bg-pink-500/10 border border-pink-500/25"
                                    : "opacity-100 sm:opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-pink-400 hover:bg-white/15"
                                )}
                                title={isPinned ? "Unpin Chat" : "Pin Chat"}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              {/* Archive toggle button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleArchiveChat(chat.id);
                                }}
                                className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/15 rounded-lg text-indigo-300 hover:text-cyan-400 transition-all shrink-0 z-10"
                                title="Archive Chat"
                              >
                                <Archive className="w-3.5 h-3.5 text-white/40 hover:text-cyan-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Groups Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", currentTheme.accentText)}>Group Enclaves</p>
                    <button 
                      onClick={() => setIsGroupModalOpen(true)}
                      className="p-1 rounded-md hover:bg-white/5 text-pink-400 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {chats
                      .filter(c => c.type === 'group' && !(c.archivedBy && c.archivedBy.includes(user?.uid || '')))
                      .filter(c => (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => {
                        const pinA = user?.preferences?.pinnedChats?.includes(a.id) ? 1 : 0;
                        const pinB = user?.preferences?.pinnedChats?.includes(b.id) ? 1 : 0;
                        if (pinA !== pinB) return pinB - pinA;
                        const timeA = a.updatedAt?.seconds || a.updatedAt?.toMillis?.() || (typeof a.updatedAt === 'string' ? new Date(a.updatedAt).getTime() : 0);
                        const timeB = b.updatedAt?.seconds || b.updatedAt?.toMillis?.() || (typeof b.updatedAt === 'string' ? new Date(b.updatedAt).getTime() : 0);
                        return timeB - timeA;
                      })
                      .map(chat => {
                        const isPinned = user?.preferences?.pinnedChats?.includes(chat.id);
                        return (
                          <div 
                            key={chat.id}
                            onClick={() => {
                              setActiveChat(chat);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group relative",
                              activeChat?.id === chat.id ? "bg-white/10 border-white/10 shadow-inner" : "hover:bg-white/5",
                              isPinned && "border-pink-500/10 bg-pink-500/[0.02]"
                            )}
                          >
                            <div className="shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center border border-white/20 shadow-lg">
                                <Users className="w-5 h-5 text-white" />
                              </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                              <div className="flex items-center gap-1.5 truncate">
                                <p className="text-sm font-bold truncate text-white/90">{chat.name}</p>
                                {isPinned && <Pin className="w-3 h-3 text-pink-400 rotate-45 shrink-0" />}
                              </div>
                              <div className={cn("text-[10px] truncate font-medium", currentTheme.accentText.replace('text-', 'text-opacity-70 text-'))}>
                                {Object.entries(chat.typing || {}).some(([id, typing]) => id !== user?.uid && typing) 
                                  ? <div className="flex gap-1 items-center">
                                      <span className={cn("w-1 h-1 rounded-full animate-pulse", currentTheme.accentBg.replace('bg-', 'bg-opacity-100 bg-'))}></span>
                                      <span className={cn("animate-pulse italic font-black uppercase tracking-tighter text-[9px]", currentTheme.accentText)}>TRANSMITTING...</span>
                                    </div>
                                  : (chat.lastMessage || `${chat.participants.length} secure terminals`)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Pin toggle button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePinChat(chat.id);
                                }}
                                className={cn(
                                  "p-1.5 rounded-lg transition-all shrink-0 z-10",
                                  isPinned
                                    ? "opacity-100 text-pink-400 bg-pink-500/10 border border-pink-500/25"
                                    : "opacity-100 sm:opacity-0 group-hover:opacity-100 text-indigo-300 hover:text-pink-400 hover:bg-white/15"
                                )}
                                title={isPinned ? "Unpin Group" : "Pin Group"}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              {/* Archive toggle button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleArchiveChat(chat.id);
                                }}
                                className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/15 rounded-lg text-indigo-300 hover:text-cyan-400 transition-all shrink-0 z-10"
                                title="Archive Group"
                              >
                                <Archive className="w-3.5 h-3.5 text-white/40 hover:text-cyan-400" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {chats.filter(c => c.type === 'group' && !(c.archivedBy && c.archivedBy.includes(user?.uid || ''))).length === 0 && (
                      <div className="py-4 text-center border-2 border-dashed border-white/5 rounded-2xl mx-2">
                        <p className="text-[10px] text-indigo-300/20 italic">No clusters found.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Archived Chats Folder Section */}
                {chats.filter(c => c.archivedBy && c.archivedBy.includes(user?.uid || '')).length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <button 
                      onClick={() => setIsArchiveExpanded(!isArchiveExpanded)}
                      className="flex items-center justify-between w-full px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <Archive className="w-4 h-4 text-pink-400 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#a5b4fc]">Archived Enclaves</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-cyan-400 font-mono bg-indigo-950/50 px-2 py-0.5 rounded-full border border-white/5 font-bold">
                          {chats.filter(c => c.archivedBy && c.archivedBy.includes(user?.uid || '')).length}
                        </span>
                        <span className="text-white/40 text-[9px] font-bold">{isArchiveExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>
                    {isArchiveExpanded && (
                      <div className="space-y-1 pl-1 border-l border-white/5 transition-all">
                        {chats
                          .filter(c => c.archivedBy && c.archivedBy.includes(user?.uid || ''))
                          .map(chat => {
                            const isDirect = chat.type === 'direct';
                            const otherParticipantId = isDirect ? chat.participants.find(id => id !== user?.uid) : null;
                            const otherUser = isDirect ? contacts.find(usr => usr.uid === otherParticipantId) : null;
                            const displayName = isDirect ? (otherUser?.displayName || 'Syncing...') : chat.name;
                            const photoURL = isDirect ? (otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid || chat.id}`) : null;

                            return (
                              <div 
                                key={chat.id}
                                onClick={() => {
                                  setActiveChat(chat);
                                  setIsMobileSidebarOpen(false);
                                }}
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-all border border-transparent group relative bg-black/10 hover:bg-black/25",
                                  activeChat?.id === chat.id ? "bg-white/10 border-white/10 shadow-inner" : ""
                                )}
                              >
                                {isDirect ? (
                                  <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-indigo-500 border border-white/10 overflow-hidden shadow-sm">
                                      <img 
                                        src={photoURL || undefined} 
                                        className="w-full h-full object-cover" 
                                        referrerPolicy="no-referrer"
                                      />
                                    </div>
                                    {otherUser?.isOnline && (
                                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-indigo-900 shadow-sm shadow-green-500/50"></div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="shrink-0">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center border border-white/20 shadow-lg">
                                      <Users className="w-4 h-4 text-white" />
                                    </div>
                                  </div>
                                )}
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-xs font-bold truncate text-white/90">{displayName}</p>
                                  <p className="text-[9px] text-zinc-400 truncate">{chat.lastMessage || (isDirect ? 'Channel established...' : 'Group Active')}</p>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleArchiveChat(chat.id);
                                  }}
                                  className="opacity-100 sm:opacity-0 group-hover:opacity-100 p-1.5 hover:bg-white/15 rounded-lg text-indigo-300 hover:text-cyan-400 transition-all shrink-0 z-10"
                                  title="Unarchive"
                                >
                                  <Archive className="w-3.5 h-3.5 text-zinc-400 hover:text-cyan-400" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {chats.filter(c => !(c.archivedBy && c.archivedBy.includes(user?.uid || ''))).length === 0 && (
                  <div className="py-12 text-center px-4">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                      <Search className="w-6 h-6 text-indigo-400/30" />
                    </div>
                    <p className="text-xs text-indigo-300/40 italic">No active handshakes found.</p>
                    <button 
                      onClick={() => setSidebarTab('contacts')}
                      className="mt-4 px-4 py-2 bg-indigo-600/20 rounded-lg text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-indigo-600/40 transition-all"
                    >
                      Explore Directory
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : sidebarTab === 'contacts' ? (
            <div className="px-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/60">Directory</p>
              </div>
              
              <div className="space-y-1">
                {/* Linked Call Center Account Card */}
                <div
                  onClick={() => setIsCallCenterCallActive(true)}
                  className="p-3 mb-3 rounded-2xl bg-gradient-to-r from-rose-950/80 via-purple-950/80 to-slate-900/90 border-2 border-rose-500/40 hover:border-rose-400 cursor-pointer shadow-lg shadow-rose-500/20 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-rose-500/30 shrink-0 group-hover:scale-105 transition-transform">
                      <Headphones className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-black text-white group-hover:text-rose-300 transition-colors">
                          memuer-call center
                        </span>
                        <span className="px-1.5 py-0.2 rounded-full text-[8px] font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Support Line
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {isAr ? 'اتصل الآن بالمسؤولين والمالكين' : 'Official Admins & Owners Hotline'}
                      </p>
                    </div>
                  </div>

                  <button className="px-3 py-1.5 rounded-xl bg-rose-500 text-white text-[10px] font-black uppercase tracking-wider hover:bg-rose-400 transition-colors flex items-center gap-1 shadow-md shadow-rose-500/30">
                    <Phone className="w-3 h-3 fill-current" />
                    <span>{isAr ? 'اتصال' : 'Call'}</span>
                  </button>
                </div>

                {filteredDirectory.map(contact => {
                  const isFriend = chats.some(c => c.type === 'direct' && c.participants.includes(contact.uid));
                  const canMessageDirectly = isFriend || user?.canMessageAnyone || user?.role === 'admin' || user?.role === 'owner' || auth.currentUser?.email === 'koke.kozkoz@gmail.com';
                  return (
                    <div 
                      key={contact.uid}
                      onClick={() => {
                        if (canMessageDirectly) {
                          startDM(contact);
                          setSearchQuery('');
                          setSidebarTab('chats');
                          setIsMobileSidebarOpen(false);
                        } else {
                          setErrorMessage("Administrative permission required to message outside of connections.");
                          setTimeout(() => setErrorMessage(null), 3500);
                        }
                      }}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/10 cursor-pointer transition-all border border-transparent hover:border-white/10 group"
                    >
                      <div className="relative shrink-0">
                        <img 
                          src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.uid}`} 
                          className="w-10 h-10 rounded-full object-cover border border-white/10" 
                          referrerPolicy="no-referrer"
                        />
                        {contact.isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-indigo-900 shadow-sm shadow-green-500/50"></div>
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-bold truncate group-hover:text-cyan-300 transition-colors">{contact.displayName}</p>
                          <UserRoleBadge role={contact.role} email={contact.email} />
                        </div>
                        <p className={cn("text-[10px] truncate uppercase tracking-tighter", currentTheme.accentText.replace('text-', 'text-opacity-70 text-'))}>
                          {contact.uid === user?.uid ? 'This is You' : contact.status || 'Active & Secured'}
                        </p>
                      </div>
                      {!isFriend && contact.uid !== user?.uid && (
                        user?.canMessageAnyone || user?.role === 'admin' || user?.role === 'owner' || auth.currentUser?.email === 'koke.kozkoz@gmail.com' ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              startDM(contact);
                              setSearchQuery('');
                              setSidebarTab('chats');
                              setIsMobileSidebarOpen(false);
                            }}
                            className="shrink-0 p-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-white transition-all shadow-lg"
                            title="Message Directly (Admin Permission)"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </button>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              sendFriendRequest(contact.uid);
                            }}
                            className="shrink-0 p-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white transition-all"
                            title="Send connection request"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )
                      )}
                      {isFriend && (
                        <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <MessageSquare className="w-3 h-3 text-cyan-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredDirectory.length === 0 && (
                  <div className="py-8 text-center px-4">
                    <p className="text-xs text-indigo-300/40 italic">No explorers found with that manifest.</p>
                  </div>
                )}
              </div>

              <div className={cn("mt-8 p-4 rounded-3xl border border-white/5 text-center", currentTheme.accentBg.replace('/40', '/20'))}>
                <Shield className={cn("w-8 h-8 mx-auto mb-3 opacity-50", currentTheme.accentText.replace('text-', 'text-'))} />
                <p className={cn("text-[10px] font-bold uppercase tracking-widest leading-relaxed", currentTheme.accentText)}>
                  Your ID: <span className="text-white block mt-1 font-mono lowercase">{user?.uid}</span>
                </p>
                <p className={cn("text-[9px] mt-3 italic text-opacity-40", currentTheme.accentText)}>Share your ID with others to initiate a secure encrypted link.</p>
              </div>


            </div>
          ) : (
            <div className="px-3">
              <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-4", currentTheme.accentText)}>Pending Signals</p>
              <div className="space-y-2">
                {friendRequests.filter(req => !user?.preferences?.blockedUsers?.includes(req.from)).map(req => (
                  <div key={req.id} className={cn("border border-white/5 rounded-2xl p-4", currentTheme.accentBg)}>
                    <div className="flex items-center gap-3 mb-4">
                      <img 
                        src={req.senderProfile?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.senderProfile?.uid}`} 
                        className="w-10 h-10 rounded-full border border-white/10" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-bold truncate">{req.senderProfile?.displayName}</p>
                        <p className={cn("text-[10px] truncate", currentTheme.accentText)}>Connection request</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => acceptFriendRequest(req)}
                        className="flex-1 py-1.5 bg-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-green-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-3 h-3" />
                        Accept
                      </button>
                      <button 
                        onClick={() => declineFriendRequest(req.id)}
                        className="flex-1 py-1.5 bg-white/5 text-white/50 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all flex items-center justify-center gap-1.5"
                      >
                        <X className="w-3 h-3" />
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
                {friendRequests.length === 0 && (
                  <div className="py-12 text-center text-indigo-300/30 flex flex-col items-center gap-4">
                    <Plus className="w-8 h-8 opacity-20" />
                    <p className="text-xs italic">No pending signals.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 bg-black/30 border-t border-white/5">
          <div className="flex items-center gap-3">
            <div onClick={() => { setIsProfileModalOpen(true); setIsMobileSidebarOpen(false); }} className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center border border-white/20 overflow-hidden cursor-pointer hover:scale-105 transition-transform">
              <img 
                src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex-1 overflow-hidden" onClick={() => { setIsProfileModalOpen(true); setIsMobileSidebarOpen(false); }}>
              <p className="text-sm font-bold truncate">{user?.displayName}</p>
              <p className="text-[10px] text-green-400 font-black uppercase italic tracking-tighter">Secure Link Active</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsChangelogOpen(true)}
                className="w-4 h-4 text-cyan-400 cursor-pointer hover:text-white transition-colors relative"
                title="System Updates"
              >
                <Info className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-pink-500 rounded-full"></span>
              </button>
              <button 
                onClick={() => setIsContactModalOpen(true)}
                className="w-4 h-4 text-indigo-300 cursor-pointer hover:text-white transition-all duration-300 relative"
                title="Contact Support"
              >
                <Mail className="w-4 h-4" />
                {userContactMessages.some(m => m.replied && m.userHasSeenReply === false) && (
                  <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-pink-500 rounded-full animate-pulse shadow-sm shadow-pink-500/50"></span>
                )}
              </button>
              <Settings className="w-4 h-4 text-indigo-300 cursor-pointer hover:text-white transition-colors" onClick={() => { setIsProfileModalOpen(true); setIsMobileSidebarOpen(false); }} title="Profile Settings" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Chat Window */}
      <div className={cn(
        "flex-1 flex flex-col relative min-w-0 overflow-hidden transition-all duration-300", 
        isDesktop ? "rounded-[32px] shadow-2xl" : "",
        themeName === 'liquidglass' ? 'liquid-glass-panel' : themeName === 'luxury' ? 'luxury-panel' : 'backdrop-blur-3xl border border-white/5 bg-white/5'
      )}>
        {/* BIG ANNOUNCEMENT BANNER */}
        {(() => {
          const isAnnouncementActive = systemConfig?.systemAnnouncement === undefined
            ? false // Default to false so the deactivation announcement does not show
            : !!systemConfig?.systemAnnouncement?.active;

          const announcementEmoji = systemConfig?.systemAnnouncement?.emoji ?? '🇪🇬';
          const announcementTitle = systemConfig?.systemAnnouncement?.title ?? 'Official System Announcement: World Cup Removal';
          const announcementMessage = systemConfig?.systemAnnouncement?.message ?? 'We have completely deactivated and removed all FIFA World Cup features, live trackers, and themed widgets from the platform. This action is taken in solid protest against systemic bias, racism, and unfairness shown towards the Egypt National Team. We refuse to host or facilitate features for any organization or tournament that treats nations with partiality or injustice.';
          const announcementBadge = systemConfig?.systemAnnouncement?.badge ?? 'Solidarity Active';
          const announcementTheme = systemConfig?.systemAnnouncement?.theme ?? 'egypt-solidarity';
          const announcementCreatedAt = systemConfig?.systemAnnouncement?.createdAt ?? 1719999999999;

          const isDismissed = dismissedSystemAnnouncementAt === announcementCreatedAt;

          if (!isAnnouncementActive || isDismissed) return null;

          return (
            <div className={cn(
              "border-b px-4 sm:px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-[45] shrink-0 shadow-2xl animate-fade-in text-white",
              announcementTheme === 'egypt-solidarity' ? 'bg-gradient-to-r from-red-700 via-neutral-950 to-amber-600 border-red-500/20' :
              announcementTheme === 'critical-red' ? 'bg-gradient-to-r from-rose-950 via-zinc-950 to-rose-900 border-rose-500/20' :
              announcementTheme === 'indigo-cyberpunk' ? 'bg-gradient-to-r from-indigo-950 via-zinc-950 to-cyan-900 border-indigo-500/20' :
              'bg-gradient-to-r from-amber-950 via-zinc-950 to-yellow-900 border-yellow-500/20' // gold-alert
            )}>
              <div className="flex items-start gap-4 text-left">
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 shadow-inner select-none text-2xl">
                  {announcementEmoji}
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-red-100 to-white flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    {announcementTitle}
                  </h3>
                  <p className="text-xs text-zinc-300 font-medium max-w-4xl leading-relaxed font-sans">
                    {announcementMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                <span className="text-[9px] font-black uppercase bg-white/15 text-white px-3 py-1.5 rounded-full border border-white/30 tracking-widest select-none">
                  {announcementBadge}
                </span>
                <button 
                  onClick={() => setDismissedSystemAnnouncementAt(announcementCreatedAt)}
                  className="p-1.5 hover:bg-white/10 text-white/50 hover:text-white rounded-lg transition-colors cursor-pointer"
                  title="Dismiss Announcement"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })()}

        {!activeChat && (
          <div className="sm:hidden m-4 mb-0 rounded-2xl flex items-center px-4 py-3 relative z-20 shrink-0 gap-2 shadow-2xl reflective-header">
            <button 
              onClick={toggleMobileSidebar} 
              className="p-2 hover:bg-white/10 rounded-xl text-indigo-200"
            >
              <Menu className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setIsSocialOpen(true)}
              className="px-2.5 py-1 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:scale-105 active:scale-95 transition-all text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(239,68,68,0.15)]"
              title="Memuer Social+"
            >
              <Sparkles className="w-2.5 h-2.5 text-white animate-pulse" />
              Social+
            </button>
            <span className="ml-2 font-black tracking-tight flex items-center gap-1 font-display">
              <Sparkles className={cn("w-4 h-4", themeName === 'luxury' ? "text-amber-400" : "text-white")} />
              <span className={themeName === 'luxury' ? "text-amber-400 font-display" : "text-white"}>Memuer</span>
            </span>
          </div>
        )}

        {/* Chat Background Decoration */}
        {themeName === 'liquidglass' ? (
          <div className="absolute inset-0 pointer-events-none transition-all duration-700 bg-transparent">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.15),transparent_65%)] animate-pulse" />
          </div>
        ) : user?.preferences?.customChatBg ? (
          <div 
            className="absolute inset-0 pointer-events-none transition-all duration-700 bg-cover bg-center brightness-[0.25] opacity-50"
            style={{ backgroundImage: `url(${user.preferences.customChatBg})` }}
          />
        ) : (
          <div className={cn("absolute inset-0 pointer-events-none transition-all duration-700", currentBgClass)}>
            <div className="absolute top-20 left-40 w-64 h-64 bg-cyan-400 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-40 right-20 w-80 h-80 bg-pink-500 rounded-full blur-[120px]"></div>
          </div>
        )}

        {activeChat ? (
          <div className="flex-1 flex flex-row min-w-0 overflow-hidden relative h-full">
            <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden h-full relative", themeName === 'liquidglass' ? "liquid-glass-panel" : themeName === 'luxury' ? "luxury-panel" : "")}>
            {/* Header */}
            <div className="h-16 sm:h-20 flex items-center justify-between px-4 sm:px-8 relative z-10 shrink-0 shadow-2xl reflective-header">
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  onClick={() => setActiveChat(null)} 
                  className="lg:hidden p-2 hover:bg-white/10 rounded-xl text-indigo-200 flex items-center justify-center animate-fade-in"
                  title="Back to conversations"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg border border-white/10 overflow-hidden">
                  {activeChat.id.startsWith('ai_') ? (
                    <div className="w-full h-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
                      <span className="text-[10px] sm:text-xs font-bold text-white tracking-widest animate-pulse">AI</span>
                    </div>
                  ) : activeChat.type === 'direct' ? (
                    <img 
                      src={contacts.find(c => c.uid === activeChat.participants.find(id => id !== user?.uid))?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${activeChat.id}`} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2">
                    <h1 className={cn("text-sm sm:text-lg truncate", themeName === 'liquidglass' ? "font-light tracking-wide font-sans text-white" : "font-black tracking-tight")}>
                      {activeChat.id.startsWith('ai_') 
                        ? (activeChat.name === 'Personal Neural Vault' ? (isAr ? 'المساعد الذكي' : 'AI Assistant') : (activeChat.name || (isAr ? 'المساعد الذكي' : 'AI Assistant')))
                        : activeChat.type === 'direct' 
                          ? contacts.find(c => c.uid === activeChat.participants.find(id => id !== user?.uid))?.displayName 
                          : activeChat.name}
                    </h1>
                    {activeChat.type === 'direct' && (
                      (() => {
                        const directContact = contacts.find(c => c.uid === activeChat.participants.find(id => id !== user?.uid));
                        return directContact ? <UserRoleBadge role={directContact.role} email={directContact.email} /> : null;
                      })()
                    )}
                    {activeChat.id.startsWith('ai_') ? (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-cyan-500/20 text-[9px] font-black text-cyan-400 border border-cyan-500/30 uppercase tracking-tighter italic">{isAr ? 'مساعد ذكي' : 'AI Chat'}</span>
                    ) : user?.vaultSynced === false ? (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-red-500/20 text-[9px] font-black text-red-400 border border-red-500/30 uppercase tracking-tighter italic">{isAr ? 'خطأ بالربط' : 'Keys Out of Sync'}</span>
                    ) : (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-green-500/20 text-[9px] font-black text-green-400 border border-green-500/30 uppercase tracking-tighter italic">{isAr ? 'مشفرة بأمان' : 'Encrypted'}</span>
                    )}
                  </div>
                  <p className={cn("text-[9px] sm:text-[10px] tracking-widest flex items-center gap-2 truncate", themeName === 'liquidglass' ? "font-normal text-cyan-200 uppercase" : "font-bold uppercase", currentTheme.accentText)}>
                    {themeName === 'liquidglass' ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="font-sans text-[10px] tracking-wide text-cyan-200/90 lowercase first-letter:uppercase">{isAr ? 'متصل الآن' : 'online'}</span>
                      </span>
                    ) : (
                      <>
                        <Shield className={cn("w-2.5 h-2.5", user?.vaultSynced === false ? "text-red-500" : activeChat.id.startsWith('ai_') ? "text-cyan-400" : "currentColor")} /> 
                        <span className={cn("truncate", user?.vaultSynced === false && "text-red-400", activeChat.id.startsWith('ai_') && "text-cyan-300")}>
                          {activeChat.id.startsWith('ai_') ? (isAr ? "دردشة المساعد الذكي" : "AI Assistant Chat") : user?.vaultSynced === false ? (isAr ? "خطأ بالحماية" : "Vault Protection Failure") : (isAr ? "محادثة آمنة ومشفرة" : "Private & Encrypted Chat")}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="hidden sm:block">
                  {isMessageSearchOpen ? (
                    <motion.div 
                      initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }}
                      className="relative flex items-center"
                    >
                      <input 
                        autoFocus
                        type="text" 
                        placeholder="Search..." 
                        value={msgSearchQuery}
                        onChange={(e) => setMsgSearchQuery(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-full py-1.5 px-4 text-xs focus:ring-1 ring-cyan-400/50"
                      />
                      <X 
                        className="absolute right-3 w-3 h-3 text-white/40 cursor-pointer hover:text-white" 
                        onClick={() => { setIsMessageSearchOpen(false); setMsgSearchQuery(''); }} 
                      />
                    </motion.div>
                  ) : (
                    <button onClick={() => setIsMessageSearchOpen(true)} className="p-2.5 hover:bg-white/10 rounded-full text-indigo-200">
                      <Search className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/5 shadow-inner">
                  <button onClick={() => handleStartCall('voice')} className="p-2 sm:p-2.5 hover:bg-white/10 rounded-full text-indigo-200 transition-all">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <button onClick={() => handleStartCall('video')} className="p-2 sm:p-2.5 hover:bg-white/10 rounded-full text-indigo-200">
                    <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <button 
                  onClick={() => setIsChatInfoOpen(!isChatInfoOpen)}
                  className={cn(
                    "flex w-10 h-10 rounded-full items-center justify-center transition-all duration-300",
                    isChatInfoOpen 
                      ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" 
                      : "bg-white/5 text-indigo-300 hover:bg-white/10"
                  )}
                  title="Chat Info"
                >
                  <Info className="w-5 h-5" />
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setIsHeaderMenuOpen(!isHeaderMenuOpen)}
                    className="flex w-10 h-10 rounded-full bg-white/5 items-center justify-center text-indigo-300 hover:bg-white/10 transition-colors"
                    title="Chat Options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                  {isHeaderMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-slate-950/95 backdrop-blur-2xl border border-white/10 shadow-2xl rounded-2xl z-[90] overflow-hidden">
                      <div className="fixed inset-0 z-[-1]" onClick={() => setIsHeaderMenuOpen(false)} />
                      <div className="p-1.5 flex flex-col gap-1 relative z-10">
                        <button 
                          onClick={() => {
                            toggleArchiveChat(activeChat.id);
                            setIsHeaderMenuOpen(false);
                          }}
                          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-left text-xs hover:bg-white/10 text-white font-bold transition-all"
                        >
                          <Archive className="w-4 h-4 text-pink-400" />
                          <span>{activeChat.archivedBy?.includes(user?.uid || '') ? 'Unarchive Chat' : 'Archive Chat'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Group Call Banner */}
            {activeChat.type === 'group' && activeChat.activeCall?.status === 'active' && activeChat.activeCall.callerId !== user?.uid && (
              <div className="bg-cyan-500/15 border-b border-cyan-500/20 px-4 sm:px-8 py-2 flex items-center justify-between backdrop-blur-md relative z-10">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full animate-ping shrink-0"></div>
                  <p className="text-[9px] sm:text-[10px] font-black uppercase text-cyan-400 tracking-widest truncate">Live Group Wave Distributed</p>
                </div>
                <button 
                  onClick={handleJoinGroupCall}
                  className="px-3 sm:px-4 py-1.5 bg-cyan-500 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-white hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                >
                  Join Channel
                </button>
              </div>
            )}
            
            {/* Chat Message Area */}
            <div className="flex-1 p-3 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto overflow-x-hidden min-w-0 relative z-10 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex items-center justify-center opacity-30 italic font-medium text-sm">
                  Beginning of a secure communication channel...
                </div>
              )}
              
              <AnimatePresence mode="popLayout">
                {messages
                  .filter(msg => !user?.preferences?.blockedUsers?.includes(msg.senderId))
                  .map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  const isAI = msg.senderId === 'memuer-ai';
                  const otherUser = contacts.find(c => c.uid === msg.senderId);
                  
                  // Decrypt message
                  let decryptedContent = msg.content;
                  let isEncrypted = !isAI && msg.nonce && msg.nonce !== 'system-msg';

                  if (isEncrypted) {
                    const localKeys = getStoredKeyPair(user?.uid);
                    
                    if (!localKeys) {
                      decryptedContent = '🔒 [Key Missing - Clear Cache Detected]';
                    } else if (activeChat) {
                      try {
                        if (activeChat.type === 'direct') {
                          // In DM/E2EE, we use the peer's public key
                          const otherParticipantId = activeChat.participants.find(id => id !== user?.uid);
                          
                          // Keys to try: 
                          // 1. Participant mapping (from chat doc)
                          // 2. Current Profile Key (live)
                          const historicalKey = activeChat.participantKeys?.[msg.senderId === user?.uid ? (otherParticipantId || '') : msg.senderId];
                          const liveKey = otherUser?.publicKey 
                                        || contacts.find(c => c.uid === (msg.senderId === user?.uid ? otherParticipantId : msg.senderId))?.publicKey;

                          let dec = null;
                          // Attempt 1: Historical Key (usually for older messages)
                          if (historicalKey && !historicalKey.startsWith('mock-')) {
                            dec = decryptMessage(msg.content, msg.nonce, historicalKey, localKeys.secretKey);
                          }
                          
                          // Attempt 2: Live Key (fallback if historical failed or missing)
                          if (!dec && liveKey && liveKey !== historicalKey && !liveKey.startsWith('mock-')) {
                            dec = decryptMessage(msg.content, msg.nonce, liveKey, localKeys.secretKey);
                          }
                          
                          // Attempt 3: Recipient Key fallback (if I encrypted with my own pubkey by mistake or for multi-device)
                          if (!dec && isMe && user.publicKey) {
                             dec = decryptMessage(msg.content, msg.nonce, user.publicKey, localKeys.secretKey);
                          }

                          if (dec) {
                            decryptedContent = dec;
                          } else {
                            decryptedContent = (historicalKey || liveKey) 
                              ? '🔒 [Undecipherable - Key Mismatch]' 
                              : '🔒 [Key Pending Sync]';
                          }
                        } else if (activeChat.type === 'group' && activeGroupKey) {
                          // In Group/E2EE, we use the symmetric group key
                          const dec = decryptSymmetric(msg.content, msg.nonce, activeGroupKey);
                          decryptedContent = dec || '🔒 [Undecipherable - Group Key Mismatch]';
                        } else if (activeChat.type === 'group' && !activeGroupKey) {
                          decryptedContent = '🔒 [Key Missing or Undecipherable]';
                        }
                      } catch (e: any) {
                        console.warn("Decryption warning inside loop:", e?.message || e);
                        decryptedContent = '🔒 [Decryption System Failure]';
                      }
                    }
                  } else if (!isAI && !msg.nonce && msg.content) {
                    try {
                      if (/^[A-Za-z0-9+/=\s]+$/.test(msg.content) && !msg.content.includes(' ')) {
                        const dec = decryptMessage(msg.content, '', '', '');
                        if (dec !== "[Undecryptable Message due to key mismatch]") {
                          decryptedContent = dec;
                        }
                      }
                    } catch (e) {
                      // leave as is
                    }
                  }

                  return (
                    <motion.div 
                      key={msg.id || i}
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={cn(
                        "flex items-start gap-2.5 sm:gap-4 max-w-[88%] sm:max-w-[80%] group",
                        isMe ? "flex-row-reverse self-end" : "self-start",
                        isAI && "max-w-[90%] sm:max-w-[85%] self-end flex-row-reverse"
                      )}
                    >
                      <div className={cn(
                        "w-7.5 h-7.5 sm:w-8 sm:h-8 rounded-full shrink-0 mt-0.5 border border-white/10 shadow-lg overflow-hidden flex items-center justify-center",
                        isAI ? "bg-gradient-to-tr from-cyan-400 to-blue-600 flex items-center justify-center" : "bg-indigo-500"
                      )}>
                        {isMe ? (
                          <img 
                            src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : isAI ? (
                          <span className="text-[10px] font-black">AI</span>
                        ) : (
                          <img 
                            src={otherUser?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherUser?.uid}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        )}
                      </div>
                      
                      <div className={cn("space-y-1 sm:space-y-1.5 flex flex-col", isMe ? "items-end" : "items-start")}>
                        <div className="relative group/bubble flex items-center">
                          <div className={cn(
                            "p-3 sm:p-4 transition-all text-[13px] sm:text-sm leading-relaxed relative z-10 break-all break-words overflow-hidden",
                            themeName === 'liquidglass'
                              ? (isMe ? "liquid-glass-bubble-me" : isAI ? "liquid-glass-bubble-ai" : "liquid-glass-bubble-other")
                              : cn(
                                  "backdrop-blur-md rounded-2xl border shadow-xl font-medium",
                                  isMe ? currentTheme.bubbleMe + " rounded-tr-none" : 
                                  isAI ? "bg-indigo-500/20 border-cyan-400/30 rounded-tr-none text-cyan-50 font-bold" :
                                  currentTheme.bubbleOther + " rounded-tl-none"
                                )
                          )}>
                            {msg.type === 'audio' ? (
                              <VoiceMessagePlayer 
                                src={decryptedContent || ''} 
                                duration={msg.duration} 
                                isMe={isMe} 
                              />
                            ) : (
                              <div className="flex flex-col gap-1">
                                {isEncrypted && decryptedContent.startsWith('🔒') ? (
                                  <div className="flex items-center gap-2 text-yellow-400 font-bold bg-yellow-400/10 p-2 rounded-lg border border-yellow-400/20">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="text-[10px] uppercase tracking-wider">{decryptedContent}</span>
                                  </div>
                                ) : (() => {
                                  const hasShortId = decryptedContent.includes('[short_id:');
                                  if (hasShortId) {
                                    const match = decryptedContent.match(/\[short_id:([^\]]+)\]/);
                                    const shortId = match ? match[1] : null;
                                    const cleanText = decryptedContent.replace(/\[short_id:[^\]]+\]\n?/, '');
                                    
                                    return (
                                      <div className="space-y-3">
                                        <p className="break-all break-words whitespace-pre-wrap">{cleanText}</p>
                                        {shortId && (
                                          <button
                                            onClick={() => {
                                              setSocialDeepLinkShortId(shortId);
                                              setIsSocialOpen(true);
                                            }}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-pink-500/25 border border-pink-400/20 active:scale-95 transition-all cursor-pointer pointer-events-auto w-full justify-center"
                                          >
                                            <Play className="w-3.5 h-3.5 fill-white" />
                                            Watch Shared Short
                                          </button>
                                        )}
                                      </div>
                                    );
                                  }
                                  return <p className="break-all break-words whitespace-pre-wrap">{decryptedContent}</p>;
                                })()}
                              </div>
                            )}
                            {msg.type === 'file' && msg.fileMetadata && (
                              <div className="mt-2.5">
                                {msg.fileMetadata.mimeType?.startsWith('image/') ? (
                                  <div className="relative rounded-2xl overflow-hidden max-w-xs sm:max-w-md border border-white/15 shadow-2xl group/media cursor-pointer">
                                    <img 
                                      src={msg.fileMetadata.storagePath} 
                                      alt={msg.fileMetadata.name}
                                      className="max-h-60 sm:max-h-80 w-full object-cover rounded-2xl hover:brightness-110 active:scale-98 transition-all" 
                                      referrerPolicy="no-referrer"
                                      onClick={() => window.open(msg.fileMetadata.storagePath, '_blank')}
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 opacity-0 group-hover/media:opacity-100 transition-opacity">
                                      <p className="text-[10px] text-white/95 font-bold truncate">{msg.fileMetadata.name}</p>
                                      <p className="text-[9px] text-indigo-300">{(msg.fileMetadata.size / 1024).toFixed(1)} KB • Click to open large</p>
                                    </div>
                                  </div>
                                ) : msg.fileMetadata.mimeType?.startsWith('video/') ? (
                                  <div className="rounded-2xl overflow-hidden max-w-xs sm:max-w-md border border-white/15 bg-black/40 shadow-2xl">
                                    <video 
                                      src={msg.fileMetadata.storagePath} 
                                      controls 
                                      playsInline
                                      preload="metadata"
                                      className="max-h-60 sm:max-h-80 w-full object-contain" 
                                    />
                                    <div className="bg-white/5 px-3 py-1.5 flex items-center justify-between text-[9px] text-indigo-300/80">
                                      <span className="truncate max-w-[70%]">{msg.fileMetadata.name}</span>
                                      <span>{(msg.fileMetadata.size / (1024 * 1024)).toFixed(2)} MB</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => setPreviewingFile(msg.fileMetadata)}
                                    className="flex items-center justify-between gap-3 p-3 bg-white/10 rounded-xl border border-white/10 hover:bg-white/20 hover:border-cyan-500/30 transition-all cursor-pointer group/file relative"
                                    title="Click to preview file"
                                  >
                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                      <div className="w-10 h-10 rounded-lg bg-indigo-500/30 border border-indigo-500/20 flex items-center justify-center group-hover/file:bg-cyan-500/20 transition-colors">
                                        <Paperclip className="w-5 h-5 text-indigo-400 group-hover/file:text-cyan-400" />
                                      </div>
                                      <div className="flex-1 overflow-hidden">
                                        <p className="text-xs font-bold truncate text-white/90">{msg.fileMetadata.name}</p>
                                        <p className="text-[10px] text-indigo-300">{(msg.fileMetadata.size / 1024).toFixed(1)} KB • Click to preview</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                      <button 
                                        onClick={() => setPreviewingFile(msg.fileMetadata)}
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-all"
                                        title="Preview inline"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                      <a 
                                        href={msg.fileMetadata.storagePath} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/20 text-indigo-200 hover:text-white transition-all"
                                        title="Download secure file"
                                        download={msg.fileMetadata.name}
                                      >
                                        <MonitorUp className="w-3.5 h-3.5 rotate-180" />
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <button 
                            onClick={() => setReactingTo(reactingTo === msg.id ? null : msg.id)}
                            className={cn(
                              "p-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/50 hover:text-white shadow-lg opacity-0 group-hover/bubble:opacity-100 transition-all z-20 hover:scale-110 ml-2 mr-2 shrink-0",
                              isMe ? "order-first" : "order-last"
                            )}
                          >
                            <Smile className="w-4 h-4" />
                          </button>

                          <AnimatePresence>
                            {reactingTo === msg.id && (
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                className={cn(
                                  "absolute bottom-full mb-2 bg-indigo-950/95 backdrop-blur-2xl border border-white/20 rounded-full p-2 flex items-center gap-1.5 shadow-2xl z-30 ring-1 ring-white/10",
                                  isMe ? "right-0" : "left-0"
                                )}
                              >
                                {QUICK_EMOJIS.map(emoji => (
                                  <button 
                                    key={emoji}
                                    onClick={() => handleReaction(msg.id, emoji)}
                                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-white/10 rounded-full transition-all hover:scale-125"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Reactions Display */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className={cn("flex flex-wrap gap-1 mt-1", isMe ? "justify-end" : "justify-start")}>
                            {(Object.entries(msg.reactions) as [string, string[]][]).map(([emoji, uids]) => (
                              <button 
                                key={emoji}
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={cn(
                                  "px-2 py-0.5 rounded-lg text-[10px] flex items-center gap-1.5 border transition-all shadow-sm",
                                  uids.includes(user?.uid || '') 
                                    ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-200" 
                                    : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                                )}
                              >
                                <span className="text-xs">{emoji}</span>
                                <span className="font-bold">{uids.length}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div className={cn(
                          "flex items-center gap-2 px-1 text-[9px] font-black uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity mt-1",
                          isMe ? "flex-row-reverse text-indigo-400" : isAI ? "flex-row-reverse text-cyan-400" : "text-white/40"
                        )}>
                          <span>{isMe ? 'You' : isAI ? 'Memuer AI' : otherUser?.displayName}</span>
                          {!isAI && (isMe ? <UserRoleBadge role={user?.role} email={user?.email} /> : <UserRoleBadge role={otherUser?.role} email={otherUser?.email} />)}
                          <span className="opacity-40">•</span>
                          <span>{format(new Date(msg.createdAt), 'h:mm a')}</span>
                          {isMe && (
                            msg.isRead ? (
                              <div className="flex items-center gap-0.5" title="Read Receipt - Message Seen">
                                <div className="flex -space-x-1.5 shrink-0">
                                  <Check className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                  <Check className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                                </div>
                                <span className="text-[8px] font-black text-cyan-400 tracking-wider">SEEN</span>
                              </div>
                            ) : (
                              <Check className="w-2.5 h-2.5 text-green-400 shrink-0" title="Delivered successfully" />
                            )
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* Typing Indicators */}
                {activeChat && Object.entries(activeChat.typing || {}).map(([typistId, isTyping]) => {
                  if (typistId === user?.uid || !isTyping) return null;
                  const typist = contacts.find(c => c.uid === typistId);
                  return (
                    <motion.div 
                      key={`typing-${typistId}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 ml-12 mb-4"
                    >
                      <div className="flex gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10 shadow-lg">
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        <span className="ml-2 text-[10px] text-indigo-300 font-bold uppercase tracking-widest">{typist?.displayName?.split(' ')[0] || 'Peer'}</span>
                      </div>
                    </motion.div>
                  );
                })}

                <div ref={messagesEndRef} />
              </AnimatePresence>
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 sm:p-6 sm:pt-0 relative z-10">
              {(() => {
                const receiverId = activeChat?.participants?.find(uid => uid !== user?.uid);
                const directContact = contacts.find(c => c.uid === receiverId);
                const isAmIBlockedByTarget = activeChat?.type === 'direct' && directContact?.preferences?.blockedUsers?.includes(user?.uid || '');
                const isTargetBlockedByMe = activeChat?.type === 'direct' && user?.preferences?.blockedUsers?.includes(receiverId || '');

                if (isAmIBlockedByTarget) {
                  return (
                    <div className="p-4 sm:p-5 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400">
                        <ShieldAlert className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Unencrypted Session Interrupted</p>
                        <p className="text-[10px] sm:text-xs text-red-300/80 font-bold mt-1">This user has restricted contact privileges. Signal channel is muted.</p>
                      </div>
                    </div>
                  );
                }

                if (isTargetBlockedByMe) {
                  return (
                    <div className="p-4 sm:p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex flex-col items-center justify-center text-center gap-2 mb-2">
                      <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">Communications Locked</p>
                        <p className="text-[10px] sm:text-xs text-indigo-300/85 font-medium mt-1">You have blocked this contact. Unlock profile in "Room Metadata" to resume communications.</p>
                      </div>
                    </div>
                  );
                }

                const lastWord = messageInput.split(/\s+/).pop() || '';
                const showMentionSuggestions = lastWord.startsWith('@') && '@memuer'.startsWith(lastWord.toLowerCase());
                return (
                  <>
                    {showMentionSuggestions && (
                      <div className="absolute bottom-full left-4 sm:left-8 mb-2 w-64 bg-slate-900/90 backdrop-blur-md rounded-xl border border-cyan-500/30 p-2 shadow-2xl z-50 flex flex-col gap-1">
                        <div className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider px-2 py-1 border-b border-white/5">Mention AI Assistant</div>
                        <button
                          type="button"
                          onClick={() => {
                            const parts = messageInput.split(/\s+/);
                            parts.pop(); // remove last typed word like @ or @me
                            setMessageInput((parts.join(' ') + ' @memuer ').trimStart());
                          }}
                          className="flex items-center gap-2 p-2 hover:bg-white/10 rounded-lg text-left text-xs text-white group cursor-pointer transition-colors"
                        >
                          <span className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center text-[9px] font-bold text-white">AI</span>
                          <div className="flex-1">
                            <span className="font-extrabold text-cyan-200">@memuer</span>
                            <span className="text-[10px] text-indigo-300 ml-2">App AI Assistant</span>
                          </div>
                        </button>
                      </div>
                    )}

                    {uploadPreview && (
                      <div className="p-3 bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl flex items-center justify-between gap-3 mb-2.5 animate-fadeIn">
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          {uploadPreview.isVideo ? (
                            <div className="w-12 h-12 rounded-xl bg-black border border-white/10 overflow-hidden relative flex-shrink-0 flex items-center justify-center">
                              <video src={uploadPreview.url} className="w-full h-full object-cover" muted />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 overflow-hidden relative flex-shrink-0">
                              <img src={uploadPreview.url} className="w-full h-full object-cover" alt="preview" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-white uppercase tracking-wider truncate">{uploadPreview.name}</p>
                            <p className="text-[10px] text-cyan-400 font-bold mt-0.5">
                              {uploading ? `Uploading secure packet (${(uploadPreview.size / (1024 * 1024)).toFixed(2)} MB)...` : "Prepared to send"}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (uploadPreview.url.startsWith('blob:')) {
                              URL.revokeObjectURL(uploadPreview.url);
                            }
                            setUploadPreview(null);
                            setUploading(false);
                          }}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-red-400 flex items-center justify-center transition-colors cursor-pointer border border-white/5"
                          title="Cancel upload"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    <div className={cn(
                      themeName === 'liquidglass' ? 'liquid-glass-input rounded-full' : 'bg-black/40 backdrop-blur-3xl border border-white/10 rounded-full',
                      "p-1.5 sm:p-2.5 pl-4 sm:pl-6 flex items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.4)] focus-within:ring-2 transition-all min-h-[52px]",
                      themeName === 'liquidglass' ? 'ring-teal-500/30' : 'ring-pink-500/30'
                    )}>
                      {audioRecordingState === 'recording' ? (
                        <div className="flex-1 flex items-center justify-between px-3 py-1 gap-2">
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="relative flex h-3 w-3 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-widest">RECORDING</span>
                              <span className="text-xs font-mono font-bold bg-white/5 px-2 py-0.5 rounded text-white">{recordDuration}s</span>
                            </div>
                          </div>
                          
                          {/* Animated voice wave visualizer element */}
                          <div className="hidden xs:flex items-center gap-1 h-5 overflow-hidden">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map((val) => (
                              <span
                                key={val}
                                className="w-0.5 bg-gradient-to-t from-red-500 to-pink-500 rounded-full animate-bounce"
                                style={{
                                  height: `${(val * 4) % 12 + 6}px`,
                                  animationDuration: `${0.4 + val * 0.08}s`
                                }}
                              ></span>
                            ))}
                          </div>

                          <div className="flex items-center gap-1 sm:gap-2">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="p-1.5 sm:p-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] sm:text-xs font-bold border border-white/5"
                              title="Cancel Recording"
                            >
                              <X className="w-3.5 h-3.5 text-red-400" /> <span className="hidden sm:inline">Cancel</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopRecording}
                              className="p-1.5 sm:p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[10px] sm:text-xs font-bold shadow-lg shadow-red-500/25 animate-pulse"
                              title="Stop Recording"
                            >
                              <span className="w-2 h-2 bg-white rounded-sm shrink-0"></span> Keep Recording
                            </button>
                          </div>
                        </div>
                      ) : audioRecordingState === 'review' && previewAudio ? (
                        <div className="flex-1 flex items-center justify-between px-2 sm:px-3 py-1 gap-2">
                          <div className="flex-1 flex items-center gap-2 min-w-0">
                            <span className="text-[9px] sm:text-[10px] font-black text-cyan-400 uppercase tracking-wider shrink-0 hidden sm:inline">PREVIEW VOICE</span>
                            <div className="flex-1 min-w-0 max-w-full">
                              <VoiceMessagePlayer src={previewAudio.base64} duration={previewAudio.duration} isMe={true} />
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={cancelRecording}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white/5 hover:bg-white/10 text-red-400 flex items-center justify-center transition-all cursor-pointer border border-white/5"
                              title="Discard preview"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={sendRecordedVoiceMessage}
                              className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-green-500 hover:bg-green-600 text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-green-500/20"
                              title="Send Voice Message"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileUpload}
                            className="hidden" 
                          />
                          <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className={cn(
                              "p-1.5 sm:p-3 rounded-lg sm:rounded-full transition-colors disabled:opacity-50 cursor-pointer shrink-0",
                              themeName === 'liquidglass' ? 'bg-transparent text-white hover:bg-white/10' : 'bg-white/5 hover:bg-white/10 text-indigo-300'
                            )}
                          >
                            <Paperclip className={cn("w-3.5 h-3.5 sm:w-5 sm:h-5", uploading && "animate-spin")} />
                          </button>
                          <input 
                            type="text" 
                            value={messageInput}
                            onChange={(e) => {
                              setMessageInput(e.target.value);
                              if (e.target.value.includes('@')) setIsAIActive(true);
                              else setIsAIActive(false);
                            }}
                            onKeyDown={(e) => {
                              const lastWordInput = messageInput.split(/\s+/).pop() || '';
                              const showMentionSuggestionsInput = lastWordInput.startsWith('@') && '@memuer'.startsWith(lastWordInput.toLowerCase());
                              if (showMentionSuggestionsInput && (e.key === 'Tab' || e.key === 'Enter')) {
                                e.preventDefault();
                                const parts = messageInput.split(/\s+/);
                                parts.pop();
                                setMessageInput((parts.join(' ') + ' @memuer ').trimStart());
                              }
                            }}
                            placeholder={uploading ? (isAr ? "جاري رفع الملف..." : "Uploading file...") : activeChat?.id.startsWith('ai_') ? (isAr ? "اكتب سؤالك للمساعد الذكي..." : "Ask the AI assistant...") : (isAr ? "اكتب رسالة..." : "Type a message...")} 
                            className={cn(
                              "flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm py-1 sm:py-2 outline-none text-white",
                              themeName === 'liquidglass' ? 'placeholder-white/50 font-normal' : 'placeholder-indigo-300/40 font-semibold'
                            )}
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <div className="relative hidden xs:block">
                              <button 
                                type="button" 
                                onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                                className={cn(
                                  "p-1.5 transition-colors cursor-pointer",
                                  themeName === 'liquidglass' ? 'text-white/70 hover:text-white' : 'text-indigo-300 hover:text-white'
                                )}
                              >
                                <Smile className="w-4 h-4 sm:w-6 sm:h-6" />
                              </button>
                              {isEmojiPickerOpen && (
                                <div className="absolute bottom-full right-0 mb-4 z-50">
                                  <div className="fixed inset-0" onClick={() => setIsEmojiPickerOpen(false)} />
                                  <div className="relative">
                                    <EmojiPicker 
                                      onEmojiClick={onEmojiClick}
                                      width="min(90vw, 320px)"
                                      height="400px"
                                      theme={user?.preferences?.theme === 'midnight' ? EmojiTheme.DARK : EmojiTheme.LIGHT}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <button 
                              type="button"
                              onClick={startRecording}
                              className={cn(
                                "w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all shadow-lg shrink-0 cursor-pointer",
                                themeName === 'liquidglass' ? 'bg-transparent border-white/20 text-white hover:bg-white/10' : 'bg-white/5 border-white/10 text-indigo-300 hover:bg-white/10'
                              )}
                              title="Record Voice Note"
                            >
                              <Mic className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                            </button>
                            <button 
                              type="submit"
                              disabled={!messageInput.trim()}
                              className={cn(
                                "w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:scale-100",
                                themeName === 'liquidglass' 
                                  ? 'bg-transparent text-white hover:bg-white/10' 
                                  : 'bg-gradient-to-br from-pink-500 via-fuchsia-600 to-indigo-700 shadow-lg shadow-pink-500/20 text-white hover:scale-105 active:scale-95'
                              )}
                            >
                              <Send className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                );
              })()}
              <div className="mt-3 sm:mt-4 hidden xs:flex items-center justify-center gap-4 sm:gap-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 italic">
                <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> E2EE Handshake</span>
                <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                <span className="flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Secure Vault</span>
              </div>
            </form>
          </div>

          {/* Chat Info Sidebar */}
          {isChatInfoOpen && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100%' : 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className={cn(
                "h-full flex flex-col shrink-0 overflow-y-auto custom-scrollbar z-50 relative",
                themeName === 'liquidglass' ? 'liquid-glass-panel border-l-0' : themeName === 'luxury' ? 'luxury-panel border-l-0' : 'bg-slate-950/85 backdrop-blur-3xl border-l border-white/5',
                isMobile ? "absolute inset-0 w-full" : "w-[340px]"
              )}
            >
              {/* Sidebar Header */}
              <div className="h-16 sm:h-20 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-black/20">
                <span className="text-sm font-black uppercase tracking-widest text-indigo-300">Room Metadata</span>
                <button 
                  onClick={() => setIsChatInfoOpen(false)}
                  className="p-1.5 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer"
                  title="Close sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 p-6 space-y-6">
                {activeChat.id.startsWith('ai_') ? (
                  /* AI Assistant Room Info */
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-white/10">
                      <span className="text-2xl font-black text-white tracking-widest animate-pulse">AI</span>
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">Personal Chatbot Link</h4>
                      <p className="text-[10px] text-cyan-400 font-extrabold uppercase italic tracking-wider mt-1">Autonomous Assistant</p>
                    </div>
                    <p className="text-xs text-indigo-200/60 leading-relaxed font-semibold">
                      This channel connects you directly to the Memuer AI core. Any queries sent here are processed with real-time, locally insulated contextual loops.
                    </p>
                    
                    <div className="w-full h-px bg-white/5" />
                    <div className="w-full text-left space-y-3">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Node Address</span>
                        <code className="block mt-1 font-mono text-[10px] bg-white/5 py-1.5 px-3 rounded-xl text-cyan-300 select-all truncate">
                          memuer-core.secure-tunnel-link
                        </code>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Security Signature</span>
                        <p className="text-xs text-indigo-200/80 font-bold flex items-center gap-1.5 mt-1">
                          <Lock className="w-3.5 h-3.5 text-green-400" />
                          Insulated Vault Secure
                        </p>
                      </div>
                    </div>
                  </div>
                ) : activeChat.type === 'direct' ? (
                  /* Direct 1-1 Chat Info */
                  (() => {
                    const directContact = contacts.find(c => c.uid === activeChat.participants.find(id => id !== user?.uid));
                    if (!directContact) {
                      return (
                        <div className="text-center text-indigo-300/40 italic text-xs py-8">
                          No direct connection record resolved.
                        </div>
                      );
                    }
                    
                    const isMuted = user?.preferences?.mutedChats?.includes(activeChat.id);
                    const isBlocked = user?.preferences?.blockedUsers?.includes(directContact.uid);
                    
                    return (
                      <div className="space-y-6">
                        {/* Profile Photo & Name */}
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="relative group">
                            <div className="w-24 h-24 rounded-full border-2 border-indigo-400 p-1 bg-slate-900/40 overflow-hidden shadow-2xl relative">
                              <img 
                                src={directContact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${directContact.uid}`} 
                                className="w-full h-full object-cover rounded-full"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <span className={cn(
                              "absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-slate-950 z-10",
                              directContact.isOnline ? "bg-green-500 animate-pulse" : "bg-zinc-600"
                            )} />
                          </div>
                          
                          <div>
                            <h4 className="text-lg font-black tracking-tight text-white">{directContact.displayName}</h4>
                            <p className="text-[10px] text-indigo-300 font-extrabold uppercase italic tracking-wider mt-1">
                              {directContact.role === 'admin' ? '🛡️ System Administrator' : 'Secure Contact'}
                            </p>
                          </div>
                          
                          {directContact.status && (
                            <div className="w-full bg-white/5 border border-white/5 p-3 rounded-2xl">
                              <p className="text-left text-[11px] text-indigo-200/80 italic font-medium leading-relaxed">
                                "{directContact.status}"
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Interactive Controls (Mute / Block) */}
                        <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 px-1">Room Controls</span>
                          
                          <button 
                            type="button"
                            onClick={() => toggleMuteChat(activeChat.id)}
                            className={cn(
                              "w-full py-3 px-4 rounded-2xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                              isMuted 
                                ? "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20" 
                                : "bg-white/5 border-white/5 text-indigo-200 hover:bg-white/10"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-indigo-300" />}
                              {isMuted ? "Muted" : "Active Sound & Alerts"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {isMuted ? "UNMUTE" : "MUTE"}
                            </span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => toggleBlockUser(directContact.uid)}
                            className={cn(
                              "w-full py-3 px-4 rounded-2xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                              isBlocked 
                                ? "bg-red-500/20 border-red-500/30 text-red-500 hover:bg-red-500/30" 
                                : "bg-red-500/5 border-red-500/10 text-red-300 hover:bg-red-500/10 hover:text-red-300"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {isBlocked ? <ShieldCheck className="w-4 h-4 text-green-400" /> : <UserX className="w-4 h-4 text-red-400" />}
                              {isBlocked ? "Comms Blocked" : "Permit Comms"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {isBlocked ? "UNBLOCK" : "BLOCK"}
                            </span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => togglePinChat(activeChat.id)}
                            className={cn(
                              "w-full py-3 px-4 rounded-2xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                              user?.preferences?.pinnedChats?.includes(activeChat.id)
                                ? "bg-pink-500/15 border-pink-500/25 text-pink-400 hover:bg-pink-500/25" 
                                : "bg-white/5 border-white/5 text-indigo-200 hover:bg-white/10"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Pin className={cn("w-4 h-4 text-indigo-300", user?.preferences?.pinnedChats?.includes(activeChat.id) && "text-pink-400 rotate-45")} />
                              {user?.preferences?.pinnedChats?.includes(activeChat.id) ? "Pinned to Top" : "Standard Priority"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {user?.preferences?.pinnedChats?.includes(activeChat.id) ? "UNPIN" : "PIN"}
                            </span>
                          </button>
                        </div>

                        {/* Detailed Metadata Fields */}
                        <div className="w-full h-px bg-white/5" />
                        <div className="space-y-4">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Registered Email</span>
                            <p className="text-xs text-indigo-200 font-bold flex items-center gap-1.5 mt-1 select-all">
                              <Mail className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              {directContact.email || "Confidential Signature"}
                            </p>
                          </div>

                          <div>
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">E2EE Handshake Signature</span>
                            <div className="flex gap-1.5 items-center mt-1">
                              <code className="flex-1 font-mono text-[9px] bg-white/5 py-1.5 px-3 rounded-xl text-cyan-300 select-all truncate">
                                {directContact.publicKey || "Pending Handshake Check"}
                              </code>
                              {directContact.publicKey && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(directContact.publicKey || "");
                                    setErrorMessage("Handshake public key copied!");
                                    setTimeout(() => setErrorMessage(null), 2500);
                                  }}
                                  className="p-1.5 bg-white/5 hover:bg-white/10 text-indigo-300 hover:text-white rounded-lg transition-colors shrink-0 cursor-pointer"
                                  title="Copy Public Key"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {directContact.lastSeen && !directContact.isOnline && (
                            <div>
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Last Decrypted Sync</span>
                              <p className="text-xs text-indigo-200/70 font-semibold mt-1">
                                {new Date(directContact.lastSeen).toLocaleString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  /* Group Chat Info */
                  (() => {
                    const isMuted = user?.preferences?.mutedChats?.includes(activeChat.id);
                    const members = contacts.filter(c => activeChat.participants?.includes(c.uid));
                    
                    return (
                      <div className="space-y-6">
                        {/* Group info display */}
                        <div className="flex flex-col items-center text-center space-y-4">
                          <div className="w-20 h-20 rounded-[28px] bg-white/5 border border-white/10 flex items-center justify-center text-indigo-300 shadow-2xl">
                            <Users className="w-10 h-10" />
                          </div>
                          <div>
                            <h4 className="text-base font-black tracking-tight text-white">{activeChat.name || "Group Room"}</h4>
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mt-1">{activeChat.participants?.length || 0} secure terminals</p>
                          </div>
                        </div>

                        {/* Room Controls */}
                        <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 px-1 font-bold">Room Controls</span>
                          
                          <button 
                            type="button"
                            onClick={() => toggleMuteChat(activeChat.id)}
                            className={cn(
                              "w-full py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                              isMuted 
                                ? "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:bg-amber-500/20" 
                                : "bg-white/5 border-white/5 text-indigo-200 hover:bg-white/10"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {isMuted ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4 text-indigo-300" />}
                              {isMuted ? "Muted" : "Active Sound & Alerts"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {isMuted ? "UNMUTE" : "MUTE"}
                            </span>
                          </button>

                          <button 
                            type="button"
                            onClick={() => togglePinChat(activeChat.id)}
                            className={cn(
                              "w-full py-3 px-4 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                              user?.preferences?.pinnedChats?.includes(activeChat.id)
                                ? "bg-pink-500/15 border-pink-500/25 text-pink-400 hover:bg-pink-500/25" 
                                : "bg-white/5 border-white/5 text-indigo-200 hover:bg-white/10"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <Pin className={cn("w-4 h-4 text-indigo-300", user?.preferences?.pinnedChats?.includes(activeChat.id) && "text-pink-400 rotate-45")} />
                              {user?.preferences?.pinnedChats?.includes(activeChat.id) ? "Pinned to Top" : "Standard Priority"}
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">
                              {user?.preferences?.pinnedChats?.includes(activeChat.id) ? "UNPIN" : "PIN"}
                            </span>
                          </button>
                        </div>

                        {/* Member directory */}
                        <div className="space-y-3">
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400 px-1 font-bold">Participant Terminals</span>
                          
                          <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1 flex flex-col">
                            {members.map(member => {
                              const isMemberMe = member.uid === user?.uid;
                              const isMemberBlocked = user?.preferences?.blockedUsers?.includes(member.uid);
                              
                              return (
                                <div key={member.uid} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl gap-2">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 relative bg-slate-900 border border-white/15">
                                      <img 
                                        src={member.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.uid}`} 
                                        className="w-full h-full object-cover"
                                        referrerPolicy="no-referrer"
                                      />
                                      <span className={cn(
                                        "absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-950",
                                        member.isOnline ? "bg-green-500 animate-pulse" : "bg-zinc-600"
                                      )} />
                                    </div>
                                    <div className="overflow-hidden">
                                      <p className="text-xs font-bold text-white truncate max-w-[125px]">{member.displayName} {isMemberMe && "(You)"}</p>
                                      <p className="text-[8px] font-black text-indigo-400 uppercase tracking-tight truncate">{member.email}</p>
                                    </div>
                                  </div>
                                  
                                  {!isMemberMe && (
                                    <button
                                      type="button"
                                      onClick={() => toggleBlockUser(member.uid)}
                                      className={cn(
                                        "p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer",
                                        isMemberBlocked
                                          ? "bg-red-500/20 border-red-500/25 text-red-400 hover:bg-red-500/30"
                                          : "bg-white/5 border-white/5 text-indigo-300 hover:text-white"
                                      )}
                                      title={isMemberBlocked ? "Unblock Participant" : "Block Participant"}
                                    >
                                      <UserX className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Technical Metadata */}
                        <div className="w-full h-px bg-white/5" />
                        <div>
                          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-400">Group Metadata Hash</span>
                          <code className="block mt-1 font-mono text-[9px] bg-white/5 py-1.5 px-3 rounded-xl text-cyan-300 select-all truncate">
                            {activeChat.id}
                          </code>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
          /* Empty State / Welcome */
          <div className="flex-1 flex flex-col items-center justify-start lg:justify-center p-8 text-center space-y-12 relative overflow-y-auto custom-scrollbar pt-12 lg:pt-0">
            <div className="relative mt-8 lg:mt-0">
              <div className={cn(
                "w-32 h-32 sm:w-48 sm:h-48 rounded-[40px] sm:rounded-[56px] flex items-center justify-center animate-bounce-slow border",
                themeName === 'luxury'
                  ? "bg-[#141414]/95 border-amber-500/30 shadow-[0_0_50px_rgba(212,175,55,0.4)]"
                  : themeName === 'liquidglass'
                  ? "liquid-glass-input shadow-[0_0_60px_rgba(255,255,255,0.2)]"
                  : "bg-white/5 shadow-2xl backdrop-blur-2xl border-white/10"
              )}>
                <Sparkles className={cn("w-12 h-12 sm:w-20 sm:h-20", themeName === 'luxury' ? "text-amber-400" : "text-white")} />
              </div>
            </div>
            
            <div className="max-w-xl space-y-4">
              <h1 className="text-4xl sm:text-6xl font-black tracking-tight font-display select-none" dir="ltr">Memuer</h1>
              <p className="text-2xl sm:text-3xl text-white font-bold font-display tracking-tight">
                {isAr ? `أهلاً بك في بيتك، ${user?.displayName?.split(' ')[0] || user?.displayName || 'صديقي'}` : `Welcome Home, ${user?.displayName?.split(' ')[0] || user?.displayName || 'Friend'}`}
              </p>
              <p className="text-sm text-indigo-200/80 font-medium leading-relaxed max-w-sm mx-auto">
                {isAr ? 'مساحتك الخاصة آمنة وجاهزة للمحادثات المشفرة.' : 'Your private chat space is secure and end-to-end encrypted.'}
                <span className="block mt-3 text-[10px] text-zinc-400 font-bold uppercase tracking-widest">{isAr ? 'معرّف الأمان الخاص بك:' : 'Your Security ID:'}</span>
                <code className="block mt-1 font-mono text-[10px] bg-white/5 py-2 px-3 rounded-xl text-white/60 border border-white/5 truncate max-w-xs mx-auto select-all">{user?.publicKey?.slice(0, 48) || user?.uid}...</code>
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md px-4">
              <div 
                onClick={() => { setSidebarTab('contacts'); setIsMobileSidebarOpen(true); }} 
                className={cn(
                  "p-6 rounded-[32px] border border-white/10 hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl",
                  themeName === 'liquidglass' ? 'liquid-glass-input' : 'bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">{isAr ? 'جهات الاتصال' : 'Contacts'}</p>
              </div>
              
              <div 
                onClick={() => setIsAddConnectionModalOpen(true)} 
                className={cn(
                  "p-6 rounded-[32px] border border-white/10 hover:border-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl",
                  themeName === 'liquidglass' ? 'liquid-glass-input' : 'bg-white/5 hover:bg-white/10'
                )}
              >
                <div className="w-14 h-14 rounded-2xl bg-pink-500/10 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 group-hover:text-white transition-colors">{isAr ? 'إضافة جهة اتصال' : 'Add Contact'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      </motion.div>


        {/* Memuer Social+ Platform */}
        <AnimatePresence>
          {isSocialOpen && (
            <MemuerSocial 
              user={user} 
              onClose={() => { setIsSocialOpen(false); setSocialDeepLinkShortId(null); }} 
              currentTheme={currentTheme}
              themeName={themeName}
              contacts={contacts}
              db={db}
              deepLinkShortId={socialDeepLinkShortId}
              clearDeepLink={() => setSocialDeepLinkShortId(null)}
            />
          )}
        </AnimatePresence>

        {/* Profile Modal */}
        <AnimatePresence>
          {isProfileModalOpen && (() => {
            const modalTheme = getThemeModalClasses();
            return (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className={cn("fixed inset-0 z-[120] backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar", modalTheme.overlay)}
              >
                <motion.div 
                  initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                  className={cn(
                    modalTheme.card,
                    "rounded-3xl sm:rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 my-auto shrink-0 relative transition-all duration-300 border"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <h3 className={cn("text-2xl font-black tracking-tight font-bold", modalTheme.headerText)}>{isAr ? 'الملف الشخصي والإعدادات' : 'Identity & Settings'}</h3>
                    <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="flex flex-col items-center gap-3 py-2 sm:py-4">
                    <div className="relative group">
                      <img 
                        src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                        className={cn("w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover border-4", modalTheme.accentBorder, uploading && "opacity-50 animate-pulse")} 
                        referrerPolicy="no-referrer"
                      />
                      <div 
                        onClick={() => profileImageInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                      >
                        <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <input 
                        type="file" 
                        ref={profileImageInputRef} 
                        className="hidden" 
                        accept="image/*"
                        onChange={handleProfilePhotoChange}
                      />
                    </div>
                    <div className="text-center space-y-1.5">
                      <p className="text-lg sm:text-xl font-bold">{user?.displayName}</p>
                      {user && <div className="flex justify-center"><UserRoleBadge role={user.role} email={user.email} /></div>}
                      <p className={cn("text-[9px] sm:text-[10px] uppercase tracking-widest font-black", modalTheme.subText)}>{isAr ? 'قناة مشفرة وآمنة' : 'Quantum-Secure Channel'}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] ml-1", modalTheme.subText)}>{isAr ? 'حالة الحساب / الرسالة' : 'Status Message'}</label>
                      <input 
                        type="text" 
                        defaultValue={user?.status}
                        onBlur={(e) => updateProfile({ status: e.target.value })}
                        className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30"
                      />
                    </div>
                    <div>
                      <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] ml-1", modalTheme.subText)}>{isAr ? 'مظهر التطبيق' : 'Ambience Palette'}</label>
                      <div className="flex gap-3 mt-2">
                        {[
                          { name: 'Vibrant', class: 'bg-gradient-to-tr from-purple-700 via-purple-600 to-fuchsia-500 border border-purple-400/30' },
                          { name: 'Midnight', class: 'bg-gradient-to-tr from-[#030614] via-blue-900 to-cyan-500 border border-cyan-400/30' },
                          { name: 'Forest', class: 'bg-gradient-to-tr from-[#02140c] via-emerald-800 to-teal-400 border border-emerald-400/30' },
                          { name: 'Crimson', class: 'bg-gradient-to-tr from-[#140207] via-rose-900 to-pink-500 border border-rose-400/30' },
                          { name: 'Liquidglass', class: 'bg-gradient-to-tr from-teal-500 via-cyan-400 to-sky-400 border border-cyan-300/50 shadow-md shadow-cyan-500/20' },
                          { name: 'Luxury', class: 'bg-gradient-to-tr from-[#121212] via-[#D4AF37] to-[#121212] border border-amber-500/50 shadow-md shadow-amber-500/10' }
                        ].map(theme => (
                          <div 
                            key={theme.name}
                            onClick={() => {
                              const chosenTheme = theme.name.toLowerCase();
                              setLocalTheme(chosenTheme);
                              try {
                                localStorage.setItem('memuer_theme', chosenTheme);
                              } catch (_) {}
                              updateProfile({ preferences: { ...user?.preferences, theme: chosenTheme } });
                            }}
                            className={cn(
                              "w-10 h-10 rounded-xl cursor-pointer border-2 transition-all flex items-center justify-center",
                              theme.class,
                              (user?.preferences?.theme || localTheme) === theme.name.toLowerCase() ? "border-white scale-110 shadow-lg shadow-white/20" : "border-transparent opacity-60 hover:opacity-100"
                            )}
                          >
                            {(user?.preferences?.theme || localTheme) === theme.name.toLowerCase() && <Check className="w-4 h-4 text-white" />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between ml-1">
                        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em]", modalTheme.subText)}>Ambience Motion</label>
                        <span className={cn("text-[8px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider", modalTheme.accentBg, modalTheme.accentText)}>Dynamic</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => updateProfile({ preferences: { ...user?.preferences, animatedTheme: !isThemeAnimated } })}
                        className={cn(
                          "w-full mt-2 py-2.5 px-4 rounded-xl border text-xs font-bold transition-all duration-300 flex items-center justify-between shadow-lg cursor-pointer",
                          isThemeAnimated
                            ? cn("bg-white/10 border-white/20", modalTheme.accentText)
                            : "bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Radio className={cn("w-4 h-4", isThemeAnimated && cn("animate-pulse", modalTheme.accentText))} />
                          {isThemeAnimated ? "Moving Cyber Stars & Dynamic Space" : "Static Solid Palette"}
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-80">
                          {isThemeAnimated ? "ENABLED" : "DISABLED"}
                        </span>
                      </button>
                    </div>
                    {isThemeAnimated && (
                      <div>
                        <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] ml-1 font-sans", modalTheme.subText)}>Motion Look Fluidity</label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {[
                            { id: 'aurora', name: 'Cyber Stars', desc: 'Moving stardust & cosmic flares' },
                            { id: 'cyber', name: 'Cyber Storm', desc: 'Fast neon star warp' },
                            { id: 'lava', name: 'Lava Pulse', desc: 'Dynamic magma star drift' },
                            { id: 'nebula', name: 'Nebula Glow', desc: 'Saturated wide sweeps' }
                          ].map(look => (
                            <button
                              key={look.id}
                              type="button"
                              onClick={() => updateProfile({ preferences: { ...user?.preferences, animationLook: look.id } })}
                              className={cn(
                                "p-2.5 rounded-xl border text-left transition-all duration-300 flex flex-col justify-between group cursor-pointer relative overflow-hidden",
                                animationLook === look.id
                                  ? cn(modalTheme.accentBg, modalTheme.accentBorder, "text-white shadow-md")
                                  : "bg-white/5 border-white/5 text-zinc-400 hover:border-white/10 hover:text-white"
                              )}
                            >
                              <span className="text-[10px] font-bold tracking-wide uppercase">{look.name}</span>
                              <span className="text-[8px] opacity-75 mt-0.5 font-sans leading-none">{look.desc}</span>
                              {animationLook === look.id && (
                                <div className={cn("absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full animate-pulse", modalTheme.accentBg)}></div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isThemeAnimated && (
                      <div className={cn("p-3.5 rounded-2xl border space-y-3 shadow-inner bg-black/25", modalTheme.accentBorder)}>
                        <div className="flex items-center justify-between">
                          <label className={cn("text-[10px] font-black uppercase tracking-[0.2em] font-sans flex items-center gap-1.5", modalTheme.accentText)}>
                            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                            Cyber Stars Speed
                          </label>
                          <span className={cn("text-[9px] font-mono font-black px-2 py-0.5 rounded-full border", modalTheme.accentBg, modalTheme.accentBorder, modalTheme.accentText)}>
                            Speed {starsSpeed}x
                          </span>
                        </div>

                        {/* Dropdown selector for speed 1 to 3 */}
                        <div className="relative">
                          <select
                            value={starsSpeed}
                            onChange={(e) => updateProfile({ preferences: { ...user?.preferences, starsSpeed: Number(e.target.value) } })}
                            className={cn("w-full bg-slate-950/90 border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 font-sans cursor-pointer transition-all appearance-none pr-8 font-medium", modalTheme.accentBorder)}
                          >
                            <option value={1} className="bg-slate-950 text-white">Speed 1 • Cosmic Calm (Gentle Glide 0.7x)</option>
                            <option value={2} className="bg-slate-950 text-white">Speed 2 • Cyber Cruise (Balanced Stardust 1.5x)</option>
                            <option value={3} className="bg-slate-950 text-white">Speed 3 • Warp Hyperdrive (High Velocity 2.8x)</option>
                          </select>
                          <div className={cn("absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-xs", modalTheme.accentText)}>
                            ▼
                          </div>
                        </div>

                        {/* 1 to 3 Quick Speed Buttons */}
                        <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                          {[
                            { val: 1, label: 'Speed 1 (Calm)', desc: '0.7x' },
                            { val: 2, label: 'Speed 2 (Flow)', desc: '1.5x' },
                            { val: 3, label: 'Speed 3 (Warp)', desc: '2.8x' }
                          ].map(opt => (
                            <button
                              key={opt.val}
                              type="button"
                              onClick={() => updateProfile({ preferences: { ...user?.preferences, starsSpeed: opt.val } })}
                              className={cn(
                                "py-1.5 px-2 rounded-xl text-[10px] font-mono font-black uppercase tracking-wider transition-all border text-center flex flex-col items-center justify-center",
                                starsSpeed === opt.val
                                  ? cn(modalTheme.accentBg, modalTheme.accentBorder, modalTheme.accentText, "shadow-md scale-[1.02]")
                                  : "bg-white/5 border-white/5 text-zinc-400 hover:text-white hover:bg-white/10"
                              )}
                            >
                              <span>{opt.label}</span>
                              <span className="text-[8px] opacity-75 font-normal">{opt.desc}</span>
                            </button>
                          ))}
                        </div>

                        {/* Interactive Star Interaction Controls: Cursor Follow & Sparkles */}
                        <div className="pt-2 border-t border-white/10 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-left">
                              <p className="text-[11px] font-bold text-white leading-tight">
                                {isAr ? "متابعة مؤشر الفأرة (PC)" : "Follow Cursor Stars (PC)"}
                              </p>
                              <p className={cn("text-[9px] leading-tight", modalTheme.subText)}>
                                {isAr ? "النجوم تتبع المؤشر بنعومة وتعود لمكانها عند الإيقاف" : "Stars follow mouse smoothly and glide back in place"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateProfile({ preferences: { ...user?.preferences, cursorFollowStars: !cursorFollowStars } })}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-mono font-black uppercase tracking-widest border transition-all shrink-0 cursor-pointer",
                                cursorFollowStars
                                  ? cn(modalTheme.accentBg, modalTheme.accentBorder, modalTheme.accentText, "shadow-md shadow-cyan-500/10")
                                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                              )}
                            >
                              {cursorFollowStars ? "ON" : "OFF"}
                            </button>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="text-left">
                              <p className="text-[11px] font-bold text-white leading-tight">
                                {isAr ? "رذاذ النجوم عند اللمس أو النقر" : "Star Click / Touch Sparkles"}
                              </p>
                              <p className={cn("text-[9px] leading-tight", modalTheme.subText)}>
                                {isAr ? "رذاذ نجوم ماسي يتناثر حول إصبعك أو نقرتك" : "Stardust sprinkles around touch on mobile & clicks"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateProfile({ preferences: { ...user?.preferences, touchSparkles: !touchSparkles } })}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-[10px] font-mono font-black uppercase tracking-widest border transition-all shrink-0 cursor-pointer",
                                touchSparkles
                                  ? cn(modalTheme.accentBg, modalTheme.accentBorder, modalTheme.accentText, "shadow-md shadow-pink-500/10")
                                  : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                              )}
                            >
                              {touchSparkles ? "ON" : "OFF"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">Wallpaper Handshake</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {['Geometric', 'Aurora', 'Digital Grid', 'Deep Void'].map(bg => (
                        <div 
                          key={bg}
                          onClick={() => updateProfile({ preferences: { ...user?.preferences, chatBackground: bg.toLowerCase() } })}
                          className={cn(
                            "p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-center cursor-pointer transition-all",
                            user?.preferences?.chatBackground === bg.toLowerCase() && !user?.preferences?.customChatBg ? "bg-white text-indigo-950 border-white" : "bg-white/5 text-indigo-300 border-white/5 hover:bg-white/10"
                          )}
                        >
                          {bg}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">Custom Wallpaper Sync</label>
                    
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {[
                        { name: 'Stars', url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop' },
                        { name: 'Aurora', url: 'https://images.unsplash.com/photo-1579033461380-adb47c3eb938?q=80&w=600&auto=format&fit=crop' },
                        { name: 'Cyber', url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=600&auto=format&fit=crop' },
                        { name: 'Nebula', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=600&auto=format&fit=crop' }
                      ].map(preset => (
                        <div 
                          key={preset.name}
                          onClick={() => updateProfile({ preferences: { ...user?.preferences, customChatBg: preset.url } })}
                          className={cn(
                            "group relative h-12 rounded-xl overflow-hidden cursor-pointer border-2 transition-all",
                            user?.preferences?.customChatBg === preset.url ? "border-white scale-105 shadow-md shadow-white/10" : "border-transparent opacity-75 hover:opacity-100"
                          )}
                          title={`${preset.name} Wallpaper`}
                        >
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span className="text-[8px] font-bold text-white uppercase tracking-tighter">{preset.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 items-center mt-3">
                      <button 
                        onClick={() => bgImageInputRef.current?.click()}
                        className="flex-1 py-2 px-3 bg-white/5 hover:bg-white/10 active:scale-98 border border-white/10 rounded-xl text-indigo-200 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        {uploading ? "Uploading..." : "Upload File"}
                      </button>
                      
                      {user?.preferences?.customChatBg && (
                        <button 
                          onClick={() => updateProfile({ preferences: { ...user?.preferences, customChatBg: "" } })}
                          className="py-2 px-3 bg-red-500/10 hover:bg-red-500/20 active:scale-98 border border-red-500/15 rounded-xl text-red-400 hover:text-red-300 text-xs font-bold transition-all"
                          title="Reset to Theme Wallpaper"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    <input 
                      type="file" 
                      ref={bgImageInputRef} 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleCustomBgUpload}
                    />
                  </div>





                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">Cryptographic E2EE Keys</p>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] text-zinc-300">
                        Vault Status: {user?.vaultSynced ? (
                          <span className="text-green-400 font-bold uppercase tracking-wider text-[9px] ml-1">● SECURED</span>
                        ) : (
                          <span className="text-yellow-400 font-bold uppercase tracking-wider text-[9px] ml-1">▲ DESYNCED</span>
                        )}
                      </span>
                      <button 
                        onClick={resetKeyPair}
                        className="py-1.5 px-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-[9px] uppercase font-black tracking-widest transition-all"
                      >
                        Sync Vault
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={() => { setIsContactModalOpen(true); setIsProfileModalOpen(false); }} 
                    className="flex-1 py-3.5 rounded-2xl bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/25 hover:bg-indigo-500/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <Mail className="w-4 h-4" /> {isAr ? 'الدعم الفني' : 'Contact Support'}
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="flex-1 py-3.5 rounded-2xl bg-red-500/20 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <LogOut className="w-4 h-4" /> {isAr ? 'تسجيل الخروج' : 'Terminate Session'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
            );
          })()}
        </AnimatePresence>

        {/* Contact Us Modal */}
        <AnimatePresence>
          {isContactModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-indigo-950/65 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.9, y: 20 }}
                className="bg-indigo-900 border border-white/10 rounded-3xl sm:rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 my-auto shrink-0 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-pink-500 to-transparent opacity-50"></div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-5 h-5 text-pink-400" />
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight font-bold text-white">{isAr ? 'اتصل بنا / الدعم الفني' : 'Contact Us'}</h3>
                  </div>
                  <button 
                    onClick={() => setIsContactModalOpen(false)} 
                    className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Tab select bar */}
                <div className="flex bg-black/25 rounded-xl p-1 gap-1 border border-white/5">
                  <button
                    onClick={() => setContactActiveTab('create')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all",
                      contactActiveTab === 'create' 
                        ? "bg-white/10 text-white" 
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {isAr ? 'إرسال تذكرة' : 'Submit Ticket'}
                  </button>
                  <button
                    onClick={() => setContactActiveTab('inbox')}
                    className={cn(
                      "flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5",
                      contactActiveTab === 'inbox' 
                        ? "bg-white/10 text-white" 
                        : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {isAr ? 'صندوق الوارد' : 'Your Inbox'}
                    {userContactMessages.length > 0 && (
                      <span className="bg-pink-500 text-white font-black rounded-full text-[8.5px] h-4 min-w-4 px-1 flex items-center justify-center animate-pulse">
                        {userContactMessages.length}
                      </span>
                    )}
                  </button>
                </div>

                {isSendingContact ? (
                  <div className="py-8 flex flex-col items-center justify-center space-y-4">
                    <div className="relative w-12 h-12 flex items-center justify-center">
                      <div className="absolute inset-0 border-2 border-pink-500/10 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
                      <Mail className="w-5 h-5 text-pink-400" />
                    </div>
                    <div className="space-y-1.5 text-center">
                      <p className="text-sm font-black uppercase tracking-wider text-white animate-pulse">
                        {contactProgressStep || (isAr ? 'جاري الاتصال بالدعم...' : 'Accessing support gateway...')}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono tracking-widest">
                        SECURE ROUTING ACTIVE
                      </p>
                    </div>
                  </div>
                ) : contactSendSuccess ? (
                  <div className="py-4 flex flex-col items-center justify-center text-center space-y-5">
                    <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                      <Check className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-white uppercase tracking-wider">{isAr ? 'تم إرسال الرسالة بنجاح!' : 'Inquiry Sent Directly!'}</h4>
                      <p className="text-xs text-indigo-200 px-4 max-w-xs mx-auto leading-relaxed">
                        {isAr ? 'تم إرسال رسالتك بنجاح إلى فريق الدعم الفني. وسيقوم المشرفون بمراجعتها والرد عليك.' : `Your message has been securely submitted from the app directly to ${systemConfig?.contactSupportEmail || 'contactus@memuer.app'}.`}
                      </p>
                    </div>
                    <div className="flex gap-2 w-full pt-4">
                      <button 
                        type="button"
                        onClick={() => { setContactSendSuccess(false); setContactProgressStep(null); }}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all"
                      >
                        {isAr ? 'إرسال رسالة أخرى' : 'Send Another'}
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setIsContactModalOpen(false); setContactSendSuccess(false); setContactProgressStep(null); }}
                        className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-indigo-500 hover:opacity-90 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all"
                      >
                        {isAr ? 'إغلاق' : 'Dismiss'}
                      </button>
                    </div>
                  </div>
                ) : contactActiveTab === 'inbox' ? (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {userContactMessages.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-4 space-y-2">
                        <Mail className="w-6 h-6 text-zinc-550 animate-pulse" />
                        <h4 className="text-xs font-bold text-zinc-400">{isAr ? 'لا توجد رسائل سابقة' : 'No support history'}</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed max-w-xs">{isAr ? 'أي تذكرة تقوم بإرسالها ستظهر هنا مع ردود الدعم الفني مباشرة.' : 'Any inquiries you submit will appear here with dynamic admin responses in real-time.'}</p>
                      </div>
                    ) : (
                      userContactMessages.map((msg) => {
                        const msgDate = msg.createdAt ? (msg.createdAt instanceof Timestamp ? msg.createdAt.toDate() : new Date(msg.createdAt.seconds * 1000 || msg.createdAt)) : new Date();
                        return (
                          <div key={msg.id} className="bg-black/20 border border-white/5 rounded-2xl p-3.5 space-y-3.5">
                            <div className="flex justify-between items-start border-b border-white/5 pb-2 gap-2">
                              <div>
                                <h4 className="text-xs font-bold text-white truncate max-w-[180px]">{msg.subject}</h4>
                                <p className="text-[8px] text-zinc-500 font-mono">{msgDate.toLocaleDateString()}</p>
                              </div>
                              <span className={cn(
                                "text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded border",
                                msg.replied 
                                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold" 
                                  : "bg-zinc-800 border-white/5 text-zinc-500"
                              )}>
                                {msg.replied ? (isAr ? 'تم الرد' : 'Answered') : (isAr ? 'قيد الانتظار' : 'Pending')}
                              </span>
                            </div>

                            <p className="text-[11px] text-zinc-350 leading-relaxed italic whitespace-pre-wrap">{msg.message}</p>

                            {/* Display reply if exists */}
                            {msg.replied && msg.replyMessage && (
                              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-1 mt-2 text-left">
                                <div className="text-[8px] font-mono text-emerald-400 font-bold uppercase">
                                  {isAr ? 'رد الدعم الفني:' : 'ADMIN ANSWER:'} ({msg.repliedBy || 'Support'})
                                </div>
                                <p className="text-[11px] text-zinc-200 leading-relaxed font-sans whitespace-pre-wrap">{msg.replyMessage}</p>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-indigo-200">
                      {isAr ? 'هل لديك أي استفسار أو اقتراح؟ يمكنك كتابة رسالتك وسنقوم بالرد عليك مباشرة.' : 'Have feedback, questions, or ideas? Submitting this form transmits your message directly to our support team.'}
                    </p>

                    <form onSubmit={handleSendContact} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          {isAr ? 'البريد الإلكتروني للرد' : 'Your Email (For Replies)'}
                        </label>
                        <input 
                          type="email" 
                          required
                          placeholder={isAr ? "مثال: name@example.com" : "e.g. name@example.com"}
                          value={contactEmail || user?.email || ''}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30 text-white placeholder-zinc-500 focus:outline-none placeholder:text-zinc-500 bg-black/10"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          {isAr ? 'عنوان الموضوع' : 'Subject Matter'}
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder={isAr ? "مثال: اقتراح، مشكلة تقنية، استفسار" : "e.g. Feedback, Security, Feature Suggestion"}
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30 text-white placeholder-zinc-500 focus:outline-none placeholder:text-zinc-500 bg-black/10"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          {isAr ? 'تفاصيل الرسالة' : 'Detailed Message'}
                        </label>
                        <textarea 
                          required
                          rows={4}
                          placeholder={isAr ? "اكتب رسالتك هنا..." : "Type your message here..."}
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30 text-white placeholder-zinc-550 focus:outline-none resize-none placeholder:text-zinc-500 bg-black/10"
                        />
                      </div>

                      <div className="flex gap-3 pt-2">
                        <button 
                          type="button"
                          onClick={() => setIsContactModalOpen(false)}
                          className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all"
                        >
                          {isAr ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-indigo-500/90 hover:opacity-90 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {isAr ? 'إرسال الاستفسار' : 'Transmit Inquiry'}
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* What's New / Changelog Modal */}
        <AnimatePresence>
          {isChangelogOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-indigo-950/65 backdrop-blur-xl flex items-start sm:items-center justify-center p-4 sm:p-8 overflow-y-auto custom-scrollbar"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 30 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.9, y: 30 }}
                className="bg-indigo-900/90 border border-white/20 rounded-3xl sm:rounded-[48px] p-6 sm:p-8 w-full max-w-lg shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative group my-auto shrink-0"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50"></div>
                
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h3 className="text-3xl font-black tracking-tighter text-white">{isAr ? 'سجل التحديثات' : 'SYSTEM UPDATES'}</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mt-1">{isAr ? 'تحديثات النظام الحالية • v4.0' : 'Transmission received • v4.0 Beta'}</p>
                  </div>
                  <button 
                    onClick={() => setIsChangelogOpen(false)} 
                    className="p-3 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-2xl transition-all border border-white/5 hover:border-red-500/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                  {UPDATES.map((update, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="p-5 bg-white/5 rounded-[28px] border border-white/10 hover:bg-white/[0.08] hover:border-cyan-500/30 transition-all group/item shadow-lg"
                    >
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover/item:border-cyan-500/40 group-hover/item:bg-cyan-500/10 transition-colors shrink-0">
                          {update.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1 gap-2">
                            <h4 className="font-bold text-white text-base sm:text-lg leading-tight">{update.title}</h4>
                            <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300/70 bg-white/10 px-2 py-0.5 rounded-full shrink-0 border border-white/5">{update.date}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-indigo-200/80 leading-relaxed font-medium mt-1">
                            {update.description}
                          </p>

                          {/* Interactive 'Check it out' / Direct Navigation Action Button */}
                          {(update as any).action && (
                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={(update as any).action}
                                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500/25 via-indigo-500/25 to-pink-500/20 text-cyan-200 border border-cyan-400/40 hover:border-cyan-300 hover:bg-cyan-500/35 transition-all cursor-pointer shadow-md shadow-cyan-950/40 hover:scale-[1.03] active:scale-95 group/btn"
                              >
                                <span className="text-white font-black text-[11px] tracking-wide">
                                  {(update as any).actionLabel || (isAr ? 'استكشف الآن' : 'Check it out')}
                                </span>
                                <ExternalLink className="w-3.5 h-3.5 text-cyan-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => setIsChangelogOpen(false)}
                    className="w-full py-4 rounded-3xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-indigo-950 font-black uppercase tracking-[0.2em] shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    {isAr ? 'فهمت ذلك' : 'Acknowledged'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Group Creation Modal */}
        <AnimatePresence>
          {isGroupModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-indigo-950/65 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-indigo-900 border border-white/10 rounded-3xl sm:rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 my-auto shrink-0"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black tracking-tight font-bold">Forge Group</h3>
                  <button onClick={() => setIsGroupModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="Group Moniker..." 
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-cyan-500/30"
                  />

                  <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 px-1">
                    {contacts.map(contact => (
                      <div 
                        key={contact.uid}
                        onClick={() => {
                          if (selectedForGroup.includes(contact.uid)) {
                            setSelectedForGroup(prev => prev.filter(id => id !== contact.uid));
                          } else {
                            setSelectedForGroup(prev => [...prev, contact.uid]);
                          }
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border",
                          selectedForGroup.includes(contact.uid) ? "bg-cyan-500/20 border-cyan-400/30" : "bg-white/5 border-transparent hover:bg-white/10"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <img 
                            src={contact.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${contact.uid}`} 
                            className="w-8 h-8 rounded-full border border-white/10" 
                            referrerPolicy="no-referrer"
                          />
                          <p className="text-sm font-bold">{contact.displayName}</p>
                        </div>
                        {selectedForGroup.includes(contact.uid) && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={createGroup}
                  disabled={selectedForGroup.length === 0}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Create Secure Cluster
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
 
        {/* Add Connection Modal */}
        <AnimatePresence>
          {isAddConnectionModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-indigo-950/65 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-indigo-900 border border-white/10 rounded-3xl sm:rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 my-auto shrink-0"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300 font-bold">{isAr ? 'إضافة جهة اتصال' : 'Add New Contact'}</h3>
                  <button onClick={() => setIsAddConnectionModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                </div>
 
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3 ml-1">{isAr ? 'البحث بالاسم أو المعرّف' : 'Search by Name or ID'}</p>
                    <div className="flex items-center gap-3">
                      <input 
                        autoFocus
                        type="text" 
                        id="modal-search-input"
                        placeholder={isAr ? "أدخل اسم المستخدم أو المعرّف..." : "e.g. demo-1234 or Alice"} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            findByUid(e.currentTarget.value);
                            setIsAddConnectionModalOpen(false);
                          }
                        }}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-1 ring-cyan-400"
                      />
                      <button 
                        onClick={() => {
                          const val = (document.getElementById('modal-search-input') as HTMLInputElement)?.value;
                          if (val) {
                            findByUid(val);
                            setIsAddConnectionModalOpen(false);
                          }
                        }}
                        className="p-2.5 bg-cyan-500 rounded-xl hover:bg-cyan-400 transition-colors"
                      >
                        <Search className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
 
                  <div className="grid grid-cols-2 gap-4">
                    <div onClick={() => { setIsGroupModalOpen(true); setIsAddConnectionModalOpen(false); }} className="p-4 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-400/20 flex items-center justify-center text-cyan-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100 text-center">Group Chat</p>
                    </div>

                    <div 
                      onClick={() => { 
                        setSidebarWidgetPinned(!sidebarWidgetPinned); 
                        setIsAddConnectionModalOpen(false); 
                      }} 
                      className={cn(
                        "p-4 bg-white/5 rounded-3xl border transition-all cursor-pointer group flex flex-col items-center justify-center gap-2 text-center",
                        sidebarWidgetPinned ? "border-cyan-500/40 bg-cyan-500/5 hover:bg-cyan-500/10" : "border-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
                        sidebarWidgetPinned ? "bg-cyan-500/20 text-cyan-400 animate-pulse" : "bg-white/5 text-zinc-400 group-hover:text-cyan-400"
                      )}>
                        <span className="text-lg">📌</span>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">
                        {sidebarWidgetPinned ? "Unpin Lives" : "Pin Live Tracker"}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
 
              {/* Document Preview Modal */}
        <AnimatePresence>
          {previewingFile && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[220] bg-indigo-950/80 backdrop-blur-md flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 15 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.95, y: 15 }}
                className="bg-indigo-950 border border-white/10 rounded-[32px] w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden relative"
              >
                {/* Header */}
                <div className="p-6 bg-indigo-900/40 border-b border-white/10 flex items-center justify-between pointer-events-auto">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="text-sm font-black tracking-tight text-white truncate">{previewingFile.name}</h3>
                      <p className="text-[10px] text-indigo-300 font-mono">
                        {(previewingFile.size / 1024).toFixed(1)} KB • {previewingFile.mimeType || 'Unknown format'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a 
                      href={previewingFile.storagePath} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-indigo-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2"
                      download={previewingFile.name}
                    >
                      <MonitorUp className="w-4 h-4 rotate-180" />
                      <span>Download</span>
                    </a>
                    <button 
                      onClick={() => setPreviewingFile(null)} 
                      className="p-2.5 bg-white/5 hover:bg-white/10 text-white hover:text-cyan-400 rounded-xl transition-colors border border-white/5"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-black/40 custom-scrollbar flex flex-col justify-between">
                  {previewLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                      <div className="w-10 h-10 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                      <p className="text-xs text-cyan-400 font-mono uppercase tracking-wider animate-pulse">Decrypting content stream...</p>
                    </div>
                  ) : isTextFile(previewingFile.name, previewingFile.mimeType) ? (
                    <div className="flex-1 bg-black/35 rounded-2xl border border-white/5 p-5 font-mono text-xs text-indigo-200 overflow-auto whitespace-pre-wrap max-h-[60vh] text-left leading-relaxed select-text custom-scrollbar custom-selection">
                      {previewTextContent || "Empty file content."}
                    </div>
                  ) : isPdfFile(previewingFile.name, previewingFile.mimeType) ? (
                    <div className="flex-1 rounded-2xl border border-white/5 overflow-hidden bg-white/5 h-full relative" style={{ minHeight: '400px' }}>
                      <iframe 
                        src={previewingFile.storagePath} 
                        className="w-full h-full border-none rounded-2xl bg-indigo-950/20"
                        title={previewingFile.name}
                      />
                    </div>
                  ) : isOfficeFile(previewingFile.name, previewingFile.mimeType) ? (
                    <div className="flex-1 rounded-2xl border border-white/5 overflow-hidden bg-white/5 h-full" style={{ minHeight: '400px' }}>
                      <iframe 
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(previewingFile.storagePath)}&embedded=true`} 
                        className="w-full h-full border-none rounded-3xl"
                        title={previewingFile.name}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-3xl bg-indigo-900/5 max-w-md mx-auto my-auto space-y-4">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <AlertTriangle className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-white font-bold text-sm">Rich Preview Unavailable</h4>
                        <p className="text-xs text-indigo-300">This file format cannot be viewed inline. You can download or open it in a new window.</p>
                      </div>
                      <a 
                        href={previewingFile.storagePath} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-indigo-600/30 border border-indigo-500/30 hover:bg-indigo-600/50 text-indigo-200 text-xs font-black uppercase tracking-widest rounded-xl transition-all"
                      >
                        Open In New Window
                      </a>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Calling / Active Call Floating UI */}
        <AnimatePresence>
          {calling && (
            <motion.div 
              drag={isCallMinimized && !isMobile}
              dragMomentum={false}
              dragElastic={0.05}
              initial={{ opacity: 0, scale: 0.95, y: isCallMinimized ? -50 : 0 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                y: isCallMinimized ? 16 : 0,
                x: 0,
                width: isCallMinimized ? (isMobile ? '92vw' : '440px') : '100vw',
                height: isCallMinimized ? '76px' : '100vh',
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "fixed z-[200] transition-all duration-300 ease-out text-white overflow-hidden",
                isCallMinimized 
                  ? (themeName === 'luxury'
                      ? "top-4 left-1/2 -translate-x-1/2 rounded-2xl border border-amber-500/40 bg-[#0c0c0c]/98 shadow-[0_0_25px_rgba(212,175,55,0.2)] select-none cursor-pointer flex items-center justify-between px-4 py-2"
                      : "top-4 left-1/2 -translate-x-1/2 rounded-2xl border border-cyan-500/50 bg-black/95 backdrop-blur-md shadow-[0_0_25px_rgba(6,182,212,0.3)] select-none cursor-pointer flex items-center justify-between px-4 py-2"
                    )
                  : (themeName === 'liquidglass' 
                      ? "inset-0 bg-black/40 backdrop-blur-xl flex items-center justify-center p-2 sm:p-6" 
                      : (themeName === 'luxury'
                          ? "inset-0 bg-luxury flex items-center justify-center p-2 sm:p-6"
                          : "inset-0 bg-zinc-950/98 backdrop-blur-3xl flex flex-col justify-between")
                    )
              )}
            >
              {isCallMinimized ? (
                /* Minimized Island UI at top front */
                <div 
                  className="flex items-center justify-between w-full h-full select-none" 
                  onClick={handleMaximizeAndFixBuffering}
                  title="Click to maximize call"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className={cn(
                      "w-9 h-9 rounded-full overflow-hidden shrink-0 relative animate-pulse",
                      themeName === 'luxury' ? "bg-zinc-900 border-2 border-amber-500" : "bg-zinc-800 border-2 border-cyan-500"
                    )}>
                      <img 
                        src={calling.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${calling.user.uid}`} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-black animate-ping", themeName === 'luxury' ? "bg-amber-400" : "bg-green-500")} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black truncate text-white tracking-tight">{calling.user.displayName}</p>
                      <div className="flex items-center gap-1">
                        <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", themeName === 'luxury' ? "bg-amber-400" : "bg-cyan-400")}></span>
                        <p className={cn("text-[9px] font-black uppercase tracking-widest truncate", themeName === 'luxury' ? "text-amber-400" : "text-cyan-400")}>Floating Call</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 animate-fade-in" onClick={(e) => e.stopPropagation()}>
                    {/* Maximize restore button */}
                    <button 
                      onClick={handleMaximizeAndFixBuffering}
                      className={cn(
                        "p-2 bg-white/5 border rounded-xl transition-all",
                        themeName === 'luxury' 
                          ? "border-amber-500/20 text-amber-200 hover:bg-amber-500/10 hover:border-amber-500/40" 
                          : "border-white/10 hover:bg-white/20 text-indigo-200 hover:text-white"
                      )}
                      title="Maximize call"
                    >
                      <Plus className={cn("w-4 h-4 rotate-45", themeName === 'luxury' ? "text-amber-400" : "text-cyan-400")} />
                    </button>

                    {/* Mute toggle button */}
                    <button 
                      onClick={toggleMute}
                      className={cn(
                        "p-2 rounded-xl transition-all border",
                        isMuted 
                          ? "bg-red-500/20 border-red-500 text-red-500 shadow-md shadow-red-500/10" 
                          : "bg-white/5 border-white/10 text-zinc-300 hover:border-white/20 hover:bg-white/10"
                      )}
                      title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                      {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>

                    {/* End call button */}
                    <button 
                      onClick={() => {
                        if (calling.isIncoming) {
                          handleDeclineCall('declined');
                        } else if (remoteStream) {
                          handleDeclineCall('hangup');
                        } else {
                          handleDeclineCall('cancelled');
                        }
                      }} 
                      className="p-2 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 hover:brightness-110 shadow-lg shadow-red-500/20 text-white transition-all hover:scale-105 active:scale-95"
                      title="End call session"
                    >
                      <PhoneOff className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Full Screen UI - Conditional Centered Liquid Glass Panel vs Luxury Centered Panel vs Classic Full Screen */
                <div className={cn(
                  themeName === 'liquidglass' 
                    ? "relative w-full h-full max-w-4xl max-h-[92vh] sm:max-h-[720px] flex flex-col justify-between p-6 sm:p-8 overflow-hidden liquid-glass-call-window animate-fade-in shadow-3xl"
                    : (themeName === 'luxury'
                        ? "relative w-full h-full max-w-4xl max-h-[92vh] sm:max-h-[720px] flex flex-col justify-between p-6 sm:p-8 overflow-hidden bg-black/95 rounded-[32px] border border-amber-500/20 shadow-[0_0_50px_rgba(212,175,55,0.15)]"
                        : "relative w-full h-full flex flex-col justify-between p-6 overflow-hidden")
                )}>
                  {/* Top Header Row of Full Screen Call */}
                  <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", themeName === 'luxury' ? "bg-amber-400" : "bg-green-400")}></div>
                      <p className={cn("text-xs font-mono uppercase tracking-[0.2em]", themeName === 'luxury' ? "text-amber-400/80" : "text-white/70")}>
                        {calling.type === 'video' ? 'Secure Peer Video Session' : 'Encrypted Handshake Node'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Manual heal connection button */}
                      <button 
                        onClick={() => {
                          handleMaximizeAndFixBuffering();
                          setErrorMessage("Synthesizer pipeline realigned. Audio/video buffers synced.");
                          setTimeout(() => setErrorMessage(null), 3000);
                        }}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                          themeName === 'luxury'
                            ? "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-400 hover:text-white"
                            : "bg-cyan-500/10 border border-cyan-400/30 hover:bg-cyan-500/20 text-cyan-400 hover:text-white"
                        )}
                        title="Fix Buffering & Re-load streams"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Fix Buffering</span>
                      </button>

                      {/* Minimize button to go to top-front of screen */}
                      <button 
                        onClick={() => setIsCallMinimized(true)}
                        className={cn(
                          "px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5",
                          themeName === 'luxury'
                            ? "bg-[#141414]/90 border border-amber-500/20 text-amber-300 hover:text-white hover:bg-amber-500/10"
                            : "bg-white/5 border border-white/10 text-zinc-300 hover:text-white"
                        )}
                        title="Minimize to top of screen"
                      >
                        <Plus className={cn("w-3.5 h-3.5 rotate-45", themeName === 'luxury' ? "text-amber-400" : "text-indigo-400")} />
                        <span>Minimize</span>
                      </button>
                    </div>
                  </div>

                  {/* Main Call Viewport (Call content) */}
                  <div className="flex-1 flex flex-col items-center justify-center relative w-full my-4">
                    {!remoteStream ? (
                      /* Wave animation background and large avatar for dialing/ringing */
                      <div className="flex flex-col items-center text-center max-w-sm w-full space-y-6 relative z-10 animate-fade-in">
                        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
                          {themeName === 'luxury' ? (
                            <>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] bg-amber-500/5 rounded-full border border-amber-500/10" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-amber-500/10 rounded-full border border-amber-500/20" />
                            </>
                          ) : (
                            <>
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] h-[180%] bg-indigo-900/10 animate-pulse rounded-full" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-cyan-400/5 animate-pulse rounded-full" />
                            </>
                          )}
                        </div>
                        <div className={cn(
                          "relative w-36 h-36 mx-auto rounded-full overflow-hidden shadow-2xl",
                          themeName === 'luxury'
                            ? "border-4 border-amber-500/40 ring-[12px] ring-amber-500/5"
                            : "border-4 border-cyan-500/30 ring-[12px] ring-cyan-500/5"
                        )}>
                          <img 
                            src={calling.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${calling.user.uid}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-1">
                          <h3 className={cn("text-3xl font-black tracking-tight", themeName === 'luxury' ? "text-amber-100" : "text-white")}>{calling.user.displayName}</h3>
                          <p className={cn("text-[10px] font-mono tracking-[0.3em] uppercase", themeName === 'luxury' ? "text-amber-400" : "text-cyan-400")}>
                            {calling.isIncoming ? "Secure Incoming Link" : "Connecting secure handshake link..."}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Big Video Feed spanning the workspace area nicely */
                      <div className="w-full h-full max-h-[70vh] rounded-2xl border border-white/10 overflow-hidden bg-black relative flex items-center justify-center">
                        <video 
                          autoPlay 
                          playsInline 
                          ref={(el) => {
                            if (el) {
                              if (remoteStream && (el as HTMLVideoElement).srcObject !== remoteStream) {
                                (el as HTMLVideoElement).srcObject = remoteStream;
                                (el as HTMLVideoElement).play().catch(e => console.log("Remote play failed", e));
                              }
                              // @ts-ignore
                              remoteVideoRef.current = el;
                            } else {
                              // @ts-ignore
                              remoteVideoRef.current = null;
                            }
                          }}
                          style={{ 
                            filter: videoFilters[remoteVideoFilter].filter
                          }}
                          className="w-full h-full object-cover"
                        />
                        {!remoteStream.getVideoTracks().some(t => t.enabled) && (
                          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 backdrop-blur-md">
                            <div className="flex flex-col items-center gap-2 text-center">
                              <VideoOff className="w-8 h-8 text-white/30" />
                              <p className="text-xs font-black uppercase tracking-widest text-white/40">Camera Suspended</p>
                            </div>
                          </div>
                        )}
                        
                        {/* Picture-in-Picture Self View overlay inside video viewport */}
                        {activeCallStream && (
                          <div className="absolute bottom-4 right-4 w-32 h-44 rounded-xl overflow-hidden border border-white/20 bg-zinc-900 shadow-2xl z-20">
                            <video 
                              autoPlay 
                              muted 
                              playsInline 
                              style={{ 
                                filter: videoFilters[activeVideoFilter].filter,
                                transform: 'scaleX(-1)' // Mirror self
                              }}
                              ref={(el) => {
                                if (el) {
                                  if (activeCallStream && (el as HTMLVideoElement).srcObject !== activeCallStream) {
                                    (el as HTMLVideoElement).srcObject = activeCallStream;
                                    (el as HTMLVideoElement).play().catch(e => console.log("Local play failed", e));
                                  }
                                  // @ts-ignore
                                  localVideoRef.current = el;
                                } else {
                                  // @ts-ignore
                                  localVideoRef.current = null;
                                }
                              }}
                              className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
                            />
                            {isCameraOff && (
                              <div className="w-full h-full flex items-center justify-center bg-indigo-950">
                                <User className="w-6 h-6 text-indigo-400/40" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Call Settings Drawer Inside Call Overlay */}
                  {isCallSettingsOpen && (
                    <div className="absolute right-6 bottom-32 w-80 bg-zinc-950/95 border border-white/10 rounded-2xl p-4 space-y-3 z-30 shadow-2xl backdrop-blur-md">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Volume2 className="w-4 h-4 text-cyan-400" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Switch Speakers / Audio Output</p>
                        </div>
                        <p className="text-[9px] text-indigo-200/50 mb-2 leading-tight">Switch between speakers, earpiece, wired/wireless headphones, or external bluetooth channels.</p>
                        
                        <div className="flex flex-col gap-1.5 mt-2">
                          <select 
                            value={selectedAudioDevice}
                            onChange={(e) => changeAudioOutput(e.target.value)}
                            className="w-full bg-indigo-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                          >
                            <option value="default" className="bg-indigo-950">Default System Output</option>
                            {audioDevices.map((device) => (
                              <option key={device.deviceId} value={device.deviceId} className="bg-indigo-950">
                                {device.label || `Output Channel (${device.deviceId.slice(0, 5)})`}
                              </option>
                            ))}
                            <option value="internal_speaker" className="bg-indigo-950">🔊 Built-in Speaker (Outside)</option>
                            <option value="earpiece" className="bg-indigo-950">📞 Earpiece Receiver (Inner Receiver)</option>
                            <option value="headphones" className="bg-indigo-950">🎧 Plugged-in Headphones</option>
                            <option value="bluetooth" className="bg-indigo-950">📶 Wireless Bluetooth Speakers</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="border-t border-white/5 pt-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-indigo-300 mb-1.5">Direct Routing Preset Tests</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {['internal_speaker', 'earpiece', 'headphones', 'bluetooth'].map((preset) => {
                            const labels: Record<string, string> = {
                              internal_speaker: '🔊 Speaker (Out)',
                              earpiece: '📞 Receiver (In)',
                              headphones: '🎧 Headphones',
                              bluetooth: '📶 Bluetooth'
                            };
                            return (
                              <button 
                                key={preset}
                                onClick={() => changeAudioOutput(preset)}
                                className={cn(
                                  "px-2 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                                  selectedAudioDevice === preset 
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 shadow-sm"
                                )}
                              >
                                <span>{labels[preset]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* bottom buttons panel */}
                  <div className="relative z-10 flex flex-col items-center gap-4 w-full">
                    {/* Synchronized video filter selector (only for video mode) */}
                    {remoteStream && calling.type === 'video' && (
                      <div className="w-full max-w-lg overflow-x-auto no-scrollbar py-1">
                        <div className="flex gap-2 justify-center px-2">
                          {videoFilters.map((filter, idx) => (
                            <button
                              key={filter.name}
                              onClick={() => setActiveVideoFilter(idx)}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                                activeVideoFilter === idx 
                                  ? "bg-cyan-500 text-indigo-950 border-cyan-400 shadow-lg shadow-cyan-500/20" 
                                  : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
                              )}
                            >
                              {filter.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Calling Controls Group */}
                    <div className={cn(
                      "flex items-center justify-between w-full max-w-md p-4 shadow-2xl backdrop-blur-md",
                      themeName === 'luxury'
                        ? "bg-[#141414]/90 border border-amber-500/20 rounded-[24px]"
                        : "bg-white/5 border border-white/10 rounded-3xl"
                    )}>
                      <div className="flex items-center gap-2">
                        {/* Mic state */}
                        <button 
                          onClick={toggleMute}
                          className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all border",
                            isMuted 
                              ? "bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/10" 
                              : (themeName === 'luxury' 
                                  ? "bg-[#0c0c0c]/80 border-amber-500/20 text-amber-200 hover:border-amber-500/40 hover:text-white" 
                                  : "bg-white/5 border-white/10 text-white hover:bg-white/10")
                          )}
                          title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
                        >
                          {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>

                        {/* Camera State */}
                        <button 
                          onClick={toggleCamera}
                          className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all border",
                            isCameraOff 
                              ? "bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/10" 
                              : (themeName === 'luxury' 
                                  ? "bg-[#0c0c0c]/80 border-amber-500/20 text-amber-200 hover:border-amber-500/40 hover:text-white" 
                                  : "bg-white/5 border-white/10 text-white hover:bg-white/10")
                          )}
                          title={isCameraOff ? "Enable Camera" : "Disable Camera"}
                        >
                          {isCameraOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                        </button>

                        {/* Screen share tool */}
                        {calling.type === 'video' && (
                          <button 
                            onClick={toggleScreenShare}
                            className={cn(
                              "w-11 h-11 rounded-xl flex items-center justify-center transition-all border",
                              isScreenSharing 
                                ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20" 
                                : (themeName === 'luxury' 
                                    ? "bg-[#0c0c0c]/80 border-amber-500/20 text-amber-200 hover:border-amber-500/40 hover:text-white" 
                                    : "bg-white/5 border-white/10 text-white hover:bg-white/10")
                            )}
                            title="Screen Share"
                          >
                            <MonitorUp className="w-4 h-4" />
                          </button>
                        )}

                        {/* Audio Routing Settings */}
                        <button 
                          onClick={() => setIsCallSettingsOpen(!isCallSettingsOpen)}
                          className={cn(
                            "w-11 h-11 rounded-xl flex items-center justify-center transition-all relative border",
                            isCallSettingsOpen 
                              ? (themeName === 'luxury' ? "bg-amber-500/25 border-amber-400 text-amber-300" : "bg-cyan-500/30 border-cyan-400 text-cyan-300") 
                              : (themeName === 'luxury' 
                                  ? "bg-[#0c0c0c]/80 border-amber-500/20 text-amber-200 hover:border-amber-500/40 hover:text-white" 
                                  : "bg-white/5 border-white/10 text-white hover:bg-white/10")
                          )}
                          title="Audio Settings"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Connection accept/decline action triggers */}
                      <div className="flex items-center gap-3">
                        {calling.isIncoming && !remoteStream && (
                          <button 
                            onClick={activeChat?.type === 'group' ? handleJoinGroupCall : handleAnswerCall} 
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all",
                              themeName === 'luxury' 
                                ? "bg-gradient-to-br from-amber-500 to-yellow-600 shadow-amber-500/10 text-black font-black" 
                                : "bg-gradient-to-br from-green-400 to-emerald-600 shadow-green-500/20 text-white"
                            )}
                            title="Accept Link"
                          >
                            <Phone className="w-5 h-5" />
                          </button>
                        )}
                        
                        {/* Red decline button */}
                        <button 
                          onClick={() => {
                            if (calling.isIncoming) {
                              handleDeclineCall('declined');
                            } else if (remoteStream) {
                              handleDeclineCall('hangup');
                            } else {
                              handleDeclineCall('cancelled');
                            }
                          }} 
                          className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all group/red"
                          title="End Session"
                        >
                          <PhoneOff className="w-5 h-5 text-white group-hover/red:rotate-12 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Access Suspended Overlay (User Ban) */}
        {user && isCurrentlyBanned && (
          <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-4 z-[999] font-sans">
            <div className="bg-rose-950/20 border border-rose-500/20 p-8 sm:p-12 rounded-[40px] max-w-md w-full text-center space-y-6 shadow-2xl backdrop-blur-md">
              <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto border border-rose-500/30 animate-pulse">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-rose-400 uppercase font-bold">Identity Suspended</h1>
                <p className="text-[9px] font-mono tracking-widest text-rose-500 uppercase">Administrative Quarantine Protocol</p>
              </div>
              
              <p className="text-xs text-zinc-300 leading-relaxed">
                Your cryptographic identity node has been suspended by group administrators for violation of security policy, bad behavior, or name non-compliance.
              </p>
              
              <div className="bg-black/40 border border-white/5 py-4 px-6 rounded-2xl text-left space-y-1.5 font-mono text-xs">
                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Isolation details</p>
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Ban Status:</span>
                  <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/10 uppercase tracking-wider text-[10px]">
                    {user.bannedUntil === 'permanent' ? 'Permanent' : 'Temporary'}
                  </span>
                </div>
                {user.bannedUntil !== 'permanent' && (
                  <div className="flex justify-between items-center text-zinc-300 font-mono">
                    <span>Re-auth Expiry:</span>
                    <span className="text-white text-[10px]">
                      {new Date(user.bannedUntil!).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={logout}
                className="w-full py-3.5 px-6 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <LogOut className="w-4 h-4" />
                Disconnect Secure Node
              </button>
            </div>
          </div>
        )}

        {/* System Maintenance Overlay */}
        {user && isUnderMaintenance && (
          <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-4 z-[999] font-sans">
            <div className="bg-pink-950/20 border border-pink-500/20 p-8 sm:p-12 rounded-[40px] max-w-md w-full text-center space-y-6 shadow-2xl backdrop-blur-md">
              <div className="w-16 h-16 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto border border-pink-500/30 animate-pulse">
                <Wrench className="w-8 h-8 text-pink-400" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-pink-400 uppercase font-bold">System Maintenance</h1>
                <p className="text-[9px] font-mono tracking-widest text-pink-500 uppercase">Security Node Offline</p>
              </div>
              
              <p className="text-xs text-zinc-300 leading-relaxed">
                Memuer Cryptographic Network services are temporarily paused for scheduled infrastructure upgrades or key updates.
              </p>
              
              <div className="bg-black/40 border border-white/5 py-3.5 px-6 rounded-2xl text-left font-mono text-xs">
                <div className="flex justify-between items-center text-zinc-300">
                  <span>Completion Status:</span>
                  <span className="text-pink-400 font-bold bg-pink-500/10 px-2 py-0.5 rounded border border-pink-500/10 uppercase text-[9px] tracking-wider font-mono">
                    In Progress
                  </span>
                </div>
                {systemConfig?.maintenanceUntil && (
                  <div className="flex justify-between items-center text-zinc-300 mt-1.5 font-mono">
                    <span>Estimated Recovery:</span>
                    <span className="text-white text-[10px]">
                      {new Date(systemConfig.maintenanceUntil).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <button
                  onClick={logout}
                  className="w-full py-3.5 px-6 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Node
                </button>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-1">
                  Authorized administrators may authenticate to login and manage systems.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Global Broadcast Announcement Banner */}
        {systemConfig?.globalAnnouncement?.active && systemConfig.globalAnnouncement.message && dismissedAnnouncementId !== systemConfig.globalAnnouncement.createdAt && (
          <div className="fixed top-0 inset-x-0 z-[200] bg-gradient-to-r from-indigo-900 via-pink-900 to-rose-950 text-white py-2 px-4 shadow-xl border-b border-pink-500/30 font-sans flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="flex items-center gap-1.5 uppercase font-black text-[9px] tracking-widest bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/20">
                <Radio className="w-3 h-3 animate-pulse text-pink-400" />
                Broadcast
              </span>
              <p className="font-medium truncate font-mono text-[11px] sm:text-xs">
                {systemConfig.globalAnnouncement.message}
              </p>
            </div>
            <button 
              onClick={() => setDismissedAnnouncementId(systemConfig.globalAnnouncement!.createdAt)}
              className="ml-4 py-1 px-3 bg-white/10 hover:bg-white/20 text-zinc-200 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-widest font-sans transition-all"
            >
              Dismiss
            </button>
          </div>
        )}



        {/* Server Restart simulation Matrix Countdown */}
        {isRestartingSimulation && (
          <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-4 z-[10000] font-mono text-white">
            <div className="max-w-md w-full bg-zinc-950 border border-zinc-900 p-8 rounded-[36px] space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse"></div>
              
              <div className="flex items-center gap-3 border-b border-zinc-900 pb-4">
                <div className="w-3.5 h-3.5 rounded-full bg-cyan-500 animate-ping"></div>
                <h3 className="font-extrabold uppercase tracking-widest text-cyan-400 text-xs sm:text-xs">Central Terminal Reboot</h3>
              </div>

              <div className="space-y-2 text-[11px] text-zinc-400 leading-relaxed font-mono">
                <p className="text-zinc-500">{"[SYSTEM] Root administrator requested forced node restart..."}</p>
                <p className="text-cyan-400">{"[OK] Initializing cryptographic sync..."}</p>
                <p className="text-cyan-400">{"[OK] Purging insecure session links..."}</p>
                <p className="text-cyan-400">{"[SYNC] Synchronizing key exchange..."}</p>
                <p className="text-yellow-500/90">{"[WARN] Resetting active group media channels..."}</p>
                <p className="text-zinc-200">{"Re-attaching secure tunnel in: "}<span className="text-white font-bold">{restartCountdown}s</span></p>
              </div>

              <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                <div 
                  className="bg-cyan-500 h-full transition-all duration-1000"
                  style={{ width: `${((7 - restartCountdown) / 7) * 100}%` }}
                ></div>
              </div>

              <p className="text-[8px] text-zinc-650 uppercase tracking-widest text-center font-mono">Node Terminal Sync Engine v4.0.1</p>
            </div>
          </div>
        )}

        {/* Floating Call Center */}
        <AnimatePresence>
          {isCallCenterPanelOpen && isUserCallCenterMe && (
            <FloatingCallCenter
              currentUser={user!}
              isAr={isAr}
              onClose={() => setIsCallCenterPanelOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Secret Admin Panel */}
        <AnimatePresence>
          {isAdminPanelOpen && isUserAdminMe && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-zinc-950/95 backdrop-blur-xl flex justify-center items-center p-4 outline-none font-sans"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }} 
                animate={{ scale: 1, y: 0 }} 
                exit={{ scale: 0.95, y: 30 }}
                className={cn(
                  themeName === 'liquidglass' ? 'liquid-glass-panel' : themeName === 'luxury' ? 'luxury-panel' : 'bg-zinc-900 border border-white/10',
                  "rounded-2xl sm:rounded-[40px] w-full max-w-5xl h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative text-white"
                )}
              >
                {/* Header */}
                <div className="px-4 py-3 sm:px-8 sm:py-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-black/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-500/20 flex items-center justify-center text-red-400 border border-red-500/30 shrink-0">
                      <Sliders className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-md sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2 font-bold truncate">
                        Memuer Security Console
                        <span className="text-[8px] sm:text-[10px] uppercase tracking-widest font-mono bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full border border-red-500/20 shrink-0">
                          ROOTSEC
                        </span>
                      </h2>
                      <p className="text-[8px] sm:text-[10px] text-zinc-400 font-mono uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">Operational Command & Central Administration</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => setIsAdminPanelOpen(false)}
                    className="p-2 sm:p-3 bg-white/5 hover:bg-white/10 rounded-full text-zinc-300 hover:text-white transition-colors shrink-0"
                    title="Close Panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Main Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                  {/* Left Navigation Rails - now also horizontal on mobile select */}
                  <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-black/10 flex flex-row md:flex-col p-2.5 md:p-4 gap-2 shrink-0 overflow-x-auto whitespace-nowrap md:overflow-visible">
                    <button
                      onClick={() => setAdminActiveTab('users')}
                      className={cn(
                        "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                        adminActiveTab === 'users' 
                          ? "bg-white/10 text-white font-bold shadow-lg" 
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                      <div className="text-left">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Account Directory</p>
                        <p className="text-[8px] opacity-60 font-mono hidden md:block">Manage Active Users ({adminAllUsers.length})</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setAdminActiveTab('support')}
                      className={cn(
                        "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                        adminActiveTab === 'support' 
                          ? "bg-white/10 text-white font-bold shadow-lg" 
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Mail className="w-4 h-4 text-pink-400 shrink-0" />
                      <div className="text-left">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Support Directory</p>
                        <p className="text-[8px] opacity-60 font-mono hidden md:block">In-App Contact Tickets ({adminContactMessages.length})</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setAdminActiveTab('social')}
                      className={cn(
                        "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                        adminActiveTab === 'social' 
                          ? "bg-amber-500/10 text-white font-bold shadow-lg border border-amber-500/20" 
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                      <div className="text-left">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Social+ Moderation</p>
                        <p className="text-[8px] opacity-60 font-mono hidden md:block">Active Posts & m shorts</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setAdminActiveTab('audit')}
                      className={cn(
                        "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                        adminActiveTab === 'audit' 
                          ? "bg-emerald-500/10 text-white font-bold shadow-lg border border-emerald-500/20" 
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <History className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div className="text-left">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Moderation Log</p>
                        <p className="text-[8px] opacity-60 font-mono hidden md:block">Removed items history ({adminAuditLogs.length})</p>
                      </div>
                    </button>

                    <button
                      onClick={() => setAdminActiveTab('callcenter')}
                      className={cn(
                        "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                        adminActiveTab === 'callcenter' 
                          ? "bg-rose-500/20 text-white font-bold shadow-lg border border-rose-500/30" 
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Headphones className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                      <div className="text-left">
                        <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Call Center</p>
                        <p className="text-[8px] opacity-60 font-mono hidden md:block">memuer-call center Line</p>
                      </div>
                    </button>

                    {isUserOwnerMe && (
                      <button
                        onClick={() => setAdminActiveTab('maintenance')}
                        className={cn(
                          "flex items-center gap-3 transition-all rounded-xl py-2 px-3 sm:py-3.5 sm:px-4 text-left shrink-0",
                          adminActiveTab === 'maintenance' 
                            ? "bg-white/10 text-white font-bold shadow-lg" 
                            : "text-zinc-400 hover:text-white hover:bg-white/5"
                        )}
                      >
                        <Wrench className="w-4 h-4 text-pink-400 shrink-0" />
                        <div className="text-left">
                          <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider">Policy Engine</p>
                          <p className="text-[8px] opacity-60 font-mono hidden md:block">Maintenance & AI Controls</p>
                        </div>
                      </button>
                    )}

                    {/* Meta stats display */}
                    <div className="hidden md:block mt-auto bg-black/20 border border-white/5 p-4 rounded-2xl space-y-3 font-mono text-[9px] text-zinc-500">
                      <div>
                        <p className="font-extrabold uppercase text-zinc-400">Security State</p>
                        <p className="text-green-400">AES-256 E2EE Active</p>
                      </div>
                      <div>
                        <p className="font-extrabold uppercase text-zinc-400">Database Engine</p>
                        <p>Google Cloud Firestore</p>
                      </div>
                      <div>
                        <p className="font-extrabold uppercase text-zinc-400">Operator Identity</p>
                        <p className="text-zinc-300 truncate">{user?.displayName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Right Tab Content View */}
                  <div className="flex-1 flex flex-col p-3 sm:p-6 overflow-hidden">
                    {adminActiveTab === 'callcenter' ? (
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                        <CallCenterAdminPanel currentUser={user!} isAr={isAr} />
                      </div>
                    ) : adminActiveTab === 'users' ? (
                      <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        {/* Users Table Header Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 shrink-0 sm:justify-between sm:items-center bg-zinc-900 py-1">
                          <div className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-2 w-full sm:max-w-xs">
                            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
                            <input 
                              type="text"
                              value={adminSearchQuery}
                              onChange={(e) => setAdminSearchQuery(e.target.value)}
                              placeholder="Search administrative directory..."
                              className="bg-transparent border-none focus:ring-0 text-xs py-0.5 w-full text-white placeholder-zinc-500 outline-none"
                            />
                            {adminSearchQuery && (
                              <button onClick={() => setAdminSearchQuery('')} className="p-1 hover:bg-white/10 rounded-full shrink-0">
                                <X className="w-3 h-3 text-zinc-400" />
                              </button>
                            )}
                          </div>
                          <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono uppercase tracking-widest bg-zinc-950 px-3 py-1.5 rounded-xl border border-white/5 self-start sm:self-auto shrink-0">
                            Loaded: <span className="text-white font-bold">{adminAllUsers.length} Nodes</span>
                          </span>
                        </div>

                        {/* Accounts List Container */}
                        <div className="flex-1 overflow-auto border border-white/5 bg-black/10 rounded-2xl sm:rounded-3xl custom-scrollbar divide-y divide-white/5">
                          {adminAllUsers
                            .filter(u => {
                              if (!adminSearchQuery.trim()) return true;
                              const queryStr = adminSearchQuery.toLowerCase();
                              return (u.displayName || '').toLowerCase().includes(queryStr) || 
                                     (u.uid || '').toLowerCase().includes(queryStr) || 
                                     (u.status || '').toLowerCase().includes(queryStr);
                            })
                            .map((usr) => {
                              const isUserMe = usr.uid === user?.uid;
                              const isUserBanned = usr.bannedUntil && (usr.bannedUntil === 'permanent' || new Date(usr.bannedUntil) > new Date());
                              const isTargetHeadOwner = usr.email === 'koke.kozkoz@gmail.com' || usr.role === 'headowner';
                              
                              return (
                                <div key={usr.uid} className="p-4 flex items-center gap-6 hover:bg-white/5 transition-all text-white border-b border-white/5 min-w-[1240px]">
                                  {/* Column 1: Identity */}
                                  <div className="flex items-center gap-3 shrink-0 w-[240px] min-w-0">
                                    <img 
                                      src={usr.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${usr.uid}`}
                                      className={cn(
                                        "w-10 h-10 rounded-full object-cover border-2 shrink-0",
                                        usr.isOnline ? "border-emerald-500 animate-pulse" : "border-zinc-700"
                                      )}
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-1 font-sans truncate" title={usr.displayName || "Anonymous"}>
                                          {usr.displayName || "Anonymous"}
                                        </h4>
                                        {isUserMe && <span className="text-[8px] bg-white/20 text-white font-mono uppercase px-1 py-0.2 rounded shrink-0">Me</span>}
                                      </div>
                                      <p className="text-[9px] text-zinc-500 font-mono truncate select-all mt-0.5" title="Click to copy UID">UID: {usr.uid}</p>
                                    </div>
                                  </div>

                                  {/* Column 2: Credentials & Access level */}
                                  <div className="shrink-0 w-[140px] flex flex-col gap-1">
                                    <div className="flex items-center">
                                      <UserRoleBadge role={usr.role} email={usr.email} />
                                    </div>
                                    <div className="flex items-center gap-1 text-[9px] font-mono">
                                      {usr.isOnline ? (
                                        <span className="text-emerald-400 font-black tracking-wide uppercase">● Online</span>
                                      ) : (
                                        <span className="text-zinc-500 uppercase">Offline</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Column 3: Biographies / Custom Statuses */}
                                  <div className="shrink-0 w-[240px] min-w-0 text-zinc-400">
                                    {editingUserBioId === usr.uid ? (
                                      <div className="flex items-center gap-1">
                                        <input 
                                          type="text"
                                          value={editingUserBio}
                                          onChange={(e) => setEditingUserBio(e.target.value)}
                                          className="bg-zinc-950 border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500 w-full font-sans"
                                          placeholder="Enter bio..."
                                          autoFocus
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAdminUpdateUserBio(usr.uid, editingUserBio);
                                            if (e.key === 'Escape') { setEditingUserBioId(null); setEditingUserBio(''); }
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div 
                                        onClick={() => { setEditingUserBioId(usr.uid); setEditingUserBio(usr.status || ''); }}
                                        className="text-xs hover:text-zinc-350 transition-colors cursor-pointer group flex flex-col justify-start"
                                        title="Click to edit user status"
                                      >
                                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mb-0.5">Biography</p>
                                        <p className="truncate italic font-sans">{usr.status || "No bio set."}</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 4: Bans & State Restrictions */}
                                  <div className="shrink-0 w-[150px] min-w-0">
                                    {isUserBanned ? (
                                      <div className="space-y-0.5">
                                        <span className="inline-block text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-rose-600/20 border-rose-500/30 text-rose-300 font-bold">
                                          Banned Node
                                        </span>
                                        <p className="text-[8px] text-rose-400 font-mono uppercase tracking-wide truncate" title={usr.bannedUntil === 'permanent' ? 'Permanent lockout' : new Date(usr.bannedUntil!).toLocaleString()}>
                                          Expires: {usr.bannedUntil === 'permanent' ? 'PERMANENT' : new Date(usr.bannedUntil!).toLocaleDateString()}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        <span className="inline-block text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border border-emerald-500/10 bg-emerald-500/5 text-emerald-400">
                                          Operational
                                        </span>
                                        <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-wide">Clean Record</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 5: Central Action Commands */}
                                  <div className="flex items-center gap-2 shrink-0 ml-auto select-none">
                                    {/* Rename Action Button */}
                                    {editingUserId === usr.uid ? (
                                      <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 w-full sm:w-auto">
                                        <input 
                                          type="text"
                                          value={editingUserName}
                                          onChange={(e) => setEditingUserName(e.target.value)}
                                          className="bg-transparent border-none focus:ring-0 text-xs py-1 px-2 w-full sm:w-28 text-white outline-none"
                                          placeholder="Enter name"
                                        />
                                        <button 
                                          onClick={() => handleAdminRenameUser(usr.uid, editingUserName)}
                                          className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-lg text-zinc-400"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => { setEditingUserId(null); setEditingUserName(''); }}
                                          className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-zinc-400"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setEditingUserId(usr.uid); setEditingUserName(usr.displayName); }}
                                        className="py-1.5 px-3 bg-white/5 border border-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all font-sans shrink-0"
                                      >
                                        Rename
                                      </button>
                                    )}

                                    {/* Edit Bio Button */}
                                    {editingUserBioId === usr.uid ? (
                                      <div className="flex items-center gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10 w-full sm:w-auto">
                                        <input 
                                          type="text"
                                          value={editingUserBio}
                                          onChange={(e) => setEditingUserBio(e.target.value)}
                                          className="bg-transparent border-none focus:ring-0 text-xs py-1 px-2 w-full sm:w-36 text-white outline-none font-sans"
                                          placeholder="Enter new bio..."
                                        />
                                        <button 
                                          onClick={() => handleAdminUpdateUserBio(usr.uid, editingUserBio)}
                                          className="p-1.5 hover:bg-emerald-500/20 hover:text-emerald-400 rounded-lg text-zinc-400"
                                          title="Save Biography"
                                        >
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => { setEditingUserBioId(null); setEditingUserBio(''); }}
                                          className="p-1.5 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg text-zinc-400"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setEditingUserBioId(usr.uid); setEditingUserBio(usr.status || ''); }}
                                        className="py-1.5 px-3 bg-white/5 border border-white/5 hover:bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all font-sans shrink-0"
                                      >
                                        Edit Bio
                                      </button>
                                    )}

                                    {/* Role Selection Toggle */}
                                    {!isUserMe && isUserOwnerMe && (
                                      isTargetHeadOwner && !isHeadOwnerMe ? (
                                        <span className="py-1.5 px-3 bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[9px] font-bold rounded-xl flex items-center gap-1 shrink-0">
                                          <Shield className="w-3.5 h-3.5 text-amber-400" />
                                          <span>Protected Head Owner</span>
                                        </span>
                                      ) : (
                                        <div className="relative shrink-0">
                                           <button
                                             onClick={() => setRoleMenuUserId(roleMenuUserId === usr.uid ? null : usr.uid)}
                                             className="py-1.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-indigo-500/20 font-sans shrink-0 cursor-pointer flex items-center gap-1"
                                           >
                                             <span>Role</span>
                                             <ChevronDown className="w-3 h-3 text-indigo-400" />
                                           </button>

                                           {/* Role Selection Dropdown */}
                                           {roleMenuUserId === usr.uid && (
                                             <div className="absolute right-0 top-full mt-2 z-50 w-44 bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl p-2 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-150">
                                               <div className="px-2 py-1 text-[9px] font-black uppercase text-zinc-400 tracking-wider border-b border-white/5 flex items-center justify-between">
                                                 <span>Select Role</span>
                                                 <button onClick={() => setRoleMenuUserId(null)} className="hover:text-white p-0.5">
                                                   <X className="w-3 h-3 text-zinc-400 hover:text-white" />
                                                 </button>
                                               </div>
                                               {[
                                                 { id: 'user', label: 'User', bg: 'hover:bg-zinc-800 text-zinc-300' },
                                                 { id: 'tester', label: 'Tester', bg: 'hover:bg-cyan-950/60 text-cyan-300' },
                                                 { id: 'callcenter', label: 'Call Center', bg: 'hover:bg-pink-950/60 text-pink-300' },
                                                 { id: 'admin', label: 'Admin', bg: 'hover:bg-indigo-950/60 text-indigo-300' },
                                                 { id: 'owner', label: 'Owner', bg: 'hover:bg-amber-950/60 text-amber-300' },
                                                 ...(isHeadOwnerMe ? [{ id: 'headowner', label: 'Head Owner', bg: 'hover:bg-purple-950/60 text-purple-300' }] : [])
                                               ].map((r) => {
                                                 const isCurrent = (usr.role || 'user').toLowerCase() === r.id;
                                                 return (
                                                   <button
                                                     key={r.id}
                                                     onClick={() => handleAdminSetRole(usr.uid, r.id, usr.email, usr.role)}
                                                     className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-between font-sans ${r.bg} ${
                                                       isCurrent ? 'bg-white/10 ring-1 ring-white/20' : ''
                                                     }`}
                                                   >
                                                     <span>{r.label}</span>
                                                     {isCurrent && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                                                   </button>
                                                 );
                                               })}
                                             </div>
                                           )}
                                         </div>
                                      )
                                    )}

                                    {/* Purge / Delete User completely */}
                                    {!isUserMe && isUserOwnerMe && (!isTargetHeadOwner || isHeadOwnerMe) && (
                                      deletingUserId === usr.uid ? (
                                        <div className="flex items-center gap-1.5 bg-rose-950/45 border border-rose-500/35 px-2.5 py-1 rounded-xl shrink-0">
                                          <span className="text-[9px] text-rose-300 font-bold uppercase font-sans animate-pulse">Delete profile permanently?</span>
                                          <button
                                            onClick={() => handleAdminDeleteUser(usr.uid, usr.role, usr.email)}
                                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase rounded-lg transition-colors font-sans cursor-pointer"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            onClick={() => setDeletingUserId(null)}
                                            className="px-2 py-1 bg-zinc-850 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold uppercase rounded-lg transition-colors border border-white/5 font-sans cursor-pointer"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setDeletingUserId(usr.uid)}
                                          className="py-1.5 px-3 bg-red-600/20 hover:bg-red-600/35 text-red-200 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-red-500/20 font-sans shrink-0 hover:border-red-500/45 cursor-pointer"
                                          title="Permanently remove user from DB directory"
                                        >
                                          Delete User
                                        </button>
                                      )
                                    )}

                                    {/* Directory visibility toggle */}
                                    <button
                                      onClick={() => handleAdminToggleHideFromDirectory(usr.uid, usr.isHiddenFromDirectory)}
                                      className={cn(
                                        "py-1.5 px-3 border text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all font-sans shrink-0 flex items-center gap-1.5",
                                        usr.isHiddenFromDirectory
                                          ? "bg-purple-500/10 border-purple-500/35 text-purple-300 hover:bg-purple-500/20"
                                          : "bg-white/5 border-white/5 text-zinc-350 hover:bg-white/10"
                                      )}
                                      title={usr.isHiddenFromDirectory ? "Hidden except for mutual contacts. Click to make Public." : "Visible to everyone. Click to Hide."}
                                    >
                                      {usr.isHiddenFromDirectory ? <EyeOff className="w-3.5 h-3.5 text-purple-400 shrink-0" /> : <Eye className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                                      <span>{usr.isHiddenFromDirectory ? 'Hidden' : 'Public'}</span>
                                    </button>

                                    {/* Messaging Scope/Permission toggle */}
                                    <button
                                      onClick={() => handleAdminToggleCanMessageAnyone(usr.uid, usr.canMessageAnyone)}
                                      className={cn(
                                        "py-1.5 px-3 border text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all font-sans shrink-0 flex items-center gap-1.5",
                                        usr.canMessageAnyone
                                          ? "bg-cyan-500/10 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/20"
                                          : "bg-white/5 border-white/5 text-zinc-350 hover:bg-white/10"
                                      )}
                                      title={usr.canMessageAnyone ? "Can direct-message anyone without request. Click to restrict." : "Required friend/request to message. Click to grant privileges."}
                                    >
                                      <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", usr.canMessageAnyone ? "text-cyan-400" : "text-zinc-500")} />
                                      <span>{usr.canMessageAnyone ? 'Msg Anyone' : 'Standard'}</span>
                                    </button>

                                    {/* Ban Option Trigger list */}
                                    {!isUserMe && (!isTargetHeadOwner || isHeadOwnerMe) && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isUserBanned ? (
                                          <button
                                            onClick={() => handleAdminUnbanUser(usr.uid, usr.role, usr.email)}
                                            className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-emerald-500/10 font-sans cursor-pointer"
                                          >
                                            Lift Ban
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest px-1 font-sans hidden sm:inline">Ban:</span>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 30, usr.role, usr.email)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-300 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                                              title="Suspend user for 30 minutes"
                                            >
                                              30m
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 120, usr.role, usr.email)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-300 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                                              title="Suspend user for 2 hours"
                                            >
                                              2h
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 1440, usr.role, usr.email)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-350 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10 cursor-pointer"
                                              title="Suspend user for 24 hours"
                                            >
                                              24h
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 'perm', usr.role, usr.email)}
                                              className="py-1 px-2.5 bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 hover:text-white text-[9px] font-mono rounded-lg transition-colors border border-rose-500/20 font-bold cursor-pointer"
                                              title="Suspend user permanently"
                                            >
                                              Perm
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ) : adminActiveTab === 'support' ? (
                      <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center bg-zinc-900 py-1 shrink-0">
                          <h3 className="text-sm font-bold uppercase tracking-wider text-pink-400 font-sans flex items-center gap-2">
                            <Mail className="w-4 h-4" />
                            Secure In-App Support Tickets ({adminContactMessages.length})
                          </h3>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase">
                            Direct Support Node
                          </span>
                        </div>

                        {/* Support Tickets List */}
                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                          {adminContactMessages.length === 0 ? (
                            <div className="h-48 border border-white/5 bg-black/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                              <Mail className="w-8 h-8 text-zinc-650 animate-pulse" />
                              <h4 className="text-sm font-bold text-zinc-400">No active support tickets</h4>
                              <p className="text-xs text-zinc-500 max-w-sm">All user contact messages have been answered or cleared securely from the persistent datastores.</p>
                            </div>
                          ) : (
                            adminContactMessages.map((msg) => {
                              const msgDate = msg.createdAt ? (msg.createdAt instanceof Timestamp ? msg.createdAt.toDate() : new Date(msg.createdAt.seconds * 1000 || msg.createdAt)) : new Date();
                              return (
                                <div key={msg.id} className="border border-white/5 bg-black/20 hover:bg-neutral-900/40 transition-all rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                                  {/* Ticket Head */}
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 border-b border-white/5 pb-3">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black uppercase text-pink-400 tracking-wide font-sans">{msg.senderName || "Unknown User"}</span>
                                        <span className="text-[10px] text-zinc-500 font-mono">({msg.senderEmail})</span>
                                      </div>
                                      <h4 className="text-sm font-bold text-white font-sans">{msg.subject || "(No Subject)"}</h4>
                                    </div>
                                    <div className="flex items-center gap-2 text-zinc-500 font-mono text-[10px] self-start sm:self-auto">
                                      <span>{msgDate.toLocaleString()}</span>
                                      {msg.replied && (
                                        <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded-full">Replied</span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Message Body */}
                                  <div className="text-xs text-zinc-300 leading-relaxed font-sans whitespace-pre-wrap bg-black/30 p-3 sm:p-4 rounded-xl border border-white/5">
                                    {msg.message}
                                  </div>

                                  {/* Actions section */}
                                  <div className="flex flex-col gap-3 border-t border-white/5 pt-3">
                                    {/* Sub-reply UI */}
                                    {replyingToMessageId === msg.id ? (
                                      <div className="w-full space-y-2 mt-1">
                                        <textarea
                                          value={adminSupportReplyText}
                                          onChange={(e) => setAdminSupportReplyText(e.target.value)}
                                          placeholder="Type secure reply to client... (saves and syncs in-app ticket)"
                                          className="w-full h-20 bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500 font-sans resize-none"
                                        />
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => handleAdminReplySupport(msg.id, adminSupportReplyText)}
                                            className="py-1.5 px-3 bg-pink-600 hover:bg-pink-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all"
                                          >
                                            Submit Reply
                                          </button>
                                          <button
                                            onClick={() => { setReplyingToMessageId(null); setAdminSupportReplyText(''); }}
                                            className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] uppercase rounded-xl transition-all"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 w-full justify-between flex-wrap">
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => { setReplyingToMessageId(msg.id); setAdminSupportReplyText(''); }}
                                            className="py-1.5 px-3 bg-pink-500/10 border border-pink-500/10 hover:bg-pink-500/20 text-pink-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
                                          >
                                            Reply In-App
                                          </button>
                                          <a
                                            href={`mailto:${msg.senderEmail}?subject=Re: ${encodeURIComponent(msg.subject || 'Support Ticket Reply')}`}
                                            className="py-1.5 px-3 bg-cyan-500/10 border border-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all"
                                          >
                                            Open Mail App
                                          </a>
                                        </div>

                                        <button
                                          onClick={() => handleAdminDeleteContactMessage(msg.id)}
                                          className="py-1.5 px-3 bg-rose-600/10 hover:bg-rose-600/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all font-sans"
                                        >
                                          Delete Ticket
                                        </button>
                                      </div>
                                    )}

                                    {/* Display existing reply history inside document */}
                                    {msg.replied && msg.replyMessage && (
                                      <div className="w-full bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 sm:p-4 mt-2 space-y-1 text-left">
                                        <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400">
                                          <span>ADMIN REPLY:</span>
                                          <span>SENDER: {msg.repliedBy || 'Administrator'}</span>
                                        </div>
                                        <p className="text-xs text-zinc-300 leading-relaxed font-sans">{msg.replyMessage}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ) : adminActiveTab === 'social' ? (
                      <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        {/* Section Header */}
                        <div className="flex justify-between items-center bg-zinc-900 py-1 shrink-0">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-500" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 font-sans">
                              Social+ Central Moderation Control
                            </h3>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase">
                            Operational Integrity
                          </span>
                        </div>

                        {/* Switch Subtabs */}
                        <div className="flex gap-2 shrink-0 border-b border-white/5 pb-2">
                          <button
                            onClick={() => { setAdminSocialSubTab('posts'); setAdminSelectedContent(null); }}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer",
                              adminSocialSubTab === 'posts'
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                          >
                            Posts ({adminPosts.length})
                          </button>
                          <button
                            onClick={() => { setAdminSocialSubTab('shorts'); setAdminSelectedContent(null); }}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer",
                              adminSocialSubTab === 'shorts'
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                          >
                            m shorts ({adminShorts.length})
                          </button>
                          <button
                            onClick={() => { setAdminSocialSubTab('reports'); setAdminSelectedContent(null); }}
                            className={cn(
                              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer flex items-center gap-1.5",
                              adminSocialSubTab === 'reports'
                                ? "bg-red-500/10 text-red-400 border border-red-500/30"
                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                            )}
                          >
                            User Reports ({adminReports.length})
                            {adminReports.filter(r => r.status === 'pending').length > 0 && (
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />
                            )}
                          </button>
                        </div>

                        {/* Top 5 Most Engaged Content Visualization */}
                        {adminSocialSubTab !== 'reports' && (() => {
                          const combinedContent = [
                            ...adminPosts.map(p => ({ ...p, type: 'post', engagement: (p.likes || 0) + ((p.comments || []).length * 2) })),
                            ...adminShorts.map(s => ({ ...s, type: 'short', engagement: (s.likes || 0) * 1.5 + (s.commentsCount || 0) * 2 }))
                          ];
                          const topEngaged = [...combinedContent].sort((a, b) => b.engagement - a.engagement).slice(0, 5);
                          const maxEngagement = topEngaged.length > 0 ? topEngaged[0].engagement : 1;
                          if (topEngaged.length === 0) return null;
                          return (
                            <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-4 space-y-3 shrink-0">
                              <div className="flex justify-between items-center">
                                <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-pink-500 flex items-center gap-1.5">
                                  <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                                  Viral Activity Tracker (Top 5 Most Engaged)
                                </h4>
                                <span className="text-[8px] text-zinc-500 font-mono">Formula: (Likes + Comments/Views weight)</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                                {topEngaged.map((item, idx) => {
                                  const percentage = Math.max(5, Math.min(100, (item.engagement / maxEngagement) * 100));
                                  return (
                                    <div key={item.id} className="bg-black/30 border border-white/5 rounded-xl p-2.5 space-y-2 flex flex-col justify-between hover:border-white/10 transition-all relative group overflow-hidden text-left">
                                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 text-[10px] font-black border border-pink-500/30">
                                        #{idx + 1}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black">
                                          {item.type === 'short' ? (
                                            <video src={item.videoUrl} className="w-full h-full object-cover" muted />
                                          ) : (
                                            <img src={item.image} className="w-full h-full object-cover" />
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-[10px] font-bold text-white truncate">@{item.username}</p>
                                          <p className="text-[8px] uppercase tracking-wide text-zinc-400 font-mono">{item.type}</p>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-zinc-400 line-clamp-1 italic">"{item.caption || 'No caption'}"</p>
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-[8px] font-mono text-zinc-500">
                                          <span>Engagement score</span>
                                          <span className="text-pink-400 font-bold">{Math.round(item.engagement)}</span>
                                        </div>
                                        <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                                          <div className="bg-gradient-to-r from-pink-500 to-amber-500 h-full" style={{ width: `${percentage}%` }} />
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          setAdminSelectedContent({ type: item.type, id: item.id, username: item.username, userId: item.ownerId });
                                          setAdminRemovalReason('');
                                        }}
                                        className="w-full py-1 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider rounded-lg border border-rose-500/20 cursor-pointer"
                                      >
                                        Moderate
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Reason / Confirmation Drawer */}
                        {adminSelectedContent && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 space-y-3 shrink-0"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-black uppercase text-amber-400 tracking-wide flex items-center gap-1.5 font-bold">
                                <AlertTriangle className="w-4 h-4 text-amber-500 animate-bounce" />
                                Initiate Content Moderation Purge
                              </span>
                              <span className="text-[10px] font-mono text-zinc-400">
                                Content ID: {adminSelectedContent.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans">
                              You are about to remove a {adminSelectedContent.type === 'post' ? 'post' : 'm short'} published by <span className="text-white font-bold font-sans">@{adminSelectedContent.username}</span>. A secure notification will be transmitted to their DM.
                            </p>
                            
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input 
                                type="text" 
                                value={adminRemovalReason} 
                                onChange={(e) => setAdminRemovalReason(e.target.value)} 
                                placeholder="State reason for removal (e.g. Terms violation, inappropriate imagery)..." 
                                className="flex-1 bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500 font-sans"
                              />
                              <div className="flex gap-2 justify-end sm:justify-start">
                                <button 
                                  onClick={() => handleAdminRemoveSocialContent(adminSelectedContent.type, adminSelectedContent.id, adminSelectedContent.username, adminSelectedContent.userId)} 
                                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white text-[10px] uppercase font-black tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all font-bold"
                                >
                                  Execute Purge
                                </button>
                                <button 
                                  onClick={() => { setAdminSelectedContent(null); setAdminRemovalReason(''); }} 
                                  className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-[10px] uppercase font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Moderation Feed */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-6">
                          {adminSocialSubTab === 'posts' ? (
                            adminPosts.length === 0 ? (
                              <div className="h-48 border border-white/5 bg-black/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                                <ShieldAlert className="w-8 h-8 text-zinc-600 animate-pulse" />
                                <h4 className="text-sm font-bold text-zinc-400">No Social+ Posts Active</h4>
                                <p className="text-xs text-zinc-500 max-w-sm">No posts are currently loaded in the directory databases.</p>
                              </div>
                            ) : (
                              adminPosts.map((post) => (
                                <div key={post.id} className="border border-white/5 bg-black/20 hover:bg-neutral-900/40 transition-all rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {post.image && (
                                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-950">
                                        <img src={post.image} className="w-full h-full object-cover" />
                                      </div>
                                    )}
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-pink-400 tracking-wide font-bold">@{post.username}</span>
                                        {post.location && (
                                          <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                                            <MapPin className="w-2.5 h-2.5" />
                                            {post.location}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-zinc-300 font-sans line-clamp-2">{post.caption || "(No Caption)"}</p>
                                      <p className="text-[9px] text-zinc-500 font-mono">ID: {post.id} • Views: {post.views || 0} • Likes: {post.likes || 0}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setAdminSelectedContent({ type: 'post', id: post.id, username: post.username, userId: post.ownerId });
                                      setAdminRemovalReason('');
                                    }}
                                    className="py-1.5 px-3 bg-rose-500/10 border border-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all self-end sm:self-auto font-bold cursor-pointer"
                                  >
                                    Remove Post
                                  </button>
                                </div>
                              ))
                            )
                          ) : adminSocialSubTab === 'shorts' ? (
                            adminShorts.length === 0 ? (
                              <div className="h-48 border border-white/5 bg-black/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                                <Video className="w-8 h-8 text-zinc-600 animate-pulse" />
                                <h4 className="text-sm font-bold text-zinc-400">No m shorts Active</h4>
                                <p className="text-xs text-zinc-500 max-w-sm">No short-form video publications are currently loaded in the central directories.</p>
                              </div>
                            ) : (
                              adminShorts.map((short) => (
                                <div key={short.id} className="border border-white/5 bg-black/20 hover:bg-neutral-900/40 transition-all rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                  <div className="flex items-center gap-3">
                                    {short.videoUrl && (
                                      <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 border border-white/10 bg-zinc-950 flex items-center justify-center relative">
                                        <video src={short.videoUrl} className="w-full h-full object-cover" muted playsInline />
                                        <Play className="w-3 h-3 text-white absolute" />
                                      </div>
                                    )}
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-amber-400 tracking-wide font-bold">@{short.username}</span>
                                        <span className="text-[9px] text-zinc-500 font-mono">🎵 {short.musicTitle}</span>
                                      </div>
                                      <p className="text-xs text-zinc-300 font-sans line-clamp-2">{short.caption || "(No Caption)"}</p>
                                      <p className="text-[9px] text-zinc-500 font-mono">ID: {short.id} • Likes: {short.likes || 0}</p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                                      setAdminSelectedContent({ type: 'short', id: short.id, username: short.username, userId: short.ownerId });
                                      setAdminRemovalReason('');
                                    }}
                                    className="py-1.5 px-3 bg-rose-500/10 border border-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all self-end sm:self-auto font-bold cursor-pointer"
                                  >
                                    Remove Short
                                  </button>
                                </div>
                              ))
                            )
                          ) : (
                            adminReports.length === 0 ? (
                              <div className="h-48 border border-white/5 bg-black/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                                <ShieldCheck className="w-8 h-8 text-emerald-500 animate-pulse" />
                                <h4 className="text-sm font-bold text-zinc-400 font-sans">No Content Flags Pending</h4>
                                <p className="text-xs text-zinc-500 max-w-sm font-sans">No pending user report tickets are currently loaded in the database archives.</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {adminReports.map((report) => (
                                  <div key={report.id} className="border border-white/5 bg-black/20 hover:bg-neutral-900/40 transition-all rounded-2xl p-4 space-y-3 text-left">
                                    <div className="flex justify-between items-start flex-wrap gap-2 border-b border-white/5 pb-2">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-black text-white">Report #{report.id.slice(-6).toUpperCase()}</span>
                                          <span className={cn(
                                            "text-[8px] font-mono uppercase px-2 py-0.5 rounded-full border font-black tracking-widest",
                                            report.status === 'pending'
                                              ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse"
                                              : "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                                          )}>
                                            {report.status}
                                          </span>
                                        </div>
                                        <p className="text-[10px] text-zinc-400 font-sans">
                                          Reporter: <span className="text-zinc-250 font-bold">@{report.reporterUsername || 'anonymous'}</span> ({report.reporterId?.slice(-6)})
                                        </p>
                                      </div>
                                      <span className="text-[9px] text-zinc-500 font-mono">
                                        {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'Date unknown'}
                                      </span>
                                    </div>

                                    {/* Reported reason */}
                                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                                      <span className="text-[8px] font-mono text-red-400 uppercase font-black tracking-widest block mb-1">STATED VIOLATION REASON:</span>
                                      <p className="text-xs text-zinc-300 font-sans italic">"{report.reason}"</p>
                                    </div>

                                    {/* Target Content details */}
                                    <div className="flex items-center gap-3 bg-white/5 border border-white/5 rounded-xl p-3">
                                      <div className="w-12 h-16 rounded-lg overflow-hidden border border-white/10 shrink-0 bg-black flex items-center justify-center relative">
                                        {report.itemType === 'short' ? (
                                          <>
                                            <video src={report.itemImage} className="w-full h-full object-cover" muted playsInline />
                                            <Play className="w-3 h-3 text-white absolute" />
                                          </>
                                        ) : report.itemImage ? (
                                          <img src={report.itemImage} className="w-full h-full object-cover" />
                                        ) : (
                                          <ShieldAlert className="w-4 h-4 text-zinc-500" />
                                        )}
                                      </div>
                                      <div className="space-y-0.5 min-w-0 flex-1">
                                        <p className="text-xs font-black text-amber-400 truncate font-bold">@{report.itemUsername || 'unknown'}</p>
                                        <p className="text-xs text-zinc-350 font-sans truncate">{report.itemCaption || '(No Caption)'}</p>
                                        <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider">{report.itemType} • ID: {report.itemId}</p>
                                      </div>
                                    </div>

                                    {/* Resolve / Moderation action buttons */}
                                    {report.status === 'pending' && (
                                      <div className="flex gap-2 justify-end pt-1">
                                        <button
                                          onClick={() => handleAdminResolveReport(report.id, 'dismissed')}
                                          className="py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all font-bold cursor-pointer"
                                        >
                                          Dismiss Report
                                        </button>
                                        <button
                                          onClick={() => {
                                            setAdminSelectedContent({ type: report.itemType, id: report.itemId, username: report.itemUsername, userId: report.itemOwnerId });
                                            setAdminRemovalReason(`User reported violation: ${report.reason}`);
                                          }}
                                          className="py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all font-bold cursor-pointer"
                                        >
                                          Execute Purge
                                        </button>
                                      </div>
                                    )}

                                    {report.status === 'resolved' && (
                                      <p className="text-[9px] text-zinc-500 font-mono italic text-right">
                                        ✓ Purged by {report.resolvedBy || 'System'} on {report.resolvedAt ? new Date(report.resolvedAt).toLocaleString() : ''}
                                      </p>
                                    )}
                                    {report.status === 'dismissed' && (
                                      <p className="text-[9px] text-zinc-500 font-mono italic text-right">
                                        ✗ Dismissed by {report.resolvedBy || 'System'} on {report.resolvedAt ? new Date(report.resolvedAt).toLocaleString() : ''}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : adminActiveTab === 'audit' ? (
                      <div className="space-y-4 flex-1 flex flex-col overflow-hidden">
                        {/* Section Header */}
                        <div className="flex justify-between items-center bg-zinc-900 py-1 shrink-0">
                          <div className="flex items-center gap-2">
                            <History className="w-5 h-5 text-emerald-500" />
                            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 font-sans">
                              Social+ Moderation Audit Archive
                            </h3>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono uppercase">
                            Permanent Registry
                          </span>
                        </div>

                        {/* Audit Feed */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar pb-6">
                          {adminAuditLogs.length === 0 ? (
                            <div className="h-48 border border-white/5 bg-black/10 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
                              <History className="w-8 h-8 text-zinc-600 animate-pulse" />
                              <h4 className="text-sm font-bold text-zinc-400">Moderation Audit Log is Empty</h4>
                              <p className="text-xs text-zinc-500 max-w-sm">No purge operations or social content moderation actions have been recorded yet.</p>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {adminAuditLogs.map((log) => (
                                <div key={log.id} className="border border-white/5 bg-zinc-950/40 rounded-2xl p-4 space-y-3 text-left font-sans">
                                  <div className="flex justify-between items-start flex-wrap gap-2 border-b border-white/5 pb-2">
                                    <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono font-black text-emerald-400">PURGE_EVENT #{log.id.slice(-6).toUpperCase()}</span>
                                        <span className="text-[8px] font-mono bg-rose-950/35 text-rose-300 px-1.5 py-0.5 rounded border border-rose-500/20 uppercase font-black">
                                          {log.itemType} deleted
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-zinc-450">
                                        Moderator: <span className="text-white font-bold">@{log.moderatorUsername}</span> ({log.moderatorId?.slice(-6) || 'system'})
                                      </p>
                                    </div>
                                    <span className="text-[9px] text-zinc-500 font-mono">
                                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Date unknown'}
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-1">
                                      <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">TARGET ITEM INFO:</span>
                                      <p className="text-xs text-zinc-350">
                                        Author: <span className="text-amber-400 font-bold">@{log.creatorUsername}</span>
                                      </p>
                                      <p className="text-[9px] text-zinc-500 font-mono">
                                        Item ID: {log.itemId}
                                      </p>
                                    </div>

                                    <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 space-y-1">
                                      <span className="text-[8px] font-mono text-rose-400 uppercase tracking-wider block">STATED AUDIT REASON:</span>
                                      <p className="text-xs text-zinc-300 font-sans italic">
                                        "{log.reason}"
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="text-sm sm:text-md font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                                <Wrench className="w-4 h-4 text-pink-400" />
                                Infrastructure Emergency Mode
                              </h3>
                              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                Forces the entire application into a generic system maintenance container. Regular users will get locked out of the workspace with a standard cryptographic alert.
                              </p>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border font-black tracking-widest shrink-0 self-start sm:self-auto",
                              systemConfig?.maintenanceMode 
                                ? "bg-pink-500/20 border-pink-500/30 text-pink-400 animate-pulse" 
                                : "bg-zinc-800 border-white/5 text-zinc-500"
                            )}>
                              {systemConfig?.maintenanceMode ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </div>

                          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/5">
                            {systemConfig?.maintenanceMode ? (
                              <button
                                onClick={() => handleAdminToggleMaintenance(false)}
                                className="py-2.5 px-5 bg-white text-zinc-950 font-semibold uppercase tracking-wider text-xs rounded-xl hover:bg-neutral-200 transition-all shadow-md font-sans w-full sm:w-auto"
                              >
                                Stop Maintenance Mode
                              </button>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 w-full">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mr-2 font-sans w-full block">Toggle Maintenance with timer:</span>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full">
                                  <button 
                                    onClick={() => handleAdminToggleMaintenance(true, 15)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    15 Min
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleMaintenance(true, 60)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    1 Hour
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleMaintenance(true, 240)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    4 Hours
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleMaintenance(true, 1440)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    24 Hours
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleMaintenance(true, 0)}
                                    className="py-2.5 px-4 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-300 font-mono text-xs rounded-xl transition-all col-span-2 sm:col-span-1"
                                  >
                                    Indefinite
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="text-sm sm:text-md font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                                <Clock className="w-4 h-4 text-cyan-400" />
                                Neural Subsystem Access Controls
                              </h3>
                              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                Temporarily disables Gemini private AI access across the entire app. Any user attempts to prompt the AI agent globally will instead safely receive a system optimization warning message.
                              </p>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border font-black tracking-widest shrink-0 self-start sm:self-auto",
                              systemConfig?.disableAI 
                                ? "bg-red-500/20 border-red-500/30 text-red-500 animate-pulse" 
                                : "bg-zinc-800 border-white/5 text-zinc-500"
                            )}>
                              {systemConfig?.disableAI ? 'OFFLINE' : 'ONLINE'}
                            </span>
                          </div>

                          <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-white/5">
                            {systemConfig?.disableAI ? (
                              <button
                                onClick={() => handleAdminToggleAIDisable(false)}
                                className="py-2.5 px-5 bg-white text-zinc-950 font-semibold uppercase tracking-wider text-xs rounded-xl hover:bg-neutral-200 transition-all shadow-md font-sans w-full sm:w-auto"
                              >
                                Activate Neural Services
                              </button>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2 w-full">
                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mr-2 font-sans w-full block">Disable AI Service with timer:</span>
                                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full">
                                  <button 
                                    onClick={() => handleAdminToggleAIDisable(true, 15)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    15 Min
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleAIDisable(true, 60)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    1 Hour
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleAIDisable(true, 240)}
                                    className="py-2.5 px-4 bg-zinc-950 border border-white/5 hover:bg-white/5 text-zinc-300 font-mono text-xs rounded-xl transition-all"
                                  >
                                    4 Hours
                                  </button>
                                  <button 
                                    onClick={() => handleAdminToggleAIDisable(true, 0)}
                                    className="py-2.5 px-4 bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500/30 text-rose-300 font-mono text-xs rounded-xl transition-all col-span-2 sm:col-span-1"
                                  >
                                    Indefinite
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Operational System Actions Section */}
                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                            <Radio className="w-4 h-4 text-cyan-400" />
                            Global Broadcast Beacon
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                            Transmits an urgent administrative alert banner directly across the top feed of all connected terminal sessions.
                          </p>
                          <div className="space-y-3 pt-2">
                            <textarea
                              value={globalMsgInput}
                              onChange={(e) => setGlobalMsgInput(e.target.value)}
                              placeholder="Enter broadcast signal content..."
                              className="w-full h-16 bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 font-mono custom-scrollbar resize-none"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAdminSendGlobalMessage(globalMsgInput)}
                                className="py-2 px-4 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-md font-sans"
                              >
                                Transmit Broadcast
                              </button>
                              {systemConfig?.globalAnnouncement?.active && (
                                <button
                                  onClick={() => {
                                    setGlobalMsgInput('');
                                    handleAdminSendGlobalMessage('');
                                  }}
                                  className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all border border-white/5"
                                >
                                  Clear Broadcast
                                </button>
                              )}
                            </div>
                            {systemConfig?.globalAnnouncement?.active && (
                              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-3 text-[10px] font-mono text-cyan-300">
                                <span className="font-bold">CURRENT LIVE BROADCAST:</span> "{systemConfig.globalAnnouncement.message}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Dynamic System Announcement Card */}
                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                            <div className="space-y-1">
                              <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                                <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
                                System Announcement Banner
                              </h3>
                              <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                                Configure, modify, or completely remove a global high-priority announcement banner displayed across the chat feed for all users.
                              </p>
                            </div>
                            <span className={cn(
                              "text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border font-black tracking-widest shrink-0 self-start sm:self-auto",
                              (systemConfig?.systemAnnouncement === undefined ? true : systemConfig?.systemAnnouncement?.active)
                                ? "bg-red-500/20 border-red-500/30 text-red-400 animate-pulse" 
                                : "bg-zinc-800 border-white/5 text-zinc-500"
                            )}>
                              {(systemConfig?.systemAnnouncement === undefined ? true : systemConfig?.systemAnnouncement?.active) ? 'ACTIVE' : 'REMOVED'}
                            </span>
                          </div>

                          <div className="space-y-3 pt-2 border-t border-white/5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Emoji/Icon Accent:</label>
                                <input
                                  type="text"
                                  value={announcementEmojiInput}
                                  onChange={(e) => setAnnouncementEmojiInput(e.target.value)}
                                  placeholder="e.g., 🇪🇬"
                                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-sans"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Badge Text:</label>
                                <input
                                  type="text"
                                  value={announcementBadgeInput}
                                  onChange={(e) => setAnnouncementBadgeInput(e.target.value)}
                                  placeholder="e.g., Solidarity Active"
                                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-sans"
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Announcement Title:</label>
                              <input
                                  type="text"
                                  value={announcementTitleInput}
                                  onChange={(e) => setAnnouncementTitleInput(e.target.value)}
                                  placeholder="e.g., Official System Announcement: World Cup Removal"
                                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-sans"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Detailed Message Body:</label>
                              <textarea
                                value={announcementMessageInput}
                                onChange={(e) => setAnnouncementMessageInput(e.target.value)}
                                placeholder="Enter system announcement text..."
                                className="w-full h-20 bg-zinc-950 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-sans custom-scrollbar resize-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Visual Theme Palette:</label>
                              <select
                                value={announcementThemeInput}
                                onChange={(e) => setAnnouncementThemeInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-400 font-sans animate-none"
                              >
                                <option value="egypt-solidarity">Egypt Solidarity (Red/Black/Gold Gradient)</option>
                                <option value="critical-red">Critical Alert (Crimson Deep Dark Gradient)</option>
                                <option value="indigo-cyberpunk">Cyberpunk Indigo (Indigo/Teal/Cyan Gradient)</option>
                                <option value="gold-alert">Special Advisory (Gold Amber/Zinc Gradient)</option>
                              </select>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                onClick={() => handleAdminUpdateSystemAnnouncement(
                                  true,
                                  announcementEmojiInput,
                                  announcementTitleInput,
                                  announcementMessageInput,
                                  announcementBadgeInput,
                                  announcementThemeInput
                                )}
                                className="py-2 px-4 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-md font-sans flex items-center gap-1"
                              >
                                Publish / Update Announcement
                              </button>
                              
                              {(systemConfig?.systemAnnouncement === undefined ? true : systemConfig?.systemAnnouncement?.active) && (
                                <button
                                  onClick={() => handleAdminUpdateSystemAnnouncement(
                                    false,
                                    announcementEmojiInput,
                                    announcementTitleInput,
                                    announcementMessageInput,
                                    announcementBadgeInput,
                                    announcementThemeInput
                                  )}
                                  className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-red-400 font-black uppercase text-[10px] tracking-wider rounded-xl transition-all border border-white/5"
                                >
                                  Remove / Deactivate Banner
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                            <Lock className="w-4 h-4 text-pink-400" />
                            Vault Lockout (Coming Soon)
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                            Locks the application behind a "Coming Soon" lockout screen for all regular users. Note: The owner <code className="text-pink-300 font-bold bg-pink-500/10 px-1 py-0.5 rounded font-mono">koke.kozkoz@gmail.com</code> bypasses this lockout automatically.
                          </p>
                          <div className="space-y-3 pt-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Lockout Message:</label>
                              <input
                                type="text"
                                value={lockoutReasonInput}
                                onChange={(e) => setLockoutReasonInput(e.target.value)}
                                placeholder="Lockout message (e.g., Launching in June! Stay tuned.)"
                                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-400 font-sans"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Target Countdown Launch Date (Optional):</label>
                              <input
                                type="datetime-local"
                                value={lockoutDateInput}
                                onChange={(e) => setLockoutDateInput(e.target.value)}
                                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-400 font-sans"
                              />
                            </div>
                            <div className="flex gap-2 items-center pt-1">
                              {systemConfig?.appLocked ? (
                                <button
                                  onClick={() => handleAdminLockApp(false)}
                                  className="py-2.5 px-5 bg-white text-zinc-950 font-bold uppercase text-xs rounded-xl hover:bg-neutral-200 transition-all shadow-md font-sans"
                                >
                                  Deactivate App Lock
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAdminLockApp(true, lockoutReasonInput, lockoutDateInput)}
                                  className="py-2.5 px-5 bg-pink-600 hover:bg-pink-500 text-white font-bold uppercase text-xs rounded-xl transition-all shadow-lg"
                                >
                                  Activate App Lock (Coming Soon)
                                </button>
                              )}
                              <span className={cn(
                                "text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border font-black tracking-widest shrink-0 ml-auto",
                                systemConfig?.appLocked 
                                  ? "bg-pink-500/20 border-pink-500/30 text-pink-400 animate-pulse" 
                                  : "bg-zinc-800 border-white/5 text-zinc-500"
                              )}>
                                {systemConfig?.appLocked ? 'LOCKED' : 'UNLOCKED'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                            <Mail className="w-4 h-4 text-pink-400" />
                            Support Contact Address Config
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                            Configure the support and general inquiry email destination for all "Contact Us" actions executed by app users globally.
                          </p>
                          <div className="space-y-3 pt-2">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input
                                type="email"
                                value={adminContactEmailInput}
                                onChange={(e) => setAdminContactEmailInput(e.target.value)}
                                placeholder="Support email (e.g. support@memuer.app)"
                                className="flex-1 bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-400 font-mono"
                              />
                              <button
                                onClick={() => handleAdminUpdateContactEmail(adminContactEmailInput)}
                                className="py-2 px-4 bg-pink-600 hover:bg-pink-500 text-white font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-md font-sans h-9 sm:h-auto whitespace-nowrap"
                              >
                                Update Address
                              </button>
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5">
                              <span>Currently configured target:</span>
                              <span className="text-pink-405 hover:underline cursor-pointer">{systemConfig?.contactSupportEmail || 'contactus@memuer.app (default)'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                            <RefreshCw className="w-4 h-4 text-emerald-400" />
                            Restart App Servers & Clear Clients
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                            Broadcasting this server reboot command instructs all connected system clients to flush memory registers, tear down active webRTC peer circuits, and execute a fresh security shell reload.
                          </p>
                          <div className="pt-2">
                            <button
                              onClick={handleAdminRestartServers}
                              className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 font-sans w-full sm:w-auto"
                            >
                              Restart All App Servers & Re-Sync Clients
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Call Center Interactive Screen */}
        <AnimatePresence>
          {isCallCenterCallActive && user && (
            <CallCenterCallScreen
              currentUser={user}
              isAr={isAr}
              onClose={() => setIsCallCenterCallActive(false)}
            />
          )}
        </AnimatePresence>


      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
