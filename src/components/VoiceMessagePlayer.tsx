import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string; // Base64 audio data or standard url
  duration?: number;
  isMe?: boolean;
}

export function VoiceMessagePlayer({ src, duration, isMe }: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Generate waveform
  useEffect(() => {
    let isMounted = true;
    let audioUrl = src;
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
      audioUrl = `data:audio/webm;base64,${src}`;
    }

    const drawWaveform = async () => {
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
        if (!isMounted) return;

        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rawData = audioBuffer.getChannelData(0);
        const samples = 60; // number of bars
        const blockSize = Math.floor(rawData.length / samples);
        const filteredData = [];
        for (let i = 0; i < samples; i++) {
          let blockStart = blockSize * i;
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum = sum + Math.abs(rawData[blockStart + j]);
          }
          filteredData.push(sum / blockSize);
        }

        const multiplier = Math.pow(Math.max(...filteredData), -1);
        const normalizedData = filteredData.map(n => n * multiplier);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = isMe ? '#67e8f9' : '#818cf8'; // cyan-300 or indigo-400
        
        const barWidth = canvas.width / samples;
        normalizedData.forEach((item, index) => {
          const height = Math.max(2, item * canvas.height);
          const y = (canvas.height - height) / 2;
          const x = index * barWidth;
          
          ctx.beginPath();
          ctx.roundRect(x + 1, y, barWidth - 2, height, 2);
          ctx.fill();
        });
      } catch (err) {
        console.warn('Waveform generation error:', err);
      }
    };

    drawWaveform();

    return () => {
      isMounted = false;
    };
  }, [src, isMe]);

  useEffect(() => {
    let audioUrl = src;
    
    // Check if the source is base64 and needs a data-uri prefix
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
      audioUrl = `data:audio/webm;base64,${src}`;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onLoadedMetadata = () => {
      if (audio.duration && !duration) {
        setTotalDuration(audio.duration);
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [src, duration]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => {
        console.error("Audio playback failed:", err);
      });
      setIsPlaying(true);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    audioRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl transition-all ${
      isMe ? 'bg-white/10 text-white' : 'bg-black/10 text-white'
    }`} style={{ minWidth: '220px' }}>
      <button 
        onClick={togglePlay}
        className={`p-2 rounded-full cursor-pointer transition-colors ${
          isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-white/10 hover:bg-white/15 text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <div className="flex-1">
        {/* Progress bar / mock waveform */}
        <div 
          className="relative w-full h-8 bg-white/10 rounded-md overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!audioRef.current || !totalDuration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            audioRef.current.currentTime = pos * totalDuration;
            setCurrentTime(pos * totalDuration);
          }}
        >
          {/* Static Waveform visualization via Canvas */}
          <canvas 
            ref={canvasRef} 
            width={150} 
            height={32} 
            className="absolute top-0 left-0 w-full h-full opacity-60"
          />
          {/* Active Overlay (Progress) */}
          <div 
            className={`absolute top-0 left-0 h-full transition-all duration-75 mix-blend-overlay ${
              isMe ? 'bg-cyan-300' : 'bg-indigo-400'
            }`}
            style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1 text-[10px] text-white/60">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(totalDuration)}</span>
        </div>
      </div>

      <button 
        onClick={toggleMute}
        className="p-1.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
