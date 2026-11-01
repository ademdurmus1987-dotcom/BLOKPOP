// BLOKPOP Buz - 3B gorunum (three.js r160). Kurallar motor.js'te (window.BZM), burasi sadece cizim, ses ve dokunma.
// Sahne: arkaya yaslanmis dev tahta (gercek 3B buz kupleri, arkada resim), onunde zeminde duz bant, yuvalar (bekleme),
// sol altta tabla yigini (en fazla 5) ve 4 kuyruk olugu. Filler ana oyunun 3B Pofi modeli (renge boyanir).
import * as THREE from '../three.module.min.js';
import { GLTFLoader } from '../GLTFLoader.js';
import { clone as skClone } from '../SkeletonUtils.js';

const BZM = window.BZM;
BZM.setLib(window.BZ_IZGARA);
const $ = (id) => document.getElementById(id);
const FONT = 'Fredoka,system-ui,sans-serif';
const KEYC = ['#ffc83d', '#d6dde8', '#ff7fb5'];
const TIPS = {
  intro: { t: 'Nasıl oynanır?', p: 'Oluğa dokun: Pofi bir <b>tablaya</b> biner, tabla banda fırlar. Pofi sütunların önünden geçerken <b>en alttaki buz</b> kendi rengindeyse başını kaldırıp <b>bir atış</b> yapar.<br>Sırtındaki sayı <b>atış hakkıdır</b>. Hakkı artan Pofi <b>yuvaya</b> iner; yuva kalmazsa kaybedersin. Sol alttaki 4 tabla bandın kapasitesidir: bantta aynı anda en fazla 4 Pofi olur.' },
  thick: { t: 'Yeni: Kalın buz', p: 'Kalın buz <b>2 atışta</b> kırılır. İlk atışta çatlar, ikinci atışta resim açılır.' },
  wood: { t: 'Yeni: Tahta', p: 'Çivili tahtayı <b>her renk Pofi</b> kırabilir. Üstündeki sayı kaç atış daha gerektiğini gösterir.' },
  chain: { t: 'Yeni: Zincir', p: 'Zinciri sadece <b>zincirin rengindeki</b> Pofi kırabilir. Sonra altındaki buzlar kendi rengiyle kırılır.' },
  lock: { t: 'Yeni: Kilit', p: 'Kilitli buz <b>vurulamaz</b>. Anahtarı başka bir buz bloğunun içinde. O bloğu tamamen kırınca anahtar uçar ve kilidi açar.' }
};
const COMBO_AT = [15, 40, 80, 150], COMBO_W = ['Harika!', 'Süper!', 'Muhteşem!', 'EFSANE!'], COMBO_COL = [['#fff38a', '#ffb000'], ['#b6fff0', '#18c9a2'], ['#ffd0f2', '#ff3fa0'], ['#ffffff', '#ff6a00']];
const MAX_TRAY = 4;

// ---------- kayit ----------
const SKEY = 'blokpop_buz_v1';
let SV = { L: 1, max: 1, tips: {}, mute: false, vib: 2, best: {} };
try { const d = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (d && typeof d === 'object') SV = Object.assign(SV, d); } catch (e) {}
if (SV.vib == null) SV.vib = 2;
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(SV)); } catch (e) {} };
const qL = /[?&]sv=(\d+)/.exec(location.search);

// ---------- ses (ana oyunun ses motoru) ----------
let AC = null, master = null, wet = null, noiseBuf = null, lastPop = 0, lastShoot = 0, lastVib = 0, lastTap = 0;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} } return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C();
    master = AC.createGain(); master.gain.value = 0.7; const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2; master.connect(comp); comp.connect(AC.destination);
    wet = AC.createGain(); wet.gain.value = 0.22; const dl = AC.createDelay(0.5); dl.delayTime.value = 0.13; const fb = AC.createGain(); fb.gain.value = 0.3; wet.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(comp);
    const len = AC.sampleRate; noiseBuf = AC.createBuffer(1, len, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f, d, type, vol, delay, slide, send) { if (!AC || SV.mute) return; try { const t0 = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(master); if (send && wet) g.connect(wet); o.start(t0); o.stop(t0 + d + 0.03); } catch (e) {} }
function noise(d, vol, delay, type, f0, f1, send) { if (!AC || SV.mute || !noiseBuf) return; try { const t0 = AC.currentTime + (delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0 || 1000, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + d); f.Q.value = 1.2; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); s.connect(f); f.connect(g); g.connect(master); if (send && wet) g.connect(wet); s.start(t0); s.stop(t0 + d + 0.03); } catch (e) {} }
const SFX = {
  tap() { const n = Date.now(); if (n - lastTap < 45) return; lastTap = n; tone(780, 0.075, 'sine', 0.1, 0, 520); tone(1250, 0.05, 'sine', 0.035, 0.012, 950); },
  // sarap/sampanya mantari: keskin patlama + asagi kayan 'plop' + hafif kopuk
  launch() { noise(0.03, 0.55, 0, 'bandpass', 2400, 1200); tone(980, 0.08, 'sine', 0.42, 0, 240); tone(520, 0.06, 'sine', 0.18, 0.006, 190); tone(160, 0.07, 'sine', 0.22, 0, 90); noise(0.4, 0.035, 0.04, 'highpass', 5000, 8500); },
  land() { tone(180, 0.06, 'sine', 0.2, 0, 120); noise(0.04, 0.08, 0, 'lowpass', 800, 300); },
  tray() { tone(1400, 0.05, 'triangle', 0.06, 0, 1100); tone(2100, 0.04, 'sine', 0.03, 0.02); },
  shoot() { const n = Date.now(); if (n - lastShoot < 55) return; lastShoot = n; tone(520, 0.05, 'triangle', 0.09, 0, 240); noise(0.035, 0.06, 0, 'highpass', 2500, 5000); },
  // tok ve dolgun vurus: derin govde + kisa tik + govdeli gurultu
  pop(c) { const n = Date.now(); if (n - lastPop < 40) return; lastPop = n; tone(118, 0.11, 'sine', 0.55, 0, 62); tone(236, 0.06, 'triangle', 0.14, 0, 120); tone(340 + (c % 5) * 30, 0.035, 'triangle', 0.07, 0, 200); noise(0.07, 0.26, 0, 'lowpass', 1400, 260); noise(0.012, 0.18, 0, 'bandpass', 2600, 1800); },
  crack(k) { if (k === 'ice') { tone(2400, 0.07, 'triangle', 0.09, 0, 3100); noise(0.08, 0.08, 0, 'highpass', 4000, 6000); } else if (k === 'chain') { tone(1250, 0.06, 'square', 0.04); tone(1800, 0.07, 'square', 0.03, 0.04); noise(0.05, 0.06, 0, 'highpass', 3000, 6000); } else { tone(260, 0.1, 'sine', 0.18, 0, 160); noise(0.08, 0.1, 0, 'bandpass', 800, 400); } },
  smash(k) { noise(0.45 + 0.12 * (k || 1), 0.38, 0, 'lowpass', 2800, 120); tone(120, 0.4, 'sine', 0.38, 0, 40); tone(240, 0.12, 'square', 0.08, 0, 90); [1568, 2093, 2637].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, 0.03 + i * 0.04, 0, true)); },
  knock() { noise(0.018, 0.4, 0, 'bandpass', 3200, 2400); tone(1650, 0.045, 'sine', 0.2, 0, 1400); tone(3900, 0.03, 'sine', 0.06, 0); tone(240, 0.06, 'sine', 0.22, 0, 150); },
  chime() { [1047, 1319, 1568, 2093].forEach((f, i) => tone(f, 0.35, 'triangle', 0.1, i * 0.05, 0, true)); },
  combo(t) { const b = [523, 659, 784, 1047][t] || 523; [0, 4, 7, 12].forEach((s, i) => tone(b * Math.pow(2, s / 12), 0.22, 'triangle', 0.14, i * 0.05, 0, true)); noise(0.2, 0.05, 0, 'highpass', 6000, 9000, true); },
  bench() { tone(500, 0.12, 'sine', 0.2); tone(750, 0.16, 'sine', 0.2, 0.09, 0, true); },
  deny() { tone(120, 0.1, 'sine', 0.3, 0, 70); noise(0.06, 0.14, 0, 'lowpass', 600, 200); },
  lose() { tone(392, 0.7, 'sawtooth', 0.12, 0, 130); tone(196, 0.8, 'sine', 0.18, 0, 62); noise(0.4, 0.07, 0, 'lowpass', 1200, 200); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.34, 'triangle', 0.22, i * 0.09, 0, true); tone(f / 2, 0.3, 'sine', 0.1, i * 0.09); }); [523, 659, 784].forEach((f) => tone(f, 0.9, 'sine', 0.1, 0.48)); noise(0.5, 0.06, 0.4, 'highpass', 5000, 9000, true); }
};
const VIBK = [0, 0.55, 1, 1.7];
function vib(p) { const k = VIBK[SV.vib | 0] || 0; if (!k) return; const now = Date.now(); if (typeof p === 'number') { if (now - lastVib < 45) return; lastVib = now; p = Math.max(4, Math.round(p * k)); } else p = p.map((v, i) => (i % 2 ? v : Math.max(4, Math.round(v * k)))); try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ---------- 3B kurulum ----------
const glc = $('gl'), ov = $('ov'), octx = ov.getContext('2d');
let ren;
try { ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]test=1/.test(location.search) }); }
catch (e) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:600 18px sans-serif;text-align:center;padding:30px">Bu cihazda 3B çizim açılamadı.</div>'); throw e; }
ren.outputColorSpace = THREE.SRGBColorSpace;
ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 0.95;
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#1c1008');
const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 300);   // tahta kamerasi
const camF = new THREE.PerspectiveCamera(30, 1, 0.5, 300);  // atici alani kamerasi (tepeden)
const VPB = { x: 0, y: 0, w: 1, h: 1 }, VPF = { x: 0, y: 0, w: 1, h: 1 };
cam.layers.set(0); camF.layers.set(1);
const toFloor = (o) => { o.traverse((x) => x.layers.set(1)); return o; };

