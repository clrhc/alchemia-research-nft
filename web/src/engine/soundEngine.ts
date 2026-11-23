/**
 * Subtle Procedural Web Audio Crystal & Glass Soundscape.
 *
 * Synthesizes soft, tactile borosilicate glass chimes, water-drop treat notes,
 * gentle rubber bounces, ascending proton-combo notes, and warm build chords.
 * Respects browser autoplay rules cleanly (never creates AudioContext before user gesture).
 */

const SOUND_STORAGE_KEY = "alchemia_sound_enabled_v1";

class AlchemiaSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private userUnlocked = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const saved = window.localStorage.getItem(SOUND_STORAGE_KEY);
        if (saved === "false") this.enabled = false;
      } catch {
        // ignore storage restrictions
      }
      const unlock = () => {
        this.userUnlocked = true;
      };
      window.addEventListener("pointerdown", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, passive: true });
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SOUND_STORAGE_KEY, String(val));
      } catch {
        // ignore
      }
    }
  }

  public toggle(): boolean {
    this.userUnlocked = true;
    this.setEnabled(!this.enabled);
    if (this.enabled) this.playTap(987.77);
    return this.enabled;
  }

  private getContext(requireGesture = true): AudioContext | null {
    if (!this.enabled || typeof window === "undefined") return null;
    if (requireGesture && !this.userUnlocked) return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playGlassBell(baseFreq: number, volume = 0.08, duration = 0.42, delay = 0) {
    const ctx = this.getContext(true);
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(volume, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.setValueAtTime(0.8, now);

    filter.connect(master);
    master.connect(ctx.destination);

    const ratios = [1.0, 2.76, 5.4];
    const amps = [1.0, 0.34, 0.14];

    ratios.forEach((ratio, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq * ratio, now);

      gain.gain.setValueAtTime(amps[idx], now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / (idx + 1));

      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.05);
    });
  }

  public playTap(freq = 1046.5) {
    this.userUnlocked = true;
    this.playGlassBell(freq, 0.045, 0.24);
  }

  public playPet() {
    this.userUnlocked = true;
    this.playGlassBell(659.25, 0.06, 0.34, 0);
    this.playGlassBell(987.77, 0.055, 0.4, 0.08);
  }

  public playFeed() {
    this.userUnlocked = true;
    const ctx = this.getContext(true);
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  public playBounce() {
    const ctx = this.getContext(true);
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.07);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  public playProtonPop(comboStep = 0) {
    this.userUnlocked = true;
    // Ascending pentatonic crystal chimes for proton harvest combos!
    const scale = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0, 2349.32];
    const freq = scale[Math.min(scale.length - 1, Math.max(0, comboStep))];
    this.playGlassBell(freq, 0.068, 0.36);
  }

  public playBuildRoom() {
    this.userUnlocked = true;
    this.playGlassBell(523.25, 0.055, 0.55, 0);
    this.playGlassBell(659.25, 0.05, 0.55, 0.07);
    this.playGlassBell(783.99, 0.05, 0.6, 0.14);
    this.playGlassBell(1174.66, 0.045, 0.72, 0.21);
  }

  public playDiscovery() {
    // Only chime softly after the user has interacted with the page
    if (!this.userUnlocked) return;
    this.playGlassBell(880, 0.028, 0.34, 0);
    this.playGlassBell(1318.51, 0.024, 0.44, 0.11);
  }
}

export const soundEngine = new AlchemiaSoundEngine();
