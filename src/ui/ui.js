// HTML layer: HUD, pocket bar, floating messages, screens, leaderboard and settings persistence.
import { drawRockIcon, rockLabel } from '../game/rocks.js';
import { POCKET_MAX } from '../game/game.js';
import { audio, setAmbient, setMusic } from '../audio/sfx.js';

const $ = (id) => document.getElementById(id);
const LS = { scores: 'udderly.scores.v2', name: 'udderly.name', settings: 'udderly.settings.v1' };
function load(key, def) { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; } catch (e) { return def; } }
function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) {} }
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  constructor() {
    this.settings = Object.assign({ sound: true, music: true, haptics: true, shadows: true, sharp: false }, load(LS.settings, {}));
    this.lastHud = ''; this.ringR = 80; this.hintT = 0; this.world = null;
    this.slotCanvases = [];
    const slots = $('slots');
    for (let i = 0; i < POCKET_MAX; i++) {
      const b = document.createElement('button'); b.className = 'slot'; b.type = 'button'; b.setAttribute('aria-label', 'Pocket slot ' + (i + 1));
      const c = document.createElement('canvas'); c.width = c.height = 96; b.appendChild(c); slots.appendChild(b);
      this.slotCanvases.push({ b, c });
    }
    $('optSound').checked = this.settings.sound; $('optMusic').checked = this.settings.music; $('optHaptics').checked = this.settings.haptics; $('optShadows').checked = this.settings.shadows; $('optSharp').checked = this.settings.sharp;
    audio.muted = !this.settings.sound; audio.haptics = this.settings.haptics; audio.music = this.settings.music;
  }
  bind(game, world) {
    this.world = world; this.game = game;
    this.slotCanvases.forEach(({ b }, i) => b.addEventListener('click', () => game.selectSlot(i)));
    $('playBtn').addEventListener('click', () => game.start(false));
    $('practiceBtn').addEventListener('click', () => game.start(true));
    $('againBtn').addEventListener('click', () => game.start(false));
    $('restartBtn').addEventListener('click', () => game.start(game.practice));
    $('resumeBtn').addEventListener('click', () => game.resume());
    $('quitBtn').addEventListener('click', () => game.quit());
    $('homeBtn').addEventListener('click', () => game.quit());
    $('pauseBtn').addEventListener('click', () => game.pause());
    $('scoresBtn').addEventListener('click', () => { const n = this.renderBoard($('boardList')); $('boardEmpty').hidden = n > 0; this.show('board'); });
    $('boardBackBtn').addEventListener('click', () => this.show('title'));
    $('settingsBtn').addEventListener('click', () => this.show('settings'));
    $('settingsBackBtn').addEventListener('click', () => this.show('title'));
    $('saveBtn').addEventListener('click', () => { $('saveBtn').disabled = true; this.saveScore(game); });
    $('skipSaveBtn').addEventListener('click', () => { $('entry').hidden = true; $('overBoardWrap').hidden = false; this.renderBoard($('overBoard')); });
    $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('saveBtn').click(); } });
    const opt = (id, key, fn) => $(id).addEventListener('change', (e) => { this.settings[key] = e.target.checked; save(LS.settings, this.settings); fn && fn(e.target.checked); });
    opt('optSound', 'sound', (on) => { audio.muted = !on; setAmbient(on); setMusic(on && audio.music); });
    opt('optMusic', 'music', (on) => { audio.music = on; setMusic(on && !audio.muted); });
    opt('optHaptics', 'haptics', (on) => { audio.haptics = on; });
    opt('optShadows', 'shadows', (on) => world.setQuality({ shadows: on }));
    opt('optSharp', 'sharp', (on) => world.setQuality({ sharp: on }));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { if (game.mode === 'play') game.pause(); else if (game.mode === 'pause') game.resume(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && game.mode === 'play') game.pause(); });
  }

  show(id) { for (const o of ['title', 'pause', 'over', 'board', 'settings']) $(o).hidden = o !== id; }
  hudVisible(on) { $('hud').hidden = !on; }
  hint(text) { $('hintTop').textContent = text; $('hints').classList.add('show'); this.hintT = 9; }

  hud(g) {
    const key = `${g.score}|${g.level}|${g.li}|${g.practice}|${g.bestChain}`;
    if (key === this.lastHud) return; this.lastHud = key;
    $('hudScore').textContent = g.score;
    $('hudWave').textContent = g.practice ? 'PRACTICE' : 'WAVE ' + g.level;
    if (g.practice) { $('hudMeterFill').style.width = '0%'; $('hudMeterLbl').textContent = 'BEST CHAIN ' + g.bestChain; }
    else { $('hudMeterFill').style.width = g.li + '%'; $('hudMeterLbl').textContent = 'LACTOSE ' + Math.round(g.li) + '%'; }
  }
  frame(g) {
    const ring = $('flickRing');
    if (g.mode === 'play' && g.pocket.length) {
      const h = this.world.project(g.handWorld()); const R = Math.max(64, this.world.W * 0.2);
      ring.style.left = h.x + 'px'; ring.style.top = h.y + 'px'; ring.style.width = ring.style.height = R * 2 + 'px'; ring.classList.add('show');
      $('flickHint').style.display = g.time < 12 ? '' : 'none';
    } else ring.classList.remove('show');
    if (this.hintT > 0) { this.hintT -= 1 / 60; if (this.hintT <= 0) $('hints').classList.remove('show'); }
  }
  renderPocket(g) {
    this.slotCanvases.forEach(({ b, c }, i) => {
      const rock = g.pocket[i]; const ctx = c.getContext('2d'); ctx.clearRect(0, 0, 96, 96);
      b.classList.toggle('sel', !!rock && i === g.sel);
      if (rock) { const r = 22 * (0.75 + rock.size * 0.6) / Math.sqrt(rock.aspect); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(50, 56, r * rock.aspect * 0.95, r * 0.6, 0, 0, 6.283); ctx.fill(); drawRockIcon(ctx, 48, 46, r, rock, rock.rot); }
    });
    const rock = g.pocket[g.sel], el = $('rockStats');
    if (rock) { const L = rockLabel(rock); el.innerHTML = `<b>${'★'.repeat(L.stars)}${'☆'.repeat(5 - L.stars)}</b> &nbsp; FLAT ${Math.round(rock.flat * 100)}% &nbsp; ${L.circ} CM &nbsp; ${L.g} G`; }
    else el.textContent = 'TAP BEACH ROCKS TO FILL YOUR POCKET';
  }
  msg(text, x, y, o = {}) {
    const el = document.createElement('div'); el.className = 'msg'; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.fontSize = (o.size || 16) + 'px'; el.style.color = o.color || '#fff';
    el.style.animationDuration = (o.life || 1.3) + 's';
    $('msgs').appendChild(el);
    setTimeout(() => el.remove(), (o.life || 1.3) * 1000 + 50);
  }
  milk() { const m = $('milk'); m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit'); }

  pause(g) {
    $('pScore').textContent = g.score; $('pWave').textContent = g.practice ? g.bestChain : g.level; $('pWaveK').textContent = g.practice ? 'Best chain' : 'Wave'; $('pLi').textContent = g.practice ? 'n/a' : Math.round(g.li) + '%';
    this.show('pause');
  }
  gameOver(g) {
    $('oScore').textContent = g.score; $('oWave').textContent = g.level; $('oKills').textContent = g.kills;
    $('entry').hidden = false; $('overBoardWrap').hidden = true; $('saveBtn').disabled = false;
    $('nameInput').value = load(LS.name, '');
    this.show('over');
  }
  renderBoard(el, highlight) {
    const list = load(LS.scores, []); el.innerHTML = '';
    list.forEach((s, i) => { const li = document.createElement('li'); if (highlight && s.id === highlight) li.className = 'me'; li.innerHTML = `<span class="r">${i + 1}.</span><span class="n">${esc(s.name)}<span class="w">W${s.wave}</span></span><span>${s.score}</span>`; el.appendChild(li); });
    return list.length;
  }
  saveScore(g) {
    const name = ($('nameInput').value.trim().toUpperCase() || 'ANON').slice(0, 12); save(LS.name, name);
    const list = load(LS.scores, []); const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    list.push({ id, name, score: g.score, wave: g.level, kills: g.kills, date: new Date().toISOString() });
    list.sort((a, b) => b.score - a.score); save(LS.scores, list.slice(0, 10));
    $('entry').hidden = true; $('overBoardWrap').hidden = false; this.renderBoard($('overBoard'), id);
  }
}
