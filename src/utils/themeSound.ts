// Synthesized Web Audio API sound effects for Dark <-> Light mode switching

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

/**
 * Plays a crisp, subtle synthesized sound effect when switching between Dark and Light modes.
 * - Switching to Light Mode ("icy"): crystalline frost chime + airy shimmer.
 * - Switching to Dark Mode ("stealth"): smooth low-frequency power-down click.
 */
export function playThemeSwitchSound(targetTheme: 'dark' | 'light'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (targetTheme === 'light') {
      // Icy crystalline chime (C6 + G6 + E7 shimmer)
      const freqs = [1046.5, 1567.98, 2637.02];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = idx === 2 ? 'sine' : 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.025);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.015, now + 0.28 + idx * 0.03);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.025);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.065 : 0.04, now + 0.02 + idx * 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34 + idx * 0.03);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.025);
        osc.stop(now + 0.4);
      });

      // Subtle airy frost whoosh
      const bufferSize = Math.floor(ctx.sampleRate * 0.16);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(6400, now + 0.15);
      filter.Q.value = 1.8;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.linearRampToValueAtTime(0.028, now + 0.02);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.17);
    } else {
      // Smooth stealth dark-mode transition (warm low-pass sweep + soft click)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(68, now + 0.2);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);

      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'triangle';
      clickOsc.frequency.setValueAtTime(520, now);
      clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

      clickGain.gain.setValueAtTime(0.05, now);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now);
      clickOsc.stop(now + 0.06);
    }
  } catch {
    // Ignore audio errors if blocked by browser policy
  }
}
