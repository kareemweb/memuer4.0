import React, { useState, useEffect, useRef } from 'react';
import { 
  PhoneOff, Mic, MicOff, Volume2, VolumeX, Headphones, 
  Clock, ShieldAlert, AlertTriangle, Sparkles, PhoneIncoming, Radio, Check, Globe, Pause, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import { UserProfile } from '../types';
import { playDTMFTone, HoldMusicSynthesizer, speakIVRGreeting, stopSpeechSynthesis } from '../lib/callCenterAudio';
import { getAudioFromFirestoreOrIDB } from '../lib/callCenterAudioStorage';
import { CallCenterConfigData, CallCenterCallRecord } from './CallCenterAdminPanel';

interface CallCenterCallScreenProps {
  currentUser: UserProfile;
  isAr: boolean;
  onClose: () => void;
}

export function CallCenterCallScreen({ currentUser, isAr, onClose }: CallCenterCallScreenProps) {
  const [callId, setCallId] = useState<string | null>(null);
  const [callRecord, setCallRecord] = useState<CallCenterCallRecord | null>(null);
  const [config, setConfig] = useState<CallCenterConfigData>({});

  // Call Flow Phases:
  // 'connecting' -> 'lang_select' -> 'greeting' -> 'dialpad' -> 'please_wait' -> 'queued' -> 'connected' -> 'shift_over' -> 'ended'
  const [phase, setPhase] = useState<'connecting' | 'lang_select' | 'greeting' | 'dialpad' | 'please_wait' | 'queued' | 'connected' | 'shift_over' | 'ended'>('connecting');
  
  const [selectedLanguage, setSelectedLanguage] = useState<'ar' | 'en'>('ar');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [callTimer, setCallTimer] = useState(0);
  const [queueTimer, setQueueTimer] = useState(0);
  const [hasPlayedLateMessage, setHasPlayedLateMessage] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const shouldPlayHoldMusicRef = useRef(false);

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Active call timer when connected
  useEffect(() => {
    let interval: any = null;
    if (phase === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase]);

  // WebRTC Peer Connection & Media Streams
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio elements
  const greetingAudioRef = useRef<HTMLAudioElement | null>(null);
  const holdMusicAudioRef = useRef<HTMLAudioElement | null>(null);
  const holdMusicSynthRef = useRef<HoldMusicSynthesizer | null>(null);

  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const queuedAdminCandidatesRef = useRef<any[]>([]);
  const processedAdminCandidatesRef = useRef<Set<string>>(new Set());

  // Sync Call Center Config from Firestore & IndexedDB
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'call_center_config', 'default'), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CallCenterConfigData;
        let greetingAudioUrl = data.greetingAudioUrl || '';
        const syncedAudio = await getAudioFromFirestoreOrIDB('call_center_greeting_audio');
        if (syncedAudio) greetingAudioUrl = syncedAudio;

        let customHoldMusicUrl = data.customHoldMusicUrl || '';
        const syncedMusic = await getAudioFromFirestoreOrIDB('call_center_hold_music');
        if (syncedMusic) customHoldMusicUrl = syncedMusic;

        setConfig({
          ...data,
          greetingAudioUrl,
          customHoldMusicUrl
        });

        // If Call Center is marked as closed / shift over while call is active or starting
        if (data.isClosed && phaseRef.current !== 'shift_over' && phaseRef.current !== 'ended') {
          stopSpeechSynthesis();
          stopHoldMusic();
          if (greetingAudioRef.current) greetingAudioRef.current.pause();

          setPhase('shift_over');
          const textToSpeak = isAr
            ? (data.shiftOverTextAr || 'نعتذر، انتهت فترة العمل لليوم. يرجى الاتصال غداً، شكراً لاتصالكم بنا.')
            : (data.shiftOverTextEn || 'Our shift is over, please call tomorrow. Thank you for calling us.');
          
          speakIVRGreeting(textToSpeak, isAr ? 'ar' : 'en');
        }
      }
    }, (err) => {
      console.warn("Call center config sync error:", err);
    });
    return () => unsub();
  }, [isAr]);

  // Initialize WebRTC Call Session
  useEffect(() => {
    const newCallId = `call_${Date.now()}_${currentUser.uid.slice(0, 5)}`;
    setCallId(newCallId);

    const setupCall = async () => {
      try {
        // First check if Call Center is marked as closed / shift over
        const configSnap = await getDoc(doc(db, 'call_center_config', 'default'));
        if (configSnap.exists()) {
          const cfgData = configSnap.data() as CallCenterConfigData;
          if (cfgData.isClosed) {
            setConfig(cfgData);
            setPhase('shift_over');
            const textToSpeak = isAr
              ? (cfgData.shiftOverTextAr || 'نعتذر، انتهت فترة العمل لليوم. يرجى الاتصال غداً، شكراً لاتصالكم بنا.')
              : (cfgData.shiftOverTextEn || 'Our shift is over, please call tomorrow. Thank you for calling us.');
            speakIVRGreeting(textToSpeak, isAr ? 'ar' : 'en');
            
            // Auto end call after announcement finishes
            setTimeout(() => {
              handleHangUp();
            }, 6500);
            return;
          }
        }

        // Get local microphone stream for real voice communication
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, 
          video: false 
        });
        localStreamRef.current = stream;

        // Create WebRTC PeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        });
        peerConnectionRef.current = pc;

        // Add local microphone audio track to connection
        stream.getTracks().forEach(track => {
          track.enabled = true;
          pc.addTrack(track, stream);
        });

        // Handle remote stream from Admin
        pc.ontrack = (event) => {
          console.log("Caller received remote track from Admin:", event.streams);
          if (remoteAudioRef.current && event.streams[0]) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.muted = false;
            remoteAudioRef.current.play().catch(e => console.warn("Caller remote audio play error:", e));
          }
        };

        // Collect Caller ICE Candidates using arrayUnion
        pc.onicecandidate = async (event) => {
          if (event.candidate) {
            try {
              const candJSON = event.candidate.toJSON();
              await updateDoc(doc(db, 'call_center_calls', newCallId), {
                callerCandidates: arrayUnion(candJSON)
              });
            } catch (e) {
              console.warn("Error unioning caller candidate:", e);
            }
          }
        };

        // Create WebRTC Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const initialRecord: CallCenterCallRecord = {
          id: newCallId,
          callerUid: currentUser.uid,
          callerName: currentUser.displayName,
          callerPhoto: currentUser.photoURL || '',
          status: 'ringing',
          createdAt: new Date().toISOString(),
          offer: { type: offer.type, sdp: offer.sdp }
        };

        await setDoc(doc(db, 'call_center_calls', newCallId), initialRecord);
        setCallRecord(initialRecord);
        setPhase('lang_select');
      } catch (err) {
        console.warn("Failed to capture mic or init WebRTC:", err);
        // Fallback initial record without mic if user denied mic
        const initialRecord: CallCenterCallRecord = {
          id: newCallId,
          callerUid: currentUser.uid,
          callerName: currentUser.displayName,
          callerPhoto: currentUser.photoURL || '',
          status: 'ringing',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'call_center_calls', newCallId), initialRecord);
        setCallRecord(initialRecord);
        setPhase('lang_select');
      }
    };

    setupCall();

    return () => {
      cleanupAllAudioAndRTC();
    };
  }, [currentUser.uid]);

  // Sync Call Status & WebRTC Signaling from Firestore
  useEffect(() => {
    if (!callId) return;
    const unsub = onSnapshot(doc(db, 'call_center_calls', callId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data() as CallCenterCallRecord;
        setCallRecord(data);

        // When Admin answers, handle WebRTC Answer SDP & Hold status
        if (data.status === 'answered') {
          stopSpeechSynthesis();
          if (greetingAudioRef.current) greetingAudioRef.current.pause();

          if (data.answer && peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'stable') {
            try {
              await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              // Flush queued candidates
              for (const cand of queuedAdminCandidatesRef.current) {
                try {
                  await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              }
              queuedAdminCandidatesRef.current = [];
            } catch (err) {
              console.warn("Error setting remote answer SDP:", err);
            }
          }

          setPhase('connected');

          if (data.isHold) {
            setIsOnHold(true);
            startHoldMusic();
            if (remoteAudioRef.current) {
              remoteAudioRef.current.pause();
            }
          } else {
            setIsOnHold(false);
            stopHoldMusic();
            if (remoteAudioRef.current) {
              remoteAudioRef.current.play().catch(e => console.warn("Caller remote audio play error:", e));
            }
          }
        } else if (data.status === 'ended' || data.status === 'rejected') {
          cleanupAllAudioAndRTC();
          setPhase('ended');
        }

        // Process Admin Candidates safely
        if (data.adminCandidates && data.adminCandidates.length > 0 && peerConnectionRef.current) {
          const pc = peerConnectionRef.current;
          for (const cand of data.adminCandidates) {
            const key = JSON.stringify(cand);
            if (!processedAdminCandidatesRef.current.has(key)) {
              processedAdminCandidatesRef.current.add(key);
              if (pc.remoteDescription && pc.remoteDescription.type) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (e) {
                  console.warn("Error adding admin ICE candidate:", e);
                }
              } else {
                queuedAdminCandidatesRef.current.push(cand);
              }
            }
          }
        }
      }
    }, (err) => {
      console.warn("Call status signaling snapshot error:", err);
    });
    return () => unsub();
  }, [callId]);

  // Step 1: Speak Language Prompt ("Press 1 for Arabic, Press 2 for English")
  useEffect(() => {
    if (phase !== 'lang_select') return;

    const langText = config.langPromptText || 'للغة العربية اضغط رقم 1, For English press 2';
    speakIVRGreeting(langText, 'ar', () => {
      // Stay on language selection screen until user presses 1 or 2
    });
  }, [phase, config.langPromptText]);

  // Handle Language Choice (1 = Arabic, 2 = English)
  const handleSelectLanguage = async (langChoice: 1 | 2) => {
    playDTMFTone(langChoice.toString());
    stopSpeechSynthesis();
    const lang = langChoice === 1 ? 'ar' : 'en';
    setSelectedLanguage(lang);

    if (callId) {
      try {
        await updateDoc(doc(db, 'call_center_calls', callId), {
          selectedLanguage: lang,
          status: 'greeting_playing'
        });
      } catch (_) {}
    }

    setPhase('greeting');
  };

  // Step 2: Play Menu Greeting in Chosen Language
  useEffect(() => {
    if (phase !== 'greeting') return;

    if (config.greetingAudioUrl && selectedLanguage === 'ar') {
      // Play custom pre-recorded audio file if available
      const audio = new Audio(config.greetingAudioUrl);
      greetingAudioRef.current = audio;
      audio.play().catch(() => {
        speakGreetingText();
      });

      audio.onended = () => {
        setPhase('dialpad');
      };
    } else {
      speakGreetingText();
    }

    function speakGreetingText() {
      const text = selectedLanguage === 'ar' 
        ? (config.greetingTextAr || 'مرحباً بك في مركز اتصال ميمور. اضغط 1 للإبلاغ عن إساءة مستخدمين، أو اضغط 2 للإبلاغ عن مشكلة في التطبيق.')
        : (config.greetingTextEn || 'Welcome to Memuer Call Center. Press 1 for reporting user abuse, or press 2 for reporting an app problem.');
      
      speakIVRGreeting(text, selectedLanguage, () => {
        setPhase('dialpad');
      });
    }
  }, [phase, selectedLanguage, config.greetingAudioUrl, config.greetingTextAr, config.greetingTextEn]);

  // Step 3: Handle Option Selection (1 = Abuse Report, 2 = App Problem)
  const handleSelectOption = async (optionNum: number) => {
    playDTMFTone(optionNum.toString());
    setSelectedOption(optionNum);
    stopSpeechSynthesis();
    if (greetingAudioRef.current) {
      greetingAudioRef.current.pause();
    }

    const label = optionNum === 1 
      ? (selectedLanguage === 'ar' ? 'بلاغ عن إساءة مستخدمين' : 'User Abuse Report')
      : (selectedLanguage === 'ar' ? 'مشكلة في التطبيق' : 'App Problem');

    setPhase('please_wait');

    // Update Firestore Call Record
    if (callId) {
      try {
        await updateDoc(doc(db, 'call_center_calls', callId), {
          status: 'queued',
          selectedOption: optionNum,
          selectedOptionLabel: label,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `call_center_calls/${callId}`);
      }
    }

    // Speak "Please wait for someone from our team to answer you"
    const pleaseWaitMsg = selectedLanguage === 'ar'
      ? (config.pleaseWaitTextAr || 'الرجاء الانتظار حتى يقوم أحد أعضاء فريقنا بالرد عليك')
      : (config.pleaseWaitTextEn || 'Please wait for someone from our team to answer you');

    speakIVRGreeting(pleaseWaitMsg, selectedLanguage, () => {
      // Once confirmation message finishes speaking, move to queued phase & start hold music
      setPhase('queued');
      startHoldMusic();
    });
  };

  const duckHoldMusic = () => {
    if (holdMusicAudioRef.current) {
      holdMusicAudioRef.current.volume = 0.05;
    }
    if (holdMusicSynthRef.current) {
      holdMusicSynthRef.current.setVolume(0.005);
    }
  };

  const restoreHoldMusic = () => {
    if (holdMusicAudioRef.current) {
      holdMusicAudioRef.current.volume = 0.5;
    }
    if (holdMusicSynthRef.current) {
      holdMusicSynthRef.current.setVolume(0.05);
    }
  };

  // Start Hold / Waiting Music (Custom uploaded audio or synthesized loop)
  const startHoldMusic = async () => {
    shouldPlayHoldMusicRef.current = true;
    let customUrl = config.customHoldMusicUrl;
    if (config.holdMusicKey === 'custom_upload') {
      if (!customUrl) {
        customUrl = await getAudioFromFirestoreOrIDB('call_center_hold_music') || '';
      }
      if (customUrl) {
        // Prevent race condition: if stop was called while we were awaiting
        if (!shouldPlayHoldMusicRef.current) return;
        
        const audio = new Audio(customUrl);
        audio.loop = true;
        audio.volume = 0.5;
        
        holdMusicAudioRef.current = audio;
        audio.play().catch(e => console.warn("Custom hold music play error:", e));
        return;
      }
    }
    
    if (!shouldPlayHoldMusicRef.current) return;

    if (!holdMusicSynthRef.current) {
      holdMusicSynthRef.current = new HoldMusicSynthesizer();
    }
    holdMusicSynthRef.current.start(config.holdMusicKey || 'chill_lounge');
  };

  const stopHoldMusic = () => {
    shouldPlayHoldMusicRef.current = false;
    if (holdMusicAudioRef.current) {
      try {
        holdMusicAudioRef.current.pause();
        holdMusicAudioRef.current.currentTime = 0;
      } catch (_) {}
      holdMusicAudioRef.current = null;
    }
    if (holdMusicSynthRef.current) {
      holdMusicSynthRef.current.stop();
      holdMusicSynthRef.current = null;
    }
  };

  // Queue Timer and 1-Minute Update Message ("We're sorry for being late, please wait")
  useEffect(() => {
    let interval: any = null;
    if (phase === 'queued') {
      interval = setInterval(() => {
        setQueueTimer(prev => {
          const nextVal = prev + 1;
          
          // When waiting time reaches 60 seconds (1 minute), duck volume and speak apology line
          if (nextVal === 60 && !hasPlayedLateMessage) {
            setHasPlayedLateMessage(true);
            duckHoldMusic();
            
            const lateMsg = selectedLanguage === 'ar'
              ? (config.lateWaitTextAr || 'نعتذر عن التأخير، يرجى الانتظار')
              : (config.lateWaitTextEn || "We're sorry for being late, please wait");

            speakIVRGreeting(lateMsg, selectedLanguage, () => {
              if (phaseRef.current === 'queued') {
                restoreHoldMusic();
              } else {
                stopHoldMusic();
              }
            });
          }

          return nextVal;
        });
        setCallTimer(prev => prev + 1);
      }, 1000);
    } else if (phase === 'connected') {
      interval = setInterval(() => {
        setCallTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phase, selectedLanguage, config, hasPlayedLateMessage]);

  // Clean up all streams and WebAudio components cleanly (ZERO BEEP)
  const cleanupAllAudioAndRTC = () => {
    stopSpeechSynthesis();
    stopHoldMusic();

    if (greetingAudioRef.current) {
      greetingAudioRef.current.pause();
      greetingAudioRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  // Hang up / End Call
  const handleHangUp = async () => {
    cleanupAllAudioAndRTC();

    if (callId) {
      try {
        await updateDoc(doc(db, 'call_center_calls', callId), {
          status: 'ended',
          endedAt: new Date().toISOString(),
          duration: callTimer
        });
      } catch (err) {
        console.warn("Error updating ended call state:", err);
      }
    }

    setPhase('ended');
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  const toggleMuteMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-4"
    >
      {/* Hidden Audio Tag for Remote Live Voice Audio from Admin */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-950 to-black border border-rose-500/30 rounded-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Glow ambient background circles */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        {/* Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold font-mono">
          <Headphones className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          <span>memuer-call center</span>
        </div>

        {/* Profile Avatar / Call Visualizer */}
        <div className="relative mx-auto w-28 h-28 flex items-center justify-center">
          {(phase === 'greeting' || phase === 'queued' || phase === 'connected') && (
            <motion.div 
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 blur-xl pointer-events-none"
            />
          )}

          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-600 via-purple-700 to-indigo-800 border-2 border-white/20 flex items-center justify-center text-white text-3xl font-black shadow-xl relative z-10">
            <Headphones className="w-12 h-12 text-white" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-black text-white tracking-wide">
            Memuer Call Center
          </h2>
          <p className="text-xs text-rose-300 font-medium mt-1">
            {isAr ? 'خط دعم وإدارة الحسابات الرسمية' : 'Official Admins & Owners Support Line'}
          </p>
        </div>

        {/* PHASE STATUS MESSAGES & INTERACTIVE DIAL PAD */}
        <div className="min-h-[160px] flex flex-col items-center justify-center space-y-3">
          {phase === 'connecting' && (
            <div className="space-y-2">
              <div className="w-6 h-6 border-2 border-rose-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400 animate-pulse">
                {isAr ? 'جاري الاتصال بمركز الخدمة...' : 'Connecting to Call Center line...'}
              </p>
            </div>
          )}

          {/* STEP 1: LANGUAGE SELECTION (Press 1 for Arabic, Press 2 for English) */}
          {phase === 'lang_select' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 w-full"
            >
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-300 font-bold">
                <Globe className="w-4 h-4 text-amber-400 animate-spin" />
                <span>{config.langPromptText || 'للغة العربية اضغط رقم 1, For English press 2'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto pt-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectLanguage(1)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/30 border-2 border-amber-500/50 hover:border-amber-400 flex flex-col items-center gap-1 cursor-pointer shadow-lg shadow-amber-500/10"
                >
                  <span className="text-2xl font-black font-mono text-amber-300">1</span>
                  <span className="text-xs font-bold text-white">العربية (Press 1)</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectLanguage(2)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/30 border-2 border-indigo-500/50 hover:border-indigo-400 flex flex-col items-center gap-1 cursor-pointer shadow-lg shadow-indigo-500/10"
                >
                  <span className="text-2xl font-black font-mono text-indigo-300">2</span>
                  <span className="text-xs font-bold text-white">English (Press 2)</span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: MAIN MENU GREETING PLAYING */}
          {phase === 'greeting' && (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs text-purple-300 font-bold">
                <Radio className="w-4 h-4 text-purple-400 animate-ping" />
                <span>
                  {selectedLanguage === 'ar' ? 'جاري استماع الرسالة الترحيبية...' : 'Playing Menu Greeting...'}
                </span>
              </div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {selectedLanguage === 'ar' 
                  ? 'يرجى الاستماع للرسالة ثم اختيار الخيار المطلوب' 
                  : 'Please listen to the recording then choose an option below.'}
              </p>
              <button
                onClick={() => setPhase('dialpad')}
                className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[11px] text-purple-300 rounded-lg font-bold transition-colors cursor-pointer"
              >
                {selectedLanguage === 'ar' ? 'الانتقال لقائمة الأرقام مباشرة' : 'Skip to Dial Menu'}
              </button>
            </div>
          )}

          {/* STEP 2 DIAL PAD (1: Abuse, 2: App Problem) */}
          {(phase === 'dialpad' || phase === 'greeting') && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 w-full"
            >
              <p className="text-xs font-bold text-rose-300">
                {selectedLanguage === 'ar' 
                  ? 'اختر سبب الاتصال بالضغط على الرقم المناسب:' 
                  : 'Choose a reason by dialing option 1 or 2:'}
              </p>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectOption(1)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-600/30 border-2 border-rose-500/50 hover:border-rose-400 flex flex-col items-center gap-1.5 cursor-pointer shadow-lg shadow-rose-500/10"
                >
                  <span className="text-2xl font-black font-mono text-rose-300">1</span>
                  <span className="text-[11px] font-bold text-white text-center leading-tight">
                    {selectedLanguage === 'ar' ? 'إبلاغ عن إساءة أشخاص' : 'Abuse from People'}
                  </span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelectOption(2)}
                  className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border-2 border-cyan-500/50 hover:border-cyan-400 flex flex-col items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/10"
                >
                  <span className="text-2xl font-black font-mono text-cyan-300">2</span>
                  <span className="text-[11px] font-bold text-white text-center leading-tight">
                    {selectedLanguage === 'ar' ? 'مشكلة في التطبيق' : 'App Problem'}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: PLEASE WAIT CONFIRMATION */}
          {phase === 'please_wait' && (
            <div className="space-y-2">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-cyan-300 font-bold max-w-xs mx-auto animate-pulse">
                {selectedLanguage === 'ar'
                  ? (config.pleaseWaitTextAr || 'الرجاء الانتظار حتى يقوم أحد أعضاء فريقنا بالرد عليك')
                  : (config.pleaseWaitTextEn || 'Please wait for someone from our team to answer you')}
              </p>
            </div>
          )}

          {/* STEP 4: QUEUED IN LINE WITH MUSIC */}
          {phase === 'queued' && (
            <div className="space-y-3">
              <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 mx-auto w-fit">
                <Clock className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span>
                  {selectedLanguage === 'ar' ? 'قيد الانتظار في الطابور...' : 'Waiting in Queue for Admin...'}
                </span>
              </span>

              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                {selectedLanguage === 'ar' 
                  ? 'جاري إشعار جميع المشرفين والمالكين وتشغيل موسيقى الانتظار...' 
                  : 'Notifying active Admins & Owners. Playing waiting music...'}
              </p>

              <div className="text-lg font-mono font-bold text-cyan-300 bg-slate-900/80 px-4 py-1.5 rounded-xl border border-white/10 w-fit mx-auto">
                {Math.floor(callTimer / 60)}:{(callTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}

          {/* CONNECTED WITH ADMIN VIA LIVE WEBRTC SOUND */}
          {phase === 'connected' && (
            <div className="space-y-4 w-full">
              {isOnHold ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-center space-y-3 shadow-lg shadow-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-300">
                    <Pause className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-amber-300">
                      {selectedLanguage === 'ar' ? 'المكالمة معلقة في وضع الانتظار' : 'Call Placed On Hold'}
                    </h4>
                    <p className="text-xs text-amber-200/80 mt-1">
                      {selectedLanguage === 'ar' 
                        ? 'قام المسؤول بوضع المكالمة في الانتظار مؤقتاً، يرجى البقاء على الخط...' 
                        : 'Representative has put the call on hold. Please stay on line...'}
                    </p>
                  </div>
                  
                  {/* Bouncing audio wave bars */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ['8px', '22px', '8px'] }}
                        transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
                        className="w-1.5 bg-amber-400 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-2 mx-auto w-fit shadow-lg shadow-emerald-500/10">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>
                      {selectedLanguage === 'ar' 
                        ? `متصل صوتاً مع المسؤول: ${callRecord?.answeredByName || ''}` 
                        : `Live Connected with Admin: ${callRecord?.answeredByName || ''}`}
                    </span>
                  </div>

                  {/* Audio visualizer wave */}
                  <div className="flex items-center justify-center gap-1.5 py-1">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ height: ['10px', '28px', '10px'] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                        className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-300 rounded-full"
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              <div className="text-xl font-mono font-bold text-emerald-400 bg-emerald-950/50 px-5 py-1.5 rounded-2xl border border-emerald-500/30 w-fit mx-auto shadow-md">
                {Math.floor(callTimer / 60)}:{(callTimer % 60).toString().padStart(2, '0')}
              </div>
            </div>
          )}

          {phase === 'ended' && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-400">
                {selectedLanguage === 'ar' ? 'تم إنهاء المكالمة' : 'Call Ended'}
              </p>
            </div>
          )}

          {/* SHIFT OVER / CALL CENTER CLOSED PHASE */}
          {phase === 'shift_over' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-4 w-full py-2"
            >
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/20">
                <Clock className="w-8 h-8 animate-pulse text-rose-400" />
              </div>

              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-black uppercase tracking-wider">
                  {isAr ? 'انتهت فترة العمل' : 'Shift Over / Center Closed'}
                </span>
                <p className="text-sm font-bold text-white max-w-xs mx-auto leading-relaxed pt-1">
                  {isAr 
                    ? (config.shiftOverTextAr || 'نعتذر، انتهت فترة العمل لليوم. يرجى الاتصال غداً، شكراً لاتصالكم بنا.')
                    : (config.shiftOverTextEn || 'Our shift is over, please call tomorrow. Thank you for calling us.')}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleHangUp}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-lg shadow-rose-600/30 flex items-center gap-2 mx-auto cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>{isAr ? 'إنهاء المكالمة' : 'End Call'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* BOTTOM CALL ACTION CONTROLS */}
        <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/10">
          <button
            onClick={toggleMuteMic}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              isMuted 
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
            }`}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            onClick={handleHangUp}
            className="p-4 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-xl shadow-red-600/40 transition-all cursor-pointer scale-110"
          >
            <PhoneOff className="w-6 h-6" />
          </button>

          <button
            onClick={() => setIsSpeakerOn(!isSpeakerOn)}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              !isSpeakerOn 
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' 
                : 'bg-white/10 border-white/15 text-slate-200 hover:bg-white/20'
            }`}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
