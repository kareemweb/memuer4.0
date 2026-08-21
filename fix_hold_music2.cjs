const fs = require('fs');
let fileContent = fs.readFileSync('src/components/CallCenterCallScreen.tsx', 'utf8');

// Add a ref to track if hold music is requested
if (!fileContent.includes('const shouldPlayHoldMusicRef = useRef(false);')) {
  fileContent = fileContent.replace(
    'const [isOnHold, setIsOnHold] = useState(false);',
    'const [isOnHold, setIsOnHold] = useState(false);\n  const shouldPlayHoldMusicRef = useRef(false);'
  );
}

// Modify stopHoldMusic
fileContent = fileContent.replace(
  'const stopHoldMusic = () => {',
  `const stopHoldMusic = () => {
    shouldPlayHoldMusicRef.current = false;`
);

// Modify startHoldMusic
fileContent = fileContent.replace(
  /const startHoldMusic = async \(\) => \{[\s\S]*?\n  \};\n/,
  `const startHoldMusic = async () => {
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
`
);

fs.writeFileSync('src/components/CallCenterCallScreen.tsx', fileContent, 'utf8');
console.log('Hold music ref injected');
