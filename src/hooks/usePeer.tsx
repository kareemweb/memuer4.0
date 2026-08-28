import { useState, useEffect, useRef } from 'react';
import Peer, { MediaConnection, DataConnection } from 'peerjs';

export function usePeer(userId?: string) {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [myPeerId, setMyPeerId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<MediaConnection | null>(null);
  const [peerError, setPeerError] = useState<string | null>(null);
  const [dataConnection, setDataConnection] = useState<DataConnection | null>(null);
  
  const streamRef = useRef<MediaStream | null>(null);
  const peerInstanceRef = useRef<Peer | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Use a unique but recognizable peer ID matching User uid Prefix
    const peerId = `${userId}_memuer_${Math.random().toString(36).slice(2, 6)}`;
    
    // Create new Peer instance using default cloud server
    const newPeer = new Peer(peerId, {
      debug: 1,
    });

    peerInstanceRef.current = newPeer;
    setPeer(newPeer);

    newPeer.on('open', (id) => {
      setMyPeerId(id);
    });

    newPeer.on('call', (call) => {
      setIncomingCall(call);
    });

    newPeer.on('connection', (conn) => {
      setDataConnection(conn);
      conn.on('data', (data) => {
        console.log('Received peer data stream:', data);
      });
    });

    newPeer.on('error', (err) => {
      console.error('PeerJS error:', err);
      setPeerError(err.message || 'Peer connection issue');
    });

    return () => {
      newPeer.destroy();
      setPeer(null);
      setMyPeerId(null);
      setIncomingCall(null);
      setDataConnection(null);
    };
  }, [userId]);

  const startCall = async (targetPeerId: string, type: 'voice' | 'video', constraints: any): Promise<{ call: MediaConnection, stream: MediaStream }> => {
    if (!peerInstanceRef.current) {
      throw new Error('Peer is not initialized');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === 'video' ? (constraints?.video || true) : false,
        audio: constraints?.audio || true
      });
      
      streamRef.current = stream;
      const call = peerInstanceRef.current.call(targetPeerId, stream);
      
      return { call, stream };
    } catch (err: any) {
      console.error('Failed to get media devices or start call:', err);
      setPeerError(err.message || 'Media acquisition failed');
      throw err;
    }
  };

  const answerCall = async (callObj: MediaConnection, constraints: any): Promise<MediaStream> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: constraints?.video !== false,
        audio: constraints?.audio || true
      });
      streamRef.current = stream;
      callObj.answer(stream);
      return stream;
    } catch (err: any) {
      console.error('Failed to answer call:', err);
      setPeerError(err.message || 'Failed to answer call');
      throw err;
    }
  };

  const connectToPeer = (targetPeerId: string) => {
    if (!peerInstanceRef.current) return;
    try {
      const conn = peerInstanceRef.current.connect(targetPeerId);
      setDataConnection(conn);
    } catch (err: any) {
      console.error('Failed to connect to peer:', err);
    }
  };

  const clearIncomingCall = () => {
    if (incomingCall) {
      incomingCall.close();
      setIncomingCall(null);
    }
  };

  const clearPeerError = () => {
    setPeerError(null);
  };

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
