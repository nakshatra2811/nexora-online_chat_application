"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Phone, Video, Send, Mic, MicOff, Paperclip, Lock,
  ArrowLeft, X, FileText, Image as ImageIcon, Camera, PhoneOff,
  VideoOff, Maximize2, Minimize2, MoreVertical, Zap, Check, Edit3,
  CheckCheck, Smile, Trash2, Reply, Timer, ShieldOff, Shield, MapPin,
  AlertTriangle, ChevronRight, ChevronLeft, Pin, ArrowUp, ArrowDown, Wallpaper, Upload, XCircle, Eye, EyeOff,
  Volume2, VolumeX, FolderOpen, Download, Play, Pause, Square, PhoneIncoming, PhoneOutgoing, PhoneMissed, Film, Heart,
  BarChart3, Users, UserPlus, MessageSquare, Share2, Plus, ToggleLeft, ToggleRight, Mail, Smartphone,
  RefreshCcw, Bell, UserCheck, Clock, Star
} from "lucide-react";
import { WhatsAppIcon } from "@/components/SocialIcons";
import { socketService } from "@/lib/socket";
import { deriveKeyFromPassword, encryptMessage, decryptMessage, generateECDHKeyPair, exportPublicKey, importPublicKey, deriveSharedSecret, KeyStore, generateAESKey, encryptStorageData, decryptStorageData, hashString } from "@/lib/crypto";
import { syntheticRingtone } from "@/lib/ringtone";
import { useTheme } from "@/lib/theme";
import { nexoraFetch } from "@/lib/config";
import { pushService } from "@/lib/push";
import { useCall } from "@/components/Call/CallProvider";
import { LoadingAnimation } from "@/components/LoadingAnimation";

const TUNNEL_ID = "nexora_secure_room_1";
const TUNNEL_PASSWORD = "super_secret_e2e_password_123";

const REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

const WALLPAPER_CATEGORIES = [
  { id: "cars", label: "🏎️ Cars" },
  { id: "art", label: "🎨 Art & Wild" },
  { id: "movies", label: "🎬 Movies" },
  { id: "nature", label: "🌄 Nature" },
  { id: "romantic", label: "💕 Romantic" },
  { id: "abstract", label: "✨ Abstract" },
];

const WALLPAPER_PRESETS = [
  { id: "range-rover", src: "/wallpapers/range-rover-black.jpg", label: "Range Rover Black", category: "cars" },
  { id: "jeep-compass", src: "/wallpapers/jeep-compass-lime.jpg", label: "Jeep Compass", category: "cars" },
  { id: "bmw-m5", src: "/wallpapers/bmw-m5-yellow.jpg", label: "BMW M5 Yellow", category: "cars" },
  { id: "audi-rs7", src: "/wallpapers/audi-rs7-abt.jpg", label: "Audi RS7 ABT", category: "cars" },
  { id: "panther", src: "/wallpapers/black-panther-art.jpg", label: "Black Panther Art", category: "art" },
  { id: "stranger-things", src: "/wallpapers/stranger-things.png", label: "Stranger Things", category: "movies" },
  { id: "thriller", src: "/wallpapers/thriller-movie.png", label: "Thriller Movie", category: "movies" },
  { id: "neon-city", src: "/wallpapers/neon-city.png", label: "Neon City", category: "abstract" },
  { id: "mountain", src: "/wallpapers/mountain-aurora.png", label: "Mountain Aurora", category: "nature" },
  { id: "romantic-sunset", src: "/wallpapers/romantic-sunset.png", label: "Romantic Sunset", category: "romantic" },
  { id: "dark-abstract", src: "/wallpapers/dark-abstract.png", label: "Dark Abstract", category: "abstract" },
];

interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  createdAt: number;
  viewedAt?: number;
  isSelf: boolean;
  status: "sending" | "delivered" | "seen";
  attachment?: { name: string; type: string; url: string; views?: number; size?: number };
  reactions: Record<string, number>;
  replyTo?: string;
  isCallLog?: { type: "voice" | "video"; direction: "outgoing" | "incoming" | "missed"; duration: number };
  poll?: { question: string; options: { id: string; text: string; votes: number }[]; isMultiple: boolean; votedOptions: string[] };
  contact?: { name: string; phone: string; email?: string; color: string };
  connectRequest?: { to: string; via: "sms" | "whatsapp" | "email"; status: "pending" | "sent" };
  isViewOnce?: boolean;
  viewOnceOpened?: boolean;
  isSystemNotice?: boolean;
}

export interface Thread {
  id: number;
  username: string; // Added username mapping
  name: string;
  color: string;
  online: boolean;
  preview: string;
  unread: number;
  avatarUrl?: string;
  wallpaper?: string;
}

