// BLOKPOP Kamyon - 3B gorunum (three.js r160). Kurallar motor.js'te (window.KMM); burasi cizim, ses, dokunma ve arayuz.
// Sahne: ortada resim kupleri (tahta), etrafinda kare bant, altta park yerleri ve kamyon kuyruklari.
// Kamyon: Tripo3D fil kamyonet (kamyon.glb, tools/kamyon-model ile sadelestirildi); dokunun alfa kanali govde maskesi,
// shader ile kamyonun rengine boyanir. Tekerlekler ayri dugum (yerel Z ekseninde doner). Modelin onu -X.
import * as THREE from '../three.module.min.js';
import { GLTFLoader } from '../GLTFLoader.js';

const K = window.KMM;
K.setLib(window.BZ_IZGARA);
const $ = (id) => document.getElementById(id);
const Q0 = new URLSearchParams(location.search);
const TEST = Q0.get('test') === '1';
const VER = '3.00';

// ---------- kayit ----------
const SKEY = 'blokpop_kamyon_v1', MAINKEY = 'blokpop_save_v1';
let SV = { L: 1, max: 1, stars: {}, tips: {}, mute: false, vib: 2, pend: 0 };
try { const d = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (d && typeof d === 'object') SV = Object.assign(SV, d); } catch (e) {}
const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(SV)); } catch (e) {} };
// coin'ler ana oyunla ortak: ana kayit (blokpop_save_v1) varsa oraya yazilir, yoksa burada bekler
function mainSave() { try { const d = JSON.parse(localStorage.getItem(MAINKEY) || 'null'); return d && typeof d === 'object' && d.v === 1 ? d : null; } catch (e) { return null; } }
function coins() { const m = mainSave(); return (m ? Math.max(0, m.coins | 0) : 0) + (SV.pend | 0); }
function addCoins(n) {
  const m = mainSave();
  if (m) { m.coins = Math.max(0, (m.coins | 0) + (SV.pend | 0) + n); SV.pend = 0; try { localStorage.setItem(MAINKEY, JSON.stringify(m)); } catch (e) { SV.pend += n; } }
  else SV.pend = Math.max(0, (SV.pend | 0) + n);
  save(); $('coinN').textContent = coins();
}
function spendCoins(n) { if (coins() < n) return false; addCoins(-n); return true; }

// ---------- ses (ana oyunun ses motoru ile ayni yapi) ----------
let AC = null, master = null, wet = null, noiseBuf = null;
const last = {};
const thr = (k, ms) => { const n = performance.now(); if (n - (last[k] || 0) < ms) return true; last[k] = n; return false; };
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') { try { AC.resume(); } catch (e) {} } return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return; AC = new C();
    master = AC.createGain(); master.gain.value = 0.7; const comp = AC.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2; master.connect(comp); comp.connect(AC.destination);
    wet = AC.createGain(); wet.gain.value = 0.2; const dl = AC.createDelay(0.5); dl.delayTime.value = 0.13; const fb = AC.createGain(); fb.gain.value = 0.3; wet.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(comp);
    const len = AC.sampleRate; noiseBuf = AC.createBuffer(1, len, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function tone(f, d, type, vol, delay, slide, send) { if (!AC || SV.mute) return; try { const t0 = AC.currentTime + (delay || 0), o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + d); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); o.connect(g); g.connect(master); if (send && wet) g.connect(wet); o.start(t0); o.stop(t0 + d + 0.03); } catch (e) {} }
function noise(d, vol, delay, type, f0, f1, send) { if (!AC || SV.mute || !noiseBuf) return; try { const t0 = AC.currentTime + (delay || 0), s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain(); s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.setValueAtTime(f0 || 1000, t0); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + d); f.Q.value = 1.2; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d); s.connect(f); f.connect(g); g.connect(master); if (send && wet) g.connect(wet); s.start(t0); s.stop(t0 + d + 0.03); } catch (e) {} }
const SFX = {
  tap() { if (thr('tap', 45)) return; tone(780, 0.075, 'sine', 0.1, 0, 520); tone(1250, 0.05, 'sine', 0.035, 0.012, 950); },
  hop() { tone(320, 0.12, 'sine', 0.22, 0, 760); noise(0.05, 0.12, 0, 'bandpass', 1800, 900); },
  land() { tone(150, 0.07, 'sine', 0.28, 0, 90); noise(0.05, 0.12, 0, 'lowpass', 900, 250); },
  // yutma: hortum vakumu + tok "glup"
  slurp() { if (thr('slurp', 50)) return; noise(0.09, 0.07, 0, 'bandpass', 900, 2600); },
  glup(k) { if (thr('glup', 38)) return; const b = 170 + (k % 6) * 14; tone(b, 0.13, 'sine', 0.5, 0, b * 2.4); tone(b * 0.6, 0.09, 'sine', 0.3, 0.01, b * 0.4); noise(0.05, 0.12, 0, 'lowpass', 900, 250); tone(b * 4, 0.04, 'triangle', 0.05, 0.06, b * 5); },
  ice() { tone(2400, 0.07, 'triangle', 0.1, 0, 3100); noise(0.1, 0.12, 0, 'highpass', 4000, 6500); },
  horn() { [[392, 0], [494, 0.02], [392, 0.2], [494, 0.22]].forEach(([f, d]) => { tone(f, 0.16, 'square', 0.07, d); tone(f * 1.005, 0.16, 'sawtooth', 0.05, d); }); },
  engine() { noise(0.8, 0.22, 0, 'lowpass', 300, 1200); tone(70, 0.6, 'sawtooth', 0.08, 0, 160); },
  coin() { if (thr('coin', 60)) return; tone(1568, 0.07, 'square', 0.05); tone(2093, 0.12, 'square', 0.05, 0.06); },
  park() { tone(500, 0.1, 'sine', 0.2); tone(375, 0.14, 'sine', 0.2, 0.08); },
  deny() { tone(120, 0.12, 'sine', 0.3, 0, 70); noise(0.07, 0.14, 0, 'lowpass', 600, 200); },
  unlock() { [1047, 1319, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.12, i * 0.05, 0, true)); noise(0.1, 0.1, 0, 'highpass', 4000, 6000); },
  combo(t) { const b = [523, 659, 784, 1047][t] || 523; [0, 4, 7, 12].forEach((s, i) => tone(b * Math.pow(2, s / 12), 0.22, 'triangle', 0.14, i * 0.05, 0, true)); },
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.34, 'triangle', 0.22, i * 0.09, 0, true); tone(f / 2, 0.3, 'sine', 0.1, i * 0.09); }); [523, 659, 784].forEach((f) => tone(f, 0.9, 'sine', 0.1, 0.48)); noise(0.5, 0.06, 0.4, 'highpass', 5000, 9000, true); },
  lose() { tone(392, 0.7, 'sawtooth', 0.12, 0, 130); tone(196, 0.8, 'sine', 0.18, 0, 62); noise(0.4, 0.07, 0, 'lowpass', 1200, 200); }
};
const VIBK = [0, 0.6, 1];
function vib(p) { const k = VIBK[SV.vib | 0] || 0; if (!k) return; if (typeof p === 'number') { if (thr('vib', 45)) return; p = Math.max(4, Math.round(p * k)); } else p = p.map((v, i) => (i % 2 ? v : Math.max(4, Math.round(v * k)))); try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

// ---------- 3B kurulum ----------
const glc = $('gl');
let ren;
try { ren = new THREE.WebGLRenderer({ canvas: glc, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: TEST }); }
catch (e) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:600 18px sans-serif;text-align:center;padding:30px;background:#235">Bu cihazda 3B çizim açılamadı.</div>'); throw e; }
ren.outputColorSpace = THREE.SRGBColorSpace;
ren.toneMapping = THREE.NoToneMapping;
ren.shadowMap.enabled = true; ren.shadowMap.type = THREE.PCFSoftShadowMap;
let PR = Math.min(2, window.devicePixelRatio || 1); ren.setPixelRatio(PR);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#c9f0ff', 70, 150);
const cam = new THREE.PerspectiveCamera(36, 1, 0.5, 400);

(function env() { // parlak yansima icin basit ortam
  const es = new THREE.Scene();
  const c = document.createElement('canvas'); c.width = 16; c.height = 256; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9fd2ff'); gr.addColorStop(0.5, '#ffffff'); gr.addColorStop(0.56, '#a6dc86'); gr.addColorStop(1, '#5d9a40'); x.fillStyle = gr; x.fillRect(0, 0, 16, 256);
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide })));
  const pm = new THREE.MeshBasicMaterial({ color: 0xffffff }); pm.color.multiplyScalar(2.4);
  [[-12, 16, 8], [10, 14, 14], [0, 22, -6]].forEach(([a, b, d]) => { const p = new THREE.Mesh(new THREE.PlaneGeometry(10, 6), pm); p.position.set(a, b, d); p.lookAt(0, 0, 0); es.add(p); });
  const pmrem = new THREE.PMREMGenerator(ren); scene.environment = pmrem.fromScene(es, 0.03).texture; pmrem.dispose();
})();
scene.add(new THREE.HemisphereLight(0xffffff, 0x7a9a60, 0.85));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.55); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xd6e6ff, 0.35); scene.add(fill);

