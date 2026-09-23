import { saveMuted, loadMuted } from "./storage.js";

let ctx = null;
let masterGain = null;
let muted = loadMuted();
let alarmIntervalId = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.55;
  masterGain.connect(ctx.destination);
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  saveMuted(muted);
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.55;
}

function tone(freq, duration, { type = "sine", gain = 0.3, delay = 0 } = {}) {
  if (!ctx || !masterGain) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = 0;
  osc.connect(g);
  g.connect(masterGain);
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playClick() {
  tone(320, 0.08, { type: "square", gain: 0.18 });
}

export function playLampOn() {
  tone(660, 0.12, { type: "sine", gain: 0.22 });
  tone(880, 0.1, { type: "sine", gain: 0.14, delay: 0.05 });
}

export function playDoorOpen() {
  tone(110, 0.6, { type: "sawtooth", gain: 0.18 });
  tone(146, 0.6, { type: "sawtooth", gain: 0.13, delay: 0.08 });
  tone(90, 0.8, { type: "sine", gain: 0.12, delay: 0.1 });
}

export function playSuccess() {
  [523, 659, 784, 1046].forEach((f, i) =>
    tone(f, 0.25, { type: "sine", gain: 0.18, delay: i * 0.09 })
  );
}

export function playCountdownBeep() {
  tone(880, 0.15, { type: "square", gain: 0.28 });
}

export function playLaunchThud() {
  tone(55, 0.45, { type: "sine", gain: 0.45 });
  tone(70, 0.3, { type: "triangle", gain: 0.2, delay: 0.05 });
}

export function playSwitchFlip() {
  tone(240, 0.06, { type: "square", gain: 0.2 });
}

export function startAlarm() {
  if (!ctx || !masterGain || alarmIntervalId) return;
  const beep = () => {
    tone(720, 0.32, { type: "sawtooth", gain: 0.22 });
    tone(540, 0.3, { type: "sawtooth", gain: 0.14, delay: 0.15 });
  };
  beep();
  alarmIntervalId = setInterval(beep, 900);
}

export function stopAlarm() {
  if (alarmIntervalId) {
    clearInterval(alarmIntervalId);
    alarmIntervalId = null;
  }
}
