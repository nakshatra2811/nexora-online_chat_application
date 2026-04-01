"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, X, Clock, Eye, Plus, Heart, Send, Camera, Zap, ImageIcon, Trash2, Users, Phone, Video, Shield, Lock, ShieldOff, MoreVertical, RefreshCcw } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";

const SNAP_REACTIONS = ["🔥", "❤️", "😮", "👏", "💎", "🚀"];

// Formats count for display (removes leading zeros)
const formatCount = (n: number) => String(n);

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
  const [otherStories, setOtherStories] = useState<any[]>([]); // Grouped other users' stories
  const [allOtherStories, setAllOtherStories] = useState<any[]>([]); // Flattened list for the viewer navigation
  
  // Your story state
  const [myStories, setMyStories] = useState<any[]>([]); // All my stories
  const [myStory, setMyStory] = useState<any | null>(null); // Legacy compatibility/shortcut for first story
  const [myUsername, setMyUsername] = useState("");

  const [reply, setReply] = useState("");
  const [showReactions, setShowReactions] = useState<{ [id: number]: boolean }>({});
  const [storyToDelete, setStoryToDelete] = useState<number | null>(null);
  const [showSnapReactions, setShowSnapReactions] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const lastTapRef = useRef<number>(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Real-time Camera
  const [cameraView, setCameraView] = useState<{ active: boolean; stream: MediaStream | null; capturedUrl: string | null; facingMode: "user" | "environment" }>({ active: false, stream: null, capturedUrl: null, facingMode: "environment" });
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  
  // Real-time viewer tracking
  const [showViewers, setShowViewers] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [viewersList, setViewersList] = useState<any[]>([]);
  const [likersList, setLikersList] = useState<any[]>([]);

  // Profile Modal State
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [blockedThreads, setBlockedThreads] = useState<number[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});

  useEffect(() => {
    const username = localStorage.getItem("nexora_signup_username") || "";
    setMyUsername(username);
    const blocked = JSON.parse(localStorage.getItem("nexora_blocked_threads") || "[]");
    setBlockedThreads(blocked);
    const savedNicknames = localStorage.getItem("nexora_nicknames");
    if (savedNicknames) setNicknames(JSON.parse(savedNicknames));
    
    // Fetch current user's own profile (once on mount) for avatar
    const fetchMe = async () => {
      try {
        const u = localStorage.getItem("nexora_signup_username");
        // Fast path: use cached avatar first
        const cachedAvatar = localStorage.getItem("nexora_avatar_url");
        if (cachedAvatar) setCurrentUser((prev: any) => ({ ...(prev || {}), avatarUrl: cachedAvatar }));
        // Then fetch fresh from server
        const res = await nexoraFetch(`/api/users/profile?username=${u}`);
        if (res && res.user) {
          setCurrentUser(res.user);
          if (res.user.avatarUrl) localStorage.setItem("nexora_avatar_url", res.user.avatarUrl);
        }
      } catch (e) { console.error(e); }
    };
    
    fetchMe();
  }, []); // Run only once on mount

  useEffect(() => {
    // Fetch threads to check connections for calling (re-runs when selectedProfileUser changes)
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
        
        const mine = mapped.filter((s: any) => s.username === username).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const othersFlattened = mapped.filter((s: any) => s.username !== username);
        
        // Group others by username
        const groupedMap: Record<string, any> = {};
        othersFlattened.forEach((s: any) => {
          if (!groupedMap[s.username]) {
            groupedMap[s.username] = {
              id: s.username, // Use username as ID for the group
              username: s.username,
              user: s.user,
              avatarUrl: s.avatarUrl || s.avatar_url,
              color: s.color,
              created_at: s.created_at,
              isViewed: true, // Will calculate below
              stories: []
            };
          }
          groupedMap[s.username].stories.push(s);
          if (!s.isViewed) groupedMap[s.username].isViewed = false;
        });

        // Ensure individual story lists are strictly ASC (oldest first)
        Object.values(groupedMap).forEach((group: any) => {
          group.stories.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        });

        // Sort groups such that the one with the NEWEST story update comes first (Snapchat style)
        // or OLDEST if user explicitly asked for chronological feed?
        // User said: "ensure story playback follows a strict chronological order" (usually means oldest-first playback)
        // and "sort from Oldest to Newest" in implementation plan.
        // Sort groups such that the one with the NEWEST updated story comes first
        const othersGrouped = Object.values(groupedMap).sort((a: any, b: any) => {
          const aLast = a.stories[a.stories.length - 1].created_at;
          const bLast = b.stories[b.stories.length - 1].created_at;
          return new Date(bLast).getTime() - new Date(aLast).getTime();
        });
        
        setMyStories(mine);
        setMyStory(mine.length > 0 ? mine[0] : null);
        setOtherStories(othersGrouped);
        setAllOtherStories(othersFlattened);
        
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
          initialLikeCount[s.id] = Number(s.likes || 0);
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

  // Handle URL params for auto-opening stories or camera
  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    const targetUser = urlParams.get('user');
    const action = urlParams.get('action');

    if (action === 'camera' && !cameraView.active) {
       startCameraView();
       // Clean up URL so it doesn't trigger again on re-renders
       const newUrl = window.location.pathname;
       window.history.replaceState({}, '', newUrl);
    } else if (targetUser && !activeStory) {
       const myUsername = localStorage.getItem("nexora_signup_username");
       if (targetUser === myUsername || targetUser === 'me') {
          if (myStories.length > 0) {
            setActiveStory(myStories[0]);
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
       } else {
          const userStories = allOtherStories.filter((s: any) => s.username === targetUser);
          if (userStories.length > 0) {
            setActiveStory(userStories[0]);
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
          }
       }
    }
  }, [myStories, allOtherStories, cameraView.active]);

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
          }).then(() => {
             // Optimistically mark as viewed in local state
             const updateGroup = (prev: any[]) => prev.map(group => {
                if (group.username === activeStory.username) {
                   return {
                      ...group,
                      isViewed: group.stories.every((s: any) => s.id === activeStory.id || s.isViewed),
                      stories: group.stories.map((s: any) => s.id === activeStory.id ? { ...s, isViewed: true, views: (s.views || 0) + 1 } : s)
                   };
                }
                return group;
             });
             
             setOtherStories(updateGroup);
             setActiveStory((prev: any) => prev?.id === activeStory.id ? { ...prev, isViewed: true, views: (prev.views || 0) + 1 } : prev);
             
             // Refresh stats immediately
             nexoraFetch(`/api/stories/stats?storyId=${activeStory.id}`).then((data) => {
               if (data) {
                 setViewersList(data.views || []);
                 setLikersList(data.likes || []);
               }
             });
          });
        }
      }
    }
  }, [activeStory?.id]);

  // Hide mobile navbar when story is open
  useEffect(() => {
    if (activeStory) {
      document.body.classList.add("chat-active");
    } else {
      document.body.classList.remove("chat-active");
    }
    return () => document.body.classList.remove("chat-active");
  }, [activeStory]);

  const advanceStory = (direction: "next" | "prev" = "next") => {
    setActiveStory((prev: any) => {
      if (!prev) return null;
      
      const username = prev.username;
      const myUsername = localStorage.getItem("nexora_signup_username");
      const currentStories = username === myUsername 
        ? myStories
        : otherStories.find(g => g.username === username)?.stories || [];
      
      const internalIdx = currentStories.findIndex((s: any) => s.id === prev.id);
      
      if (direction === "next") {
        if (internalIdx >= 0 && internalIdx < currentStories.length - 1) {
          return currentStories[internalIdx + 1];
        }
        if (username === myUsername) {
           return otherStories.length > 0 ? otherStories[0].stories[0] : null;
        }
        const groupIdx = otherStories.findIndex((g) => g.username === username);
        if (groupIdx >= 0 && groupIdx < otherStories.length - 1) {
          return otherStories[groupIdx + 1].stories[0];
        }
        return null; // End of stories
      } else {
        if (internalIdx > 0) {
          return currentStories[internalIdx - 1];
        }
        if (username === myUsername) {
           return null; // Can't go back further
        }
        const groupIdx = otherStories.findIndex((g) => g.username === username);
        if (groupIdx > 0) {
          const prevGroup = otherStories[groupIdx - 1].stories;
          return prevGroup[prevGroup.length - 1];
        } else if (myStories.length > 0) {
          return myStories[myStories.length - 1];
        }
        return null;
      }
    });
    setProgress(0);
  };

  useEffect(() => {
    if (!activeStory || isPaused) {
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }
    
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          advanceStory("next");
          return 0;
        }
        return p + 0.5; // 5 seconds total (100 / 0.5 * 25ms ≈ 5s)
      });
    }, 25);
    
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [activeStory, isPaused, otherStories, myUsername]);

  const handleLike = async (storyId: number, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) e.stopPropagation();
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    
    // If already liked, just toggle state locally (unliking)
    if (liked[storyId]) {
      setLiked(prev => ({ ...prev, [storyId]: false }));
      setLikeCount(prev => ({ ...prev, [storyId]: Math.max(0, Number(prev[storyId] || 0) - 1) }));
    } else {
      // New Like: Show burst animation
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);

      setLiked(prev => ({ ...prev, [storyId]: true }));
      setLikeCount(prev => ({ ...prev, [storyId]: Number(prev[storyId] || 0) + 1 }));
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
    
    const fileDataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.readAsDataURL(file);
    });

    // Create an image to read dimensions
    const img = new Image();
    img.src = fileDataUrl;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
    });

    // Force 1080x1920 (9:16)
    const targetW = 1080;
    const targetH = 1920;
    const targetAspect = targetW / targetH;
    const imgAspect = img.width / img.height;

    let drawW, drawH, drawX, drawY;

    if (imgAspect > targetAspect) {
      // Image is too wide, crop sides
      drawH = img.height;
      drawW = img.height * targetAspect;
      drawX = (img.width - drawW) / 2;
      drawY = 0;
    } else {
      // Image is too tall
      drawW = img.width;
      drawH = img.width / targetAspect;
      drawX = 0;
      drawY = (img.height - drawH) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    
    if (ctx) {
      // White background for safety
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, drawX, drawY, drawW, drawH, 0, 0, targetW, targetH);
      const url = canvas.toDataURL("image/jpeg", 0.9);
      
      setCameraView({ active: true, stream: null, capturedUrl: url, facingMode: "environment" });
    } else {
      // Fallback
      setCameraView({ active: true, stream: null, capturedUrl: fileDataUrl, facingMode: "environment" });
    }

    if (e.target) e.target.value = '';
  };

  const startCameraView = async (facingMode: "user" | "environment" = "environment") => {
    try {
      // 1. First try to force exact facing mode (solves mobile stubbornness)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: { exact: facingMode },
              width: { ideal: 1080 },
              height: { ideal: 1920 }
            } 
        });
      } catch (err) {
        // Fallback for laptops/desktops with only one camera
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode,
              width: { ideal: 1080 },
              height: { ideal: 1920 }
            } 
        });
      }
      setCameraView({ active: true, stream, capturedUrl: null, facingMode });
    } catch {
      alert("Camera access denied. Opening file picker instead.");
      fileInputRef.current?.click();
    }
  };



  const flipCamera = async () => {
    const newMode = cameraView.facingMode === "user" ? "environment" : "user";
    if (cameraView.stream) {
      cameraView.stream.getTracks().forEach(t => t.stop());
    }
    await startCameraView(newMode);
  };

  const capturePhoto = () => {
    if (!liveVideoRef.current) return;
    const video = liveVideoRef.current;
    
    // Force 1080x1920 (9:16 Aspect Ratio) exactly
    const targetW = 1080;
    const targetH = 1920;
    const targetAspect = targetW / targetH;
    
    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    const videoAspect = videoW / videoH;
    
    let drawW, drawH, drawX, drawY;
    
    if (videoAspect > targetAspect) {
      // Video is too wide, crop horizontally
      drawH = videoH;
      drawW = videoH * targetAspect;
      drawX = (videoW - drawW) / 2;
      drawY = 0;
    } else {
      // Video is too tall, crop vertically
      drawW = videoW;
      drawH = videoW / targetAspect;
      drawX = 0;
      drawY = (videoH - drawH) / 2;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Mirror the image if it's the front camera so it captures as the user sees it
    if (cameraView.facingMode === "user") {
      ctx.translate(targetW, 0);
      ctx.scale(-1, 1);
    }
    
    // Draw cropped portion from video exactly into 1080x1920 canvas
    ctx.drawImage(video, drawX, drawY, drawW, drawH, 0, 0, targetW, targetH);
    
    const url = canvas.toDataURL("image/jpeg", 0.9);
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
         showToast("Upload failed. File might be too large.", "error");
      } else {
         await fetchStories();
         showToast("Your story is live! ✨", "success");
      }
    } catch (e) {
      showToast("Failed to submit story.", "error");
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
    setCameraView({ active: false, stream: null, capturedUrl: null, facingMode: "environment" });
  };

  const handleDeleteStory = async (storyId: number) => {
    const username = localStorage.getItem("nexora_signup_username");
    if (!username) return;
    try {
      await nexoraFetch(`/api/stories/${storyId}?username=${encodeURIComponent(username)}`, { method: "DELETE" });
      setStoryToDelete(null);
      setActiveStory(null);
      setToast({ message: "Story deleted successfully", type: "success" });
      setTimeout(() => setToast(null), 3000);
      await fetchStories();
    } catch (e) {
      setToast({ message: "Failed to delete story", type: "error" });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <>
    {/* Custom Story Delete Confirmation Modal */}
    <AnimatePresence>
      {storyToDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setStoryToDelete(null)}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-[340px] rounded-[32px] overflow-hidden border border-white/10 shadow-2xl"
            style={{ 
              background: "linear-gradient(135deg, rgba(30,30,45,0.95), rgba(15,15,25,0.95))",
              backdropFilter: "blur(40px)"
            }}
          >
            <div className="pt-8 pb-4 px-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-7 h-7 text-red-500" />
              </div>
              <h3 className="text-xl font-black mb-2 tracking-tight" style={{ color: "#ffffff" }}>Delete Story?</h3>
              <p className="text-[13px] font-bold leading-relaxed px-2" style={{ color: "rgba(255, 255, 255, 0.7)" }}>
                This story will be permanently removed from Nexora and the database.
              </p>
            </div>
            
            <div className="p-4 flex flex-col gap-2">
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "rgba(239,68,68,1)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDeleteStory(storyToDelete)}
                className="w-full py-4 rounded-2xl bg-red-600 font-black text-sm tracking-widest uppercase transition-colors shadow-lg"
                style={{ color: "#ffffff" }}
              >
                Delete
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.1)" }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStoryToDelete(null)}
                className="w-full py-4 rounded-2xl bg-white/5 font-black text-sm tracking-widest uppercase transition-colors"
                style={{ color: "rgba(255,255,255,0.7)" }}
              >
                Cancel
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Toast Notification */}
    <AnimatePresence>
      {toast && (
        <motion.div
          key="story-toast"
          initial={{ opacity: 0, y: 60, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.9 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[9999] px-6 py-3 rounded-full text-white text-sm font-bold shadow-2xl flex items-center gap-2 backdrop-blur-md"
          style={{ background: toast.type === "success" ? "linear-gradient(135deg,#2ed573,#00d4ff)" : "linear-gradient(135deg,#ff006e,#ff4757)" }}
        >
          <span>{toast.type === "success" ? "✓" : "✗"}</span>
          {toast.message}
        </motion.div>
      )}
    </AnimatePresence>

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
          onClick={() => startCameraView()}
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
              {/* Ring: Instagram gradient if story exists, dashed if not */}
              <div
                className={`p-[3px] rounded-full transition-all duration-500 cursor-pointer ${
                  myStories.length > 0
                    ? 'bg-gradient-to-tr from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888] shadow-lg shadow-pink-500/20'
                    : isDark ? 'bg-white/10' : 'bg-black/10'
                }`}
                onClick={() => myStories.length > 0 ? setActiveStory(myStories[0]) : startCameraView()}>

                <div className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center relative"
                     style={{ background: isDark ? "#1a1a2e" : "#f0f0f0", border: `3px solid ${isDark ? "#0a0a12" : "#ffffff"}` }}>

                  {currentUser?.avatarUrl ? (
                    <img src={currentUser.avatarUrl} alt="Your story" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-3xl" style={{ color: "var(--text-primary)" }}>{(myUsername || "?")[0].toUpperCase()}</span>
                  )}

                  <motion.div initial={{ opacity: 0 }} whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                    {myStory ? <Play className="w-6 h-6 text-white" fill="white" /> : <Camera className="w-6 h-6 text-white" />}
                  </motion.div>
                </div>
              </div>

              {/* Plus Badge - ALWAYS visible on your story */}
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }} whileHover={{ scale: 1.15 }}
                onClick={(e) => { e.stopPropagation(); startCameraView(); }}
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center shadow-lg z-20 border-[3px]"
                style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", borderColor: isDark ? "#0a0a12" : "#ffffff" }}>
                <Plus className="w-4 h-4 text-white stroke-[3px]" />
              </motion.div>

              {/* View + Like Count Badge — Total for all active stories */}
              {myStories.length > 0 && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-black/75 backdrop-blur-md shadow-lg z-20 border border-white/10 whitespace-nowrap font-mono tracking-widest">
                  <Eye className="w-3 h-3 shrink-0" /> {formatCount(myStories.reduce((acc, s) => acc + (s.views || 0), 0))}
                  <span className="opacity-30">·</span>
                  <Heart className="w-3 h-3 text-[#ff006e] shrink-0" fill="#ff006e" /> {formatCount(myStories.reduce((acc, s) => acc + (likeCount[s.id] || s.likes || 0), 0))}
                </div>
              )}
            </div>

            <h3 className="font-bold text-xs text-center truncate w-full px-1" style={{ color: "var(--text-primary)" }}>
              Your Story
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1 justify-center" style={{ color: "var(--text-muted)" }}>
              {myStories.length > 0 ? <><Clock className="w-2.5 h-2.5" /> {getTimeAgo(myStories[0].created_at, now)}</> : "Add to story"}
            </p>
          </motion.div>

        {otherStories.map((group, i) => (
          <motion.div key={group.username}
            initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 + 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04, y: -4 }} whileTap={{ scale: 0.97 }}
            className="flex flex-col items-center cursor-pointer group relative"
          >            {/* Ring + Avatar */}
            <div className="relative mb-3" onClick={() => setActiveStory(group.stories[0])}>
              <div className={`p-[3px] rounded-full bg-gradient-to-tr ${group.isViewed ? 'from-gray-400 to-gray-600' : 'from-[#f09433] via-[#e6683c] via-[#dc2743] via-[#cc2366] to-[#bc1888]'} shadow-lg group-hover:shadow-2xl transition-shadow`}>
                <div className="w-[84px] h-[84px] rounded-full overflow-hidden flex items-center justify-center relative"
                     style={{ background: isDark ? "#1a1a2e" : "#ffffff", border: `3px solid ${isDark ? "#0a0a12" : "#ffffff"}` }}>
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-extrabold text-3xl" style={{ color: "var(--text-primary)" }}>{(nicknames[group.username]?.[0] || group.user?.[0] || group.username?.[0] || "?").toUpperCase()}</span>
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
              {nicknames[group.username] || group.user || group.username}
            </h3>
            <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-2.5 h-2.5" /> {getTimeAgo(group.stories[group.stories.length - 1].created_at, now)}
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

              {/* Segmented Loading Bar: One part per story */}
              <div className="absolute top-3 md:top-3 left-4 right-4 h-[3px] z-20 flex gap-1.5 safe-top">
                {(activeStory.username === myUsername 
                  ? myStories 
                  : otherStories.find(g => g.username === activeStory.username)?.stories || []
                ).map((s: any, idx: number, arr: any[]) => {
                  const activeIdx = arr.findIndex(st => st.id === activeStory.id);
                  return (
                    <div key={s.id} className="h-full flex-1 rounded-full bg-white/20 overflow-hidden">
                      <motion.div 
                        className="h-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" 
                        initial={false}
                        animate={{ 
                          width: idx < activeIdx ? "100%" : (idx === activeIdx ? `${progress}%` : "0%") 
                        }}
                        transition={{ duration: idx === activeIdx ? 0 : 0.15 }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Header */}
              <div className="absolute top-8 md:top-8 left-0 w-full px-5 flex justify-between items-center z-20 safe-top">
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setSelectedProfileUser({ username: activeStory.username, name: activeStory.user, color: activeStory.color })}>
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-tr ${activeStory.color?.includes('from-') ? activeStory.color : 'from-[#6c5ce7] to-[#00d4ff]'} border-[3px] border-white/20 shadow-lg flex items-center justify-center font-extrabold text-white transition-transform group-hover:scale-105 uppercase overflow-hidden`}>
                    {activeStory.avatar_url ? <img src={activeStory.avatar_url} alt="" className="w-full h-full object-cover" /> : (nicknames[activeStory.username]?.[0] || activeStory.user?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-black text-[15px] truncate drop-shadow-md tracking-tight leading-none">
                      {activeStory.name || activeStory.username}
                    </h3>
                    <p className="text-white/60 text-[11px] font-bold tracking-wide mt-0.5">
                      {getTimeAgo(activeStory.created_at, now)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Close button */}
                  <button onClick={() => { setActiveStory(null); setShowViewers(false); setShowLikers(false); }}
                    className="p-2.5 rounded-2xl bg-black/40 hover:bg-black/60 text-white transition-all backdrop-blur-md active:scale-95 border border-white/10 shadow-lg">
                    <X className="w-5 h-5 shadow-sm" />
                  </button>

                  {/* OWN STORY DELETE ACTION */}
                  {activeStory.username === myUsername && (
                    <motion.button
                      whileHover={{ scale: 1.1, backgroundColor: "rgba(255,0,0,0.2)" }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setStoryToDelete(activeStory.id);
                      }}
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
                {/* Navigation Zones: Improved for mobile/one-handed use */}
                <div 
                  className="absolute left-0 top-0 bottom-0 w-[25%] z-20 cursor-pointer active:bg-white/5 transition-colors"
                  onClick={(e) => { e.stopPropagation(); advanceStory("prev"); }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
                <div 
                  className="absolute right-0 top-0 bottom-0 w-[75%] z-20 cursor-pointer active:bg-white/5 transition-colors"
                  onClick={(e) => { e.stopPropagation(); advanceStory("next"); }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>

              {/* ─── BOTTOM BAR: Like + Reaction + Reply ─── */}
              <div className="absolute bottom-0 left-0 right-0 z-20 px-3 md:px-5 pb-4 md:pb-6 pt-6 safe-bottom"
                   style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)", pointerEvents: "auto" }}>

                {/* Sent reaction feedback */}
                <AnimatePresence>
                  {sentReaction && (
                    <motion.div key="sent-reaction-feedback" initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
                      className="text-center mb-3 text-2xl font-black">{sentReaction}</motion.div>
                  )}
                </AnimatePresence>

                {/* Snap reactions row */}
                <AnimatePresence>
                  {showSnapReactions && (
                    <motion.div key="snap-reactions-row" initial={{ y: 15, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 10, opacity: 0, scale: 0.9 }}
                      className="flex justify-center gap-2 md:gap-4 mb-4 bg-black/40 backdrop-blur-xl py-3 px-4 rounded-full border border-white/10 w-max mx-auto shadow-2xl">
                      {SNAP_REACTIONS.map((emoji) => (
                        <motion.button key={emoji} whileHover={{ scale: 1.35 }} whileTap={{ scale: 0.85 }}
                          className="text-3xl text-shadow-xl" onClick={() => handleSnapReaction(emoji)}>
                          {emoji}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {activeStory.username !== myUsername && (
                  <div className="flex items-center gap-2.5 md:gap-4 w-full">
                    {/* Reply input with premium glassmorphism */}
                    <div className="flex-1 flex items-center rounded-full px-5 py-3.5 gap-3 shadow-2xl transition-all group overflow-hidden"
                         style={{ 
                           background: "rgba(255,255,255,0.08)", 
                           border: "1px solid rgba(255,255,255,0.12)", 
                           backdropFilter: "blur(24px)",
                           boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
                         }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00d4ff] animate-pulse" />
                      <input
                        type="text"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleReply()}
                        placeholder="Reply to story..."
                        className="flex-1 bg-transparent min-w-0 outline-none text-[15px] text-white placeholder:text-white/40 font-bold tracking-tight"
                      />
                      <motion.button 
                        whileHover={{ scale: 1.1, color: "#00d4ff" }}
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => handleReply()}
                        className="text-white opacity-60 hover:opacity-100 transition-all shrink-0">
                        <Send className="w-5 h-5" />
                      </motion.button>
                    </div>

                    {/* Like button with neon-glow state */}
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.8 }}
                      onClick={(e) => handleLike(activeStory.id, e)}
                      className="h-[54px] w-[54px] rounded-full flex items-center justify-center transition-all shrink-0 shadow-2xl relative border"
                      style={{ 
                        background: liked[activeStory.id] ? "rgba(255,0,110,0.3)" : "rgba(255,255,255,0.08)", 
                        borderColor: liked[activeStory.id] ? "rgba(255,0,110,0.6)" : "rgba(255,255,255,0.12)",
                        backdropFilter: "blur(24px)",
                        boxShadow: liked[activeStory.id] ? "0 0 25px rgba(255,0,110,0.4)" : "0 8px 32px rgba(0,0,0,0.4)"
                      }}>
                      <motion.span 
                         animate={{ scale: liked[activeStory.id] ? [1, 1.4, 1] : 1 }} 
                         transition={{ duration: 0.45, times: [0, 0.5, 1], ease: "easeInOut" }}>
                        <Heart className="w-[28px] h-[28px] transition-all" 
                               fill={liked[activeStory.id] ? "#ff006e" : "none"}
                               color={liked[activeStory.id] ? "#ff006e" : "white"} />
                      </motion.span>
                      
                      {/* Like Badge */}
                      {(likeCount[activeStory.id] > 0 || liked[activeStory.id]) && (
                        <motion.span 
                          initial={{ scale: 0 }} 
                          animate={{ scale: 1 }}
                          className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#ff006e] text-white flex items-center justify-center text-[11px] font-black shadow-lg border-2 border-black/20">
                          {likeCount[activeStory.id] || 0}
                        </motion.span>
                      )}
                    </motion.button>

                    {/* Reaction button - Hot Fire Style */}
                    <motion.button 
                      whileHover={{ scale: 1.08, rotate: [0, -10, 10, 0], transition: { repeat: Infinity, duration: 0.5 } }}
                      whileTap={{ scale: 0.8 }}
                      onClick={() => setShowSnapReactions(!showSnapReactions)}
                      className="h-[54px] w-[54px] rounded-full flex items-center justify-center text-[26px] shrink-0 shadow-2xl border"
                      style={{ 
                        background: showSnapReactions ? "rgba(255,165,0,0.2)" : "rgba(255,255,255,0.08)", 
                        backdropFilter: "blur(24px)",
                        borderColor: showSnapReactions ? "rgba(255,165,0,0.4)" : "rgba(255,255,255,0.12)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)"
                      }}>
                      🔥
                    </motion.button>
                  </div>
                )}

                {/* Instagram-style Stats Bar (only for own story) */}
                {activeStory.username === myUsername && (
                  <div className="mt-3">
                    {/* Stat Pills Row */}
                    <div className="flex items-center justify-center gap-2">
                      {/* Views pill */}
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); setShowViewers(v => !v); setShowLikers(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-black border border-white/15 backdrop-blur-xl shadow-lg"
                        style={{ background: "rgba(255,255,255,0.12)", color: "white" }}>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="font-mono tracking-widest">{formatCount(activeStory.views_count ?? viewersList.length ?? 0)}</span>
                        <span className="opacity-60 font-medium text-[10px]">views</span>
                      </motion.button>

                      {/* Likes pill */}
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={(e) => { e.stopPropagation(); setShowLikers(l => !l); setShowViewers(false); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[12px] font-black border border-white/15 backdrop-blur-xl shadow-lg"
                        style={{ background: "rgba(255,0,110,0.18)", color: "white", borderColor: "rgba(255,0,110,0.3)" }}>
                        <Heart className="w-3.5 h-3.5" fill="#ff006e" style={{ color: "#ff006e" }} />
                        <span className="font-mono tracking-widest">{formatCount(likeCount[activeStory.id] ?? activeStory.likes_count ?? 0)}</span>
                        <span className="opacity-60 font-medium text-[10px]">likes</span>
                      </motion.button>
                    </div>

                    {/* Viewers dropdown */}
                    <AnimatePresence>
                      {showViewers && (
                        <motion.div key="viewers-bottom" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="mt-2 w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                          style={{ background: "rgba(13,13,26,0.97)", backdropFilter: "blur(30px)" }}
                          onClick={e => e.stopPropagation()}>
                          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2" style={{ background: "rgba(255,255,255,0.04)" }}>
                            <Eye className="w-3.5 h-3.5 text-white/70" />
                            <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Viewers</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                            {viewersList.length === 0 ? (
                              <p className="text-[11px] text-center py-4 text-white/40">No viewers yet</p>
                            ) : viewersList.map(v => (
                              <div key={v.username} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/8 cursor-pointer transition-all"
                                onClick={e => { e.stopPropagation(); setSelectedProfileUser({ username: v.username, name: v.name, color: v.color }); }}>
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${v.color?.includes('from-') ? v.color : 'from-[#6c5ce7] to-[#00d4ff]'} flex items-center justify-center text-xs font-black text-white shrink-0`}>
                                  {(v.name?.[0] || v.username?.[0] || '?').toUpperCase()}
                                </div>
                                <span className="text-[13px] font-semibold text-white">{v.name || v.username}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Likers dropdown */}
                    <AnimatePresence>
                      {showLikers && (
                        <motion.div key="likers-bottom" initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="mt-2 w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10"
                          style={{ background: "rgba(13,13,26,0.97)", backdropFilter: "blur(30px)" }}
                          onClick={e => e.stopPropagation()}>
                          <div className="px-4 py-2.5 border-b border-white/10 flex items-center gap-2" style={{ background: "rgba(255,0,110,0.08)" }}>
                            <Heart className="w-3.5 h-3.5" fill="#ff006e" style={{ color: "#ff006e" }} />
                            <span className="text-[11px] font-black text-white/80 uppercase tracking-widest">Liked by</span>
                          </div>
                          <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                            {likersList.length === 0 ? (
                              <p className="text-[11px] text-center py-4 text-white/40">No likes yet</p>
                            ) : likersList.map(v => (
                              <div key={v.username} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-white/8 cursor-pointer transition-all"
                                onClick={e => { e.stopPropagation(); setSelectedProfileUser({ username: v.username, name: v.name, color: v.color }); }}>
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${v.color?.includes('from-') ? v.color : 'from-[#ff006e] to-[#ffbe0b]'} flex items-center justify-center text-xs font-black text-white shrink-0`}>
                                  {(v.name?.[0] || v.username?.[0] || '?').toUpperCase()}
                                </div>
                                <span className="text-[13px] font-semibold text-white flex-1">{v.name || v.username}</span>
                                <Heart className="w-3 h-3 shrink-0" fill="#ff006e" style={{ color: "#ff006e" }} />
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
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
                <video ref={liveVideoRef} autoPlay playsInline muted className="w-full h-full object-cover"
                  style={{ transform: cameraView.facingMode === "user" ? "scaleX(-1)" : "none" }} />
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
                  <button onClick={flipCamera} className="p-4 bg-white/20 rounded-full backdrop-blur-md hover:bg-white/30 text-white shadow-xl" title="Flip Camera">
                    <RefreshCcw className="w-6 h-6" />
                  </button>
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
                  <div className={`h-36 w-36 rounded-full bg-gradient-to-tr ${selectedProfileUser.color?.includes('from-') ? selectedProfileUser.color : 'from-[#6c5ce7] to-[#00d4ff]'} border-[8px] ${isDark ? 'border-[#12121e]' : 'border-white'} shadow-2xl flex items-center justify-center text-white text-5xl font-black mb-6 relative group/avatar`}>
                    <span className="group-hover/avatar:scale-110 transition-transform duration-500 uppercase">
                      {(nicknames[selectedProfileUser.username]?.[0] || selectedProfileUser.name?.[0] || selectedProfileUser.username?.[0] || '?').toUpperCase()}
                    </span>
                  </div>

                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black tracking-tight mb-1" style={{ color: "var(--text-primary)" }}>
                      {nicknames[selectedProfileUser.username] || selectedProfileUser.name || selectedProfileUser.username}
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
                    <div className="mt-5 pt-4 border-t border-black/5 dark:border-white/5 flex items-center justify-center opacity-40 font-black text-[9px] tracking-[0.3em] uppercase">
                       SECURE NODE ACCESS &bull; ENCRYPTED PROTOCOL
                    </div>
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
  </>
  );
}

