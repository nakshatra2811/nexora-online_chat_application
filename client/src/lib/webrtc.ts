// lib/webrtc.ts
// Pure WebRTC P2P Call Engine — Unlimited Free Calls
// Uses native SRTP (AES-128/256) encryption built into WebRTC.
// No third-party service needed. Server only relays signaling.

import { socketService } from "./socket";

// Free STUN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

export type CallType = "voice" | "video";
export type CallDirection = "outgoing" | "incoming";

export interface CallEvents {
  onRemoteStream: (stream: MediaStream) => void;
  onCallAccepted: () => void;
  onCallEnded: (reason: string) => void;
  onCallRejected: () => void;
  onIceConnectionChange: (state: RTCIceConnectionState) => void;
  onRemoteMuteToggle?: (isMuted: boolean) => void;
  onRemoteVideoToggle?: (isVideoOff: boolean) => void;
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private events: CallEvents | null = null;
  private targetUserId: string | null = null;
  private callType: CallType = "voice";
  private isInitiator = false;
  private _isCleaning = false; // Guard against recursive cleanup
  public currentFacingMode: "user" | "environment" = "user";

  private onIncomingCallCallback: ((data: { from: string; sdp: RTCSessionDescriptionInit; callType: CallType; callerName?: string; callerColor?: string }) => void) | null = null;

  constructor() {
    this.setupSocketListeners();
  }

  public onIncomingCall(callback: (data: { from: string; sdp: RTCSessionDescriptionInit; callType: CallType; callerName?: string; callerColor?: string }) => void) {
    this.onIncomingCallCallback = callback;
  }

