const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/chats/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('toLocaleTimeString')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
