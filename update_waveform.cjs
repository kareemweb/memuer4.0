const fs = require('fs');

let fileContent = fs.readFileSync('src/components/VoiceMessagePlayer.tsx', 'utf8');

const targetStr = `        {/* Progress bar / mock waveform */}
        <div className="relative w-full h-1 bg-white/20 rounded-full overflow-hidden">
          <div 
            className={\`absolute top-0 left-0 h-full rounded-full transition-all duration-100 \${
              isMe ? 'bg-cyan-300' : 'bg-indigo-300'
            }\`}
            style={{ width: \`\${totalDuration ? (currentTime / totalDuration) * 100 : 0}%\` }}
          />
        </div>`;

const replacementStr = `        {/* Progress bar / mock waveform */}
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
            className={\`absolute top-0 left-0 h-full transition-all duration-75 mix-blend-overlay \${
              isMe ? 'bg-cyan-300' : 'bg-indigo-400'
            }\`}
            style={{ width: \`\${totalDuration ? (currentTime / totalDuration) * 100 : 0}%\` }}
          />
        </div>`;

if (fileContent.includes(targetStr)) {
  fileContent = fileContent.replace(targetStr, replacementStr);
  
  // Also we need to inject the canvas ref and useEffect to draw the waveform
  const injectTarget = `  const audioRef = useRef<HTMLAudioElement | null>(null);`;
  const injectCode = `  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Generate waveform
  useEffect(() => {
    let isMounted = true;
    let audioUrl = src;
    if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
      audioUrl = \`data:audio/webm;base64,\${src}\`;
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
  }, [src, isMe]);`;
  
  fileContent = fileContent.replace(injectTarget, injectCode);
  fs.writeFileSync('src/components/VoiceMessagePlayer.tsx', fileContent, 'utf8');
  console.log('Waveform injected successfully');
} else {
  console.log('Target not found');
}
