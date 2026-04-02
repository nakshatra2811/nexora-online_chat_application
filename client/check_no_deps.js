const fs = require('fs');
const content = fs.readFileSync('src/app/dashboard/chats/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.includes('useEffect(') && !line.includes('],')) {
        // Potential loop if it doesn't end with []);
        console.log(`Potential Loop at line ${index+1}: ${line.trim()}`);
        // Print next 5 lines
        for(let i=1; i<=10; i++) {
            if(lines[index+i]) console.log(`  ${index+1+i}: ${lines[index+i].trim()}`);
        }
    }
});
