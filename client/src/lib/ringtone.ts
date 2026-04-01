"use client";

class RingtoneManager {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isPlaying = false;

  play() {
    if (this.isPlaying) return Promise.resolve();
    this.isPlaying = true;

    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.gain.value = 0; // start silenced

      // Standard modern digital ring (UK/US dual-frequency style)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = 440; // A4
      osc2.frequency.value = 480; // slightly detuned for dissonance

      osc1.connect(this.gainNode);
      osc2.connect(this.gainNode);

      osc1.start();
      osc2.start();

      this.oscillators = [osc1, osc2];

      const playPattern = () => {
        if (!this.gainNode || !this.ctx) return;
        
        // 1st burst
        this.gainNode.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.05);
        this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime + 0.4, 0.05);

        // 2nd burst
        this.gainNode.gain.setTargetAtTime(0.4, this.ctx.currentTime + 0.6, 0.05);
        this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime + 1.0, 0.05);
      };

      playPattern();
      this.intervalId = setInterval(playPattern, 4000);
      return Promise.resolve();

    } catch (e) {
      ((..._args: any[]) => {})("Web Audio API not supported or blocked.", e);
      return Promise.reject(e);
    }
  }

  pause() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
    }
    // Cleanup nodes
    setTimeout(() => {
      this.oscillators.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      this.oscillators = [];
      if (this.ctx) {
        this.ctx.close();
        this.ctx = null;
      }
    }, 100);
  }

  get currentTime() { return 0; }
  set currentTime(val) { /* mock to fulfill HTMLAudioElement API signature */ }
}

export const syntheticRingtone = typeof window !== "undefined" ? new RingtoneManager() : null;
