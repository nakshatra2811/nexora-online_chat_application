"use client";

/**
 * CallInterface.tsx — Nexora Active Call UI
 *
 * ISOLATED: This component only renders call UI. It receives streams and
 * callbacks as props. It has zero dependencies on the chats page or any
 * other page-level code.
 */

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  RefreshCcw,
  Minimize2,
  Maximize2,
  Lock,
  User,
  CameraIcon,
} from "lucide-react";

interface CallInterfaceProps {
  status: "ringing" | "accepted" | "ended" | "idle";
  type: "voice" | "video";
  remoteName: string;
  remoteColor: string;
  duration: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isFullscreen: boolean;
  facingMode?: "user" | "environment";
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onToggleMute: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onEndCall: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({
  status,
  type,
  remoteName,
  remoteColor,
  duration,
  isMuted,
  isVideoOff,
  isFullscreen,
  facingMode = "user",
  localStream,
  remoteStream,
  onToggleMute,
  onToggleVideo,
  onFlipCamera,
  onEndCall,
  onMinimize,
  onMaximize,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const [isFlipping, setIsFlipping] = useState(false);

  // ── Always play remote audio (works for BOTH voice and video calls) ──
  // This hidden <audio> element ensures voice is always audible regardless
  // of whether the video element is visible.
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // ── Attach local stream to local video PIP ──
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // ── Attach remote stream to remote video element ──
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const handleFlipCamera = async () => {
    setIsFlipping(true);
    onFlipCamera();
    setTimeout(() => setIsFlipping(false), 600);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        width: isFullscreen ? "100%" : "260px",
        height: isFullscreen ? "100%" : "160px",
        bottom: isFullscreen ? "0px" : "24px",
        right: isFullscreen ? "0px" : "24px",
        top: isFullscreen ? "0px" : "auto",
        left: isFullscreen ? "0px" : "auto",
        borderRadius: isFullscreen ? "0px" : "28px",
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 160, damping: 24 }}
      className={`fixed z-[1500] bg-[#0c0c14] text-white flex flex-col items-center justify-center overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.9)] ${
        !isFullscreen
          ? "border border-white/20 cursor-pointer group hover:border-white/40"
          : ""
      }`}
      onClick={() => !isFullscreen && onMaximize()}
    >
      {/* ── CRITICAL: Hidden audio element for remote voice playback ── */}
      {/* This ensures remote audio is ALWAYS audible for both voice AND video calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* ── Top Header Controls ──────────────────────────────── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="absolute top-6 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Minimize2 className="w-5 h-5" />
            </motion.button>

            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-3xl px-5 py-2 rounded-full border border-white/10 shadow-2xl">
              <Lock className="w-3.5 h-3.5 text-[#2ed573]" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2ed573]">
                E2EE Nexus Active
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PIP expand hint overlay */}
      {!isFullscreen && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 className="w-7 h-7 text-white/70" />
        </div>
      )}

