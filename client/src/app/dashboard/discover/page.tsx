"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Users, UserPlus, RefreshCcw, ArrowLeft, Shield,
  Zap, Globe, Sparkles, ChevronDown, X, MessageSquare,
  UserCheck, Calendar, Link as LinkIcon
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";
import { Avatar } from "@/components/Avatar";

// ─── Instagram-style Profile Preview Modal ────────────────────────────────────
function ProfileModal({
  user,
  onClose,
  onConnect,
  requested,
  isDark,
  router,
}: {
  user: any;
  onClose: () => void;
  onConnect: (u: string) => void;
  requested: boolean;
  isDark: boolean;
  router: any;
}) {
  const [fullProfile, setFullProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await nexoraFetch(`/api/users/profile?username=${encodeURIComponent(user.username)}`);
        if (data?.user) setFullProfile(data.user);
      } catch {}
      finally { setLoading(false); }
    };
    fetch();
  }, [user.username]);

  const profile = fullProfile || user;
  const avatarUrl = fullProfile?.avatarUrl || user.avatar_url;
  const name = fullProfile?.fullName || user.full_name || user.username;
  const bio = fullProfile?.bio || null;
  const joinedDate = fullProfile?.created_at
    ? new Date(fullProfile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <AnimatePresence>
      <motion.div
        key="profile-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-6"
        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(12px)" }}
        onClick={onClose}
      >
        <motion.div
          key="profile-modal-card"
          initial={{ y: 80, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 340, damping: 28 }}
          className="relative w-full sm:max-w-sm rounded-t-[3rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl"
          style={{
            background: isDark
              ? "linear-gradient(145deg, rgba(18,18,26,0.98), rgba(26,26,40,0.98))"
              : "linear-gradient(145deg, rgba(255,255,255,0.98), rgba(245,243,255,0.98))",
            border: "1px solid rgba(108,92,231,0.15)",
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Glow bg */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-[80px] pointer-events-none"
            style={{ background: "rgba(108,92,231,0.18)" }} />
          <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-[80px] pointer-events-none"
            style={{ background: "rgba(0,212,255,0.08)" }} />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 z-20 p-2 rounded-full transition-all"
            style={{ background: "rgba(255,255,255,0.1)" }}
          >
            <X className="w-4 h-4" style={{ color: "var(--text-secondary)" }} />
          </button>

          {/* Cover strip */}
          <div className="h-28 w-full relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, #6c5ce7 0%, #00d4ff 100%)`, opacity: 0.8 }} />

          {/* Avatar floating over cover */}
          <div className="relative px-6 pb-6">
            <div className="relative -mt-14 mb-4 inline-block">
              <div className="ring-4 ring-[#6c5ce7]/40 rounded-full shadow-2xl">
                <Avatar
                  src={avatarUrl}
                  name={name}
                  color={user.color}
                  size={88}
                  animate={false}
                  showBorder={false}
                />
              </div>
              {user.mutualCount > 0 && (
                <div className="absolute -bottom-1 -right-1 bg-[#6c5ce7] text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white/10 shadow-lg">
                  {user.mutualCount}
                </div>
              )}
            </div>

            {/* Name & username */}
            <div className="mb-3">
              <h2 className="text-2xl font-black tracking-tight leading-tight" style={{ color: "var(--text-primary)" }}>
                {loading ? <span className="opacity-40">Loading...</span> : name}
              </h2>
              <p className="text-sm font-bold text-[#6c5ce7] mt-0.5">@{user.username}</p>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {user.mutualCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-[#6c5ce7]"
                  style={{ background: "rgba(108,92,231,0.12)", border: "1px solid rgba(108,92,231,0.2)" }}>
                  <Users className="w-3 h-3" />
                  {user.mutualCount} Mutual{user.mutualCount > 1 ? "s" : ""}
                </div>
              )}
              {profile?.mutualFriends?.length > 0 && (
                <div className="flex -space-x-2 ml-1">
                    {profile.mutualFriends.slice(0, 3).map((mf: any) => (
                        <div key={mf.username} className="w-6 h-6 rounded-full border border-black/20 overflow-hidden ring-1 ring-white/10 shadow-lg">
                            <Avatar src={mf.avatarUrl} name={mf.fullName} color={mf.color} size={24} animate={false} showBorder={false} />
                        </div>
                    ))}
                    {profile.mutualFriends.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-[8px] font-black border border-white/10" style={{ color: "var(--text-primary)" }}>
                            +{profile.mutualFriends.length - 3}
                        </div>
                    )}
                </div>
              )}
              {joinedDate && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <Calendar className="w-3 h-3" />
                  {joinedDate}
                </div>
              )}
            </div>

            {/* Bio */}
            {!loading && bio && (
              <p className="text-sm leading-relaxed mb-5 opacity-70" style={{ color: "var(--text-primary)" }}>
                {bio}
              </p>
            )}
            {!loading && !bio && (
              <p className="text-xs italic mb-5 opacity-30" style={{ color: "var(--text-secondary)" }}>
                No bio available.
              </p>
            )}

            {/* Action buttons */}
            <div className="w-full flex gap-2">
              {!requested && !profile?.isFriend && !profile?.requestSent ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { onConnect(user.username); }}
                  className="flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-widest text-white shadow-lg shadow-[#6c5ce7]/30"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}
                >
                  <UserPlus className="w-4 h-4" /> {profile?.requestReceived ? "Request Back" : "Connect"}
                </motion.button>
              ) : (
                <div className={`flex-[2] py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-widest ${
                  profile?.isFriend 
                    ? "text-green-500 bg-green-500/10 border border-green-500/20" 
                    : "text-amber-500 bg-amber-500/10 border border-amber-500/20"
                }`}>
                  {profile?.isFriend ? <><Shield className="w-4 h-4" /> Connected</> : <><UserCheck className="w-4 h-4" /> Request Sent</>}
                </div>
              )}
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { router.push(`/dashboard/chats?u=${user.username}`); }}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 font-black text-[11px] uppercase tracking-widest bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                style={{ color: "var(--text-primary)" }}
              >
                <MessageSquare className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Discover Page ───────────────────────────────────────────────────────
