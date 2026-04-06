"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Users, UserPlus, RefreshCcw, ArrowLeft, Shield, Zap, Globe, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";
import { Avatar } from "@/components/Avatar";

export default function DiscoverPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<string, boolean>>({});

  const fetchSuggestions = async () => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    if (!username) return;
    setLoading(true);
    try {
      const res = await nexoraFetch(`/api/users/suggestions?username=${username}`);
      if (res && res.suggestions) {
        setSuggestions(res.suggestions);
      }
    } catch (err) {
      console.error("Discovery failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleConnect = async (targetUsername: string) => {
    const from = localStorage.getItem("nexora_signup_username") || "";
    const fromName = localStorage.getItem("nexora_signup_fullname") || from;
    const fromColor = localStorage.getItem("nexora_signup_color") || "#6c5ce7";
    
    if (!from || requested[targetUsername]) return;

    setRequested(prev => ({ ...prev, [targetUsername]: true }));
    try {
      const res = await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ from, to: targetUsername, fromName, fromColor })
      });
      if (!res || res.status !== "success" && res.status !== "sent") {
        setRequested(prev => ({ ...prev, [targetUsername]: false }));
      }
    } catch (err) {
      setRequested(prev => ({ ...prev, [targetUsername]: false }));
    }
  };

  const filteredSuggestions = suggestions.filter(s => 
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.full_name && s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden" 
         style={{ color: "var(--text-primary)" }}>
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none"
           style={{ background: "radial-gradient(circle, #6c5ce7, transparent)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 blur-[100px] pointer-events-none"
           style={{ background: "radial-gradient(circle, #00d4ff, transparent)" }} />

      {/* Header Area */}
      <div className="relative z-10 px-6 pt-8 pb-4">
        <div className="flex items-center gap-4 mb-6">
          <motion.button 
            whileHover={{ scale: 1.1, x: -2 }} whileTap={{ scale: 0.9 }}
            onClick={() => router.push('/dashboard/stories')}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              Discover <Sparkles className="w-6 h-6 text-[#6c5ce7]" />
            </h1>
            <p className="text-xs font-bold opacity-40 uppercase tracking-widest mt-1">
              Encrypted Network Expansion
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 opacity-30" />
          </div>
          <input 
            type="text" 
            placeholder="Search by node identity or @username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-white/5 border border-white/10 outline-none focus:border-[#6c5ce7]/50 focus:ring-4 focus:ring-[#6c5ce7]/5 transition-all text-sm font-bold tracking-tight shadow-xl"
            style={{ backdropFilter: "blur(20px)" }}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pb-24 custom-scrollbar relative z-10">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 opacity-50">
            <RefreshCcw className="w-8 h-8 animate-spin mb-4 text-[#6c5ce7]" />
            <p className="text-sm font-black uppercase tracking-widest">Scanning Network...</p>
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="p-6 rounded-full bg-white/5 mb-6 border border-white/5">
              <Globe className="w-12 h-12 opacity-20" />
            </div>
            <h3 className="text-xl font-black mb-2">No Nodes Found</h3>
            <p className="text-sm opacity-40 max-w-xs mx-auto">
              {searchQuery ? "Try a different search term or explore active regions." : "Our relay hasn't found any suggested users for you yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence>
              {filteredSuggestions.map((user, i) => (
                <motion.div 
                  key={user.username}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative group p-6 rounded-[2.5rem] border border-white/5 overflow-hidden transition-all hover:border-[#6c5ce7]/30 shadow-2xl"
                  style={{ 
                    background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0,0,0,0.02)",
                    backdropFilter: "blur(40px)"
                  }}
                >
                  {/* Hover background glow */}
                  <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-0 group-hover:opacity-10 blur-3xl transition-opacity bg-gradient-to-br ${user.color || 'from-[#6c5ce7] to-[#00d4ff]'}`} />
                  
                  <div className="relative flex flex-col items-center">
                    <div className="relative mb-4">
                      <Avatar 
                        src={user.avatar_url} 
                        name={user.full_name || user.username} 
                        color={user.color} 
                        size={88}
                        className="ring-4 ring-white/10 group-hover:ring-[#6c5ce7]/30 ring-offset-4 ring-offset-transparent transition-all duration-500"
                      />
                      {user.mutualCount > 0 && (
                        <div className="absolute -bottom-1 -right-1 bg-[#6c5ce7] text-white text-[10px] font-black w-7 h-7 rounded-full flex items-center justify-center border-4 border-[#0a0a12] shadow-lg">
                          {user.mutualCount}
                        </div>
                      )}
                    </div>

                    <div className="text-center w-full mb-6">
                      <h3 className="text-lg font-black truncate w-full mb-1">
                        {user.full_name || user.username}
                      </h3>
                      <p className="text-xs font-bold opacity-30 tracking-tight">
                        @{user.username}
                      </p>
                      
                      {user.mutualCount > 0 && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6c5ce7]/10 border border-[#6c5ce7]/20">
                          <Users className="w-3 h-3 text-[#6c5ce7]" />
                          <span className="text-[10px] font-black text-[#6c5ce7] uppercase tracking-wider">
                            {user.mutualCount} Mutual
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="w-full flex flex-col gap-2">
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleConnect(user.username)}
                        disabled={requested[user.username]}
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-widest transition-all ${
                          requested[user.username] 
                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                            : 'bg-[#6c5ce7] text-white shadow-lg shadow-[#6c5ce7]/20 hover:shadow-[#6c5ce7]/40'
                        }`}
                      >
                        {requested[user.username] ? (
                          <><span>Request Sent</span> <Zap className="w-3 h-3 animate-pulse" /></>
                        ) : (
                          <><span>Connect Node</span> <UserPlus className="w-3 h-3" /></>
                        )}
                      </motion.button>
                      
                      <div className="flex items-center justify-center gap-4 mt-2 opacity-20 group-hover:opacity-40 transition-opacity">
                         <div className="h-px w-8 bg-current" />
                         <Shield className="w-3 h-3" />
                         <div className="h-px w-8 bg-current" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(108, 92, 231, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(108, 92, 231, 0.4);
        }
      `}</style>
    </div>
  );
}
