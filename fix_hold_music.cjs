const fs = require('fs');

let fileContent = fs.readFileSync('src/components/CallCenterCallScreen.tsx', 'utf8');

const targetStr = `  // Start Hold / Waiting Music (Custom uploaded audio or synthesized loop)
  const startHoldMusic = async () => {
    let customUrl = config.customHoldMusicUrl;
    if (config.holdMusicKey === 'custom_upload') {
      if (!customUrl) {
        customUrl = await getAudioFromFirestoreOrIDB('call_center_hold_music') || '';
      }
      if (customUrl) {
        const audio = new Audio(customUrl);
        audio.loop = true;
        audio.volume = 0.5;
        holdMusicAudioRef.current = audio;
        audio.play().catch(e => console.warn("Custom hold music play error:", e));
        return;
      }
    }`;

const replacementStr = `  // Start Hold / Waiting Music (Custom uploaded audio or synthesized loop)
  const startHoldMusic = async () => {
    const currentPhase = phaseRef.current;
    let customUrl = config.customHoldMusicUrl;
    if (config.holdMusicKey === 'custom_upload') {
      if (!customUrl) {
        customUrl = await getAudioFromFirestoreOrIDB('call_center_hold_music') || '';
      }
      // Check if phase changed while awaiting
      if (phaseRef.current !== currentPhase && phaseRef.current !== 'queued') {
        // If not on hold and not queued anymore, don't start
        if (!(phaseRef.current === 'connected' && isOnHold)) {
           return;
        }
      }
      if (customUrl) {
        const audio = new Audio(customUrl);
        audio.loop = true;
        audio.volume = 0.5;
        
        // Prevent race condition where stopHoldMusic was called before audio fetched
        if (phaseRef.current === 'ended' || (phaseRef.current === 'connected' && !isOnHold)) {
          return;
        }
        
        holdMusicAudioRef.current = audio;
        audio.play().catch(e => console.warn("Custom hold music play error:", e));
        return;
      }
    }`;

if (fileContent.includes(targetStr)) {
  fileContent = fileContent.replace(targetStr, replacementStr);
  fs.writeFileSync('src/components/CallCenterCallScreen.tsx', fileContent, 'utf8');
  console.log('Fix applied successfully');
} else {
  console.log('Target not found');
}
