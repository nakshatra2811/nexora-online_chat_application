"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Clock, Eye, Plus, Heart, Send, Camera, Zap, ImageIcon, Trash2, Users } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";

const SNAP_REACTIONS = ["🔥", "❤️", "😮", "👏", "💎", "🚀"];

export default function StoriesPage() {
  const { isDark } = useTheme();
  const [otherStories, setOtherStories] = useState<any[]>([]);
  
  // Your story state
  const [myStory, setMyStory] = useState<any | null>(null);

  const [reply, setReply] = useState("");
  const [showSnapReactions, setShowSnapReactions] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
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

  const fetchStories = async () => {
    try {
      const username = localStorage.getItem("nexora_signup_username");
      if (!username) return;
      
      const data = await nexoraFetch(`/api/stories?username=${username}`);
      if (data && data.stories) {
        // Map backend schema to frontend structure
        const mapped = data.stories.map((s: any) => ({
          id: s.id,
          username: s.username,
          user: s.name || s.username,
          time: new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
        
        if (mine.length > 0) {
          setMyStory(mine[0]); // For now, just show the latest own story on the dashboard
        } else {
          setMyStory(null);
        }
        
        setOtherStories(others);
        
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
    // Poll every 10 seconds for real-time updates
    const interval = setInterval(fetchStories, 10000);
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

  const handleLike = async (storyId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    
    // Optimistic UI update
    setLiked((prev) => ({ ...prev, [storyId]: !prev[storyId] }));
    setLikeCount((prev) => ({ ...prev, [storyId]: prev[storyId] + (liked[storyId] ? -1 : 1) }));
    
    try {
      await nexoraFetch("/api/stories/like", {
        method: "POST",
        body: JSON.stringify({ storyId, username })
      });
    } catch {
      // Revert on fail
      setLiked((prev) => ({ ...prev, [storyId]: !prev[storyId] }));
      setLikeCount((prev) => ({ ...prev, [storyId]: prev[storyId] + (liked[storyId] ? 1 : -1) }));
    }
  };

  const handleReply = () => {
    if (!reply.trim()) return;
    setReply("");
    setSentReaction("✓ Sent!");
    setTimeout(() => setSentReaction(null), 2000);
  };

  const handleSnapReaction = (emoji: string) => {
    setShowSnapReactions(false);
    setSentReaction(emoji);
    setTimeout(() => setSentReaction(null), 2000);
  };

  const handleNewSnap = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });
    await submitNewStory(url);
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

  const submitNewStory = async (mediaUrl: string) => {
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    try {
      await nexoraFetch("/api/stories", {
         method: "POST",
         body: JSON.stringify({ username, mediaUrl, mediaType: "image", caption: "" })
      });
      fetchStories(); // Refresh after publish
    } catch (e) {
      alert("Failed to submit story.");
    }
  };

  const publishStory = async () => {
    if (!cameraView.capturedUrl) return;
    await submitNewStory(cameraView.capturedUrl);
    closeCameraView();
  };

  const closeCameraView = () => {
    cameraView.stream?.getTracks().forEach(t => t.stop());
    setCameraView({ active: false, stream: null, capturedUrl: null });
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
        {!myStory ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.03, y: -3 }} whileTap={{ scale: 0.97 }}
            onClick={startCameraView}
            className="flex flex-col items-center cursor-pointer group"
          >
            <div className="relative mb-3">
              <div className="w-20 h-20 rounded-full flex items-center justify-center bg-transparent"
                   style={{ border: `2px dashed ${isDark ? "rgba(108,92,231,0.4)" : "rgba(108,92,231,0.3)"}` }}>
                <Plus className="w-8 h-8" style={{ color: "#6c5ce7" }} />
              </div>
            </div>
            <h3 className="font-bold text-xs text-center" style={{ color: "var(--text-secondary)" }}>Your Story</h3>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center cursor-pointer group relative"
          >
            <div className="relative mb-3" onClick={() => setActiveStory(myStory)}>
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${myStory.color} shadow-lg group-hover:shadow-2xl transition-shadow`}>
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center relative bg-black"
                     style={{ border: `3px solid ${isDark ? "#0a0a12" : "#f0f2f8"}` }}>
                  {myStory.type === "image" ? (
                    <img src={myStory.content} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-3xl text-white">Y</span>
                  )}
                  <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </motion.div>
                </div>
              </div>
              
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold text-white bg-black/60 backdrop-blur-md">
                <Eye className="w-2.5 h-2.5" /> {myStory.views}
              </div>
            </div>

            <h3 className="font-bold text-xs text-center truncate w-full px-1" style={{ color: "var(--text-primary)" }}>
              Your Story
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-2.5 h-2.5" /> {myStory.time}
            </p>


          </motion.div>
        )}

        {otherStories.map((story, i) => (
          <motion.div key={story.id}
            initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 + 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center cursor-pointer group relative"
          >
            {/* Ring + Avatar */}
            <div className="relative mb-3" onClick={() => setActiveStory(story)}>
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${story.color} shadow-lg group-hover:shadow-2xl transition-shadow`}>
                <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center relative"
                     style={{ background: isDark ? "#1a1a2e" : "#ffffff", border: `3px solid ${isDark ? "#0a0a12" : "#f0f2f8"}` }}>
                  {story.type === "image" ? (
                    <img src={story.content} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-3xl" style={{ color: "var(--text-primary)" }}>{story.user[0]}</span>
                  )}
                  {/* Play hover */}
                  <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-full">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </motion.div>
                </div>
              </div>

              {/* View dot no longer needed on other stories, but keep isViewed style if I want */}
            </div>

            <h3 className="font-bold text-xs text-center truncate w-full px-1" style={{ color: "var(--text-primary)" }}>
              {story.user}
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-2.5 h-2.5" /> {story.time}
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
              onMouseDown={() => setIsPaused(true)}
              onMouseUp={() => setIsPaused(false)}
              onMouseLeave={() => setIsPaused(false)}
              onTouchStart={() => setIsPaused(true)}
              onTouchEnd={() => setIsPaused(false)}
              className={`relative w-full h-full md:h-[85vh] md:max-h-[760px] md:max-w-sm flex flex-col md:rounded-[2.5rem] overflow-hidden shadow-2xl md:mt-0`}
              style={{ background: `linear-gradient(135deg, #0a0a1a, #1a1a30)` }}
            >
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
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-white">
                    {activeStory.user[0]}
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">{activeStory.user}</p>
                    <p className="text-xs text-white/60">{activeStory.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 relative">
                  {/* Viewers Trigger Button (Only for My Story) */}
                  {activeStory.username === localStorage.getItem("nexora_signup_username") && (
                    <button onClick={() => setShowViewers(!showViewers)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 backdrop-blur-md text-white/90 text-[11px] font-bold border border-white/10 shadow-xl transition-colors hover:bg-black/60 cursor-pointer">
                      <Eye className="w-3 h-3 text-[#2ed573]" /> {activeStory.views} <span className="text-white/50 font-normal">friends viewed</span>
                    </button>
                  )}
                  
                  {/* Viewers Dropdown Modal (ONLY for own story) */}
                  <AnimatePresence>
                    {activeStory.username === localStorage.getItem("nexora_signup_username") && showViewers && (
                      <motion.div initial={{ opacity: 0, y: -10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-12 top-10 w-52 rounded-2xl overflow-hidden shadow-2xl z-50"
                        style={{ background: "#0d0d1a", border: "1px solid rgba(255,255,255,0.15)", backdropFilter: "blur(40px)" }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="px-3 py-2.5 border-b border-white/10 text-xs font-bold flex items-center gap-1.5" style={{ color: "#ffffff", background: "rgba(255,255,255,0.05)" }}>
                          <Users className="w-3.5 h-3.5" /> Viewer Activity
                        </div>
                        <div className="max-h-44 overflow-y-auto w-full p-2 space-y-1">
                          {viewersList.length === 0 ? (
                            <p className="text-xs text-center py-2" style={{ color: "rgba(255,255,255,0.4)" }}>No views yet</p>
                          ) : (
                            viewersList.map((v, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer" style={{ background: "transparent" }}
                                   onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                                   onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <div className={`w-7 h-7 rounded-full bg-gradient-to-tr flex items-center justify-center text-[11px] font-bold shrink-0 ${v.color || "from-[#6c5ce7] to-[#00d4ff]"}`} style={{ color: "#ffffff" }}>
                                  {v.name[0]}
                                </div>
                                <span className="text-sm font-semibold truncate" style={{ color: "#ffffff" }}>{v.name}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button onClick={() => { setActiveStory(null); setShowViewers(false); }} className="p-2 rounded-full bg-white/15 hover:bg-white/30 text-white transition">
                    <X className="w-4 h-4" />
                  </button>
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
                    <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
                      className="text-center mb-2 text-2xl">{sentReaction}</motion.div>
                  )}
                </AnimatePresence>

                {/* Snap reactions row */}
                <AnimatePresence>
                  {showSnapReactions && (
                    <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
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

                {activeStory.username !== localStorage.getItem("nexora_signup_username") && (
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
                      <motion.button whileTap={{ scale: 0.9 }} onClick={handleReply}
                        className="text-white/70 hover:text-white transition-colors">
                        <Send className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Like count & Viewers Dropdown */}
                <div className="relative flex flex-col items-center mt-3">
                  {activeStory.username === localStorage.getItem("nexora_signup_username") && (
                    <>
                      <p className="text-center text-[11px] text-white/50 font-medium cursor-pointer hover:text-white/70 transition-colors"
                         onClick={() => setShowLikers(!showLikers)}>
                        <span className="text-white/90 font-bold">{activeStory.likes}</span> friends liked · Nexora Story Protocol
                      </p>

                      {/* Likers Dropdown Modal */}
                      <AnimatePresence>
                        {showLikers && (
                          <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
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
                                likersList.map((v, idx) => (
                                  <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer" style={{ background: "transparent" }}
                                       onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                                       onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                    <div className={`w-7 h-7 rounded-full bg-gradient-to-tr flex items-center justify-center text-[11px] font-bold shrink-0 ${v.color || "from-[#ff006e] to-[#ffbe0b]"}`} style={{ color: "#ffffff" }}>
                                      {v.name[0]}
                                    </div>
                                    <span className="text-sm font-semibold truncate flex-1" style={{ color: "#ffffff" }}>{v.name}</span>
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
          <motion.div initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
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
                  <motion.button whileTap={{ scale: 0.9 }} onClick={publishStory}
                    className="h-14 flex items-center gap-2 px-6 rounded-full bg-gradient-to-br from-[#6c5ce7] to-[#00d4ff] shadow-xl text-white font-bold">
                    <span>Add to Story</span>
                    <Send className="w-4 h-4" />
                  </motion.button>
                </>
              ) : (
                <>
                  <button onClick={() => fileInputRef.current?.click()} className="p-4 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 text-white shadow-xl">
                    <ImageIcon className="w-6 h-6" />
                  </button>
                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={capturePhoto}
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
    </div>
  );
}
