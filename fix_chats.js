const fs = require('fs');
const path = require('path');

const filePath = 'D:/Nexora 1.0 ANTI/client/src/app/dashboard/chats/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');
const original = content;
const changes = [];

function rep(from, to, desc) {
  const before = content;
  content = content.split(from).join(to);
  if (content !== before) changes.push(desc);
}

function repRe(pattern, replacement, desc) {
  const before = content;
  content = content.replace(new RegExp(pattern, 'g'), replacement);
  if (content !== before) changes.push(desc);
}

// Fix selectedThread.color
rep('${selectedThread.color}', "${selectedThread?.color || 'from-gray-700 to-gray-900'}", 'selectedThread.color');

// Fix selectedThread.name[0]
rep('{selectedThread.name[0]}', "{selectedThread?.name?.[0] || '?'}", 'selectedThread.name[0]');

// Fix {selectedThread.name}
repRe('\\{selectedThread\\.name\\}', '{selectedThread?.name}', '{selectedThread.name}');

// Fix selectedThread.online
rep('selectedThread.online', 'selectedThread?.online', 'selectedThread.online');

// Fix selectedThread.id in JS expressions (not already chained)
repRe('selectedThread\\.id(?!\\s*===)', 'selectedThread?.id', 'selectedThread.id');

// Fix user.color in template literal
rep('${user.color}', "${user?.color || 'from-gray-700 to-gray-900'}", 'user.color');

// Fix user.name[0]
rep('{user.name[0]}', "{user?.name?.[0]}", 'user.name[0]');

// Fix user.name.split
rep('user.name.split', 'user?.name?.split', 'user.name.split');

// Fix msg.contact.color
rep('${msg.contact.color}', "${msg.contact?.color || 'from-gray-700 to-gray-900'}", 'msg.contact.color');

// Fix msg.contact.name[0]
rep('{msg.contact.name[0]}', "{msg.contact?.name?.[0] || '?'}", 'msg.contact.name[0]');

// Fix contact.color in template literals
rep('${contact.color}', "${contact?.color || 'from-gray-700 to-gray-900'}", 'contact.color');

// Fix contact.name[0]
rep('{contact.name[0]}', "{contact?.name?.[0] || '?'}", 'contact.name[0]');

// Remove SpecialAtithi/Authorized Node filter
rep(
  '.filter(t => userRole === "Authorized Node" || !t.name.includes("Clearance"))',
  '.filter(t => !t.name.includes("Clearance"))',
  'SpecialAtithi filter'
);

// Requests button
const oldBtn = `          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/dashboard/requests'}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
            View Network Requests
          </motion.button>`;
const newBtn = `          {/* requests button removed */}`;
rep(oldBtn, newBtn, 'Requests button');

// Fix blockedThreads.includes(selectedThread.id) - needs optional
rep(
  'blockedThreads.includes(selectedThread.id)',
  'blockedThreads.includes(selectedThread?.id ?? -1)',
  'blockedThreads.includes(selectedThread.id)'
);

// Fix selectedThread.name in getSharedFiles
rep(': selectedThread.name,', ': (selectedThread?.name || "Them"),', 'getSharedFiles sender');

if (content !== original) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Done! Changes:');
  changes.forEach(c => console.log(' -', c));
} else {
  console.log('No changes needed (already patched).');
}
