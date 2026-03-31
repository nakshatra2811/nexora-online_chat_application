const fs = require('fs');
const filePath = 'D:/Nexora 1.0 ANTI/client/src/app/dashboard/chats/page.tsx';
let content = fs.readFileSync(filePath, 'utf8');
const changes = [];

// 1. Add nexoraFetch import if not present
if (!content.includes('import { nexoraFetch') && !content.includes('from "@/lib/config"')) {
  content = content.replace(
    'import { UserProfileModal }',
    'import { nexoraFetch } from "@/lib/config";\nimport { UserProfileModal }'
  );
  changes.push('Added nexoraFetch import');
}

// 2. Add the debounced search useEffect + handleSendConnectionRequest after the sentRequests state
const SEARCH_LOGIC = `

  // Debounced global user search
  useEffect(() => {
    if (!showGlobalSearch || globalSearchQuery.trim().length < 2) {
      setGlobalSearchResults([]);
      return;
    }
    setGlobalSearchLoading(true);
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    const t = setTimeout(async () => {
      try {
        const data = await nexoraFetch(\`/api/users/search?q=\${encodeURIComponent(globalSearchQuery)}&me=\${encodeURIComponent(myUsername)}\`);
        setGlobalSearchResults(data?.users || []);
      } catch {
        setGlobalSearchResults([]);
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [globalSearchQuery, showGlobalSearch]);

  const handleSendConnectionRequest = async (user: {username:string;fullName:string;color:string}) => {
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    const myName = localStorage.getItem("nexora_signup_name") || myUsername;
    const myColor = "from-purple-500 to-indigo-500";
    try {
      await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ from: myUsername, fromName: myName, fromColor: myColor, to: user.username }),
      });
    } catch {}
    const updated = [...sentRequests, user.username];
    setSentRequests(updated);
    localStorage.setItem("nexora_sent_requests", JSON.stringify(updated));
  };
`;

const marker1 = '  const [sentRequests, setSentRequests] = useState<string[]>([]);\r\n\r\n  // Per-chat strict lock';
const marker1b = '  const [sentRequests, setSentRequests] = useState<string[]>([]);\n\n  // Per-chat strict lock';

if (content.includes(marker1) && !content.includes('handleSendConnectionRequest')) {
  content = content.replace(marker1, `  const [sentRequests, setSentRequests] = useState<string[]>([]);${SEARCH_LOGIC}\n  // Per-chat strict lock`);
  changes.push('Added search useEffect + handleSendConnectionRequest');
} else if (content.includes(marker1b) && !content.includes('handleSendConnectionRequest')) {
  content = content.replace(marker1b, `  const [sentRequests, setSentRequests] = useState<string[]>([]);${SEARCH_LOGIC}\n  // Per-chat strict lock`);
  changes.push('Added search useEffect + handleSendConnectionRequest (unix newlines)');
}

// 3. Add the Global Search Modal before the closing </div> ); }
const MODAL_JSX = `

      {/* ═══ GLOBAL USER SEARCH MODAL ═══ */}
      <AnimatePresence>
        {showGlobalSearch && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex flex-col"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowGlobalSearch(false)}
          >
            <motion.div
              initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -30, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="w-full max-w-lg mx-auto mt-16 rounded-2xl overflow-hidden"
              style={{
                background: isDark ? "rgba(14,14,22,0.99)" : "rgba(255,255,255,0.99)",
                border: \`1px solid \${isDark ? "rgba(255,255,255,0.1)" : "rgba(108,92,231,0.15)"}\`,
                boxShadow: "0 30px 80px rgba(0,0,0,0.4)"
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Search Header */}
              <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
                  <Search className="w-4 h-4 text-white" />
                </div>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people by name or username..."
                  value={globalSearchQuery}
                  onChange={e => setGlobalSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-sm font-semibold"
                  style={{ color: "var(--text-primary)" }}
                />
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowGlobalSearch(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", color: "var(--text-muted)" }}>
                  <X className="w-4 h-4" />
                </motion.button>
              </div>

              {/* Results */}
              <div className="max-h-96 overflow-y-auto">
                {globalSearchLoading ? (
                  <div className="flex items-center justify-center py-12 gap-3">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-[#6c5ce7] border-t-transparent rounded-full" />
                    <span className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Searching...</span>
                  </div>
                ) : globalSearchQuery.length < 2 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: isDark ? "rgba(108,92,231,0.1)" : "rgba(108,92,231,0.08)" }}>
                      <UserPlus className="w-7 h-7" style={{ color: "#6c5ce7" }} />
                    </div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>Find New People</p>
                    <p className="text-xs text-center max-w-xs" style={{ color: "var(--text-muted)" }}>Type at least 2 characters to search users on Nexora</p>
                  </div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No users found</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>Try a different username or name</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {globalSearchResults.map((user) => {
                      const alreadyRequested = sentRequests.includes(user.username);
                      const alreadyConnected = threads.some(t => t.name?.toLowerCase() === user.fullName?.toLowerCase());
                      return (
                        <motion.div key={user.username}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                          style={{ background: "transparent" }}
                        >
                          <div className={\`w-11 h-11 rounded-full bg-gradient-to-br \${user.color || "from-purple-500 to-indigo-500"} flex items-center justify-center text-white font-bold text-base shadow-md shrink-0\`}>
                            {user.fullName?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{user.fullName}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
                          </div>
                          {alreadyConnected ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(46,213,115,0.12)", color: "#2ed573" }}>Connected</span>
                          ) : alreadyRequested ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,190,11,0.12)", color: "#ffbe0b" }}>Sent ✓</span>
                          ) : (
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                              onClick={() => handleSendConnectionRequest(user)}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl text-white"
                              style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", boxShadow: "0 4px 12px rgba(108,92,231,0.3)" }}
                            >
                              + Connect
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>`;

// Find the final closing pattern: "    </div>\n  );\n}" or with \r\n
const endPattern1 = '    </div>\r\n  );\r\n}';
const endPattern2 = '    </div>\n  );\n}';

if (!content.includes('GLOBAL USER SEARCH MODAL')) {
  // Insert before the final closing
  const lastIdx1 = content.lastIndexOf(endPattern1);
  const lastIdx2 = content.lastIndexOf(endPattern2);
  const lastIdx = Math.max(lastIdx1, lastIdx2);
  
  if (lastIdx > 0) {
    const endStr = lastIdx === lastIdx1 ? endPattern1 : endPattern2;
    content = content.substring(0, lastIdx) + MODAL_JSX + '\n' + endStr + content.substring(lastIdx + endStr.length);
    changes.push('Added Global Search Modal JSX');
  } else {
    console.log('ERROR: Could not find closing pattern to insert modal');
  }
}

// 4. Replace the "View Network Requests" button with the global search button
const oldBtn = `          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => window.location.href = '/dashboard/requests'}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
            View Network Requests
          </motion.button>`;
const newBtn = `          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => { setShowGlobalSearch(true); setGlobalSearchQuery(""); setGlobalSearchResults([]); }}
            className="px-6 py-3 rounded-xl text-sm font-bold text-white shadow-lg"
            style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
            Find & Connect People
          </motion.button>`;

if (content.includes(oldBtn)) {
  content = content.replace(oldBtn, newBtn);
  changes.push('Replaced "View Network Requests" button with "Find & Connect People"');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done! Changes:');
changes.forEach(c => console.log(' -', c));
if (changes.length === 0) console.log('  (no changes needed)');
