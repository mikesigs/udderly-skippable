// All game audio: synthesized effects, the recorded moo with voice variants, and a soft ambient loop.
import { MOO_WAV_B64 } from './moo-sample.js';
import { rand } from '../game/rocks.js';

let AC = null;
let mooBuf = null;
let mooLoading = false;
let ambient = null;
export const audio = { muted: false, haptics: true, music: true };

export function audioInit() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  loadMoo();
}
export function haptic(ms) {
  if (!audio.haptics) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {}
}

function loadMoo() {
  if (!AC || mooBuf || mooLoading) return;
  mooLoading = true;
  try {
    const bin = Uint8Array.from(atob(MOO_WAV_B64), (c) => c.charCodeAt(0));
    AC.decodeAudioData(bin.buffer, (b) => { mooBuf = b; }, () => { mooLoading = false; });
  } catch (e) { mooLoading = false; }
}

function tone(f0, f1, dur, type = 'sine', vol = 0.2) {
  if (!AC || audio.muted) return;
  const o = AC.createOscillator(), g = AC.createGain(), t = AC.currentTime;
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(AC.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noiseBuf(dur, shape) {
  const n = Math.floor(AC.sampleRate * dur), buf = AC.createBuffer(1, n, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (shape ? shape(i / n) : 1 - i / n);
  return buf;
}
function noise(dur, vol = 0.15, freq = 1200) {
  if (!AC || audio.muted) return;
  const src = AC.createBufferSource(); src.buffer = noiseBuf(dur);
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(AC.destination); src.start();
}
function noiseBand(dur, vol, f0, f1, q = 1.5, att = 0.01) {
  if (!AC || audio.muted) return;
  const t = AC.currentTime, src = AC.createBufferSource(); src.buffer = noiseBuf(dur, () => 1);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + att); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g).connect(AC.destination); src.start(t); src.stop(t + dur + 0.02);
}
function spray(vol = 0.6) {
  if (!AC || audio.muted) return;
  const t = AC.currentTime, sr = AC.sampleRate, dur = 0.55, n = Math.floor(sr * dur);
  const buf = AC.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let tv = 0;
  for (let i = 0; i < n; i++) {
    const x = i / n; tv += ((Math.random() * 2 - 1) - tv) * 0.015;
    const env = x < 0.02 ? x / 0.02 : x < 0.75 ? 1 - x * 0.35 : Math.max(0, (1 - x) / 0.25 * 0.74);
    d[i] = (Math.random() * 2 - 1) * env * (0.55 + 0.45 * Math.max(-1, Math.min(1, tv * 4)));
  }
  const src = AC.createBufferSource(); src.buffer = buf;
  const hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(5200, t); bp.frequency.exponentialRampToValueAtTime(3600, t + dur);
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(hp).connect(bp).connect(g).connect(AC.destination); src.start(t);
  const body = AC.createBufferSource(); body.buffer = buf;
  const bb = AC.createBiquadFilter(); bb.type = 'bandpass'; bb.Q.value = 1.1; bb.frequency.value = 420;
  const bg = AC.createGain(); bg.gain.value = vol * 0.5;
  body.connect(bb).connect(bg).connect(AC.destination); body.start(t);
  const pop = AC.createBufferSource(); pop.buffer = noiseBuf(0.035);
  const pf = AC.createBiquadFilter(); pf.type = 'bandpass'; pf.Q.value = 1.5; pf.frequency.value = 1300;
  const pg = AC.createGain(); pg.gain.value = vol * 1.6;
  pop.connect(pf).connect(pg).connect(AC.destination); pop.start(t);
}

// Voice variants derived from the one recording: playback rate and a tone filter per cow type.
export const VOICES = {
  cow:  { rate: 1.0,  lp: 0,    gain: 0.9 },
  bull: { rate: 0.82, lp: 1400, gain: 1.0 },
  calf: { rate: 1.22, lp: 0,    gain: 0.75 },
  old:  { rate: 0.93, lp: 2200, gain: 0.85 },
};
export function playMoo(voice = 'cow') {
  if (!AC || audio.muted) return;
  if (!mooBuf) { loadMoo(); return; }
  const v = VOICES[voice] || VOICES.cow;
  const src = AC.createBufferSource(); src.buffer = mooBuf; src.playbackRate.value = v.rate * rand(0.97, 1.03);
  const g = AC.createGain(); g.gain.value = v.gain;
  let node = src;
  if (v.lp) { const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = v.lp; src.connect(f); node = f; }
  node.connect(g).connect(AC.destination); src.start();
}

export function startAmbient() {
  if (!AC || ambient) return;
  const sr = AC.sampleRate, dur = 4, n = sr * dur, buf = AC.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true;
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  const g = AC.createGain(); g.gain.value = 0;
  const lfo = AC.createOscillator(); lfo.frequency.value = 0.18; const lg = AC.createGain(); lg.gain.value = 0.012;
  lfo.connect(lg).connect(g.gain);
  const lfo2 = AC.createOscillator(); lfo2.frequency.value = 0.07; const lg2 = AC.createGain(); lg2.gain.value = 0.008; lfo2.connect(lg2).connect(g.gain);
  src.connect(lp).connect(g).connect(AC.destination); src.start(); lfo.start(); lfo2.start();
  ambient = { g, base: 0.022 };
  setAmbient(!audio.muted);
}
export function setAmbient(on) { if (ambient && AC) ambient.g.gain.setTargetAtTime(on ? ambient.base : 0, AC.currentTime, 0.3); }

/* ---------- generative music: slow pads with a pentatonic marimba, all synthesized ---------- */
let music = null;
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 53]]; // Cmaj7 Am7 Fmaj7 G7-ish
const PENTA = [72, 74, 76, 79, 81, 84, 86];
export function startMusic() {
  if (!AC || music) return;
  const master = AC.createGain(); master.gain.value = 0; master.connect(AC.destination);
  const delay = AC.createDelay(1.5); delay.delayTime.value = 60 / 92 * 0.75;
  const fb = AC.createGain(); fb.gain.value = 0.38; const dlp = AC.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2200;
  delay.connect(dlp).connect(fb).connect(delay);
  const wet = AC.createGain(); wet.gain.value = 0.4; delay.connect(wet).connect(master);
  const bus = AC.createGain(); bus.connect(master); bus.connect(delay);
  music = { master, bus, next: AC.currentTime + 0.2, step: 0, bar: 0, base: 0.22, timer: null, melodyNote: 3 };
  music.timer = setInterval(scheduleMusic, 60);
  setMusic(audio.music && !audio.muted);
}
function pluck(t, midi, vol, dur = 0.5) {
  const o = AC.createOscillator(), g = AC.createGain(), f = AC.createBiquadFilter();
  o.type = 'triangle'; o.frequency.value = NOTE(midi);
  f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(900, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f).connect(g).connect(music.bus); o.start(t); o.stop(t + dur + 0.05);
}
function pad(t, chord, len) {
  for (const m of chord) for (const det of [-5, 5]) {
    const o = AC.createOscillator(), g = AC.createGain(); o.type = 'sine'; o.frequency.value = NOTE(m); o.detune.value = det;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.028, t + len * 0.35); g.gain.setValueAtTime(0.028, t + len * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(music.bus); o.start(t); o.stop(t + len + 0.05);
  }
}
function scheduleMusic() {
  if (!music || !AC) return;
  const eighth = 60 / 92 / 2;
  while (music.next < AC.currentTime + 0.25) {
    const t = music.next, s = music.step, chord = CHORDS[music.bar % CHORDS.length];
    if (s % 8 === 0) pad(t, chord, eighth * 8.2);
    if (s % 8 === 0 || s % 8 === 5) pluck(t, chord[0] - 12, 0.11, 0.9);
    const beat = s % 2 === 0;
    if (Math.random() < (beat ? 0.62 : 0.3)) {
      let n = music.melodyNote + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.75 ? 1 : 2);
      n = Math.max(0, Math.min(PENTA.length - 1, n)); music.melodyNote = n;
      pluck(t, PENTA[n], 0.06 + Math.random() * 0.03, 0.55);
    }
    music.next += eighth; music.step++;
    if (music.step % 8 === 0) music.bar++;
  }
}
export function setMusic(on) { if (music && AC) music.master.gain.setTargetAtTime(on ? music.base : 0, AC.currentTime, 0.6); }

