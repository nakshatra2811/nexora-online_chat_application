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
        ((..._args: any[]) => {})("[WebRTC] Incoming call:offer from:", data.from, "type:", data.callType);
        this.onIncomingCallCb?.(data);
      }
    );

    socket.on(
      "call:answer",
      async (data: { from: string; sdp: RTCSessionDescriptionInit }) => {
        ((..._args: any[]) => {})("[WebRTC] call:answer received from:", data.from);
        if (!this.pc) return;
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          await this._processPendingIce();
          // DO NOT call onCallConnected here — wait for actual P2P connection
          // (connectionstatechange === 'connected') so timer starts only after
          // audio/video is actually flowing
        } catch (e) {
          ((..._args: any[]) => {})("[WebRTC] Failed to set remote description (answer):", e);
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
      ((..._args: any[]) => {})("[WebRTC] call:hangup received");
      this._cleanup("Remote user ended the call");
    });

    socket.on("call:reject", () => {
      ((..._args: any[]) => {})("[WebRTC] call:reject received");
      const cb = this.events?.onCallRejected;
      this._cleanup("Call was rejected");
      cb?.();
    });

    socket.on(
      "call:state-update",
      (data: { from: string; state: { isMuted?: boolean; isVideoOff?: boolean } }) => {
        ((..._args: any[]) => {})("[WebRTC] call:state-update received from:", data.from, data.state);
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
      ((..._args: any[]) => {})("[WebRTC] Remote track received:", event.track.kind,
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
      ((..._args: any[]) => {})("[WebRTC] Connection state:", state);
      if (state === "connected" && !this._connected) {
        this._connected = true;
        this._optimizeSenderParameters(); // APPLY QUALITY BOOST ON CONNECT
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
          this._optimizeSenderParameters(); // APPLY QUALITY BOOST ON CONNECT
          this.events?.onCallConnected();
        }
      }
    };
  }

  /**
   * Post-connection quality optimization.
   * Forces the browser to prioritize image detail and high bitrate.
   */
  private async _optimizeSenderParameters() {
    if (!this.pc) return;
    const senders = this.pc.getSenders();
    
    for (const sender of senders) {
      if (sender.track?.kind === "video") {
        const parameters = sender.getParameters();
        if (!parameters.encodings) parameters.encodings = [{}];
        
        parameters.encodings[0].maxBitrate = 6000 * 1000; // 6 Mbps
        parameters.encodings[0].priority = "high";
        parameters.encodings[0].networkPriority = "high";
        
        // Tells the browser: DON'T blur the video if connection is slow.
        // Instead, drop the framerate slightly but KEEP it sharp.
        try {
          // @ts-ignore - degradationPreference is supported in modern browsers
          sender.degradationPreference = "maintain-resolution";
          await sender.setParameters(parameters);
          
          // Content Hint: tells the encoder we want SHARP details
          if ("contentHint" in sender.track) {
            (sender.track as any).contentHint = "detail";
          }
        } catch (e) {
          ((..._args: any[]) => {})("[WebRTC] Quality optimization failed:", e);
        }
      }
    }
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
      ((..._args: any[]) => {})("[WebRTC] Failed to add ICE candidate:", e);
    }
  }

  private async _processPendingIce() {
    if (!this.pc?.remoteDescription) return;
    while (this.pendingIceCandidates.length > 0) {
      const c = this.pendingIceCandidates.shift()!;
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        ((..._args: any[]) => {})("[WebRTC] Failed to add queued ICE candidate:", e);
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
              width: { min: 640, ideal: 1920, max: 1920 },
              height: { min: 480, ideal: 1080, max: 1080 },
              frameRate: { ideal: 60, min: 30 },
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
    // 3. Munge SDP: H.264 Priority + Bitrate
    let mungedSdp = offer.sdp || "";
    mungedSdp = this._prioritizeH264(mungedSdp);
    mungedSdp = this._increaseBitrate(mungedSdp, 4000);

    const highQualityOffer = {
      ...offer,
      sdp: mungedSdp,
    };
    await this.pc!.setLocalDescription(highQualityOffer);

    const socket = socketService.getSocket();
    socket?.emit("call:offer", {
      to: targetUserId,
      sdp: highQualityOffer,
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
    
    // 3. Munge SDP: H.264 Priority + Bitrate
    let mungedSdp = answer.sdp || "";
    mungedSdp = this._prioritizeH264(mungedSdp);
    mungedSdp = this._increaseBitrate(mungedSdp, 4000);

    const highQualityAnswer = {
      ...answer,
      sdp: mungedSdp,
    };
    await this.pc!.setLocalDescription(highQualityAnswer);

    const socket = socketService.getSocket();
    socket?.emit("call:answer", {
      to: fromUserId,
      sdp: highQualityAnswer,
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
    
    ((..._args: any[]) => {})("[WebRTC] Flipping camera to:", nextFacing);

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
        
        ((..._args: any[]) => {})("[WebRTC] Available video devices:", videoDevices.length);

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
        ((..._args: any[]) => {})("[WebRTC] Exact facingMode failed, falling back to ideal:", err);
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

      ((..._args: any[]) => {})("[WebRTC] Camera flip successful. Mode:", this.currentFacingMode);

      // Return a fresh stream object so React triggers a re-render
      return new MediaStream(this.localStream.getTracks());
    } catch (e) {
      ((..._args: any[]) => {})("[WebRTC] Flip camera failed completely:", e);
      
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
        ((..._args: any[]) => {})("[WebRTC] Recovery failed:", recErr);
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

  /**
   * Move H.264 to the top of the codec list.
   * This enables hardware acceleration on most mobile devices.
   */
  private _prioritizeH264(sdp: string): string {
    const lines = sdp.split("\r\n");
    const mVideoIndex = lines.findIndex(l => l.indexOf("m=video") === 0);
    if (mVideoIndex === -1) return sdp;

    // Find the H.264 payload types
    const rtpmapLines = lines.filter(l => l.includes("a=rtpmap:") && l.includes("H264/90000"));
    if (rtpmapLines.length === 0) return sdp;

    const h264Payloads = rtpmapLines.map(l => l.split(":")[1].split(" ")[0]);
    
    // Update m=video line (e.g. m=video 9 UDP/TLS/RTP/SAVPF 96 97 98...)
    let mLineParts = lines[mVideoIndex].split(" ");
    let payloads = mLineParts.slice(3);
    
    // Move H264 payloads to the front
    h264Payloads.forEach(pt => {
        const idx = payloads.indexOf(pt);
        if (idx !== -1) {
            payloads.splice(idx, 1);
            payloads.unshift(pt);
        }
    });

    lines[mVideoIndex] = mLineParts.slice(0, 3).concat(payloads).join(" ");
    return lines.join("\r\n");
  }

  /**
   * Munge SDP to force a specific bitrate for video/audio.
   * This overrides the browser's default conservative limits.
   */
  private _increaseBitrate(sdp: string, bitrate: number): string {
    let lines = sdp.split("\r\n");
    let videoLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("m=video") === 0) {
            videoLineIndex = i;
            break;
        }
    }

    if (videoLineIndex !== -1) {
        // Add b=AS (Application Specific) and TIAS (Transport Independent Application Specific)
        // for standard-compliant bitrate control
        lines.splice(videoLineIndex + 1, 0, `b=AS:${bitrate}`);
        lines.splice(videoLineIndex + 2, 0, `b=TIAS:${bitrate * 1000}`);
    }

    // Also increase audio bitrate if needed
    let audioLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("m=audio") === 0) {
            audioLineIndex = i;
            break;
        }
    }
    if (audioLineIndex !== -1) {
        lines.splice(audioLineIndex + 1, 0, "b=AS:128"); // 128 kbps for crystal clear audio
    }

    return lines.join("\r\n");
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