// yansima icin basit ortam (gok + parlak paneller)
(function env() {
  const es = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 16; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#7fb6e0'); gr.addColorStop(0.5, '#d8e6f0'); gr.addColorStop(0.55, '#8a6a4a'); gr.addColorStop(1, '#2a1a0c'); x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide })));
  const pm = new THREE.MeshBasicMaterial({ color: 0xffffff }); pm.color.multiplyScalar(2.2);
  [[-12, 14, 8], [10, 12, 14], [0, 20, -6]].forEach(([a, b, d]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), pm); p.position.set(a, b, d); p.lookAt(0, 0, 0); es.add(p); });
  const pmrem = new THREE.PMREMGenerator(ren); scene.environment = pmrem.fromScene(es, 0.03).texture; pmrem.dispose();
})();
{ const h = new THREE.HemisphereLight(0xfff4e6, 0x5a3a1a, 0.45); h.layers.enableAll(); scene.add(h); }
const sun = new THREE.DirectionalLight(0xfff1dc, 1.9); sun.position.set(-7, 18, 14); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -14; sun.shadow.camera.near = 2; sun.shadow.camera.far = 60; sun.shadow.bias = -0.0008; sun.shadow.normalBias = 0.02;
sun.layers.enableAll(); sun.shadow.camera.layers.enableAll(); scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xd6e6ff, 0.35); fill.position.set(9, 6, 10); fill.layers.enableAll(); scene.add(fill);

// ---------- dokular (cizimle uretilir) ----------
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function woodDraw(x, w, h, base, dark, planks) {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  const ph = h / planks;
  for (let p = 0; p < planks; p++) {
    const y0 = p * ph, tint = (p * 37 % 5 - 2) * 6;
    x.fillStyle = `rgba(${tint > 0 ? 255 : 0},${tint > 0 ? 200 : 0},${tint > 0 ? 140 : 0},${Math.abs(tint) / 60})`; x.fillRect(0, y0, w, ph);
    for (let k = 0; k < 26; k++) { const yy = y0 + Math.random() * ph; x.strokeStyle = `rgba(60,30,10,${0.08 + Math.random() * 0.14})`; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.moveTo(0, yy); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.02 + k) * 3 + (Math.random() - 0.5) * 2); x.stroke(); }
    if (Math.random() < 0.7) { const kx = Math.random() * w, ky = y0 + ph * (0.3 + Math.random() * 0.4); x.strokeStyle = 'rgba(70,35,10,.35)'; for (let r = 3; r < 14; r += 3) { x.beginPath(); x.ellipse(kx, ky, r * 2.2, r * 0.8, 0, 0, 7); x.stroke(); } }
    x.fillStyle = dark; x.fillRect(0, y0, w, 3); x.fillStyle = 'rgba(255,230,190,.18)'; x.fillRect(0, y0 + 3, w, 2);
  }
}
const TX = {
  wood: canvasTex(512, 512, (x, w, h) => woodDraw(x, w, h, '#b9773d', '#5a3214', 4), [1, 1]),
  floor: canvasTex(512, 512, (x, w, h) => {
    // mavi-gri tas karolar (tahtanin ahsabindan ayri dursun)
    x.fillStyle = '#3d4a5c'; x.fillRect(0, 0, w, h);
    const n = 4, t = w / n;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const v = Math.random() * 14 - 7; x.fillStyle = `rgb(${92 + v},${108 + v},${128 + v})`; x.fillRect(c * t + 3, r * t + 3, t - 6, t - 6);
      for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`; x.fillRect(c * t + 3 + Math.random() * (t - 6), r * t + 3 + Math.random() * (t - 6), 3, 3); }
      x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(c * t + 3, r * t + 3, t - 6, 3);
    }
  }, [6, 6]),
  slate: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#2b3442'; x.fillRect(0, 0, w, h); for (let k = 0; k < 500; k++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < h; y += 64) x.fillRect(0, y, w, 3); }, [1, 4]),
  frost: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { const v = 225 + Math.random() * 30; x.fillStyle = `rgba(${v - 10},${v},255,.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(190,215,240,.55)'; x.lineWidth = 1.4; for (let k = 0; k < 7; k++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (Math.random() - 0.5) * 70; py += (Math.random() - 0.5) * 70; x.lineTo(px, py); } x.stroke(); }
    const gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, 'rgba(255,255,255,.0)'); gr.addColorStop(0.35, 'rgba(255,255,255,.0)'); gr.addColorStop(0.42, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  }),
  belt: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#3a2a22'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(255,210,140,.35)'; x.lineWidth = 10; x.lineCap = 'round'; x.lineJoin = 'round';
    for (let k = 0; k < 2; k++) { const cx = 64 + k * 128; x.beginPath(); x.moveTo(cx - 22, 30); x.lineTo(cx + 14, 64); x.lineTo(cx - 22, 98); x.stroke(); }
  }, [6, 1])
};

// ---------- malzemeler ----------
const MAT = {
  wood: new THREE.MeshStandardMaterial({ map: TX.wood, roughness: 0.75, metalness: 0 }),
  floor: new THREE.MeshStandardMaterial({ map: TX.floor, roughness: 0.85 }),
  belt: new THREE.MeshStandardMaterial({ map: TX.belt, roughness: 0.6 }),
  rail: new THREE.MeshStandardMaterial({ color: '#9aa3b2', metalness: 0.85, roughness: 0.3 }),
  ice: new THREE.MeshPhysicalMaterial({ map: TX.frost, roughness: 0.22, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.1, envMapIntensity: 0.55 }),
  frost: new THREE.MeshPhysicalMaterial({ color: '#f4fbff', map: TX.frost, roughness: 0.55, transparent: true, opacity: 0.55, depthWrite: false, clearcoat: 0.6 }),
  steel: new THREE.MeshStandardMaterial({ color: '#c7ced9', metalness: 0.9, roughness: 0.28 }),
  nail: new THREE.MeshStandardMaterial({ color: '#8a8f9a', metalness: 0.9, roughness: 0.4 }),
  tray: new THREE.MeshStandardMaterial({ color: '#9aa1ab', metalness: 0.7, roughness: 0.38 }),
  trayRim: new THREE.MeshStandardMaterial({ color: '#c3c9d1', metalness: 0.85, roughness: 0.25 }),
  pad: new THREE.MeshStandardMaterial({ color: '#1c2430', roughness: 0.9, transparent: true, opacity: 0.6 }),
  padRing: new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.5, emissive: '#2a4a6a', emissiveIntensity: 0.5 }),
  lane: new THREE.MeshStandardMaterial({ map: TX.slate, roughness: 0.8 }),
  laneWall: new THREE.MeshStandardMaterial({ color: '#8f9aab', metalness: 0.6, roughness: 0.35 })
};
const metal = (col, r) => new THREE.MeshStandardMaterial({ color: col, metalness: 0.75, roughness: r == null ? 0.3 : r });

// ---------- yerlesim (dunya birimleri) ----------
// tahta 10 birim genis; alt kenari y=0,z=0'da, THETA kadar arkaya yaslanir
const BW = 10, THETA = 30 * Math.PI / 180, BELT_Z = 1.4;
// zemindeki yerler ekrana gore hesaplanir (layout)
let PAD_Z = 4.0, PAD_X0 = -2.75, PAD_X1 = 4.55, PAD_R = 0.82, LANE_Z0 = 6.3, LANE_DZ = 1.9, LANE_DX = 2.25, STACK = new THREE.Vector3(-4.55, 0, 4.0);
const boardG = new THREE.Group(); boardG.rotation.x = -THETA; scene.add(boardG);
const staticG = new THREE.Group(); scene.add(staticG);
let g = null, LV = 1, S = 1, BH = 1;  // S: kup boyu
let cubeMesh = null, frostMesh = null, picMesh = null, frameG = null, objG = null, keyG = null;
const objMeshes = {}, keyMeshes = {};
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

// zemin, bant, yuvalar, oluklar (seviyeden bagimsiz)
(function buildStatic() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), MAT.floor); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 8); floor.receiveShadow = true; staticG.add(floor);
  // bant: zeminle ayni duzlemde, tahtanin dibinde; carksiz
  const belt = new THREE.Mesh(new THREE.BoxGeometry(16, 0.1, 2.0), [MAT.rail, MAT.rail, MAT.belt, MAT.rail, MAT.rail, MAT.rail]); belt.position.set(0, 0.05, BELT_Z); belt.receiveShadow = true; staticG.add(belt);
  [-1, 1].forEach((d) => { const r = new THREE.Mesh(new THREE.BoxGeometry(16, 0.16, 0.12), MAT.rail); r.position.set(0, 0.08, BELT_Z + d * 1.06); r.castShadow = true; staticG.add(r); });
})();
toFloor(staticG);
const laneG = new THREE.Group(); scene.add(laneG);
function buildLanes() {
  while (laneG.children.length) { const m = laneG.children[0]; laneG.remove(m); if (m.geometry) m.geometry.dispose(); }
  const laneLen = 30, staticG = laneG;
  for (let k = 0; k < 4; k++) {
    const x = (k - 1.5) * LANE_DX;
    const fl = new THREE.Mesh(new THREE.BoxGeometry(LANE_DX - 0.25, 0.05, laneLen), MAT.lane); fl.position.set(x, 0.025, LANE_Z0 - 0.9 + laneLen / 2); fl.receiveShadow = true; staticG.add(fl);
    [-1, 1].forEach((d) => { const w = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, laneLen), MAT.laneWall); w.position.set(x + d * (LANE_DX - 0.25) / 2, 0.16, LANE_Z0 - 0.9 + laneLen / 2); w.castShadow = true; w.receiveShadow = true; staticG.add(w); });
  }
  toFloor(laneG);
}
const padG = new THREE.Group(); scene.add(padG);
function buildPads(n) {
  while (padG.children.length) padG.remove(padG.children[0]);
  for (let k = 0; k < n; k++) {
    const p = padPos(k, n);
    const d = new THREE.Mesh(new THREE.CircleGeometry(PAD_R, 32), MAT.pad); d.rotation.x = -Math.PI / 2; d.position.set(p.x, 0.012, p.z); padG.add(d);
    const r = new THREE.Mesh(new THREE.TorusGeometry(PAD_R, 0.05, 8, 40), MAT.padRing); r.rotation.x = -Math.PI / 2; r.position.set(p.x, 0.02, p.z); padG.add(r);
  }
  toFloor(padG);
}
function padPos(k, n) { n = n || (g ? g.bench.length : 5); const x = n > 1 ? PAD_X0 + (PAD_X1 - PAD_X0) * k / (n - 1) : (PAD_X0 + PAD_X1) / 2; return { x, z: PAD_Z }; }
function lanePos(k, j) { return { x: (k - 1.5) * LANE_DX, z: LANE_Z0 + j * LANE_DZ }; }
const colX = (xc) => -BW / 2 + xc * S;   // motordaki sutun konumu -> dunya x