function ChatsPageContent() {
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState("Standard Account");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isDark } = useTheme();

  // Real-time typing indicator (per-conversation: who is typing)
  const [peerTyping, setPeerTyping] = useState<Record<string, boolean>>({});
  // Unread counts per thread (keyed by username)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Refs for stable values inside socket callbacks
  const activeThreadRef = useRef<Thread | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [liveOnlineUsers, setLiveOnlineUsers] = useState<string[]>([]);

  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState<any[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState<any>(null);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [showRequestsSlider, setShowRequestsSlider] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Stories state for top tray previews
  const [myStoryPreview, setMyStoryPreview] = useState<boolean>(false);
  const [myStories, setMyStories] = useState<any[]>([]);
  const [friendsWithStories, setFriendsWithStories] = useState<string[]>([]);

  const quickPrefixes = ["Hey!", "WhatsApp?", "Connecting...", "Secure?", "Call me"];

  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingPausedRef = useRef(false);
  const [visualizerData, setVisualizerData] = useState<number[]>(Array(15).fill(10));
  const [cameraView, setCameraView] = useState<{ active: boolean; stream: MediaStream | null; capturedUrl: string | null; facingMode: "user" | "environment" }>({ active: false, stream: null, capturedUrl: null, facingMode: "environment" });


  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [pollMultiple, setPollMultiple] = useState(false);

  const [showWallpaperPicker, setShowWallpaperPicker] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState<string | null>(null);

  const [msgMenu, setMsgMenu] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const { 
    startCall: initiateCall, 
    acceptCall: handleAccept, 
    declineCall: handleDecline, 
    endCall: handleEnd, 
    toggleMute, 
    toggleVideo, 
    maximize, 
    minimize, 
    callState: activeCallState 
  } = useCall();
  
  // ─── RESTORED CALL STATES (Adjusted to sync with Global Provider) ───
  const [callState, setCallState] = useState<{
    isActive: boolean;
    status: "idle" | "ringing" | "accepted" | "ended";
    type: "voice" | "video";
    remoteName: string;
    remoteColor: string;
    duration: string;
    isMuted: boolean;
    isVideoOff: boolean;
    isFullscreen: boolean;
    remoteStream: MediaStream | null;
    localStream: MediaStream | null;
  }>({
    isActive: false,
    status: "idle",
    type: "voice",
    remoteName: "",
    remoteColor: "",
    duration: "00:00",
    isMuted: false,
    isVideoOff: false,
    isFullscreen: true,
    remoteStream: null,
    localStream: null,
  });

  const [incomingCall, setIncomingCall] = useState<{
    from: string;
    fromName: string;
    fromColor: string;
    type: "voice" | "video";
    roomId?: string;
  } | null>(null);

  // Sync local restored state with global CallProvider state
  useEffect(() => {
    setCallState({
      isActive: activeCallState.isActive,
      status: activeCallState.status,
      type: activeCallState.type,
      remoteName: activeCallState.remoteUser?.name || "",
      remoteColor: activeCallState.remoteUser?.color || "",
      duration: activeCallState.duration,
      isMuted: activeCallState.isMuted,
      isVideoOff: activeCallState.isVideoOff,
      isFullscreen: activeCallState.isFullscreen,
      remoteStream: activeCallState.remoteStream,
      localStream: activeCallState.localStream,
    });
    
    if (activeCallState.isIncoming && !activeCallState.isActive) {
      setIncomingCall({
        from: activeCallState.remoteUser?.username || "",
        fromName: activeCallState.remoteUser?.name || "",
        fromColor: activeCallState.remoteUser?.color || "",
        type: activeCallState.type
      });
    } else {
      setIncomingCall(null);
    }
  }, [activeCallState]);

  // Original function names pointing to global context
  const acceptIncomingCall = () => handleAccept();
  const endCall = () => handleEnd();
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [showDisappearSubmenu, setShowDisappearSubmenu] = useState(false);
  const [disappearTimer, setDisappearTimer] = useState<"off" | "1h" | "24h" | "after_view">("off");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [imageViewer, setImageViewer] = useState<{ url: string; name: string } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [blockedThreads, setBlockedThreads] = useState<number[]>([]);
  const [pinnedThreads, setPinnedThreads] = useState<number[]>([]);
  const [threadContextMenu, setThreadContextMenu] = useState<{ id: number; x: number; y: number } | null>(null);


  const [lockedChatsMap, setLockedChatsMap] = useState<Record<number, string>>({});
  const [unlockedSessionThreads, setUnlockedSessionThreads] = useState<number[]>([]);
  const [hiddenThreads, setHiddenThreads] = useState<number[]>([]);
  const [chatLockEntry, setChatLockEntry] = useState<{ threadId: number; error: string; pin: string; showPin: boolean; forgotMode: boolean; forgotError: string } | null>(null);
  const [lockSetupEntry, setLockSetupEntry] = useState<{ threadId: number; step: "pin" | "confirm"; pin: string; confirmPin: string; error: string } | null>(null);
  const [globalChatLockEntry, setGlobalChatLockEntry] = useState<{ pin: string; error: string; showPin: boolean; forgotMode: boolean; forgotAnswer: string; forgotNewPin: string; forgotStep: "answer" | "newpin"; forgotError: string } | null>(null);

  const [vaultReady, setVaultReady] = useState(false);
  const [ecdhReady, setEcdhReady] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  
  // ── Contact Sync & Search History States ──
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMatches, setSyncMatches] = useState<any[]>([]);
  const [manualPhone, setManualPhone] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const [profileData, setProfileData] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [myProfile, setMyProfile] = useState<{ name: string; username: string; color: string; avatarUrl?: string }>(() => {
    if (typeof window !== "undefined") {
      return {
        name: localStorage.getItem("nexora_signup_name") || "Nexora User",
        username: localStorage.getItem("nexora_signup_username") || "me",
        color: localStorage.getItem("nexora_signup_color") || "from-purple-500 to-indigo-500",
        avatarUrl: localStorage.getItem("nexora_avatar_url") || "",
      };
    }
    return { name: "", username: "", color: "", avatarUrl: "" };
  });

  const fmt = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  const addToSearchHistory = (username: string) => {
    if (!username) return;
    setSearchHistory(prev => {
      const next = [username, ...prev.filter(u => u !== username)].slice(0, 10);
      localStorage.setItem("nexora_search_history", JSON.stringify(next));
      return next;
    });
  };

  const handleManualAdd = async () => {
    const query = manualPhone.trim();
    if (!query) return;
    setIsSyncing(true);
    try {
      const res = await nexoraFetch(`/api/users/profile?username=${encodeURIComponent(query)}`);
      if (res && res.user) {
        setSyncMatches([res.user]);
        addToSearchHistory(res.user.username);
      } else {
        setSyncMatches([]);
      }
    } catch (e) {
       console.error("Manual add failed:", e);
    } finally {
       setIsSyncing(false);
    }
  };

  const handleNativeSync = async () => {
    setIsSyncing(true);
    try {
      // 1. Try modern Contacts API if available
      let numbers: string[] = [];
      if ('contacts' in navigator && 'select' in (navigator as any).contacts) {
        try {
          const props = ['tel'];
          const opts = { multiple: true };
          const contacts = await (navigator as any).contacts.select(props, opts);
          numbers = contacts.flatMap((c: any) => c.tel || []);
        } catch (err) {
          console.warn("Contacts API failed/cancelled, using simulated baseline.");
        }
      }

      // Cleanup numbers (keep digits only)
      const cleanNumbers = numbers.map(n => n.replace(/\D/g, '')).filter(n => n.length >= 10);
      
      // If no contacts found (empty or denied), we use a notification or mock for dev feedback
      if (cleanNumbers.length === 0) {
         // simulated contacts for development if real ones aren't available
         console.warn("No contacts selected/found. Syncing limited to manual entries.");
      }

      // Hash numbers for privacy before sending
      const hashedContacts = await Promise.all(cleanNumbers.map(n => hashString(n)));
      
      // Send hashes to server to find matches
      if (hashedContacts.length > 0) {
        const res = await nexoraFetch("/api/connections/sync", {
          method: "POST",
          body: JSON.stringify({ hashes: hashedContacts })
        });
        if (res && res.matches) {
          setSyncMatches(res.matches);
        }
      }
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStartCall = (type: "voice" | "video") => {
    if (!activeThread) return;
    initiateCall(activeThread.username, type, { 
      name: activeThread.name, 
      color: activeThread.color 
    });
  };

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

  // Fetch full bio/data when a profile is selected
  useEffect(() => {
    if (!selectedProfileUser) {
      setProfileData(null);
      return;
    }
    const fetchProfile = async () => {
      setLoadingProfile(true);
      try {
        const username = selectedProfileUser.username || selectedProfileUser.from_username;
        const res = await nexoraFetch(`/api/users/profile?username=${encodeURIComponent(username)}`);
        if (res && res.user) {
          setProfileData(res.user);
        }
      } catch (e) { console.error(e); }
      finally { setLoadingProfile(false); }
    };
    fetchProfile();
  }, [selectedProfileUser]);

  const myUsernameRef = useRef("");
  const isSendingRef = useRef(false);

  const myClientId = useRef("").current;

  // ═══ Initialize Self Profile ═══
  useEffect(() => {
    if (typeof window !== "undefined") {
      const username = myProfile.username;
      // Also fetch fresh from server in background to get latest avatar
      nexoraFetch(`/api/users/profile?username=${encodeURIComponent(username)}`).then((res: any) => {
        if (res?.user?.avatarUrl) {
          localStorage.setItem("nexora_avatar_url", res.user.avatarUrl);
          setMyProfile(prev => ({ ...prev, avatarUrl: res.user.avatarUrl }));
        }
      }).catch(() => {});
    }
  }, []);

  const searchParams = useSearchParams();

  // Unified Effect to sync URL state with Component state
  useEffect(() => {
    if (threads.length === 0) return;

    try {
      const u = searchParams.get("u") || searchParams.get("username");
      const call = searchParams.get("call");

      if (u) {
        const found = threads.find(t => t.username === u || (t as any).id?.toString() === u);
        if (found) {
          // Stable state update check
          if (activeThreadRef.current?.username !== found.username) {
            setActiveThread(found);
            document.body.classList.add("chat-active");
          }

          // Handle call initiation (One-time)
          if ((call === "voice" || call === "video")) {
            console.log(`[NAV] Direct call trigger: ${call} to ${u}`);
            initiateCall(found.username, call as any, { name: found.name, color: found.color });
            
            // Clean up 'call' param silently
            const raw = window.location.href.split('&call=')[0].split('?call=')[0];
            window.history.replaceState({}, "", raw);
          }
          return;
        }
      }

      // If no valid user in URL, and we currently have an active chat, close it
      if (activeThreadRef.current !== null) {
        setActiveThread(null);
        document.body.classList.remove("chat-active");
      }
    } catch (e) {
      console.warn("[NAV] Sync Stability Warn (Expected during transition)", e);
    }
  }, [searchParams, threads]);


  const fileInputRef = useRef<HTMLInputElement>(null);
  const wallpaperUploadRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const liveVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchConnections = async () => {
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    if (!myUsername) return;
    try {
      const data = await nexoraFetch(`/api/connections?username=${encodeURIComponent(myUsername)}`);
      if (data && data.connections) {
        setThreads(prev => {
          // Merge: use server data but preserve existing socket-based online status
          const prevMap = new Map(prev.map(t => [t.username, t]));
          return data.connections.map((c: any) => {
            const existing = prevMap.get(c.username);
            // Sync server-side wallpaper to local cache
            if (c.wallpaper) {
               localStorage.setItem(`nexora_wallpaper_${c.username}`, c.wallpaper);
            }
            return {
              ...c,
              // Use server online status OR existing socket-based status
              online: c.online || (existing?.online ?? false),
            };
          });
        });
        localStorage.setItem("nexora_secure_connections", JSON.stringify(data.connections));
      }

      // Fetch pending requests for Instagram-style sidebar
      const reqData = await nexoraFetch(`/api/connections/requests?username=${encodeURIComponent(myUsername)}`);
      if (reqData && reqData.requests) {
        setPendingRequests(reqData.requests);
      }

      // Fetch Notifications
      const notifData = await nexoraFetch(`/api/notifications?username=${encodeURIComponent(myUsername)}`);
      if (notifData && notifData.notifications) {
        setNotifications(notifData.notifications);
      }

      // Fetch Stories for Preview Rings
      try {
        const stData = await nexoraFetch(`/api/stories?username=${encodeURIComponent(myUsername)}`);
        if (stData && stData.stories) {
          const mine = stData.stories.filter((s: any) => s.username === myUsername);
          setMyStories(mine);
          setMyStoryPreview(mine.length > 0);
          const others = stData.stories.filter((s: any) => s.username !== myUsername).map((s: any) => s.username);
          setFriendsWithStories(Array.from(new Set(others)));
        }
      } catch (err) {
        console.error("Story preview fetch failed", err);
      }
    } catch (e) {
      console.error("Failed to sync connections:", e);
    }
  };

  const handleRespond = async (reqId: number, fromUsr: string, action: "accept" | "decline") => {
    try {
      const res = await nexoraFetch("/api/connections/respond", {
        method: "POST",
        body: JSON.stringify({ username: myUsernameRef.current, requestId: reqId, action })
      });
      if (res && (res.status === "accepted" || res.status === "declined")) {
        setPendingRequests(prev => prev.filter(r => r.id !== reqId));
        if (action === "accept") {
           fetchConnections(); // Server returns threads with proper username fields
        }
      }
    } catch (e) { console.error("Error responding to request", e); }
  };



  // ═══ Initialize Vault Key ═══
  useEffect(() => {
    const initVault = async () => {
      let key = await KeyStore.getVaultKey();
      if (!key) {
        const newKey = await generateAESKey();
        await KeyStore.saveVaultKey(newKey);
        key = newKey;
        console.log("[VAULT] New storage vault key generated and locked.");
      } else {
        console.log("[VAULT] Storage vault key recovered.");
      }
      setVaultKey(key);
      setVaultReady(true);
    };
    initVault();
  }, []);

  useEffect(() => {
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    myUsernameRef.current = myUsername;
    fetchConnections();

    try {
      const saved = localStorage.getItem("nexora_secure_connections");
      if (saved) setThreads(JSON.parse(saved));
      const savedNicknames = localStorage.getItem("nexora_nicknames");
      if (savedNicknames) setNicknames(JSON.parse(savedNicknames));
      const blocked = localStorage.getItem("nexora_blocked_threads");
      if (blocked) setBlockedThreads(JSON.parse(blocked));
      // Load activity
      const savedRequests = localStorage.getItem("nexora_sent_requests");
      if (savedRequests) setSentRequests(JSON.parse(savedRequests));
      const lmap = localStorage.getItem("nexora_locked_chats_map");
      if (lmap) setLockedChatsMap(JSON.parse(lmap));
      const hidden = localStorage.getItem("nexora_hidden_threads");
      if (hidden) setHiddenThreads(JSON.parse(hidden));
      const history = localStorage.getItem("nexora_search_history");
      if (history) setSearchHistory(JSON.parse(history));
      
      // Load unread counts
      const savedUnreads = localStorage.getItem("nexora_unread_counts");
      if (savedUnreads) setUnreadCounts(JSON.parse(savedUnreads));
    } catch (e) {
      console.warn("[CHATS] LocalStorage parse failed - clearing corrupt entries", e);
    }
  }, []);

  // Keep activeThreadRef in sync
  const prevThreadRef = useRef<Thread | null>(null);
  useEffect(() => {
    activeThreadRef.current = activeThread;
    
    // Purge after_view messages
    if (prevThreadRef.current && activeThread?.id !== prevThreadRef.current.id) {
        const oldId = prevThreadRef.current.id;
        const oldTimer = localStorage.getItem(`nexora_disappear_${oldId}`);
        if (oldTimer === "after_view" || oldTimer === "after") {
           const currentMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${oldId}`) || "[]");
           const remaining = currentMsgs.filter((m: any) => m.status !== "seen" && !m.isSystemNotice); 
           if (remaining.length !== currentMsgs.length) {
               localStorage.setItem(`nexora_msgs_${oldId}`, JSON.stringify(remaining));
           }
        }
    }
    prevThreadRef.current = activeThread;

    // Clear unread for active thread
    if (activeThread?.username) {
      setUnreadCounts(prev => {
        const next = { ...prev, [activeThread.username]: 0 };
        localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
        return next;
      });
    }
  }, [activeThread]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!activeThread || !vaultReady) return;
      
      const savedMsgs = localStorage.getItem(`nexora_msgs_${activeThread.id}`);
      
      if (savedMsgs) {
        try {
          let parsed: ChatMessage[] = [];
          if (savedMsgs.startsWith("anc:")) {
            // Encrypted format
            if (vaultKey) {
              const decrypted = await decryptStorageData(savedMsgs, vaultKey);
              parsed = decrypted || [];
            }
          } else {
            // Legacy plain text format - Migration path
            parsed = JSON.parse(savedMsgs);
          }

          // 🛡️ De-duplicate by ID to prevent "Non-unique key" console errors
          const unique = parsed.filter((m: ChatMessage, idx: number, self: ChatMessage[]) =>
            idx === self.findIndex((t) => t.id === m.id)
          );
          setMessages(unique);
        } catch (e) {
          console.error("[!] Load failed", e);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
      
      // Strict Disappear Timer Sync
      let savedTimer = null;
      if (activeThread.username) savedTimer = localStorage.getItem(`nexora_disappear_by_username_${activeThread.username}`);
      if (!savedTimer) savedTimer = localStorage.getItem(`nexora_disappear_${activeThread.id}`);

      if (savedTimer) {
        setDisappearTimer(savedTimer as any);
      } else {
        setDisappearTimer("off");
      }
    };
    
    loadMessages();
  }, [activeThread, vaultReady, vaultKey]);

  // Persist messages whenever they change (Encrypted)
  useEffect(() => {
    const saveMessages = async () => {
      if (activeThread && vaultKey && vaultReady) {
        const encrypted = await encryptStorageData(messages, vaultKey);
        localStorage.setItem(`nexora_msgs_${activeThread.id}`, encrypted);
      }
    };
    saveMessages();
  }, [messages, activeThread, vaultKey, vaultReady]);

  useEffect(() => {
    localStorage.setItem("nexora_blocked_threads", JSON.stringify(blockedThreads));
  }, [blockedThreads]);

  useEffect(() => {
    localStorage.setItem("nexora_sent_requests", JSON.stringify(sentRequests));
  }, [sentRequests]);

  useEffect(() => {
    if (!showGlobalSearch || globalSearchQuery.trim().length < 2) {
      setGlobalSearchResults([]);
      setGlobalSearchLoading(false);
      return;
    }
    setGlobalSearchLoading(true);
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    const t = setTimeout(async () => {
      try {
        const data = await nexoraFetch(`/api/users/search?q=${encodeURIComponent(globalSearchQuery)}&me=${encodeURIComponent(myUsername)}`);
        setGlobalSearchResults(data?.users || []);
      } catch {
        setGlobalSearchResults([]);
      } finally {
        setGlobalSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [globalSearchQuery, showGlobalSearch]);


  useEffect(() => {
    const match = document.cookie.match(new RegExp('(^| )nexora_role=([^;]+)'));
    const role = match ? match[2] : "Normal User";
    setUserRole(role === "Authorized Account" ? "Authorized Account" : "Standard Account");
    const isGlobalLock = localStorage.getItem("nexora_global_chat_lock_enabled") === "true";
    if (role === "Authorized Account" && isGlobalLock) {
      setGlobalChatLockEntry({ pin: "", error: "", showPin: false, forgotMode: false, forgotAnswer: "", forgotNewPin: "", forgotStep: "answer", forgotError: "" });
    }

    const stored = localStorage.getItem("nexora_locked_chats_map");
    if (stored) setLockedChatsMap(JSON.parse(stored));

    const hidden = localStorage.getItem("nexora_hidden_threads");
    if (hidden) setHiddenThreads(JSON.parse(hidden));
  }, []);

  // ═══ Persist Nicknames Hook (Fix for Static Nicknames) ═══
  useEffect(() => {
    if (Object.keys(nicknames).length > 0) {
      localStorage.setItem("nexora_nicknames", JSON.stringify(nicknames));
    }
  }, [nicknames]);

  const saveLockedChatsMap = (newMap: Record<number, string>) => {
    setLockedChatsMap(newMap);
    localStorage.setItem("nexora_locked_chats_map", JSON.stringify(newMap));
  };

  const handleOpenThread = (thread: typeof threads[0]) => {
    if (lockedChatsMap[thread.id] && !unlockedSessionThreads.includes(thread.id)) {
      setChatLockEntry({ threadId: thread.id, error: "", pin: "", showPin: false, forgotMode: false, forgotError: "" });
    } else {
      router.push(`?u=${thread.username}`, { scroll: false });
    }
  };

  const handleChatLockUnlock = () => {
    if (!chatLockEntry) return;
    const correctPin = lockedChatsMap[chatLockEntry.threadId];
    if (chatLockEntry.pin === correctPin) {
      setUnlockedSessionThreads(prev => [...prev, chatLockEntry.threadId]);
      const found = threads.find(t => t.id === chatLockEntry.threadId);
      if (found) router.push(`?u=${found.username}`, { scroll: false });
      setChatLockEntry(null);
    } else {
      setChatLockEntry(prev => prev ? { ...prev, error: "Incorrect PIN", pin: "" } : null);
    }
  };

  const handleChatForgotPin = () => {
    if (!chatLockEntry) return;
    // Strict recovery: Wipe thread
    const newHidden = [...hiddenThreads, chatLockEntry.threadId];
    setHiddenThreads(newHidden);
    localStorage.setItem("nexora_hidden_threads", JSON.stringify(newHidden));

    const newMap = { ...lockedChatsMap };
    delete newMap[chatLockEntry.threadId];
    saveLockedChatsMap(newMap);
    setChatLockEntry(null);
    if (activeThread?.id === chatLockEntry.threadId) setActiveThread(null);
  };

  const handleToggleLockConfig = (threadId: number) => {
    if (lockedChatsMap[threadId]) {
      // Remove lock
      const newMap = { ...lockedChatsMap };
      delete newMap[threadId];
      saveLockedChatsMap(newMap);
      setUnlockedSessionThreads(prev => prev.filter(id => id !== threadId));
    } else {
      setLockSetupEntry({ threadId, step: "pin", pin: "", confirmPin: "", error: "" });
    }
  };

  const handleLockSetupNext = () => {
    if (!lockSetupEntry) return;
    setLockSetupEntry(prev => prev ? { ...prev, error: "" } : null);
    if (lockSetupEntry.step === "pin") {
      if (lockSetupEntry.pin.length < 4) { setLockSetupEntry(prev => prev ? { ...prev, error: "PIN must be at least 4 digits" } : null); return; }
      setLockSetupEntry(prev => prev ? { ...prev, step: "confirm" } : null);
    } else {
      if (lockSetupEntry.pin !== lockSetupEntry.confirmPin) { setLockSetupEntry(prev => prev ? { ...prev, error: "PINs do not match", confirmPin: "" } : null); return; }
      saveLockedChatsMap({ ...lockedChatsMap, [lockSetupEntry.threadId]: lockSetupEntry.pin });
      setUnlockedSessionThreads(prev => [...prev, lockSetupEntry.threadId]);
      setLockSetupEntry(null);
    }
  };

  const handleGlobalChatLockUnlock = () => {
    if (!globalChatLockEntry) return;
    const correctPin = localStorage.getItem("nexora_global_chat_lock_pin") || "";
    if (globalChatLockEntry.pin === correctPin) {
      setGlobalChatLockEntry(null);
    } else {
      setGlobalChatLockEntry(prev => prev ? { ...prev, error: "Incorrect PIN", pin: "" } : null);
    }
  };

  const handleGlobalForgotPin = () => {
    if (!globalChatLockEntry) return;
    if (globalChatLockEntry.forgotStep === "answer") {
      const saved = localStorage.getItem("nexora_global_chat_lock_answer") || "";
      if (globalChatLockEntry.forgotAnswer.trim().toLowerCase() !== saved) {
        setGlobalChatLockEntry(prev => prev ? { ...prev, forgotError: "Incorrect answer" } : null); return;
      }
      setGlobalChatLockEntry(prev => prev ? { ...prev, forgotStep: "newpin", forgotError: "" } : null);
    } else {
      if (globalChatLockEntry.forgotNewPin.length < 4) { setGlobalChatLockEntry(prev => prev ? { ...prev, forgotError: "PIN must be 4+ digits" } : null); return; }
      localStorage.setItem("nexora_global_chat_lock_pin", globalChatLockEntry.forgotNewPin);
      setGlobalChatLockEntry(null);
    }
  };

  // Search in chat feature
  const [searchInChat, setSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchResults, setChatSearchResults] = useState<string[]>([]);
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Wallpaper feature
  const [wallpaperCategory, setWallpaperCategory] = useState("cars");

  // Load wallpaper from localStorage on thread change
  useEffect(() => {
    const threadId = activeThread?.id || 0;
    const username = activeThread?.username || "";
    const saved = activeThread?.wallpaper || (username ? localStorage.getItem(`nexora_wallpaper_${username}`) : null) || (threadId ? localStorage.getItem(`nexora_wallpaper_${threadId}`) : null);
    setChatWallpaper(saved || null);
  }, [activeThread]);

  const setWallpaperForChat = (url: string | null) => {
    setChatWallpaper(url);
    const threadId = activeThread?.id || 0;
    const username = activeThread?.username || "";
    if (url) {
      if (threadId) localStorage.setItem(`nexora_wallpaper_${threadId}`, url);
      if (username) localStorage.setItem(`nexora_wallpaper_${username}`, url);
    } else {
      if (threadId) localStorage.removeItem(`nexora_wallpaper_${threadId}`);
      if (username) localStorage.removeItem(`nexora_wallpaper_${username}`);
    }
    
    // Emit to other user
    const socket = socketService.getSocket();
    if (socket && username) {
      socket.emit("dm:wallpaper", { to: username, wallpaper: url });
      
      // Notify locally
      const notifMsg: ChatMessage = {
        id: Math.random().toString(), 
        senderId: "system", 
        text: `You changed the chat wallpaper`, 
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
        createdAt: Date.now(), 
        isSelf: true, 
        status: "delivered", 
        reactions: {}, 
        isSystemNotice: true 
      };
      setMessages(prev => [...prev, notifMsg]);
    }
    
    setShowWallpaperPicker(false);
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setWallpaperForChat(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ═══ Mark incoming messages as "viewed" when user has the chat open ═══
  useEffect(() => {
    if (!activeThread) return;
    const now = Date.now();
    setMessages(prev => prev.map(m => {
      // Only mark non-self messages that haven't been viewed yet
      if (!m.isSelf && !m.viewedAt && !m.isCallLog) {
        // If it's a view-once message, it will be deleted soon
        return { ...m, viewedAt: now };
      }
      return m;
    }));
  }, [activeThread, messages.length]);
  // ═══ Clean up "After View" messages when navigating away from chat ═══
  useEffect(() => {
    const purgeMessages = () => {
      if (disappearTimer === "after_view" && activeThread) {
        const key = `nexora_msgs_${activeThread.id}`;
        const currentMsgs = JSON.parse(localStorage.getItem(key) || "[]");
        // Identify messages to delete (status is 'seen')
        const seenMsgIds = currentMsgs.filter((m: any) => m.status === "seen" && !m.isSystemNotice).map((m: any) => m.id);
        
        if (seenMsgIds.length > 0) {
          const socket = socketService.getSocket();
          if (socket) {
            seenMsgIds.forEach((id: string) => {
              socket.emit("dm:delete", { to: activeThread.username, msgId: id });
            });
          }
          
          const remaining = currentMsgs.filter((m: any) => m.status !== "seen" && !m.isSystemNotice);
          localStorage.setItem(key, JSON.stringify(remaining));
        }
      }
    };

    window.addEventListener("beforeunload", purgeMessages);
    return () => {
      window.removeEventListener("beforeunload", purgeMessages);
      purgeMessages();
    };
  }, [activeThread, disappearTimer]);


  // ═══ Auto-delete messages based on disappear timer (starts after VIEWING) ═══
  useEffect(() => {
    if (disappearTimer === "off") return;
    const ms = disappearTimer === "1h" ? 3600000 : disappearTimer === "24h" ? 86400000 : 604800000;
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages(prev => prev.filter(m => {
        // Call logs are auto-deleted immediately (handled separately)
        if (m.isCallLog) return true;
        // For self messages: delete based on createdAt
        if (m.isSelf) {
          return (now - m.createdAt) < ms;
        }
        // For received messages: delete based on viewedAt (when user first saw them)
        if (m.viewedAt) {
          return (now - m.viewedAt) < ms;
        }
        // Not yet viewed — keep it
        return true;
      }));
    }, 30000); // Check every 30 seconds
    return () => clearInterval(timer);
  }, [disappearTimer]);

  // ═══ Call logs auto-delete immediately (within 2 seconds) ═══
  useEffect(() => {
    const callLogs = messages.filter(m => m.isCallLog);
    if (callLogs.length === 0) return;
    const timer = setTimeout(() => {
      setMessages(prev => prev.filter(m => {
        if (!m.isCallLog) return true;
        // Keep call logs that were just created (< 2 seconds ago)
        return (Date.now() - m.createdAt) < 2000;
      }));
    }, 2000);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleShareLocation = () => {
    setSharingLocation(true);
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocationCoords(coords);
        const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const locMsg: ChatMessage = {
          id: msgId, senderId: myUsernameRef.current,
          text: "📍 Shared Live Location",
          timestamp,
          createdAt: Date.now(),
          isSelf: true, status: "delivered", reactions: {},
          attachment: { name: "Location", type: "location", url: `${coords.lat},${coords.lng}` },
        };
        setMessages(prev => [...prev, locMsg]);
        setSharingLocation(false);

        // Send to other user via socket
        const socket = socketService.getSocket();
        if (socket && activeThread?.username) {
          socket.emit("dm:location", {
            to: activeThread.username,
            from: myUsernameRef.current,
            msgId,
            timestamp,
            lat: coords.lat,
            lng: coords.lng,
          });
        }
      },
      () => { setSharingLocation(false); alert("Location access denied"); }
    );
  };

  const handleBlockThread = () => {
    if (!activeThread) return;
    setBlockedThreads(prev =>
      prev.includes(activeThread?.id)
        ? prev.filter(id => id !== activeThread?.id)
        : [...prev, activeThread?.id]
    );
    setShowChatMenu(false);
  };

  // Pin/unpin a thread
  const handleTogglePin = (threadId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedThreads(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  // Search in chat logic
  useEffect(() => {
    if (!chatSearchQuery.trim()) {
      setChatSearchResults([]);
      setChatSearchIndex(0);
      return;
    }
    const q = chatSearchQuery.toLowerCase();
    const matching = messages
      .filter(m => m.text.toLowerCase().includes(q))
      .map(m => m.id);
    setChatSearchResults(matching);
    setChatSearchIndex(matching.length > 0 ? 0 : -1);
  }, [chatSearchQuery, messages]);

  // Scroll to highlighted result
  useEffect(() => {
    if (chatSearchResults.length > 0 && chatSearchIndex >= 0) {
      const el = document.getElementById(`msg-${chatSearchResults[chatSearchIndex]}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [chatSearchIndex, chatSearchResults]);

  const openSearchInChat = () => {
    setShowChatMenu(false);
    setSearchInChat(true);
    setChatSearchQuery("");
    setChatSearchResults([]);
    setChatSearchIndex(0);
    setTimeout(() => chatSearchInputRef.current?.focus(), 150);
  };

  const closeSearchInChat = () => {
    setSearchInChat(false);
    setChatSearchQuery("");
    setChatSearchResults([]);
    setChatSearchIndex(0);
  };

  const navigateSearchResult = (dir: "up" | "down") => {
    if (chatSearchResults.length === 0) return;
    setChatSearchIndex(prev => {
      if (dir === "up") return prev > 0 ? prev - 1 : chatSearchResults.length - 1;
      return prev < chatSearchResults.length - 1 ? prev + 1 : 0;
    });
  };


  // Shared Files Drawer
  const [showFilesDrawer, setShowFilesDrawer] = useState(false);
  const [filesFilter, setFilesFilter] = useState<"all" | "images" | "documents" | "audio" | "videos">("all");
  const [filePreview, setFilePreview] = useState<{ url: string; type: string; name: string } | null>(null);

  // Contact Picker
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState("");

  // Connect Request / Share Modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeSnap, setActiveSnap] = useState<ChatMessage | null>(null);
  const [snapCountdown, setSnapCountdown] = useState(10);
  const snapTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sharePhone, setSharePhone] = useState("");
  const [shareMessage, setShareMessage] = useState(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "https://nexora.app";
    return `Hey! Join me on Nexora — a privacy-first encrypted communication platform. 🔐\n${base}/auth?mode=signup`;
  });
  const [shareVia, setShareVia] = useState<"sms" | "whatsapp" | "email">("whatsapp");

  // Socket init + ECDH Key Generation + Push Notifications
  useEffect(() => {
    const initProtocol = async () => {
      const myUsername = localStorage.getItem("nexora_signup_username") || "";
      const myName = localStorage.getItem("nexora_signup_name") || myUsername;
      myUsernameRef.current = myUsername; // 🛡️ Sync Ref for socket handlers
      setMyProfile({ 
        name: myName, 
        username: myUsername, 
        color: localStorage.getItem("nexora_signup_color") || "from-purple-500 to-indigo-500", 
        avatarUrl: localStorage.getItem("nexora_signup_avatar") || undefined 
      });

      // 1. Derive symmetric key (backward compat)
      const key = await deriveKeyFromPassword(TUNNEL_PASSWORD);
      setCryptoKey(key);

      // 2. ECDH Keypair — generate once, persist in IndexedDB
      let keyPair = await KeyStore.getKeyPair();
      if (!keyPair) {
        const newPair = await generateECDHKeyPair();
        await KeyStore.saveKeyPair(newPair);
        keyPair = { publicKey: newPair.publicKey, privateKey: newPair.privateKey };
      }
      setEcdhReady(true);

      // 3. Connect socket and register identity
      const socket = socketService.connect();

      const registerUser = () => {
        if (myUsername) {
          socket.emit("register", myUsername);
          socket.emit("join_tunnel", TUNNEL_ID);
        }
      };
      registerUser();
      
      const fetchInitialData = async () => {
        try {
          const [notifs, reqs] = await Promise.all([
            nexoraFetch(`/api/notifications?username=${myUsername}`),
            nexoraFetch(`/api/connections/requests?username=${myUsername}`)
          ]);
          if (notifs?.notifications) setNotifications(notifs.notifications);
          if (reqs?.requests) setPendingRequests(reqs.requests);
        } catch (e) {
          console.error("Initial activity fetch failed", e);
        }
      };
      fetchInitialData();

      // Re-register on reconnect
      socket.on("connect", () => {
        registerUser();
        console.log("[Socket] Reconnected — re-registering identity");
      });


      // 4. Handle incoming DIRECT messages (new per-user system)
      socket.on("dm:message", async (data: any) => {
        // NOTE: Server now sends 'dm:message' to sender's other devices for sync.
        // We use msgId de-duplication to prevent local echoes if any.
        const senderUsername = data.from;
        try {
          let decryptedText = "";
          if (data.fromStory || data.ciphertext === null) {
              decryptedText = data.text || "📷 Story Interaction";
          } else {
              decryptedText = await decryptMessage(key, data.ciphertext, data.iv);
          }
          const isFromSelf = senderUsername?.toLowerCase() === myUsernameRef.current?.toLowerCase();
          const newMsg: ChatMessage = {
            id: data.msgId || Math.random().toString(),
            senderId: senderUsername,
            text: decryptedText,
            timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            createdAt: Date.now(),
            isSelf: isFromSelf,
            status: "delivered",
            reactions: {},
            replyTo: data.replyTo,
          };

          const currentThread = activeThreadRef.current;
          if (currentThread?.username?.toLowerCase() === senderUsername?.toLowerCase() && currentThread !== null) {
            // Active conversation — show immediately
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev; // 🛡️ Prevent duplicates
              return [...prev, newMsg];
            });
            // Send seen receipt
            socket.emit("dm:seen", { to: senderUsername, msgId: newMsg.id });
          } else {
            // Different conversation — save to that thread's localStorage and increment unread
            const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
            const senderThread = connections.find((t: any) => t.username?.toLowerCase() === senderUsername?.toLowerCase());
            
            if (senderThread) {
              const threadMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${senderThread.id}`) || "[]");
              if (!threadMsgs.find((m: any) => m.id === newMsg.id)) { // 🛡️ Prevent duplicates in storage
                threadMsgs.push(newMsg);
                localStorage.setItem(`nexora_msgs_${senderThread.id}`, JSON.stringify(threadMsgs));
              }
            }
            // Increment unread badge
            setUnreadCounts(prev => {
              const next = { ...prev, [senderUsername]: (prev[senderUsername] || 0) + 1 };
              localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
              return next;
            });
            // Update thread preview
            setThreads(prev => prev.map(t =>
              t.username?.toLowerCase() === senderUsername?.toLowerCase()
                ? { ...t, preview: decryptedText, unread: (t.unread || 0) + 1 }
                : t
            ));
            // Local push notification (tab not focused on this chat)
            pushService.showLocalNotification(
              senderThread?.name || senderUsername,
              `${decryptedText.slice(0, 60)}${decryptedText.length > 60 ? '...' : ''}`,
              { from: senderUsername }
            );
          }
        } catch (e) { console.error("[!] Decryption failed:", e); }
      });

      // 4b. Handle incoming media DMs
      socket.on("dm:media", (data: any) => {
        const senderUsername = data.from;
        const isFromSelf = senderUsername?.toLowerCase() === myUsernameRef.current?.toLowerCase();
        const newMsg: ChatMessage = {
          id: data.msgId || Math.random().toString(),
          senderId: senderUsername,
          text: data.caption || "",
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAt: Date.now(),
          isSelf: isFromSelf,
          status: "delivered",
          reactions: {},
          attachment: data.attachment,
          replyTo: data.replyTo,
        };
        const currentThread = activeThreadRef.current;
        if (currentThread?.username?.toLowerCase() === senderUsername?.toLowerCase() && currentThread !== null) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev; // 🛡️ De-duplicate
            return [...prev, newMsg];
          });
        } else {
          setUnreadCounts(prev => {
            const next = { ...prev, [senderUsername]: (prev[senderUsername] || 0) + 1 };
            localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
            return next;
          });
          const senderThread = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]")
            .find((t: any) => t.username?.toLowerCase() === senderUsername?.toLowerCase());
          if (senderThread) {
            const threadMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${senderThread.id}`) || "[]");
            if (!threadMsgs.find((m: any) => m.id === newMsg.id)) {
              threadMsgs.push(newMsg);
              localStorage.setItem(`nexora_msgs_${senderThread.id}`, JSON.stringify(threadMsgs));
            }
          }
          setThreads(prev => prev.map(t =>
            t.username?.toLowerCase() === senderUsername?.toLowerCase()
              ? { ...t, preview: "📎 Attachment", unread: (t.unread || 0) + 1 }
              : t
          ));
        }
      });

      // 5. Real-time typing indicators
      socket.on("dm:typing", (data: { from: string; isTyping: boolean }) => {
        setPeerTyping(prev => ({ ...prev, [data.from]: data.isTyping }));
        // Auto-clear typing indicator after 3 seconds
        setTimeout(() => {
          setPeerTyping(prev => ({ ...prev, [data.from]: false }));
        }, 3000);
      });

      // 6. Message seen receipts — mark our sent messages as seen
      socket.on("dm:seen", (data: { from: string; msgId: string }) => {
        setMessages(prev => prev.map(m =>
          m.senderId?.toLowerCase() === myUsernameRef.current?.toLowerCase() && (m.id === data.msgId || data.msgId === 'all')
            ? { ...m, status: "seen" as const }
            : m
        ));
      });

      // 7. Online/offline status
      socket.on("user_status", (data: { userId: string; status: 'online' | 'offline' }) => {
        setLiveOnlineUsers(prev => {
           if (data.status === 'online') return Array.from(new Set([...prev, data.userId]));
           return prev.filter(u => u !== data.userId);
        });
        setThreads(prev => prev.map(t =>
          t.username === data.userId ? { ...t, online: data.status === 'online' } : t
        ));
      });

      // 7b. Real-time Full Avatar Sync Update
      socket.on("dm:avatar_update", (data: { from: string; avatarUrl: string }) => {
        setThreads(prev => {
          const updated = prev.map(t => t.username === data.from ? { ...t, avatarUrl: data.avatarUrl } : t);
          localStorage.setItem("nexora_secure_connections", JSON.stringify(updated));
          return updated;
        });
        
        // Update currently active chat if it's the person who changed their DP
        if (activeThreadRef.current?.username === data.from) {
          setActiveThread(prev => prev ? { ...prev, avatarUrl: data.avatarUrl } : null);
        }

        // Broadly update any cached connection data to ensure persistence
        const savedConns = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
        const updatedConns = savedConns.map((c: any) => c.username === data.from ? { ...c, avatarUrl: data.avatarUrl } : c);
        localStorage.setItem("nexora_secure_connections", JSON.stringify(updatedConns));
      });

      // 8. Initial online users list
      socket.on("current_online_users", (onlineUsernames: string[]) => {
        setLiveOnlineUsers(onlineUsernames);
        setThreads(prev => prev.map(t => ({
          ...t,
          online: onlineUsernames.includes(t.username)
        })));
      });

      // 9. Sync Message Deletion (Delete for everyone)
      socket.on("dm:delete", (data: { from: string; msgId: string }) => {
        // Remove from current UI
        setMessages(prev => prev.filter(m => m.id !== data.msgId));
        
        // Also purge from localStorage for ALL threads (since we don't know which thread it's in by just msgId)
        // Optimization: Usually we only care about the sender's thread
        const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
        connections.forEach((conn: any) => {
          const key = `nexora_msgs_${conn.id}`;
          const currentMsgs = JSON.parse(localStorage.getItem(key) || "[]");
          const filtered = currentMsgs.filter((m: any) => m.id !== data.msgId);
          if (filtered.length !== currentMsgs.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        });
      });

      socket.on("dm:reaction", (data: { from: string; msgId: string; emoji: string }) => {
          // Update current UI
          setMessages(prev => prev.map(m => {
              if (m.id !== data.msgId) return m;
              const reactions = { ...(m.reactions || {}), [data.emoji]: ((m.reactions || {})[data.emoji] || 0) + 1 };
              return { ...m, reactions };
          }));
          
          // Persist if it belongs to a stored thread
          const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
          connections.forEach((conn: any) => {
              const key = `nexora_msgs_${conn.id}`;
              const currentMsgs = JSON.parse(localStorage.getItem(key) || "[]");
              let changed = false;
              const updated = currentMsgs.map((m: any) => {
                  if (m.id === data.msgId) {
                      changed = true;
                      const reactions = { ...(m.reactions || {}), [data.emoji]: ((m.reactions || {})[data.emoji] || 0) + 1 };
                      return { ...m, reactions };
                  }
                  return m;
              });
              if (changed) {
                  localStorage.setItem(key, JSON.stringify(updated));
              }
          });
      });


      // 9. ECDH public key exchange
      socket.on("dm:clear_chat", (data: { from: string }) => {
          if (activeThreadRef.current?.username === data.from) {
              setMessages([]);
          }
          const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
          const conn = connections.find((c: any) => c.username === data.from);
          if (conn) {
              localStorage.setItem(`nexora_msgs_${conn.id}`, "[]");
          }
      });

      socket.on("key:exchange", async (data: { from: string; publicKey: string }) => {
        if (!keyPair) return;
        try {
          const theirPubKey = await importPublicKey(data.publicKey);
          const sharedSecret = await deriveSharedSecret(keyPair.privateKey, theirPubKey);
          await KeyStore.saveSharedSecret(data.from, sharedSecret);
          const myPubKeyB64 = await exportPublicKey(keyPair.publicKey);
          socket.emit("key:exchange", { to: data.from, publicKey: myPubKeyB64 });
        } catch (e) { console.error("[!] Key exchange failed:", e); }
      });

      // 10. Connection updates
      socket.on("connection_accepted", (data: any) => {
        console.log("[Protocol] Connection accepted by:", data.by);
        fetchConnections();
        // Remove from sent (sender side) and from pending (receiver side)
        setSentRequests(prev => prev.filter(req => req !== data.by));
        setPendingRequests(prev => prev.filter(req => req.from !== data.by));
        pushService.showLocalNotification(
          "Connection Accepted!",
          `${data.byName || data.by} accepted your follow request 🎉`,
          {}
        );
      });

      socket.on("new_notification", (data: any) => {
        setNotifications(prev => [{ id: Date.now(), is_read: 0, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), ...data }, ...prev]);
        pushService.showLocalNotification(
          "Network Activity",
          data.message,
          {}
        );
      });

      socket.on("connection_request", (data: any) => {
        console.log("[Protocol] Incoming request from:", data.from);
        // Add real-time incoming request to sidebar
        setPendingRequests(prev => {
          if (prev.find(r => r.from === data.from)) return prev; // de-dup
          return [{
            id: Date.now(),
            from: data.from,
            fromName: data.fromName || data.from,
            fromColor: data.fromColor || 'from-purple-500 to-indigo-500',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }, ...prev];
        });
        // Show local notification
        pushService.showLocalNotification(
          `New Follow Request`,
          `${data.fromName || data.from} wants to connect with you`,
          {}
        );
      });

      // 11. Setup Web Push (after socket is ready)
      if (myUsername) {
        pushService.subscribe(myUsername).catch(() => {});
      }

      // 12. New feature syncs
      socket.on("dm:wallpaper", (data: { from: string; wallpaper: string | null }) => {
        // We need to know who sent it to update their thread's wallpaper
        localStorage.setItem(`nexora_wallpaper_${data.from}`, data.wallpaper || "");
        // If we're currently looking at this thread, update state
        if (activeThreadRef.current?.username?.toLowerCase() === data.from?.toLowerCase()) {
          setChatWallpaper(data.wallpaper);
          
          // Show announcement in the chat
          const notifMsg: ChatMessage = {
            id: Math.random().toString(), 
            senderId: "system", 
            text: `${data.from} changed the chat wallpaper`, 
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), 
            createdAt: Date.now(), 
            isSelf: false, 
            status: "delivered", 
            reactions: {}, 
            isSystemNotice: true
          };
          setMessages(prev => [...prev, notifMsg]);
        } else {
           // Notify even if not in active thread by updating thread data locally
           setThreads(prev => prev.map(t => 
             t.username?.toLowerCase() === data.from?.toLowerCase() 
             ? { ...t, wallpaper: data.wallpaper || undefined } 
             : t
           ));
        }
      });

      socket.on("dm:disappear_setting", (data: { from: string; timer: string }) => {
        // Enforce the mutual setting by persisting it
        localStorage.setItem(`nexora_disappear_by_username_${data.from}`, data.timer);
        
        if (activeThreadRef.current?.username === data.from) {
          setDisappearTimer(data.timer as any);
          localStorage.setItem(`nexora_disappear_${activeThreadRef.current.id}`, data.timer);
          // Show notification
          const notifMsg: ChatMessage = {
            id: Math.random().toString(), senderId: "system", text: `${data.from} set disappearing messages to ${data.timer === "off" ? "Off" : data.timer === "1h" ? "1 Hour" : data.timer === "24h" ? "24 Hours" : "After View"}`, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), createdAt: Date.now(), isSelf: false, status: "delivered", reactions: {}, isSystemNotice: true
          };
          setMessages(prev => [...prev, notifMsg]);
        }
      });

      socket.on("dm:view_once_ack", (data: { from: string; msgId: string }) => {
        setMessages(prev => prev.map(m => m.id === data.msgId ? { ...m, isViewOnce: true, viewedOnce: true, attachment: undefined, text: "📷 Photo viewed" } : m));
      });

      // ═══ INCOMING LOCATION ═══
      socket.on("dm:location", (data: any) => {
        const senderUsername = data.from;
        const isFromSelf = senderUsername?.toLowerCase() === myUsernameRef.current?.toLowerCase();
        const newMsg: ChatMessage = {
          id: data.msgId || Math.random().toString(),
          senderId: senderUsername,
          text: "📍 Shared Live Location",
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAt: Date.now(),
          isSelf: isFromSelf,
          status: "delivered",
          reactions: {},
          attachment: { name: "Location", type: "location", url: `${data.lat},${data.lng}` },
        };
        const currentThread = activeThreadRef.current;
        if (currentThread?.username?.toLowerCase() === senderUsername?.toLowerCase()) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else {
          const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
          const senderThread = connections.find((t: any) => t.username?.toLowerCase() === senderUsername?.toLowerCase());
          if (senderThread) {
            const threadMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${senderThread.id}`) || "[]");
            if (!threadMsgs.find((m: any) => m.id === newMsg.id)) {
              threadMsgs.push(newMsg);
              localStorage.setItem(`nexora_msgs_${senderThread.id}`, JSON.stringify(threadMsgs));
            }
          }
          if (!isFromSelf) {
            setUnreadCounts(prev => {
              const next = { ...prev, [senderUsername]: (prev[senderUsername] || 0) + 1 };
              localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
              return next;
            });
            setThreads(prev => prev.map(t =>
              t.username?.toLowerCase() === senderUsername?.toLowerCase()
                ? { ...t, preview: "📍 Location", unread: (t.unread || 0) + 1 }
                : t
            ));
            pushService.showLocalNotification(
              senderThread?.name || senderUsername,
              "📍 Shared a location",
              { from: senderUsername }
            );
          }
        }
      });

      // ═══ INCOMING POLL ═══
      socket.on("dm:poll", (data: any) => {
        const senderUsername = data.from;
        const isFromSelf = senderUsername?.toLowerCase() === myUsernameRef.current?.toLowerCase();
        const newMsg: ChatMessage = {
          id: data.msgId || Math.random().toString(),
          senderId: senderUsername,
          text: "",
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAt: Date.now(),
          isSelf: isFromSelf,
          status: "delivered",
          reactions: {},
          poll: { ...data.poll, votedOptions: [] },
        };
        const currentThread = activeThreadRef.current;
        if (currentThread?.username?.toLowerCase() === senderUsername?.toLowerCase()) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else {
          const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
          const senderThread = connections.find((t: any) => t.username?.toLowerCase() === senderUsername?.toLowerCase());
          if (senderThread) {
            const threadMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${senderThread.id}`) || "[]");
            if (!threadMsgs.find((m: any) => m.id === newMsg.id)) {
              threadMsgs.push(newMsg);
              localStorage.setItem(`nexora_msgs_${senderThread.id}`, JSON.stringify(threadMsgs));
            }
          }
          if (!isFromSelf) {
            setUnreadCounts(prev => {
              const next = { ...prev, [senderUsername]: (prev[senderUsername] || 0) + 1 };
              localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
              return next;
            });
            setThreads(prev => prev.map(t =>
              t.username?.toLowerCase() === senderUsername?.toLowerCase()
                ? { ...t, preview: "📊 Poll", unread: (t.unread || 0) + 1 }
                : t
            ));
            pushService.showLocalNotification(
              senderThread?.name || senderUsername,
              `📊 Poll: ${data.poll?.question || 'New poll'}`,
              { from: senderUsername }
            );
          }
        }
      });

      // ═══ INCOMING POLL VOTE (Real-time vote sync) ═══
      socket.on("dm:poll_vote", (data: { from: string; msgId: string; optId: string; action: string }) => {
        setMessages(prev => prev.map(m => {
          if (m.id !== data.msgId || !m.poll) return m;
          const delta = data.action === "add" ? 1 : -1;
          const newOpts = m.poll.options.map(opt =>
            opt.id === data.optId ? { ...opt, votes: Math.max(0, opt.votes + delta) } : opt
          );
          return { ...m, poll: { ...m.poll, options: newOpts } };
        }));
        // Also persist to localStorage for any matching thread
        const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
        connections.forEach((conn: any) => {
          const key = `nexora_msgs_${conn.id}`;
          const currentMsgs = JSON.parse(localStorage.getItem(key) || "[]");
          let changed = false;
          const updated = currentMsgs.map((m: any) => {
            if (m.id === data.msgId && m.poll) {
              changed = true;
              const delta = data.action === "add" ? 1 : -1;
              const newOpts = m.poll.options.map((opt: any) =>
                opt.id === data.optId ? { ...opt, votes: Math.max(0, opt.votes + delta) } : opt
              );
              return { ...m, poll: { ...m.poll, options: newOpts } };
            }
            return m;
          });
          if (changed) localStorage.setItem(key, JSON.stringify(updated));
        });
      });

      // ═══ INCOMING CONTACT ═══
      socket.on("dm:contact", (data: any) => {
        const senderUsername = data.from;
        const isFromSelf = senderUsername?.toLowerCase() === myUsernameRef.current?.toLowerCase();
        const newMsg: ChatMessage = {
          id: data.msgId || Math.random().toString(),
          senderId: senderUsername,
          text: "",
          timestamp: data.timestamp || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          createdAt: Date.now(),
          isSelf: isFromSelf,
          status: "delivered",
          reactions: {},
          contact: data.contact,
        };
        const currentThread = activeThreadRef.current;
        if (currentThread?.username?.toLowerCase() === senderUsername?.toLowerCase()) {
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        } else {
          const connections = JSON.parse(localStorage.getItem("nexora_secure_connections") || "[]");
          const senderThread = connections.find((t: any) => t.username?.toLowerCase() === senderUsername?.toLowerCase());
          if (senderThread) {
            const threadMsgs = JSON.parse(localStorage.getItem(`nexora_msgs_${senderThread.id}`) || "[]");
            if (!threadMsgs.find((m: any) => m.id === newMsg.id)) {
              threadMsgs.push(newMsg);
              localStorage.setItem(`nexora_msgs_${senderThread.id}`, JSON.stringify(threadMsgs));
            }
          }
          if (!isFromSelf) {
            setUnreadCounts(prev => {
              const next = { ...prev, [senderUsername]: (prev[senderUsername] || 0) + 1 };
              localStorage.setItem("nexora_unread_counts", JSON.stringify(next));
              return next;
            });
            setThreads(prev => prev.map(t =>
              t.username?.toLowerCase() === senderUsername?.toLowerCase()
                ? { ...t, preview: "👤 Contact shared", unread: (t.unread || 0) + 1 }
                : t
            ));
            pushService.showLocalNotification(
              senderThread?.name || senderUsername,
              `👤 Shared a contact: ${data.contact?.name || 'Contact'}`,
              { from: senderUsername }
            );
          }
        }
      });
    };
    initProtocol();
    // 🛡️ REMOVED: Global socket disconnect — Dashboard Layout needs it for notifications
    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        // Clean up common chat-related listeners only
        socket.off("dm:message");
        socket.off("dm:media");
        socket.off("dm:typing");
        socket.off("dm:seen");
        socket.off("dm:delete");
        socket.off("dm:reaction");
        socket.off("dm:clear_chat");
        socket.off("key:exchange");
        socket.off("user_status");
        socket.off("dm:wallpaper");
        socket.off("dm:disappear_setting");
        socket.off("dm:view_once_ack");
        socket.off("dm:location");
        socket.off("dm:poll");
        socket.off("dm:poll_vote");
        socket.off("dm:contact");
      }
    };
  }, []);

  // ═══ Disappearing Messages "After View" Logic ═══
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden && disappearTimer === "after_view" && vaultKey && vaultReady) {
        setMessages(prev => {
          const remaining = prev.filter(m => m.status !== "seen" && !m.isSystemNotice);
          if (activeThreadRef.current?.id) {
             encryptStorageData(remaining, vaultKey).then(encrypted => {
               localStorage.setItem(`nexora_msgs_${activeThreadRef.current!.id}`, encrypted);
             });
          }
          return remaining;
        });
      }
    };
    
    const handleBeforeUnload = async () => {
       if (disappearTimer === "after_view" && activeThreadRef.current?.id && vaultKey && vaultReady) {
          const stored = localStorage.getItem(`nexora_msgs_${activeThreadRef.current.id}`);
          if (!stored) return;
          
          let currentMsgs: any[] = [];
          if (stored.startsWith("anc:")) {
            currentMsgs = await decryptStorageData(stored, vaultKey) || [];
          } else {
            currentMsgs = JSON.parse(stored);
          }

          const remaining = currentMsgs.filter((m: any) => m.status !== "seen" && !m.isSystemNotice);
          const encrypted = await encryptStorageData(remaining, vaultKey);
          localStorage.setItem(`nexora_msgs_${activeThreadRef.current.id}`, encrypted);
       }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [disappearTimer]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Close menus on outside click
  useEffect(() => {
    const handler = () => { setMsgMenu(null); setReactionPickerFor(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);



  const handleSendMessage = async () => {
    if (!inputValue.trim() || !cryptoKey || !activeThread || isSendingRef.current) return;
    isSendingRef.current = true; // 🔒 Lock to prevent double-sending

    const text = inputValue.trim();
    const myUsername = myUsernameRef.current;
    setInputValue("");

    // Stop typing indicator
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:typing", { to: activeThread.username, isTyping: false });
    }

    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const tempMsg: ChatMessage = {
      id: msgId, senderId: myUsernameRef.current, text,
      timestamp,
      createdAt: Date.now(),
      isSelf: true, status: "sending",
      reactions: {},
      replyTo: replyTo?.id,
    };

    const currentReplyId = replyTo?.id;
    setReplyTo(null);
    setMessages(prev => [...prev, tempMsg]);

    // Update stats
    const currentSent = parseInt(localStorage.getItem("nexora_stats_messages_sent") || "0");
    localStorage.setItem("nexora_stats_messages_sent", (currentSent + 1).toString());
    window.dispatchEvent(new Event("storage"));

    try {
      const { ciphertext, iv } = await encryptMessage(cryptoKey, text);
      if (socket && activeThread?.username) {
        // ✅ FIXED: Route directly to target user, not shared broadcast room
        socket.emit("dm:message", {
          to: activeThread.username,
          from: myUsername,
          ciphertext,
          iv,
          msgId,
          timestamp,
          replyTo: currentReplyId,
        });
      }
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: "delivered" } : m));
      // Update preview
      setThreads(prev => prev.map(t =>
        t.username === activeThread.username ? { ...t, preview: text } : t
      ));
    } catch (e) {
      console.error("[!] Encryption failed", e);
    } finally {
      isSendingRef.current = false; // 🔓 Unlock
    }
  };


  // Emit typing indicator when user is typing
  const handleInputChange = (val: string) => {
    setInputValue(val);
    const socket = socketService.getSocket();
    if (!socket || !activeThread?.username) return;
    socket.emit("dm:typing", { to: activeThread.username, isTyping: val.length > 0 });
    // Auto-clear typing after 2 seconds of no input
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("dm:typing", { to: activeThread.username, isTyping: false });
    }, 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setShowAttachMenu(false);
    
    // Read file via FileReader to serialize over sockets and save locally
    const reader = new FileReader();
    reader.onload = () => {
        const fileDataUrl = reader.result as string;
        const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const isImage = file.type.startsWith("image/");
        
        const attachment = { name: file.name, type: file.type, url: fileDataUrl, size: file.size };
        
        const currentReplyId = replyTo?.id;
        setReplyTo(null);
        
        const msg: ChatMessage = {
          id: msgId, senderId: myUsernameRef.current,
          text: isImage ? "" : `📎 ${file.name}`,
          timestamp, createdAt: Date.now(),
          isSelf: true, status: "delivered", reactions: {},
          attachment,
          replyTo: currentReplyId,
        };
        
        setMessages(prev => [...prev, msg]);

        // Send over Socket
        const socket = socketService.getSocket();
        if (socket && activeThread?.username) {
            socket.emit("dm:media", {
                to: activeThread.username,
                from: myUsernameRef.current,
                attachment,
                msgId, timestamp,
                caption: msg.text,
                replyTo: currentReplyId
            });
        }
    };
    reader.readAsDataURL(file);

    // Reset so same file can be selected again
    e.target.value = "";
  };

  const handleCameraCapture = () => {
    setShowAttachMenu(false);
    startCameraView();
  };

  const startCameraView = async (mode: "user" | "environment" = "environment") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
      setCameraView({ active: true, stream, capturedUrl: null, facingMode: mode });
    } catch {
      alert("Camera access denied. Opening file picker instead.");
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (liveVideoRef.current && cameraView.stream) {
      liveVideoRef.current.srcObject = cameraView.stream;
    }
  }, [cameraView.stream, cameraView.active]);

  const flipSnapCamera = async () => {
    const newMode = cameraView.facingMode === "user" ? "environment" : "user";
    if (cameraView.stream) {
      cameraView.stream.getTracks().forEach(t => t.stop());
    }
    await startCameraView(newMode);
  };

  const capturePhoto = () => {
    if (!liveVideoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = liveVideoRef.current.videoWidth;
    canvas.height = liveVideoRef.current.videoHeight;
    canvas.getContext("2d")?.drawImage(liveVideoRef.current, 0, 0);
    const url = canvas.toDataURL("image/jpeg", 0.7); // Compress slightly
    setCameraView(p => ({ ...p, capturedUrl: url }));
  };

  const sendCapturedPhoto = () => {
    if (!cameraView.capturedUrl) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    
    const attachment = { name: "capture.jpg", type: "image/jpeg", url: cameraView.capturedUrl };
    
    const currentReplyId = replyTo?.id;
    setReplyTo(null);
    
    const msg: ChatMessage = {
      id: msgId, senderId: myUsernameRef.current,
      text: "📷 View Once Photo",
      timestamp,
      createdAt: Date.now(),
      isSelf: true, status: "delivered", reactions: {},
      attachment: undefined,
      isViewOnce: true,
      replyTo: currentReplyId,
    };
    msg.attachment = attachment; // keep it locally but hidden via UI flags later
    setMessages(prev => [...prev, msg]);

    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:media", {
        to: activeThread.username,
        msgId, timestamp,
        caption: "📷 View Once Photo",
        attachment: attachment,
        isViewOnce: true
      });
    }

    closeCameraView();
  };

  const closeCameraView = () => {
    cameraView.stream?.getTracks().forEach(t => t.stop());
    setCameraView({ active: false, stream: null, capturedUrl: null, facingMode: "environment" });
  };

  // Secure Recording State

  const startRecording = async () => {
    try {
      setAudioPreviewUrl(null);
      setRecordingTime(0);
      setIsPlayingPreview(false);
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(console.error);
        }
        if (visualizerInterval.current) clearInterval(visualizerInterval.current);
        
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
            const base64data = reader.result;
            setAudioPreviewUrl(base64data as string);
        }
      };
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      audioContextRef.current = audioCtx;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      visualizerInterval.current = setInterval(() => {
        if (analyserRef.current && !isRecordingPausedRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const newH = [];
          for(let i=0; i<15; i++) newH.push(Math.max(4, (dataArray[i+2] || 0) / 4));
          setVisualizerData(newH);
        }
      }, 50);

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingInterval.current = setInterval(() => {
        if (!recorder.state.includes("paused")) {
          setRecordingTime((t) => t + 1);
        }
      }, 1000);
    } catch (err) { alert("Microphone access denied"); }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
      isRecordingPausedRef.current = true;
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
      isRecordingPausedRef.current = false;
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsRecordingPaused(false);
    isRecordingPausedRef.current = false;
    if (recordingInterval.current) clearInterval(recordingInterval.current);
    if (visualizerInterval.current) clearInterval(visualizerInterval.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
    }
  };

  const sendAudioPreview = () => {
    if (!audioPreviewUrl) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const attachment = { name: "voice.webm", type: "audio/webm", url: audioPreviewUrl };
    const currentReplyId = replyTo?.id;
    setReplyTo(null);
    
    const msg: ChatMessage = {
      id: msgId, senderId: myUsernameRef.current,
      text: `🎙 Voice Message (${recordingTime}s)`,
      timestamp,
      createdAt: Date.now(),
      isSelf: true, status: "delivered", reactions: {},
      attachment,
      replyTo: currentReplyId,
    };
    setMessages(prev => [...prev, msg]);
    
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:media", {
        to: activeThread.username,
        msgId, timestamp,
        caption: msg.text,
        attachment,
        replyTo: currentReplyId
      });
    }

    setAudioPreviewUrl(null);
    setRecordingTime(0);
    setIsPlayingPreview(false);
  };

  const cancelAudioPreview = () => {
    setAudioPreviewUrl(null);
    setRecordingTime(0);
    setIsPlayingPreview(false);
  };

  const addReaction = (msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}), [emoji]: ((m.reactions || {})[emoji] || 0) + 1 };
      return { ...m, reactions };
    }));
    setReactionPickerFor(null);
    
    // Emit to other user
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
        socket.emit("dm:reaction", { to: activeThread.username, msgId, emoji });
    }
    
    // Persist locally
    if (activeThread && vaultKey && vaultReady) {
        const key = `nexora_msgs_${activeThread.id}`;
        const stored = localStorage.getItem(key);
        (async () => {
          let currentMsgs: any[] = [];
          if (stored?.startsWith("anc:")) {
            currentMsgs = await decryptStorageData(stored, vaultKey) || [];
          } else if (stored) {
            currentMsgs = JSON.parse(stored);
          }

          const updated = currentMsgs.map((m: any) => {
              if (m.id === msgId) {
                  const reactions = { ...(m.reactions || {}), [emoji]: ((m.reactions || {})[emoji] || 0) + 1 };
                  return { ...m, reactions };
              }
              return m;
          });
          const encrypted = await encryptStorageData(updated, vaultKey);
          localStorage.setItem(key, encrypted);
        })();
    }
  };

  const deleteMsg = async (msgId: string) => {
    setMessages(prev => {
        const nextMsgs = prev.filter(m => m.id !== msgId);
        // Persist to local storage immediately
        if (activeThread && vaultKey && vaultReady) {
          const key = `nexora_msgs_${activeThread.id}`;
          encryptStorageData(nextMsgs, vaultKey).then(encrypted => {
            localStorage.setItem(key, encrypted);
          });
        }
        return nextMsgs;
    });
    setMsgMenu(null);
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:delete", { to: activeThread.username, msgId });
    }
  };

  const clearChat = async () => {
    if (!confirm("Are you sure you want to clear this entire chat for everyone? This action cannot be undone.")) return;
    setMessages([]);
    if (activeThread && vaultKey && vaultReady) {
        const key = `nexora_msgs_${activeThread.id}`;
        const encrypted = await encryptStorageData([], vaultKey);
        localStorage.setItem(key, encrypted);
        const socket = socketService.getSocket();
        if (socket && activeThread.username) {
            socket.emit("dm:clear_chat", { to: activeThread.username });
        }
    }
    setShowChatMenu(false);
  };

  // Derived
  const currentThread: Thread | null = activeThread;

  // Get shared files from messages
  const getSharedFiles = () => {
    return messages
      .filter(m => m.attachment && m.attachment.type !== "location")
      .map(m => ({
        id: m.id,
        name: m.attachment!.name,
        type: m.attachment!.type,
        url: m.attachment!.url,
        timestamp: m.timestamp,
        sender: m.isSelf ? "You" : (activeThread?.name || "Them"),
        size: m.attachment!.size,
      }))
      .reverse();
  };

  const filterFiles = (files: ReturnType<typeof getSharedFiles>) => {
    if (filesFilter === "all") return files;
    if (filesFilter === "images") return files.filter(f => f.type.startsWith("image/"));
    if (filesFilter === "documents") return files.filter(f => !f.type.startsWith("image/") && !f.type.startsWith("audio/") && !f.type.startsWith("video/"));
    if (filesFilter === "audio") return files.filter(f => f.type.startsWith("audio/"));
    if (filesFilter === "videos") return files.filter(f => f.type.startsWith("video/"));
    return files;
  };

  // ─── POLL HANDLERS ───
  const handleCreatePoll = () => {
    const validOptions = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOptions.length < 2) return;
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const pollData = {
      question: pollQuestion.trim(),
      options: validOptions.map((o, i) => ({ id: `opt_${i}`, text: o.trim(), votes: 0 })),
      isMultiple: pollMultiple,
      votedOptions: [] as string[],
    };
    const pollMsg: ChatMessage = {
      id: msgId,
      senderId: myProfile.username,
      text: "",
      timestamp,
      createdAt: Date.now(),
      isSelf: true, status: "delivered", reactions: {},
      poll: pollData,
    };
    setMessages(prev => [...prev, pollMsg]);
    setShowPollCreator(false);
    setPollQuestion("");
    setPollOptions(["", ""]);
    setPollMultiple(false);

    // Send to other user via socket
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:poll", {
        to: activeThread.username,
        from: myUsernameRef.current,
        msgId,
        timestamp,
        poll: pollData,
      });
    }
  };

  const handleVotePoll = (msgId: string, optId: string) => {
    let voteAction: "add" | "remove" = "add";
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId || !m.poll) return m;
      const alreadyVoted = m.poll.votedOptions.includes(optId);
      voteAction = alreadyVoted ? "remove" : "add";
      let newVoted: string[];
      let newOpts = m.poll.options;
      if (m.poll.isMultiple) {
        newVoted = alreadyVoted
          ? m.poll.votedOptions.filter(v => v !== optId)
          : [...m.poll.votedOptions, optId];
        newOpts = m.poll.options.map(opt =>
          opt.id === optId ? { ...opt, votes: opt.votes + (alreadyVoted ? -1 : 1) } : opt
        );
      } else {
        // Single choice — remove previous vote
        const prevVoted = m.poll.votedOptions[0];
        newVoted = alreadyVoted ? [] : [optId];
        newOpts = m.poll.options.map(opt => {
          if (opt.id === optId) return { ...opt, votes: opt.votes + (alreadyVoted ? -1 : 1) };
          if (opt.id === prevVoted && !alreadyVoted) return { ...opt, votes: Math.max(0, opt.votes - 1) };
          return opt;
        });
      }
      return { ...m, poll: { ...m.poll, options: newOpts, votedOptions: newVoted } };
    }));

    // Sync vote to other user via socket
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:poll_vote", {
        to: activeThread.username,
        msgId,
        optId,
        action: voteAction,
      });
    }
  };

  const addPollOption = () => {
    if (pollOptions.length >= 8) return;
    setPollOptions(prev => [...prev, ""]);
  };

  const removePollOption = (idx: number) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── CONTACT SHARING ───
  const handleShareContact = (contact: any) => {
    const msgId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const contactData = { name: contact.name, phone: contact.phone, email: contact.email, color: contact.color };
    const contactMsg: ChatMessage = {
      id: msgId,
      senderId: myProfile.username,
      text: "",
      timestamp,
      createdAt: Date.now(),
      isSelf: true, status: "delivered", reactions: {},
      contact: contactData,
    };
    setMessages(prev => [...prev, contactMsg]);
    setShowContactPicker(false);
    setContactSearch("");

    // Send to other user via socket
    const socket = socketService.getSocket();
    if (socket && activeThread?.username) {
      socket.emit("dm:contact", {
        to: activeThread.username,
        from: myUsernameRef.current,
        msgId,
        timestamp,
        contact: contactData,
      });
    }
  };

  // ─── CONNECT REQUEST (SMS/WhatsApp/Email) ───
  const handleSendConnectRequest = () => {
    if (!sharePhone.trim()) return;
    const via = shareVia;
    const phone = sharePhone.trim();
    const msg = shareMessage.trim();

    // Log in chat
    const reqMsg: ChatMessage = {
      id: Math.random().toString(),
      senderId: myProfile.username,
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      createdAt: Date.now(),
      isSelf: true, status: "delivered", reactions: {},
      connectRequest: { to: phone, via, status: "sent" },
    };
    setMessages(prev => [...prev, reqMsg]);

    // Save to localStorage so profile can see sent requests
    const savedRequests = JSON.parse(localStorage.getItem("nexora_pending_requests") || "[]");
    const newReq = {
      id: Math.random(),
      name: phone,
      color: shareVia === "whatsapp" ? "from-[#25D366] to-[#128C7E]" : shareVia === "sms" ? "from-[#a29bfe] to-[#6c5ce7]" : "from-[#ffbe0b] to-[#ff006e]",
      time: "Just now"
    };
    localStorage.setItem("nexora_pending_requests", JSON.stringify([newReq, ...savedRequests]));
    window.dispatchEvent(new Event("storage"));

    // Open external app natively without a blank tab block
    const encoded = encodeURIComponent(msg);
    const cleanPhone = phone.replace(/\s+/g, "").replace(/^\+/, "");
    if (via === "whatsapp") {
      window.location.href = `https://wa.me/${cleanPhone}?text=${encoded}`;
    } else if (via === "sms") {
      window.location.href = `sms:${phone}?body=${encoded}`;
    } else if (via === "email") {
      window.location.href = `mailto:${phone}?subject=${encodeURIComponent("Join me on Nexora")}&body=${encoded}`;
    }

    setShowShareModal(false);
    setSharePhone("");
  };


  const tickColor = (status: string) =>
    status === "seen" ? "#00d4ff" : "rgba(255,255,255,0.5)";

  const TickIcon = ({ status, isSelf }: { status: string; isSelf: boolean }) => {
    if (!isSelf) return null;
    return (
      <div className="relative flex items-center justify-center w-4 h-4 ml-0.5">
        <AnimatePresence mode="popLayout" initial={false}>
          {status === "sending" && (
            <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }} className="absolute">
              <Check className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
          {status === "delivered" && (
            <motion.div key="delivered" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5, rotate: -90 }} transition={{ duration: 0.3 }} className="absolute">
              <CheckCheck className="w-3.5 h-3.5 text-white" />
            </motion.div>
          )}
          {status === "seen" && (
            <motion.div key="seen" initial={{ opacity: 0, scale: 0.3, rotate: 90 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} className="absolute flex -space-x-1.5 drop-shadow-[0_0_5px_rgba(250,204,21,0.6)]">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400 mt-0.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const surface = (alpha: number) => isDark ? `rgba(18,18,28,${alpha})` : `rgba(255,255,255,${alpha})`;

  async function handleSendConnectionRequest(user: any, e?: React.MouseEvent) {
    e?.stopPropagation();
    const myUsername = localStorage.getItem("nexora_signup_username") || "";
    const myName = localStorage.getItem("nexora_signup_name") || myUsername;
    const myColor = localStorage.getItem("nexora_signup_color") || "from-purple-500 to-indigo-500";
    if (!myUsername || !user?.username) return;

    // Optimistic update for UI feedback
    if (!sentRequests.includes(user.username)) {
      const updated = [...sentRequests, user.username];
      setSentRequests(updated);
      localStorage.setItem("nexora_sent_requests", JSON.stringify(updated));
    }

    try {
      addToSearchHistory(user.username);
      const resp = await nexoraFetch("/api/connections/request", {
        method: "POST",
        body: JSON.stringify({
          from: myUsername,
          fromName: myName,
          fromColor: myColor,
          to: user.username
        }),
      });

      if (resp && resp.status === 'accepted') {
        // Bidirectional/Cross-request: instantly fully connected
        fetchConnections();
        setSentRequests(prev => prev.filter(un => un !== user.username));
      } else if (resp && resp.status === 'already_connected') {
        fetchConnections();
        setSentRequests(prev => prev.filter(un => un !== user.username));
      } else if (resp && resp.status === 'already_sent') {
        // Already sent, leave it shown
      } else if (!resp || resp.error) {
        // Rollback on failure
        setSentRequests(prev => prev.filter(un => un !== user.username));
      }
    } catch (e) {
      console.error("Request failed:", e);
      setSentRequests(prev => prev.filter(un => (user?.username ? un !== user.username : true)));
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-base" style={{ color: "var(--text-primary)" }}>
      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
        accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip" />
      <input ref={cameraInputRef} type="file" className="hidden" accept="image/*"
        capture="environment" onChange={handleCameraCapture} />
      <input ref={wallpaperUploadRef} type="file" className="hidden" accept="image/*"
        onChange={handleWallpaperUpload} />

      {/* ═══ THREAD LIST ═══ */}
      <motion.div
        initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        className={`${activeThread ? "hidden sm:flex" : "flex"} flex-col w-full sm:w-[320px] lg:w-[360px] shrink-0 overflow-hidden relative border-r z-30`}
        style={{
          background: "var(--bg-surface)",
          backdropFilter: "blur(var(--blur-medium))",
          borderColor: "var(--border-subtle)"
        }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold" style={{ color: "var(--text-primary)" }}>Messages</h2>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.9 }}
                onClick={() => { setShowSyncModal(true); setSyncMatches([]); }}
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg"
                title="Find & Contact Friends"
              >
                <UserPlus className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
          <div className="flex items-center rounded-2xl px-4 py-3 gap-3 neumorphic-input">
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none font-medium" placeholder="Search conversations..."
              style={{ color: "var(--text-primary)" }} />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1">
          {/* Incoming Requests UI (Instagram Style) */}
          {pendingRequests.length > 0 && (
            <div className="mb-4">
               <motion.button 
                 whileTap={{scale:0.98}}
                 onClick={() => setShowRequestsSlider(!showRequestsSlider)}
                 className="w-full flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
               >
                 <div className="flex items-center gap-3">
                   <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 relative">
                     <UserPlus className="w-5 h-5" />
                     <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-[var(--bg-surface)]">
                       {pendingRequests.length}
                     </span>
                   </div>
                   <div className="text-left">
                     <p className="text-xs font-black uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>Connection Requests</p>
                     <p className="text-[10px] font-bold opacity-50" style={{ color: "var(--text-muted)" }}>{pendingRequests.length} nodes pending</p>
                   </div>
                 </div>
                 <ChevronRight className={`w-4 h-4 transition-transform ${showRequestsSlider ? 'rotate-90' : ''}`} />
               </motion.button>
               
               <AnimatePresence>
                 {showRequestsSlider && (
                   <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-2 space-y-2">
                     {pendingRequests.map((req) => (
                       <div key={req.id} className="p-3 rounded-xl border flex items-center justify-between gap-3" style={{ background: "var(--bg-surface-solid)", borderColor: "var(--border-subtle)" }}>
                         <div className="flex items-center gap-2 min-w-0">
                           <div className={`h-8 w-8 rounded-full bg-gradient-to-tr ${req.fromColor || 'from-purple-500 to-indigo-500'} flex items-center justify-center text-white font-black text-xs uppercase shadow-sm overflow-hidden`}>
                             {req.avatarUrl ? <img src={req.avatarUrl} alt="" className="w-full h-full object-cover" /> : (req.fromName?.[0] || "?").toUpperCase()}
                           </div>
                           <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>{req.fromName}</p>
                         </div>
                         <div className="flex items-center gap-1.5 shrink-0">
                           <button onClick={(e) => { e.stopPropagation(); handleRespond(req.id, req.from, 'decline'); }} className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"><X className="w-3.5 h-3.5" /></button>
                           <button onClick={(e) => { e.stopPropagation(); handleRespond(req.id, req.from, 'accept'); }} className="p-1.5 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20"><Check className="w-3.5 h-3.5" /></button>
                         </div>
                       </div>
                     ))}
                   </motion.div>
                 )}
               </AnimatePresence>
            </div>
          )}

          {/* Activity/Notifications Tray */}
          {notifications.length > 0 && (
            <div className="mb-4">
               <div className="flex items-center justify-between px-2 mb-2">
                 <button onClick={() => setShowNotifications(!showNotifications)} className="flex items-center gap-2 group">
                   <Bell className="w-4 h-4 text-purple-500" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-500">Activity Protocol</span>
                 </button>
                 {showNotifications && (
                  <button 
                    onClick={async () => {
                      const user = localStorage.getItem("nexora_signup_username");
                      if (user) await nexoraFetch(`/api/notifications/clear?username=${user}`, { method: 'POST' });
                      setNotifications([]);
                    }} 
                    className="px-2 py-1 rounded-lg text-[9px] font-black text-purple-500 bg-purple-500/5 hover:bg-purple-500/10 transition-all uppercase tracking-widest"
                  >
                    Clear
                  </button>
                 )}
               </div>
               
               <AnimatePresence>
                 {showNotifications && (
                  <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:"auto"}} exit={{opacity:0, height:0}} className="space-y-1.5">
                    {notifications.map(notif => (
                      <motion.div 
                         initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                         key={notif.id} 
                         className="group flex flex-col gap-1.5 p-2.5 rounded-xl border relative transition-all" 
                         style={{borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", background: isDark ? "rgba(10,10,20,0.4)" : "rgba(255,255,255,0.5)"}}
                      >
                        <div className="flex items-start gap-2.5" onClick={() => setSelectedProfileUser({ username: notif.from_username, name: notif.from_username, color: 'from-purple-500 to-indigo-500' })}>
                           <div className="mt-1">
                              {notif.type === 'request_accepted' ? <UserCheck className="w-3.5 h-3.5 text-blue-400" /> : <Bell className="w-3.5 h-3.5 text-purple-500" />}
                           </div>
                           <div className="flex-1 min-w-0 pr-6 cursor-pointer">
                              <p className="text-[11px] leading-tight font-medium" style={{ color: "var(--text-primary)" }}>{notif.message}</p>
                              <p className="text-[9px] text-white/40 mt-0.5 font-bold uppercase">{notif.time}</p>
                           </div>
                        </div>
                        <button className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-all"
                          onClick={() => {
                            setNotifications(prev => prev.filter(n => n.id !== notif.id));
                            nexoraFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ id: notif.id }) });
                          }}><X className="w-3 h-3" /></button>
                      </motion.div>
                    ))}
                  </motion.div>
                 )}
               </AnimatePresence>
            </div>
          )}

          {/* Online Users Horizontal Scroll */}
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1 mb-2 no-scrollbar" style={{ WebkitOverflowScrolling: "touch" }}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => { window.location.href = '/dashboard/stories?user=me'; }}
                className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
                <div className="relative">
                <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-black text-xl shadow-xl transition-all duration-300 ${myStoryPreview ? 'ring-[3px] ring-[#ff006e] ring-offset-2 bg-gradient-to-tr ' + (myProfile.color || "from-[#6c5ce7] to-[#00d4ff]") : 'ring-2 ring-transparent bg-gradient-to-tr ' + (myProfile.color || "from-[#6c5ce7] to-[#00d4ff]")} hover:scale-105 active:scale-95 uppercase overflow-hidden`}
                     style={myStoryPreview ? { border: `2px solid ${isDark ? '#12121c' : '#ffffff'}` } : {}}>
                    {myProfile.avatarUrl ? <img src={myProfile.avatarUrl} alt="" className="w-full h-full object-cover" /> : (myProfile.name?.[0] || "M").toUpperCase()}
                </div>
                <div className="absolute bottom-0 right-0 h-4 w-4 rounded-full bg-[#6c5ce7] shadow-md z-10 flex items-center justify-center cursor-pointer"
                    style={{ border: `2px solid ${isDark ? "#12121c" : "#ffffff"}` }}
                    onClick={(e) => { e.stopPropagation(); window.location.href = '/dashboard/stories?action=camera'; }}>
                    <Plus className="w-3 h-3 text-white font-bold" />
                </div>
                {myStories.length > 0 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white bg-black/80 backdrop-blur-md shadow-lg z-20 border border-white/10 whitespace-nowrap">
                    <Eye className="w-2.5 h-2.5" /> {myStories.reduce((acc, s) => acc + (s.views_count || 0), 0)}
                    <span className="opacity-30">·</span>
                    <Heart className="w-2.5 h-2.5 text-[#ff006e]" fill="#ff006e" /> {myStories.reduce((acc, s) => acc + (s.likes_count || 0), 0)}
                  </div>
                )}
                </div>
                <span className="text-[10px] font-bold truncate w-14 text-center" style={{ color: "var(--text-secondary)" }}>Your Story</span>
            </motion.div>
            {threads.filter(t => friendsWithStories.includes(t.username) || t.online || liveOnlineUsers.includes(t.username))
              .filter(t => !hiddenThreads.includes(t.id) && !blockedThreads.includes(t.id))
              .sort((a, b) => {
                 const aHas = friendsWithStories.includes(a.username) ? 1 : 0;
                 const bHas = friendsWithStories.includes(b.username) ? 1 : 0;
                 return bHas - aHas;
              })
              .map((user) => {
              const L = lockedChatsMap[user.id] && !unlockedSessionThreads.includes(user.id);
              if (L) return null;
              const isUserOnline = user.online || liveOnlineUsers.includes(user.username);
              const hasStory = friendsWithStories.includes(user.username);
              
              return (
                <motion.div key={user.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                  onClick={() => hasStory ? (window.location.href = `/dashboard/stories?user=${user.username}`) : handleOpenThread(user)}
                  className="flex flex-col items-center gap-1.5 cursor-pointer shrink-0">
                  <div className="relative">
                    <div className={`h-14 w-14 rounded-full flex items-center justify-center text-white font-black text-xl shadow-xl transition-all duration-300 ${hasStory ? 'ring-[3px] ring-[#ff006e] ring-offset-2 bg-gradient-to-tr ' + (user?.color?.includes('from-') ? user.color : 'from-[#6c5ce7] to-[#00d4ff]') : 'ring-2 ring-transparent bg-gradient-to-tr ' + (user?.color?.includes('from-') ? user.color : 'from-[#6c5ce7] to-[#00d4ff]')} hover:scale-105 active:scale-95 uppercase overflow-hidden`}
                         style={hasStory ? { border: `2px solid ${isDark ? '#12121c' : '#ffffff'}` } : {}}>
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : (nicknames[user.username]?.[0] || user.name?.[0] || user.username?.[0] || "?").toUpperCase()}
                    </div>
                    {isUserOnline && !hasStory && (
                      <div className="absolute bottom-0 right-0.5 h-4 w-4 rounded-full bg-[#2ed573] shadow-[0_0_10px_#2ed573] z-10 animate-pulse"
                        style={{ border: `3.5px solid ${isDark ? "#12121c" : "#ffffff"}` }} />
                    )}
                  </div>
                  <span className="text-[10px] font-bold truncate w-14 text-center" style={{ color: "var(--text-secondary)" }}>{(nicknames[user.username] || user.name || user.username || "").split(" ")[0]}</span>
                </motion.div>
              );
            })}
          </div>
          <div className="h-px w-full mb-3" style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />

          {threads
            .filter(t => !hiddenThreads.includes(t.id) && !blockedThreads.includes(t.id))
            .filter(t => !t.name.includes("Clearance"))
            .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .sort((a, b) => {
              const aPinned = pinnedThreads.includes(a.id) ? 1 : 0;
              const bPinned = pinnedThreads.includes(b.id) ? 1 : 0;
              return bPinned - aPinned;
            })
            .map((thread, i) => {
              const isActive = activeThread?.id === thread.id;
              const isPinned = pinnedThreads.includes(thread.id);
              const isLockedDisplay = lockedChatsMap[thread.id] && !unlockedSessionThreads.includes(thread.id);
              return (
                <motion.button key={thread.id}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ x: 2 }} whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenThread(thread)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all relative group/thread"
                  style={{ background: isActive ? (isDark ? "rgba(108,92,231,0.14)" : "rgba(108,92,231,0.08)") : "transparent" }}>
                  <div className="relative shrink-0">
                    <div className={`h-11 w-11 rounded-full ${isLockedDisplay ? 'bg-black border border-white/10' : `bg-gradient-to-tr ${thread.color?.includes('from-') ? thread.color : "from-[#6c5ce7] to-[#00d4ff]"}`} flex items-center justify-center text-white font-black text-sm shadow-lg border border-white/5 uppercase overflow-hidden`}
                      onClick={(e) => { e.stopPropagation(); isLockedDisplay ? handleOpenThread(thread) : setSelectedProfileUser(thread); }}>
                      {isLockedDisplay ? <Lock className="w-4 h-4 text-white/50" /> : thread.avatarUrl ? <img src={thread.avatarUrl} alt="" className="w-full h-full object-cover" /> : (nicknames[thread.username]?.[0] || thread.name?.[0] || thread.username?.[0] || "?").toUpperCase()}
                    </div>
                    {(!isLockedDisplay && (thread.online || liveOnlineUsers.includes(thread.username))) && (
                      <div className="absolute bottom-0 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#2ed573] shadow-[0_0_8px_#2ed573] z-10 animate-pulse-slow"
                        style={{ border: `2.5px solid ${isDark ? "#12121c" : "#ffffff"}` }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h3 className={`font-bold text-sm truncate ${isLockedDisplay ? 'italic text-white/50' : ''}`}
                          style={{ color: "var(--text-primary)" }}>
                          {isLockedDisplay ? "Locked Conversation" : (nicknames[thread.username] || thread.name)}
                        </h3>
                        {isPinned && <Pin className="h-3 w-3 shrink-0" style={{ color: "#6c5ce7", transform: "rotate(-45deg)" }} />}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isLockedDisplay && thread.unread > 0 && (
                          <span className="h-5 min-w-5 px-1 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
                            style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>{thread.unread}</span>
                        )}
                      </div>
                    </div>
                    {!isLockedDisplay && <p className="text-xs truncate mt-0.5" style={{ color: isActive ? "#6c5ce7" : "var(--text-muted)" }}>{thread.preview}</p>}
                  </div>
                </motion.button>
              );
            })}
        </div>

        {/* ═══ SELF PROFILE FOOTER ═══ */}
        <div className="mt-auto p-4 md:pb-4 pb-24 border-t shrink-0 backdrop-blur-md" style={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)", background: isDark ? "rgba(18,18,28,0.4)" : "rgba(255,255,255,0.5)" }}>
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="relative">
                    <div className={`h-10 w-10 rounded-full ${myProfile.color?.includes('from-') ? 'bg-gradient-to-tr ' + myProfile.color : "bg-gradient-to-tr from-[#6c5ce7] to-[#00d4ff]"} flex items-center justify-center text-white font-black text-sm shadow-lg border border-white/10 uppercase overflow-hidden`}>
                       {myProfile.avatarUrl ? <img src={myProfile.avatarUrl} alt="" className="w-full h-full object-cover" /> : (myProfile.name?.[0] || "M").toUpperCase()}
                    </div>
                    <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#2ed573] shadow-[0_0_6px_#2ed573] z-10 animate-pulse" 
                         style={{ border: `2px solid ${isDark ? "#12121c" : "#ffffff"}` }} />
                 </div>
                 <div className="min-w-0">
                    <p className="font-extrabold text-[13px] truncate" style={{ color: "var(--text-primary)" }}>{myProfile.name}</p>
                    <p className="text-[10px] font-bold opacity-50 truncate" style={{ color: "var(--text-muted)" }}>@{myProfile.username}</p>
                 </div>
              </div>
              <button 
                onClick={() => {
                  if(confirm("Logout from current session?")) {
                    localStorage.clear();
                    window.location.href = "/auth";
                  }
                }}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors">
                 <Lock className="w-4 h-4" />
              </button>
           </div>
        </div>
      </motion.div>

      {/* ═══ ACTIVE CHAT ═══ */}
      {activeThread ? (
        <div className="flex-1 flex flex-col min-w-0 max-h-full min-h-0 overflow-hidden relative animate-in fade-in slide-in-from-right-4 duration-500"
          style={{
            background: chatWallpaper ? "transparent" : "var(--bg-base)",
            ...(chatWallpaper ? { backgroundImage: `url(${chatWallpaper})`, backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "local" } : {})
          }}>

          {/* Chat Header */}
          <div className="sticky top-0 px-4 md:px-6 py-2 flex items-center justify-between border-b z-40 shrink-0 backdrop-blur-xl"
            style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
            <div className="flex items-center gap-3">
              {activeThread ? (
                <>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => router.push("/dashboard/chats", { scroll: false })}
                    className="p-2 md:p-2.5 rounded-2xl sm:hidden mr-1 md:mr-2 transition-all bg-black/[0.03] dark:bg-white/[0.05] active:scale-95"
                    style={{ color: "var(--text-primary)" }}>
                    <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
                  </motion.button>
                  <div className="relative shrink-0" onClick={() => setSelectedProfileUser(activeThread)}>
                    <div className={`h-9 w-9 md:h-11 md:w-11 rounded-full bg-gradient-to-tr ${activeThread.color || "from-[#6c5ce7] to-[#00d4ff]"} flex items-center justify-center text-white font-black text-sm md:text-base shadow-xl border border-white/10 cursor-pointer shrink-0 transition-transform active:scale-90 uppercase overflow-hidden`}
                         onClick={() => setSelectedProfileUser({ username: activeThread.username, name: activeThread.name, color: activeThread.color, avatarUrl: activeThread.avatarUrl })}>
                      {activeThread.avatarUrl ? <img src={activeThread.avatarUrl} alt="" className="w-full h-full object-cover" /> : (nicknames[activeThread.username]?.[0] || activeThread.name?.[0] || activeThread.username?.[0] || "?").toUpperCase()}
                    </div>
                    {activeThread.online || liveOnlineUsers.includes(activeThread.username) ? (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-[#2ed573] shadow-[0_0_8px_#2ed573] z-10 animate-pulse"
                        style={{ border: `2px solid ${isDark ? "#12121c" : "#ffffff"}` }} />
                    ) : null}
                  </div>
                  <div className="cursor-pointer group min-w-0 pr-2" onClick={() => setSelectedProfileUser(activeThread)}>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-extrabold text-[13px] md:text-base truncate transition-all group-hover:text-[#6c5ce7]"
                        style={{ color: "var(--text-primary)" }}>
                        {nicknames[activeThread.username] || activeThread.name}
                      </h3>
                      <span className="inline-flex text-[7px] md:text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-black uppercase tracking-tighter shrink-0 border border-purple-500/10 items-center justify-center shadow-sm">Verified</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`h-1.5 w-1.5 rounded-full ${activeThread.online || liveOnlineUsers.includes(activeThread.username) ? "bg-green-500 shadow-[0_0_5px_#2ed573]" : "bg-gray-500"}`} />
                      <span className="text-[9px] md:text-[10px] uppercase font-black tracking-wider truncate" style={{ color: activeThread.online || liveOnlineUsers.includes(activeThread.username) ? "#2ed573" : "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                        {peerTyping[activeThread.username] ? (
                          <>
                            TYPING
                            <span className="flex items-center gap-[2px] mt-[1px]">
                              <span className="w-[3px] h-[3px] rounded-full bg-[#2ed573] animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-[3px] h-[3px] rounded-full bg-[#2ed573] animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-[3px] h-[3px] rounded-full bg-[#2ed573] animate-bounce" style={{ animationDelay: '300ms' }} />
                            </span>
                          </>
                        ) : (activeThread.online || liveOnlineUsers.includes(activeThread.username) ? "Active Protocol" : "Offline")}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gray-200/20 animate-pulse" />
                  <div className="w-24 h-4 bg-gray-200/20 rounded animate-pulse" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full hidden sm:inline"
                style={{ background: "rgba(108,92,231,0.1)", color: "#6c5ce7" }}>AES-256 Encrypted</span>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleStartCall("voice")} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">
                <Phone className="w-5 h-5" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleStartCall("video")} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]">
                <Video className="w-5 h-5" />
              </motion.button>
              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => { setShowChatMenu(!showChatMenu); setShowDisappearSubmenu(false); }} className="p-2 rounded-xl bg-black/5 dark:bg-white/5 text-[var(--text-secondary)] relative">
                <MoreVertical className="w-5 h-5" />
              </motion.button>

              {showChatMenu && (
                <div className="absolute top-20 right-6 p-2 rounded-2xl shadow-xl flex flex-col gap-1 w-52 border z-50"
                  style={{ background: isDark ? "#161622" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                  <button onClick={() => { setShowWallpaperPicker(true); setShowChatMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><Wallpaper className="w-4 h-4 text-purple-500" /> Wallpaper</button>
                  <button onClick={() => { openSearchInChat(); setShowChatMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><Search className="w-4 h-4 text-blue-500" /> Search</button>
                  <button onClick={() => { setShowNicknameModal(true); setNicknameInput(nicknames[activeThread.username] || activeThread.name); setShowChatMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><Edit3 className="w-4 h-4 text-pink-500" /> Set Nickname</button>
                  {/* Disappearing submenu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDisappearSubmenu(p => !p)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"
                    >
                      <Timer className="w-4 h-4 text-orange-500" />
                      Disappearing
                      {disappearTimer !== "off" && <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400">{disappearTimer === "after_view" ? "After" : disappearTimer}</span>}
                      <ChevronRight className="w-3 h-3 ml-auto" style={{ transform: showDisappearSubmenu ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                    </button>
                    {showDisappearSubmenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-1 flex flex-col gap-0.5 border-l-2 pl-2"
                        style={{ borderColor: "rgba(251,146,60,0.3)" }}
                      >
                        {([
                          { label: "👁 After View", value: "after_view" as const },
                          { label: "⏱ 1 Hour", value: "1h" as const },
                          { label: "🕐 24 Hours", value: "24h" as const },
                          { label: "🔕 Off", value: "off" as const },
                        ]).map(opt => (
                            <button key={opt.value}
                              onClick={() => {
                                setDisappearTimer(opt.value as any);
                                if (activeThread) {
                                  localStorage.setItem(`nexora_disappear_${activeThread.id}`, opt.value);
                                  localStorage.setItem(`nexora_disappear_by_username_${activeThread.username}`, opt.value);
                                }
                                socketService.getSocket()?.emit("dm:disappear_setting", { to: activeThread?.username, timer: opt.value });
                                const notifMsg: ChatMessage = {
                                  id: Math.random().toString(), senderId: "system", text: `You set disappearing messages to ${opt.value === "off" ? "Off" : opt.value === "1h" ? "1 Hour" : opt.value === "24h" ? "24 Hours" : "After View"}`, timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), createdAt: Date.now(), isSelf: true, status: "delivered", reactions: {}, isSystemNotice: true
                                };
                                setMessages(prev => [...prev, notifMsg]);
                                setShowDisappearSubmenu(false);
                                setShowChatMenu(false);
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-left"
                              style={{ color: disappearTimer === opt.value ? "#fb923c" : "var(--text-primary)" }}
                            >
                              {opt.label}
                              {disappearTimer === opt.value && <Check className="w-3 h-3 ml-auto text-orange-400" />}
                            </button>
                        ))}
                      </motion.div>
                    )}
                  </div>
                  <button onClick={clearChat} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-red-500"><Trash2 className="w-4 h-4 text-red-500" /> Clear Chat</button>
                </div>
              )}
            </div>
          </div>

          {/* ── INLINE CHAT SEARCH BAR ── */}
          {searchInChat && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="px-4 py-2 flex items-center gap-2 border-b shrink-0"
              style={{ background: isDark ? "rgba(22,22,34,0.95)" : "rgba(255,255,255,0.95)", borderColor: "var(--border-subtle)" }}
            >
              <Search className="w-4 h-4 shrink-0" style={{ color: "#6c5ce7" }} />
              <input
                ref={chatSearchInputRef}
                type="text"
                value={chatSearchQuery}
                onChange={e => setChatSearchQuery(e.target.value)}
                placeholder="Search in chat..."
                className="flex-1 bg-transparent outline-none text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              />
              {chatSearchResults.length > 0 && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: "rgba(108,92,231,0.15)", color: "#6c5ce7" }}>
                  {chatSearchIndex + 1}/{chatSearchResults.length}
                </span>
              )}
              <div className="flex items-center gap-1">
                <button onClick={() => navigateSearchResult("up")} disabled={chatSearchResults.length === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                  style={{ color: "var(--text-secondary)" }}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => navigateSearchResult("down")} disabled={chatSearchResults.length === 0}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30"
                  style={{ color: "var(--text-secondary)" }}>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button onClick={closeSearchInChat}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--text-muted)" }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Messages Scroll Area */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4 space-y-2 relative custom-scrollbar">
            {messages.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 z-10 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center max-w-sm w-full"
                >
                  <div className="w-16 h-16 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-2xl relative"
                    style={{ background: "rgba(108,92,231,0.1)", backdropFilter: "blur(20px)", border: "1px solid rgba(108,92,231,0.2)" }}>
                    <Shield className="w-8 h-8 text-[#6c5ce7]" />
                    <div className="absolute inset-0 rounded-[2.5rem] bg-[#6c5ce7]/10 animate-pulse" />
                  </div>

                  <h2 className="text-2xl font-black mb-2 gradient-text" style={{ textShadow: "0 0 40px rgba(108,92,231,0.3)" }}>Secure Connection</h2>
                  <p className="text-[11px] font-bold opacity-60 mb-4 leading-relaxed max-w-[240px]" style={{ color: "var(--text-primary)" }}>
                    Start a private conversation with {activeThread?.name || "recipient"}. <br />Your tunnel is fully encrypted.
                  </p>
                </motion.div>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMatchHighlight = chatSearchResults[chatSearchIndex] === m.id;
                const isInSearchResults = chatSearchResults.includes(m.id);
                const isMedia = m.attachment && (m.attachment.type.startsWith("image/") || m.attachment.type.startsWith("video/"));
                const isAudio = m.attachment && m.attachment.type.startsWith("audio/");
                const isFile = m.attachment && !isMedia && !isAudio && m.attachment.type !== "location";
                const isLocation = m.attachment?.type === "location";

                return (
                  <div key={m.id || idx} id={`msg-${m.id}`} className={`flex ${m.isSelf ? "justify-end" : "justify-start"} group/msg relative transition-all`}
                    style={isMatchHighlight ? { filter: "brightness(1.15)" } : isInSearchResults ? { opacity: 0.75 } : {}}>
                    <div className={`max-w-[85%] md:max-w-[70%] lg:max-w-[60%] flex flex-col ${m.isSelf ? "items-end" : "items-start"}`}>

                      <div
                        onContextMenu={(e) => { e.preventDefault(); setMsgMenu(m.id); }}
                        onDoubleClick={(e) => { e.preventDefault(); setMsgMenu(m.id); }}
                        onTouchStart={() => {
                          longPressTimerRef.current = setTimeout(() => setMsgMenu(m.id), 600);
                        }}
                        onTouchEnd={() => { if(longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                        onTouchMove={() => { if(longPressTimerRef.current) clearTimeout(longPressTimerRef.current); }}
                        className={`p-4 rounded-[1.5rem] text-sm relative z-20 shadow-sm ${m.isSelf
                          ? "bg-gradient-to-br from-[#6c5ce7] to-[#8275f0] text-white rounded-tr-none neon-glow"
                          : "glass-panel rounded-tl-none"
                          }`}
                        style={{
                          ...(!m.isSelf ? { background: "var(--bg-card)", border: "1px solid var(--border-subtle)" } : {}),
                          ...(isMatchHighlight ? { boxShadow: "0 0 0 2px #6c5ce7, 0 0 20px rgba(108,92,231,0.4)" } : {})
                        }}>

                        {/* REPLY CONTEXT */}
                        {m.replyTo && (
                          <div className={`mb-2 p-2.5 rounded-xl border-l-[3px] text-[11px] font-bold leading-tight flex flex-col gap-0.5 ${m.isSelf ? 'bg-white/10 border-white/30 text-white/90' : 'bg-black/5 border-[#6c5ce7]/40 text-[var(--text-secondary)]'}`}>
                             <span className="text-[9px] uppercase tracking-widest opacity-60">Replying to msg</span>
                             <p className="truncate italic">"{messages.find(msg => msg.id === m.replyTo)?.text || "Media Attachment"}"</p>
                          </div>
                        )}

                        {/* POLL RENDER */}
                        {m.poll && (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex items-center gap-2 mb-2 font-bold opacity-90">
                              <BarChart3 className="w-4 h-4" /> Poll
                            </div>
                            <p className="font-bold text-base mb-2">{m.poll.question}</p>
                            {m.poll.options.map(opt => {
                              const totalVotes = m.poll!.options.reduce((sum, o) => sum + o.votes, 0);
                              const percent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);
                              const isVoted = m.poll!.votedOptions.includes(opt.id);

                              return (
                                <div key={opt.id} onClick={() => handleVotePoll(m.id, opt.id)}
                                  className="relative overflow-hidden p-2.5 rounded-xl cursor-pointer transition-all border group/opt"
                                  style={{
                                    borderColor: isVoted ? "rgba(46,213,115,0.5)" : "rgba(255,255,255,0.1)",
                                    background: isVoted ? "rgba(46,213,115,0.1)" : "rgba(255,255,255,0.05)"
                                  }}>
                                  <div className="absolute left-0 top-0 bottom-0 bg-[#2ed573] opacity-20 transition-all" style={{ width: `${percent}%` }} />
                                  <div className="relative flex justify-between items-center z-10 text-xs font-bold">
                                    <span className="flex items-center gap-2">{opt.text} {isVoted && <Check className="w-3 h-3 text-[#2ed573]" />}</span>
                                    <span>{percent}%</span>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="text-[10px] text-right mt-1 opacity-60 font-bold">
                              {m.poll.options.reduce((sum, o) => sum + o.votes, 0)} votes
                            </div>
                          </div>
                        )}


                        {/* NORMAL MEDIA & LOCATION */}
                        {isLocation && m.attachment?.url && (
                          <div className="rounded-xl overflow-hidden mb-2">
                            <iframe
                              src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${m.attachment.url.split(',')[1]}!3d${m.attachment.url.split(',')[0]}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin`}
                              width="100%"
                              height="150"
                              style={{ border: 0 }}
                              loading="lazy"
                              allowFullScreen
                            />
                            <a href={`https://www.google.com/maps?q=${m.attachment.url}`} target="_blank" rel="noopener noreferrer" className="text-[10px] underline block mt-2 text-center opacity-80 font-bold">📍 View full map</a>
                          </div>
                        )}

                        {isMedia && m.attachment && (
                          <div className="mb-2 rounded-xl overflow-hidden cursor-pointer">
                            {m.attachment.type.startsWith("image/") ? (
                              m.isViewOnce ? (
                                m.viewOnceOpened ? (
                                  <div className="p-4 border border-dashed border-white/20 rounded-xl bg-black/5 opacity-50 flex items-center justify-center italic text-xs">
                                    <EyeOff className="w-4 h-4 mr-2" /> Photo Viewed
                                  </div>
                                ) : (
                                  <div 
                                    className="relative max-w-full h-[150px] bg-black/20 overflow-hidden flex items-center justify-center group/vo"
                                    onClick={() => {
                                      // Tell other user it was viewed
                                      const socket = socketService.getSocket();
                                      if (socket && activeThread?.username && !m.isSelf) {
                                          socket.emit("dm:view_once_ack", { to: activeThread.username, msgId: m.id });
                                      }
                                      setImageViewer({ url: m.attachment!.url, name: m.attachment!.name });
                                      // Remove attachment from state entirely after view
                                      setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, viewOnceOpened: true, text: "📷 Photo Viewed", attachment: undefined } : msg));
                                    }}
                                  >
                                    <img src={m.attachment.url} alt="Hidden" className="absolute inset-0 w-full h-full object-cover blur-xl opacity-60" />
                                    <div className="z-10 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 group-hover/vo:scale-105 transition-transform">
                                      <Eye className="w-4 h-4 text-white" />
                                      <span className="text-white text-xs font-bold">Tap to view</span>
                                    </div>
                                  </div>
                                )
                              ) : (
                                <img src={m.attachment.url} alt="Shared" className="max-w-full max-h-[250px] object-cover hover:opacity-90 transition-opacity" onClick={() => setImageViewer({ url: m.attachment!.url, name: m.attachment!.name })} />
                              )
                            ) : (
                              <video src={m.attachment.url} controls className="max-w-full max-h-[250px] rounded-xl" />
                            )}
                          </div>
                        )}

                        {isAudio && (
                          <div className="flex items-center gap-3 p-2 rounded-[1.5rem] mb-2 shadow-inner" style={{ background: "rgba(0,0,0,0.15)", minWidth: "220px" }}>
                            <div className="w-10 h-10 rounded-full flex flex-shrink-0 items-center justify-center shadow-lg" style={{ background: m.isSelf ? "#ffffff" : "#6c5ce7", color: m.isSelf ? "#6c5ce7" : "#ffffff" }}>
                              <Mic className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0 pr-2">
                              {/* Native audio player with tailored filters to look in-line */}
                              <audio 
                                src={m.attachment!.url} 
                                controls 
                                controlsList="nodownload"
                                className={`w-full h-8 opacity-90 target-audio-player`} 
                                style={{
                                  filter: m.isSelf ? 'invert(1) grayscale(1) contrast(1.5)' : 'contrast(1.2) saturate(1.5) hue-rotate(-20deg) brightness(1.2)'
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {isFile && (
                          <div className="flex items-center gap-3 p-3 rounded-xl mb-2 bg-black/10">
                            <FileText className="w-8 h-8 opacity-70" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold truncate">{m.attachment!.name}</p>
                              <p className="text-[10px] opacity-70">{(m.attachment!.size || 0) / 1024 > 1024 ? `${((m.attachment!.size || 0) / 1024 / 1024).toFixed(2)} MB` : `${((m.attachment!.size || 0) / 1024).toFixed(2)} KB`} • {m.attachment!.type.split("/")[1]?.toUpperCase()}</p>
                            </div>
                            <a href={m.attachment!.url} download={m.attachment!.name} className="p-2 bg-white/10 rounded-full hover:bg-white/20"><Download className="w-4 h-4 text-white" /></a>
                          </div>
                        )}

                        {/* TEXT CONTENT */}
                        {m.text && <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>}

                        {/* TIMESTAMP & STATUS */}
                        <div className={`text-[9px] mt-1.5 flex items-center gap-1 opacity-70 ${m.isSelf ? "justify-end" : "justify-start"}`}>
                          {disappearTimer !== "off" && <Timer className="w-3 h-3" />}
                          {m.timestamp}
                          <TickIcon status={m.status} isSelf={m.isSelf} />
                        </div>

                        {/* RENDER REACTIONS */}
                        {Object.keys(m.reactions || {}).length > 0 && (
                          <div className={`absolute -bottom-3 ${m.isSelf ? "right-2" : "left-2"} flex items-center gap-1 bg-white dark:bg-[#161622] rounded-full px-1.5 py-0.5 shadow-md border dark:border-white/10 z-30`}>
                            {Object.entries(m.reactions || {}).map(([emoji, count]) => (
                              <span key={emoji} className="text-xs">{emoji} {(count as number) > 1 ? count as number : ""}</span>
                            ))}
                          </div>
                        )}

                        {/* MESSAGE MENU */}
                        {msgMenu === m.id && (
                          <div className={`absolute ${m.isSelf ? "right-full mr-2 top-0" : "left-full ml-2 top-0"} bg-white dark:bg-[#161622] rounded-2xl shadow-2xl border dark:border-white/10 flex flex-col overflow-hidden z-50 w-auto min-w-[140px] glass-panel`}>
                            {/* Reactions row */}
                            <div className="flex px-3 py-2 gap-2 justify-between border-b border-black/5 dark:border-white/10">
                              {REACTIONS.map(emoji => (
                                <button key={emoji} onClick={(e) => { e.stopPropagation(); addReaction(m.id, emoji); setMsgMenu(null); }} className="hover:scale-125 transition-transform text-sm">{emoji}</button>
                              ))}
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setReplyTo(m); setMsgMenu(null); }} className="px-4 py-3 text-xs font-bold text-left hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-3 transition-colors text-[var(--text-primary)]"><Reply className="w-3.5 h-3.5" /> Reply</button>
                            {m.isSelf && <button onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(m.id); setMsgMenu(null); }} className="px-4 py-3 text-xs font-bold text-left text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors"><Trash2 className="w-3.5 h-3.5" /> Delete</button>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            
            {/* ─── IN-CHAT REAL-TIME TYPING INDICATOR ─── */}
            <AnimatePresence>
              {peerTyping[activeThread.username] && (
                <motion.div 
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  className="flex justify-start mb-6 px-1"
                >
                  <div className="flex flex-col gap-1 items-start max-w-[85%]">
                    <div className="flex items-center gap-2 mb-1 pl-2">
                       <span className="text-[10px] uppercase font-black tracking-widest text-[#2ed573] flex items-center gap-1.5 drop-shadow-sm">
                         <div className="w-1.5 h-1.5 rounded-full bg-[#2ed573] animate-pulse" />
                         {nicknames[activeThread.username] || activeThread.name || activeThread.username} is typing
                       </span>
                    </div>
                    <div className="p-5 py-4 rounded-[2rem] rounded-bl-none shadow-lg border flex items-center gap-2"
                         style={{ background: isDark ? "rgba(26,26,46,0.8)" : "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: "var(--border-subtle)" }}>
                      <span className="w-[5px] h-[5px] rounded-full bg-[#6c5ce7] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-[5px] h-[5px] rounded-full bg-[#00d4ff] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-[5px] h-[5px] rounded-full bg-[#6c5ce7] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="px-3 md:px-4 py-2 border-t z-50 shrink-0"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}>

            {/* REPLY PREVIEW */}
            <AnimatePresence>
              {replyTo && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="mb-3 p-3 rounded-[1.5rem] bg-black/5 dark:bg-white/5 border border-dashed border-[#6c5ce7]/30 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#6c5ce7]/10 flex items-center justify-center shrink-0">
                      <Reply className="w-4 h-4 text-[#6c5ce7]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#6c5ce7]">Replying to</p>
                      <p className="text-xs font-bold truncate opacity-80" style={{ color: "var(--text-primary)" }}>{replyTo.text || "Media Attachment"}</p>
                    </div>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"><X className="w-4 h-4 text-[var(--text-muted)]" /></button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-2.5">
              {/* Actions Row (unified) */}
              {!isRecording && !audioPreviewUrl && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all neumorphic-btn"
                      style={{ background: showAttachMenu ? "#ff4757" : "var(--bg-surface-solid)", color: showAttachMenu ? "white" : "var(--text-secondary)" }}>
                      <Plus className={`w-5 h-5 transition-transform ${showAttachMenu ? "rotate-45" : ""}`} />
                    </motion.button>

                    <AnimatePresence>
                      {showAttachMenu && (
                        <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
                          className="absolute bottom-14 left-0 p-3 rounded-2xl shadow-xl flex flex-col gap-1.5 w-52 border min-w-max z-50"
                          style={{ background: isDark ? "#161622" : "#ffffff", borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)" }}>
                          <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><ImageIcon className="w-4 h-4 text-blue-500" /> Photo / Video</button>
                          <button onClick={() => { fileInputRef.current?.click(); setShowAttachMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><FileText className="w-4 h-4 text-purple-500" /> Document</button>
                          <button onClick={() => { handleShareLocation(); setShowAttachMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><MapPin className="w-4 h-4 text-green-500" /> Location</button>
                          <button onClick={() => { setShowPollCreator(true); setShowAttachMenu(false); }} className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-black/5 dark:hover:bg-white/5 text-sm font-bold text-[var(--text-primary)]"><BarChart3 className="w-4 h-4 text-orange-500" /> Create Poll</button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* DEDICATED SNAPSHOT BUTTON */}
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={handleCameraCapture}
                    className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all neumorphic-btn text-[var(--text-secondary)]"
                    title="Take Snapshot">
                    <Camera className="w-5 h-5" />
                  </motion.button>
                </div>
              )}

              {/* Input Field / Audio Preview / Recording */}
              <AnimatePresence mode="wait" initial={false}>
                {audioPreviewUrl ? (
                  /* ── AUDIO PREVIEW BAR ── */
                  <motion.div
                    key="audio-preview"
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex items-center gap-3 mx-1 px-3 py-2 rounded-2xl border"
                    style={{
                      background: isDark ? "linear-gradient(135deg,rgba(108,92,231,0.18),rgba(0,212,255,0.10))" : "linear-gradient(135deg,rgba(108,92,231,0.10),rgba(0,212,255,0.07))",
                      borderColor: isDark ? "rgba(108,92,231,0.35)" : "rgba(108,92,231,0.20)",
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    {/* Play/Pause */}
                    <motion.button
                      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.92 }}
                      onClick={() => {
                        if (!audioPreviewRef.current) return;
                        if (audioPreviewRef.current.paused) { audioPreviewRef.current.play(); setIsPlayingPreview(true); }
                        else { audioPreviewRef.current.pause(); setIsPlayingPreview(false); }
                      }}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-lg"
                      style={{ background: "linear-gradient(135deg,#6c5ce7,#a855f7)" }}
                    >
                      {isPlayingPreview ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
                    </motion.button>

                    {/* Waveform progress bar */}
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: "rgba(108,92,231,0.18)" }}>
                        <motion.div
                          className="absolute left-0 top-0 h-full rounded-full"
                          style={{ background: "linear-gradient(90deg,#6c5ce7,#00d4ff)" }}
                          animate={{ width: isPlayingPreview ? "100%" : "0%" }}
                          transition={{ duration: recordingTime, ease: "linear" }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] font-bold text-[#6c5ce7]">🎙 Voice</span>
                        <span className="text-[10px] font-mono font-bold opacity-60">{fmt(recordingTime)}</span>
                      </div>
                    </div>

                    <audio ref={audioPreviewRef} src={audioPreviewUrl} onEnded={() => setIsPlayingPreview(false)} className="hidden" />

                    {/* Trash */}
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={cancelAudioPreview}
                      className="w-8 h-8 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-500/15 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </motion.button>

                    {/* SEND BUTTON — inside the preview bar so it's always visible */}
                    <motion.button
                      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
                      onClick={sendAudioPreview}
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-lg text-white"
                      style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </motion.button>
                  </motion.div>

                ) : isRecording ? (
                  /* ── LIVE RECORDING BAR ── */
                  <motion.div
                    key="recording"
                    initial={{ opacity: 0, scale: 0.95, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex items-center gap-3 mx-1 px-4 py-2.5 rounded-2xl border"
                    style={{
                      background: isDark ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.07)",
                      borderColor: "rgba(239,68,68,0.30)",
                    }}
                  >
                    {/* Pulse dot + timer */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-2.5 h-2.5 rounded-full bg-red-500 ${isRecordingPaused ? "opacity-40" : "animate-pulse"}`} />
                      <span className="text-red-500 font-bold font-mono text-sm">{fmt(recordingTime)}</span>
                    </div>

                    {/* Live Waveform */}
                    <div className="flex-1 flex items-end justify-center gap-[2px] h-8 overflow-hidden">
                      {visualizerData.map((val, i) => (
                        <motion.span
                          key={i}
                          animate={{ height: isRecordingPaused ? 4 : Math.max(4, val * 0.28) }}
                          transition={{ duration: 0.06, ease: "linear" }}
                          className="inline-block rounded-full shrink-0"
                          style={{
                            width: 3,
                            background: isRecordingPaused
                              ? "rgba(239,68,68,0.35)"
                              : `hsl(${345 - i * 4},90%,60%)`,
                          }}
                        />
                      ))}
                    </div>

                    {/* Pause / Resume */}
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={isRecordingPaused ? resumeRecording : pauseRecording}
                      className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center shrink-0">
                      {isRecordingPaused ? <Play className="w-3.5 h-3.5 ml-0.5" /> : <Pause className="w-3.5 h-3.5" />}
                    </motion.button>

                    {/* Stop → goes to preview */}
                    <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                      onClick={stopRecording}
                      className="w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-md"
                      style={{ background: "linear-gradient(135deg,#6c5ce7,#a855f7)" }}>
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </motion.button>
                  </motion.div>

                ) : (
                  /* ── NORMAL TEXT INPUT ── */
                  <motion.div
                    key="text-input"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 neumorphic-input rounded-2xl flex items-center px-4 py-2.5 h-11"
                  >
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => handleInputChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); handleSendMessage(); }
                      }}
                      placeholder="Type message..."
                      className="w-full bg-transparent outline-none text-sm font-medium"
                      style={{ color: "var(--text-primary)" }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Right-side action buttons (mic / send) */}
              <AnimatePresence mode="popLayout" initial={false}>
                {!audioPreviewUrl && !inputValue.trim() && (
                  /* MIC button — start recording */
                  <motion.button
                    key="mic-btn"
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={isRecording ? undefined : startRecording}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isRecording ? "bg-red-500 text-white shadow-lg shadow-red-500/25" : "neumorphic-btn text-[var(--text-secondary)]"}`}
                  >
                    <Mic className="w-5 h-5" />
                  </motion.button>
                )}

                {/* SEND button (text or audio-already-has-its-own-send, so only show for text) */}
                {!audioPreviewUrl && !isRecording && (
                  <motion.button
                    key="send-btn"
                    initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }}
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim()}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${inputValue.trim() ? "bg-[#6c5ce7] text-white shadow-xl shadow-purple-500/30" : "glass-panel opacity-40 text-muted"}`}
                  >
                    <Send className="w-5 h-5 ml-0.5" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 flex-col items-center justify-center relative p-8 text-center" style={{ background: isDark ? "rgba(12,12,20,0.5)" : "rgba(240,242,250,0.5)" }}>
          {/* Animated background blobs for the greeting */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#6c5ce7]/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00d4ff]/20 rounded-full blur-[100px] pointer-events-none animate-pulse-slow" style={{ animationDelay: "2s" }} />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-2xl mb-8 border" style={{ background: "linear-gradient(135deg, rgba(108,92,231,0.1), rgba(0,212,255,0.1))", borderColor: "rgba(255,255,255,0.05)", backdropFilter: "blur(20px)" }}>
              <img src="/logo.svg" alt="Nexora" className="w-14 h-14 drop-shadow-lg" />
            </div>
            <h1 className="text-5xl font-black mb-4 tracking-tighter" style={{ background: "linear-gradient(to right, #6c5ce7, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Welcome to Nexora</h1>
            <p className="text-base max-w-md mb-8 leading-relaxed font-medium" style={{ color: "var(--text-muted)" }}>
              The deeply encrypted, privacy-first communication protocol. 
              Select a conversation from the sidebar to establish a secure tunnel.
            </p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => { setShowGlobalSearch(true); setGlobalSearchQuery(""); setGlobalSearchResults([]); }}
              className="px-8 py-4 rounded-2xl text-sm font-black text-white shadow-xl shadow-purple-500/20 flex items-center gap-3 transition-all"
              style={{ background: "linear-gradient(135deg, #6c5ce7, #00d4ff)" }}>
              <Search className="w-4 h-4" /> Start a Secure Chat
            </motion.button>
          </div>
        </div>
      )}

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
              className="w-full max-w-lg mx-auto mt-16 rounded-[2.5rem] overflow-hidden shadow-2xl glass-panel relative"
              style={{
                background: "var(--bg-surface)",
                borderColor: "var(--border-subtle)",
                boxShadow: "0 40px 100px rgba(0,0,0,0.5)"
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
                    {globalSearchResults.map((user: any) => {
                      const alreadyRequested = sentRequests.includes(user.username);
                      const alreadyConnected = threads.some((t: any) => t.username === user.username);
                      return (
                        <motion.div key={user.username}
                          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectedProfileUser(user)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors hover:bg-[rgba(108,92,231,0.05)]"
                          style={{ background: "transparent" }}
                        >
                          <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${user.color || "from-purple-500 to-indigo-500"} flex items-center justify-center text-white font-bold text-base shadow-md shrink-0 overflow-hidden`}>
                            {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" /> : user.fullName?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{user.fullName}</p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
                          </div>
                          {alreadyConnected ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(46,213,115,0.12)", color: "#2ed573" }}>Connected ✓</span>
                          ) : alreadyRequested ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,190,11,0.12)", color: "#ffbe0b" }}>Sent ✓</span>
                          ) : (
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); handleSendConnectionRequest(user, e); }}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl text-white shrink-0"
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
      </AnimatePresence>

      {/* ═══ POLL CREATOR MODAL ═══ */}
      <AnimatePresence>
        {showPollCreator && (
          <div className="fixed inset-0 z-[500] flex flex-col justify-end lg:items-center lg:justify-center p-0 lg:p-4 bg-black/60 backdrop-blur" onClick={() => setShowPollCreator(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="w-full lg:max-w-md rounded-t-[3rem] lg:rounded-[2.5rem] shadow-2xl relative flex flex-col max-h-[90vh] glass-panel"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
              onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto my-3 lg:hidden" />
              <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)" }}>
                <h3 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <BarChart3 className="w-5 h-5 text-orange-500" /> Create Poll
                </h3>
                <button onClick={() => setShowPollCreator(false)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-[var(--text-muted)] hover:bg-black/10 dark:hover:bg-white/10"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="mb-6">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60 mb-2 block" style={{ color: "var(--text-primary)" }}>Question</label>
                  <input type="text" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} placeholder="Ask a question..." className="w-full neumorphic-input px-5 py-4 rounded-2xl border-none outline-none font-bold" style={{ color: "var(--text-primary)" }} />
                </div>

                <div className="mb-6 space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest opacity-60 block" style={{ color: "var(--text-primary)" }}>Options</label>
                  <AnimatePresence>
                    {pollOptions.map((opt: string, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2">
                        <input type="text" value={opt} onChange={e => { const newOpts = [...pollOptions]; newOpts[i] = e.target.value; setPollOptions(newOpts); }} placeholder={`Option ${i + 1}`} className="flex-1 bg-black/5 dark:bg-white/5 px-4 py-3 rounded-xl border-none outline-none font-bold placeholder:opacity-50" style={{ color: "var(--text-primary)" }} />
                        {pollOptions.length > 2 && (
                          <button onClick={() => removePollOption(i)} className="w-10 h-10 shrink-0 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {pollOptions.length < 8 && (
                    <button onClick={addPollOption} className="mt-2 text-sm font-bold flex items-center gap-2 text-[#6c5ce7] p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg w-full">
                      <Plus className="w-4 h-4" /> Add Option
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl border" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)", background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Allow Multiple Answers</p>
                    <p className="text-xs mt-0.5 opacity-60" style={{ color: "var(--text-muted)" }}>Users can select more than one option</p>
                  </div>
                  <button onClick={() => setPollMultiple(!pollMultiple)} className="w-12 h-6 rounded-full relative transition-colors" style={{ background: pollMultiple ? "#2ed573" : "rgba(108,92,231,0.2)" }}>
                    <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all shadow-sm ${pollMultiple ? "left-7" : "left-1"}`} />
                  </button>
                </div>
              </div>

              <div className="p-6 border-t" style={{ borderColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }}>
                <button onClick={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.filter((o: string) => o.trim()).length < 2} className="w-full py-4 rounded-2xl font-black text-sm text-white shadow-xl shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all" style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)" }}>Send Poll</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>



      {/* ═══ REAL CAMERA MODAL ═══ */}
      <AnimatePresence>
        {cameraView.active && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[800] bg-black flex flex-col"
          >
            {/* Camera top bar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-5 bg-gradient-to-b from-black/70 to-transparent">
              <button onClick={closeCameraView} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </button>
              <span className="text-white font-black text-sm tracking-widest uppercase">
                Camera
              </span>
              <button onClick={flipSnapCamera} className="w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20">
                <RefreshCcw className="w-5 h-5" />
              </button>
            </div>

            {/* Live view or captured preview */}
            <div className="flex-1 relative overflow-hidden">
              {!cameraView.capturedUrl ? (
                <video
                  ref={liveVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ transform: cameraView.facingMode === "user" ? "scaleX(-1)" : "none" }}
                />
              ) : (
                <img
                  src={cameraView.capturedUrl}
                  alt="Captured"
                  className="w-full h-full object-contain bg-black"
                />
              )}
              {/* Ephemeral badge */}

            </div>

            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 z-20 pb-10 pt-6 px-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center gap-6">
              


              <div className="flex items-center justify-center gap-8 w-full">
                {!cameraView.capturedUrl ? (
                  <>
                    <div className="w-14" />{/* spacer */}
                    {/* Capture shutter button */}
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={capturePhoto}
                      className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center shadow-2xl"
                      style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(10px)" }}
                    >
                      <div className="w-14 h-14 rounded-full bg-white shadow-inner" />
                    </motion.button>
                    <div className="w-14" />{/* spacer */}
                  </>
                ) : (
                  <>
                    {/* Retake */}
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setCameraView(p => ({ ...p, capturedUrl: null }))}
                      className="flex-1 py-4 rounded-2xl font-black text-sm text-white border border-white/20 bg-white/10 backdrop-blur"
                    >
                      Retake
                    </motion.button>
                    {/* Send */}
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={sendCapturedPhoto}
                      className="flex-1 py-4 rounded-2xl font-black text-sm text-white shadow-xl flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#6c5ce7,#00d4ff)", boxShadow: "0 10px 30px rgba(108,92,231,0.4)" }}
                    >
                      <Send className="w-4 h-4" /> Send Photo
                    </motion.button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ WALLPAPER PICKER MODAL ═══ */}
      <AnimatePresence>
        {showWallpaperPicker && (
          <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur flex flex-col justify-end lg:items-center lg:justify-center p-0 lg:p-4" onClick={() => setShowWallpaperPicker(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="bg-white dark:bg-[#0c0c14] w-full lg:max-w-xl rounded-t-[2rem] lg:rounded-3xl p-6 shadow-2xl border dark:border-white/10" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-white/20 rounded-full mx-auto mb-6 lg:hidden" />
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>Chat Theme</h3>
                <button onClick={() => setShowWallpaperPicker(false)} className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-4 mb-2 no-scrollbar">
                {WALLPAPER_CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setWallpaperCategory(cat.id)}
                    className={`px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-colors ${wallpaperCategory === cat.id ? "bg-[#6c5ce7] text-white shadow-lg shadow-purple-500/30" : "bg-black/5 dark:bg-white/5 text-[var(--text-secondary)]"}`}>
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 lg:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar pb-6">
                <div onClick={() => wallpaperUploadRef.current?.click()} className="aspect-[9/16] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-muted)] dark:border-white/20 transition-all hover:scale-[1.02]">
                  <Upload className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Custom</span>
                </div>
                <div onClick={() => setWallpaperForChat(null)} className="aspect-[9/16] rounded-2xl border flex flex-col items-center justify-center cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-muted)] dark:border-white/10 transition-all hover:scale-[1.02]">
                  <XCircle className="w-6 h-6 mb-2" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Default</span>
                </div>
                {WALLPAPER_PRESETS.filter(p => p.category === wallpaperCategory).map(preset => (
                  <div key={preset.id} onClick={() => setWallpaperForChat(preset.src)} className="aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer relative group shadow-sm transition-all hover:scale-[1.02]">
                    <img src={preset.src} alt={preset.label} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    {chatWallpaper === preset.src && <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center"><Check className="w-8 h-8 text-white drop-shadow-lg" /></div>}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ IMAGE VIEWER OVERLAY ═══ */}
      <AnimatePresence>
        {imageViewer && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center bg-black/95 backdrop-blur-sm" onClick={() => setImageViewer(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative max-w-full max-h-full p-4 flex flex-col items-center">
              <div className="absolute top-4 right-4 flex gap-4">
                <a href={imageViewer.url} download={imageViewer.name} onClick={e => e.stopPropagation()} className="p-3 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors">
                  <Download className="w-5 h-5" />
                </a>
                <button onClick={() => setImageViewer(null)} className="p-3 bg-white/10 backdrop-blur rounded-full hover:bg-white/20 text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <img src={imageViewer.url} alt={imageViewer.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ DELETE CONFIRM MODAL ═══ */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur" onClick={() => setDeleteConfirmId(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-[320px] p-6 rounded-[2rem] shadow-2xl relative text-center border overflow-hidden" 
              style={{ background: isDark ? "#161622" : "#ffffff", borderColor: "var(--border-subtle)" }} onClick={e => e.stopPropagation()}>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black mb-2" style={{ color: "var(--text-primary)" }}>Delete Message?</h3>
              <p className="text-sm opacity-70 mb-8 px-4" style={{ color: "var(--text-secondary)" }}>This message will be permanently removed for everyone in this conversation.</p>
              <div className="flex items-center gap-3">
                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3.5 rounded-2xl font-bold transition-colors hover:bg-black/5 dark:hover:bg-white/5" style={{ color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={() => { deleteMsg(deleteConfirmId); setDeleteConfirmId(null); }} className="flex-1 py-3.5 rounded-2xl font-bold bg-red-500 text-white shadow-xl shadow-red-500/30 hover:bg-red-600 transition-colors">Delete for all</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ PREMIUM USER PROFILE MODAL ═══ */}
      <AnimatePresence>
        {selectedProfileUser && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6 backdrop-blur-3xl bg-black/50"
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
                  className="absolute top-5 right-5 w-12 h-12 rounded-2xl bg-black/50 hover:bg-black/70 text-white transition-all backdrop-blur-xl active:scale-95 z-[50] flex items-center justify-center border border-white/20 shadow-2xl"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="px-10 pb-10 -mt-20 relative z-10">
                <div className="flex flex-col items-center">
                  <div className={`h-36 w-36 rounded-full bg-gradient-to-tr ${selectedProfileUser.color || 'from-[#6c5ce7] to-[#a29bfe]'} border-[8px] ${isDark ? 'border-[#12121e]' : 'border-white'} shadow-2xl flex items-center justify-center text-white text-5xl font-black mb-6 relative group/avatar overflow-hidden`}>
                    {selectedProfileUser.avatarUrl ? (
                      <img src={selectedProfileUser.avatarUrl} alt="" className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500" />
                    ) : (
                      <span className="group-hover/avatar:scale-110 transition-transform duration-500 text-white uppercase drop-shadow-2xl">
                        {(nicknames[selectedProfileUser.username]?.[0] || selectedProfileUser.name?.[0] || selectedProfileUser.username?.[0] || "?").toUpperCase()}
                      </span>
                    )}
                    {(selectedProfileUser.online || liveOnlineUsers.includes(selectedProfileUser.username)) && (
                      <motion.div 
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-[#2ed573] border-[5px] border-inherit shadow-lg" 
                      />
                    )}
                  </div>

                  <div className="text-center mb-8">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <h2 className="text-3xl font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                        {nicknames[selectedProfileUser.username] || selectedProfileUser.name || selectedProfileUser.username}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/10">Verified</span>
                    </div>
                    <p className="text-base font-black opacity-30 tracking-tight" style={{ color: "var(--text-muted)" }}>
                      @{selectedProfileUser.username}
                    </p>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-4">
                      <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/10 shadow-sm text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        Nexora User
                      </span>
                      <span className="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-green-500/10 text-green-500 border border-green-500/10 shadow-sm text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        🔒 End-to-End Encrypted
                      </span>
                    </div>
                  </div>

                  <div className="w-full mb-8 p-6 rounded-[32px] bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 backdrop-blur-md">
                     <div className="flex items-center gap-2 mb-3 opacity-50">
                        <span className="text-base">📝</span>
                        <h4 className="text-[11px] uppercase font-black tracking-[0.15em]" style={{ color: "var(--text-primary)" }}>About Me</h4>
                     </div>
                     <div className="text-sm font-medium leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {loadingProfile ? (
                        <div className="py-2">
                           <LoadingAnimation variant="pulse" size="sm" color="var(--color-primary)" text="Loading..." />
                        </div>
                      ) : profileData?.bio ? profileData.bio : <span className="opacity-50 italic">No bio yet.</span>}
                    </div>
                  </div>

                  {/* Voice/Video calls removed per user request */}

                  <div className="flex gap-3 w-full">
                    <motion.button 
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                      onClick={() => { 
                        const thread = threads.find(t => t.username === selectedProfileUser.username);
                        if (thread) { handleOpenThread(thread); setSelectedProfileUser(null); }
                      }}
                      className="flex-1 py-4.5 rounded-[28px] bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 font-black uppercase text-[11px] tracking-widest transition-all"
                      style={{ color: "var(--text-primary)" }}
                    >
                      Message
                    </motion.button>
                    
                    {blockedThreads.includes(selectedProfileUser.id || 0) || blockedThreads.includes(threads.find(t => t.username === selectedProfileUser.username)?.id || -1) ? (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleUnblockUser(selectedProfileUser.id || threads.find(t => t.username === selectedProfileUser.username)?.id || 0)}
                        className="px-8 py-4.5 rounded-[28px] bg-green-500/10 text-green-500 font-black uppercase text-[11px] tracking-widest border border-green-500/20"
                      >
                        Unblock
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                        onClick={() => handleBlockUser(selectedProfileUser.id || threads.find(t => t.username === selectedProfileUser.username)?.id || 0)}
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

      {/* ─── RESTORED INCOMING CALL OVERLAY (Synced) ─── */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[2000] flex items-center justify-center p-6 backdrop-blur-2xl bg-black/60">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="glass-panel w-full max-w-sm rounded-[3rem] p-8 flex flex-col items-center text-center shadow-2xl border-white/10">
              <div className={`w-28 h-28 rounded-full bg-gradient-to-tr ${incomingCall.fromColor} flex items-center justify-center text-white text-4xl font-black mb-6 shadow-[0_0_50px_rgba(108,92,231,0.3)] animate-pulse`}>
                {incomingCall.fromName?.[0] || "?"}
              </div>
              <h2 className="text-2xl font-black mb-1 gradient-text">{incomingCall.fromName}</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-8">Incoming {incomingCall.type} Call</p>
              
              <div className="flex gap-6 w-full">
                <button onClick={handleDecline} 
                  className="flex-1 py-4.5 rounded-[2rem] bg-red-500/10 text-red-500 font-extrabold uppercase text-[10px] tracking-widest border border-red-500/20 hover:bg-red-500/20 transition-all">
                  Decline
                </button>
                <button onClick={handleAccept} 
                  className="flex-1 py-4.5 rounded-[2rem] bg-[#2ed573] text-white font-extrabold uppercase text-[10px] tracking-widest shadow-[0_10px_30px_rgba(46,213,115,0.3)] hover:scale-105 transition-all">
                  Accept
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── RESTORED ACTIVE CALL UI (Synced) ─── */}
      <AnimatePresence>
        {callState.isActive && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className={`fixed z-[1500] bg-[#0c0c14] text-white flex flex-col items-center justify-center overflow-hidden transition-all duration-700 shadow-2xl ${
              callState.isFullscreen ? "inset-0" : "bottom-6 right-6 w-72 h-44 rounded-[2.5rem] border border-white/20"
            }`}>
            
            {/* Call Header */}
            <div className="absolute top-8 left-0 right-0 z-50 flex items-center justify-between px-10 pointer-events-none">
               <button onClick={maximize} className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white pointer-events-auto hover:bg-white/20 transition-all">
                  <Maximize2 className="w-5 h-5" />
               </button>
               <div className="flex items-center gap-2 bg-black/50 backdrop-blur-2xl px-5 py-2.5 rounded-full border border-white/10 shadow-2xl">
                  <Lock className="w-3.5 h-3.5 text-[#2ed573]" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2ed573]">E2E Tunnel Active</span>
               </div>
            </div>

            {/* Main Content Area */}
            <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
               {/* Ambient Gradients */}
               <div className={`absolute top-0 right-0 w-[80vw] h-[80vw] bg-gradient-to-br ${callState.remoteColor || "from-[#6c5ce7] to-[#00d4ff]"} opacity-10 rounded-full blur-[120px] animate-pulse`} />
               
               {/* Video Streams */}
               {callState.type === "video" && (
                 <div className="absolute inset-0 z-0">
                    {callState.remoteStream && (
                      <video autoPlay playsInline ref={v => { if(v) v.srcObject = callState.remoteStream }} className="w-full h-full object-cover" />
                    )}
                    {callState.localStream && (
                      <div className="absolute top-24 right-8 w-32 h-44 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl z-20">
                         <video autoPlay playsInline muted ref={v => { if(v) v.srcObject = callState.localStream }} className="w-full h-full object-cover scale-x-[-1]" />
                      </div>
                    )}
                 </div>
               )}

               <div className="relative z-10 flex flex-col items-center">
                  <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full flex items-center justify-center shadow-2xl z-10 bg-gradient-to-tr ${callState.remoteColor || "from-[#6c5ce7] to-[#00d4ff]"} border-[10px] border-[#0c0c14] mb-8`}>
                     <span className="text-6xl font-black text-white uppercase">{callState.remoteName?.[0] || "?"}</span>
                  </div>
                  <h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tight drop-shadow-2xl">{callState.remoteName}</h2>
                  <div className="bg-black/40 backdrop-blur-3xl px-8 py-3 rounded-full border border-white/10 font-mono text-xl md:text-2xl font-black text-[#2ed573] shadow-2xl tracking-widest">
                     {callState.status === "ringing" ? "ESTABLISHING..." : callState.duration}
                  </div>
               </div>
            </div>

            {/* Interaction Bar */}
            <div className="absolute bottom-12 left-0 right-0 flex items-center justify-center gap-8 z-50">
               <motion.button onClick={toggleMute} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${callState.isMuted ? "bg-white text-black" : "bg-white/10 backdrop-blur-xl border border-white/10"}`}>
                  {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
               </motion.button>
               
               <motion.button onClick={() => handleEnd()} whileHover={{ scale: 1.1, rotate: 90 }} whileTap={{ scale: 0.9 }} className="w-24 h-24 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_60px_rgba(239,68,68,0.5)]">
                  <PhoneOff className="w-10 h-10" />
               </motion.button>

               <motion.button onClick={toggleVideo} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${callState.isVideoOff ? "bg-white text-black" : "bg-white/10 backdrop-blur-xl border border-white/10"}`}>
                  {callState.isVideoOff ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
               </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showNicknameModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="glass-panel w-full max-w-sm rounded-[2rem] p-6 shadow-2xl flex flex-col items-center">
              <h2 className="text-xl font-black mb-4 gradient-text">Set Nickname</h2>
              <input value={nicknameInput} onChange={e => setNicknameInput(e.target.value)} placeholder="Instagram-friendly nickname..." autoFocus className="w-full bg-black/5 dark:bg-white/5 p-4 rounded-2xl outline-none font-bold text-center mb-6" style={{ color: "var(--text-primary)" }} />
              <div className="flex gap-4 w-full">
                <button onClick={() => setShowNicknameModal(false)} className="flex-1 py-3 rounded-xl bg-black/10 dark:bg-white/10 font-bold uppercase text-[10px] tracking-widest hover:opacity-80" style={{ color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={() => {
                   if (!activeThread?.username) return;
                   const updated = { ...nicknames, [activeThread.username]: nicknameInput || activeThread.name };
                   setNicknames(updated);
                   localStorage.setItem("nexora_nicknames", JSON.stringify(updated));
                   setShowNicknameModal(false);
                }} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#6c5ce7] to-[#00d4ff] text-white font-bold uppercase text-[10px] tracking-widest hover:opacity-90 shadow-[0_10px_20px_rgba(108,92,231,0.3)]">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Contact Sync & Find Modal ── */}
      <AnimatePresence>
        {showSyncModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSyncModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-md max-h-[85vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-white/10" style={{ background: "var(--bg-surface-solid)" }}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
                <div>
                   <h3 className="text-xl font-black uppercase tracking-widest text-primary">Find Friends</h3>
                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Snap-Style Contact Sync</p>
                </div>
                <button onClick={() => setShowSyncModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {/* Search History Section */}
                {searchHistory.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-primary/60">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Recent Activity</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                       {searchHistory.map(h => (
                         <motion.button key={h} whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={() => { setShowSyncModal(false); setShowGlobalSearch(true); setGlobalSearchQuery(h); }} className="px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-[11px] font-bold text-primary hover:bg-white/10 transition-all">
                           @{h}
                         </motion.button>
                       ))}
                    </div>
                  </div>
                )}

                {/* Contact Sync Section */}
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 text-center">
                    <Users className="w-8 h-8 text-indigo-400 mx-auto mb-3" />
                    <p className="text-sm font-bold mb-4">કોન્ટેક્ટ્સ સિંક કરીને તમારા મિત્રોને શોધો</p>
                    <button onClick={handleNativeSync} disabled={isSyncing} className="w-full py-3 rounded-xl bg-indigo-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                      {isSyncing ? "સિંકિંગ થઈ રહ્યું છે..." : "🚀 Sync Phone Contacts"}
                    </button>
                    <p className="text-[9px] mt-3 uppercase tracking-tighter opacity-40 font-bold">Privacy Protocol: નંબરો હેશ કરીને ચેક થશે, રિયલ નંબર સેવ નહિ થાય.</p>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/5"></span></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-black bg-[var(--bg-surface-solid)] px-2 text-muted-foreground opacity-40">Or Manual Entry</div>
                  </div>

                  <div className="flex gap-2">
                    <input type="text" value={manualPhone} onChange={e => setManualPhone(e.target.value)} placeholder="Phone or Username..." className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 outline-none text-sm font-bold focus:border-indigo-500 transition-colors" onKeyDown={e => e.key === 'Enter' && handleManualAdd()} />
                    <button onClick={handleManualAdd} className="p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all"><Search className="w-5 h-5" /></button>
                  </div>
                </div>

                {/* Sync Results */}
                {syncMatches.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <h4 className="text-[11px] font-black uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" /> Found on Nexora
                    </h4>
                    <div className="space-y-3">
                      {syncMatches.map(u => {
                        const isConnected = threads.some(t => t.username === u.username);
                        const isRequested = sentRequests.includes(u.username);
                        return (
                          <div key={u.username} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 group hover:border-indigo-500/30 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full bg-gradient-to-tr ${u.color || 'from-indigo-500 to-purple-500'} flex items-center justify-center text-white font-black text-sm overflow-hidden`}>
                                {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" /> : (u.fullName?.[0] || u.username?.[0]).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-bold truncate leading-tight">{u.fullName || u.username}</p>
                                <p className="text-[10px] text-muted-foreground font-medium opacity-50">@{u.username}</p>
                              </div>
                            </div>
                            {isConnected ? (
                              <span className="px-3 py-1 rounded-lg bg-green-500/10 text-green-500 text-[10px] font-black uppercase">Connected</span>
                            ) : (
                              <button onClick={() => handleSendConnectionRequest(u)} disabled={isRequested} className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${isRequested ? 'bg-white/10 opacity-50' : 'bg-indigo-500 text-white hover:scale-105 active:scale-95'}`}>
                                {isRequested ? "Pending" : "Add"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Not Found / Invite Section */}
                {syncMatches.length === 0 && manualPhone.length > 5 && !isSyncing && (
                   <div className="p-5 rounded-2xl bg-pink-500/5 border border-pink-500/10 text-center animate-in fade-in slide-in-from-bottom-2">
                      <Mail className="w-8 h-8 text-pink-400 mx-auto mb-3" />
                      <p className="text-sm font-bold mb-4 italic opactiy-80">This person hasn't joined Nexora yet!</p>
                      <button onClick={() => {
                        setSharePhone(manualPhone);
                        setShowShareModal(true);
                      }} className="w-full py-3 rounded-xl bg-pink-500 text-white text-sm font-bold shadow-lg shadow-pink-500/30 hover:brightness-110 active:scale-95 transition-all">
                        Invite to joining
                      </button>
                   </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function ChatsPage() {
  return (
    <Suspense fallback={<LoadingAnimation />}>
      <ChatsPageContent />
    </Suspense>
  );
}

function UserProfileModal({ isOpen, onClose, user, onConnect, alreadyRequested, alreadyConnected }: any) {
    return null; // Deprecated - Integrated into ChatsPage for high performance
}
