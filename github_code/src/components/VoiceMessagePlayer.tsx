import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string;
  duration?: number;
  isMe: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  src,
  duration = 0,
  isMe
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);
  const [computedDuration, setComputedDuration] = useState(duration);

  // Generate deterministic heights for the waveform based on the source data string
  const barCount = 28;
  const waveformHeights = React.useMemo(() => {
    let hash = 0;
    const str = src || '';
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const heights: number[] = [];
    for (let i = 0; i < barCount; i++) {
      const pseudoRandom = Math.abs(Math.sin(hash + i)) * 75 + 25; // Rent-free index height (25% - 100%)
      heights.push(Math.round(pseudoRandom));
    }
    return heights;
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setComputedDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      // Pause any other playing voice messages in the document for clean UX
      const allAudios = document.querySelectorAll('audio');
      allAudios.forEach(aud => {
        if (aud !== audio) (aud as HTMLAudioElement).pause();
      });
      audio.play().catch(e => console.error("Playback error:", e));
    }
  };

  const handleSeek = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const targetFraction = index / barCount;
    const targetTime = targetFraction * (audio.duration || computedDuration || 1);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    setProgress(targetFraction);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex flex-col gap-2 min-w-[220px] sm:min-w-[260px] font-mono">
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      
      <div className="flex items-center gap-3.5 bg-black/20 hover:bg-black/30 border border-white/5 py-2 px-3 rounded-2xl transition-all duration-300">
        {/* Play & Pause Trigger Button */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/30 text-indigo-200 transition-all active:scale-95 shrink-0 focus:outline-none"
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current text-cyan-400" />
          ) : (
            <Play className="w-4 h-4 fill-current text-cyan-400 translate-x-[1px]" />
          )}
        </button>

        {/* CSS Multi-Bar Audio Activity Waveform */}
        <div className="flex items-end gap-[3px] h-10 flex-1 select-none pr-1 cursor-pointer">
          {waveformHeights.map((height, i) => {
            const barProgress = i / barCount;
            const isPlayed = barProgress <= progress;
            
            // Dynamic heights with custom bounce simulation for active/playing waveform
            const scaleFactor = isPlaying && isPlayed 
              ? 1 + Math.sin(currentTime * 8 + i) * 0.15 
              : 1;

            return (
              <div
                key={i}
                onClick={() => handleSeek(i)}
                style={{ 
                  height: `${Math.min(100, Math.max(15, height * scaleFactor))}%` 
                }}
                className={`w-[3px] rounded-full transition-all duration-150 ${
                  isPlayed 
                    ? 'bg-gradient-to-t from-cyan-400 to-indigo-400 opacity-100 shadow-[0_0_8px_rgba(34,211,238,0.3)]' 
                    : 'bg-zinc-700 opacity-60 hover:opacity-90'
                }`}
                title={`Seek to ${formatTime(barProgress * (computedDuration || 1))}`}
              />
            );
          })}
        </div>
      </div>

      {/* Meta Labels & Duration Tracker */}
      <div className="flex justify-between items-center px-1 text-[9px] uppercase tracking-wider text-zinc-400 font-sans font-semibold">
        <span className="flex items-center gap-1">
          <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
          Secure Voice
        </span>
        <span className="font-mono text-zinc-300">
          {formatTime(currentTime)} / {formatTime(computedDuration)}
        </span>
      </div>
    </div>
  );
};