// yuvarlak kenarli kup (on yuzu bombeli)
function cubeGeo(size, depth) {
  const bev = size * 0.12, h = size / 2 - bev * 0.95, r = size * 0.1, sh = new THREE.Shape();
  sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.95, bevelSegments: 1, curveSegments: 2 });
  geo.translate(0, 0, -(depth - 2 * bev) / 2);
  const p = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / size + 0.5, p.getY(i) / size + 0.5);
  geo.computeVertexNormals();
  return geo;
}
function cellLocal(i, out) { const c = i % g.W, r = Math.floor(i / g.W); return (out || new THREE.Vector3()).set(-BW / 2 + (c + 0.5) * S, (g.H - r - 0.5) * S, S * 0.46); }
function cellWorld(i, out) { const v = cellLocal(i, out); boardG.updateMatrixWorld(); return v.applyMatrix4(boardG.matrixWorld); }

function buildBoard() {
  [cubeMesh, frostMesh, picMesh, frameG, objG, keyG].forEach((o) => { if (o) { boardG.remove(o); o.traverse && o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } });
  S = BW / g.W; BH = S * g.H;
  // resim
  const tex = picTex(g.lv.pic, g.lv.crop);
  picMesh = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  picMesh.position.set(0, BH / 2, 0); picMesh.receiveShadow = true; boardG.add(picMesh);
  // cerceve
  frameG = new THREE.Group(); const fw = 0.55, fd = 1.0;
  const addB = (w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, fd), MAT.wood); m.position.set(x, y, fd / 2 - 0.25); m.castShadow = true; m.receiveShadow = true; frameG.add(m); };
  addB(BW + 2 * fw, fw, 0, BH + fw / 2); addB(BW + 2 * fw, fw, 0, -fw / 2 + 0.02); addB(fw, BH + 2 * fw, -BW / 2 - fw / 2, BH / 2); addB(fw, BH + 2 * fw, BW / 2 + fw / 2, BH / 2);
  const back = new THREE.Mesh(new THREE.BoxGeometry(BW + 2 * fw + 6, BH + 2 * fw + 4, 0.3), MAT.wood); back.position.set(0, BH / 2, -0.4); frameG.add(back);
  boardG.add(frameG);
  // kupler
  const n = g.W * g.H;
  cubeMesh = new THREE.InstancedMesh(cubeGeo(S * 0.94, S * 0.8), MAT.ice, n); cubeMesh.castShadow = true; cubeMesh.receiveShadow = true;
  cubeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  frostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(S * 0.98, S * 0.98, S * 0.86), MAT.frost, n); frostMesh.renderOrder = 2;
  for (let i = 0; i < n; i++) { cubeMesh.setColorAt(i, _c.set('#ffffff')); }
  boardG.add(cubeMesh); boardG.add(frostMesh);
  objG = new THREE.Group(); boardG.add(objG); keyG = new THREE.Group(); boardG.add(keyG);
  for (const k in objMeshes) delete objMeshes[k]; for (const k in keyMeshes) delete keyMeshes[k];
  g.objs.forEach((o) => { if (o.alive) { const m = buildObj(o); objMeshes[o.id] = m; objG.add(m); } });
  g.keys.forEach((k) => { const m = keyMesh(KEYC[(g.objs[k.lock] && g.objs[k.lock].lid || 0) % 3], g.B * S * 0.8); const B = g.B; m.position.set(-BW / 2 + (k.bc * B + B / 2) * S, (g.H - k.br * B - B / 2) * S, S * 0.95); keyMeshes[k.id] = m; keyG.add(m); });
  cubesDirty = true;
}
const PICS = {};
function picTex(name, crop) {
  let e = PICS[name];
  if (!e) {
    const img = new Image(); const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    img.onload = () => { t.needsUpdate = true; drawGoal(); }; img.src = '../bg/' + name + '.webp';
    e = PICS[name] = { img, t };
  }
  const t = e.t; const W0 = 720, H0 = 1290;
  t.repeat.set((crop[2] - crop[0]) / W0, (crop[3] - crop[1]) / H0); t.offset.set(crop[0] / W0, 1 - crop[3] / H0);
  return t;
}
let cubesDirty = true;
const pops = {};   // i -> zaman (kirilan kupun buyuyup kaybolmasi)
function updateCubes() {
  const n = g.W * g.H, front = BZM.frontierOf(g), isFront = new Uint8Array(n);
  for (let c = 0; c < g.W; c++) if (front[c] >= 0) isFront[front[c] * g.W + c] = 1;
  for (let i = 0; i < n; i++) {
    const cl = g.cells[i]; cellLocal(i, _v);
    let sc = 1;
    if (cl.done) { const p = pops[i]; if (p != null) { const k = (g.t - p) / 0.2; sc = k >= 1 ? 0 : 1 + 0.35 * k; if (k >= 1) delete pops[i]; } else sc = 0; }
    _s.set(sc, sc, sc); _m.compose(_v, _q.identity(), _s); cubeMesh.setMatrixAt(i, _m);
    _c.set(g.pal[cl.c]);
    if (!cl.done) { if (cl.crk) _c.lerp(new THREE.Color('#ffffff'), 0.28); else if (isFront[i]) _c.multiplyScalar(1.12); else _c.multiplyScalar(0.92); }
    cubeMesh.setColorAt(i, _c);
    const thick = !cl.done && cl.layers.length - cl.pend >= 2;
    _s.setScalar(thick ? 1 : 0); _m.compose(_v, _q, _s); frostMesh.setMatrixAt(i, _m);
  }
  cubeMesh.instanceMatrix.needsUpdate = true; if (cubeMesh.instanceColor) cubeMesh.instanceColor.needsUpdate = true; frostMesh.instanceMatrix.needsUpdate = true;
  cubesDirty = Object.keys(pops).length > 0;
}

// ---------- 3B engeller ----------
function plankMesh(L, w, t) { const m = new THREE.Mesh(new THREE.BoxGeometry(L, w, t), MAT.wood); m.castShadow = true; m.receiveShadow = true; return m; }
function nail(r) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.6, 12), MAT.nail); m.rotation.x = Math.PI / 2; return m; }
function buildObj(o) {
  const grp = new THREE.Group(), w = o.w * S, h = o.h * S, s = Math.min(w, h);
  grp.position.set(-BW / 2 + (o.c0 + o.w / 2) * S, (g.H - o.r0 - o.h / 2) * S, S * 0.86);
  if (o.t === 'wood') {
    const pw = s * 0.26, pt = s * 0.12;
    const add = (L, ang, x, y, z) => { const p = plankMesh(L, pw, pt); p.rotation.z = ang; p.position.set(x, y, z); grp.add(p); [-1, 1].forEach((d) => { const nl = nail(pw * 0.14); nl.position.set(x + Math.cos(ang) * d * (L / 2 - pw * 0.5), y + Math.sin(ang) * d * (L / 2 - pw * 0.5), z + pt * 0.55); grp.add(nl); }); };
    if (o.w > o.h) { add(w * 1.02, 0.06, 0, h * 0.2, 0.0); add(w * 1.02, -0.06, 0, -h * 0.2, 0.02); add(Math.hypot(w * 0.5, h) * 1.05, Math.atan2(h, w * 0.5), -w * 0.25, 0, 0.1); add(Math.hypot(w * 0.5, h) * 1.05, -Math.atan2(h, w * 0.5), w * 0.25, 0, 0.1); }
    else { add(s * 1.25, 0.785, 0, 0, 0); add(s * 1.25, -0.785, 0, 0, pt); }
  } else if (o.t === 'chain') {
    const col = new THREE.Color(g.pal[o.c]), mat = metal(col, 0.28), tor = new THREE.TorusGeometry(s * 0.085, s * 0.026, 8, 16), n = 7;
    [[-1, -1, 1, 1], [1, -1, -1, 1]].forEach(([ax, ay, bx, by], di) => {
      const ang = Math.atan2(by - ay, bx - ax);
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, m = new THREE.Mesh(tor, mat); m.position.set((ax + (bx - ax) * t) * w * 0.46, (ay + (by - ay) * t) * h * 0.46, 0.05 + di * 0.04 + (i % 2) * 0.02); m.scale.set(1.5, 1, 1); m.rotation.set(i % 2 ? Math.PI / 2 : 0, 0, ang, 'ZXY'); m.rotation.z = ang; if (i % 2) m.rotation.x = Math.PI / 2; m.castShadow = true; grp.add(m); }
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.13, s * 0.04, 10, 24), mat); ring.position.z = 0.12; grp.add(ring);
    const shade = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false })); shade.position.z = -0.02; grp.add(shade);
  } else if (o.t === 'lock') {
    const cover = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.98, S * 0.9), MAT.frost); cover.position.z = -S * 0.4; grp.add(cover);
    grp.add(padlockMesh(KEYC[o.lid % 3], s * 0.75));
  }
  grp.userData.o = o;
  return grp;
}
function padlockMesh(col, s) {
  const grp = new THREE.Group(), body = new THREE.Mesh(cubeGeo(s * 0.62, s * 0.3), metal(col, 0.25)); body.scale.y = 0.78; body.position.y = -s * 0.1; body.castShadow = true; grp.add(body);
  const sh = new THREE.Mesh(new THREE.TorusGeometry(s * 0.2, s * 0.055, 12, 24, Math.PI), MAT.steel); sh.position.y = s * 0.14; sh.castShadow = true; grp.add(sh);
  [-1, 1].forEach((d) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.055, s * 0.055, s * 0.12, 12), MAT.steel); leg.position.set(d * s * 0.2, s * 0.09, 0); grp.add(leg); });
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.05, 12), new THREE.MeshStandardMaterial({ color: '#1a1008' })); hole.rotation.x = Math.PI / 2; hole.position.set(0, -s * 0.1, s * 0.16); grp.add(hole);
  grp.position.z = 0.15; return grp;
}
function keyMesh(col, s) {
  const grp = new THREE.Group(), mat = metal(col, 0.22);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(s * 0.17, s * 0.05, 12, 28), mat); ring.position.x = -s * 0.24; grp.add(ring);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.08, s * 0.06), mat); shaft.position.x = s * 0.15; grp.add(shaft);
  [0.28, 0.38].forEach((x, i) => { const t = new THREE.Mesh(new THREE.BoxGeometry(s * 0.06, s * (i ? 0.14 : 0.1), s * 0.06), mat); t.position.set(s * x, -s * 0.08, 0); grp.add(t); });
  grp.rotation.z = -0.6; grp.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  return grp;
}