const PAGE_SIZE = 12;

export default function DiscoverPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await nexoraFetch(`/api/users/suggestions`);
      if (res?.suggestions) {
        // Mutual friends always first (server already sorts, but ensure it)
        const sorted = [...res.suggestions].sort((a, b) => (b.mutualCount || 0) - (a.mutualCount || 0));
        setSuggestions(sorted);
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
    const fromName = localStorage.getItem("nexora_signup_name") || from;
    const fromColor = localStorage.getItem("nexora_signup_color") || "#6c5ce7";
    if (!from || requested[targetUsername]) return;

    setRequested(prev => ({ ...prev, [targetUsername]: true }));
    try {
      const res = await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({ from, to: targetUsername, fromName, fromColor })
      });
      if (!res || (res.status !== "success" && res.status !== "sent")) {
        setRequested(prev => ({ ...prev, [targetUsername]: false }));
      }
    } catch {
      setRequested(prev => ({ ...prev, [targetUsername]: false }));
    }
  };

  const filteredSuggestions = suggestions.filter(s =>
    s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.full_name && s.full_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const visibleSuggestions = filteredSuggestions.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSuggestions.length;

  return (
    <div className="relative flex flex-col w-full h-full overflow-hidden"
      style={{ color: "var(--text-primary)" }}>

      {/* Background glow */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #6c5ce7, transparent)" }} />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-5 blur-[100px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #00d4ff, transparent)" }} />

      {/* Header */}
      <div className="relative z-10 px-6 pt-8 pb-4">
        <div className="flex items-center gap-4 mb-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -2 }} whileTap={{ scale: 0.9 }}
            onClick={() => router.push("/dashboard/stories")}
            className="p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
          <div>
            <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
              Discover <Sparkles className="w-6 h-6 text-[#6c5ce7]" />
            </h1>
            <p className="text-xs font-bold opacity-40 uppercase tracking-widest mt-1">
              {loading ? "Scanning Network..." : `${filteredSuggestions.length} node${filteredSuggestions.length !== 1 ? "s" : ""} found`}
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
            onClick={fetchSuggestions}
            disabled={loading}
            className="ml-auto p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-40"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin text-[#6c5ce7]" : ""}`} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative mb-2">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="w-5 h-5 opacity-30" />
          </div>
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name or @username..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setVisibleCount(PAGE_SIZE); }}
            className="w-full pl-14 pr-6 py-4 rounded-[2rem] bg-white/5 border border-white/10 outline-none focus:border-[#6c5ce7]/50 focus:ring-4 focus:ring-[#6c5ce7]/5 transition-all text-sm font-bold tracking-tight shadow-xl"
            style={{ backdropFilter: "blur(20px)" }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-5 flex items-center opacity-40 hover:opacity-80 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Mutual friends hint */}
        {!searchQuery && !loading && filteredSuggestions.some(s => s.mutualCount > 0) && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 pb-2 text-[10px] font-black uppercase tracking-widest text-[#6c5ce7] opacity-60"
          >
            <Users className="w-3 h-3" /> Mutual friends shown first
          </motion.div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-28 custom-scrollbar relative z-10">
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
              {searchQuery ? "Try a different search term." : "No suggested users yet. Check back later."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <AnimatePresence>
                {visibleSuggestions.map((user, i) => (
                  <motion.div
                    key={user.username}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: i < 12 ? i * 0.04 : 0 }}
                    className="relative group cursor-pointer"
                    onClick={() => setSelectedUser(user)}
                  >
                    <div
                      className="relative p-5 rounded-[2rem] border border-white/5 overflow-hidden transition-all hover:border-[#6c5ce7]/30 hover:shadow-2xl hover:shadow-[#6c5ce7]/10 hover:-translate-y-1 duration-300"
                      style={{
                        background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
                        backdropFilter: "blur(40px)"
                      }}
                    >
                      {/* Mutual badge top-right */}
                      {user.mutualCount > 0 && (
                        <div className="absolute top-3 right-3 bg-[#6c5ce7] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg z-10">
                          {user.mutualCount}M
                        </div>
                      )}

                      {/* Glow on hover */}
                      <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full opacity-0 group-hover:opacity-15 blur-3xl transition-opacity duration-500 bg-gradient-to-br ${user.color?.includes("#") ? "" : user.color || "from-[#6c5ce7] to-[#00d4ff]"}`}
                        style={user.color?.startsWith("#") ? { background: user.color } : {}} />

                      {/* Avatar */}
                      <div className="flex flex-col items-center">
                        <div className="relative mb-3">
                          <Avatar
                            src={user.avatar_url}
                            name={user.full_name || user.username}
                            color={user.color}
                            size={72}
                            className="ring-4 ring-white/10 group-hover:ring-[#6c5ce7]/30 ring-offset-2 ring-offset-transparent transition-all duration-500"
                          />
                        </div>

                        {/* Name + username */}
                        <div className="text-center w-full mb-4">
                          <h3 className="text-sm font-black truncate w-full leading-tight mb-0.5" style={{ color: "var(--text-primary)" }}>
                            {user.full_name || user.username}
                          </h3>
                          <p className="text-[10px] font-bold opacity-30 truncate w-full">
                            @{user.username}
                          </p>

                          {user.mutualCount > 0 && (
                            <div className="mt-2 inline-flex flex-col items-center gap-1.5">
                              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#6c5ce7]/10 border border-[#6c5ce7]/20">
                                <Users className="w-2.5 h-2.5 text-[#6c5ce7]" />
                                <span className="text-[9px] font-black text-[#6c5ce7] uppercase tracking-wider">
                                  {user.mutualCount} Mutual
                                </span>
                              </div>
                              {user.mutualFriends && user.mutualFriends.length > 0 && (
                                <div className="flex -space-x-1.5 opacity-80 hover:opacity-100 transition-opacity">
                                  {user.mutualFriends.slice(0, 3).map((mf: any, idx: number) => (
                                    <Avatar key={idx} src={mf.avatar_url} name={mf.username} size={16} animate={false} showBorder={true} className="border border-[#1a1a2e] shadow-sm" />
                                  ))}
                                  {user.mutualFriends.length > 3 && (
                                    <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[7px] font-black border border-[#1a1a2e] z-10">
                                      +{user.mutualFriends.length - 3}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Connect button */}
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={e => { e.stopPropagation(); handleConnect(user.username); }}
                          disabled={requested[user.username]}
                          className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-1.5 font-black text-[9px] uppercase tracking-widest transition-all ${requested[user.username]
                              ? "text-green-400 border border-green-400/20 bg-green-400/5"
                              : "bg-[#6c5ce7] text-white shadow-md shadow-[#6c5ce7]/20 hover:shadow-[#6c5ce7]/40"
                            }`}
                        >
                          {requested[user.username] ? (
                            <><UserCheck className="w-3 h-3" /><span>Sent</span></>
                          ) : (
                            <><UserPlus className="w-3 h-3" /><span>Connect</span></>
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* ── SEE MORE button ── */}
            {hasMore && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center mt-8"
              >
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  className="flex items-center gap-2.5 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-[#6c5ce7]/20 hover:shadow-[#6c5ce7]/40 transition-all"
                  style={{ background: "linear-gradient(135deg, #6c5ce7, #a855f7)" }}
                >
                  <ChevronDown className="w-4 h-4" />
                  See More
                  <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px]">
                    +{filteredSuggestions.length - visibleCount}
                  </span>
                </motion.button>
              </motion.div>
            )}

            {/* Load count info */}
            {!hasMore && filteredSuggestions.length > PAGE_SIZE && (
              <p className="text-center text-xs font-bold opacity-20 uppercase tracking-widest mt-6 pb-4">
                All {filteredSuggestions.length} nodes loaded
              </p>
            )}
          </>
        )}
      </div>

      {/* ── Profile Modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <ProfileModal
            key={selectedUser.username}
            user={selectedUser}
            isDark={isDark}
            requested={!!requested[selectedUser.username]}
            router={router}
            onConnect={(u) => { handleConnect(u); }}
            onClose={() => setSelectedUser(null)}
          />
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(108,92,231,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(108,92,231,0.4); }
      `}</style>
    </div>
  );
}
