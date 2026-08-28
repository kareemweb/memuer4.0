import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneCall, Mic, MicOff, Play, Pause, Square, Volume2, Music, 
  Clock, User, Check, ShieldAlert, AlertTriangle, FileText, 
  PhoneOff, RefreshCw, Radio, Sparkles, Upload, Trash2, Headphones,
  Users, CheckCircle2, PhoneIncoming, MessageSquare, Globe, Settings,
  Minimize2, Maximize2, ChevronDown, ChevronUp, Disc, Download, Search, FileAudio, Delete
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, query, orderBy, limit, arrayUnion, deleteDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { HoldMusicSynthesizer, stopSpeechSynthesis } from '../lib/callCenterAudio';

import { saveAudioToFirestoreAndIDB, getAudioFromFirestoreOrIDB } from '../lib/callCenterAudioStorage';

export interface CallCenterConfigData {
  greetingAudioUrl?: string;
  greetingAudioName?: string;
  greetingAudioDuration?: number;
  greetingTextAr?: string;
  greetingTextEn?: string;
  langPromptText?: string;
  pleaseWaitTextAr?: string;
  pleaseWaitTextEn?: string;
  lateWaitTextAr?: string;
  lateWaitTextEn?: string;
  shiftOverTextAr?: string;
  shiftOverTextEn?: string;
  isClosed?: boolean;
  holdMusicKey?: string;
  customHoldMusicUrl?: string;
  customHoldMusicName?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface CallCenterCallRecord {
  id: string;
  callerUid: string;
  callerName: string;
  callerPhoto?: string;
  status: 'ringing' | 'greeting_playing' | 'selecting_option' | 'queued' | 'answered' | 'ended' | 'rejected';
  selectedLanguage?: 'ar' | 'en';
  selectedOption?: number | null; // 1 = Abuse, 2 = App Problem
  selectedOptionLabel?: string | null;
  createdAt: any;
  updatedAt?: any;
  answeredByUid?: string | null;
  answeredByName?: string | null;
  answeredAt?: any;
  endedAt?: any;
  duration?: number;
  notes?: string;
  offer?: any;
  answer?: any;
  callerCandidates?: any[];
  adminCandidates?: any[];
  isHold?: boolean;
}

export interface CallCenterRecordingRecord {
  id: string;
  callId: string;
  callerUid: string;
  callerName: string;
  callerPhoto?: string;
  answeredByUid: string;
  answeredByName: string;
  selectedOption?: number | null;
  selectedLanguage?: 'ar' | 'en';
  durationSeconds: number;
  createdAt: string;
  audioKey: string;
  notes?: string;
}

interface CallCenterAdminPanelProps {
  currentUser: UserProfile;
  isAr: boolean;
  isFloating?: boolean;
}

export function CallCenterAdminPanel({ currentUser, isAr, isFloating }: CallCenterAdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'queue' | 'greeting' | 'music' | 'prompts' | 'history' | 'recordings'>('queue');
  const [config, setConfig] = useState<CallCenterConfigData>({
    langPromptText: 'للغة العربية اضغط رقم 1, For English press 2',
    greetingTextAr: 'مرحباً بك في مركز اتصال ميمور. اضغط 1 للإبلاغ عن إساءة مستخدمين، أو اضغط 2 للإبلاغ عن مشكلة في التطبيق.',
    greetingTextEn: 'Welcome to Memuer Call Center. Press 1 for reporting user abuse, or press 2 for reporting an app problem.',
    pleaseWaitTextAr: 'الرجاء الانتظار حتى يقوم أحد أعضاء فريقنا بالرد عليك',
    pleaseWaitTextEn: 'Please wait for someone from our team to answer you',
    lateWaitTextAr: 'نعتذر عن التأخير، يرجى الانتظار',
    lateWaitTextEn: "We're sorry for being late, please wait",
    holdMusicKey: 'chill_lounge'
  });
  const [calls, setCalls] = useState<CallCenterCallRecord[]>([]);
  const [recordings, setRecordings] = useState<CallCenterRecordingRecord[]>([]);
  const [searchRecQuery, setSearchRecQuery] = useState('');
  const [playingRecId, setPlayingRecId] = useState<string | null>(null);
  const [playingAudioSrc, setPlayingAudioSrc] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Live Call Recording states
  const [isRecordingLiveCall, setIsRecordingLiveCall] = useState(true);
  const liveMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const liveAudioChunksRef = useRef<Blob[]>([]);
  const liveAudioCtxRef = useRef<AudioContext | null>(null);

  // Audio recording states for custom voice greeting
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrlPreview, setAudioUrlPreview] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Custom Waiting Music Upload states
  const [customMusicUrlPreview, setCustomMusicUrlPreview] = useState<string | null>(null);
  const [customMusicNamePreview, setCustomMusicNamePreview] = useState<string | null>(null);

  // Automated IVR Prompts text inputs
  const [langPromptInput, setLangPromptInput] = useState('');
  const [greetingTextArInput, setGreetingTextArInput] = useState('');
  const [greetingTextEnInput, setGreetingTextEnInput] = useState('');
  const [pleaseWaitArInput, setPleaseWaitArInput] = useState('');
  const [pleaseWaitEnInput, setPleaseWaitEnInput] = useState('');
  const [lateWaitArInput, setLateWaitArInput] = useState('');
  const [lateWaitEnInput, setLateWaitEnInput] = useState('');
  const [shiftOverArInput, setShiftOverArInput] = useState('');
  const [shiftOverEnInput, setShiftOverEnInput] = useState('');

