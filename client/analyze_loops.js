const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/chats/page.tsx', 'utf8');
const lines = content.split('\n');
let insideEffect = false;
let currentEffectStart = 0;
lines.forEach((line, index) => {
    if (line.includes('useEffect(() => {')) {
        insideEffect = true;
        currentEffectStart = index + 1;
    }
    if (insideEffect) {
        if (line.includes('setThreads(') || line.includes('setMessages(')) {
            console.log(`Effect starting on line ${currentEffectStart} calls setter on line ${index+1}: ${line.trim()}`);
        }
    }
    if (line.includes('}, [') || line.includes('}, []);') || line.includes('});')) {
        insideEffect = false;
    }
});
