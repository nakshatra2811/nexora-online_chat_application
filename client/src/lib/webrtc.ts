// lib/webrtc.ts
// Nexora WebRTC P2P Call Engine — Real-Time Voice & Video
// Uses native SRTP encryption built into WebRTC.
// Server only relays signaling — ZERO knowledge.

import { socketService } from "./socket";

// Free STUN servers for NAT traversal
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
];

export type CallType = "voice" | "video";

export interface CallEvents {
  onLocalStream: (stream: MediaStream) => void;
  onRemoteStream: (stream: MediaStream) => void;
  onCallConnected: () => void;
  onCallEnded: (reason: string) => void;
  onCallRejected: () => void;
  onIceConnectionChange?: (state: RTCIceConnectionState) => void;
  onRemoteStateUpdate?: (state: { isMuted?: boolean; isVideoOff?: boolean }) => void;
}

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private _connected = false;
  private events: CallEvents | null = null;
  private targetUserId: string | null = null;
  private callType: CallType = "voice";
  private _isCleaning = false;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];
  private listenersAttached = false;
  public currentFacingMode: "user" | "environment" = "user";

  // Incoming call handler
  private onIncomingCallCb:
    | ((data: {
        from: string;
        sdp: RTCSessionDescriptionInit;
        callType: CallType;
        callerName?: string;
        callerColor?: string;
      }) => void)
    | null = null;

  constructor() {}

  // ─── Listener Setup ────────────────────────────────────────────────────────

  public attachListeners() {
    if (this.listenersAttached) return;
    const socket = socketService.getSocket();
    if (!socket) return;

    this.listenersAttached = true;

    socket.off("call:offer");
    socket.off("call:answer");
    socket.off("call:ice-candidate");
    socket.off("call:hangup");
    socket.off("call:reject");
    socket.off("call:state-update");

    socket.on(
      "call:offer",
      (data: {
        from: string;
        sdp: RTCSessionDescriptionInit;
        callType: CallType;
        callerName?: string;
        callerColor?: string;
      }) => {
        console.log("[WebRTC] Incoming call:offer from:", data.from, "type:", data.callType);
        this.onIncomingCallCb?.(data);
      }
    );

    socket.on(
      "call:answer",
      async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
        console.log("[WebRTC] call:answer received from:", data.from);
        if (!this.pc) return;
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await this._processPendingIce();
          // DO NOT call onCallConnected here — wait for actual P2P connection
          // (connectionstatechange === 'connected') so timer starts only after
          // audio/video is actually flowing
        } catch (e) {
          console.error("[WebRTC] Failed to set remote description (answer):", e);
        }
      }
    );

    socket.on(
      "call:ice-candidate",
      async (data: { from: string; candidate: RTCIceCandidateInit }) => {
        await this._tryAddIce(data.candidate);
      }
    );

    socket.on("call:hangup", () => {
      console.log("[WebRTC] call:hangup received");
      this._cleanup("Remote user ended the call");
    });

    socket.on("call:reject", () => {
      console.log("[WebRTC] call:reject received");
      const cb = this.events?.onCallRejected;
      this._cleanup("Call was rejected");
      cb?.();
    });

    socket.on(
      "call:state-update",
      (data: { from: string; state: { isMuted?: boolean; isVideoOff?: boolean } }) => {
        console.log("[WebRTC] call:state-update received from:", data.from, data.state);
        this.events?.onRemoteStateUpdate?.(data.state);
      }
    );
  }

  public detachListeners() {
    const socket = socketService.getSocket();
    if (!socket) return;
    socket.off("call:offer");
    socket.off("call:answer");
    socket.off("call:ice-candidate");
    socket.off("call:hangup");
    socket.off("call:reject");
    socket.off("call:state-update");
    this.listenersAttached = false;
  }

  public onIncomingCall(
    cb: (data: {
      from: string;
      sdp: RTCSessionDescriptionInit;
      callType: CallType;
      callerName?: string;
      callerColor?: string;
    }) => void
  ) {
    this.onIncomingCallCb = cb;
  }

  // ─── Peer Connection ────────────────────────────────────────────────────────

  private _createPC() {
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this._connected = false;

    // Persistent remote stream — tracks accumulate here
    // (audio and video ontrack events fire separately)
    this.remoteStream = new MediaStream();

    // Handle incoming remote tracks — ACCUMULATE into one stream
    this.pc.ontrack = (event) => {
      console.log("[WebRTC] Remote track received:", event.track.kind,
        "readyState:", event.track.readyState);

      // Add track to our persistent remoteStream
      if (this.remoteStream) {
        // Remove existing track of same kind if any (prevents duplicates)
        const existing = this.remoteStream.getTracks().find(t => t.kind === event.track.kind);
        if (existing) this.remoteStream.removeTrack(existing);
        this.remoteStream.addTrack(event.track);
      }

      // Clone the full accumulated stream so React gets a new object reference
      // and re-renders the video element with ALL tracks (audio + video)
      const fullStream = new MediaStream(this.remoteStream!.getTracks());
      this.events?.onRemoteStream(fullStream);
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

    // Connection state monitoring — ONLY source of onCallConnected
    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;
      console.log("[WebRTC] Connection state:", state);
      if (state === "connected" && !this._connected) {
        this._connected = true;
        this.events?.onCallConnected();
      }
      if (state === "disconnected" || state === "failed" || state === "closed") {
        this._cleanup(`Connection ${state}`);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      if (state) {
        this.events?.onIceConnectionChange?.(state);
        // Fallback: some browsers fire iceConnectionState 'connected'
        // but not connectionState 'connected'
        if (state === "connected" && !this._connected) {
          this._connected = true;
          this.events?.onCallConnected();
        }
      }
    };
  }

  private async _tryAddIce(candidate: RTCIceCandidateInit) {
    if (!this.pc) return;
    try {
      if (this.pc.remoteDescription?.type) {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.pendingIceCandidates.push(candidate);
      }
    } catch (e) {
      console.warn("[WebRTC] Failed to add ICE candidate:", e);
    }
  }

  private async _processPendingIce() {
    if (!this.pc?.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const c = this.pendingIceCandidates.shift()!;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.warn("[WebRTC] Failed to add queued ICE candidate:", e);
      }
    }
  }

  // ─── Get Media Stream ───────────────────────────────────────────────────────

  private async _getStream(type: CallType): Promise<MediaStream> {
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
              frameRate: { ideal: 30 },
            },
          }
        : { audio: audioConstraints };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.localStream = stream;
    return stream;
  }

  // ─── Outgoing Call ──────────────────────────────────────────────────────────

  public async startCall(
    targetUserId: string,
    type: CallType,
    events: CallEvents,
    metadata?: { callerName?: string; callerColor?: string }
  ): Promise<MediaStream> {
    this.events = events;
    this.targetUserId = targetUserId;
    this.callType = type;

    const stream = await this._getStream(type);
    events.onLocalStream(stream);

    this._createPC();
    stream.getTracks().forEach((t) => this.pc!.addTrack(t, stream));

    const offer = await this.pc!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === "video",
    });
    await this.pc!.setLocalDescription(offer);

    const socket = socketService.getSocket();
    socket?.emit("call:offer", {
      to: targetUserId,
      sdp: offer,
      callType: type,
      callerName: metadata?.callerName,
      callerColor: metadata?.callerColor,
    });

    return stream;
  }

  // ─── Incoming Call Accept ───────────────────────────────────────────────────

  public async acceptCall(
    fromUserId: string,
    offer: RTCSessionDescriptionInit,
    type: CallType,
    events: CallEvents
  ): Promise<MediaStream> {
    this.events = events;
    this.targetUserId = fromUserId;
    this.callType = type;

    const stream = await this._getStream(type);
    events.onLocalStream(stream);

    this._createPC();
    stream.getTracks().forEach((t) => this.pc!.addTrack(t, stream));

    await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));
    await this._processPendingIce();

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);

    const socket = socketService.getSocket();
    socket?.emit("call:answer", {
      to: fromUserId,
      sdp: answer,
    });

    return stream;
  }

  // ─── Controls ───────────────────────────────────────────────────────────────

  public toggleMute(): boolean {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    const muted = !track.enabled;
    const socket = socketService.getSocket();
    socket?.emit("call:state-update", {
      to: this.targetUserId,
      state: { isMuted: muted },
    });
    return muted;
  }

  public toggleVideo(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    const videoOff = !track.enabled;
    const socket = socketService.getSocket();
    socket?.emit("call:state-update", {
      to: this.targetUserId,
      state: { isVideoOff: videoOff },
    });
    return videoOff;
  }

  /** Flip between front/back camera. Returns new local stream for React to update. */
  public async flipCamera(): Promise<MediaStream | null> {
    if (!this.localStream || this.callType !== "video" || !this.pc) return null;

    const oldVideoTrack = this.localStream.getVideoTracks()[0];
    const nextFacing = this.currentFacingMode === "user" ? "environment" : "user";
    
    console.log("[WebRTC] Flipping camera to:", nextFacing);

    try {
      // 1. Release previous camera hardware before requesting new one
      // This is CRITICAL for many mobile browsers to allow switching cameras.
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        this.localStream.removeTrack(oldVideoTrack);
      }

      // 2. Request new stream with exact constraints
      let newStream: MediaStream;
      try {
        // Find all video devices to be more specific if possible
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        
        console.log("[WebRTC] Available video devices:", videoDevices.length);

        // Try exact facing mode first
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { exact: nextFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false // DO NOT request audio again
        });
      } catch (err) {
        console.warn("[WebRTC] Exact facingMode failed, falling back to ideal:", err);
        // Fallback to ideal if exact fails
        newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: nextFacing,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false
        });
      }

      this.currentFacingMode = nextFacing;
      const newVideoTrack = newStream.getVideoTracks()[0];

      // 3. Replace track in peer connection
      // The old track may be stopped/null, so also match by checking if the sender
      // previously had a video track (i.e. it's not the audio sender)
      const sender = this.pc.getSenders().find(
        (s) => s.track?.kind === "video" || (!s.track && this.pc!.getSenders().indexOf(s) > 0)
      ) || this.pc.getSenders().find(
        (s) => !s.track || s.track.kind === "video"
      );

      // Inherit the toggle status (if video was toggled off, keep it off)
      const wasEnabled = oldVideoTrack ? oldVideoTrack.enabled : true;
      newVideoTrack.enabled = wasEnabled;

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // 4. Update local stream
      this.localStream.addTrack(newVideoTrack);

      console.log("[WebRTC] Camera flip successful. Mode:", this.currentFacingMode);

      // Return a fresh stream object so React triggers a re-render
      return new MediaStream(this.localStream.getTracks());
    } catch (e) {
      console.error("[WebRTC] Flip camera failed completely:", e);
      
      // Recovery: If flip failed, try to restart the original camera
      try {
        const recoveryStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: this.currentFacingMode },
          audio: false
        });
        const recTrack = recoveryStream.getVideoTracks()[0];
        if (this.pc && recTrack) {
           const sender = this.pc.getSenders().find((s) => s.track?.kind === "video");
           if (sender) await sender.replaceTrack(recTrack);
           this.localStream.addTrack(recTrack);
        }
      } catch (recErr) {
        console.error("[WebRTC] Recovery failed:", recErr);
      }
      
      return null;
    }
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
    this._cleanup("You ended the call");
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getCallType(): CallType {
    return this.callType;
  }

  public isInCall(): boolean {
    return this.pc !== null && !this._isCleaning;
  }

  // ─── Cleanup ─────────────────────────────────────────────────────────────────

  private _cleanup(reason: string) {
    if (this._isCleaning) return;
    this._isCleaning = true;

    this.localStream?.getTracks().forEach((t) => t.stop());
    this.localStream = null;

    if (this.pc) {
      this.pc.oniceconnectionstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream = null;
    this.targetUserId = null;
    this.pendingIceCandidates = [];
    this.currentFacingMode = "user";
    this._connected = false;

    const cb = this.events?.onCallEnded;
    this.events = null;
    this._isCleaning = false;
    if (cb) cb(reason);
  }
}

// Singleton instance
export const webRTCService = new WebRTCService();
