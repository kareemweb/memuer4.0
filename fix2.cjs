const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');
const lines = code.split('\n');

const idx = 6453 - 1; // 6452 (0-indexed)
if (lines[idx].trim() === ') : (') {
    lines[idx] = '      ) : (';
} else if (lines[idx].trim() === ') : (') { // whatever it is
    // Wait, let's find the exact block around 6450
}
fs.writeFileSync('src/App.tsx', lines.join('\n'));
