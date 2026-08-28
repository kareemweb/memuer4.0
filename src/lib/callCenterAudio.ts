// WebAudio Helper for Call Center DTMF Tones, Hold Music Synthesizer, and Speech

export function playDTMFTone(digit: string) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Standard DTMF Frequencies (Hz)
    const frequencies: Record<string, [number, number]> = {
      '1': [697, 1209],
      '2': [697, 1336],
      '3': [697, 1477],
      '4': [770, 1209],
      '5': [770, 1336],
      '6': [770, 1477],
      '7': [852, 1209],
      '8': [852, 1336],
      '9': [852, 1477],
      '*': [941, 1209],
      '0': [941, 1336],
      '#': [941, 1477],
    };

    const freqPair = frequencies[digit];
    if (!freqPair) return;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc1.frequency.setValueAtTime(freqPair[0], now);
    osc2.frequency.setValueAtTime(freqPair[1], now);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.18);

    setTimeout(() => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        gain.disconnect();
        if (ctx.state !== 'closed') {
          ctx.close().catch(() => {});
        }
      } catch (_) {}
    }, 250);
  } catch (err) {
    console.warn('DTMF Tone generation error:', err);
  }
}

// Generates a soothing, relaxing ambient hold music synth loop using Web Audio API
export class HoldMusicSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private timeoutId: any = null;
  private activeOscillators: OscillatorNode[] = [];
  private mainGain: GainNode | null = null;
  private targetGain = 0.05;

  public start(musicStyle: string = 'chill_lounge') {
    if (this.isPlaying) return;
    this.isPlaying = true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      this.ctx = new AudioContextClass();
      
      this.scheduleNextChord();
    } catch (err) {
      console.warn('Hold music synthesizer start error:', err);
    }
  }

  public setVolume(volume: number) {
    this.targetGain = volume;
    if (this.mainGain && this.ctx) {
      try {
        const now = this.ctx.currentTime;
        this.mainGain.gain.cancelScheduledValues(now);
        this.mainGain.gain.linearRampToValueAtTime(volume, now + 0.3);
      } catch (_) {}
    }
  }

  private scheduleNextChord() {
    if (!this.isPlaying || !this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    
    // Smooth lounge chord progression: Cmaj9 -> Am9 -> Fmaj7 -> G6
    const chords = [
      [261.63, 329.63, 392.00, 493.88, 587.33], // Cmaj9
      [220.00, 261.63, 329.63, 392.00, 493.88], // Am9
      [174.61, 220.00, 261.63, 329.63, 392.00], // Fmaj7
      [196.00, 246.94, 293.66, 349.23, 440.00]  // G6
    ];

    const randomChord = chords[Math.floor(Math.random() * chords.length)];
    const duration = 3.5; // seconds per chord shift

    const mainGain = this.ctx.createGain();
    this.mainGain = mainGain;
    mainGain.gain.setValueAtTime(0.0001, now);
    mainGain.gain.linearRampToValueAtTime(this.targetGain, now + 0.8);
    mainGain.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.1);

    // Warm low-pass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.linearRampToValueAtTime(800, now + duration/2);
    filter.frequency.linearRampToValueAtTime(500, now + duration);

    mainGain.connect(filter);
    filter.connect(this.ctx.destination);

    randomChord.forEach((freq) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(mainGain);
      osc.start(now);
      osc.stop(now + duration + 0.15);
      this.activeOscillators.push(osc);
    });

    // Schedule next chord repeat
    this.timeoutId = setTimeout(() => {
      this.scheduleNextChord();
    }, (duration - 0.3) * 1000);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.mainGain && this.ctx) {
      try {
        this.mainGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
      } catch (_) {}
    }
    this.activeOscillators.forEach(osc => {
      try { 
        osc.stop();
        osc.disconnect();
      } catch (_) {}
    });
    this.activeOscillators = [];
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

// Speech Synthesizer for IVR Greetings & Prompts
export function speakIVRGreeting(text: string, lang: 'ar' | 'en' = 'ar', onEnd?: () => void) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }

  window.speechSynthesis.cancel(); // Stop any previous speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.0;
  utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
  
  if (onEnd) {
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeechSynthesis() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