// ---------- Pofi (ana oyunun 3B modeli) ----------
const PDEF = { f: '../live_pofi.glb', hue1: 0.585, sat0: 0.22, val0: 0.42, bake: 0.35, hue2: [2, 2] };
const POFI = { ready: false, scene: null, mesh: null, clip: null, h0: 1, y0: 0, mats: {}, pool: [], mean: null };
const POFI_H = 1.6;
function bonesOf(root) { const b = {}; root.traverse((o) => { if (o.isBone) b[o.name.replace(/^mixamorig:?/, '')] = o; }); return b; }
function addTrunk(model, mesh) {
  const bones = bonesOf(model), head = bones.Head; if (!head) return;
  mesh.skeleton.pose(); model.updateMatrixWorld(true);
  const sk = mesh.skeleton, hi = sk.bones.indexOf(head), T1 = new THREE.Bone(), T2 = new THREE.Bone(); T1.name = 'Trunk1'; T2.name = 'Trunk2';
  head.add(T1); T1.position.copy(head.worldToLocal(new THREE.Vector3(0.02, 0.54, 0.15))); T1.updateMatrixWorld(true);
  T1.add(T2); T2.position.copy(T1.worldToLocal(new THREE.Vector3(0.07, 0.47, 0.21))); T2.updateMatrixWorld(true);
  const i1 = sk.bones.length, i2 = i1 + 1, si = mesh.geometry.attributes.skinIndex, sw = mesh.geometry.attributes.skinWeight, pos = mesh.geometry.attributes.position, w = new THREE.Vector3();
  const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const ww = sw.getComponent(i, k); if (ww > bw) { bw = ww; bi = si.getComponent(i, k); } }
    if (bi !== hi) continue;
    mesh.getVertexPosition(i, w); w.applyMatrix4(mesh.matrixWorld);
    if (w.z < 0.11 || w.y > 0.57 || w.y < 0.3 || Math.abs(w.x - 0.05) > 0.14) continue;
    const t = Math.max(0, Math.min(1, ((0.57 - w.y) / 0.18) * 0.55 + ((w.z - 0.11) / 0.16) * 0.45)); if (t < 0.05) continue;
    const a = ss(0.05, 0.35, t), b = ss(0.45, 0.85, t);
    si.setXYZW(i, hi, i1, i2, 0); sw.setXYZW(i, 1 - a, a * (1 - b), a * b, 0);
  }
  si.needsUpdate = sw.needsUpdate = true;
  mesh.bind(new THREE.Skeleton(sk.bones.concat([T1, T2]), sk.boneInverses.concat([T1.matrixWorld.clone().invert(), T2.matrixWorld.clone().invert()])), mesh.bindMatrix);
}
function tintMat(src, d, col) {
  const m = src.clone(); m.metalness = 0; m.roughness = 0.5; if (m.normalScale) m.normalScale = new THREE.Vector2(0.6, 0.6);
  const c = new THREE.Color(col); m.customProgramCacheKey = () => 'bz' + d.hue1;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCol = { value: c };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCol;\n' +
      'vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 sc = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)); vec3 hv = rgb2hsv(sc);
        float bodyW = smoothstep(0.33, 0.37, hv.x) * (1.0 - smoothstep(${d.hue1.toFixed(3)} - 0.02, ${d.hue1.toFixed(3)} + 0.02, hv.x)) * smoothstep(${(d.sat0 - 0.05).toFixed(3)}, ${(d.sat0 + 0.05).toFixed(3)}, hv.y) * smoothstep(${(d.val0 - 0.06).toFixed(3)}, ${(d.val0 + 0.06).toFixed(3)}, hv.z);
        float lum = dot(sc, vec3(0.3, 0.59, 0.11));
        vec3 body = uCol * mix(1.0, clamp(lum / 0.62, 0.55, 1.35), ${d.bake.toFixed(3)});
        vec3 warm = pow(vec3(lum) * vec3(1.03, 1.0, 0.93), vec3(2.2)); vec3 det = mix(diffuseColor.rgb, warm, 1.0 - smoothstep(0.18, 0.4, hv.y));
        diffuseColor.rgb = mix(det, body, bodyW);`);
  };
  return m;
}
function cycleMean(b, mixer, act) {
  const acc = {}, N = 16, d = act.getClip().duration;
  for (let i = 0; i < N; i++) { act.time = (i / N) * d; mixer.update(0); for (const n in b) { const q = b[n].quaternion; if (!acc[n]) acc[n] = new THREE.Vector4(); const a = acc[n], sg = a.x * q.x + a.y * q.y + a.z * q.z + a.w * q.w < 0 ? -1 : 1; a.x += q.x * sg; a.y += q.y * sg; a.z += q.z * sg; a.w += q.w * sg; } }
  const out = {}; for (const n in acc) { const a = acc[n]; out[n] = new THREE.Quaternion(a.x, a.y, a.z, a.w).normalize(); } return out;
}
new GLTFLoader().load(PDEF.f, (gl) => {
  const model = gl.scene; let mesh = null; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  if (!mesh) return; addTrunk(model, mesh);
  const bb = new THREE.Box3().setFromObject(model);
  Object.assign(POFI, { scene: model, mesh, clip: gl.animations.find((a) => a.name === 'run') || gl.animations[0], h0: bb.max.y - bb.min.y, y0: bb.min.y, ready: true });
  const lo = $('loading'); if (lo) lo.remove();
}, undefined, () => { const lo = $('loading'); if (lo) lo.textContent = 'Pofi yüklenemedi'; });
const live = new Map();   // shooter -> instance
const BLOB_GEO = new THREE.CircleGeometry(0.62, 24), BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false });
function pofiInst(col) {
  const o = POFI.pool.pop() || (() => {
    const root = skClone(POFI.scene), holder = new THREE.Group(); holder.add(root);
    let mesh = null; root.traverse((x) => { if (x.isSkinnedMesh) { mesh = x; x.frustumCulled = false; x.castShadow = false; } });
    const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03; holder.add(blob);
    const mixer = new THREE.AnimationMixer(root), act = mixer.clipAction(POFI.clip); act.play();
    const b = bonesOf(root); if (!POFI.mean) POFI.mean = cycleMean(b, mixer, act);
    const k = POFI_H / POFI.h0; root.scale.setScalar(k); root.position.y = -POFI.y0 * k;
    toFloor(holder);
    return { holder, root, mesh, b, mixer, act };
  })();
  if (o.col !== col) { if (!POFI.mats[col]) POFI.mats[col] = tintMat(POFI.mesh.material, PDEF, col); o.mesh.material = POFI.mats[col]; o.col = col; }
  return o;
}
const QA = new THREE.Quaternion(), QB = new THREE.Quaternion(), QR = new THREE.Quaternion(), AXR = new THREE.Vector3();
// kafayi yukari kaldir: omurga ust, boyun, bas paylasir (dunya ekseninde, karakterin sag ekseni etrafinda)
function pitchUp(o, ang) {
  o.holder.updateMatrixWorld(true); o.root.getWorldQuaternion(QA); AXR.set(1, 0, 0).applyQuaternion(QA).normalize();
  for (const [n, w] of [['Spine2', 0.25], ['Neck', 0.35], ['Head', 0.4]]) { const bn = o.b[n]; if (!bn) continue; bn.getWorldQuaternion(QA); QR.setFromAxisAngle(AXR, -ang * w); QA.premultiply(QR); bn.parent.getWorldQuaternion(QB); bn.quaternion.copy(QB.invert().multiply(QA)); bn.updateMatrixWorld(true); }
}
function poseInst(o, look, trunk, bob) {
  const mean = POFI.mean; for (const n in o.b) { const q = mean[n]; if (q) o.b[n].quaternion.copy(q); }
  o.root.rotation.set(-0.32, Math.PI, 0, 'YXZ');   // dik dur, sirti kameraya
  if (look) pitchUp(o, look);
  if (o.b.Trunk1) { o.b.Trunk1.rotation.x = -trunk * 0.55; o.b.Trunk2.rotation.x = -trunk * 0.45; }
  o.holder.scale.set(1 + bob * 0.04, 1 - bob * 0.05, 1 + bob * 0.04);
}

// ---------- tablalar ----------
const trayGeo = cubeGeo(1.45, 0.16), rimGeo = new THREE.BoxGeometry(1.45, 0.05, 0.08);
const trays = [];
for (let i = 0; i < MAX_TRAY; i++) {
  const grp = new THREE.Group(); const d = new THREE.Mesh(trayGeo, MAT.tray); d.rotation.x = -Math.PI / 2; d.castShadow = true; d.receiveShadow = true; grp.add(d);
  [[0, 0.68], [0, -0.68], [0.68, 0], [-0.68, 0]].forEach(([x, z], q) => { const r = new THREE.Mesh(rimGeo, MAT.trayRim); r.position.set(x, 0.09, z); if (q > 1) r.rotation.y = Math.PI / 2; grp.add(r); });
  toFloor(grp); scene.add(grp); trays.push({ grp, st: 'stack', s: null, t0: 0, from: new THREE.Vector3(), x: 0 });
}
const TRAY_Y = 0.17;   // bant ustunde tabla kalinligi
function stackSlot(n) { return new THREE.Vector3(STACK.x, 0.07 + n * 0.16, STACK.z); }
function freeTray() { let t = trays.find((q) => q.st === 'stack'); if (!t) t = trays.find((q) => q.st === 'back' || q.st === 'coast'); return t; }

// ---------- durum ----------
let paused = false, fx = [], idleT = 0, winShown = false, loseShown = false, shake = 0, combo = 0, lastHit = -9, toastT = 0, VW = 1, VH = 1, DPR = 1;
const jumps = new Map();   // shooter -> {from, t0, dur, kind}
const CQ = new URLSearchParams(location.search), cqn = (k, d) => (CQ.has(k) ? +CQ.get(k) : d);
const CAM = { fov: cqn('fov', 34), fit: cqn('fit', 10.9), tilt: cqn('tilt', 9), fpitch: cqn('fpitch', 64), ffov: cqn('ffov', 30), gap: cqn('gap', 0.035) };
function projWith(c, vp, v) { const p = v.clone().project(c); return { x: vp.x + (p.x * 0.5 + 0.5) * vp.w, y: vp.y + (-p.y * 0.5 + 0.5) * vp.h, z: p.z }; }
function project(v) { return projWith(cam, VPB, v); }    // tahta
function projectF(v) { return projWith(camF, VPF, v); }  // atici alani
function floorAt(sx, sy, y0) { const v = new THREE.Vector3(((sx - VPF.x) / VPF.w) * 2 - 1, -((sy - VPF.y) / VPF.h) * 2 + 1, 0.5).unproject(camF), dir = v.sub(camF.position).normalize(), t = ((y0 || 0) - camF.position.y) / dir.y; return camF.position.clone().addScaledVector(dir, t); }
function layout() {
  VW = innerWidth; VH = innerHeight; DPR = Math.min(QL >= 2 ? 1 : QL === 1 ? 1.25 : 2, devicePixelRatio || 1);
  ren.setPixelRatio(DPR); ren.setSize(VW, VH, false);
  ov.width = Math.round(VW * DPR); ov.height = Math.round(VH * DPR);
  const css = getComputedStyle(document.documentElement), sat = parseFloat(css.getPropertyValue('--sat')) || 0, sab = parseFloat(css.getPropertyValue('--sab')) || 0;
  const bh = (g ? BH : 12.86) + 1.1;
  // --- ust: tahta, karsidan (biraz yukaridan) ---
  const topY = sat + 44;
  let bwPx = VW, bhPx = VW * bh / CAM.fit;
  const maxBH = (VH - topY) * 0.6; if (bhPx > maxBH) { bhPx = maxBH; bwPx = bhPx * CAM.fit / bh; }
  Object.assign(VPB, { x: 0, y: topY, w: VW, h: bhPx });
  const th = Math.tan(CAM.fov * Math.PI / 360);
  cam.fov = CAM.fov; cam.aspect = VW / bhPx;
  const dist = (bh / 2) / th * 1.0;
  const ctr = new THREE.Vector3(0, (bh - 1.1) / 2 * Math.cos(THETA), -(bh - 1.1) / 2 * Math.sin(THETA)), nrm = new THREE.Vector3(0, Math.sin(THETA), Math.cos(THETA));
  nrm.applyAxisAngle(new THREE.Vector3(1, 0, 0), -CAM.tilt * Math.PI / 180);
  cam.position.copy(ctr).addScaledVector(nrm, dist); cam.lookAt(ctr); cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  // --- alt: atici alani, tepeden (tahtayla arasinda bosluk) ---
  const gap = Math.round(VH * CAM.gap), fy = topY + bhPx + gap, fh = VH - fy;
  Object.assign(VPF, { x: 0, y: fy, w: VW, h: fh });
  camF.fov = CAM.ffov; camF.aspect = VW / fh;
  // bant cizgisi ekranin ustune yakin, x olcegi tahtanin sutunlariyla ayni olsun (atis dik gitsin)
  const pit = CAM.fpitch * Math.PI / 180, dirF = new THREE.Vector3(0, Math.sin(pit), Math.cos(pit));
  const pxCol = bwPx / CAM.fit;            // tahtada 1 birim kac piksel
  const want = (VW / 2) / pxCol;            // ekranin yari genisligi kac birim
  let best = null;
  for (let d = 10; d <= 60; d += 0.5) for (let zc = BELT_Z; zc <= BELT_Z + 14; zc += 0.25) {
    camF.position.set(0, 0, zc).addScaledVector(dirF, d); camF.lookAt(0, 0, zc); camF.updateProjectionMatrix(); camF.updateMatrixWorld();
    const a = projectF(new THREE.Vector3(want, 0.1, BELT_Z)), b = projectF(new THREE.Vector3(0, 0.1, BELT_Z - 0.9));
    const err = Math.abs(a.x - VW) / VW + Math.abs((b.y - fy) / fh - 0.04) * 2;
    if (!best || err < best.err) best = { err, d, zc };
  }
  camF.position.set(0, 0, best.zc).addScaledVector(dirF, best.d); camF.lookAt(0, 0, best.zc); camF.updateProjectionMatrix(); camF.updateMatrixWorld();
  // zemindeki yerleri ekrana gore yerlestir
  const yBelt = projectF(new THREE.Vector3(0, 0, BELT_Z + 1.0)).y, bot = VH - sab, room = bot - yBelt;
  const syPad = yBelt + room * 0.17, syLane = yBelt + room * 0.42;
  PAD_Z = floorAt(VW / 2, syPad).z;
  PAD_X0 = floorAt(VW * 0.28, syPad).x; PAD_X1 = floorAt(VW * 0.94, syPad).x;
  const n = g ? g.bench.length : 6; PAD_R = Math.min(0.8, (PAD_X1 - PAD_X0) / Math.max(1, n - 1) * 0.44);
  STACK.set(floorAt(VW * 0.1, syPad).x, 0, PAD_Z);
  LANE_Z0 = floorAt(VW / 2, syLane).z + 0.4;
  const zEnd = floorAt(VW / 2, bot - 6).z;
  LANE_DZ = Math.max(1.2, (zEnd - LANE_Z0) / 3.1);
  LANE_DX = Math.abs(floorAt(VW, syLane).x) * 2 * 0.96 / 4;
  buildLanes(); if (g) buildPads(g.bench.length);
}
function pxPerUnit(v) { const a = project(v), b = project(v.clone().add(new THREE.Vector3(1, 0, 0))); return Math.hypot(b.x - a.x, b.y - a.y); }
function pxPerUnitF(v) { const a = projectF(v), b = projectF(v.clone().add(new THREE.Vector3(1, 0, 0))); return Math.hypot(b.x - a.x, b.y - a.y); }

// ---------- seviye ----------
function start(L) {
  LV = Math.max(1, Math.min(200, L)); SV.L = LV; save();
  for (const [s, o] of live) { scene.remove(o.holder); POFI.pool.push(o); } live.clear(); jumps.clear();
  g = BZM.newGame(LV); fx = []; winShown = false; loseShown = false; idleT = 0; combo = 0; lastHit = -9;
  for (const k in pops) delete pops[k];
  trays.forEach((t, i) => { t.st = 'stack'; t.s = null; });
  buildBoard(); buildPads(g.bench.length); layout(); drawGoal(); updSign();
  const tip = g.lv.plan.tip;
  if (LV === 1 && !SV.tips.intro) showTip('intro'); else if (tip && !SV.tips[tip]) showTip(tip);
}
function updSign() { if (!g) return; const p = Math.round(100 * (1 - g.left / g.total)); $('signT').textContent = 'Buz ' + LV; $('signP').style.width = p + '%'; }
function drawGoal() { if (!g) return; const c = $('goal'), x = c.getContext('2d'), e = PICS[g.lv.pic]; x.fillStyle = '#cfe9ff'; x.fillRect(0, 0, c.width, c.height); if (e && e.img.complete && e.img.naturalWidth) { const cr = g.lv.crop, ar = (cr[2] - cr[0]) / (cr[3] - cr[1]), h = c.height, w = h * ar; x.drawImage(e.img, cr[0], cr[1], cr[2] - cr[0], cr[3] - cr[1], (c.width - w) / 2, 0, w, h); } }
function picCanvas(size) { const c = document.createElement('canvas'), cr = g.lv.crop, ar = (cr[2] - cr[0]) / (cr[3] - cr[1]); c.width = Math.round(size * 2 * ar); c.height = size * 2; c.style.width = Math.round(size * ar) + 'px'; c.style.height = size + 'px'; const e = PICS[g.lv.pic]; if (e && e.img.naturalWidth) c.getContext('2d').drawImage(e.img, cr[0], cr[1], cr[2] - cr[0], cr[3] - cr[1], 0, 0, c.width, c.height); return c; }

// ---------- modallar ----------
function modal(html, onBind) { $('card').innerHTML = html; $('modal').classList.add('on'); paused = true; bindPress($('card')); if (onBind) onBind($('card')); }
function closeModal() { $('modal').classList.remove('on'); paused = false; last = performance.now(); }
function showTip(k) {
  const T = TIPS[k];
  modal('<div class="tag">İpucu</div><h2>' + T.t + '</h2><p>' + T.p + '</p><button class="btn g" id="ok">Anladım</button>', (c) => {
    c.querySelector('#ok').onclick = () => { SV.tips[k] = 1; save(); closeModal(); const tip = g.lv.plan.tip; if (k === 'intro' && tip && !SV.tips[tip]) showTip(tip); };
  });
}
function showWin() {
  const sec = Math.round(g.t); SV.best[LV] = Math.min(SV.best[LV] || 1e9, sec); if (LV >= SV.max) SV.max = LV + 1; save(); SFX.win(); vib([30, 40, 90]);
  modal('<div class="tag">Seviye ' + LV + '</div><h2>Resim açıldı!</h2><div id="pc"></div><p>' + sec + ' saniye' + (g.revives ? ' • ' + g.revives + ' devam' : '') + '</p><button class="btn g" id="nx">Sonraki ▶</button><button class="btn w" id="ag">Tekrar oyna</button>', (c) => { c.querySelector('#pc').appendChild(picCanvas(220)); c.querySelector('#nx').onclick = () => { closeModal(); start(LV + 1); }; c.querySelector('#ag').onclick = () => { closeModal(); start(LV); }; });
}
function showLose() {
  const p = Math.round(100 * (1 - g.left / g.total));
  modal('<div class="tag" style="background:#f04848">Seviye ' + LV + '</div><h2>Yuvalar doldu!</h2><p>Resmin <b>%' + p + '</b> kadarı açıldı.<br>Hakkı artan Pofi yuvaya iner; yuva kalmayınca oyun biter.</p><button class="btn g" id="re">Tekrar dene</button><button class="btn o" id="rv">+1 yuvayla devam et</button>', (c) => { c.querySelector('#re').onclick = () => { closeModal(); start(LV); }; c.querySelector('#rv').onclick = () => { BZM.revive(g); buildPads(g.bench.length); loseShown = false; closeModal(); }; });
}
function showSettings() {
  const vb = ['Kapalı', 'Hafif', 'Orta', 'Güçlü'].map((t, i) => '<button class="btn' + (SV.vib === i ? ' on' : '') + '" data-v="' + i + '">' + t + '</button>').join('');
  modal('<div class="tag">Ayarlar</div><h2>Ses ve titreşim</h2><div class="lbl">Ses</div><div class="row"><button class="btn' + (!SV.mute ? ' on' : '') + '" data-s="1">Açık</button><button class="btn' + (SV.mute ? ' on' : '') + '" data-s="0">Kapalı</button></div><div class="lbl">Titreşim</div><div class="row">' + vb + '</div><div class="note">iPhone\'da tarayıcı titreşimi desteklemiyor; Android\'de çalışır.</div><button class="btn g" id="ok">Tamam</button>', (c) => {
    c.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { SV.mute = b.dataset.s === '0'; save(); c.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); if (!SV.mute) { ensureAudio(); SFX.pop(2); } });
    c.querySelectorAll('[data-v]').forEach((b) => b.onclick = () => { SV.vib = +b.dataset.v; save(); c.querySelectorAll('[data-v]').forEach((x) => x.classList.toggle('on', x === b)); lastVib = 0; vib([20, 40, 20]); });
    c.querySelector('#ok').onclick = closeModal;
  });
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); toastT = performance.now() + 900; }
function bindPress(root) { root.querySelectorAll('.ib,.btn').forEach((b) => { if (b._bp) return; b._bp = 1; b.addEventListener('pointerdown', () => { b.classList.add('dn'); ensureAudio(); SFX.tap(); vib(8); }); ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => b.classList.remove('dn'))); }); }

// ---------- efektler (ust katman, ekran koordinati) ----------
function mixHex(a, b, t) { const x = new THREE.Color(a).lerp(new THREE.Color(b), t); return '#' + x.getHexString(); }
function burst(x, y, n, cols, sp, size, life, grav, shape) { for (let k = 0; k < n; k++) { const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.8); fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.4, r: size * (0.6 + Math.random() * 0.7), c: cols[k % cols.length], t: 0, life: life * (0.7 + Math.random() * 0.5), g: grav, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, shape: shape || 'tri' }); } }
function col2rad(c, x, y, r, col) { const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; }
function cubePop(i, colIdx) {
  const p = project(cellWorld(i)), ppu = pxPerUnit(cellWorld(i)), cs = S * ppu, col = g.pal[colIdx];
  fx.push({ kind: 'ring', x: p.x, y: p.y, s: Math.max(3, cs * 0.3), t: 0, life: 0.3, c: '#ffffff' });
  fx.push({ kind: 'glow', x: p.x, y: p.y, s: Math.max(16, cs * 1.9), t: 0, life: 0.3, c: col });
  burst(p.x, p.y, 5, ['#ffffff', col, mixHex(col, '#ffffff', 0.5), '#dff4ff'], Math.max(100, cs * 6), Math.max(2.5, cs * 0.18), 0.45, Math.max(240, cs * 14), 'tri');
  if (g.t - lastHit < 0.55) combo++; else combo = 1; lastHit = g.t;
  const ti = COMBO_AT.map((v) => Math.round(v * g.W / 14)).indexOf(combo);
  if (ti >= 0) { const c = project(new THREE.Vector3(0, BH * 0.45, 0).applyMatrix4(boardG.matrixWorld)); fx = fx.filter((q) => q.kind !== 'combo'); fx.push({ kind: 'combo', x: c.x, y: c.y, t: 0, life: 1.3, tx: COMBO_W[ti], tier: ti }); vib(30); SFX.combo(ti); for (let q = 0; q < 14; q++) { const a = Math.random() * 6.283, v = 120 + Math.random() * 200; fx.push({ x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, r: 3 + Math.random() * 2, c: COMBO_COL[ti][q & 1], t: 0, life: 0.7, g: 0, rot: 0, vr: 0, shape: 'dot' }); } }
  shake = Math.min(0.22, shake + 0.03); SFX.pop(combo); vib(combo >= 8 ? 26 : 16);
}
const shotFrom = new Map();   // shot -> dunya baslangic noktasi
function handleEvents() {
  for (const e of g.ev) {
    switch (e.t) {
      case 'launch': {
        const s = e.s, from = e.from === 'q' ? lanePos(e.k, 0) : padPos(e.k);
        jumps.set(s, { from: new THREE.Vector3(from.x, 0, from.z), t0: g.t, dur: 0.45 });
        const tr = freeTray(); if (tr) { tr.from.copy(tr.grp.position); tr.st = 'out'; tr.s = s; tr.t0 = g.t; s._tray = tr; }
        SFX.launch(); SFX.tray(); vib(14); idleT = 0; break;
      }
      case 'fire': e.s.fireT = g.t; SFX.shoot(); break;
      case 'hit': {
        if (e.done) { pops[e.i] = g.t; cubePop(e.i, e.cellC); }
        else { const p = project(cellWorld(e.i)); burst(p.x, p.y, 6, ['#ffffff', '#dff4ff'], 160, 3, 0.4, 300, 'tri'); SFX.crack('ice'); vib(10); }
        cubesDirty = true; updSign(); break;
      }
      case 'objhit': {
        const o = e.o, p = project(cellWorld(e.i));
        if (o.t === 'wood') { burst(p.x, p.y, 9, ['#e7a862', '#9c5a22', '#c9823f'], 180, 5, 0.6, 500, 'rect'); SFX.crack('wood'); }
        else { burst(p.x, p.y, 7, [g.pal[o.c], '#cfd6e0'], 170, 4, 0.6, 500, 'ring'); SFX.crack('chain'); }
        vib(e.broke ? 30 : 12);
        const m = objMeshes[o.id]; if (m) m.userData.hitT = g.t;
        if (e.broke) { if (m) { m.userData.dieT = g.t; } const c = project(objCenter(o)); for (let q = 0; q < 3; q++) burst(c.x + (q - 1) * 20, c.y, 10, o.t === 'wood' ? ['#e7a862', '#9c5a22'] : [g.pal[o.c], '#fff'], 260, 6, 0.8, 600, o.t === 'wood' ? 'rect' : 'ring'); SFX.smash(1); shake = Math.min(0.3, shake + 0.12); }
        break;
      }
      case 'key': { SFX.chime(); vib([15, 25, 15]); break; }
      case 'unlock': { const c = project(objCenter(e.o)); burst(c.x, c.y, 20, [KEYC[e.o.lid % 3], '#fff'], 260, 5, 0.7, 300, 'dot'); fx.push({ kind: 'ring', x: c.x, y: c.y, s: 30, t: 0, life: 0.5, c: KEYC[e.o.lid % 3] }); SFX.knock(); SFX.chime(); vib([20, 40, 20]); const m = objMeshes[e.o.id]; if (m) m.userData.dieT = g.t; cubesDirty = true; break; }
      case 'bench': { const s = e.s; jumps.set(s, { from: s._pos ? s._pos.clone() : new THREE.Vector3(6, TRAY_Y, BELT_Z), t0: g.t, dur: 0.42, toPad: e.k }); trayBack(s); SFX.bench(); vib(10); break; }
      case 'empty': { const s = e.s; if (s._pos) { const p = projectF(s._pos.clone().add(new THREE.Vector3(0, 1.0, 0))); burst(p.x, p.y, 14, [g.pal[s.c], '#fff', '#ffe066'], 200, 4, 0.55, 0, 'star'); } trayCoast(s); break; }
      case 'leave': { const s = e.s; if (e.from === 'belt') trayBack(s); fx.push({ kind: 'leave', s, t: 0, life: 0.6 }); break; }
      case 'lose': shake = 0.5; SFX.lose(); vib([40, 60, 40, 60, 120]); break;
    }
  }
  g.ev.length = 0;
}
function objCenter(o) { return new THREE.Vector3(-BW / 2 + (o.c0 + o.w / 2) * S, (g.H - o.r0 - o.h / 2) * S, S).applyMatrix4(boardG.matrixWorld); }
function trayBack(s) { const t = s._tray; if (!t) return; t.from.copy(t.grp.position); t.st = 'back'; t.t0 = g.t; t.s = null; s._tray = null; }
function trayCoast(s) { const t = s._tray; if (!t) return; t.st = 'coast'; t.x = s.x; t.s = null; s._tray = null; }

// ---------- dokunma ----------
function hit(px, py) {
  if (!g || paused) return;
  ensureAudio();
  let best = null, bd = 1e9;
  g.bench.forEach((s, k) => { if (!s) return; const p = padPos(k), a = projectF(new THREE.Vector3(p.x, 0.8, p.z)), r = pxPerUnitF(new THREE.Vector3(p.x, 0, p.z)) * 0.95, d = Math.hypot(px - a.x, py - a.y); if (d < r && d < bd) { bd = d; best = { from: 'b', k, s }; } });
  if (!best) g.queue.forEach((col, k) => {
    if (!col.length) return;
    const lx = (k - 1.5) * LANE_DX, hw = LANE_DX / 2, a = projectF(new THREE.Vector3(lx - hw, 0, LANE_Z0 - 1.2)), b = projectF(new THREE.Vector3(lx + hw, 0, LANE_Z0 - 1.2)), c = projectF(new THREE.Vector3(lx + hw, 0, LANE_Z0 + 12)), d = projectF(new THREE.Vector3(lx - hw, 0, LANE_Z0 + 12));
    const top = Math.min(a.y, b.y) - 80;
    if (py < top) return;
    const u = Math.max(0, Math.min(1, (py - a.y) / Math.max(1, d.y - a.y))), l = a.x + (d.x - a.x) * u, r = b.x + (c.x - b.x) * u;
    if (px >= l - 6 && px <= r + 6) best = { from: 'q', k, s: col[0] };
  });
  if (!best) return;
  best.s.tapT = performance.now();
  const why = BZM.launch(g, best.from, best.k);
  if (why === 'full') { toast('Tabla kalmadı'); SFX.deny(); vib([20, 30, 20]); } else if (why === 'busy') SFX.tap();
}
ov.addEventListener('pointerdown', (e) => { e.preventDefault(); hit(e.clientX, e.clientY); });

// ---------- her kare ----------
const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const arc = (a, b, k, h, out) => out.lerpVectors(a, b, ease(k)).setY(a.y + (b.y - a.y) * ease(k) + Math.sin(k * Math.PI) * h);
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
const LOOK_UP = cqn('look', 0.7), TRUNK_UP = cqn('trunk', 1.7);
function placeShooters(dt) {
  const want = new Map();   // s -> {pos, look, trunk, bob, vis}
  // kuyruk
  g.queue.forEach((col, k) => { const n = Math.min(col.length, 4); for (let j = 0; j < n; j++) { const s = col[j], p = lanePos(k, j); want.set(s, { pos: new THREE.Vector3(p.x, 0.05, p.z), look: 0, trunk: 0.15, bob: Math.sin(g.t * 3 + s.id) * 0.5 + 0.5 }); } });
  // yuvalar
  g.bench.forEach((s, k) => { if (!s) return; const p = padPos(k); want.set(s, { pos: new THREE.Vector3(p.x, 0.02, p.z), look: 0.1, trunk: 0.25, bob: Math.sin(g.t * 3.4 + s.id) * 0.5 + 0.5 }); });
  // bant: tabla ustunde, kafa yukarida, hortum kalkik
  for (const s of g.belt) {
    if (s.gone) continue;
    const fire = s.fireT != null && g.t - s.fireT < 0.14 ? 1 - (g.t - s.fireT) / 0.14 : 0;
    want.set(s, { pos: new THREE.Vector3(colX(s.x), TRAY_Y, BELT_Z), look: LOOK_UP + fire * 0.18, trunk: TRUNK_UP + fire * 0.6, bob: fire * 0.6, belt: true });
  }
  // atlayislar (kuyruktan/yuvadan tablaya, tabladan yuvaya)
  for (const [s, j] of jumps) {
    const w = want.get(s), k = (g.t - j.t0) / j.dur;
    if (k >= 1 || !w) { jumps.delete(s); if (w && !j.toPad) SFX.land(); continue; }
    arc(j.from, w.pos, k, 1.6, tmpV); w.pos = tmpV.clone(); w.bob = Math.sin(k * Math.PI) * -0.4;
  }
  // gidenler (isi bitti): yukari suzulup kaybolur
  for (const f of fx) if (f.kind === 'leave' && f.s._pos) want.set(f.s, { pos: f.s._pos.clone().add(new THREE.Vector3(0, f.t * 2.5, 0)), look: 0.3, trunk: 0.6, bob: 0, scale: Math.max(0.01, 1 - f.t / f.life) });
  if (g.state === 'lose' && g.lostBy) want.set(g.lostBy, { pos: new THREE.Vector3(colX(g.W + 0.3), TRAY_Y, BELT_Z), look: 0, trunk: 0, bob: Math.sin(g.t * 20) * 0.3 });
  // ornekleri esle
  if (POFI.ready) {
    for (const [s, w] of want) {
      let o = live.get(s); if (!o) { o = pofiInst(g.pal[s.c]); live.set(s, o); scene.add(o.holder); }
      o.holder.position.copy(w.pos); s._pos = w.pos.clone();
      let bob = w.bob; if (s.tapT && performance.now() - s.tapT < 160) bob += (1 - (performance.now() - s.tapT) / 160) * 0.8;
      poseInst(o, w.look, w.trunk, bob);
      if (w.scale != null) o.holder.scale.multiplyScalar(w.scale);
    }
    for (const [s, o] of live) if (!want.has(s)) { scene.remove(o.holder); POFI.pool.push(o); live.delete(s); }
  } else for (const [s, w] of want) s._pos = w.pos.clone();
  return want;
}
function placeTrays() {
  const stackN = []; let n = 0;
  for (const t of trays) {
    if (t.st === 'stack') { const target = stackSlot(n++); t.grp.position.lerp(target, 0.25); stackN.push(t); continue; }
    if (t.st === 'out') {   // yigindan banda firlar, Pofi'nin altina
      const s = t.s; if (!s || s.gone) { trayCoast(s || {}); t.st = 'coast'; continue; }
      const to = new THREE.Vector3(colX(s.x), 0.12, BELT_Z), k = (g.t - t.t0) / 0.32;
      if (k >= 1) { t.st = 'ride'; t.grp.position.copy(to); } else arc(t.from, to, k, 1.4, t.grp.position);
      continue;
    }
    if (t.st === 'ride') { const s = t.s; if (!s) { t.st = 'coast'; continue; } t.grp.position.set(colX(s.x), 0.12, BELT_Z); continue; }
    if (t.st === 'coast') { t.x += g.speed * DT; t.grp.position.set(colX(t.x), 0.12, BELT_Z); if (t.x >= g.X1) { t.from.copy(t.grp.position); t.st = 'back'; t.t0 = g.t; } continue; }
    if (t.st === 'back') { const k = (g.t - t.t0) / 0.5, to = stackSlot(trays.filter((q) => q.st === 'stack').length); if (k >= 1) { t.st = 'stack'; SFX.tray(); } else arc(t.from, to, k, 2.2, t.grp.position); }
  }
  trays.forEach((t) => { t.grp.rotation.y = t.st === 'back' || t.st === 'out' ? Math.sin(g.t * 20) * 0.3 : 0; });
}
function animObjs() {
  for (const id in objMeshes) {
    const m = objMeshes[id], o = m.userData.o;
    if (m.userData.dieT != null) { const k = (g.t - m.userData.dieT) / 0.35; if (k >= 1) { objG.remove(m); delete objMeshes[id]; continue; } m.scale.setScalar(1 + k * 0.3); m.position.z = S * 0.86 + k * 1.5; if (!m.userData.cl) { m.userData.cl = 1; m.traverse((x) => { if (x.material) { x.material = x.material.clone(); x.material.transparent = true; } }); } m.traverse((x) => { if (x.material) x.material.opacity = 1 - k; }); continue; }
    if (m.userData.hitT != null && g.t - m.userData.hitT < 0.12) m.position.x = -BW / 2 + (o.c0 + o.w / 2) * S + Math.sin(g.t * 90) * 0.04;
    else m.position.x = -BW / 2 + (o.c0 + o.w / 2) * S;
  }
  for (const k of g.keys) { const m = keyMeshes[k.id]; if (!m) continue; if (k.out && m.parent === keyG) { keyG.remove(m); } m.rotation.y = Math.sin(g.t * 2 + k.id) * 0.4; }
}
// ust katman: atislar, sirt sayilari, engel canlari, efektler
function drawOverlay(dt, want) {
  const c = octx; c.setTransform(DPR, 0, 0, DPR, 0, 0); c.clearRect(0, 0, VW, VH);
  let sx = 0, sy = 0; if (shake > 0) { shake = Math.max(0, shake - dt); const a = shake * 22; sx = (Math.random() - 0.5) * a; sy = (Math.random() - 0.5) * a; }
  glc.style.transform = shake > 0 ? 'translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)' : '';
  c.save(); c.translate(sx, sy);
  // tahta ile atici alani arasindaki bosluk: tahta rafinin alt kenari
  const gy0 = VPB.y + VPB.h, gy1 = VPF.y;
  if (gy1 > gy0) { const gr = c.createLinearGradient(0, gy0, 0, gy1); gr.addColorStop(0, '#6b3f1c'); gr.addColorStop(0.45, '#3a2210'); gr.addColorStop(1, '#151b24'); c.fillStyle = gr; c.fillRect(0, gy0, VW, gy1 - gy0); c.fillStyle = 'rgba(255,220,170,.35)'; c.fillRect(0, gy0, VW, 2); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, gy1 - 3, VW, 3); }
  // atislar
  c.save(); c.globalCompositeOperation = 'lighter';
  for (const sh of g.shots) {
    let from = shotFrom.get(sh);
    if (!from) { const s = g.belt.find((q) => q.id === sh.sid); const o = s && live.get(s); if (o && o.b.Trunk2) { o.b.Trunk2.getWorldPosition(tmpV); o.b.Trunk1.getWorldPosition(tmpV2); from = tmpV.clone().addScaledVector(tmpV.clone().sub(tmpV2), 1.2); } else from = new THREE.Vector3(colX(sh.col + 0.5), 1.9, BELT_Z); shotFrom.set(sh, from); }
    const to = cellWorld(sh.i), k = Math.min(1, (g.t - sh.t0) / (sh.t1 - sh.t0)), a = projectF(from), b = project(to), x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k, col = g.pal[sh.c], rad = 7;
    const tx = a.x + (b.x - a.x) * Math.max(0, k - 0.25), ty = a.y + (b.y - a.y) * Math.max(0, k - 0.25);
    const tr = c.createLinearGradient(x, y, tx, ty); tr.addColorStop(0, 'rgba(255,255,255,.85)'); tr.addColorStop(1, 'rgba(255,255,255,0)'); c.strokeStyle = tr; c.lineWidth = rad * 1.1; c.lineCap = 'round'; c.beginPath(); c.moveTo(tx, ty); c.lineTo(x, y); c.stroke();
    c.fillStyle = col2rad(c, x, y, rad * 2.4, col); c.beginPath(); c.arc(x, y, rad * 2.4, 0, 7); c.fill();
  }
  for (const k of [...shotFrom.keys()]) if (!g.shots.includes(k)) shotFrom.delete(k);
  c.restore();
  // engel canlari
  for (const id in objMeshes) { const o = objMeshes[id].userData.o; if (!o.alive || o.t === 'lock') continue; const p = project(new THREE.Vector3(-BW / 2 + (o.c0 + o.w) * S - S * 0.4, (g.H - o.r0 - o.h) * S + S * 0.4, S * 1.2).applyMatrix4(boardG.matrixWorld)); pill(c, p.x, p.y, String(o.hp), 15); }
  // sirttaki sayilar
  for (const [s, w] of want) {
    if (!s._pos) continue; const o = live.get(s); let hp;
    if (o && o.b.Head) { o.b.Head.getWorldPosition(tmpV); tmpV.y -= 0.12; tmpV.z += 0.35; hp = projectF(tmpV); } else hp = projectF(s._pos.clone().add(new THREE.Vector3(0, 1.2, 0.3)));
    const ppu = pxPerUnitF(s._pos); pill(c, hp.x, hp.y, String(s.ammo), Math.max(12, ppu * 0.36), w.scale);
  }
  // kuyrukta gorunmeyen fil sayisi
  g.queue.forEach((col, k) => { if (col.length > 4) { const p = projectF(new THREE.Vector3((k - 1.5) * LANE_DX + 0.7, 0.4, LANE_Z0 + 3.6 * LANE_DZ)); c.font = '700 16px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = '#2a1606'; c.fillStyle = '#fff'; c.strokeText('+' + (col.length - 4), p.x, p.y); c.fillText('+' + (col.length - 4), p.x, p.y); } });
  // yuva durumu ve hedef sayilari
  const free = g.bench.filter((s) => !s).length, py = (projectF(new THREE.Vector3(0, 0, BELT_Z + 1.1)).y + projectF(new THREE.Vector3(0, 0, PAD_Z - PAD_R)).y) / 2 - 2, lx = projectF(new THREE.Vector3(STACK.x + 0.85, 0, PAD_Z)).x + 4;
  c.font = '600 13px ' + FONT; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = free === 0 ? '#ff9a9a' : '#f6dfc0'; c.fillText('Yuva ' + free + '/' + g.bench.length, lx, py);
  const cnt = {}; for (let ci = 0; ci < g.pal.length; ci++) { const h = BZM.hitsNow(g, ci); if (h) cnt[ci] = h; }
  let xr = VW - 10; c.textAlign = 'right'; c.font = '700 13px ' + FONT; const yy = py;
  Object.keys(cnt).map(Number).sort((a, b) => cnt[a] - cnt[b]).forEach((ci) => { c.fillStyle = '#fff'; c.fillText('×' + cnt[ci], xr, yy); xr -= c.measureText('×' + cnt[ci]).width + 9; c.fillStyle = g.pal[ci]; c.strokeStyle = '#2e1806'; c.lineWidth = 1.5; c.beginPath(); c.arc(xr + 5, yy, 6, 0, 7); c.fill(); c.stroke(); xr -= 10; });
  // ipucu halkasi
  if (LV <= 3 && g.state === 'play' && idleT > 3 && !g.belt.length) { const bm = BZM.bestMove(g); if (bm) { const p = bm.from === 'q' ? lanePos(bm.k, 0) : padPos(bm.k), q = projectF(new THREE.Vector3(p.x, 0.9, p.z)), r = pxPerUnitF(new THREE.Vector3(p.x, 0, p.z)) * 1.0, a = 0.5 + 0.5 * Math.sin(g.t * 6); c.strokeStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * a) + ')'; c.lineWidth = 4; c.beginPath(); c.ellipse(q.x, q.y, r * 0.8 + a * 4, r + a * 4, 0, 0, 7); c.stroke(); } }
  // parcaciklar
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt; if (f.t >= f.life) { fx.splice(i, 1); continue; } const a = 1 - f.t / f.life;
    if (f.kind === 'leave') continue;
    if (f.kind === 'ring') { c.strokeStyle = f.c; c.globalAlpha = a; c.lineWidth = 3 * a + 0.5; c.beginPath(); c.arc(f.x, f.y, f.s + (1 - a) * 20, 0, 7); c.stroke(); c.globalAlpha = 1; continue; }
    if (f.kind === 'glow') { c.save(); c.globalCompositeOperation = 'lighter'; const r = f.s * (1.3 - 0.5 * a); c.globalAlpha = a; c.fillStyle = col2rad(c, f.x, f.y, r, f.c); c.beginPath(); c.arc(f.x, f.y, r, 0, 7); c.fill(); c.restore(); continue; }
    if (f.kind === 'combo') { const u = 1 - a, pp = u < 0.14 ? (() => { const v = u / 0.14 - 1; return 1 + 2.7 * v * v * v + 1.7 * v * v; })() : 1, sc = pp * (1 + 0.035 * Math.sin(u * 22)), cc = COMBO_COL[f.tier]; c.save(); c.globalAlpha = a < 0.22 ? a / 0.22 : 1; c.translate(f.x, f.y - u * 22); c.rotate(-0.07); c.scale(sc, sc); const fs = 34 + f.tier * 6; c.font = '700 ' + fs + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round'; c.lineWidth = 10; c.strokeStyle = '#2a0b3d'; c.strokeText(f.tx, 0, 3); c.strokeText(f.tx, 0, 0); const lg = c.createLinearGradient(0, -fs / 2, 0, fs / 2); lg.addColorStop(0, cc[0]); lg.addColorStop(1, cc[1]); c.fillStyle = lg; c.fillText(f.tx, 0, 0); c.restore(); continue; }
    f.vy += (f.g || 0) * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    c.save(); c.globalAlpha = a; c.translate(f.x, f.y); c.rotate(f.rot); c.fillStyle = f.c;
    if (f.shape === 'tri') { c.beginPath(); c.moveTo(0, -f.r); c.lineTo(f.r * 0.8, f.r * 0.6); c.lineTo(-f.r * 0.8, f.r * 0.6); c.closePath(); c.fill(); }
    else if (f.shape === 'ring') { c.strokeStyle = f.c; c.lineWidth = f.r * 0.5; c.beginPath(); c.ellipse(0, 0, f.r, f.r * 0.6, 0, 0, 7); c.stroke(); }
    else if (f.shape === 'star') { c.beginPath(); for (let q = 0; q < 5; q++) { const a1 = q * 1.2566 - 1.57, a2 = a1 + 0.628; c.lineTo(Math.cos(a1) * f.r, Math.sin(a1) * f.r); c.lineTo(Math.cos(a2) * f.r * 0.45, Math.sin(a2) * f.r * 0.45); } c.closePath(); c.fill(); }
    else if (f.shape === 'dot') { c.beginPath(); c.arc(0, 0, f.r, 0, 7); c.fill(); }
    else c.fillRect(-f.r / 2, -f.r / 3, f.r, f.r * 0.66);
    c.restore();
  }
  // ucan anahtar
  for (const fl of g.flying) { const k = fl.key, o = g.objs[k.lock]; if (!o) continue; const B = g.B, a = project(new THREE.Vector3(-BW / 2 + (k.bc * B + B / 2) * S, (g.H - k.br * B - B / 2) * S, S).applyMatrix4(boardG.matrixWorld)), b = project(objCenter(o)), e = Math.min(1, (g.t - fl.t0) / (fl.t1 - fl.t0)), x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 60; c.save(); c.shadowColor = 'rgba(255,230,120,.9)'; c.shadowBlur = 16; keyIcon2d(c, x, y, 34, KEYC[o.lid % 3], -0.6 + e * 6.28); c.restore(); }
  c.restore();
}
function pill(c, x, y, t, h, sc) { if (sc != null) { if (sc < 0.05) return; h *= sc; } const w = Math.max(h, h * 0.55 * t.length + h * 0.5); c.fillStyle = '#fff'; c.strokeStyle = '#20140a'; c.lineWidth = Math.max(1.5, h * 0.12); c.beginPath(); c.roundRect(x - w / 2, y - h / 2, w, h, h / 2); c.fill(); c.stroke(); c.fillStyle = '#20140a'; c.font = '700 ' + Math.round(h * 0.78) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, x, y + h * 0.05); }
function keyIcon2d(c, x, y, s, kc, rot) { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = kc; c.strokeStyle = '#2a1a08'; c.lineWidth = 2; c.beginPath(); c.arc(-s * 0.22, 0, s * 0.18, 0, 7); c.fill(); c.stroke(); c.fillRect(-s * 0.08, -s * 0.06, s * 0.46, s * 0.12); c.strokeRect(-s * 0.08, -s * 0.06, s * 0.46, s * 0.12); c.restore(); }

// ---------- dongu ----------
let last = 0, DT = 0.016;
function renderViews() {
  ren.setScissorTest(true);
  ren.setClearColor(0x1c1008, 1); ren.setViewport(0, 0, VW, VH); ren.setScissor(0, 0, VW, VH); ren.clear();
  const vp = (r) => [r.x, VH - r.y - r.h, r.w, r.h];
  ren.setViewport(...vp(VPB)); ren.setScissor(...vp(VPB)); ren.render(scene, cam);
  ren.setViewport(...vp(VPF)); ren.setScissor(...vp(VPF)); ren.render(scene, camF);
  ren.setScissorTest(false);
}
// yavas cihazda kaliteyi kendiliginden dusur (once cozunurluk, sonra golgeler)
let QL = 0, qAcc = 0, qN = 0;
function adaptQuality(dt) {
  if (TEST || QL >= 2 || paused) return;
  qAcc += dt; qN++;
  if (qN < 90) return;
  const avg = qAcc / qN; qAcc = 0; qN = 0;
  if (avg > 1 / 40) { QL++; if (QL === 1) { DPR = Math.min(1.25, DPR); ren.setPixelRatio(DPR); } else { sun.castShadow = false; ren.shadowMap.enabled = false; scene.traverse((o) => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); } }); ren.setPixelRatio(1); DPR = 1; } }
}
function frame(ts, noRender) {
  const dt = Math.min(0.05, Math.max(0, (ts - (last || ts)) / 1000)); last = ts; DT = dt || 0.016;
  adaptQuality(dt);
  if (g && !paused) {
    BZM.step(g, dt); idleT += dt; handleEvents();
    if (g.state === 'win' && !winShown && g.t - g.endT > 1.0) { winShown = true; showWin(); }
    if (g.state === 'lose' && !loseShown && g.t - g.endT > 0.8) { loseShown = true; showLose(); }
  }
  if (toastT && performance.now() > toastT) { $('toast').classList.remove('on'); toastT = 0; }
  if (g) {
    TX.belt.offset.x = -(g.t * g.speed * S) / (14.4 / 6);
    if (cubesDirty) updateCubes();
    animObjs(); placeTrays();
    const want = placeShooters(dt);
    if (!noRender) { renderViews(); drawOverlay(dt, want); }
    else for (let i = fx.length - 1; i >= 0; i--) { fx[i].t += dt; if (fx[i].t >= fx[i].life) fx.splice(i, 1); }
  }
  if (!TEST) requestAnimationFrame(frame);
}
const TEST = /[?&]test=1/.test(location.search);

// ---------- dugmeler ----------
bindPress($('top'));
$('bHome').onclick = () => { location.href = '../'; };
$('bPrev').onclick = () => { if (LV > 1) start(LV - 1); };
$('bNext').onclick = () => { if (LV < 200) start(LV + 1); };
$('bRe').onclick = () => { start(LV); };
$('bSet').onclick = () => { showSettings(); };
addEventListener('resize', layout);
// test: ?test=1 ile dongu durur, BZ.run(sn) ile zaman ilerletilir (yavas tarayicida ekran goruntusu icin)
window.BZ = { get g() { return g; }, start, M: BZM, pause(v) { paused = !!v; }, cam, scene, POFI,
  snap() { const c = document.createElement('canvas'); c.width = glc.width; c.height = glc.height; const x = c.getContext('2d'); x.drawImage(glc, 0, 0); x.drawImage(ov, 0, 0, c.width, c.height); return c.toDataURL('image/png'); },
  run(sec, bot) { let t = last || 0; const n = Math.round(sec * 30); for (let i = 0; i < n; i++) { t += 1000 / 30; if (bot && i % 12 === 0 && g.state === 'play') { const b = BZM.bestMove(g); if (b) BZM.launch(g, b.from, b.k); else if (!g.belt.length && !g.shots.length) { const o = g.queue.findIndex((c) => c.length); if (o >= 0) BZM.launch(g, 'q', o); } } frame(t, i < n - 1); } } };
start(qL ? +qL[1] : SV.L || 1);
if (!TEST) requestAnimationFrame(frame); else frame(0);
