import { useEffect, useState, useRef, useCallback } from 'react';
import Peer from 'peerjs';

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

export function usePeer(userId: string | undefined) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [dataConnection, setDataConnection] = useState<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!userId) return;

    console.log('Initializing Peer for user:', userId);
    // Use a unique ID per session to avoid "ID taken" errors if multiple tabs are open
    // We use sessionStorage to keep the suffix stable across refreshes of the same tab
    let tabSessionId = sessionStorage.getItem('memuer_tab_id');
    if (!tabSessionId) {
      tabSessionId = Math.random().toString(36).substring(2, 6);
      sessionStorage.setItem('memuer_tab_id', tabSessionId);
    }
    
    const sessionPeerId = `${userId}_${tabSessionId}`;
    const newPeer = new Peer(sessionPeerId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      }
    });

    newPeer.on('open', (id) => {
      console.log('Peer ID opened:', id);
      setMyPeerId(id);
      setPeerError(null);
    });

    newPeer.on('disconnected', () => {
      console.log('Peer disconnected from server, attempting reconnect...');
      newPeer.reconnect();
    });

    newPeer.on('call', (call) => {
      console.log('Incoming call from:', call.peer);
      setIncomingCall((prev: any) => prev ? prev : call);
    });

    newPeer.on('connection', (conn) => {
      console.log('Incoming data connection from:', conn.peer);
      setDataConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      // Map cryptic PeerJS errors to user-friendly messages
      let friendlyMessage = err.message;
      const type = (err as any).type;
      
      if (type === 'peer-unavailable' || err.message?.includes('Could not connect to peer')) {
        friendlyMessage = "Target user is currently unavailable. They might have closed the app or have a poor connection.";
      } else if (type === 'network') {
        friendlyMessage = "Network error. Please check your internet connection.";
      } else if (type === 'server-error') {
        friendlyMessage = "Signaling server error. Retrying...";
      } else if (type === 'unavailable-id') {
        friendlyMessage = "Session ID conflict. This usually happens if you have multiple tabs open.";
      } else if (type === 'webrtc') {
        friendlyMessage = "WebRTC hardware error. Could not establish audio/video stream.";
      }
      setPeerError(friendlyMessage);
    });

    setPeer(newPeer);

    return () => {
      console.log('Destroying peer for user:', userId);
      newPeer.destroy();
    };
  }, [userId]);

  const clearIncomingCall = useCallback(() => setIncomingCall(null), []);
  const clearPeerError = useCallback(() => setPeerError(null), []);

  const startCall = useCallback(async (targetId: string, type: 'video' | 'voice', constraints?: MediaStreamConstraints): Promise<{ call: any, stream: MediaStream }> => {
    if (!peer) throw new Error("Peer not initialized");
    setPeerError(null);

    const defaultConstraints: MediaStreamConstraints = {
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      } : false,
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      },
    };

    const activeConstraints = constraints || defaultConstraints;

    try {
      let stream: MediaStream;
      if (activeConstraints.video) {
        stream = await navigator.mediaDevices.getUserMedia(activeConstraints);
      } else {
        const audioConstraints = { audio: activeConstraints.audio };
        stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        const blankTrack = createBlankVideoTrack();
        if (blankTrack) {
          stream.addTrack(blankTrack);
        }
      }
      streamRef.current = stream;
      const call = peer.call(targetId, stream);
      if (!call) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error("Could not create call object");
      }
      return { call, stream };
    } catch (err: any) {
      console.error("Primary media constraints failed, trying fallback:", err);
      try {
        const fallbackConstraints: MediaStreamConstraints = {
          video: type === 'video',
          audio: true
        };
        let stream: MediaStream;
        if (fallbackConstraints.video) {
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const blankTrack = createBlankVideoTrack();
          if (blankTrack) {
            stream.addTrack(blankTrack);
          }
        }
        streamRef.current = stream;
        const call = peer.call(targetId, stream);
        if (!call) {
          stream.getTracks().forEach(t => t.stop());
          throw new Error("Could not create call object");
        }
        return { call, stream };
      } catch (fallbackErr: any) {
        console.error("Secondary media constraints failed:", fallbackErr);
        throw new Error("Could not start audio/video. Please check your camera/microphone permissions.");
      }
    }
  }, [peer]);

  const answerCall = useCallback(async (call: any, constraints?: MediaStreamConstraints): Promise<MediaStream> => {
    if (!call) throw new Error("No call to answer");
    setPeerError(null);
    
    const defaultConstraints: MediaStreamConstraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true
      },
    };

    const activeConstraints = constraints || defaultConstraints;

    try {
      let stream: MediaStream;
      if (activeConstraints.video) {
        stream = await navigator.mediaDevices.getUserMedia(activeConstraints);
      } else {
        const audioConstraints = { audio: activeConstraints.audio };
        stream = await navigator.mediaDevices.getUserMedia(audioConstraints);
        const blankTrack = createBlankVideoTrack();
        if (blankTrack) {
          stream.addTrack(blankTrack);
        }
      }
      streamRef.current = stream;
      call.answer(stream);
      setIncomingCall(null);
      return stream;
    } catch (err: any) {
      console.error("Primary answer media constraints failed, trying fallback:", err);
      try {
        const fallbackConstraints: MediaStreamConstraints = { video: true, audio: true };
        let stream: MediaStream;
        if (fallbackConstraints.video) {
          stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const blankTrack = createBlankVideoTrack();
          if (blankTrack) {
            stream.addTrack(blankTrack);
          }
        }
        streamRef.current = stream;
        call.answer(stream);
        setIncomingCall(null);
        return stream;
      } catch (fallbackErr: any) {
        console.error("Secondary answer media constraints failed:", fallbackErr);
        throw new Error("Could not start audio/video source for answer. Please check permissions.");
      }
    }
  }, []);

  const connectToPeer = useCallback((targetId: string) => {
    if (!peer) return;
    const conn = peer.connect(targetId);
    setDataConnection(conn);
    return conn;
  }, [peer]);

  return { 
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
  };
}