  private setupSocketListeners() {
    const socket = socketService.getSocket();
    if (!socket) return;

    // Clear old listeners first to avoid duplicates
    socket.off("call:offer");
    socket.off("call:answer");
    socket.off("call:ice-candidate");
    socket.off("call:hangup");
    socket.off("call:reject");

    socket.on("call:offer", async (data: { from: string; sdp: RTCSessionDescriptionInit; callType: CallType; callerName?: string; callerColor?: string }) => {
      if (this.onIncomingCallCallback) {
        this.onIncomingCallCallback(data);
      }
    });

    socket.on("call:answer", async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
      if (this.pc) {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          this.events?.onCallAccepted();
          
          // CRITICAL: Process ICE candidates that arrived before the remote answer was set!
          await this.processPendingIceCandidates();
        } catch (e) {
          console.error("[WebRTC] Failed to set remote description (answer):", e);
        }
      }
    });

    socket.on("call:ice-candidate", async (data: { from: string; candidate: RTCIceCandidateInit }) => {
      await this.tryAddIceCandidate(data.candidate);
    });

    socket.on("call:hangup", (data: { from: string }) => {
      this.cleanup("Remote user ended the call");
    });

    socket.on("call:reject", (data: { from: string }) => {
      this.cleanup("Call was rejected");
      this.events?.onCallRejected();
    });

    socket.on("call:state-update", (data: { from: string; state: { isMuted?: boolean; isVideoOff?: boolean } }) => {
      if (data.state.isMuted !== undefined) this.events?.onRemoteMuteToggle?.(data.state.isMuted);
      if (data.state.isVideoOff !== undefined) this.events?.onRemoteVideoToggle?.(data.state.isVideoOff);
    });
  }


  // Re-attach socket listeners (e.g. after reconnect)
  public reattachListeners() {
    this.setupSocketListeners();
  }

  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  private createPeerConnection() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.remoteStream = new MediaStream();

    // Handle incoming remote tracks (Robust stream population)
    this.pc.ontrack = (event) => {
      console.log("[WebRTC] Incoming track:", event.track.kind);
      
      let newStream: MediaStream;
      if (event.streams && event.streams[0]) {
        newStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
            this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
        newStream = this.remoteStream;
      }
      
      // Update our internal reference
      this.remoteStream = newStream;
      
      // Force a new stream Object reference creation so React state triggers a re-render
      const clonedStream = new MediaStream(newStream.getTracks());
      this.events?.onRemoteStream(clonedStream);
    };

    // ICE candidate relay
    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.targetUserId) {
        const socket = socketService.getSocket();
        socket?.emit("call:ice-candidate", {
          to: this.targetUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Connection state monitoring
    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state) {
        this.events?.onIceConnectionChange(state);
        if (state === "disconnected" || state === "failed" || state === "closed") {
          this.cleanup(`Connection ${state}`);
        }
      }
    };
  }

  private async tryAddIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      // We can only add ICE candidates after the remote description is set
      if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue candidate to be added later
        this.pendingIceCandidates.push(candidate);
      }
    } catch (e) {
      console.warn("[WebRTC] Failed to add ICE candidate:", e);
    }
  }

  private async processPendingIceCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const candidate = this.pendingIceCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn("[WebRTC] Failed to add queued ICE candidate:", e);
        }
      }
    }
  }

  // ═══════════════════════════════════════════════
  // OUTGOING CALL — Initiator creates SDP Offer
  // ═══════════════════════════════════════════════
  public async startCall(
    targetUserId: string,
    type: CallType,
    events: CallEvents,
    metadata?: { callerName?: string; callerColor?: string }
  ): Promise<MediaStream> {
    this.events = events;
    this.targetUserId = targetUserId;
    this.callType = type;
    this.isInitiator = true;

    // Use optimized constraints for high-quality audio
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    const constraints: MediaStreamConstraints =
      type === "video"
        ? { 
            audio: audioConstraints, 
            video: { 
              facingMode: { ideal: this.currentFacingMode }, 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            } 
          }
        : { audio: audioConstraints };

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    // Create peer connection and add tracks
    this.createPeerConnection();
    this.localStream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, this.localStream!);
    });

    // Create and send offer
    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);

    const socket = socketService.getSocket();
    socket?.emit("call:offer", {
      to: targetUserId,
      sdp: offer,
      callType: type,
      callerName: metadata?.callerName,
      callerColor: metadata?.callerColor,
    });

    return this.localStream;
  }

  // ═══════════════════════════════════════════════
  // INCOMING CALL — Receiver creates SDP Answer
  // ═══════════════════════════════════════════════
  public async acceptCall(
    fromUserId: string,
    offer: RTCSessionDescriptionInit,
    type: CallType,
    events: CallEvents
  ): Promise<MediaStream> {
    this.events = events;
    this.targetUserId = fromUserId;
    this.callType = type;
    this.isInitiator = false;

    // Use optimized constraints for high-quality audio
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };

    const constraints: MediaStreamConstraints =
      type === "video"
        ? { 
            audio: audioConstraints, 
            video: { 
              facingMode: { ideal: this.currentFacingMode }, 
              width: { ideal: 1280 }, 
              height: { ideal: 720 },
              frameRate: { ideal: 30 }
            } 
          }
        : { audio: audioConstraints };

    this.localStream = await navigator.mediaDevices.getUserMedia(constraints);

    this.createPeerConnection();
    this.localStream.getTracks().forEach((track) => {
      this.pc?.addTrack(track, this.localStream!);
    });

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    
    // Process any ICE candidates that arrived before the remote description was set
    await this.processPendingIceCandidates();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    const socket = socketService.getSocket();
    socket?.emit("call:answer", {
      to: fromUserId,
      sdp: answer,
    });

    return this.localStream;
  }

  // ═══════════════════════════════════════════════
  // CALL CONTROLS
  // ═══════════════════════════════════════════════

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const muted = !track.enabled;
      
      const socket = socketService.getSocket();
      socket?.emit("call:state-update", { to: this.targetUserId, state: { isMuted: muted } });
      
      return muted;
    }
    return false;
  }

  public toggleVideo(): boolean {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      const videoOff = !track.enabled;

      const socket = socketService.getSocket();
      socket?.emit("call:state-update", { to: this.targetUserId, state: { isVideoOff: videoOff } });

      return videoOff;
    }
    return false;
  }

  public rejectCall(fromUserId: string) {
    const socket = socketService.getSocket();
    socket?.emit("call:reject", { to: fromUserId });
  }

  public hangup() {
    if (this.targetUserId) {
      const socket = socketService.getSocket();
      socket?.emit("call:hangup", { to: this.targetUserId });
    }
    this.cleanup("You ended the call");
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public async flipCamera(): Promise<boolean> {
    if (!this.localStream || this.callType !== "video") return false;

    this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
    
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: this.currentFacingMode }, 
          width: { ideal: 1280 }, 
          height: { ideal: 720 } 
        }
      });
      
      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = this.localStream.getVideoTracks()[0];

      if (this.pc) {
        const senders = this.pc.getSenders();
        const sender = senders.find(s => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      if (oldVideoTrack) {
        this.localStream.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      this.localStream.addTrack(newVideoTrack);
      return true;
    } catch (e) {
      console.error("[WebRTC] Failed to flip camera:", e);
      this.currentFacingMode = this.currentFacingMode === "user" ? "environment" : "user";
      return false;
    }
  }

  private cleanup(reason: string) {
    // ── GUARD: prevent re-entrant / recursive cleanup ──
    if (this._isCleaning) return;
    this._isCleaning = true;

    // Stop all local tracks
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    // Close peer connection (disable all its event handlers first)
    if (this.pc) {
      this.pc.oniceconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream = null;
    this.targetUserId = null;
    this.currentFacingMode = "user";
    this.pendingIceCandidates = [];

    // Capture and CLEAR the callback before invoking it.
    // This is the key fix: if onCallEnded → endCall → hangup → cleanup,
    // this.events is already null so the second cleanup() returns immediately.
    const cb = this.events?.onCallEnded;
    this.events = null;
    this._isCleaning = false;
    if (cb) cb(reason);
  }
}

// Singleton instance
export const webRTCService = new WebRTCService();