export const SFX = {
  throw() { noise(0.25, 0.2, 2500); haptic(12); },
  skip() { tone(900, 1400, 0.08, 'sine', 0.14); },
  plunk() { tone(300, 110, 0.25, 'sine', 0.2); noise(0.12, 0.1, 900); },
  sand() { noise(0.12, 0.12, 500); },
  hit() { tone(220, 80, 0.2, 'square', 0.14); noise(0.1, 0.15, 800); haptic(25); },
  spray() { spray(0.6); },
  splat() {
    noiseBand(0.22, 0.5, 1400, 250, 0.8, 0.005); tone(150, 45, 0.28, 'triangle', 0.3); noise(0.35, 0.25, 500);
    for (let i = 0; i < 4; i++) setTimeout(() => tone(rand(700, 1500), rand(300, 600), 0.07, 'sine', 0.09), 120 + i * 90 + Math.random() * 60);
    haptic([60, 40, 90]);
  },
  pick() { tone(520, 760, 0.06, 'square', 0.07); haptic(8); },
  select() { tone(700, 900, 0.05, 'square', 0.05); },
  dodge() { noise(0.15, 0.1, 4000); },
  wave() { tone(440, 880, 0.15, 'square', 0.1); setTimeout(() => tone(660, 1320, 0.2, 'square', 0.1), 150); },
  over() { tone(320, 50, 1.3, 'sawtooth', 0.18); },
  moo(voice) { playMoo(voice); },
};