      {/* ── Video / Avatar Layer ──────────────────────────────── */}
      <div className="absolute inset-0 z-0 bg-[#0c0c14]">
        {type === "video" ? (
          <>
            {/* Remote video — full screen */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`w-full h-full object-cover transition-opacity duration-700 ${
                remoteStream && status === "accepted" ? "opacity-100" : "opacity-0"
              }`}
            />

            {/* Connecting overlay when no remote stream yet */}
            {(!remoteStream || status === "ringing") && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c14]">
                {/* Animated blobs */}
                <div
                  className={`absolute top-0 right-0 w-[70vw] h-[70vw] bg-gradient-to-br ${remoteColor} opacity-10 rounded-full blur-[120px] animate-pulse`}
                />
                <div
                  className={`absolute bottom-0 left-0 w-[60vw] h-[60vw] bg-gradient-to-tl ${remoteColor} opacity-10 rounded-full blur-[120px] animate-pulse`}
                  style={{ animationDelay: "1.5s" }}
                />

                {/* Ripple rings */}
                {isFullscreen && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0.6, opacity: 0.5 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        transition={{
                          repeat: Infinity,
                          duration: 3,
                          delay: i * 1,
                          ease: "easeOut",
                        }}
                        className="absolute w-56 h-56 rounded-full border-2 border-white/10"
                      />
                    ))}
                  </div>
                )}

                {/* Avatar */}
                <div
                  className={`relative ${
                    isFullscreen ? "w-44 h-44" : "w-14 h-14"
                  } rounded-full flex items-center justify-center bg-gradient-to-tr ${remoteColor} border-[6px] border-[#0c0c14] shadow-[0_0_80px_rgba(108,92,231,0.4)] z-10`}
                >
                  <span
                    className={`${
                      isFullscreen ? "text-7xl" : "text-xl"
                    } font-black text-white uppercase`}
                  >
                    {remoteName?.[0] || "?"}
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Voice call — avatar only */
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c0c14]">
            <div
              className={`absolute top-0 right-0 w-[80vw] h-[80vw] bg-gradient-to-br ${remoteColor} opacity-10 rounded-full blur-[100px] animate-pulse`}
            />
            <div
              className={`absolute bottom-0 left-0 w-[80vw] h-[80vw] bg-gradient-to-tl ${remoteColor} opacity-10 rounded-full blur-[100px] animate-pulse`}
              style={{ animationDelay: "2s" }}
            />

            {/* Ripple rings during ringing */}
            {status === "ringing" && isFullscreen && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {[1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 2.5, opacity: 0 }}
                    transition={{
                      repeat: Infinity,
                      duration: 3,
                      delay: i * 1.5,
                      ease: "easeOut",
                    }}
                    className="absolute w-64 h-64 rounded-full border-2 border-white/10"
                  />
                ))}
              </div>
            )}

            {/* Avatar */}
            <div
              className={`relative ${
                isFullscreen ? "w-52 h-52" : "w-16 h-16"
              } rounded-full flex items-center justify-center bg-gradient-to-tr ${remoteColor} border-[8px] border-[#0c0c14] shadow-[0_0_80px_rgba(108,92,231,0.4)] z-10 transition-all duration-700`}
            >
              <span
                className={`${
                  isFullscreen ? "text-8xl" : "text-xl"
                } font-black text-white uppercase`}
              >
                {remoteName?.[0] || "?"}
              </span>
            </div>
          </div>
        )}

        {/* ── Local video PIP (video calls only, fullscreen only) ── */}
        {type === "video" && localStream && isFullscreen && (
          <motion.div
            initial={{ scale: 0, x: 20, y: 20, opacity: 0 }}
            animate={{ scale: 1, x: 0, y: 0, opacity: 1 }}
            className="absolute top-24 right-5 w-[110px] h-[150px] md:w-36 md:h-48 bg-[#1a1a2e] rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl z-20 group/pip"
          >
            {isVideoOff ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-[#0c0c14] gap-2">
                <User className="w-8 h-8 text-white/30" />
                <VideoOff className="w-4 h-4 text-red-400/60" />
              </div>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transition-all duration-300 ${
                  isFlipping 
                    ? "scale-x-0 opacity-0" 
                    : facingMode === "environment" 
                      ? "scale-x-100 opacity-100" 
                      : "scale-x-[-1] opacity-100"
                }`}
              />
            )}

            {/* Flip camera button appears on hover */}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center opacity-0 group-hover/pip:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleFlipCamera();
                }}
                className="p-1.5 bg-black/60 backdrop-blur-xl rounded-full border border-white/20 hover:bg-black/80 text-white transition-all"
              >
                <RefreshCcw
                  className={`w-3.5 h-3.5 transition-transform duration-500 ${
                    isFlipping ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Name & Status Overlay ─────────────────────────────── */}
      <div
        className={`relative z-10 flex flex-col items-center justify-start ${
          isFullscreen ? "pt-28" : "pt-3"
        } flex-1 pointer-events-none w-full transition-all duration-500`}
      >
        <h2
          className={`${
            isFullscreen ? "text-4xl md:text-6xl" : "text-sm"
          } font-black mb-2 tracking-tight truncate max-w-[85vw] drop-shadow-xl transition-all duration-500`}
          style={{ textShadow: "0 2px 30px rgba(0,0,0,0.8)" }}
        >
          {remoteName}
        </h2>

        {status === "ringing" ? (
          <motion.p
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className={`${
              isFullscreen ? "text-[#00d4ff] text-lg" : "text-[#00d4ff] text-[9px]"
            } font-black tracking-[0.4em] uppercase drop-shadow-md`}
          >
            {type === "video" ? "Video Calling..." : "Calling..."}
          </motion.p>
        ) : status === "accepted" ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${
              isFullscreen ? "text-[#2ed573] text-3xl md:text-4xl" : "text-[#2ed573] text-xs"
            } font-black tracking-[0.1em] drop-shadow-[0_0_20px_rgba(46,213,115,0.8)] bg-black/50 px-5 py-2 rounded-full backdrop-blur-3xl mt-2 transition-all font-mono`}
          >
            {duration}
          </motion.div>
        ) : null}
      </div>

      {/* ── Bottom Controls (fullscreen only) ─────────────────── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="relative z-50 p-10 flex items-center justify-center mt-auto w-full"
          >
            <div className="flex items-center gap-5 bg-white/10 backdrop-blur-3xl border border-white/10 p-5 rounded-[4rem] shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
              {/* Mute */}
              <motion.button
                whileHover={{ scale: 1.12 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMute();
                }}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isMuted
                    ? "bg-white text-black shadow-inner"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </motion.button>

              {/* Video toggle (video calls only) */}
              {type === "video" && (
                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVideo();
                  }}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isVideoOff
                      ? "bg-white text-black shadow-inner"
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {isVideoOff ? (
                    <VideoOff className="w-6 h-6" />
                  ) : (
                    <Video className="w-6 h-6" />
                  )}
                </motion.button>
              )}

              {/* Flip camera (video calls only) */}
              {type === "video" && (
                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFlipCamera();
                  }}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 bg-white/10 text-white hover:bg-white/20"
                >
                  <RefreshCcw
                    className={`w-6 h-6 transition-transform duration-500 ${
                      isFlipping ? "rotate-180" : ""
                    }`}
                  />
                </motion.button>
              )}

              {/* End call */}
              <motion.button
                whileHover={{ scale: 1.12, rotate: 10 }}
                whileTap={{ scale: 0.9 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEndCall();
                }}
                className="w-20 h-20 rounded-full bg-[#ff4757] hover:bg-[#ff6b81] flex items-center justify-center text-white shadow-[0_0_50px_rgba(255,71,87,0.5)] transition-all"
              >
                <PhoneOff className="w-9 h-9 drop-shadow-xl" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