// ---------- dokular ----------
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
function rr(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
const TX = {
  grass: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#8fd16a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#9ad975'; x.fillRect(0, 0, w / 2, h / 2); x.fillRect(w / 2, h / 2, w / 2, h / 2);
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,110,30'},${0.05 + Math.random() * 0.07})`; const px = Math.random() * w, py = Math.random() * h; x.fillRect(px, py, 2, 5); }
  }, [40, 40]),
  belt: canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#3b4252'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let k = 0; k < 4; k++) x.fillRect(k * 64, 0, 4, h);
    x.strokeStyle = '#ffd23f'; x.lineWidth = 12; x.lineCap = 'round'; x.lineJoin = 'round';
    for (let k = 0; k < 2; k++) { const cx = 64 + k * 128; x.beginPath(); x.moveTo(cx - 18, 34); x.lineTo(cx + 16, 64); x.lineTo(cx - 18, 94); x.stroke(); }
  }),
  plate: canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#8b94a6'; x.fillRect(0, 0, w, h); x.fillStyle = '#a7b0c0'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.beginPath(); x.arc(16 + i * 32, 16 + j * 32, 5, 0, 7); x.fill(); } }),
  asphalt: canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#5b6372'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.08})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }, [1, 1]),
  pad: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#5b6372'; rr(x, 6, 6, w - 12, h - 12, 34); x.fill();
    x.setLineDash([22, 14]); x.lineWidth = 10; x.strokeStyle = '#ffffff'; rr(x, 18, 18, w - 36, h - 36, 26); x.stroke(); x.setLineDash([]);
    x.fillStyle = 'rgba(255,255,255,.18)'; x.font = '700 120px Fredoka,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('P', w / 2, h / 2 + 8);
  }),
  wood: canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#f2b866'; x.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#eaa955' : '#f6c27a'; x.fillRect(0, k * 64, w, 64); x.fillStyle = 'rgba(120,60,10,.35)'; x.fillRect(0, k * 64, w, 3); }
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(150,80,20,${0.08 + Math.random() * 0.1})`; x.lineWidth = 2; const yy = Math.random() * h; x.beginPath(); x.moveTo(0, yy); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, yy + Math.sin(xx * 0.03 + k) * 3); x.stroke(); }
  }, [3, 3]),
  frost: canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { const v = 220 + Math.random() * 35; x.fillStyle = `rgba(${v - 20},${v},255,.4)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.strokeStyle = 'rgba(170,205,240,.7)'; x.lineWidth = 2; for (let k = 0; k < 5; k++) { let px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (Math.random() - 0.5) * 50; py += (Math.random() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); }
  }),
  soft: canvasTex(64, 64, (x, w) => { const gr = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, w); }),
  shadow: canvasTex(64, 64, (x, w) => { const gr = x.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(0.6, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, w); })
};
TX.belt.wrapS = TX.belt.wrapT = THREE.RepeatWrapping;
const MAT = {
  grass: new THREE.MeshStandardMaterial({ map: TX.grass, roughness: 1 }),
  belt: new THREE.MeshStandardMaterial({ map: TX.belt, roughness: 0.7 }),
  plate: new THREE.MeshStandardMaterial({ map: TX.plate, metalness: 0.6, roughness: 0.4 }),
  rail: new THREE.MeshStandardMaterial({ color: '#ffcf3a', metalness: 0.2, roughness: 0.4 }),
  railDark: new THREE.MeshStandardMaterial({ color: '#2c3240', roughness: 0.6 }),
  asphalt: new THREE.MeshStandardMaterial({ map: TX.asphalt, roughness: 0.95 }),
  pad: new THREE.MeshStandardMaterial({ map: TX.pad, roughness: 0.9, transparent: true }),
  line: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  wood: new THREE.MeshStandardMaterial({ map: TX.wood, roughness: 0.7 }),
  rim: new THREE.MeshStandardMaterial({ color: '#b86b2a', roughness: 0.6 }),
  cube: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.3, metalness: 0, envMapIntensity: 0.8 }),
  frost: new THREE.MeshStandardMaterial({ color: '#eaf8ff', map: TX.frost, roughness: 0.25, transparent: true, opacity: 0.72, envMapIntensity: 1.2 }),
  shadow: new THREE.MeshBasicMaterial({ map: TX.shadow, transparent: true, depthWrite: false })
};
const colMats = {};
const colMat = (hex) => colMats[hex] || (colMats[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.3, envMapIntensity: 0.8 }));

// yuvarlak kenarli kup (ust yuzu bombeli): yukseklik y ekseninde
function cubeGeo(size, height) {
  const bev = size * 0.13, h = size / 2 - bev * 0.95, r = size * 0.12, sh = new THREE.Shape();
  sh.moveTo(-h + r, -h); sh.lineTo(h - r, -h); sh.quadraticCurveTo(h, -h, h, -h + r); sh.lineTo(h, h - r); sh.quadraticCurveTo(h, h, h - r, h); sh.lineTo(-h + r, h); sh.quadraticCurveTo(-h, h, -h, h - r); sh.lineTo(-h, -h + r); sh.quadraticCurveTo(-h, -h, -h + r, -h);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.01, height - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.95, bevelSegments: 2, curveSegments: 3 });
  geo.translate(0, 0, -(height - 2 * bev) / 2); geo.rotateX(-Math.PI / 2); geo.computeVertexNormals();
  return geo;
}

