"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Clock, Eye, Plus, Heart, Send, Camera, Zap, ImageIcon, Trash2, Users, Phone, Video, Shield, Lock, ShieldOff, MoreVertical } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";

const SNAP_REACTIONS = ["🔥", "❤️", "😮", "👏", "💎", "🚀"];

const getTimeAgo = (dateStr: string, currentTime: number) => {
  const date = new Date(dateStr);
  const diffInSeconds = Math.floor((currentTime - date.getTime()) / 1000);
  
  if (diffInSeconds < 0) return "Just now"; // Future safety
  if (diffInSeconds < 60) return "Just now";
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
};

export default function StoriesPage() {
  const { isDark } = useTheme();
  const [activeStory, setActiveStory] = useState<any | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [likeCount, setLikeCount] = useState<Record<number, number>>({});
  const [otherStories, setOtherStories] = useState<any[]>([]);
  
  // Your story state
  const [myStory, setMyStory] = useState<any | null>(null);
  const [myUsername, setMyUsername] = useState("");

  const [reply, setReply] = useState("");
  const [showSnapReactions, setShowSnapReactions] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef<number>(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Real-time Camera
  const [cameraView, setCameraView] = useState<{ active: boolean; stream: MediaStream | null; capturedUrl: string | null }>({ active: false, stream: null, capturedUrl: null });
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  
  // Real-time viewer tracking
  const [showViewers, setShowViewers] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [likersList, setLikersList] = useState<any[]>([]);

  // Profile Modal State
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [blockedThreads, setBlockedThreads] = useState<number[]>([]);
  const [threads, setThreads] = useState<any[]>([]);

  useEffect(() => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    setMyUsername(username);
    const blocked = JSON.parse(localStorage.getItem("nexora_blocked_threads") || "[]");
    setBlockedThreads(blocked);
    
    // Fetch threads to check connections for calling
    const fetchThreads = async () => {
      try {
        const username = localStorage.getItem("nexora_signup_username");
        const res = await nexoraFetch(`/api/chats/threads?username=${username}`);
        if (res && res.threads) setThreads(res.threads);
      } catch (e) { console.error(e); }
    };
    fetchThreads();
  }, [selectedProfileUser]);

  const handleBlockUser = (threadId: number) => {
    if (!threadId) return;
    setBlockedThreads(prev => {
      const next = prev.includes(threadId) ? prev : [...prev, threadId];
      localStorage.setItem("nexora_blocked_threads", JSON.stringify(next));
      return next;
    });
    setSelectedProfileUser(null);
    alert("Node communication blocked.");
  };

  const handleUnblockUser = (threadId: number) => {
    if (!threadId) return;
    setBlockedThreads(prev => {
      const next = prev.filter(id => id !== threadId);
      localStorage.setItem("nexora_blocked_threads", JSON.stringify(next));
      return next;
    });
    setSelectedProfileUser(null);
    alert("Node communication restored.");
  };

  useEffect(() => {
    if (!selectedProfileUser) { setProfileData(null); return; }
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const username = selectedProfileUser.username;
        const res = await nexoraFetch(`/api/users/profile?username=${encodeURIComponent(username)}`);
        if (res && res.user) setProfileData(res.user);
      } catch (e) { console.error(e); }
      finally { setLoadingProfile(false); }
    };
    fetchProfile();
  }, [selectedProfileUser]);

  const fetchStories = async () => {
    try {
      const username = localStorage.getItem("nexora_signup_username");
      if (!username) return;
      
      const data = await nexoraFetch(`/api/stories?username=${username}`);
      if (data && data.stories) {
        // Map backend schema to frontend structure
        const mapped = data.stories.map((s: any) => ({
          ...s,
          user: s.name || s.username,
          time: getTimeAgo(s.created_at, Date.now()),
          color: s.color || "from-[#6c5ce7] to-[#00d4ff]",
          type: s.media_type || "image",
          content: s.media_url,
          views: s.views_count,
          isViewed: s.is_viewed,
          likes: s.likes_count,
          isLiked: s.is_liked
        }));
        
        const mine = mapped.filter((s: any) => s.username === username);
        const others = mapped.filter((s: any) => s.username !== username);
        
        setMyStory(mine.length > 0 ? mine[0] : null);
        setOtherStories(others);
        
        // Update activeStory to reflect new real-time views/likes
        setActiveStory((prev: any) => {
          if (!prev) return prev;
          const updated = mapped.find((s: any) => s.id === prev.id);
          return updated || prev;
        });
        
        // Initialize like state
        const initialLiked: Record<number, boolean> = {};
        const initialLikeCount: Record<number, number> = {};
        mapped.forEach((s: any) => {
          initialLiked[s.id] = s.isLiked;
          initialLikeCount[s.id] = s.likes;
        });
        setLiked(initialLiked);
        setLikeCount(initialLikeCount);
      }
    } catch (e) {
      console.error("Failed to fetch stories");
    }
  };

  useEffect(() => {
    fetchStories();
    // Poll every 10 seconds for real-time updates and update 'now' for relative time
    const interval = setInterval(() => {
      fetchStories();
      setNow(Date.now());
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (cameraView.active && !cameraView.capturedUrl && cameraView.stream && liveVideoRef.current) {
      liveVideoRef.current.srcObject = cameraView.stream;
    }
  }, [cameraView.active, cameraView.capturedUrl, cameraView.stream]);

  // Auto-progress story bar and handle recording views/stats
  useEffect(() => {
    setProgress(0);
    setIsPaused(false);
    
    if (activeStory) {
      const username = localStorage.getItem("nexora_signup_username");
      if (activeStory.username === username) {
        // It's my story - fetch detailed stats (who viewed, who liked)
        nexoraFetch(`/api/stories/stats?storyId=${activeStory.id}`).then((data) => {
           if (data) {
             setViewersList(data.views || []);
             setLikersList(data.likes || []);
           }
        });
      } else {
        // It's someone else's story - record a view
        if (!activeStory.isViewed) {
          nexoraFetch('/api/stories/view', {
             method: "POST",
             body: JSON.stringify({ storyId: activeStory.id, username })
          }).then(() => fetchStories());
        }
      }
    }
  }, [activeStory?.id]);

  useEffect(() => {
    if (!activeStory || isPaused) {
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }
    
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setActiveStory(null);
          return 0;
        }
        return p + 0.5; // 5 seconds total (100 / 0.5 * 25ms ≈ 5s)
      });
    }, 25);
    
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [activeStory, isPaused]);

  const handleLike = async (storyId: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    
    // If already liked, just toggle state locally (unliking)
    if (liked[storyId]) {
      setLiked(prev => ({ ...prev, [storyId]: false }));
      setLikeCount(prev => ({ ...prev, [storyId]: Math.max(0, prev[storyId] - 1) }));
    } else {
      // New Like: Show burst animation
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);

      setLiked(prev => ({ ...prev, [storyId]: true }));
      setLikeCount(prev => ({ ...prev, [storyId]: prev[storyId] + 1 }));
    }
    
    try {
      await nexoraFetch("/api/stories/like", {
        method: "POST",
        body: JSON.stringify({ storyId, username })
      });
    } catch {
      // Minimal revert logic
    }
  };

  const handleDoubleTap = (storyId: number, e: React.MouseEvent | React.TouchEvent) => {
    const now = Date.now();
    const diff = now - lastTapRef.current;
    if (diff < 300) {
      handleLike(storyId, e);
    }
    lastTapRef.current = now;
  };

  const handleReply = async (messageText?: string) => {
    const textToSend = messageText || reply;
    if (!textToSend.trim() || !activeStory) return;
    
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;

    // Optimistic UI clear
    if (!messageText) setReply("");
    
    try {
      await nexoraFetch("/api/stories/reply", {
        method: "POST",
        body: JSON.stringify({
           storyId: activeStory.id,
           username,
           targetUsername: activeStory.username,
           message: textToSend
        })
      });
      setSentReaction(messageText ? messageText : "✓ Sent!");
      setTimeout(() => setSentReaction(null), 2000);
    } catch (e) {
      alert("Failed to send reply");
    }
  };

  const handleSnapReaction = (emoji: string) => {
    setShowSnapReactions(false);
    handleReply(emoji);
  };

  const handleNewSnap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    
    // Instead of immediate submit, show preview
    setCameraView({ active: true, stream: null, capturedUrl: url });
    if (e.target) e.target.value = '';
  };

  const startCameraView = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setCameraView({ active: true, stream, capturedUrl: null });
    } catch {
      alert("Camera access denied. Opening file picker instead.");
      fileInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (!liveVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = liveVideoRef.current.videoWidth;
    canvas.height = liveVideoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(liveVideoRef.current, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.8);
    setCameraView(p => ({ ...p, capturedUrl: url }));
  };

  const [isUploading, setIsUploading] = useState(false);

  const submitNewStory = async (mediaUrl: string) => {
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    setIsUploading(true);
    try {
      const res = await nexoraFetch("/api/stories", {
         method: "POST",
         body: JSON.stringify({ username, mediaUrl, mediaType: "image", caption: "" })
      });
      
      if (!res || res._httpError) {
         alert("Failed to submit story (File might be too large).");
      } else {
         await fetchStories(); // Refresh after publish
         alert("Story uploaded successfully!");
      }
    } catch (e) {
      alert("Failed to submit story.");
    } finally {
      setIsUploading(false);
    }
  };

  const publishStory = async () => {
    if (!cameraView.capturedUrl) return;
    await submitNewStory(cameraView.capturedUrl);
    closeCameraView();
  };

  const closeCameraView = () => {
    if (cameraView.stream) {
      cameraView.stream.getTracks().forEach(t => t.stop());
    }
    setCameraView({ active: false, stream: null, capturedUrl: null });
  };

  const handleDeleteStory = async (storyId: number) => {
    if (!window.confirm("Are you sure you want to delete this story?")) return;
    const username = localStorage.getItem("nexora_signup_username");
    try {
      await nexoraFetch(`/api/stories/${storyId}?username=${username}`, { method: "DELETE" });
      setActiveStory(null);
      await fetchStories();
    } catch (e) {
      alert("Failed to delete story");
    }
  };

  return (
    <div className="relative flex flex-col w-full h-full overflow-y-auto p-6 md:p-8"
         style={{ color: "var(--text-primary)" }}>
      <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*" onChange={handleNewSnap} />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute top-0 right-0 h-72 w-72 rounded-full"
           style={{ background: "radial-gradient(circle,rgba(255,0,110,0.1),transparent 70%)", filter: "blur(60px)" }} />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full"
           style={{ background: "radial-gradient(circle,rgba(108,92,231,0.1),transparent 70%)", filter: "blur(60px)" }} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-8 relative z-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Stories
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            24-hour self-destructing encrypted stories
          </p>
        </div>

        {/* New Snap button */}
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: "0 0 28px rgba(108,92,231,0.45)" }}
          whileTap={{ scale: 0.95 }}
          onClick={startCameraView}
          className="flex items-center gap-2 px-5 py-3 rounded-full text-white font-bold text-sm shadow-lg"
          style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>
          <Camera className="w-4 h-4" />
          <span>New Story</span>
          <Zap className="w-4 h-4 fill-white" />
        </motion.button>
      </motion.div>

      {/* ─── Story Grid ─── */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
        
        {/* Your Story */}
        <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center cursor-pointer group relative"
          >
            <div className="relative mb-3">
              {/* Ring logic */}
              <div className={`p-[3px] rounded-full transition-all duration-500 ${myStory ? 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] scale-100 shadow-lg group-hover:shadow-pink-500/20' : 'bg-transparent scale-95'}`}
                   onClick={() => myStory ? setActiveStory(myStory) : startCameraView()}>
                <div className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center relative bg-[#1a1a2e]"
                     style={{ border: `3px solid ${isDark ? "#0a0a12" : "#ffffff"}` }}>
                  {/* User Profile or Story Content */}
                  {myStory ? (
                    <img src={myStory.content} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                       <span className="font-extrabold text-3xl text-white/20">{(myUsername || "Y")[0].toUpperCase()}</span>
                    </div>
                  )}
                  
                  <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
                    {myStory ? <Play className="w-6 h-6 text-white" fill="white" /> : <Camera className="w-6 h-6 text-white" />}
                  </motion.div>
                </div>
              </div>

              {/* Plus Badge (only if no story) */}
              {!myStory && (
                <motion.div 
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={(e) => { e.stopPropagation(); startCameraView(); }}
                  className="absolute bottom-1 right-1 w-7 h-7 bg-blue-500 rounded-full border-[3px] flex items-center justify-center shadow-lg z-20"
                  style={{ borderColor: isDark ? "#0a0a12" : "#ffffff" }}>
                  <Plus className="w-4 h-4 text-white stroke-[3px]" />
                </motion.div>
              )}

              {/* View Count Badge (only if has story) */}
              {myStory && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-1 rounded-full text-[10px] font-bold text-white bg-black/70 backdrop-blur-md shadow-lg z-20 border border-white/10">
                  <Eye className="w-3 h-3 text-white" /> {myStory.views}
                </div>
              )}
            </div>

            <h3 className="font-bold text-xs text-center truncate w-full px-1" style={{ color: "var(--text-primary)" }}>
              Your Story
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              {myStory ? <><Clock className="w-2.5 h-2.5" /> {getTimeAgo(myStory.created_at, now)}</> : "Share a moment"}
            </p>
          </motion.div>

        {otherStories.map((story, i) => (
          <motion.div key={story.id}
            initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 + 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center cursor-pointer group relative"
          >            {/* Ring + Avatar */}
            <div className="relative mb-3" onClick={() => setActiveStory(story)}>
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${story.isViewed ? 'from-gray-400 to-gray-600' : 'from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888]'} shadow-lg group-hover:shadow-2xl transition-shadow`}>
                <div className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center relative"
                     style={{ background: isDark ? "#1a1a2e" : "#ffffff", border: `3px solid ${isDark ? "#0a0a12" : "#ffffff"}` }}>
                  {story.type === "image" ? (
                    <img src={story.content} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-3xl" style={{ color: "var(--text-primary)" }}>{(story.user || story.username || "?")[0].toUpperCase()}</span>
                  )}
                  {/* Play hover */}
                  <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </motion.div>
                </div>
              </div>
            </div>

            <h3 className="font-bold text-xs text-center truncate w-full px-1" style={{ color: "var(--text-primary)" }}>
              {story.user}
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-2.5 h-2.5" /> {getTimeAgo(story.created_at, now)}
            </p>


          </motion.div>
        ))}
      </div>

      {/* ─── Fullscreen Story Viewer ─── */}
      <AnimatePresence>
        {activeStory && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            style={{ backdropFilter: "blur(16px)" }}
            onClick={() => setActiveStory(null)}
          >
            <motion.div
              initial={{ scale: 0.88, y: 40 }} animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.88, y: 40 }} transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => handleDoubleTap(activeStory.id, e)}
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={(e) => { setIsPaused(true); handleDoubleTap(activeStory.id, e); }}
              onTouchEnd={() => setIsPaused(false)}
              className={`relative w-full h-full md:h-[85vh] md:max-h-[760px] md:max-w-sm flex flex-col md:rounded-[2.5rem] overflow-hidden shadow-2xl md:mt-0`}
              style={{ background: `linear-gradient(135deg, #0a0a1a, #1a1a30)`, color: "white" }}
            >
              {/* Heart Burst Effect */}
              <AnimatePresence>
                {showHeartBurst && (
                  <motion.div key="heart-burst" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }}
                    className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
                    <Heart className="w-32 h-32 text-white drop-shadow-[0_0_20px_rgba(255,0,110,0.8)]" fill="white" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* GRADIENT BG BEHIND TEXT STORIES */}
              {activeStory.type !== "image" && (
                <div className={`absolute inset-0 bg-gradient-to-br ${activeStory.color} opacity-90`} />
              )}

              <div className="absolute top-3 md:top-3 left-4 right-4 h-1 rounded-full z-20 overflow-hidden safe-top"
                   style={{ background: "rgba(255,255,255,0.25)" }}>
                <motion.div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
              </div>

              {/* Header */}
              <div className="absolute top-8 md:top-8 left-0 w-full px-5 flex justify-between items-center z-20 safe-top">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedProfileUser({ username: activeStory.username, name: activeStory.user, color: activeStory.color })}>
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${activeStory.color} border-[3px] border-white/20 shadow-lg flex items-center justify-center font-extrabold text-white transition-transform group-hover:scale-105`}>
                    {activeStory.user[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white group-hover:text-white transition-colors">{activeStory.user}</p>
                    <p className="text-[10px] text-white/50 font-black uppercase tracking-widest">{getTimeAgo(activeStory.created_at, now)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 relative">
                  {/* Viewers Trigger Button (Only for My Story) */}
                  {activeStory.username === myUsername && (
                    <button onClick={(e) => { e.stopPropagation(); setShowViewers(!showViewers); setShowLikers(false); }}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-3xl text-[13px] font-black border border-white/30 shadow-2xl transition-all hover:bg-white/20 hover:scale-105 active:scale-95 cursor-pointer group/seen"
                            style={{ color: "white" }}>
                       <div className="flex -space-x-2 mr-1">
                          {viewersList.slice(0, 3).map((v, i) => (
                             <div key={i} className={`w-5 h-5 rounded-full border-2 border-[#12121c] bg-gradient-to-tr ${v.color || "from-purple-500 to-blue-500"} flex items-center justify-center text-[6px] font-black shadow-lg`}>
                                {v.name?.[0] || v.username[0]}
                             </div>
                          ))}
                       </div>
                       <Eye className="w-4 h-4 text-white group-hover/seen:animate-pulse" />
                       <span className="text-white drop-shadow-md">{activeStory.views || 0} Seen</span>
                    </button>
                  )}
                  
                  {/* Viewers Dropdown Modal (ONLY for own story) */}
                  <AnimatePresence>
                    {activeStory.username === myUsername && showViewers && (
                      <motion.div key="viewers-modal" initial={{ opacity: 0, scale: 0.9, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute right-0 top-12 w-64 rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 border border-white/10 text-white"
                        style={{ backgroundColor: "rgba(13,13,26,0.98)", backdropFilter: "blur(25px)" }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2 bg-white/5">
                          <Eye className="w-4 h-4" style={{ color: "white" }} />
                          <span className="text-sm font-bold" style={{ color: "white" }}>Viewer Activity</span>
                        </div>
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                          {viewersList.length === 0 ? (
                            <div className="py-10 flex flex-col items-center justify-center">
                               <Users className="w-10 h-10 mb-3" style={{ color: "white" }} />
                               <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: "white" }}>Awaiting Node Activity</p>
                            </div>
                          ) : (
                            viewersList.map((v) => (
                              <motion.div key={`viewer-${v.username}`} 
                                   initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                                   className="flex items-center gap-3 px-3 py-2 rounded-2xl transition-all hover:bg-white/10 cursor-pointer group/v" 
                                   onClick={(e) => { e.stopPropagation(); setSelectedProfileUser({ username: v.username, name: v.name, color: v.color }); }}>
                                <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${v.color || "from-[#6c5ce7] to-[#00d4ff]"} flex items-center justify-center text-xs font-black shrink-0 border border-white/20 shadow-lg group-hover/v:scale-110 transition-transform text-white`}>
                                  {(v.name || v.username || "?")[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[13px] font-black block truncate transition-colors" style={{ color: "white" }}>{v.name || v.username}</span>
                                  <span className="text-[9px] font-black uppercase tracking-tighter block truncate" style={{ color: "rgba(255,255,255,0.6)" }}>Verified Viewer</span>
                                </div>
                              </motion.div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button onClick={() => { setActiveStory(null); setShowViewers(false); }} 
                    className="p-2.5 rounded-2xl bg-black/40 hover:bg-black/60 text-white transition-all backdrop-blur-md active:scale-95 border border-white/10 shadow-lg">
                    <X className="w-5 h-5 shadow-sm" />
                  </button>

                  {/* OWN STORY DELETE ACTION */}
                  {activeStory.username === myUsername && (
                    <motion.button 
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(255,0,0,0.2)" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteStory(activeStory.id)}
                      className="p-2 rounded-full bg-black/40 text-red-500 border border-red-500/20 backdrop-blur-md shadow-xl transition-all">
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Story content */}
              <div className="flex-1 flex items-center justify-center relative z-10 mt-20 mb-40">
                {activeStory.type === "image" ? (
                  <img src={activeStory.content} alt="" className="w-full h-full object-cover absolute inset-0 rounded-[2.5rem]" />
                ) : (
                  <p className="px-8 text-center font-bold text-2xl leading-snug text-white drop-shadow-lg">
                    "{activeStory.content}"
                  </p>
                )}
              </div>

              {/* ─── BOTTOM BAR: Like + Reaction + Reply ─── */}
              <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-5 pt-4 safe-bottom"
                   style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)", backdropFilter: "blur(4px)" }}>

                {/* Sent reaction feedback */}
                <AnimatePresence>
                  {sentReaction && (
                    <motion.div key="sent-reaction-feedback" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
                      className="text-center mb-2 text-2xl">{sentReaction}</motion.div>
                  )}
                </AnimatePresence>

                {/* Snap reactions row */}
                <AnimatePresence>
                  {showSnapReactions && (
                    <motion.div key="snap-reactions-row" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
                      className="flex justify-center gap-3 mb-3">
                      {SNAP_REACTIONS.map((emoji) => (
                        <motion.button key={emoji} whileHover={{ scale: 1.3 }} whileTap={{ scale: 0.9 }}
                          className="text-2xl" onClick={() => handleSnapReaction(emoji)}>
                          {emoji}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {activeStory.username !== myUsername && (
                  <div className="flex items-center gap-2">
                    {/* Like button */}
                    <motion.button
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => handleLike(activeStory.id, e)}
                      className="h-10 w-10 rounded-full flex items-center justify-center transition-all shrink-0"
                      style={{ background: liked[activeStory.id] ? "rgba(255,0,110,0.25)" : "rgba(255,255,255,0.1)" }}>
                      <motion.span animate={{ scale: liked[activeStory.id] ? [1, 1.5, 1] : 1 }} transition={{ duration: 0.3 }}>
                        <Heart className="w-5 h-5" fill={liked[activeStory.id] ? "#ff006e" : "none"}
                               color={liked[activeStory.id] ? "#ff006e" : "white"} />
                      </motion.span>
                    </motion.button>

                    {/* Emoji reaction */}
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setShowSnapReactions(!showSnapReactions)}
                      className="h-10 w-10 rounded-full flex items-center justify-center text-xl shrink-0"
                      style={{ background: "rgba(255,255,255,0.1)" }}>
                      🔥
                    </motion.button>

                    {/* Reply input */}
                    <div className="flex-1 flex items-center rounded-full px-4 py-2 gap-2"
                         style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
                      <input
                        type="text"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleReply()}
                        placeholder="Reply to story..."
                        className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/40"
                      />
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleReply()}
                        className="text-white/70 hover:text-white transition-colors">
                        <Send className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Like count & Viewers Dropdown */}
                <div className="relative flex flex-col items-center mt-3">
                  {activeStory.username === myUsername && (
                    <>
                      <p className="text-center text-[11px] text-white/50 font-medium cursor-pointer hover:text-white/70 transition-colors"
                         onClick={() => setShowLikers(!showLikers)}>
                        <span className="text-white/90 font-bold">{activeStory.likes}</span> friends liked · Nexora Story Protocol
                      </p>

                      {/* Likers Dropdown Modal */}
                      <AnimatePresence>
                        {showLikers && (
                          <motion.div key="likers-modal" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute bottom-8 w-52 rounded-2xl overflow-hidden shadow-2xl z-50"
                            style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(40px)" }}
                            onClick={(e) => e.stopPropagation()}>
                            <div className="px-3 py-2.5 border-b border-white/10 text-[11px] font-bold flex items-center gap-1.5" style={{ color: "#ffffff", background: "rgba(255,255,255,0.05)" }}>
                              <Heart className="w-3.5 h-3.5" style={{ color: "#ff006e" }} fill="#ff006e" /> Post Likes
                            </div>
                            <div className="max-h-44 overflow-y-auto w-full p-2 space-y-1">
                              {likersList.length === 0 ? (
                                <p className="text-[10px] text-center py-2" style={{ color: "rgba(255,255,255,0.4)" }}>No likes yet</p>
                              ) : (
                                likersList.map((v) => (
                                  <div key={`liker-${v.username}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group/l" style={{ background: "transparent" }}
                                       onClick={(e) => { e.stopPropagation(); setSelectedProfileUser({ username: v.username, name: v.name, color: v.color }); }}
                                       onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                                       onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                    <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${v.color || "from-[#ff006e] to-[#ffbe0b]"} flex items-center justify-center text-[12px] font-black shrink-0 border border-white/20 shadow-lg group-hover/l:scale-110 transition-transform text-white`}>
                                      {(v.name || v.username || "?")[0].toUpperCase()}
                                    </div>
                                    <span className="text-sm font-semibold truncate flex-1 group-hover/l:text-pink-400 transition-colors" style={{ color: "#ffffff" }}>{v.name || v.username}</span>
                                    <Heart className="w-3.5 h-3.5 shrink-0" style={{ color: "#ff006e" }} fill="#ff006e" />
                                  </div>
                                ))
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ REAL-TIME CAMERA / MEDIA STORY OVERLAY ═══ */}
      <AnimatePresence>
        {cameraView.active && (
          <motion.div key="camera-overlay" initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden">
            
            {/* Top Bar */}
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent">
              <button onClick={closeCameraView} className="p-2 bg-black/40 rounded-full text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
              <span className="text-white font-bold text-xs px-3 py-1 bg-black/40 rounded-full">
                Review & Publish
              </span>
            </div>

            {/* Viewfinder */}
            <div className="w-full max-w-lg h-[75%] relative rounded-3xl overflow-hidden bg-gray-900 border-2 border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              {cameraView.capturedUrl ? (
                <img src={cameraView.capturedUrl} alt="Preview" className="w-full h-full object-contain" />
              ) : (
                <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              )}
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-6 w-full max-w-lg flex items-center justify-between px-10 z-10">
              {cameraView.capturedUrl ? (
                <>
                  <button onClick={() => setCameraView(p => ({ ...p, capturedUrl: null }))}
                          className="px-5 py-3 rounded-xl bg-white/20 text-white font-bold hover:bg-white/30 backdrop-blur-md transition-colors">
                    Retake
                  </button>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={publishStory} disabled={isUploading}
                    className={`h-14 flex items-center gap-2 px-6 rounded-full shadow-xl text-white font-bold ${isUploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff]'}`}>
                    <span>{isUploading ? "Uploading..." : "Add to Story"}</span>
                    {!isUploading && <Send className="w-4 h-4" />}
                  </motion.button>
                </>
              ) : (
                <>
                  <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="p-4 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 text-white shadow-xl">
                    <ImageIcon className="w-6 h-6" />
                  </button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={capturePhoto} disabled={isUploading}
                    className="h-20 w-20 rounded-full border-4 border-white/30 flex items-center justify-center p-1">
                    <div className="w-full h-full bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]" />
                  </motion.button>
                  <button onClick={closeCameraView} className="p-4 bg-transparent text-white opacity-50"><Trash2 className="w-6 h-6" /></button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PREMIUM USER PROFILE MODAL ═══ */}
      <AnimatePresence>
        {selectedProfileUser && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[2000] flex items-center justify-center p-4 sm:p-6 backdrop-blur-3xl bg-black/50"
            onClick={() => setSelectedProfileUser(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.9, y: 40, opacity: 0 }}
              className="w-full max-w-[440px] overflow-hidden rounded-[40px] shadow-[0_32px_80px_rgba(0,0,0,0.5)] relative border border-white/10"
              style={{ background: isDark ? "rgba(18, 18, 30, 0.95)" : "rgba(255, 255, 255, 0.98)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`h-36 w-full bg-gradient-to-tr ${selectedProfileUser.color || 'from-[#6c5ce7] to-[#a29bfe]'} relative`}>
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" />
                <button 
                  onClick={() => setSelectedProfileUser(null)}
                  className="absolute top-4 right-4 p-2.5 rounded-2xl bg-black/40 hover:bg-black/60 text-white transition-all backdrop-blur-md active:scale-90 z-[30]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-10 pb-10 -mt-20 relative z-10">
                <div className="flex flex-col items-center">
                  <div className={`h-36 w-36 rounded-[36px] bg-gradient-to-tr ${selectedProfileUser.color || 'from-[#6c5ce7] to-[#a29bfe]'} border-[8px] ${isDark ? 'border-[#12121e]' : 'border-white'} shadow-2xl flex items-center justify-center text-white text-5xl font-black mb-6 relative group/avatar`}>
                    <span className="group-hover/avatar:scale-110 transition-transform duration-500">
                      {selectedProfileUser.name?.[0] || selectedProfileUser.username?.[0] || '?'}
                    </span>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                      {selectedProfileUser.name || selectedProfileUser.username}
                    </h2>
                    <p className="text-base font-black opacity-30 tracking-tight" style={{ color: "var(--text-muted)" }}>
                      @{selectedProfileUser.username}
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4">
                      <span className="px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/10 shadow-sm whitespace-nowrap">
                        Official Node
                      </span>
                      <span className="px-3.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/10 shadow-sm whitespace-nowrap">
                        Encrypted
                      </span>
                    </div>
                  </div>

                  <div className="w-full mb-8 p-6 rounded-[32px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 backdrop-blur-md">
                     <div className="flex items-center gap-2 mb-3 opacity-40">
                        <Lock className="w-3 h-3" />
                        <h4 className="text-[10px] uppercase font-black tracking-[0.2em]">Identity Memo</h4>
                     </div>
                     <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {loadingProfile ? (
                        <span className="opacity-30 italic animate-pulse">Decrypting protocol memo...</span>
                      ) : profileData?.bio || "No secure bio established for this node yet."}
                    </p>
                    <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-between opacity-50 font-black text-[10px] tracking-widest uppercase">
                       <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> EST. {profileData?.created_at ? new Date(profileData.created_at).getFullYear() : '2026'}</div>
                       <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Phase 1.2</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 w-full mb-4">
                     {threads.some(t => t.username === selectedProfileUser.username) ? (
                       <div className="col-span-2 p-5 rounded-[32px] bg-purple-500/10 border border-purple-500/20 flex flex-col items-center text-center">
                          <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Mutual Node Active</p>
                          <p className="text-[9px] text-purple-600/60 font-bold mt-1">Open Chat to initiate secure media stream</p>
                       </div>
                     ) : (
                       <div className="col-span-2 p-5 rounded-[32px] bg-amber-500/5 border border-amber-500/10 flex flex-col items-center text-center">
                          <div className="p-2.5 rounded-2xl bg-amber-500/10 mb-2">
                             <ShieldOff className="w-5 h-5 text-amber-500" />
                          </div>
                          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Protocol Restriction</p>
                          <p className="text-[9px] text-amber-600/60 font-bold mt-1">Direct communication requires mutual connection</p>
                       </div>
                     )}
                  </div>

                  <div className="flex gap-3 w-full">
                    <motion.button 
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                      onClick={() => { 
                         window.location.href = `/dashboard/chats?u=${selectedProfileUser.username}`;
                      }}
                      className="flex-1 py-4.5 rounded-[28px] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-black uppercase text-[11px] tracking-widest transition-all"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Message Node
                    </motion.button>
                    
                    {blockedThreads.includes(selectedProfileUser.id || 0) ? (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleUnblockUser(selectedProfileUser.id || 0)}
                        className="px-8 py-4.5 rounded-[28px] bg-green-500/10 text-green-500 font-black uppercase text-[11px] tracking-widest border border-green-500/20"
                      >
                        Unblock
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleBlockUser(selectedProfileUser.id || 0)}
                        className="px-8 py-4.5 rounded-[28px] bg-red-500/10 text-red-500 font-black uppercase text-[11px] tracking-widest border border-red-500/20"
                      >
                        Block
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
