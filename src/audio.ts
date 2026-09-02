/* ============================================================================
 * KesslerShield — Native Web Audio API 1970s MOCR Synthesizer
 * 100% Fail-Proof Per-Gesture Web Audio API Synthesis
 * ========================================================================== */

function playTone(
  freqStart: number,
  freqEnd: number,
  durationSec: number,
  type: OscillatorType = "sine",
  volume = 0.5
) {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.linearRampToValueAtTime(freqEnd, now + durationSec);
    }

    gain.gain.setValueAtTime(volume, now);
    gain.gain.linearRampToValueAtTime(0.001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.01);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, (durationSec + 0.1) * 1000);
  } catch (err) {
    console.warn("Audio play error:", err);
  }
}

export function initAudio() {
  playTone(880, 880, 0.01, "sine", 0.001);
}

/** 1970s Mechanical Console Switch Relay Click */
export function playClickSound() {
  playTone(950, 220, 0.05, "sine", 0.5);
}

/** Low Sub-Bass Thruster Ignition Rumble */
export function playThrusterSound() {
  playTone(140, 40, 0.45, "sawtooth", 0.6);
}

/** Gentle CRT Telemetry Chime */
export function playChimeSound() {
  playTone(660, 880, 0.25, "triangle", 0.4);
}