  // Active call picked up by this admin
  const [activeHandledCall, setActiveHandledCall] = useState<CallCenterCallRecord | null>(null);
  const [callNotes, setCallNotes] = useState('');
  const [handledCallTimer, setHandledCallTimer] = useState(0);
  const [isAdminMuted, setIsAdminMuted] = useState(false);
  const [isAdminHold, setIsAdminHold] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);

  // Active call timer interval
  useEffect(() => {
    let interval: any = null;
    if (activeHandledCall) {
      interval = setInterval(() => {
        setHandledCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setHandledCallTimer(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeHandledCall]);

  // Real-time listener for active handled call status and hold updates
  useEffect(() => {
    if (!activeHandledCall?.id) return;
    const unsub = onSnapshot(doc(db, 'call_center_calls', activeHandledCall.id), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CallCenterCallRecord;
        if (data.status === 'ended' || data.status === 'rejected') {
          handleEndCallCleanup();
        } else {
          setIsAdminHold(!!data.isHold);
        }
      } else {
        handleEndCallCleanup();
      }
    }, (err) => {
      console.warn("Active call snapshot error:", err);
    });
    return () => unsub();
  }, [activeHandledCall?.id]);

  // WebRTC PeerConnection for live audio sound
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Hold music test player
  const holdMusicSynthRef = useRef<HoldMusicSynthesizer | null>(null);
  const [isTestingHoldMusic, setIsTestingHoldMusic] = useState(false);

  // Sync Call Center Config from Firestore & IndexedDB
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'call_center_config', 'default'), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as CallCenterConfigData;
        setConfig(data);
        setLangPromptInput(data.langPromptText || 'للغة العربية اضغط رقم 1, For English press 2');
        setGreetingTextArInput(data.greetingTextAr || 'مرحباً بك في مركز اتصال ميمور. اضغط 1 للإبلاغ عن إساءة مستخدمين، أو اضغط 2 للإبلاغ عن مشكلة في التطبيق.');
        setGreetingTextEnInput(data.greetingTextEn || 'Welcome to Memuer Call Center. Press 1 for reporting user abuse, or press 2 for reporting an app problem.');
        setPleaseWaitArInput(data.pleaseWaitTextAr || 'الرجاء الانتظار حتى يقوم أحد أعضاء فريقنا بالرد عليك');
        setPleaseWaitEnInput(data.pleaseWaitTextEn || 'Please wait for someone from our team to answer you');
        setLateWaitArInput(data.lateWaitTextAr || 'نعتذر عن التأخير، يرجى الانتظار');
        setLateWaitEnInput(data.lateWaitTextEn || "We're sorry for being late, please wait");
        setShiftOverArInput(data.shiftOverTextAr || 'نعتذر، انتهت فترة العمل لليوم. يرجى الاتصال غداً، شكراً لاتصالكم بنا.');
        setShiftOverEnInput(data.shiftOverTextEn || 'Our shift is over, please call tomorrow. Thank you for calling us.');
        
        let greetingUrl = data.greetingAudioUrl || '';
        if (!greetingUrl) {
          const syncedAudio = await getAudioFromFirestoreOrIDB('call_center_greeting_audio');
          if (syncedAudio) greetingUrl = syncedAudio;
        }
        if (greetingUrl) {
          setAudioUrlPreview(greetingUrl);
        }

        let customMusicUrl = data.customHoldMusicUrl || '';
        if (!customMusicUrl) {
          const syncedMusic = await getAudioFromFirestoreOrIDB('call_center_hold_music');
          if (syncedMusic) customMusicUrl = syncedMusic;
        }
        if (customMusicUrl) {
          setCustomMusicUrlPreview(customMusicUrl);
          setCustomMusicNamePreview(data.customHoldMusicName || 'Custom_Hold_Music.mp3');
        }
      }
    }, (err) => {
      console.warn("Call center config sync error:", err);
    });
    return () => unsub();
  }, []);

  // Sync Live Calls Queue
  const prevQueuedRef = useRef<number>(0);
  useEffect(() => {
    const q = query(
      collection(db, 'call_center_calls'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const callList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as CallCenterCallRecord);
      setCalls(callList);

      const queuedCount = callList.filter(c => c.status === 'queued').length;
      if (queuedCount > prevQueuedRef.current) {
        try {
          const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc1 = actx.createOscillator();
          const osc2 = actx.createOscillator();
          const gain = actx.createGain();
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(actx.destination);
          
          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(880, actx.currentTime);
          osc2.frequency.setValueAtTime(1108.73, actx.currentTime);
          
          gain.gain.setValueAtTime(0, actx.currentTime);
          gain.gain.linearRampToValueAtTime(0.3, actx.currentTime + 0.05);
          gain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.4);
          
          osc1.start(actx.currentTime);
          osc2.start(actx.currentTime);
          osc1.stop(actx.currentTime + 0.4);
          osc2.stop(actx.currentTime + 0.4);
        } catch (e) {}
      }
      prevQueuedRef.current = queuedCount;

      // Check if current user is handling an active call
      const myActive = callList.find(c => c.answeredByUid === currentUser.uid && c.status === 'answered');
      if (myActive) {
        setActiveHandledCall(myActive);
      } else if (activeHandledCall && !callList.some(c => c.id === activeHandledCall.id && c.status === 'answered')) {
        handleEndCallCleanup();
      }
    }, (err) => {
      console.warn("Call center queue sync error:", err);
    });
    return () => unsub();
  }, [currentUser.uid, activeHandledCall]);

  // Sync Call Center Recordings
  useEffect(() => {
    if (!db) return;
    const qRecs = query(
      collection(db, 'call_center_recordings'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubRecs = onSnapshot(qRecs, (snap) => {
      const recList = snap.docs.map(d => ({ id: d.id, ...d.data() }) as CallCenterRecordingRecord);
      setRecordings(recList);
    }, (err) => {
      console.warn("Recordings sync error:", err);
    });
    return () => unsubRecs();
  }, [db]);

  // Timer for active call handled by admin
  useEffect(() => {
    let interval: any = null;
    if (activeHandledCall) {
      interval = setInterval(() => {
        setHandledCallTimer(prev => prev + 1);
      }, 1000);
    } else {
      setHandledCallTimer(0);
    }
    return () => clearInterval(interval);
  }, [activeHandledCall]);

  // Recording handler for custom voice greeting
  const startRecordingGreeting = async () => {
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

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrlPreview(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      alert(isAr ? 'لم نتمكن من الوصول إلى الميكروفون. يرجى التحقق من الأذونات.' : 'Unable to access microphone. Please check browser permissions.');
    }
  };

  const stopRecordingGreeting = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    }
  };

  const handleFileUploadGreeting = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert(isAr ? 'حجم الملف كبير جداً (الحد الأقصى 8 ميجابايت)' : 'Audio file is too large (Max 8MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setAudioUrlPreview(result);
      setAudioBlob(null);
    };
    reader.readAsDataURL(file);
  };

  // Upload Custom Waiting/Hold Music File
  const handleFileUploadCustomMusic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert(isAr ? 'حجم الملف كبير جداً (الحد الأقصى 10 ميجابايت)' : 'Hold music file is too large (Max 10MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomMusicUrlPreview(result);
      setCustomMusicNamePreview(file.name);
    };
    reader.readAsDataURL(file);
  };

  const saveGreetingConfig = async () => {
    setSavingConfig(true);
    try {
      let finalAudioDataUrl = config.greetingAudioUrl || '';

      if (audioBlob) {
        finalAudioDataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      } else if (audioUrlPreview) {
        finalAudioDataUrl = audioUrlPreview;
      }

      // Always save full audio URL to global Firestore audio store + local IndexedDB
      if (finalAudioDataUrl) {
        await saveAudioToFirestoreAndIDB('call_center_greeting_audio', finalAudioDataUrl);
      }

      // If dataUrl is > 100KB, strip inline from config doc to avoid 1MB document error (it's fetched from call_center_audio_store)
      const firestoreGreetingUrl = finalAudioDataUrl.length > 100000 ? '' : finalAudioDataUrl;

      const updatedData: CallCenterConfigData = {
        ...config,
        greetingAudioUrl: firestoreGreetingUrl,
        greetingAudioName: audioBlob ? 'Recorded_Greeting.webm' : (config.greetingAudioName || 'Custom_Greeting.mp3'),
        greetingAudioDuration: recordingDuration || config.greetingAudioDuration || 0,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.displayName
      };

      await setDoc(doc(db, 'call_center_config', 'default'), updatedData, { merge: true });
      
      setSavedSuccessMsg(isAr ? 'تم حفظ رسالة الترحيب بنجاح!' : 'Pre-recorded message saved successfully!');
      setTimeout(() => setSavedSuccessMsg(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'call_center_config/default');
    } finally {
      setSavingConfig(false);
    }
  };

  const saveHoldMusicConfig = async (musicKey?: string) => {
    setSavingConfig(true);
    try {
      const musicDataUrl = customMusicUrlPreview || '';
      if (musicDataUrl) {
        await saveAudioToFirestoreAndIDB('call_center_hold_music', musicDataUrl);
      }

      const firestoreHoldMusicUrl = musicDataUrl.length > 100000 ? '' : musicDataUrl;

      const updated = {
        ...config,
        holdMusicKey: musicKey || config.holdMusicKey || 'custom_upload',
        customHoldMusicUrl: firestoreHoldMusicUrl,
        customHoldMusicName: customMusicNamePreview || '',
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.displayName
      };

      await setDoc(doc(db, 'call_center_config', 'default'), updated, { merge: true });
      setSavedSuccessMsg(isAr ? 'تم تحديث موسيقى الانتظار!' : 'Hold music configuration updated!');
      setTimeout(() => setSavedSuccessMsg(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'call_center_config/default');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleCallCenterStatus = async (targetClosedState?: boolean) => {
    const newClosedState = targetClosedState !== undefined ? targetClosedState : !config.isClosed;
    setSavingConfig(true);
    try {
      const updated = {
        ...config,
        isClosed: newClosedState,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.displayName || 'Admin Operator'
      };
      await setDoc(doc(db, 'call_center_config', 'default'), updated, { merge: true });
      setConfig(prev => ({ ...prev, isClosed: newClosedState }));
      const msg = newClosedState
        ? (isAr ? 'تم إغلاق مركز الاتصال (انتهت الشفت / فترة العمل)' : 'Call Center closed (shift over / offline)')
        : (isAr ? 'تم تفعيل مركز الاتصال (متاح للاتصالات الآن)' : 'Call Center is now online & accepting calls');
      setSavedSuccessMsg(msg);
      setTimeout(() => setSavedSuccessMsg(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'call_center_config/default');
    } finally {
      setSavingConfig(false);
    }
  };

  const saveIVRPromptsConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = {
        ...config,
        langPromptText: langPromptInput,
        greetingTextAr: greetingTextArInput,
        greetingTextEn: greetingTextEnInput,
        pleaseWaitTextAr: pleaseWaitArInput,
        pleaseWaitTextEn: pleaseWaitEnInput,
        lateWaitTextAr: lateWaitArInput,
        lateWaitTextEn: lateWaitEnInput,
        shiftOverTextAr: shiftOverArInput,
        shiftOverTextEn: shiftOverEnInput,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.displayName
      };

      await setDoc(doc(db, 'call_center_config', 'default'), updated, { merge: true });
      setSavedSuccessMsg(isAr ? 'تم حفظ نصوص الرد التلقائي بنجاح!' : 'Automated IVR lines saved successfully!');
      setTimeout(() => setSavedSuccessMsg(null), 3500);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'call_center_config/default');
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle Test Hold Music Synth
  const toggleTestHoldMusic = (styleKey: string) => {
    if (isTestingHoldMusic) {
      holdMusicSynthRef.current?.stop();
      setIsTestingHoldMusic(false);
    } else {
      if (!holdMusicSynthRef.current) {
        holdMusicSynthRef.current = new HoldMusicSynthesizer();
      }
      holdMusicSynthRef.current.start(styleKey);
      setIsTestingHoldMusic(true);
    }
  };

  useEffect(() => {
    return () => {
      holdMusicSynthRef.current?.stop();
      handleEndCallCleanup();
    };
  }, []);

  // Live Call Audio Recorder helper
  const startLiveCallRecording = (callRecord: CallCenterCallRecord, localStream: MediaStream | null, remoteStream?: MediaStream | null) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      liveAudioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      if (localStream && localStream.getAudioTracks().length > 0) {
        const localSource = audioCtx.createMediaStreamSource(localStream);
        localSource.connect(dest);
      }

      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      const mixedStream = dest.stream.getAudioTracks().length > 0 ? dest.stream : (localStream || new MediaStream());
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }

      const recorder = new MediaRecorder(mixedStream, { mimeType });
      liveAudioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          liveAudioChunksRef.current.push(e.data);
        }
      };

      const callIdForRec = callRecord.id;
      const callerNameForRec = callRecord.callerName || 'Anonymous Caller';
      const callerUidForRec = callRecord.callerUid || '';
      const callerPhotoForRec = callRecord.callerPhoto || '';
      const optForRec = callRecord.selectedOption || 1;
      const langForRec = callRecord.selectedLanguage || 'ar';

      recorder.onstop = async () => {
        if (liveAudioChunksRef.current.length > 0) {
          const blob = new Blob(liveAudioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64data = reader.result as string;
            if (base64data && base64data.length > 50) {
              const recId = `rec_${Date.now()}`;
              const audioKey = `call_recording_${recId}`;

              await saveAudioToFirestoreAndIDB(audioKey, base64data);

              await setDoc(doc(db, 'call_center_recordings', recId), {
                id: recId,
                callId: callIdForRec,
                callerName: callerNameForRec,
                callerUid: callerUidForRec,
                callerPhoto: callerPhotoForRec,
                answeredByName: currentUser.displayName || 'Admin Operator',
                answeredByUid: currentUser.uid,
                selectedOption: optForRec,
                selectedLanguage: langForRec,
                durationSeconds: handledCallTimer || 5,
                createdAt: new Date().toISOString(),
                audioKey,
                notes: callNotes || ''
              });
            }
          };
          reader.readAsDataURL(blob);
        }
      };

      recorder.start(1000);
      liveMediaRecorderRef.current = recorder;
      setIsRecordingLiveCall(true);
    } catch (err) {
      console.warn("Failed to initialize live MediaRecorder:", err);
    }
  };

  const stopLiveCallRecording = () => {
    if (liveMediaRecorderRef.current && liveMediaRecorderRef.current.state !== 'inactive') {
      try {
        liveMediaRecorderRef.current.stop();
      } catch (_) {}
      liveMediaRecorderRef.current = null;
    }
    if (liveAudioCtxRef.current) {
      liveAudioCtxRef.current.close().catch(() => {});
      liveAudioCtxRef.current = null;
    }
    setIsRecordingLiveCall(false);
  };

  const toggleLiveRecording = () => {
    if (isRecordingLiveCall) {
      stopLiveCallRecording();
    } else if (activeHandledCall) {
      startLiveCallRecording(activeHandledCall, localAudioStreamRef.current, null);
    }
  };

  // WebRTC PeerConnection to answer call & establish bidirectional live voice stream
  const handleAnswerCall = async (callRecord: CallCenterCallRecord) => {
    try {
      setActiveHandledCall(callRecord);
      setHandledCallTimer(0);
      setIsAdminMuted(false);
      setIsAdminHold(false);
      setIsCallMinimized(false);

      // Unlock remote audio element for autoplay permission on user click gesture
      if (remoteAudioRef.current) {
        remoteAudioRef.current.play().catch(() => {});
      }

      // 1. Get Admin Microphone stream with noise & echo cancellation
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
        video: false 
      });
      localAudioStreamRef.current = stream;

      // Start Recording live call
      startLiveCallRecording(callRecord, stream, null);

      // 2. Fetch fresh record from Firestore to get full SDP offer
      const freshSnap = await getDoc(doc(db, 'call_center_calls', callRecord.id));
      const freshCallData = freshSnap.exists() ? (freshSnap.data() as CallCenterCallRecord) : callRecord;

      // 3. Create WebRTC Peer Connection with STUN/TURN servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = pc;

      // Add local audio track
      stream.getTracks().forEach(track => {
        track.enabled = true;
        pc.addTrack(track, stream);
      });

      // Play remote caller audio track
      pc.ontrack = (event) => {
        console.log("Admin received remote audio track:", event.streams);
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.play().catch(e => console.warn("Remote audio play err:", e));
        }
      };

      // Collect Admin ICE candidates using arrayUnion
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          try {
            const candJSON = event.candidate.toJSON();
            await updateDoc(doc(db, 'call_center_calls', callRecord.id), {
              adminCandidates: arrayUnion(candJSON)
            });
          } catch (e) {
            console.warn("Error unioning admin candidate:", e);
          }
        }
      };

      const queuedCallerCandidates: any[] = [];
      const processedCandidates = new Set<string>();

      // Listen for caller ICE candidates early
      const unsubCandidates = onSnapshot(doc(db, 'call_center_calls', callRecord.id), async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.callerCandidates && data.callerCandidates.length > 0 && pc) {
            for (const cand of data.callerCandidates) {
              const key = JSON.stringify(cand);
              if (!processedCandidates.has(key)) {
                processedCandidates.add(key);
                if (pc.remoteDescription && pc.remoteDescription.type) {
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (_) {}
                } else {
                  queuedCallerCandidates.push(cand);
                }
              }
            }
          }
        }
      }, (err) => {
        console.warn("ICE candidate snapshot error:", err);
      });

      // Set Remote Description if caller offer exists
      if (freshCallData.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(freshCallData.offer));
        
        // Flush candidates that arrived during setRemoteDescription
        for (const cand of queuedCallerCandidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } catch (_) {}
        }
        queuedCallerCandidates.length = 0;

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await updateDoc(doc(db, 'call_center_calls', callRecord.id), {
          status: 'answered',
          answeredByUid: currentUser.uid,
          answeredByName: currentUser.displayName,
          answeredAt: new Date().toISOString(),
          answer: { type: answer.type, sdp: answer.sdp }
        });
      } else {
        await updateDoc(doc(db, 'call_center_calls', callRecord.id), {
          status: 'answered',
          answeredByUid: currentUser.uid,
          answeredByName: currentUser.displayName,
          answeredAt: new Date().toISOString()
        });
      }

    } catch (err) {
      console.error("Error answering call with WebRTC:", err);
      handleFirestoreError(err, OperationType.UPDATE, `call_center_calls/${callRecord.id}`);
    }
  };

  const handleEndCallCleanup = () => {
    stopSpeechSynthesis();
    stopLiveCallRecording();
    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach(t => t.stop());
      localAudioStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setActiveHandledCall(null);
  };

  // Admin Ends call
  const handleEndCallByAdmin = async (callId: string) => {
    handleEndCallCleanup();
    try {
      await updateDoc(doc(db, 'call_center_calls', callId), {
        status: 'ended',
        endedAt: new Date().toISOString(),
        duration: handledCallTimer,
        notes: callNotes
      });
      setCallNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `call_center_calls/${callId}`);
    }
  };

  const toggleAdminMute = () => {
    if (localAudioStreamRef.current) {
      const audioTrack = localAudioStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAdminMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleAdminHold = async () => {
    if (!activeHandledCall) return;
    const newHoldState = !isAdminHold;
    setIsAdminHold(newHoldState);
    try {
      await updateDoc(doc(db, 'call_center_calls', activeHandledCall.id), {
        isHold: newHoldState,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn("Error toggling call hold:", err);
    }
  };

  const waitingCalls = calls.filter(c => c.status === 'queued' || c.status === 'greeting_playing' || c.status === 'selecting_option');
  const answeredCalls = calls.filter(c => c.status === 'answered');
  const historyCalls = calls.filter(c => c.status === 'ended' || c.status === 'rejected');

  return (
    <div className="space-y-6 text-slate-100 font-sans">
      {/* Hidden Audio Element for WebRTC Live Remote Caller Sound */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-rose-950/80 via-white/5/90 to-indigo-950/80 border border-rose-500/30 backdrop-blur-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 shrink-0">
            <Headphones className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-white tracking-wide">
                {isAr ? 'مركز الاتصال والخدمات | Memuer Call Center' : 'Memuer Call Center Control Panel'}
              </h2>
              <button
                onClick={() => handleToggleCallCenterStatus()}
                disabled={savingConfig}
                className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all cursor-pointer shadow-md ${
                  config.isClosed
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30'
                }`}
                title={isAr ? 'اضغط لتغيير حالة المركز (متاح / انتهت الشفت)' : 'Click to toggle call center availability status'}
              >
                <span className={`w-2 h-2 rounded-full ${config.isClosed ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-ping'}`} />
                <span>
                  {config.isClosed
                    ? (isAr ? '🔴 مغلق (انتهت الشفت)' : '🔴 Closed (Shift Over)')
                    : (isAr ? '🟢 مباشر 24/7 (متاح)' : '🟢 Active (Online)')}
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {isAr ? 'إدارة رسائل الترحيب المسجلة، رفع موسيقى الانتظار، وتخصيص جميع نصوص الرد التلقائي' : 'Manage IVR pre-recorded audio, upload custom hold music, and customize all automated lines'}
            </p>
          </div>
        </div>

        {/* Live Call Alert Badge */}
        {waitingCalls.length > 0 && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-4 py-2 bg-rose-500/20 border border-rose-500/40 rounded-xl flex items-center gap-3 text-rose-300 text-xs font-bold shadow-lg shadow-rose-500/20 animate-pulse"
          >
            <PhoneIncoming className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {isAr ? `هناك ${waitingCalls.length} مكالمة في الانتظار الآن!` : `${waitingCalls.length} incoming call(s) waiting in queue!`}
            </span>
            <button
              onClick={() => setActiveTab('queue')}
              className="px-3 py-1 bg-rose-500 text-white rounded-lg text-[10px] font-black uppercase hover:bg-rose-400 transition-colors cursor-pointer"
            >
              {isAr ? 'استجابة' : 'Answer'}
            </button>
          </motion.div>
        )}
      </div>

      {savedSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedSuccessMsg}</span>
        </motion.div>
      )}

      {/* Tabs Bar */}
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('queue')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'queue'
              ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/20'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <PhoneCall className="w-4 h-4" />
          <span>{isAr ? 'طابور المكالمات المباشرة' : 'Live Call Queue'}</span>
          {waitingCalls.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-white text-rose-600 text-[10px] font-black">
              {waitingCalls.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'prompts'
              ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{isAr ? 'نصوص الرد والتوجيه الآلي (Automated Lines)' : 'Automated IVR Lines'}</span>
        </button>

        <button
          onClick={() => setActiveTab('greeting')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'greeting'
              ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/20'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Mic className="w-4 h-4" />
          <span>{isAr ? 'تسجيل الترحيب الصوتي' : 'Pre-recorded Greetings'}</span>
        </button>

        <button
          onClick={() => setActiveTab('music')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'music'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Music className="w-4 h-4" />
          <span>{isAr ? 'موسيقى الانتظار والرفع' : 'Hold / Waiting Music'}</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-slate-700 to-slate-800 text-white'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>{isAr ? 'سجل المكالمات' : 'Call History & Logs'}</span>
        </button>

        <button
          onClick={() => setActiveTab('recordings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'recordings'
              ? 'bg-gradient-to-r from-pink-600 to-rose-700 text-white shadow-lg shadow-pink-500/20'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          <Disc className="w-4 h-4 text-pink-400 animate-spin" />
          <span>{isAr ? 'تسجيلات المكالمات (Recordings)' : 'Call Recordings'}</span>
          {recordings.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-pink-500/30 text-red-300 text-[10px] font-black border border-pink-500/40">
              {recordings.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LIVE CALL QUEUE & ACTIVE CALL CONSOLE */}
      {activeTab === 'queue' && (
        <div className="space-y-6">
          {/* Active Call In Progress by this Admin */}
          {activeHandledCall && !isCallMinimized && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-2xl bg-gradient-to-b from-white/5 to-slate-950 border-2 border-emerald-500/50 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    {isAr ? 'مكالمة صوتية مباشرة قيد الإجراء' : 'Active Live Voice Call in Progress'}
                  </span>
                  {isAdminHold && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase flex items-center gap-1 animate-pulse">
                      <Pause className="w-3 h-3 text-amber-400" />
                      {isAr ? 'قيد الانتظار (Hold)' : 'On Hold'}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-xl font-mono font-bold text-white bg-slate-800/80 px-3 py-1 rounded-xl border border-white/10">
                    {Math.floor(handledCallTimer / 60)}:{(handledCallTimer % 60).toString().padStart(2, '0')}
                  </span>
                  <button
                    onClick={() => setIsCallMinimized(true)}
                    title={isAr ? 'تصغير شاشة المكالمة' : 'Minimize Call Window'}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/15 transition-all cursor-pointer flex items-center gap-1 text-xs font-bold"
                  >
                    <Minimize2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{isAr ? 'تصغير' : 'Minimize'}</span>
                  </button>
                </div>
              </div>

              {isAdminHold && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
                  <Pause className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>
                    {isAr 
                      ? 'المكالمة معلقة الآن في وضع الانتظار (يتم تشغيل موسيقى الانتظار للمتصل)' 
                      : 'Call is currently placed on hold (Hold music is playing for the caller)'}
                  </span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-pink-600 flex items-center justify-center font-bold text-white text-lg overflow-hidden border border-white/20 shrink-0">
                    {activeHandledCall.callerPhoto ? (
                      <img src={activeHandledCall.callerPhoto} alt="" className="w-full h-full object-cover" />
                    ) : (
                      activeHandledCall.callerName.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      {activeHandledCall.callerName}
                      <span className="px-2 py-0.5 rounded bg-pink-500/20 text-indigo-300 text-[10px] font-bold uppercase">
                        {activeHandledCall.selectedLanguage === 'en' ? 'English' : 'عربي'}
                      </span>
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/30">
                        {activeHandledCall.selectedOption === 1 
                          ? (isAr ? 'خيار 1: إبلاغ عن إساءة مستخدمين' : 'Option 1: Abuse Report') 
                          : (isAr ? 'خيار 2: مشكلة في التطبيق' : 'Option 2: App Problem')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={toggleAdminMute}
                    title={isAdminMuted ? 'Unmute Mic' : 'Mute Mic'}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      isAdminMuted 
                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                        : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isAdminMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    <span>{isAdminMuted ? (isAr ? 'إلغاء الكتم' : 'Unmute') : (isAr ? 'كتم' : 'Mute')}</span>
                  </button>

                  <button
                    onClick={toggleAdminHold}
                    title={isAdminHold ? 'Resume Call' : 'Put on Hold'}
                    className={`px-4 py-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      isAdminHold 
                        ? 'bg-amber-500/30 border-amber-500/50 text-amber-300 shadow-lg shadow-amber-500/20 animate-pulse' 
                        : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {isAdminHold ? <Play className="w-4 h-4 text-amber-300" /> : <Pause className="w-4 h-4 text-amber-400" />}
                    <span>{isAdminHold ? (isAr ? 'استئناف المكالمة' : 'Resume') : (isAr ? 'وضع بالانتظار' : 'Hold')}</span>
                  </button>

                  <button
                    onClick={toggleLiveRecording}
                    title={isRecordingLiveCall ? (isAr ? 'إيقاف التسجيل المباشر' : 'Stop Live Recording') : (isAr ? 'بدء تسجيل المكالمة' : 'Start Recording Call')}
                    className={`px-3 py-3 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                      isRecordingLiveCall 
                        ? 'bg-pink-500/20 border-pink-500/50 text-red-300 shadow-lg shadow-pink-500/20 animate-pulse' 
                        : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/20'
                    }`}
                  >
                    <Radio className={`w-4 h-4 ${isRecordingLiveCall ? 'text-pink-400 animate-ping' : 'text-slate-400'}`} />
                    <span>{isRecordingLiveCall ? (isAr ? 'REC تسجيل جارٍ' : 'REC Recording') : (isAr ? 'تسجيل' : 'Record')}</span>
                  </button>

                  <button
                    onClick={() => handleEndCallByAdmin(activeHandledCall.id)}
                    className="px-5 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-pink-600/30 transition-all"
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{isAr ? 'إنهاء المكالمة' : 'End Call'}</span>
                  </button>
                </div>
              </div>

              {/* Call Notes input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-pink-400" />
                  <span>{isAr ? 'ملاحظات المكالمة' : 'Call Admin Notes'}</span>
                </label>
                <textarea
                  rows={2}
                  placeholder={isAr ? 'أدخل تفاصيل وملاحظات الاستجابة للمستخدم...' : 'Enter details or outcome notes regarding this caller...'}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-400 font-sans"
                />
              </div>
            </motion.div>
          )}

          {/* Waiting Calls List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <PhoneIncoming className="w-4 h-4 text-rose-400" />
              <span>{isAr ? 'المكالمات القادمة وفي الانتظار' : 'Incoming & Queued Calls'}</span>
              <span className="text-xs text-slate-500 font-normal">({waitingCalls.length})</span>
            </h3>

            {waitingCalls.length === 0 ? (
              <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl space-y-2">
                <PhoneCall className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400 font-medium">
                  {isAr ? 'لا توجد مكالمات واردة حالياً. جميع الخطوط متاحة.' : 'No incoming calls currently waiting in queue. Lines are ready.'}
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {waitingCalls.map((call) => (
                  <motion.div
                    key={call.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl bg-white/5/90 border border-rose-500/30 flex items-center justify-between gap-4 shadow-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center font-bold text-rose-300">
                        {call.callerName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          {call.callerName}
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                          <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-bold text-slate-300 uppercase">
                            {call.selectedLanguage || 'ar'}
                          </span>
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="text-rose-400 font-bold">
                            {call.selectedOption === 1 
                              ? (isAr ? 'خيار 1: بلاغ إساءة' : 'Option 1: Abuse Report') 
                              : call.selectedOption === 2 
                                ? (isAr ? 'خيار 2: مشكلة بالتطبيق' : 'Option 2: App Problem')
                                : (isAr ? 'يختار اللغة والخدمة...' : 'Selecting language & IVR menu...')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAnswerCall(call)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{isAr ? 'الرد والتحدث مباشرة' : 'Pick Up & Talk Live'}</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Answered Calls by Other Admins */}
          {answeredCalls.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/10">
              <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'مكالمات قيد التحدث مع مسؤولين آخرين' : 'Ongoing Calls handled by Admins'}</span>
              </h3>
              <div className="grid gap-2">
                {answeredCalls.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-bold text-white">{c.callerName}</span>
                      <span className="text-slate-400">({c.selectedOptionLabel || 'Call Center'})</span>
                    </div>
                    <span className="text-slate-400 font-mono">
                      {isAr ? 'يجري التحدث مع: ' : 'Handled by: '} <strong className="text-emerald-300">{c.answeredByName}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUTOMATED IVR PROMPTS & LINES EDITOR */}
      {activeTab === 'prompts' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-5">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>{isAr ? 'تعديل وتخصيص نصوص الجمل الآلية (Automated Lines)' : 'Edit Automated IVR Lines & Prompts'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr ? 'يمكنك هنا تغيير جميع الجمل الصوتية التي يستمع إليها المتصل عند الاتصال بالمركز.' : 'Customize every automated speech prompt played during caller interactive menu steps.'}
              </p>
            </div>

            {/* 1. Language Selection Prompt Line */}
            <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 space-y-2">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <span>1. {isAr ? 'جملة اختيار اللغة (تظهر أولاً عند الاتصال):' : 'Language Selection Prompt (Played first):'}</span>
              </label>
              <input
                type="text"
                value={langPromptInput}
                onChange={(e) => setLangPromptInput(e.target.value)}
                placeholder="للغة العربية اضغط رقم 1, For English press 2"
                className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-sans"
              />
            </div>

            {/* 2. Arabic & English Main Greeting Lines */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-black/40 border border-purple-500/20 space-y-2">
                <label className="text-xs font-bold text-purple-300">
                  2.a {isAr ? 'جملة القائمة الرئيسية باللغة العربية (خيارات 1 و 2):' : 'Arabic Menu Greeting (Options 1 & 2):'}
                </label>
                <textarea
                  rows={3}
                  value={greetingTextArInput}
                  onChange={(e) => setGreetingTextArInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-sans"
                />
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-purple-500/20 space-y-2">
                <label className="text-xs font-bold text-purple-300">
                  2.b {isAr ? 'جملة القائمة الرئيسية باللغة الإنجليزية:' : 'English Menu Greeting:'}
                </label>
                <textarea
                  rows={3}
                  value={greetingTextEnInput}
                  onChange={(e) => setGreetingTextEnInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-sans"
                />
              </div>
            </div>

            {/* 3. Please Wait Confirmation Message (after selecting option) */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-black/40 border border-cyan-500/20 space-y-2">
                <label className="text-xs font-bold text-cyan-300">
                  3.a {isAr ? 'جملة تأكيد الاختيار وبدء الانتظار (بالعربي):' : 'Please Wait Confirmation Message (Arabic):'}
                </label>
                <input
                  type="text"
                  value={pleaseWaitArInput}
                  onChange={(e) => setPleaseWaitArInput(e.target.value)}
                  placeholder="الرجاء الانتظار حتى يقوم أحد أعضاء فريقنا بالرد عليك"
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-cyan-500/20 space-y-2">
                <label className="text-xs font-bold text-cyan-300">
                  3.b {isAr ? 'جملة تأكيد الاختيار (بالإنجليزي):' : 'Please Wait Confirmation Message (English):'}
                </label>
                <input
                  type="text"
                  value={pleaseWaitEnInput}
                  onChange={(e) => setPleaseWaitEnInput(e.target.value)}
                  placeholder="Please wait for someone from our team to answer you"
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>
            </div>

            {/* 4. Late Waiting Update Message (After 1 minute of waiting) */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 space-y-2">
                <label className="text-xs font-bold text-rose-300">
                  4.a {isAr ? 'جملة اعتذار التأخير بعد دقيقة انتظار (بالعربي):' : 'Late Waiting Apology Message (1 min wait) (Arabic):'}
                </label>
                <input
                  type="text"
                  value={lateWaitArInput}
                  onChange={(e) => setLateWaitArInput(e.target.value)}
                  placeholder="نعتذر عن التأخير، يرجى الانتظار"
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-sans"
                />
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-rose-500/20 space-y-2">
                <label className="text-xs font-bold text-rose-300">
                  4.b {isAr ? 'جملة اعتذار التأخير بعد دقيقة (بالإنجليزي):' : 'Late Waiting Apology Message (English):'}
                </label>
                <input
                  type="text"
                  value={lateWaitEnInput}
                  onChange={(e) => setLateWaitEnInput(e.target.value)}
                  placeholder="We're sorry for being late, please wait"
                  className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-sans"
                />
              </div>
            </div>

            {/* 5. Shift Over / Closed Call Center Message */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-rose-950/40 to-white/5 border border-rose-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-rose-300 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-400" />
                  <span>5. {isAr ? 'رسالة انتهاء فترة العمل / إغلاق المركز (Our shift is over prompt):' : 'Closing / Shift Over Message (Played when closed):'}</span>
                </label>
                <button
                  onClick={() => handleToggleCallCenterStatus()}
                  disabled={savingConfig}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer ${
                    config.isClosed 
                      ? 'bg-rose-500 text-white border-rose-400' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  {config.isClosed ? (isAr ? 'حالة المركز: مغلق 🔴' : 'Status: Closed 🔴') : (isAr ? 'حالة المركز: متاح 🟢' : 'Status: Active 🟢')}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">{isAr ? 'النص العربي عند الاتصال في وقت الإغلاق:' : 'Arabic text when caller dials during closed hours:'}</label>
                  <textarea
                    rows={2}
                    value={shiftOverArInput}
                    onChange={(e) => setShiftOverArInput(e.target.value)}
                    placeholder="نعتذر، انتهت فترة العمل لليوم. يرجى الاتصال غداً، شكراً لاتصالكم بنا."
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">{isAr ? 'النص الإنجليزي عند الاتصال في وقت الإغلاق:' : 'English text when caller dials during closed hours:'}</label>
                  <textarea
                    rows={2}
                    value={shiftOverEnInput}
                    onChange={(e) => setShiftOverEnInput(e.target.value)}
                    placeholder="Our shift is over, please call tomorrow. Thank you for calling us."
                    className="w-full bg-white/5 border border-white/15 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-sans"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={saveIVRPromptsConfig}
              disabled={savingConfig}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{savingConfig ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ نصوص الجمل الآلية' : 'Save IVR Lines Settings')}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: PRE-RECORDED GREETING MESSAGE MANAGER */}
      {activeTab === 'greeting' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-purple-400" />
              <span>{isAr ? 'تسجيل أو رفع ملف الترحبب الصوتي (Custom Voice Greeting)' : 'Record or Upload Voice Greeting'}</span>
            </h3>

            {/* Microphone Recorder Box */}
            <div className="p-6 rounded-2xl bg-black/40 border border-purple-500/20 text-center space-y-4">
              <div className="flex justify-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all ${
                  isRecording 
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse scale-110' 
                    : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                }`}>
                  <Mic className="w-10 h-10" />
                </div>
              </div>

              {isRecording ? (
                <div className="space-y-2">
                  <span className="text-xl font-mono font-bold text-rose-400">
                    00:{recordingDuration.toString().padStart(2, '0')}
                  </span>
                  <p className="text-xs text-rose-300 font-bold animate-pulse">
                    {isAr ? 'جاري التسجيل الآن... تحدث بصوت واضح' : 'Recording live voice... speak clearly into mic'}
                  </p>
                  <button
                    onClick={stopRecordingGreeting}
                    className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-2 mx-auto cursor-pointer shadow-lg shadow-rose-600/30"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>{isAr ? 'إيقاف التسجيل' : 'Stop Recording'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={startRecordingGreeting}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 mx-auto cursor-pointer shadow-lg shadow-purple-500/20"
                  >
                    <Mic className="w-4 h-4" />
                    <span>{isAr ? 'بدء تسجيل جديد من الميكروفون' : 'Start Recording Voice Greeting'}</span>
                  </button>

                  <div className="flex items-center justify-center gap-2 text-slate-500 text-xs">
                    <span>{isAr ? 'أو' : 'or'}</span>
                    <label className="text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isAr ? 'رفع ملف صوتي جاهز' : 'Upload Audio File'}</span>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileUploadGreeting} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Audio Preview Player */}
              {audioUrlPreview && (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-2 max-w-md mx-auto">
                  <span className="text-xs font-bold text-purple-300 block">
                    {isAr ? 'معاينة الرسالة الصوتية الحالية:' : 'Current Recorded Message Preview:'}
                  </span>
                  <audio 
                    src={audioUrlPreview} 
                    controls 
                    className="w-full h-10 rounded-lg" 
                  />
                </div>
              )}
            </div>

            <button
              onClick={saveGreetingConfig}
              disabled={savingConfig}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{savingConfig ? (isAr ? 'جاري الحفظ...' : 'Saving...') : (isAr ? 'حفظ إعدادات الرسالة المسجلة' : 'Save Greeting Settings')}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 4: HOLD MUSIC & CUSTOM MUSIC UPLOAD MANAGER */}
      {activeTab === 'music' && (
        <div className="space-y-6">
          {/* Custom Hold Music File Upload Box */}
          <div className="p-5 rounded-2xl bg-white/5 border border-cyan-500/30 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-cyan-400" />
              <span>{isAr ? 'رفع ملف موسيقى انتظار خاص (Custom Hold Music Upload)' : 'Upload Custom Hold Music File'}</span>
            </h3>
            <p className="text-xs text-slate-400">
              {isAr ? 'يمكنك رفع ملف صوني (MP3/WAV) ليتم تشغيله كـموسيقى انتظار للمتصلين.' : 'Upload an MP3/WAV audio track to play as custom hold music for waiting callers.'}
            </p>

            <div className="p-6 rounded-2xl bg-black/40 border border-cyan-500/20 text-center space-y-4">
              <label className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:opacity-90 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20">
                <Upload className="w-4 h-4" />
                <span>{isAr ? 'اختر ملف موسيقى من جهازك (MP3/WAV)' : 'Choose Hold Music File (MP3/WAV)'}</span>
                <input 
                  type="file" 
                  accept="audio/*" 
                  onChange={handleFileUploadCustomMusic} 
                  className="hidden" 
                />
              </label>

              {customMusicUrlPreview && (
                <div className="p-4 bg-cyan-950/30 rounded-xl border border-cyan-500/30 space-y-2 max-w-md mx-auto">
                  <span className="text-xs font-bold text-cyan-300 block">
                    {isAr ? `الملف المحدد: ${customMusicNamePreview}` : `Selected Custom Track: ${customMusicNamePreview}`}
                  </span>
                  <audio 
                    src={customMusicUrlPreview} 
                    controls 
                    className="w-full h-10 rounded-lg" 
                  />
                  <button
                    onClick={() => saveHoldMusicConfig('custom_upload')}
                    disabled={savingConfig}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 mx-auto cursor-pointer shadow-md shadow-cyan-500/30"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isAr ? 'اعتماد كـموسيقى الانتظار الرئيسية' : 'Set as Default Hold Music'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Built-in Synthesizer Ambient Tones */}
          <div className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Music className="w-5 h-5 text-cyan-400" />
              <span>{isAr ? 'أو اختر نغمة انتظار رقمية هادئة' : 'Or Select Built-in Ambient Synth Tone'}</span>
            </h3>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { key: 'chill_lounge', title: isAr ? 'تشيل لاونج (أنغام هادئة)' : 'Chill Lounge Chords', desc: isAr ? 'نغمات Cmaj9 و Fmaj7 استرخائية عالية الجودة' : 'Relaxing Cmaj9 & Fmaj7 synthesized warmth' },
                { key: 'lofi_vibes', title: isAr ? 'لوفاي سينث ببيس' : 'Lofi Synth Vibes', desc: isAr ? 'إيقاع دافئ ومريح للأذن' : 'Smooth mellow acoustic wave synthesizer' },
                { key: 'soft_piano', title: isAr ? 'بيانو كلاسيكي ناعم' : 'Soft Classic Piano', desc: isAr ? 'موسيقى كلاسيكية هادئة أثناء الانتظار' : 'Gentle soothing piano chords' },
                { key: 'classic_synth', title: isAr ? 'سينثسايزر حديث' : 'Modern Ambient Wave', desc: isAr ? 'نغمات رقمية حديثة وراقية' : 'Modern, pristine digital background chord loop' }
              ].map((style) => (
                <div
                  key={style.key}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    config.holdMusicKey === style.key 
                      ? 'bg-cyan-500/10 border-cyan-400/50 shadow-lg shadow-cyan-500/10' 
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{style.title}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{style.desc}</p>
                    </div>
                    {config.holdMusicKey === style.key && (
                      <span className="px-2 py-0.5 rounded bg-cyan-400 text-slate-950 text-[10px] font-black uppercase">
                        {isAr ? 'محدد' : 'Active'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => toggleTestHoldMusic(style.key)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-cyan-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>{isTestingHoldMusic ? (isAr ? 'إيقاف التجربة' : 'Stop Test') : (isAr ? 'تجربة الصوت' : 'Listen Test')}</span>
                    </button>

                    <button
                      onClick={() => saveHoldMusicConfig(style.key)}
                      disabled={savingConfig || config.holdMusicKey === style.key}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer disabled:opacity-40"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isAr ? 'اعتماد' : 'Select'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CALL HISTORY LOGS */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-pink-400" />
            <span>{isAr ? 'سجل المكالمات السابقة والمستجابة' : 'Historical Call Logs'}</span>
          </h3>

          {historyCalls.length === 0 ? (
            <div className="p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10 text-xs text-slate-400">
              {isAr ? 'لا توجد مكالمات منتهية في السجل بعد.' : 'No completed call records in history yet.'}
            </div>
          ) : (
            <div className="grid gap-2">
              {historyCalls.map((h) => (
                <div key={h.id} className="p-4 rounded-xl bg-white/5 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{h.callerName}</span>
                      <span className="px-2 py-0.5 rounded bg-white/10 text-slate-300 text-[10px] font-mono">
                        {h.selectedOption === 1 
                          ? (isAr ? 'إساءة مستخدمين' : 'Abuse Report') 
                          : (isAr ? 'مشكلة بالتطبيق' : 'App Problem')}
                      </span>
                    </div>
                    {h.notes && (
                      <p className="text-slate-400 mt-1 italic">
                        "{h.notes}"
                      </p>
                    )}
                  </div>

                  <div className="text-right text-slate-400 font-mono">
                    <div>{isAr ? 'المسؤول:' : 'Admin:'} <strong className="text-indigo-300">{h.answeredByName || 'N/A'}</strong></div>
                    <div>{isAr ? 'المدة:' : 'Duration:'} {h.duration || 0}s</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: CALL RECORDINGS GALLERY & PLAYBACK */}
      {activeTab === 'recordings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-pink-950/40 to-white/5 border border-pink-500/30">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Disc className="w-5 h-5 text-pink-400 animate-pulse" />
                <span>{isAr ? 'تسجيلات المكالمات المسجلة' : 'Call Center Recorded Conversations'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {isAr ? 'يتم حفظ كافة المكالمات المستجابة تلقائياً بشكل مشفر ومتاح للتشغيل والتنزيل.' : 'All answered calls are automatically recorded, encrypted, and accessible for listening or downloading.'}
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={isAr ? 'بحث باسم المتصل...' : 'Search caller...'}
                value={searchRecQuery}
                onChange={(e) => setSearchRecQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-400 font-sans"
              />
            </div>
          </div>

          {recordings.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <FileAudio className="w-10 h-10 text-slate-500 mx-auto animate-bounce" />
              <p className="text-sm font-bold text-slate-300">
                {isAr ? 'لا توجد تسجيلات مكالمات حتى الآن' : 'No recorded calls available yet'}
              </p>
              <p className="text-xs text-slate-500">
                {isAr ? 'عند إجراء مكالمة هاتفية مع أي متصل ستظهر التسجيلات الصوتية هنا تلقائياً.' : 'When live operator calls take place, their audio recordings will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recordings
                .filter(r => !searchRecQuery || (r.callerName || '').toLowerCase().includes(searchRecQuery.toLowerCase()))
                .map((rec) => (
                  <motion.div
                    key={rec.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      playingRecId === rec.id
                        ? 'bg-gradient-to-b from-pink-950/60 to-white/5 border-pink-500/60 shadow-xl shadow-pink-500/10'
                        : 'bg-white/5/90 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center font-bold text-white text-sm overflow-hidden border border-white/20 shrink-0">
                          {rec.callerPhoto ? (
                            <img src={rec.callerPhoto} alt="" className="w-full h-full object-cover" />
                          ) : (
                            rec.callerName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white flex items-center gap-2">
                            {rec.callerName}
                            <span className="px-2 py-0.5 rounded bg-pink-500/20 text-indigo-300 text-[10px] font-bold uppercase">
                              {rec.selectedLanguage === 'en' ? 'EN' : 'AR'}
                            </span>
                          </h4>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(rec.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={async () => {
                            if (playingRecId === rec.id) {
                              setPlayingRecId(null);
                              setPlayingAudioSrc(null);
                              return;
                            }
                            try {
                              setLoadingAudioId(rec.id);
                              const audioData = await getAudioFromFirestoreOrIDB(rec.audioKey);
                              if (audioData) {
                                setPlayingAudioSrc(audioData);
                                setPlayingRecId(rec.id);
                              } else {
                                alert(isAr ? 'تعذر العثور على ملف الصوت' : 'Audio recording file not found');
                              }
                            } catch (err) {
                              console.error("Failed to load recording:", err);
                            } finally {
                              setLoadingAudioId(null);
                            }
                          }}
                          disabled={loadingAudioId === rec.id}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1 text-xs font-bold ${
                            playingRecId === rec.id
                              ? 'bg-pink-500 text-white border-pink-400 shadow-lg shadow-pink-500/30'
                              : 'bg-white/10 text-slate-200 hover:bg-white/20 border-white/15'
                          }`}
                        >
                          {loadingAudioId === rec.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                          ) : playingRecId === rec.id ? (
                            <>
                              <Pause className="w-4 h-4" />
                              <span>{isAr ? 'إيقاف' : 'Pause'}</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-4 h-4 text-emerald-400" />
                              <span>{isAr ? 'تشغيل' : 'Play'}</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={async () => {
                            if (window.confirm(isAr ? 'هل أنت تأكد من حذف هذا التسجيل؟' : 'Delete this call recording?')) {
                              try {
                                await deleteDoc(doc(db, 'call_center_recordings', rec.id));
                                if (playingRecId === rec.id) {
                                  setPlayingRecId(null);
                                  setPlayingAudioSrc(null);
                                }
                              } catch (e) {
                                console.warn("Error deleting rec:", e);
                              }
                            }
                          }}
                          title={isAr ? 'حذف التسجيل' : 'Delete Recording'}
                          className="p-2.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-400 border border-pink-500/30 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10 font-mono">
                      <div>
                        {isAr ? 'المسؤول النائب:' : 'Operator:'} <span className="text-indigo-300 font-bold">{rec.answeredByName}</span>
                      </div>
                      <div>
                        {isAr ? 'المدة:' : 'Duration:'} <span className="text-emerald-400 font-bold">{rec.durationSeconds || 0}s</span>
                      </div>
                    </div>

                    {playingRecId === rec.id && playingAudioSrc && (
                      <div className="pt-2 animate-fadeIn">
                        <audio src={playingAudioSrc} controls autoPlay className="w-full h-9 rounded-lg" />
                      </div>
                    )}
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Floating Minimized Call Bar Dock for Admin */}
      <AnimatePresence>
        {activeHandledCall && isCallMinimized && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 bg-white/5/95 border-2 border-emerald-500/70 shadow-2xl shadow-emerald-500/20 backdrop-blur-2xl rounded-2xl p-3.5 flex items-center gap-3.5 text-white font-sans max-w-sm"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-pink-600 flex items-center justify-center font-bold text-white overflow-hidden border border-white/20 shrink-0">
                {activeHandledCall.callerPhoto ? (
                  <img src={activeHandledCall.callerPhoto} alt="" className="w-full h-full object-cover" />
                ) : (
                  activeHandledCall.callerName.charAt(0).toUpperCase()
                )}
              </div>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white/5 animate-ping" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-white truncate">{activeHandledCall.callerName}</h4>
                {isAdminHold && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase border border-amber-500/30 shrink-0">
                    {isAr ? 'انتظار' : 'HOLD'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 font-bold mt-0.5">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>{Math.floor(handledCallTimer / 60)}:{(handledCallTimer % 60).toString().padStart(2, '0')}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleAdminMute}
                title={isAr ? 'كتم الميكروفون' : 'Mute Mic'}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isAdminMuted ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                }`}
              >
                {isAdminMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={toggleAdminHold}
                title={isAdminHold ? (isAr ? 'استئناف المكالمة' : 'Resume Call') : (isAr ? 'إيقاف مؤقت' : 'Put on Hold')}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isAdminHold ? 'bg-amber-500/30 border-amber-500/50 text-amber-300 animate-pulse' : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
                }`}
              >
                {isAdminHold ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsCallMinimized(false)}
                title={isAr ? 'توسيع نافذة المكالمة' : 'Maximize Call Window'}
                className="p-2 rounded-xl bg-pink-600/80 hover:bg-pink-500 text-white border border-pink-400/30 transition-all cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleEndCallByAdmin(activeHandledCall.id)}
                title={isAr ? 'إنهاء المكالمة' : 'End Call'}
                className="p-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white transition-all cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
