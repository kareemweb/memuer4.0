import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare, Users, Settings, Plus, Search, Phone, Video, Shield, Info, Paperclip, Smile, Send, MoveVertical as MoreVertical, LogOut, User, Camera, Image as ImageIcon, Check, X, Menu, PhoneOff, Mic, MicOff, VideoOff, Volume2, Lock, ArrowLeft, ArrowRight, MonitorUp, TriangleAlert as AlertTriangle, FileSliders as Sliders, Wrench, Clock, Archive, Radio, RefreshCw, Mail, ShieldAlert, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EmojiPicker, { Theme as EmojiTheme } from 'emoji-picker-react';
import { useAuth } from './hooks/useAuth';
import { usePeer } from './hooks/usePeer';
import { db, auth, storage, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, 
  serverTimestamp, doc, setDoc, orderBy, limit, 
  getDocs, getDoc, updateDoc, deleteDoc,
  Timestamp,
  getDocFromServer
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
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
import { FloatingWorldCupButton } from './components/FloatingWorldCupButton';
import { Header } from './components/Header';
import { useWorldCup } from './context/WorldCupContext';
import { useLanguage } from './i18n/LanguageContext';

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

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

export default function App() {
  const { 
    user, loading, error: authError, setError: setAuthError, 
    login, loginWithEmail, registerWithEmail, logout,
    resetPassword, resetEmailSent 
  } = useAuth();
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

  // Initialize Sound and Permissions
  useEffect(() => {
    notificationSound.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    notificationSound.current.volume = 0.5;

    if ("Notification" in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  const [calling, setCalling] = useState<{ 
    type: 'voice' | 'video', 
    user: UserProfile, 
    isIncoming?: boolean, 
    isConnecting?: boolean,
    callObj?: any 
  } | null>(null);
  const [activeCallStream, setActiveCallStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isVaultWarningOpen, setIsVaultWarningOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [callUIStyle, setCallUIStyle] = useState({ width: 480, height: 360 });
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [adminAllUsers, setAdminAllUsers] = useState<UserProfile[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminActiveTab, setAdminActiveTab] = useState<'users' | 'support' | 'maintenance'>('users');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
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
    appLocked?: boolean;
    appLockedReason?: string;
    contactSupportEmail?: string;
  }
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  // New administrative operations and lockout states
  const [declinedGroupCalls, setDeclinedGroupCalls] = useState<string[]>([]);
  const [isRestartingSimulation, setIsRestartingSimulation] = useState(false);
  const [restartCountdown, setRestartCountdown] = useState(7);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<number | null>(null);
  const [globalMsgInput, setGlobalMsgInput] = useState('');
  const [lockoutReasonInput, setLockoutReasonInput] = useState('');
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

  // Automatically open mobile sidebar when no active chat is selected
  useEffect(() => {
    if (!activeChat && !isDesktop) {
      setIsMobileSidebarOpen(true);
    }
  }, [activeChat, isDesktop]);

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
        setSystemConfig(docSnap.data() as SystemConfig);
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
      console.error("Admin user sync error:", err);
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
      console.error("Admin support messages sync error:", err);
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
      console.error("User support messages sync error:", err);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const isUserExempt = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (
      user.role === 'headowner' ||
      user.role === 'owner' ||
      user.role === 'admin' ||
      user.role === 'tester'
    ))
  );

  const isUserOwnerMe = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (user.role === 'owner' || user.role === 'headowner'))
  );

  const isUserAdminMe = !!(
    auth.currentUser?.email === 'koke.kozkoz@gmail.com' ||
    (user && (user.role === 'admin' || user.role === 'owner' || user.role === 'headowner'))
  );
  
  const isCurrentlyBanned = !!(user?.bannedUntil && (user.bannedUntil === 'permanent' || new Date(user.bannedUntil) > new Date()));
  const isUnderMaintenanceObj = !!(systemConfig?.maintenanceMode && (!systemConfig.maintenanceUntil || new Date(systemConfig.maintenanceUntil) > new Date()));
  const isUnderMaintenance = !!(isUnderMaintenanceObj && !isUserExempt);

  const resetKeyPair = async () => {
    if (!user) return;
    const newKeyPair = generateKeyPair();
    storeKeyPair(newKeyPair);
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

  const UPDATES = [
    {
      title: "Archive Enclaves",
      description: "Mute and hide inactive direct or group conversations into a secure, collapsible section, clean-logging your visual viewport. Retrieve them anytime with one-click unarchiving.",
      icon: <Archive className="w-5 h-5 text-pink-400" />,
      date: "June 2026"
    },
    {
      title: "Mobile Interface Polish",
      description: "Enhanced cellular screens with fluid component scaling, smart typography wrapping, and structural containment prevents any visual clipping or text overflows.",
      icon: <Wrench className="w-5 h-5 text-amber-400" />,
      date: "June 2026"
    },
    {
      title: "Screen Sharing",
      description: "Share your entire screen or specific application windows during video calls with one click.",
      icon: <MonitorUp className="w-5 h-5 text-cyan-400" />,
      date: "May 2026"
    },
    {
      title: "Emoji Reactions",
      description: "Quickly express yourself by reacting to messages with fun emojis.",
      icon: <Smile className="w-4 h-4 text-purple-400" />,
      date: "May 2026"
    },
    {
      title: "Video Filters",
      description: "Enhance your presence with synchronized video filters like Noir, Vintage, and Neon that everyone in the call can see.",
      icon: <Camera className="w-5 h-5 text-pink-400" />,
      date: "May 2026"
    },
    {
      title: "Custom Avatars",
      description: "Upload your own profile photos directly from your device to personalize your profile.",
      icon: < ImageIcon className="w-5 h-5 text-green-400" />,
      date: "May 2026"
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
    return m.type === 'text' && m.content.toLowerCase().includes(msgSearchQuery.toLowerCase());
  });

  const filteredDirectory = contacts.filter(c => 
    c.displayName.toLowerCase().includes(directorySearchQuery.toLowerCase()) || 
    c.uid.toLowerCase() === directorySearchQuery.toLowerCase()
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (activeChat && user) {
            await sendAudioMessage(base64Audio, recordDuration);
          }
        };
        stream.getTracks().forEach(track => track.stop());
        setRecordDuration(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      recordTimerRef.current = window.setInterval(() => {
        setRecordDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      setErrorMessage("Microphone access denied.");
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    }
  };

  const sendAudioMessage = async (base64Audio: string, duration: number) => {
    if (!activeChat || !user) return;
    
    // Encryption logic
    const localKeys = getStoredKeyPair();
    if (!localKeys) return;

    let encryptedData: { content: string; nonce: string } | null = null;
    let isEncrypted = false;

    if (activeChat.type === 'direct') {
      const recipientId = activeChat.participants.find(id => id !== user.uid);
      const recipient = contacts.find(c => c.uid === recipientId);
      if (recipient && recipient.publicKey) {
        encryptedData = encryptMessage(base64Audio, recipient.publicKey, localKeys.secretKey);
        isEncrypted = true;
      }
    } else if (activeChat.type === 'group' && activeGroupKey) {
      encryptedData = encryptSymmetric(base64Audio, activeGroupKey);
      isEncrypted = true;
    }

    if (isEncrypted && encryptedData) {
      try {
        await addDoc(collection(db, 'chats', activeChat.id, 'messages'), {
          chatId: activeChat.id,
          senderId: user.uid,
          content: encryptedData.content,
          nonce: encryptedData.nonce,
          type: 'audio',
          duration,
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
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(e => console.log("Video play failed", e));
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current && activeCallStream) {
      localVideoRef.current.srcObject = activeCallStream;
      localVideoRef.current.play().catch(e => console.log("Local video play failed", e));
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

      const localKeys = getStoredKeyPair();
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
        if (prevChat && chat.updatedAt !== prevChat.updatedAt && chat.id !== activeChat?.id) {
          // A different chat was updated!
          if (notificationSound.current) {
            notificationSound.current.play().catch(() => {});
          }

          if (document.visibilityState === 'hidden' && "Notification" in window && Notification.permission === "granted") {
            const senderId = chat.lastMessage?.split(':')[0]?.trim() || ''; // Not reliable but lastMessage might contain info
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
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as MessageType));
      
      // Notification for new messages
      if (msgData.length > messages.length) {
        const lastMsg = msgData[msgData.length - 1];
        if (lastMsg.senderId !== user?.uid) {
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
    const localKeys = getStoredKeyPair();
    if (!localKeys) return;

    let encryptedData: { content: string; nonce: string } | null = null;
    let isEncrypted = false;
    const isAIChat = activeChat.id.startsWith('ai_');

    if (isAIChat) {
      encryptedData = encryptMessage(currentInput, '', '');
      isEncrypted = true;
    } else if (activeChat.type === 'direct') {
      const recipientId = activeChat.participants.find(id => id !== user.uid);
      const recipient = contacts.find(c => c.uid === recipientId);
      if (recipient && recipient.publicKey) {
        encryptedData = encryptMessage(currentInput, recipient.publicKey, localKeys.secretKey);
        isEncrypted = true;
      } else if (recipientId === 'memuer-ai') {
        encryptedData = encryptMessage(currentInput, '', '');
        isEncrypted = true;
      }
    } else if (activeChat.type === 'group' && activeGroupKey) {
      encryptedData = encryptSymmetric(currentInput, activeGroupKey);
      isEncrypted = true;
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
    if (isAIChat || currentInput.includes('@ai') || currentInput.includes('@memuer')) {
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
        const localKeys = getStoredKeyPair();
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;

    try {
      setUploading(true);
      const storagePath = `chats/${activeChat.id}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      // In a real E2EE app, we'd encrypt the file itself or at least the URL.
      // For this demo, we'll store the metadata and just encrypt a notice.
      const localKeys = getStoredKeyPair();
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
              storagePath: url // Simplified: using direct URL for accessibility in this demo
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
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const createGroup = async () => {
    if (!user || selectedForGroup.length === 0) return;
    
    const localKeys = getStoredKeyPair();
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
  const handleAdminBanUser = async (uid: string, durationMinutes: number | 'perm') => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
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

  const handleAdminUnbanUser = async (uid: string) => {
    if (!isUserAdminMe) {
      setErrorMessage("Unauthorized administrative attempt.");
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
        repliedBy: user?.displayName || 'Administrator'
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

  const handleAdminToggleRole = async (uid: string, currentRole?: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Requires owner privileges.");
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }
    try {
      const userRef = doc(db, 'users', uid);
      let nextRole = 'user';
      if (!currentRole || currentRole === 'user') {
        nextRole = 'tester';
      } else if (currentRole === 'tester') {
        nextRole = 'admin';
      } else if (currentRole === 'admin') {
        nextRole = 'owner';
      } else if (currentRole === 'owner') {
        nextRole = 'headowner';
      } else if (currentRole === 'headowner') {
        nextRole = 'user';
      }
      await updateDoc(userRef, { role: nextRole });
      setErrorMessage(`Role modified to ${nextRole}`);
      setTimeout(() => setErrorMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(`Failed to change role: ${err.message}`);
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  const handleAdminDeleteUser = async (uid: string) => {
    if (!isUserOwnerMe) {
      setErrorMessage("Unauthorized administrative attempt. Restricted to structural owners.");
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

  const handleAdminLockApp = async (locked: boolean, customizedReason?: string) => {
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
      const storagePath = `profiles/${user.uid}/${Date.now()}_${file.name}`;
      const fileRef = ref(storage, storagePath);
      await uploadBytes(fileRef, file);
      const photoURL = await getDownloadURL(fileRef);
      await updateProfile({ photoURL });
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to update profile photo.");
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

  if (loading) {
    return (
      <div className="h-dvh w-full bg-indigo-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-yellow-500 animate-pulse flex items-center justify-center">
            <span className="font-black text-2xl text-white">M</span>
          </div>
          <p className="text-indigo-200 font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Secure Tunnel...</p>
          <p className="text-indigo-300/40 text-[9px] font-bold uppercase tracking-[0.2em]">memuer | social +</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-dvh w-full bg-indigo-950 flex flex-col items-center justify-start sm:justify-center p-4 overflow-y-auto custom-scrollbar">
        <div className="max-w-md w-full my-auto space-y-6 sm:space-y-8 bg-indigo-900/40 backdrop-blur-xl p-6 sm:p-8 rounded-3xl sm:rounded-[40px] border border-white/10 shadow-2xl shrink-0">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl sm:rounded-3xl bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center shadow-2xl shadow-pink-500/20 mb-4 sm:mb-6">
              <span className="font-black text-3xl sm:text-4xl text-white">M</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 flex items-center justify-center gap-0.5">
              <span className="text-pink-500">M</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-300">emuer</span>
            </h2>
            <div className="flex items-center justify-center">
              <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-400/80">social +</span>
            </div>
            <p className="text-xs sm:text-sm text-indigo-200/70 font-medium">Privacy is not an option. It's the standard.</p>
          </div>
          
          {!showLocalLogin ? (
            <div className="space-y-3">
              <button 
                onClick={login}
                className="w-full py-3.5 sm:py-4 px-6 bg-white text-indigo-950 font-black rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 hover:bg-white/90 transition-all shadow-xl text-sm sm:text-base"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                Enter Secure Vault
              </button>
              <button 
                onClick={() => setShowLocalLogin(true)}
                className="w-full py-3 sm:py-3.5 px-6 bg-white/5 border border-white/10 text-white font-bold rounded-xl sm:rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all text-sm sm:text-base"
              >
                <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
                Local Vault Passkey
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
                  <h3 className="text-xl font-bold text-white text-center">Reset Access</h3>
                  <p className="text-[10px] text-indigo-200/60 text-center uppercase tracking-widest leading-relaxed">
                    Enter your vault email to receive a recovery link.
                  </p>
                  <input 
                    type="email" 
                    placeholder="Vault Email" 
                    value={localEmail}
                    onChange={(e) => setLocalEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                  />
                  {resetEmailSent && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-widest text-center">
                      Recovery link dispatched!
                    </div>
                  )}
                  <button 
                    onClick={() => resetPassword(localEmail)}
                    className="w-full py-3.5 bg-cyan-500 text-white font-black rounded-xl shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-widest"
                  >
                    Send Recovery Link
                  </button>
                  <button 
                    onClick={() => setIsResetting(false)}
                    className="w-full text-[10px] uppercase tracking-widest font-black text-indigo-300 hover:text-white"
                  >
                    Return to login
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {isRegistering && (
                      <input 
                        type="text" 
                        placeholder="Identity Label (e.g. Ghost)" 
                        value={localName}
                        onChange={(e) => setLocalName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                      />
                    )}
                    <input 
                      type="email" 
                      placeholder="Vault Email" 
                      value={localEmail}
                      onChange={(e) => setLocalEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/50 outline-none text-white"
                    />
                    <input 
                      type="password" 
                      placeholder="Vault Passphrase" 
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
          
          <div className="flex items-center justify-center gap-4 pt-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-indigo-300 opacity-50">
            <span>Memuer | social +</span>
            <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
            <span>AES-256 Vault</span>
            <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
            <span>End-to-End</span>
          </div>
        </div>
      </div>
    );
  }

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
      bg: "bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900",
      sidebar: "lg:bg-indigo-800/40",
      sidebarMobile: "bg-indigo-900/95",
      rail: "bg-black/20",
      tabChats: "bg-indigo-600",
      tabDirectory: "bg-cyan-600",
      tabSignals: "bg-pink-600",
      accentText: "text-indigo-300",
      accentBg: "bg-indigo-600/40",
      bubbleMe: "bg-indigo-600/40 border-indigo-400/30 text-indigo-50",
      bubbleOther: "bg-white/5 border-white/10 text-indigo-50",
      inputRing: "ring-pink-500/30"
    },
    midnight: {
      bg: "bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950",
      sidebar: "lg:bg-slate-900/40",
      sidebarMobile: "bg-slate-950/95",
      rail: "bg-black/40",
      tabChats: "bg-slate-600",
      tabDirectory: "bg-indigo-600",
      tabSignals: "bg-slate-500",
      accentText: "text-slate-300",
      accentBg: "bg-slate-800/40",
      bubbleMe: "bg-slate-800/60 border-slate-700/40 text-slate-50",
      bubbleOther: "bg-white/5 border-white/10 text-slate-50",
      inputRing: "ring-slate-500/30"
    },
    forest: {
      bg: "bg-gradient-to-br from-emerald-950 via-teal-900 to-green-950",
      sidebar: "lg:bg-emerald-900/40",
      sidebarMobile: "bg-emerald-950/95",
      rail: "bg-black/30",
      tabChats: "bg-emerald-600",
      tabDirectory: "bg-teal-600",
      tabSignals: "bg-green-600",
      accentText: "text-emerald-300",
      accentBg: "bg-emerald-800/40",
      bubbleMe: "bg-emerald-800/60 border-emerald-700/40 text-emerald-50",
      bubbleOther: "bg-white/5 border-white/10 text-emerald-50",
      inputRing: "ring-emerald-500/30"
    },
    crimson: {
      bg: "bg-gradient-to-br from-rose-950 via-red-900 to-orange-950",
      sidebar: "lg:bg-rose-900/40",
      sidebarMobile: "bg-rose-950/95",
      rail: "bg-black/30",
      tabChats: "bg-rose-600",
      tabDirectory: "bg-red-600",
      tabSignals: "bg-orange-600",
      accentText: "text-rose-300",
      accentBg: "bg-rose-800/40",
      bubbleMe: "bg-rose-800/60 border-rose-700/40 text-rose-50",
      bubbleOther: "bg-white/5 border-white/10 text-rose-50",
      inputRing: "ring-rose-500/30"
    }
  };

  const currentTheme = themeStyles[user?.preferences?.theme || 'vibrant'] || themeStyles.vibrant;

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

  return (
    <div className={cn("flex h-dvh h-[100dvh] w-full overflow-hidden font-sans text-white relative", currentTheme.bg)}>
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
      {/* Leftmost Rail */}
      <div className={cn("hidden sm:flex w-20 flex-col items-center gap-4 py-6 border-r border-white/5 shrink-0", currentTheme.rail)}>
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-pink-500/20 cursor-pointer">
          <span className="font-black text-xl">M</span>
        </div>
        
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all", currentTheme.accentBg, "hover:opacity-80")} onClick={() => setIsAddConnectionModalOpen(true)}>
          <Plus className="w-5 h-5" />
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
        "fixed inset-y-0 left-0 z-[80] w-[85vw] sm:w-72 flex flex-col backdrop-blur-2xl border-r border-white/5 transition-transform duration-300 lg:relative",
        currentTheme.sidebarMobile,
        currentTheme.sidebar,
        (isMobileSidebarOpen || isDesktop) ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-0.5">
              <span className="text-pink-500">M</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 to-cyan-300">emuer</span>
              <span className="ml-1.5 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[8px] font-black uppercase tracking-[0.2em] text-cyan-400/80 self-end mb-1">social +</span>
            </h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isUserAdminMe && (
              <button 
                onClick={() => setIsAdminPanelOpen(true)}
                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/30 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 select-none shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:shadow-[0_0_15px_rgba(239,68,68,0.25)] hover:scale-105 active:scale-95"
                title="Admin Console"
              >
                <Sliders className="w-2.5 h-2.5" />
                Admin
              </button>
            )}
            <button onClick={toggleMobileSidebar} className="lg:hidden p-2 hover:bg-white/10 rounded-xl">
              <X className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 mb-4 flex gap-1 bg-white/5 mx-6 rounded-xl p-1 border border-white/5">
          <button 
            onClick={() => setSidebarTab('chats')}
            className={cn(
              "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              sidebarTab === 'chats' ? cn(currentTheme.tabChats, "text-white shadow-lg") : cn(currentTheme.accentText, "hover:bg-white/5")
            )}
          >
            Chats
          </button>
          <button 
            onClick={() => setSidebarTab('contacts')}
            className={cn(
              "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
              sidebarTab === 'contacts' ? cn(currentTheme.tabDirectory, "text-white shadow-lg") : "text-cyan-300 hover:bg-white/5"
            )}
          >
            Directory
          </button>
          <button 
            onClick={() => setSidebarTab('requests')}
            className={cn(
              "flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all relative",
              sidebarTab === 'requests' ? cn(currentTheme.tabSignals, "text-white shadow-lg") : "text-pink-300 hover:bg-white/5"
            )}
          >
            Signals
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

          <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center gap-2">
            <Search className="w-4 h-4 text-white/30 ml-2" />
            <input 
              type="text" 
              placeholder={sidebarTab === 'chats' ? "Search chats..." : "Search directory..."} 
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDirectorySearchQuery(e.target.value);
              }}
              className="bg-transparent border-none focus:ring-0 text-xs py-1.5 w-full"
            />
          </div>
        </div>

        <div className="flex-1 px-3 space-y-4 overflow-y-auto custom-scrollbar">
          {sidebarTab === 'chats' ? (
            <>
              <div className="px-3 py-2">
                <p className={cn("text-[10px] font-bold uppercase tracking-widest mb-2", currentTheme.accentText)}>Systems</p>
                <div 
                  onClick={startAIChat}
                  className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 ring-1 ring-cyan-400/30 cursor-pointer hover:bg-white/5 transition-all group", currentTheme.accentBg)}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-[10px] font-bold">AI</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="font-bold text-sm text-cyan-200">Private AI Vault</p>
                    <p className="text-[10px] text-indigo-200/70 truncate italic font-medium">Neural Assistant Active</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-cyan-400 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
              </div>

              <div className="px-3 space-y-6">
                {/* Direct Messages Section */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className={cn("text-[10px] font-bold uppercase tracking-widest", currentTheme.accentText)}>Secure Streams</p>
                    <span className="text-[9px] text-cyan-400/50 font-mono">
                      {chats.filter(c => c.type === 'direct' && !c.id.startsWith('ai_') && !c.participants.includes('memuer-ai') && !(c.archivedBy && c.archivedBy.includes(user?.uid || ''))).length} ACTIVE
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
                      .map(chat => {
                        const otherParticipantId = chat.participants.find(id => id !== user?.uid);
                        const otherUser = contacts.find(c => c.uid === otherParticipantId);
                        return (
                          <div 
                            key={chat.id}
                            onClick={() => {
                              setActiveChat(chat);
                              setIsMobileSidebarOpen(false);
                            }}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group relative",
                              activeChat?.id === chat.id ? "bg-white/10 border-white/10 shadow-inner" : "hover:bg-white/5"
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
                                <p className="text-sm font-bold truncate text-white/90">{otherUser?.displayName || 'Syncing...'}</p>
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
                      .map(chat => (
                        <div 
                          key={chat.id}
                          onClick={() => {
                            setActiveChat(chat);
                            setIsMobileSidebarOpen(false);
                          }}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border border-transparent group relative",
                            activeChat?.id === chat.id ? "bg-white/10 border-white/10 shadow-inner" : "hover:bg-white/5"
                          )}
                        >
                          <div className="shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-indigo-600 flex items-center justify-center border border-white/20 shadow-lg">
                              <Users className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-bold truncate text-white/90">{chat.name}</p>
                            <div className={cn("text-[10px] truncate font-medium", currentTheme.accentText.replace('text-', 'text-opacity-70 text-'))}>
                              {Object.entries(chat.typing || {}).some(([id, typing]) => id !== user?.uid && typing) 
                                ? <div className="flex gap-1 items-center">
                                    <span className={cn("w-1 h-1 rounded-full animate-pulse", currentTheme.accentBg.replace('bg-', 'bg-opacity-100 bg-'))}></span>
                                    <span className={cn("animate-pulse italic font-black uppercase tracking-tighter text-[9px]", currentTheme.accentText)}>TRANSMITTING...</span>
                                  </div>
                                : (chat.lastMessage || `${chat.participants.length} nodes active`)}
                            </div>
                          </div>
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
                      ))}
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
                {filteredDirectory.map(contact => {
                  const isFriend = chats.some(c => c.type === 'direct' && c.participants.includes(contact.uid));
                  return (
                    <div 
                      key={contact.uid}
                      onClick={() => {
                        if (isFriend) {
                          startDM(contact);
                          setSearchQuery('');
                          setSidebarTab('chats');
                          setIsMobileSidebarOpen(false);
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
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            sendFriendRequest(contact.uid);
                          }}
                          className="shrink-0 p-2 rounded-lg bg-pink-500/20 text-pink-400 hover:bg-pink-500 hover:text-white transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
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
                {friendRequests.map(req => (
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
                className="w-4 h-4 text-indigo-300 cursor-pointer hover:text-white transition-colors"
                title="Contact Support"
              >
                <Mail className="w-4 h-4" />
              </button>
              <Settings className="w-4 h-4 text-indigo-300 cursor-pointer hover:text-white transition-colors" onClick={() => { setIsProfileModalOpen(true); setIsMobileSidebarOpen(false); }} title="Profile Settings" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Chat Window */}
      <div className={cn("flex-1 flex flex-col relative min-w-0 overflow-hidden", currentTheme.bg)}>
        {!activeChat && (
            <Header
              isMobile={!isDesktop}
              onToggleMobileMenu={toggleMobileSidebar}
              isMobileMenuOpen={isMobileSidebarOpen}
              userName={user?.displayName}
              userAvatar={user?.photoURL}
              userRole={user?.role}
              onLogout={handleLogout}
              onSettings={() => { setIsProfileModalOpen(true); }}
              accentText={currentTheme.accentText}
              accentBg={currentTheme.accentBg}
              notificationCount={friendRequests.length}
              isOnline={true}
            />
        )}

        {/* Chat Background Decoration */}
        <div className={cn("absolute inset-0 pointer-events-none transition-all duration-700", currentBgClass)}>
          <div className="absolute top-20 left-40 w-64 h-64 bg-cyan-400 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-40 right-20 w-80 h-80 bg-pink-500 rounded-full blur-[120px]"></div>
        </div>

        {activeChat ? (
          <>
            {/* Header */}
            <div className="h-16 sm:h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-8 bg-black/10 backdrop-blur-md relative z-10 shrink-0">
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
                    <h1 className="text-sm sm:text-lg font-black tracking-tight truncate">
                      {activeChat.id.startsWith('ai_') 
                        ? (activeChat.name || 'Personal Neural Vault')
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
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-cyan-500/20 text-[9px] font-black text-cyan-400 border border-cyan-500/30 uppercase tracking-tighter italic">Neural Link</span>
                    ) : user?.vaultSynced === false ? (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-red-500/20 text-[9px] font-black text-red-400 border border-red-500/30 uppercase tracking-tighter italic">Keys Out of Sync</span>
                    ) : (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-green-500/20 text-[9px] font-black text-green-400 border border-green-500/30 uppercase tracking-tighter italic">Encrypted</span>
                    )}
                  </div>
                  <p className={cn("text-[9px] sm:text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 truncate", currentTheme.accentText)}>
                    <Shield className={cn("w-2.5 h-2.5", user?.vaultSynced === false ? "text-red-500" : activeChat.id.startsWith('ai_') ? "text-cyan-400" : "currentColor")} /> 
                    <span className={cn("truncate", user?.vaultSynced === false && "text-red-400", activeChat.id.startsWith('ai_') && "text-cyan-300")}>
                      {activeChat.id.startsWith('ai_') ? "Direct Neural Uplink" : user?.vaultSynced === false ? "Vault Protection Failure" : "Secure Session Active"}
                    </span>
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
                <div className="hidden sm:block h-8 w-px bg-white/10"></div>
                <button className="hidden sm:flex w-10 h-10 rounded-full bg-white/5 items-center justify-center text-indigo-300 hover:bg-white/10">
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
                {messages.map((msg, i) => {
                  const isMe = msg.senderId === user?.uid;
                  const isAI = msg.senderId === 'memuer-ai';
                  const otherUser = contacts.find(c => c.uid === msg.senderId);
                  
                  // Decrypt message
                  let decryptedContent = msg.content;
                  let isEncrypted = !isAI && msg.nonce && msg.nonce !== 'system-msg';

                  if (isEncrypted) {
                    const localKeys = getStoredKeyPair();
                    
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
                      } catch (e) {
                        console.error("Decryption error:", e);
                        decryptedContent = '🔒 [Decryption System Failure]';
                      }
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
                            "p-3 sm:p-4 backdrop-blur-md rounded-2xl border transition-all shadow-xl font-medium text-[13px] sm:text-sm leading-relaxed relative z-10 break-all break-words overflow-hidden",
                            isMe ? currentTheme.bubbleMe + " rounded-tr-none" : 
                            isAI ? "bg-indigo-500/20 border-cyan-400/30 rounded-tr-none text-cyan-50 font-bold" :
                            currentTheme.bubbleOther + " rounded-tl-none"
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
                                ) : (
                                  <p className="break-all break-words whitespace-pre-wrap">{decryptedContent}</p>
                                )}
                              </div>
                            )}
                            {msg.type === 'file' && msg.fileMetadata && (
                              <a 
                                href={msg.fileMetadata.storagePath} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="mt-3 flex items-center gap-3 p-3 bg-white/10 rounded-xl border border-white/10 hover:bg-white/20 transition-colors"
                              >
                                <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center">
                                  <Paperclip className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className="text-xs font-bold truncate">{msg.fileMetadata.name}</p>
                                  <p className="text-[10px] text-indigo-300">{(msg.fileMetadata.size / 1024).toFixed(1)} KB • Secure Download</p>
                                </div>
                              </a>
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
                          {isMe && <Check className="w-2.5 h-2.5 text-green-400" />}
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
                const lastWord = messageInput.split(/\s+/).pop() || '';
                const showMentionSuggestions = lastWord.startsWith('@') && '@memuer'.startsWith(lastWord.toLowerCase());
                if (!showMentionSuggestions) return null;
                return (
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
                );
              })()}
              <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-xl sm:rounded-[24px] p-1 sm:p-2 flex items-center gap-1 sm:gap-2 shadow-2xl focus-within:ring-2 ring-pink-500/30 transition-all">
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
                  className="p-1.5 sm:p-3 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full transition-colors text-indigo-300 disabled:opacity-50"
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
                    const lastWord = messageInput.split(/\s+/).pop() || '';
                    const showMentionSuggestions = lastWord.startsWith('@') && '@memuer'.startsWith(lastWord.toLowerCase());
                    if (showMentionSuggestions && (e.key === 'Tab' || e.key === 'Enter')) {
                      e.preventDefault();
                      const parts = messageInput.split(/\s+/);
                      parts.pop();
                      setMessageInput((parts.join(' ') + ' @memuer ').trimStart());
                    }
                  }}
                  placeholder={activeChat?.id.startsWith('ai_') ? "Input neural query..." : "Type message..."} 
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-semibold placeholder-indigo-300/40 py-1 sm:py-2 outline-none"
                />
                <div className="flex items-center gap-1">
                  <div className="relative hidden xs:block">
                    <button 
                      type="button" 
                      onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
                      className="p-1.5 text-indigo-300 hover:text-white transition-colors"
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
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    onMouseLeave={stopRecording}
                    onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                    onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                    className={cn(
                      "w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl flex items-center justify-center transition-all shadow-lg shrink-0 touch-none",
                      isRecording 
                        ? "bg-red-500 text-white animate-pulse" 
                        : "bg-white/5 border border-white/10 text-indigo-300 hover:bg-white/10"
                    )}
                  >
                    {isRecording ? <div className="text-[9px] sm:text-[10px] font-black">{recordDuration}s</div> : <Mic className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                  </button>
                  <button 
                    type="submit"
                    disabled={!messageInput.trim() && !isRecording}
                    className="w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-2xl bg-gradient-to-br from-pink-500 via-fuchsia-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-pink-500/20 text-white hover:scale-105 active:scale-95 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
              <div className="mt-3 sm:mt-4 hidden xs:flex items-center justify-center gap-4 sm:gap-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 italic">
                <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> E2EE Handshake</span>
                <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                <span className="flex items-center gap-1"><ImageIcon className="w-2.5 h-2.5" /> Secure Vault</span>
              </div>
            </form>
          </>
        ) : (
          /* Empty State / Welcome */
          <div className="flex-1 flex flex-col items-center justify-start lg:justify-center p-8 text-center space-y-12 relative overflow-y-auto custom-scrollbar pt-12 lg:pt-0">
            <div className="relative mt-8 lg:mt-0">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-[32px] sm:rounded-[40px] bg-gradient-to-tr from-pink-500 to-yellow-500 flex items-center justify-center shadow-2xl shadow-pink-500/20 border-4 border-white/10 animate-bounce">
                <span className="font-black text-5xl sm:text-6xl text-white">{displayLetter}</span>
              </div>
              <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-cyan-400 flex items-center justify-center shadow-xl border-4 border-indigo-900 animate-pulse">
                <span className="text-[10px] font-black text-indigo-900">NEW</span>
              </div>
            </div>
            
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-black tracking-tight">Welcome home, {user?.displayName?.split(' ')[0]}</h1>
              <p className="text-indigo-200/60 font-medium leading-relaxed">
                Your private vault is ready. All communications are automatically encrypted with your key: 
                <code className="block mt-2 font-mono text-[10px] bg-white/5 py-1 px-2 rounded-lg text-indigo-100">{user?.publicKey?.slice(0, 32)}...</code>
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-sm px-4">
              <div 
                onClick={() => { setSidebarTab('contacts'); setIsMobileSidebarOpen(true); }} 
                className="p-6 bg-white/10 rounded-[32px] border border-white/20 hover:bg-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl"
              >
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                  <Users className="w-6 h-6" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-white">Find Contacts</p>
              </div>
              
              <div 
                onClick={() => setIsAddConnectionModalOpen(true)} 
                className="p-6 bg-white/10 rounded-[32px] border border-white/20 hover:bg-white/20 transition-all cursor-pointer group flex flex-col items-center justify-center gap-3 backdrop-blur-xl shadow-2xl"
              >
                <div className="w-12 h-12 rounded-2xl bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:scale-110 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <p className="text-xs font-black uppercase tracking-widest text-white">Connect by ID</p>
              </div>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        <AnimatePresence>
          {isProfileModalOpen && (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] bg-indigo-950/65 backdrop-blur-md flex items-start sm:items-center justify-center p-4 overflow-y-auto custom-scrollbar"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="bg-indigo-900 border border-white/10 rounded-3xl sm:rounded-[40px] p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6 my-auto shrink-0"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-black tracking-tight font-bold">Your Identity</h3>
                  <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="flex flex-col items-center gap-3 py-2 sm:py-4">
                  <div className="relative group">
                    <img 
                      src={user?.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.uid}`} 
                      className={cn("w-16 h-16 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-indigo-400/30", uploading && "opacity-50 animate-pulse")} 
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
                    <p className="text-[9px] sm:text-[10px] text-indigo-300 uppercase tracking-widest font-black">Quantum-Secure Channel</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">Status Message</label>
                    <input 
                      type="text" 
                      defaultValue={user?.status}
                      onBlur={(e) => updateProfile({ status: e.target.value })}
                      className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">Ambience Palette</label>
                    <div className="flex gap-3 mt-2">
                      {[
                        { name: 'Vibrant', class: 'bg-indigo-600' },
                        { name: 'Midnight', class: 'bg-slate-900' },
                        { name: 'Forest', class: 'bg-emerald-900' },
                        { name: 'Crimson', class: 'bg-rose-950' }
                      ].map(theme => (
                        <div 
                          key={theme.name}
                          onClick={() => updateProfile({ preferences: { ...user?.preferences, theme: theme.name.toLowerCase() } })}
                          className={cn(
                            "w-10 h-10 rounded-xl cursor-pointer border-2 transition-all flex items-center justify-center",
                            theme.class,
                            user?.preferences?.theme === theme.name.toLowerCase() ? "border-white scale-110 shadow-lg shadow-white/20" : "border-transparent opacity-60 hover:opacity-100"
                          )}
                        >
                          {user?.preferences?.theme === theme.name.toLowerCase() && <Check className="w-4 h-4 text-white" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">Wallpaper Handshake</label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {['Geometric', 'Aurora', 'Digital Grid', 'Deep Void'].map(bg => (
                        <div 
                          key={bg}
                          onClick={() => updateProfile({ preferences: { ...user?.preferences, chatBackground: bg.toLowerCase() } })}
                          className={cn(
                            "p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-center cursor-pointer transition-all",
                            user?.preferences?.chatBackground === bg.toLowerCase() ? "bg-white text-indigo-950 border-white" : "bg-white/5 text-indigo-300 border-white/5 hover:bg-white/10"
                          )}
                        >
                          {bg}
                        </div>
                      ))}
                    </div>
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
                    <Mail className="w-4 h-4" /> Contact Support
                  </button>
                  <button 
                    onClick={handleLogout} 
                    className="flex-1 py-3.5 rounded-2xl bg-red-500/20 text-red-400 font-bold border border-red-500/20 hover:bg-red-500/30 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                  >
                    <LogOut className="w-4 h-4" /> Terminate Session
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
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
                    <h3 className="text-xl sm:text-2xl font-black tracking-tight font-bold text-white">Contact Us</h3>
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
                    Submit Ticket
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
                    Your Inbox
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
                        {contactProgressStep || 'Accessing support gateway...'}
                      </p>
                      <p className="text-[10px] text-zinc-500 font-mono tracking-widest">
                        SECURE IN-APP ROUTING ACTIVE
                      </p>
                    </div>
                  </div>
                ) : contactSendSuccess ? (
                  <div className="py-4 flex flex-col items-center justify-center text-center space-y-5">
                    <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/10">
                      <Check className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold text-white uppercase tracking-wider">Inquiry Sent Directly!</h4>
                      <p className="text-xs text-indigo-200 px-4 max-w-xs mx-auto leading-relaxed">
                        Your message has been securely submitted from the app directly to <strong className="text-pink-400">{systemConfig?.contactSupportEmail || 'contactus@memuer.app'}</strong>. Our administration will review it in their control deck.
                      </p>
                    </div>
                    <div className="flex gap-2 w-full pt-4">
                      <button 
                        type="button"
                        onClick={() => { setContactSendSuccess(false); setContactProgressStep(null); }}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold uppercase tracking-wider text-xs rounded-2xl transition-all"
                      >
                        Send Another
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setIsContactModalOpen(false); setContactSendSuccess(false); setContactProgressStep(null); }}
                        className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-indigo-500 hover:opacity-90 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : contactActiveTab === 'inbox' ? (
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {userContactMessages.length === 0 ? (
                      <div className="h-32 flex flex-col items-center justify-center text-center p-4 space-y-2">
                        <Mail className="w-6 h-6 text-zinc-550 animate-pulse" />
                        <h4 className="text-xs font-bold text-zinc-400">No support history</h4>
                        <p className="text-[10px] text-zinc-500 leading-relaxed max-w-xs">Any inquiries you submit will appear here with dynamic admin responses in real-time.</p>
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
                                {msg.replied ? "Answered" : "Pending"}
                              </span>
                            </div>

                            <p className="text-[11px] text-zinc-350 leading-relaxed italic whitespace-pre-wrap">{msg.message}</p>

                            {/* Display reply if exists */}
                            {msg.replied && msg.replyMessage && (
                              <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 space-y-1 mt-2 text-left">
                                <div className="text-[8px] font-mono text-emerald-400 font-bold uppercase">
                                  ADMIN ANSWER ({msg.repliedBy || 'Support'}):
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
                      Have feedback, questions, or ideas? Securely encrypt your inquiry details. Submitting this form transmits your message directly to our servers at <strong className="text-pink-400">{systemConfig?.contactSupportEmail || 'contactus@memuer.app'}</strong>.
                    </p>

                    <form onSubmit={handleSendContact} className="space-y-4">
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          Your Email (For Replies)
                        </label>
                        <input 
                          type="email" 
                          required
                          placeholder="e.g. name@example.com"
                          value={contactEmail || user?.email || ''}
                          onChange={(e) => setContactEmail(e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30 text-white placeholder-zinc-500 focus:outline-none placeholder:text-zinc-500 bg-black/10"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          Subject Matter
                        </label>
                        <input 
                          type="text" 
                          required
                          placeholder="e.g. Feedback, Security, Feature Suggestion"
                          value={contactSubject}
                          onChange={(e) => setContactSubject(e.target.value)}
                          className="w-full mt-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm focus:ring-2 ring-pink-500/30 text-white placeholder-zinc-500 focus:outline-none placeholder:text-zinc-500 bg-black/10"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 ml-1">
                          Detailed Message
                        </label>
                        <textarea 
                          required
                          rows={4}
                          placeholder="Type your message here..."
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
                          Cancel
                        </button>
                        <button 
                          type="submit"
                          className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-indigo-500/90 hover:opacity-90 text-white font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-500/20"
                        >
                          <Send className="w-3.5 h-3.5" />
                          Transmit Inquiry
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
                    <h3 className="text-3xl font-black tracking-tighter text-white">SYSTEM UPDATES</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 mt-1">Transmission received • v2.1.0</p>
                  </div>
                  <button 
                    onClick={() => setIsChangelogOpen(false)} 
                    className="p-3 bg-white/5 hover:bg-red-500/20 text-white/50 hover:text-red-400 rounded-2xl transition-all border border-white/5 hover:border-red-500/20"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-2">
                  {UPDATES.map((update, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-5 bg-white/5 rounded-[32px] border border-white/5 hover:bg-white/10 transition-all group/item"
                    >
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover/item:border-cyan-500/30 transition-colors">
                          {update.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-bold text-white text-lg">{update.title}</h4>
                            <span className="text-[9px] font-black uppercase text-indigo-300/50 bg-white/5 px-2 py-1 rounded-full">{update.date}</span>
                          </div>
                          <p className="text-sm text-indigo-200/70 leading-relaxed font-medium">
                            {update.description}
                          </p>
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
                    Acknowledged
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
                  <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-pink-300 font-bold">New Connection</h3>
                  <button onClick={() => setIsAddConnectionModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full"><X className="w-5 h-5" /></button>
                </div>
 
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-3 ml-1">Search by ID or Name</p>
                    <div className="flex items-center gap-3">
                      <input 
                        autoFocus
                        type="text" 
                        id="modal-search-input"
                        placeholder="e.g. demo-1234 or Alice" 
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
 
                  <div className="grid grid-cols-1 gap-4">
                    <div onClick={() => { setIsGroupModalOpen(true); setIsAddConnectionModalOpen(false); }} className="p-4 bg-white/5 rounded-3xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer group flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-400/20 flex items-center justify-center text-cyan-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-100">Group Chat</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
 
              {/* Calling / Active Call Floating UI */}
        <AnimatePresence>
          {calling && (
            <motion.div 
              drag={!isMobile}
              dragMomentum={false}
              dragElastic={0.05}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ 
                opacity: 1, 
                scale: 1, 
                width: isCallMinimized ? '280px' : (remoteStream ? (isMobile ? '92vw' : `${callUIStyle.width}px`) : (isMobile ? '100vw' : '420px')),
                height: isCallMinimized ? '180px' : (remoteStream ? (calling.type === 'video' ? (isMobile ? '65vh' : `${callUIStyle.height}px`) : 'auto') : (isMobile ? '100vh' : 'auto')),
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "fixed z-[200] transition-all duration-300 ease-out shadow-3xl overflow-hidden touch-none",
                isCallMinimized 
                  ? "bottom-6 right-6 rounded-[32px] sm:rounded-[40px] border-4 border-cyan-500/30 ring-8 ring-cyan-500/5 bg-black" 
                  : (remoteStream 
                    ? "top-10 left-4 sm:top-24 sm:right-8 sm:left-auto rounded-[32px] sm:rounded-[40px] border-4 border-white/20 bg-black" 
                    : (isMobile 
                      ? "inset-0 bg-indigo-950/90 backdrop-blur-3xl" 
                      : "fixed top-24 left-1/2 -ml-[210px] rounded-[40px] border border-white/10 bg-indigo-950/95 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.65)] max-h-[90vh] overflow-y-auto custom-scrollbar"))
              )}
            >
              <div className={cn(
                "relative flex flex-col items-center justify-center overflow-hidden h-full",
                isCallMinimized ? "p-2" : (
                  remoteStream 
                    ? "bg-black/80 backdrop-blur-3xl p-3 sm:p-6" 
                    : "w-full h-full p-6 sm:p-8"
                )
              )}>
                {/* Resize Handle */}
                {(remoteStream || isCallMinimized) && !isMobile && (
                  <div 
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const startWidth = isCallMinimized ? 280 : callUIStyle.width;
                      const startHeight = isCallMinimized ? 180 : callUIStyle.height;

                      const onMouseMove = (moveEvent: MouseEvent) => {
                        const deltaX = moveEvent.clientX - startX;
                        const deltaY = moveEvent.clientY - startY;
                        setCallUIStyle({
                          width: Math.max(300, startWidth + deltaX),
                          height: Math.max(200, startHeight + deltaY)
                        });
                      };

                      const onMouseUp = () => {
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                      };

                      window.addEventListener('mousemove', onMouseMove);
                      window.addEventListener('mouseup', onMouseUp);
                    }}
                    className="absolute bottom-2 right-2 w-8 h-8 cursor-nwse-resize z-50 flex items-center justify-center group"
                  >
                    <div className="w-4 h-4 border-r-2 border-b-2 border-white/20 group-hover:border-white transition-colors" />
                  </div>
                )}
                {!remoteStream && !isCallMinimized && (
                  <>
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-indigo-900 animate-pulse opacity-20"></div>
                      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[120px] animate-pulse"></div>
                      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
                    </div>
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
                  </>
                )}

                <div className={cn(
                  "relative z-10 flex flex-col items-center w-full",
                  isCallMinimized ? "h-full justify-between" : (remoteStream ? "gap-2 sm:gap-4" : "max-w-md")
                )}>
                  {!remoteStream && !isCallMinimized && (
                    <motion.div 
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="mb-6 sm:mb-12 text-center"
                    >
                      <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4 sm:mb-6">
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-cyan-400 rounded-full animate-ping"></span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-cyan-400">
                          {calling.isIncoming ? "Secure Incoming Link" : "Establishing Handshake"}
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <div className={cn(
                    "relative w-full group transition-all duration-700",
                    isCallMinimized ? "h-full" : (remoteStream ? "aspect-video" : "aspect-square")
                  )}>
                    <div className={cn(
                      "w-full h-full rounded-[40px] border-2 transition-all duration-700 overflow-hidden bg-black/40 shadow-2xl",
                      isCallMinimized ? "rounded-3xl border-transparent" : (
                        remoteStream ? "aspect-video border-white/20" : "max-w-[240px] mx-auto border-cyan-500/30 ring-8 ring-cyan-500/5"
                      )
                    )}>
                      {remoteStream ? (
                        <div className="w-full h-full relative">
                          <video 
                            autoPlay 
                            playsInline 
                            ref={(el) => {
                              if (el && remoteStream) {
                                (el as HTMLVideoElement).srcObject = remoteStream;
                                (el as HTMLVideoElement).play().catch(e => console.log("Remote play failed", e));
                              }
                              // @ts-ignore
                              remoteVideoRef.current = el;
                            }}
                            style={{ 
                              filter: videoFilters[remoteVideoFilter].filter
                            }}
                            className="w-full h-full object-cover"
                          />
                          {!remoteStream.getVideoTracks().some(t => t.enabled) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md">
                              <div className="flex flex-col items-center gap-2">
                                <VideoOff className="w-8 h-8 text-white/20" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Camera Suspended</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full relative group">
                          <img 
                            src={calling.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${calling.user.uid}`} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                            referrerPolicy="no-referrer"
                          />
                          {!calling.isIncoming && !calling.isConnecting && (
                            <div className="absolute inset-0 bg-indigo-500/40 mix-blend-overlay"></div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {!remoteStream && !isCallMinimized && (
                      <div className="absolute inset-x-0 -bottom-4 flex justify-center pointer-events-none">
                         <div className="w-48 h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent blur-sm animate-pulse"></div>
                      </div>
                    )}
                    
                    {activeCallStream && !isCallMinimized && (
                      <motion.div 
                        initial={false}
                        className={cn(
                          "absolute overflow-hidden shadow-2xl border border-white/20 bg-black transition-all duration-500 z-20",
                          remoteStream 
                            ? "bottom-4 right-4 w-28 h-40 rounded-2xl" 
                            : "top-4 right-1/2 translate-x-32 w-20 h-28 rounded-2xl shadow-cyan-500/10"
                        )}
                      >
                        <video 
                          autoPlay 
                          muted 
                          playsInline 
                          style={{ 
                            filter: videoFilters[activeVideoFilter].filter,
                            transform: 'scaleX(-1)' // Mirror self view
                          }}
                          ref={(el) => {
                            if (el && activeCallStream) {
                              (el as HTMLVideoElement).srcObject = activeCallStream;
                              (el as HTMLVideoElement).play().catch(e => console.log("Local play failed", e));
                            }
                            // @ts-ignore
                            localVideoRef.current = el;
                          }}
                          className={cn("w-full h-full object-cover", isCameraOff && "hidden")}
                        />
                        {isCameraOff && (
                           <div className="w-full h-full flex items-center justify-center bg-indigo-900/50">
                             <User className="w-6 h-6 text-indigo-400/50" />
                           </div>
                        )}
                        <div className="absolute top-2 left-2 flex gap-1">
                          {isMuted && <MicOff className="w-3 h-3 text-red-500" />}
                        </div>
                      </motion.div>
                    )}
                    {isCallMinimized && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex flex-col justify-end p-4">
                        <div className="flex items-center justify-between w-full">
                           <div className="flex-1 min-w-0">
                             <p className="text-white font-black text-sm truncate">{calling.user.displayName}</p>
                             <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">{remoteStream ? 'Active Handshake' : 'Connecting'}</p>
                           </div>
                           <div className="flex gap-2">
                             <button onClick={toggleCallMinimize} className="p-2 bg-white/10 rounded-xl text-white hover:bg-white/20">
                               <Plus className="w-4 h-4" />
                             </button>
                             <button onClick={cleanupCall} className="p-2 bg-red-500/80 rounded-xl text-white hover:bg-red-500">
                               <PhoneOff className="w-4 h-4" />
                             </button>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {!isCallMinimized && (
                    <div className={cn(
                      "transition-all duration-500",
                      remoteStream ? "text-left w-full mt-2 sm:mt-4" : "mt-8 sm:mt-12 text-center"
                    )}>
                      <h3 className={cn(
                        "font-black tracking-tight text-white transition-all duration-500",
                        remoteStream ? "text-lg sm:text-xl" : "text-3xl sm:text-5xl mb-2 sm:mb-3"
                      )}>
                        {calling.user.displayName}
                      </h3>
                      {!remoteStream && (
                        <p className="text-indigo-300 font-bold tracking-[0.2em] sm:tracking-[0.4em] uppercase text-[8px] sm:text-[10px] opacity-60 mb-8 sm:mb-12 underline underline-offset-4 decoration-cyan-500/30">
                          {activeChat?.type === 'group' ? 'Distributed Secure Cluster' : (calling.isConnecting ? "Initiating encrypted link..." : "Signal originating from secure node")}
                        </p>
                      )}
                    </div>
                  )}

                  {!isCallMinimized && (
                    <div className={cn(
                      "flex flex-col items-center gap-6",
                      remoteStream ? "mt-4 w-full" : "mt-4"
                    )}>
                      {remoteStream && calling.type === 'video' && (
                        <div className="w-full overflow-x-auto no-scrollbar py-2">
                           <div className="flex gap-2 px-2">
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
                      
                      {isCallSettingsOpen && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 relative z-30"
                        >
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Volume2 className="w-4 h-4 text-cyan-400" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Switch Speakers / Audio Output</p>
                            </div>
                            <p className="text-[9px] text-indigo-200/50 mb-2 leading-tight">Switch between your device's internal speakers, earpiece, wired/wireless headphones, or external Bluetooth audio channels.</p>
                            
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
                              <button 
                                onClick={() => changeAudioOutput('internal_speaker')}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                                  selectedAudioDevice === 'internal_speaker' 
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 shadow-sm"
                                )}
                              >
                                <span>🔊 Speaker (Out)</span>
                              </button>
                              <button 
                                onClick={() => changeAudioOutput('earpiece')}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                                  selectedAudioDevice === 'earpiece' 
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 shadow-sm"
                                )}
                              >
                                <span>📞 Receiver (In)</span>
                              </button>
                              <button 
                                onClick={() => changeAudioOutput('headphones')}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                                  selectedAudioDevice === 'headphones' 
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 shadow-sm"
                                )}
                              >
                                <span>🎧 Headphones</span>
                              </button>
                              <button 
                                onClick={() => changeAudioOutput('bluetooth')}
                                className={cn(
                                  "px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5",
                                  selectedAudioDevice === 'bluetooth' 
                                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50" 
                                    : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 shadow-sm"
                                )}
                              >
                                <span>📶 Bluetooth</span>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                      
                      <div className={cn(
                        "flex items-center gap-6 w-full",
                        remoteStream ? "justify-between" : "justify-center"
                      )}>
                        <div className="flex gap-2">
                          <button 
                            onClick={toggleMute}
                            className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                              isMuted 
                                ? "bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/20" 
                                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                            )}
                          >
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                          </button>
                          <button 
                            onClick={toggleCamera}
                            className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                              isCameraOff 
                                ? "bg-red-500/20 border-red-500 text-red-500 shadow-lg shadow-red-500/20" 
                                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                            )}
                          >
                            {isCameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                          </button>
                          {calling.type === 'video' && (
                            <button 
                              onClick={toggleScreenShare}
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                                isScreenSharing 
                                  ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 shadow-lg shadow-cyan-500/20" 
                                  : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                              )}
                            >
                              <MonitorUp className="w-5 h-5" />
                            </button>
                          )}
                          <button 
                            onClick={() => setIsCallSettingsOpen(!isCallSettingsOpen)}
                            className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center transition-all relative border",
                              isCallSettingsOpen 
                                ? "bg-cyan-500/30 border-cyan-400 text-cyan-300" 
                                : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                            )}
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4">
                          {calling.isIncoming && !remoteStream && (
                            <button 
                              onClick={activeChat?.type === 'group' ? handleJoinGroupCall : handleAnswerCall} 
                              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-green-500/40 hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                            >
                              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                              <Phone className="w-6 h-6 sm:w-8 sm:h-8 text-white relative z-10" />
                            </button>
                          )}
                          
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
                            className={cn(
                              "rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-2xl shadow-red-500/40 hover:scale-105 active:scale-95 transition-all group overflow-hidden relative",
                              remoteStream ? "w-10 h-10 sm:w-12 sm:h-12" : "w-16 h-16 sm:w-20 sm:h-20"
                            )}
                          >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <PhoneOff className={cn("text-white transition-transform group-hover:rotate-12 relative z-10", remoteStream ? "w-4 h-4 sm:w-5 sm:h-5" : "w-6 h-6 sm:w-8 sm:h-8")} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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

        {/* App Lockout (Coming Soon) Screen - Bypassed for Authorized Roles */}
        {user && systemConfig?.appLocked && !isUserExempt && (
          <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-4 z-[9999] font-sans">
            <div className="bg-indigo-950/20 border border-indigo-500/20 p-8 sm:p-12 rounded-[40px] max-w-md w-full text-center space-y-6 shadow-2xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              
              <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto border border-indigo-500/30 animate-pulse">
                <Lock className="w-8 h-8 text-indigo-400" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-bold">Coming Soon</h1>
                <p className="text-[9px] font-mono tracking-widest text-indigo-400 uppercase">Cryptographic Node Secured</p>
              </div>
              
              <p className="text-xs text-zinc-300 leading-relaxed">
                {systemConfig?.appLockedReason || "This communication vault is currently under administrative lock and will be launching soon. Stay tuned."}
              </p>
              
              <div className="bg-black/40 border border-white/5 py-4 px-6 rounded-2xl text-center">
                <p className="text-[10px] uppercase font-black text-indigo-400 tracking-widest font-mono">Vault Hermetically Sealed</p>
                <p className="text-[9px] text-zinc-500 font-mono mt-1">Pending Release Protocol</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={logout}
                  className="w-full py-3.5 px-6 bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-wider text-xs rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Node
                </button>
              </div>
            </div>
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
                className="bg-zinc-900 border border-white/10 rounded-2xl sm:rounded-[40px] w-full max-w-5xl h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] relative text-white"
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
                    {adminActiveTab === 'users' ? (
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
                        <div className="flex-1 overflow-y-auto border border-white/5 bg-black/10 rounded-2xl sm:rounded-3xl custom-scrollbar divide-y divide-white/5">
                          {adminAllUsers
                            .filter(u => {
                              if (!adminSearchQuery.trim()) return true;
                              const queryStr = adminSearchQuery.toLowerCase();
                              return u.displayName.toLowerCase().includes(queryStr) || 
                                     u.uid.toLowerCase().includes(queryStr) || 
                                     (u.status || '').toLowerCase().includes(queryStr);
                            })
                            .map((usr) => {
                              const isUserMe = usr.uid === user?.uid;
                              const isUserBanned = usr.bannedUntil && (usr.bannedUntil === 'permanent' || new Date(usr.bannedUntil) > new Date());
                              
                              return (
                                <div key={usr.uid} className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 hover:bg-white/5 transition-all text-white border-b border-white/5 lg:border-none">
                                  {/* User Core Bio info */}
                                  <div className="flex items-start gap-3 min-w-0">
                                    <img 
                                      src={usr.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${usr.uid}`}
                                      className={cn(
                                        "w-10 h-10 rounded-full object-cover border-2 shrink-0 mt-0.5",
                                        usr.isOnline ? "border-emerald-500" : "border-zinc-700"
                                      )}
                                      referrerPolicy="no-referrer"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="text-sm font-bold text-white flex items-center gap-1 font-sans truncate">
                                          {usr.displayName}
                                          {isUserMe && <span className="text-[8px] bg-white/20 text-white font-mono uppercase px-1.5 py-0.2 rounded shrink-0">Me</span>}
                                        </h4>
                                        <UserRoleBadge role={usr.role} email={usr.email} />
                                        {isUserBanned && (
                                          <span className="text-[8px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded-full border bg-rose-600/20 border-rose-500/30 text-rose-300 shrink-0">
                                            Banned
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[10px] text-zinc-400 font-mono truncate max-w-full">UID: {usr.uid}</p>
                                      {editingUserBioId === usr.uid ? (
                                        <div className="flex items-center gap-1 mt-1">
                                          <span className="text-[10px] text-zinc-400 font-sans shrink-0">Bio:</span>
                                          <input 
                                            type="text"
                                            value={editingUserBio}
                                            onChange={(e) => setEditingUserBio(e.target.value)}
                                            className="bg-zinc-950/80 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-pink-500 w-full max-w-xs font-sans"
                                            placeholder="Enter bio..."
                                            autoFocus
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleAdminUpdateUserBio(usr.uid, editingUserBio);
                                              if (e.key === 'Escape') { setEditingUserBioId(null); setEditingUserBio(''); }
                                            }}
                                          />
                                        </div>
                                      ) : (
                                        <p 
                                          onClick={() => { setEditingUserBioId(usr.uid); setEditingUserBio(usr.status || ''); }}
                                          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors italic truncate max-w-full font-sans cursor-pointer flex items-center gap-1.5"
                                          title="Click to edit user biography"
                                        >
                                          <span>Bio: {usr.status || "No status specified."}</span>
                                          <span className="text-[8px] opacity-40 font-mono">(click to edit)</span>
                                        </p>
                                      )}
                                      {isUserBanned && (
                                        <p className="text-[9px] text-red-400 font-mono mt-0.5 uppercase tracking-wide">
                                          Restrictions Expire: {usr.bannedUntil === 'permanent' ? 'NEVER (PERMANENT)' : new Date(usr.bannedUntil!).toLocaleString()}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Administrative Operations Trigger Actions */}
                                  <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:self-center shrink-0 w-full lg:w-auto pt-2 lg:pt-0 border-t border-white/5 lg:border-t-0">
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
                                      <button
                                        onClick={() => handleAdminToggleRole(usr.uid, usr.role)}
                                        className="py-1.5 px-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-indigo-500/10 font-sans shrink-0"
                                      >
                                        Role
                                      </button>
                                    )}

                                    {/* Purge / Delete User completely */}
                                    {!isUserMe && isUserOwnerMe && (
                                      deletingUserId === usr.uid ? (
                                        <div className="flex items-center gap-1.5 bg-rose-950/45 border border-rose-500/35 px-2.5 py-1 rounded-xl shrink-0">
                                          <span className="text-[9px] text-rose-300 font-bold uppercase font-sans animate-pulse">Delete profile permanently?</span>
                                          <button
                                            onClick={() => handleAdminDeleteUser(usr.uid)}
                                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold uppercase rounded-lg transition-colors font-sans"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            onClick={() => setDeletingUserId(null)}
                                            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold uppercase rounded-lg transition-colors border border-white/5 font-sans"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setDeletingUserId(usr.uid)}
                                          className="py-1.5 px-3 bg-red-600/20 hover:bg-red-600/35 text-red-200 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-red-500/20 font-sans shrink-0 hover:border-red-500/45"
                                          title="Permanently remove user from DB directory"
                                        >
                                          Delete User
                                        </button>
                                      )
                                    )}

                                    {/* Ban Option Trigger list */}
                                    {!isUserMe && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        {isUserBanned ? (
                                          <button
                                            onClick={() => handleAdminUnbanUser(usr.uid)}
                                            className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider rounded-xl transition-all border border-emerald-500/10 font-sans"
                                          >
                                            Lift Ban
                                          </button>
                                        ) : (
                                          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
                                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest px-1 font-sans hidden sm:inline">Ban:</span>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 30)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-300 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10"
                                              title="Suspend user for 30 minutes"
                                            >
                                              30m
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 120)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-300 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10"
                                              title="Suspend user for 2 hours"
                                            >
                                              2h
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 1440)}
                                              className="py-1 px-2 bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-red-300 text-[9px] font-mono rounded-lg transition-colors border border-rose-500/10"
                                              title="Suspend user for 24 hours"
                                            >
                                              24h
                                            </button>
                                            <button 
                                              onClick={() => handleAdminBanUser(usr.uid, 'perm')}
                                              className="py-1 px-2.5 bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 hover:text-white text-[9px] font-mono rounded-lg transition-colors border border-rose-500/20 font-bold"
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
                                        <span className="text-xs font-black uppercase text-pink-400 tracking-wide font-sans">{msg.senderName}</span>
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

                        <div className="border border-white/5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-black/10 space-y-4">
                          <h3 className="text-sm font-bold uppercase tracking-wide text-white flex items-center gap-2 font-sans">
                            <Lock className="w-4 h-4 text-pink-400" />
                            Vault Lockout (Coming Soon)
                          </h3>
                          <p className="text-xs text-zinc-400 leading-relaxed font-sans">
                            Locks the application behind a "Coming Soon" lockout screen for all regular users. Note: The owner <code className="text-pink-300 font-bold bg-pink-500/10 px-1 py-0.5 rounded font-mono">koke.kozkoz@gmail.com</code> bypasses this lockout automatically.
                          </p>
                          <div className="space-y-3 pt-2">
                            <input
                              type="text"
                              value={lockoutReasonInput}
                              onChange={(e) => setLockoutReasonInput(e.target.value)}
                              placeholder="Lockout message (e.g., Launching in June! Stay tuned.)"
                              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-400 font-sans"
                            />
                            <div className="flex gap-2 items-center">
                              {systemConfig?.appLocked ? (
                                <button
                                  onClick={() => handleAdminLockApp(false)}
                                  className="py-2.5 px-5 bg-white text-zinc-950 font-bold uppercase text-xs rounded-xl hover:bg-neutral-200 transition-all shadow-md font-sans"
                                >
                                  Deactivate App Lock
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAdminLockApp(true, lockoutReasonInput)}
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
      </div>

      {/* World Cup 2026 Floating Button */}
      <FloatingWorldCupButton />

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