// ---------- kamyon modeli ----------
let TPL = null;   // { scene, mat }
const TRUNK = new THREE.Vector3(-0.5, 0.283, 0), BEDY = 0.205;
function tintMaterial(base) {
  const m = base.clone();
  m.userData.tint = { value: new THREE.Color('#3d9bff') }; m.userData.grey = { value: 0 }; m.userData.glow = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = m.userData.tint; sh.uniforms.uGrey = m.userData.grey; sh.uniforms.uGlow = m.userData.glow;
    sh.fragmentShader = 'uniform vec3 uTint;\nuniform float uGrey;\nuniform float uGlow;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', `vec4 texel = texture2D( map, vMapUv );
        float lum = dot( texel.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
        vec3 body = uTint * clamp( lum / 0.226, 0.3, 1.12 );
        vec3 col = mix( texel.rgb, body, texel.a );
        col = mix( col, vec3( dot( col, vec3( 0.3, 0.59, 0.11 ) ) ) * 0.85 + 0.06, uGrey );
        diffuseColor.rgb *= col;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += uTint * uGlow * 0.6;');
  };
  m.customProgramCacheKey = () => 'kmTint';
  return m;
}

// ---------- yerlesim ----------
let g = null, lv = null, LVN = 1, u = 1, TS = 1.45;
const BASE = 0.32, BELT_Y = 0.16, HT = 0.9, HS = 0.53;
const L = {};  // yerlesim olculeri (seviyeye gore)
const levelG = new THREE.Group(); scene.add(levelG);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), MAT.grass); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
let tallMesh = null, shortMesh = null, frostMesh = null, beltTexs = [];
const cellRef = [];   // i -> {m, k}
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();
const cellPos = (i, out) => { const c = i % g.W, r = Math.floor(i / g.W), x = g.cells[i]; return (out || new THREE.Vector3()).set(-g.W / 2 + c + 0.5, BASE + (x.bg ? HS : HT) * 0.5, -g.H / 2 + r + 0.5); };

function disposeGroup(grp) { while (grp.children.length) { const o = grp.children.pop(); o.traverse((x) => { if (x.geometry && !x.userData.keepGeo) x.geometry.dispose(); }); } }
function buildLevel() {
  disposeGroup(levelG); beltTexs.forEach((t) => t.dispose()); beltTexs = [];
  const W = g.W, H = g.H, G = g.G; u = G.u; TS = 2.4 * u;
  L.A = G.A; L.B = G.B; L.bw = 2.7 * u;
  // tahta kaidesi
  const base = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, BASE, H + 0.7), [MAT.rim, MAT.rim, MAT.wood, MAT.rim, MAT.rim, MAT.rim]); base.position.y = BASE / 2; base.castShadow = true; base.receiveShadow = true; levelG.add(base);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(W + 1.0, 0.12, H + 1.0), MAT.rim); lip.position.y = 0.06; levelG.add(lip);
  // kupler
  const nT = g.cells.filter((x) => !x.bg).length, nS = g.cells.length - nT;
  tallMesh = new THREE.InstancedMesh(cubeGeo(0.92, HT), MAT.cube, Math.max(1, nT)); shortMesh = new THREE.InstancedMesh(cubeGeo(0.92, HS), MAT.cube, Math.max(1, nS));
  [tallMesh, shortMesh].forEach((m) => { m.castShadow = true; m.receiveShadow = true; levelG.add(m); });
  let kt = 0, ks = 0; cellRef.length = 0;
  const ice = [];
  g.cells.forEach((x, i) => {
    const m = x.bg ? shortMesh : tallMesh, k = x.bg ? ks++ : kt++;
    cellRef[i] = { m, k };
    cellPos(i, _v); _m4.compose(_v, _q.identity(), _s.set(1, 1, 1)); m.setMatrixAt(k, _m4); m.setColorAt(k, _c.set(g.pal[x.c]));
    if (x.hp > 1) ice.push(i);
  });
  [tallMesh, shortMesh].forEach((m) => { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; });
  frostMesh = null;
  if (ice.length) {
    frostMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), MAT.frost, ice.length);
    ice.forEach((i, k) => { cellRef[i].f = k; const h = (g.cells[i].bg ? HS : HT) + 0.1; cellPos(i, _v); _m4.compose(_v, _q.identity(), _s.set(0.98, h, 0.98)); frostMesh.setMatrixAt(k, _m4); });
    frostMesh.instanceMatrix.needsUpdate = true; levelG.add(frostMesh);
  }
  // bant (4 serit + kose plakalari + kenar raylari)
  const A = L.A, B = L.B, bw = L.bw;
  const strip = (len, x, z, rotY) => {
    const t = TX.belt.clone(); t.needsUpdate = true; t.repeat.set(len / (2 * u), 1); beltTexs.push(t);
    const mat = MAT.belt.clone(); mat.map = t;
    const grp = new THREE.Group(); grp.position.set(x, BELT_Y, z); grp.rotation.y = rotY;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, bw), mat); p.rotation.x = -Math.PI / 2; p.receiveShadow = true; grp.add(p);
    const body = new THREE.Mesh(new THREE.BoxGeometry(len, BELT_Y, bw), MAT.railDark); body.position.y = -BELT_Y / 2 - 0.002; grp.add(body);
    [-1, 1].forEach((d) => { const r = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, 0.14), MAT.rail); r.position.set(0, 0.03, d * (bw / 2 + 0.05)); r.castShadow = true; grp.add(r); });
    levelG.add(grp);
  };
  strip(2 * A - bw, 0, B, 0); strip(2 * B - bw, A, 0, Math.PI / 2); strip(2 * A - bw, 0, -B, Math.PI); strip(2 * B - bw, -A, 0, -Math.PI / 2);
  [[-A, B], [A, B], [A, -B], [-A, -B]].forEach(([x, z]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(bw, BELT_Y + 0.01, bw), [MAT.railDark, MAT.railDark, MAT.plate, MAT.railDark, MAT.railDark, MAT.railDark]); p.position.set(x, BELT_Y / 2, z); p.receiveShadow = true; levelG.add(p);
  });
  // giris kapisi (sol alt kose): iki direk + tabela
  {
    const gx = -A, gz = B, post = new THREE.CylinderGeometry(0.09 * u, 0.09 * u, 1.5 * u, 10);
    [-1, 1].forEach((d) => { const p = new THREE.Mesh(post, MAT.rail); p.position.set(gx - bw / 2 - 0.15, 0.75 * u, gz + d * bw * 0.55); p.castShadow = true; levelG.add(p); });
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.16 * u, 0.42 * u, bw * 1.25), new THREE.MeshStandardMaterial({ map: canvasTex(256, 96, (x, w, h) => { x.fillStyle = '#ff7a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.font = '700 58px Fredoka,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('GİRİŞ', w / 2, h / 2 + 3); }) }));
    sign.position.set(gx - bw / 2 - 0.15, 1.5 * u, gz); levelG.add(sign);
  }
  // park yerleri ve kuyruklar
  layoutQueues();
  buildPads();
  const lanes = g.lanes.length;
  const laneLen = 3 * L.ldz + 1.2 * u;
  for (let l = 0; l < lanes; l++) {
    const x = laneX(l), lane = new THREE.Mesh(new THREE.PlaneGeometry(L.ldx * 0.86, laneLen), MAT.asphalt); lane.rotation.x = -Math.PI / 2; lane.position.set(x, 0.015, L.lz0 - 0.9 * u + laneLen / 2); lane.receiveShadow = true; levelG.add(lane);
    for (let k = 0; k < 3; k++) { const ar = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * u, 0.6 * u), MAT.line); ar.rotation.x = -Math.PI / 2; ar.position.set(x, 0.02, L.lz0 - 0.95 * u - k * 0.0); if (k) break; levelG.add(ar); }
  }
  placeLights(); fitCamera();
}
function layoutQueues() {
  const n = g.lanes.length;
  L.pz = L.B + 3.35 * u;                 // park yeri sirasi
  L.pdx = 3.0 * u;
  L.lz0 = L.pz + 3.5 * u; L.ldz = 2.8 * u; L.ldx = Math.min(4.0 * u, (2 * L.A + 1.5 * u) / n);
  L.lx0 = -((n - 1) * L.ldx) / 2;
  L.stage = new THREE.Vector3(-L.A - 0.2 * u, BELT_Y, L.B + 2.3 * u);
}
const laneX = (l) => L.lx0 + l * L.ldx;
const lanePos = (l, k, out) => (out || new THREE.Vector3()).set(laneX(l), 0, L.lz0 + k * L.ldz);
function parkPos(k, out) { const n = g.park.length, x0 = -((n - 1) * L.pdx) / 2 + 0.6 * u; return (out || new THREE.Vector3()).set(x0 + k * L.pdx, 0, L.pz); }
let padG = null;
function buildPads() {
  if (padG) { levelG.remove(padG); padG.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); }
  padG = new THREE.Group(); levelG.add(padG);
  for (let k = 0; k < g.park.length; k++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.75 * u, 2.75 * u), MAT.pad); p.rotation.x = -Math.PI / 2; parkPos(k, p.position); p.position.y = 0.018; p.receiveShadow = true; padG.add(p); }
}
function placeLights() {
  const R = Math.max(L.A, L.B) + 4;
  sun.position.set(-0.45 * R, 1.6 * R, 0.8 * R); sun.target.position.set(0, 0, 0.12 * R);
  const sc = sun.shadow.camera; sc.left = -R * 1.05; sc.right = R * 1.05; sc.top = R * 1.25; sc.bottom = -R * 1.25; sc.near = 1; sc.far = R * 5; sc.updateProjectionMatrix();
  fill.position.set(R, 0.8 * R, R);
}
// kamera: icerigin tamami ekrana sigsin (ust panel ve alt guvenli alan payi ile)
function fitCamera() {
  if (!g) return;
  const w = innerWidth, h = innerHeight; cam.aspect = w / h; cam.updateProjectionMatrix();
  const pitch = 62 * Math.PI / 180;
  const zMin = -L.B - 1.5 * u, zMax = L.lz0 + 2.0 * L.ldz + 1.3 * u, xMax = L.A + 1.45 * u;
  const pts = [];
  [-xMax, xMax].forEach((x) => [zMin, zMax].forEach((z) => [0, 1.6].forEach((y) => pts.push(new THREE.Vector3(x, y, z)))));
  const zc = (zMin + zMax) / 2;
  const topPad = (64 + 30) / h * 2, botPad = 14 / h * 2;
  const tryD = (d, off) => {
    cam.position.set(0, Math.sin(pitch) * d, zc + off + Math.cos(pitch) * d); cam.lookAt(0, 0, zc + off); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let ok = true, minY = 9, maxY = -9;
    for (const p of pts) { const q = p.clone().project(cam); if (Math.abs(q.x) > 0.97) ok = false; minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y); }
    return { ok: ok && maxY < 1 - topPad && minY > -1 + botPad, minY, maxY };
  };
  let off = 0;
  for (let it = 0; it < 3; it++) {
    let lo = 5, hi = 200;
    for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (tryD(mid, off).ok) hi = mid; else lo = mid; }
    const r = tryD(hi, off); L.camD = hi;
    // ust/alt bosluklari esitle
    const space = ((1 - topPad) - r.maxY) - (r.minY - (-1 + botPad));
    off += space * 0.25 * hi * 0.35;
  }
  tryD(L.camD * 1.01, off);
}

// ---------- kamyon gorunumleri ----------
const views = new Map();   // truck id -> view
const LABEL_W = 192, LABEL_H = 96;
function drawLabel(v) {
  const t = v.t, x = v.lctx, w = LABEL_W, h = LABEL_H;
  x.clearRect(0, 0, w, h);
  const locked = g.locked(t);
  const col = t.kind === 'joker' ? '#ffffff' : g.pal[t.c];
  x.fillStyle = locked ? '#7a889c' : '#22314d'; rr(x, 8, 8, w - 16, h - 16, 30); x.fill();
  if (t.kind === 'joker' && !locked) { const gr = x.createLinearGradient(0, 0, w, 0); ['#ff4d4d', '#ffb000', '#43c94f', '#3d9bff', '#9b5cff'].forEach((c, i) => gr.addColorStop(i / 4, c)); x.fillStyle = gr; } else x.fillStyle = locked ? '#c9d2de' : col;
  rr(x, 15, 15, w - 30, h - 30, 24); x.fill();
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  let txt = locked ? '🔒' + (t.lockAt - g.departed) : String(t.cap - t.load);
  x.font = '700 54px Fredoka,sans-serif'; x.lineWidth = 9; x.strokeStyle = '#22314d'; x.strokeText(txt, w / 2, h / 2 + 3); x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 3);
  if (!locked && t.kind !== 'n') {
    const tag = t.kind === 'big' ? 'XL' : t.kind === 'dbl' ? 'x2' : '★';
    x.font = '700 30px Fredoka,sans-serif'; x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(w - 26, 26, 22, 0, 7); x.fill(); x.lineWidth = 4; x.strokeStyle = '#22314d'; x.stroke();
    x.fillStyle = '#22314d'; x.fillText(tag, w - 26, 28);
  }
  v.ltex.needsUpdate = true;
}
function makeView(t) {
  const root = new THREE.Group(), pivot = new THREE.Group(), model = TPL.scene.clone(true);
  model.rotation.y = -Math.PI / 2;   // modelin onu -X -> grubun -Z'si
  const mat = tintMaterial(TPL.mat);
  let body = null; const wheels = [];
  model.traverse((o) => { if (o.isMesh) { o.material = mat; o.castShadow = !lowQ && o.name === 'govde'; o.receiveShadow = false; o.geometry.userData.keepGeo = true; o.userData.keepGeo = true; } if (o.name === 'govde') body = o; if (/^teker/.test(o.name)) wheels.push(o); });
  const sc = TS * (t.kind === 'big' ? 1.22 : 1);
  model.scale.setScalar(sc);
  pivot.add(model); root.add(pivot);
  // kasa yukleri (modelin icinde, kasanin tabaninda)
  const cap = Math.max(1, t.cap), cargo = new THREE.InstancedMesh(CARGO_GEO, MAT.cube, cap); cargo.count = 0; cargo.castShadow = false; cargo.userData.keepGeo = true;
  model.add(cargo);
  // golge, etiket
  const sh = new THREE.Mesh(SHADOW_GEO, MAT.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.02; sh.scale.setScalar(sc * 1.25); sh.userData.keepGeo = true; root.add(sh);
  const lc = document.createElement('canvas'); lc.width = LABEL_W; lc.height = LABEL_H;
  const ltex = new THREE.CanvasTexture(lc); ltex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: ltex, depthTest: false, transparent: true }));
  label.scale.set(1.6 * u, 0.8 * u, 1); label.position.y = 0.95 * sc; label.renderOrder = 10; root.add(label);
  // dokunma alani (gorunmez)
  const hit = new THREE.Mesh(HIT_GEO, HIT_MAT); hit.scale.setScalar(u); hit.position.y = 0.6 * u; hit.userData.keepGeo = true; root.add(hit);
  const v = { t, root, pivot, model, body, wheels, mat, cargo, label, ltex, lctx: lc.getContext('2d'), hit, sc, state: 'lane', yaw: 0, pos: root.position, hop: null, pops: [], bounce: 0, sink: 0, spin: 0, glow: 0, alive: true, shake: 0, lockShown: g.locked(t) };
  hit.userData.view = v;
  setTint(v); drawLabel(v);
  levelG.add(root); views.set(t.id, v);
  return v;
}
const CARGO_GEO = cubeGeo(0.078, 0.07); CARGO_GEO.userData.keepGeo = true;
const SHADOW_GEO = new THREE.PlaneGeometry(1.0, 0.8);
const HIT_GEO = new THREE.BoxGeometry(2.6, 1.8, 2.6), HIT_MAT = new THREE.MeshBasicMaterial({ visible: false });
function setTint(v) { if (v.t.kind === 'joker') return; v.mat.userData.tint.value.set(g.pal[v.t.c]); v.mat.userData.grey.value = g.locked(v.t) ? 1 : 0; }
function cargoSlot(k, out) {
  const layer = Math.floor(k / 20), w = k % 20, ix = w % 4, iz = Math.floor(w / 4);
  return out.set(0.065 + ix * 0.085, BEDY + 0.04 + layer * 0.074, -0.17 + iz * 0.085);
}
function addCargo(v, colHex) {
  const k = v.cargo.count; if (k >= v.cargo.instanceMatrix.count) return;
  v.cargo.count = k + 1;
  cargoSlot(k, _v); _m4.compose(_v, _q.identity(), _s.set(0.01, 0.01, 0.01)); v.cargo.setMatrixAt(k, _m4); v.cargo.setColorAt(k, _c.set(colHex));
  v.cargo.instanceMatrix.needsUpdate = true; if (v.cargo.instanceColor) v.cargo.instanceColor.needsUpdate = true;
  v.pops.push({ k, t: 0 });
}
const yawFromSide = (side) => side * Math.PI / 2;   // 0 alt (onu -z), 1 sag (-x), 2 ust (+z), 3 sol (+x)
function beltPose(s, out) {
  const G = g.G, p = K.posAt(G, Math.min(s, G.L - 0.001));
  const cs = [2 * G.A, 2 * G.A + 2 * G.B, 4 * G.A + 2 * G.B, G.L], w = 0.7 * u;
  let f = 0; for (const c of cs) { const tt = Math.max(0, Math.min(1, (s - (c - w)) / (2 * w))); f += tt * tt * (3 - 2 * tt); }
  out.x = p.x; out.z = p.z; out.yaw = f * Math.PI / 2; out.side = p.side;
  return out;
}
const _pose = {};
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
function startHop(v, to, yaw, dur, hgt, then) {
  v.hop = { from: v.root.position.clone(), to: to.clone(), y0: v.yaw, y1: v.yaw + wrapAngle(yaw - v.yaw), t: 0, dur, hgt: hgt == null ? 1.4 * u : hgt, then };
  v.state = 'hop';
}
// gorunum durumlari: lane, stage, hop, belt, park, leave
function laneTargets() {
  g.lanes.forEach((ln, l) => ln.forEach((t, k) => {
    const v = views.get(t.id); if (!v || v.state !== 'lane') return;
    lanePos(l, k, v.target || (v.target = new THREE.Vector3()));
    v.root.visible = k < 3;
    v.label.scale.set((k ? 1.25 : 1.6) * u, (k ? 0.625 : 0.8) * u, 1);
  }));
}
function updateView(v, dt) {
  const r = v.root;
  if (v.hop) {
    const h = v.hop; h.t += dt; const k = Math.min(1, h.t / h.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    r.position.lerpVectors(h.from, h.to, e); r.position.y = h.from.y + (h.to.y - h.from.y) * e + Math.sin(Math.PI * k) * h.hgt;
    v.yaw = h.y0 + (h.y1 - h.y0) * e;
    if (k >= 1) { v.hop = null; const cb = h.then; if (cb) cb(); }
  } else if (v.state === 'lane' || v.state === 'park' || v.state === 'stage') {
    if (v.target) { const d = r.position.distanceTo(v.target); r.position.lerp(v.target, 1 - Math.exp(-10 * dt)); v.spin += d * (1 - Math.exp(-10 * dt)); }
    v.yaw += wrapAngle(0 - v.yaw) * (1 - Math.exp(-10 * dt));
  } else if (v.state === 'belt') {
    const b = g.belt.find((x) => x.t === v.t);
    if (b) { beltPose(b.s, _pose); r.position.set(_pose.x, BELT_Y, _pose.z); v.yaw = _pose.yaw; }
  } else if (v.state === 'leave') {
    const lv2 = v.leave; lv2.t += dt;
    if (lv2.t < 0.28) { const k = lv2.t / 0.28; v.yaw = lv2.y0 + Math.PI * (k * k * (3 - 2 * k)); r.position.y = Math.sin(Math.PI * k) * 0.35 * u + lv2.p0y; }
    else { const tt = lv2.t - 0.28, sp = Math.min(26 * u, 4 * u + tt * 40 * u); lv2.v = sp; const dx = -Math.sin(v.yaw), dz = -Math.cos(v.yaw); r.position.x += dx * sp * dt; r.position.z += dz * sp * dt; r.position.y = Math.max(0.02, r.position.y - dt * 2); v.spin += sp * dt;
      if (Math.random() < dt * 22) puff(r.position.x - dx * 0.9 * u, 0.3 * u, r.position.z - dz * 0.9 * u, 0.6);
      if (tt > 1.6 || Math.abs(r.position.x) > 60 || Math.abs(r.position.z) > 80) { killView(v); return; } }
  }
  r.rotation.y = v.yaw;
  // tekerlekler
  if (v.spin) { const a = v.spin / (0.094 * v.sc); v.wheels.forEach((w) => { w.rotation.z = a; }); }
  // zipla / yuk / dolu kasa cokmesi
  v.bounce = Math.max(0, v.bounce - dt * 5);
  const sq = Math.sin(v.bounce * Math.PI * 2) * v.bounce * 0.12;
  v.pivot.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5);
  const sinkT = v.t.cap ? -0.03 * Math.min(1, v.t.load / v.t.cap) : 0; v.sink += (sinkT - v.sink) * Math.min(1, dt * 8);
  if (v.body) v.body.position.y = v.sink;
  if (v.shake > 0) { v.shake -= dt; v.pivot.position.x = Math.sin(v.shake * 60) * 0.08 * u * (v.shake / 0.3); } else v.pivot.position.x = 0;
  // kasa kupleri pop
  if (v.pops.length) {
    for (const p of v.pops) { p.t += dt; const k = Math.min(1, p.t / 0.18), s = k < 1 ? (k < 0.6 ? k / 0.6 * 1.35 : 1.35 - (k - 0.6) / 0.4 * 0.35) : 1; cargoSlot(p.k, _v); _v.y += (1 - k) * 0.08; _m4.compose(_v, _q.identity(), _s.set(s, s, s)); v.cargo.setMatrixAt(p.k, _m4); }
    v.cargo.instanceMatrix.needsUpdate = true; v.pops = v.pops.filter((p) => p.t < 0.18);
  }
  if (v.t.kind === 'joker') v.mat.userData.tint.value.setHSL((performance.now() / 1600 + v.t.id * 0.13) % 1, 0.85, 0.55);
  if (v.glow > 0) { v.glow = Math.max(0, v.glow - dt * 2.5); v.mat.userData.glow.value = v.glow; }
}
function killView(v) { v.alive = false; levelG.remove(v.root); v.ltex.dispose(); v.label.material.dispose(); v.mat.dispose(); v.cargo.dispose(); views.delete(v.t.id); }

// ---------- efektler ----------
const fxList = [];
const TUBE_GEO = new THREE.CylinderGeometry(1, 1, 1, 10, 1); TUBE_GEO.translate(0, 0.5, 0);
const RING_GEO = new THREE.TorusGeometry(1, 0.35, 8, 16);
const PUFF_MAT = new THREE.SpriteMaterial({ map: TX.soft, color: '#ffffff', transparent: true, depthWrite: false, opacity: 0.8 });
function puff(x, y, z, s) { const sp = new THREE.Sprite(PUFF_MAT.clone()); sp.position.set(x, y, z); sp.scale.setScalar(s * u); levelG.add(sp); fxList.push({ kind: 'puff', o: sp, t: 0, dur: 0.7, s: s * u }); }
function shards(p, hex, n) { for (let k = 0; k < (n || 6); k++) { const m = new THREE.Mesh(CARGO_GEO, colMat(hex)); m.position.copy(p); m.scale.setScalar(2.2 + Math.random() * 1.5); levelG.add(m); fxList.push({ kind: 'shard', o: m, t: 0, dur: 0.55, v: new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5) }); } }
function trunkTipWorld(v, out) { v.model.updateMatrixWorld(true); return v.model.localToWorld(out.copy(TRUNK)); }
const CUBE_TALL = cubeGeo(0.92, HT), CUBE_SHORT = cubeGeo(0.92, HS);
function eatFx(v, i, colHex, delay) {
  // kup tahtadan kalkar; hortum uzanir, kupu kapip geri cekilir, kup kasaya duser
  const x = g.cells[i];
  const cube = new THREE.Mesh(x.bg ? CUBE_SHORT : CUBE_TALL, colMat(colHex)); cellPos(i, cube.position); cube.castShadow = true; levelG.add(cube);
  hideCell(i);
  const tube = new THREE.Mesh(TUBE_GEO, colMat(v.t.kind === 'joker' ? '#ffffff' : g.pal[v.t.c])); tube.visible = false; levelG.add(tube);
  const ring = new THREE.Mesh(RING_GEO, tube.material); ring.visible = false; levelG.add(ring);
  const start = cube.position.clone(), dist = trunkTipWorld(v, _v).distanceTo(start);
  fxList.push({ kind: 'eat', v, cube, tube, ring, start, t: -(delay || 0), out: 0.07 + dist * 0.008, back: 0.13 + dist * 0.012, colHex });
}
function hideCell(i) { const r = cellRef[i]; if (!r || r.hidden) return; r.hidden = true; _m4.makeScale(0, 0, 0); r.m.setMatrixAt(r.k, _m4); r.m.instanceMatrix.needsUpdate = true; }
function crackFx(i) {
  const r = cellRef[i]; if (r && r.f != null && frostMesh) { _m4.makeScale(0, 0, 0); frostMesh.setMatrixAt(r.f, _m4); frostMesh.instanceMatrix.needsUpdate = true; }
  cellPos(i, _v); _v.y += 0.4; shards(_v, '#e9f7ff', 7); SFX.ice(); vib(10);
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function updateFx(dt) {
  for (let n = fxList.length - 1; n >= 0; n--) {
    const f = fxList[n]; f.t += dt;
    if (f.kind === 'eat') {
      if (f.t < 0) continue;
      const v = f.v, tip = v.alive ? trunkTipWorld(v, _a) : _a.copy(f.start);
      let end;
      if (f.t < f.out) { const k = f.t / f.out; end = _b.lerpVectors(tip, f.start, k * k); if (!f.sl) { f.sl = 1; SFX.slurp(); } }
      else { const k = Math.min(1, (f.t - f.out) / f.back), e = k * k * (3 - 2 * k); end = _b.lerpVectors(f.start, tip, e); f.cube.position.copy(end); const s = 1 - e * 0.85; f.cube.scale.setScalar(s); f.cube.rotation.y += dt * 8; }
      const len = tip.distanceTo(end);
      if (len > 0.05) { f.tube.visible = true; f.ring.visible = true; f.tube.position.copy(tip); _v.subVectors(end, tip).normalize(); f.tube.quaternion.setFromUnitVectors(_up, _v); f.tube.scale.set(0.075 * u, len, 0.075 * u); f.ring.position.copy(end); f.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), _v); f.ring.scale.setScalar(0.11 * u); }
      else { f.tube.visible = false; f.ring.visible = false; }
      if (f.t >= f.out + f.back) {
        levelG.remove(f.cube); levelG.remove(f.tube); levelG.remove(f.ring);
        if (v.alive) { addCargo(v, f.colHex); v.bounce = 1; drawLabel(v); }
        SFX.glup(v.t.load); vib(8);
        fxList.splice(n, 1);
      }
    } else if (f.kind === 'puff') {
      const k = f.t / f.dur; f.o.position.y += dt * 1.2 * u; f.o.scale.setScalar(f.s * (1 + k * 1.6)); f.o.material.opacity = 0.75 * (1 - k);
      if (k >= 1) { levelG.remove(f.o); f.o.material.dispose(); fxList.splice(n, 1); }
    } else if (f.kind === 'shard') {
      f.v.y -= 14 * dt; f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += dt * 9; f.o.rotation.z += dt * 7;
      if (f.t >= f.dur) { levelG.remove(f.o); fxList.splice(n, 1); }
    }
  }
}
// ekran efektleri (DOM)
function toScreen(p) { const q = p.clone().project(cam); return { x: (q.x + 1) / 2 * innerWidth, y: (1 - q.y) / 2 * innerHeight }; }
function flyCoins(p, n, then) {
  const s = toScreen(p), tgt = $('coin').getBoundingClientRect(), tx = tgt.left + 18, ty = tgt.top + 18;
  for (let k = 0; k < n; k++) {
    const d = document.createElement('div'); d.className = 'fx coinfly'; document.body.appendChild(d);
    const ox = (Math.random() - 0.5) * 60, oy = -20 - Math.random() * 50, t0 = performance.now() + k * 70, dur = 650;
    const step = (now) => { const k2 = Math.max(0, Math.min(1, (now - t0) / dur)), e = k2 * k2; const x = s.x + ox * Math.sin(Math.PI * Math.min(1, k2 * 1.4)) + (tx - s.x) * e, y = s.y + oy * Math.sin(Math.PI * Math.min(1, k2 * 1.4)) + (ty - s.y) * e; d.style.transform = `translate(${x - 12}px,${y - 12}px) scale(${1 - k2 * 0.3})`; if (k2 < 1) requestAnimationFrame(step); else { d.remove(); SFX.coin(); if (k === n - 1 && then) then(); } };
    requestAnimationFrame(step);
  }
}
let comboEl = null;
function floatText(p, txt, col, big) {
  const s = toScreen(p), d = document.createElement('div');
  if (big) { if (comboEl) comboEl.remove(); comboEl = d; d.style.zIndex = 13; } d.className = 'fx combo'; d.textContent = txt; d.style.color = col || '#fff'; d.style.fontSize = big ? '38px' : '26px'; document.body.appendChild(d);
  const t0 = performance.now(); const step = (now) => { const k = Math.min(1, (now - t0) / 900); d.style.transform = `translate(${s.x}px,${s.y - 40 * k}px) translate(-50%,-50%) scale(${k < 0.15 ? k / 0.15 : 1})`; d.style.opacity = String(1 - Math.max(0, (k - 0.6) / 0.4)); if (k < 1) requestAnimationFrame(step); else d.remove(); };
  requestAnimationFrame(step);
}
function confetti() {
  const cols = ['#ff4d4d', '#ffb000', '#43c94f', '#3d9bff', '#9b5cff', '#ff5fa8'];
  for (let k = 0; k < 70; k++) {
    const d = document.createElement('div'); d.className = 'fx conf'; d.style.background = cols[k % cols.length]; document.body.appendChild(d);
    const x0 = innerWidth * (0.2 + Math.random() * 0.6), vx = (Math.random() - 0.5) * 600, vy = -500 - Math.random() * 500, rot = Math.random() * 720, t0 = performance.now();
    const step = (now) => { const t = (now - t0) / 1000; const x = x0 + vx * t, y = innerHeight * 0.45 + vy * t + 900 * t * t; d.style.transform = `translate(${x}px,${y}px) rotate(${rot * t}deg)`; if (t < 2.2) requestAnimationFrame(step); else d.remove(); };
    requestAnimationFrame(step);
  }
}
let toastT = 0;
function toast(msg) { const t = $('toast'); t.innerHTML = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 1100); }

// ---------- motor olaylari ----------
let combo = 0, comboT = 0, endT = 0, endShown = false;
const COMBO_AT = [12, 30, 60, 100], COMBO_W = ['Harika!', 'Süper!', 'Muhteşem!', 'EFSANE!'];
function handleEvents() {
  for (const e of g.events) {
    const v = e.t ? views.get(e.t.id) : null;
    if (e.type === 'launch') {
      SFX.hop(); vib(12);
      if (!v) continue;
      v.state = 'stage'; const k = g.waiting.indexOf(e.t);
      const p = L.stage.clone(); p.z += Math.max(0, k) * 1.2 * u;
      startHop(v, p, 0, 0.3, 1.2 * u, () => { if (v.state === 'hop') { v.state = 'stage'; v.target = p; } });
      v.label.scale.set(1.6 * u, 0.8 * u, 1); v.root.visible = true;
      laneTargets();
    } else if (e.type === 'enter') {
      if (!v) continue;
      beltPose(0, _pose);
      startHop(v, new THREE.Vector3(_pose.x, BELT_Y, _pose.z), _pose.yaw, 0.3, 0.9 * u, () => { v.state = 'belt'; SFX.land(); });
    } else if (e.type === 'eat') {
      if (v) eatFx(v, e.i, g.pal[e.c], e.n ? 0.06 : 0);
      combo++; comboT = 1.1;
      const ci = COMBO_AT.indexOf(combo);
      if (ci >= 0) { SFX.combo(ci); floatText(new THREE.Vector3(0, 2, -g.H * 0.25), COMBO_W[ci], ['#fff38a', '#b6fff0', '#ffd0f2', '#ffffff'][ci], true); }
    } else if (e.type === 'crack') {
      crackFx(e.i);
    } else if (e.type === 'park') {
      if (!v) continue;
      const p = parkPos(e.slot);
      startHop(v, p, 0, 0.42, 1.3 * u, () => { v.state = 'park'; v.target = p; SFX.park(); });
      vib(15);
    } else if (e.type === 'leave') {
      if (!v) continue;
      // son kuplerin kasaya inmesini bekle, sonra korna + 180 derece don + git
      const go = () => {
        if (!v.alive) return;
        v.hop = null; v.state = 'leave'; v.leave = { t: 0, y0: v.yaw, p0y: v.root.position.y };
        SFX.horn(); setTimeout(() => SFX.engine(), 200); vib([18, 40, 18]);
        const reward = e.why === 'empty' ? 0 : (e.t.kind === 'big' ? 2 : 1);
        if (reward) { const p = v.root.position.clone(); p.y += 1.3 * u; floatText(p, '+' + reward, '#fff36b'); flyCoins(p, Math.min(5, reward), () => addCoins(reward)); runCoins += reward; }
        v.glow = 1;
      };
      const pending = fxList.some((f) => f.kind === 'eat' && f.v === v);
      if (pending) { v.waitLeave = go; } else go();
      unlockCheck();
    } else if (e.type === 'win') {
      endT = 1.7; endShown = false;
    } else if (e.type === 'lose') {
      endT = 0.9; endShown = false;
      if (e.why === 'park' && v) { const p = new THREE.Vector3(L.stage.x + 1.5 * u, 0, L.stage.z); startHop(v, p, 0, 0.4, 1.2 * u, () => { v.state = 'stage'; v.target = p; v.shake = 0.6; }); }
    } else if (e.type === 'revive') {
      buildPads();
    }
  }
  g.events.length = 0;
}
function unlockCheck() {
  for (const v of views.values()) {
    if (v.lockShown && !g.locked(v.t)) { v.lockShown = false; setTint(v); drawLabel(v); v.glow = 1.2; v.bounce = 1; SFX.unlock(); const p = v.root.position.clone(); p.y += 1.2 * u; floatText(p, 'Açıldı!', '#fff36b'); }
    else if (v.lockShown) drawLabel(v);
  }
}

// ---------- dokunma ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
glc.addEventListener('pointerdown', (ev) => {
  ensureAudio();
  if (!g || g.state !== 'play' || $('modal').classList.contains('on')) return;
  ndc.set(ev.clientX / innerWidth * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  const hits = [];
  for (const v of views.values()) if (v.root.visible && (v.state === 'lane' || v.state === 'park')) hits.push(v.hit);
  const hs = ray.intersectObjects(hits, false);
  let v = hs.length ? hs[0].object.userData.view : null;
  // kuyrugun herhangi bir yerine dokunmak one gelen kamyonu gonderir
  if (!v) {
    _v.set(0, 0, 0); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const p = ray.ray.intersectPlane(pl, _v);
    if (p && p.z > L.lz0 - 1.0 * u && p.z < L.lz0 + 3 * L.ldz) { const l = Math.round((p.x - L.lx0) / L.ldx); if (l >= 0 && l < g.lanes.length && Math.abs(p.x - laneX(l)) < L.ldx * 0.5 && g.lanes[l][0]) v = views.get(g.lanes[l][0].id); }
  }
  if (!v) return;
  const t = v.t;
  let res;
  const li = g.lanes.findIndex((ln) => ln.indexOf(t) >= 0);
  if (li >= 0) {
    const ln = g.lanes[li];
    const front = views.get(ln[0].id);
    res = g.sendLane(li); v = front;
  } else {
    const k = g.park.indexOf(t); if (k < 0) return; res = g.sendPark(k);
  }
  if (res === 'ok') { SFX.tap(); }
  else if (res === 'locked') { SFX.deny(); vib(40); v.shake = 0.3; toast('🔒 Kilitli! ' + (v.t.lockAt - g.departed) + ' kamyon daha gitmeli'); }
  else if (res === 'full') { SFX.deny(); vib(40); v.shake = 0.3; toast('Bant dolu! Biraz bekle'); }
  handleEvents();
});

// ---------- arayuz ----------
let runCoins = 0;
const TIPS = {
  intro: { t: 'Nasıl oynanır?', p: 'Kuyruktaki bir kamyona <b>dokun</b>: banda çıkar ve tahtanın etrafında döner.<br>Önünden geçtiği sıranın <b>kenardaki ilk küpü</b> kendi rengindeyse hortumuyla yutar, küp kasaya düşer.<br>Kasası dolunca <b>korna çalıp gider</b>. Üstteki sayı kasanın dolması için kalan küptür.<br>Dolmadan turu biten kamyon <b>park yerine</b> iner. Park yeri kalmazsa kaybedersin!' },
  park: { t: 'Park yeri azaldı!', p: 'Artık sadece <b>3 park yeri</b> var. Rengi şu an kenarda görünmeyen kamyonu gönderme; önce yolu açacak renkleri seç. Parktaki kamyona dokunarak onu tekrar banda gönderebilirsin.' },
  caps: { t: 'Yeni: Farklı kasalar', p: 'Kamyonların kasaları artık farklı boyda. Büyük kasalı kamyon dolmadan turu bitirirse park yeri harcar. Üstteki sayıya bak, acele etme!' },
  lock: { t: 'Yeni: Kilitli kamyon', p: 'Gri kamyon <b>kilitli</b>. Üstündeki sayı kadar kamyon dolup gidince açılır. O zamana kadar o kuyruğu kullanamazsın; diğer kuyruklarla yolu aç.' },
  ice: { t: 'Yeni: Buzlu küp', p: 'Buzlu küp <b>iki yutuşta</b> biter: ilk yutuşta buz kırılır, ikincisinde küp kasaya gider.' },
  big: { t: 'Yeni: Büyük kamyon', p: '<b>XL</b> yazan kamyonun kasası kocaman. Dolması uzun sürer; park yerini dikkatli kullan.' },
  dbl: { t: 'Yeni: Çift hortum', p: '<b>x2</b> yazan kamyon bir sırada <b>arka arkaya iki küpü</b> birden yutabilir (ikisi de kendi rengindeyse).' },
  joker: { t: 'Yeni: Gökkuşağı Pofi', p: '<b>★</b> yazan rengârenk kamyon <b>her rengi</b> yutar! Sıkıştığında yolu açmak için sakla.' }
};
function openModal(html) { $('card').innerHTML = html; $('modal').classList.add('on'); bindButtons($('card')); }
function closeModal() { $('modal').classList.remove('on'); }
function bindButtons(root) {
  root.querySelectorAll('.btn,.ib,.lvb').forEach((b) => {
    if (b.dataset.bound) return; b.dataset.bound = 1;
    b.addEventListener('pointerdown', () => { b.classList.add('dn'); ensureAudio(); SFX.tap(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((k) => b.addEventListener(k, () => b.classList.remove('dn')));
  });
}
function showTip(key) {
  const tp = TIPS[key]; if (!tp) return false;
  openModal(`<div class="tag">İpucu</div><h2>${tp.t}</h2><p>${tp.p}</p><button class="btn g" id="mOk">Anladım</button>`);
  $('mOk').onclick = () => { SV.tips[key] = 1; save(); closeModal(); };
  return true;
}
function showWin() {
  const st = g.stars(), old = SV.stars[LVN] || 0;
  const bonus = 10 + st * 5; runCoins += bonus;
  SV.stars[LVN] = Math.max(old, st); SV.max = Math.max(SV.max, LVN + 1); SV.L = LVN + 1; save();
  addCoins(bonus);
  const starsH = [0, 1, 2].map((k) => `<span class="${k < st ? '' : 'no'}" style="animation-delay:${0.15 + k * 0.18}s">⭐</span>`).join('');
  openModal(`<div class="tag">Bölüm ${LVN}</div><h2>Tebrikler!</h2><div class="stars">${starsH}</div><img class="pic" src="${lv.src}" alt="" onerror="this.style.display='none'"><p>Tüm kamyonlar yükünü aldı!<br><b>+${runCoins}</b> coin</p><button class="btn g" id="mNext">Sonraki bölüm ▶</button><button class="btn w" id="mMap">Bölümler</button>`);
  $('mNext').onclick = () => { closeModal(); startLevel(LVN + 1); };
  $('mMap').onclick = () => showMap();
  confetti(); SFX.win(); vib([30, 60, 30, 60, 80]);
}
const REVIVE = 60;
function showLose(why) {
  const can = coins() >= REVIVE;
  openModal(`<div class="tag" style="background:#ff5a5a">Bölüm ${LVN}</div><h2>${why === 'park' ? 'Park yeri doldu!' : 'Hamle kalmadı!'}</h2><p>${why === 'park' ? 'Dolmadan dönen kamyona yer kalmadı.' : 'Gönderebileceğin hiçbir kamyon kenardaki küplere ulaşamıyor.'}</p>
    <button class="btn o ${can ? '' : 'off'}" id="mRev">+1 park yeri <span style="display:inline-flex;align-items:center;gap:4px;margin-left:6px"><s style="display:inline-block;width:20px;height:20px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff7b0,#ffc928 45%,#e09000);border:2px solid #a86400"></s>${REVIVE}</span></button>
    <button class="btn g" id="mRe">Tekrar dene</button><button class="btn w" id="mMap">Bölümler</button>`);
  $('mRev').onclick = () => { if (!spendCoins(REVIVE)) { toast('Yeterli coin yok'); return; } closeModal(); g.revive(1); handleEvents(); updateChips(); };
  $('mRe').onclick = () => { closeModal(); startLevel(LVN); };
  $('mMap').onclick = () => showMap();
  SFX.lose(); vib([60, 40, 60]);
}
function showMap() {
  const n = Math.max(30, Math.ceil((SV.max + 5) / 5) * 5);
  let h = '<h2>Kamyon Bölümleri</h2><div class="map">';
  for (let k = 1; k <= n; k++) {
    const st = SV.stars[k] || 0, lock = k > SV.max;
    h += `<button class="lvb ${lock ? 'lock' : ''} ${k === LVN ? 'cur' : ''}" data-l="${k}">${lock ? '🔒' : k}<small>${lock ? '' : '★'.repeat(st) + '☆'.repeat(3 - st)}</small></button>`;
  }
  h += '</div><button class="btn w" id="mClose">Kapat</button>';
  openModal(h);
  $('card').querySelectorAll('.lvb').forEach((b) => { b.onclick = () => { const k = +b.dataset.l; if (k > SV.max) { SFX.deny(); return; } closeModal(); startLevel(k); }; });
  $('mClose').onclick = closeModal;
  const cur = $('card').querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'center' });
}
function showSettings() {
  openModal(`<h2>Ayarlar</h2><div class="lbl">Ses</div><div class="row"><button class="btn ${SV.mute ? '' : 'on'}" id="sOn">Açık</button><button class="btn ${SV.mute ? 'on' : ''}" id="sOff">Kapalı</button></div>
    <div class="lbl">Titreşim</div><div class="row">${['Kapalı', 'Hafif', 'Güçlü'].map((t, k) => `<button class="btn ${SV.vib === k ? 'on' : ''}" data-v="${k}">${t}</button>`).join('')}</div>
    <button class="btn" id="sHome">Ana oyuna dön</button><button class="btn w" id="sClose">Kapat</button><div class="note">Kamyon modu (deneme) · sürüm ${VER}</div>`);
  $('sOn').onclick = () => { SV.mute = false; save(); showSettings(); };
  $('sOff').onclick = () => { SV.mute = true; save(); showSettings(); };
  $('card').querySelectorAll('[data-v]').forEach((b) => { b.onclick = () => { SV.vib = +b.dataset.v; save(); vib(30); showSettings(); }; });
  $('sHome').onclick = () => { location.href = '../'; };
  $('sClose').onclick = closeModal;
}
function updateChips() {
  if (!g) return;
  const pc = g.park.filter(Boolean).length;
  $('chipBelt').innerHTML = `Bant <b>${g.beltCount()}/${g.lv.plan.beltMax}</b>`;
  $('chipPark').innerHTML = `Park <b style="color:${pc >= g.park.length - 1 ? '#ff3b3b' : '#ff6a00'}">${pc}/${g.park.length}</b>`;
  $('signP').style.width = (100 * (1 - g.left / g.total)).toFixed(1) + '%';
}
['bHome', 'bMap', 'bRe', 'bSet'].forEach((id) => bindButtons(document.getElementById('top')));
$('bHome').onclick = () => { location.href = '../'; };
$('bMap').onclick = () => showMap();
$('bRe').onclick = () => { if (g) startLevel(LVN); };
$('bSet').onclick = () => showSettings();

// ---------- seviye ----------
function startLevel(n) {
  LVN = Math.max(1, n | 0);
  for (const v of [...views.values()]) killView(v);
  fxList.forEach((f) => { ['cube', 'tube', 'ring', 'o'].forEach((k) => { if (f[k]) levelG.remove(f[k]); }); }); fxList.length = 0;
  lv = K.level(LVN); g = new K.Game(lv);
  buildLevel();
  g.lanes.forEach((ln, l) => ln.forEach((t, k) => { const v = makeView(t); lanePos(l, k, v.root.position); v.target = v.root.position.clone(); }));
  laneTargets();
  combo = 0; endT = 0; endShown = false; runCoins = 0; acc = 0;
  $('signT').textContent = 'Kamyon ' + LVN; updateChips(); $('coinN').textContent = coins();
  SV.L = LVN; save();
  const tip = lv.plan.tip;
  if (tip && !SV.tips[tip]) showTip(tip);
}

// ---------- dongu ----------
let acc = 0, lastT = performance.now(), fpsT = 0, fpsN = 0, lowQ = false;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  step(dt);
  ren.render(scene, cam);
  // yavas cihaz: kaliteyi dusur
  fpsT += dt; fpsN++;
  if (fpsT > 2.5) { const fps = fpsN / fpsT; fpsT = 0; fpsN = 0; if (fps < 40 && !lowQ && !TEST) { lowQ = true; PR = 1; ren.setPixelRatio(1); for (const v of views.values()) v.model.traverse((o) => { o.castShadow = false; }); sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } onResize(); } }
  requestAnimationFrame(frame);
}
const AUTO = Q0.get('auto'); let autoNext = 0; const autoRnd = K.rng(7);
function step(dt) {
  if (g && AUTO && g.state === 'play' && g.t >= autoNext && g.beltCount() < g.lv.plan.beltMax && g.entryClear() && !$('modal').classList.contains('on')) {
    const pick = K.decide(g, AUTO === 'r' ? 'rastgele' : 'dikkatli', autoRnd);
    if (pick) { if (pick.from === 'lane') g.sendLane(pick.i); else g.sendPark(pick.i); handleEvents(); autoNext = g.t + 0.4; }
  }
  if (g) {
    const paused = $('modal').classList.contains('on') && g.state === 'play';
    if (!paused) {
      acc += dt; const h = 1 / 60;
      while (acc >= h) { g.tick(h); acc -= h; if (g.events.length) handleEvents(); }
    }
    for (const v of [...views.values()]) { updateView(v, dt); if (v.waitLeave && !fxList.some((f) => f.kind === 'eat' && f.v === v)) { const f = v.waitLeave; v.waitLeave = null; f(); } }
    updateFx(dt);
    const sp = g.G.speed / (2 * u); beltTexs.forEach((t) => { t.offset.x -= sp * dt; });
    comboT -= dt; if (comboT <= 0) combo = 0;
    updateChips();
    if (endT > 0) { endT -= dt; if (endT <= 0 && !endShown) { endShown = true; if (g.state === 'win') showWin(); else if (g.state === 'lose') { const lastLose = g.overflow ? 'park' : 'stuck'; showLose(lastLose); } } }
  }
}
function onResize() { ren.setSize(innerWidth, innerHeight, false); fitCamera(); }
addEventListener('resize', onResize);

// ---------- baslat ----------
new GLTFLoader().load('kamyon.glb?v=300', (gl) => {
  let mat = null; gl.scene.traverse((o) => { if (o.isMesh) mat = o.material; });
  TPL = { scene: gl.scene, mat };
  $('loading').style.display = 'none';
  onResize();
  const qL = /[?&]sv=(\d+)/.exec(location.search);
  startLevel(qL ? +qL[1] : Math.min(SV.L, SV.max));
  requestAnimationFrame(frame);
}, undefined, (err) => { $('loading').textContent = 'Kamyon modeli yüklenemedi'; console.error(err); });

// test/otomasyon kancasi
window.KM = { get g() { return g; }, step(sec, n) { const h = 1 / 30; for (let k = 0; k < (n || Math.round(sec / h)); k++) step(h); ren.render(scene, cam); }, start: (n) => startLevel(n), send(l) { const r = g.sendLane(l); handleEvents(); return r; }, sendPark(k) { const r = g.sendPark(k); handleEvents(); return r; }, closeModal, views, cam, THREE, render: () => ren.render(scene, cam), info: () => ({ calls: ren.info.render.calls, tris: ren.info.render.triangles, geos: ren.info.memory.geometries, tex: ren.info.memory.textures }) };
