// v2.65 live 3D belt runners: the Tripo characters run on the belt as real skinned 3D models (Three.js r160), drawn on a WebGL
// overlay right above the game canvas. engine.js runBody hands every belt Pofi in as a job (where its feet are in canvas pixels,
// its colour, run phase, direction, shooting weight) instead of drawing a sprite; flush() renders them all once per frame.
// Purely visual: no game state is read back except the trunk tip (s._tip3), which only moves the drawn start of a shot.
import * as THREE from './three.module.min.js';
import { GLTFLoader } from './GLTFLoader.js';
import { clone as skClone } from './SkeletonUtils.js';

const Q = new URLSearchParams(location.search), num = (k, d) => (Q.has(k) ? +Q.get(k) : d);
const LEAN = num('lean', 0.28), ELEV = num('l3elev', 0.36), FACE = num('face', 0.6), TRUNK = num('trunk', -55) * Math.PI / 180;
// per model: file + how its texture tells body (takes the shooter colour) from details (eyes, costume trims) - same rules as tools/runpofi
const DEF = {
  pofi: { f: 'live_pofi.glb', hue1: 0.585, sat0: 0.22, val0: 0.42, bake: 0.35, hue2: [2, 2] },
  super: { f: 'live_super.glb', hue1: 0.66, sat0: 0.08, val0: 0.35, bake: 0.15, hue2: [2, 2] },
  astronot: { f: 'live_astronot.glb', hue1: 0.585, sat0: 0.08, val0: 0.35, bake: 0.15, hue2: [2, 2] },
  ejderha: { f: 'live_ejderha.glb', hue1: 0.66, sat0: 0.08, val0: 0.35, bake: 0.15, hue2: [0.66, 0.86] }
};
const M = {};   // name -> { scene, clip, h0, y0, mats: {col: material}, pool: [] }
let ren = null, cv = null, scene = null, cam = null, jobs = [], live = new Map(), failed = false;

function bonesOf(root) { const b = {}; root.traverse((o) => { if (o.isBone) b[o.name.replace(/^mixamorig:?/, '')] = o; }); return b; }
// the Tripo rig has no trunk bones: add two under the Head and give them the trunk vertices (Head-weighted, in front of the face, below the eyes)
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
  const m = src.clone(); m.metalness = 0; m.roughness = 0.55; m.normalScale = new THREE.Vector2(0.6, 0.6);
  const c = new THREE.Color(col); m.customProgramCacheKey = () => 'l3' + d.hue1 + d.hue2[0];
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCol = { value: c };
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uCol;\n' +
      'vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1.0e-10;return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)),d/(q.x+e),q.x);}')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 sc = pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)); vec3 hv = rgb2hsv(sc);
        float bodyW = smoothstep(0.33, 0.37, hv.x) * (1.0 - smoothstep(${d.hue1.toFixed(3)} - 0.02, ${d.hue1.toFixed(3)} + 0.02, hv.x)) * smoothstep(${(d.sat0 - 0.05).toFixed(3)}, ${(d.sat0 + 0.05).toFixed(3)}, hv.y) * smoothstep(${(d.val0 - 0.06).toFixed(3)}, ${(d.val0 + 0.06).toFixed(3)}, hv.z);
        bodyW = max(bodyW, smoothstep(${d.hue2[0].toFixed(3)} - 0.02, ${d.hue2[0].toFixed(3)} + 0.02, hv.x) * (1.0 - smoothstep(${d.hue2[1].toFixed(3)} - 0.02, ${d.hue2[1].toFixed(3)} + 0.02, hv.x)) * smoothstep(0.12, 0.22, hv.y) * smoothstep(0.2, 0.3, hv.z));
        float lum = dot(sc, vec3(0.3, 0.59, 0.11));
        vec3 body = uCol * mix(1.0, clamp(lum / 0.62, 0.55, 1.35), ${d.bake.toFixed(3)});
        vec3 warm = pow(vec3(lum) * vec3(1.03, 1.0, 0.93), vec3(2.2)); vec3 det = mix(diffuseColor.rgb, warm, 1.0 - smoothstep(0.18, 0.4, hv.y));
        diffuseColor.rgb = mix(det, body, bodyW);`);
  };
  return m;
}
function load(name) {
  const d = DEF[name]; if (!d || M[name]) return; M[name] = { loading: true };
  new GLTFLoader().load(d.f, (g) => {
    const model = g.scene; let mesh = null; model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
    if (!mesh) return; addTrunk(model, mesh);
    const bb = new THREE.Box3().setFromObject(model);
    M[name] = { scene: model, mesh, clip: g.animations.find((a) => a.name === 'run') || g.animations[0], h0: bb.max.y - bb.min.y, y0: bb.min.y, d, mats: {}, pool: [] };
  }, undefined, () => { M[name] = { bad: true }; });
}
function inst(name, col) {
  const m = M[name], o = m.pool.pop() || (() => {
    const root = skClone(m.scene), holder = new THREE.Group(), tilt = new THREE.Group(); tilt.add(root); holder.add(tilt);
    let mesh = null; root.traverse((x) => { if (x.isSkinnedMesh) { mesh = x; x.frustumCulled = false; } });
    const mixer = new THREE.AnimationMixer(root), act = mixer.clipAction(m.clip); act.play();
    return { name, holder, tilt, root, mesh, mixer, act, b: bonesOf(root) };
  })();
  if (o.col !== col) { if (!m.mats[col]) m.mats[col] = tintMat(m.mesh.material, m.d, col); o.mesh.material = m.mats[col]; o.col = col; }
  return o;
}
function setup() {
  cv = document.createElement('canvas'); cv.id = 'l3cv'; cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:absolute;pointer-events:none;z-index:2';
  try { ren = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) { failed = true; return; }
  ren.setPixelRatio(1); ren.outputColorSpace = THREE.SRGBColorSpace; ren.toneMapping = THREE.ACESFilmicToneMapping; ren.toneMappingExposure = 1.05; ren.setClearColor(0, 0);
  scene = new THREE.Scene();
  const key = new THREE.DirectionalLight(0xffffff, 2.6); key.position.set(-1.2, 2.2, 1.6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.7); fill.position.set(1.4, 0.6, 1.0); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.0); rim.position.set(0.6, 1.2, -1.8); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6aa0, 0.9));
  cam = new THREE.OrthographicCamera(0, 1, 0, -1, -5000, 5000);
}
const V = new THREE.Vector3();
const API = {
  has(name) { if (failed) return false; const m = M[name]; if (!m) { load(name); return false; } return !!m.scene; },
  add(j) { jobs.push(j); },
  flush(gcv) {
    if (failed) return; API.t = performance.now(); if (!cv) setup(); if (failed) return;
    if (cv.parentNode !== gcv.parentNode) gcv.parentNode.insertBefore(cv, gcv.nextSibling);
    const W = gcv.width, H = gcv.height;
    if (cv.width !== W || cv.height !== H) { ren.setSize(W, H, false); cam.right = W; cam.bottom = -H; cam.updateProjectionMatrix(); }
    const r = gcv.getBoundingClientRect(), pr = gcv.offsetParent ? gcv.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    const css = 'left:' + (r.left - pr.left) + 'px;top:' + (r.top - pr.top) + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
    if (cv._css !== css) { cv._css = css; cv.style.cssText = 'position:absolute;pointer-events:none;z-index:2;' + css; }
    if (!jobs.length && !live.size) { if (cv._dirty) { ren.clear(); cv._dirty = false; } return; }
    const seen = new Set();
    for (const j of jobs) {
      const m = M[j.name]; if (!m || !m.scene) continue;
      let o = live.get(j.s); if (o && (o.name !== j.name)) { scene.remove(o.holder); M[o.name].pool.push(o); live.delete(j.s); o = null; }
      if (!o) { o = inst(j.name, j.col); live.set(j.s, o); scene.add(o.holder); }
      if (o.col !== j.col) { if (!m.mats[j.col]) m.mats[j.col] = tintMat(m.mesh.material, m.d, j.col); o.mesh.material = m.mats[j.col]; o.col = j.col; }
      seen.add(j.s);
      // run cycle locked to the distance travelled (feet never slide), then stand the spine up a little (the mocap run leans far forward)
      const dur = o.act.getClip().duration; o.act.time = ((j.ph % 1) + 1) % 1 * dur; o.mixer.update(0);
      const b = o.b;
      if (b.Trunk1) { b.Trunk1.rotation.x = TRUNK * 0.55 * j.fw; b.Trunk2.rotation.x = TRUNK * 0.45 * j.fw; }
      const k = j.ky / m.h0;   // canvas px per model metre (height of the run sprite: 56 units)
      o.holder.position.set(j.x, -j.y, j.y * 0.01 + 100);
      o.holder.scale.set(j.kx / m.h0, k, k);
      o.tilt.rotation.set(ELEV, 0, 0); o.root.position.y = -m.y0;
      o.root.rotation.set(-LEAN, j.yaw, 0, 'YXZ');   // yaw, then stand the body up (the mocap run leans far forward)
    }
    for (const [s, o] of live) if (!seen.has(s)) { scene.remove(o.holder); M[o.name].pool.push(o); live.delete(s); }
    jobs = [];
    ren.render(scene, cam); cv._dirty = true;
    // trunk tips for the next shots, in each Pofi's own drawing frame (engine runBody local units)
    for (const [s, o] of live) { const t = o.b.Trunk2; if (!t || !s._l3m) continue; t.getWorldPosition(V); const mm = s._l3m; s._tip3 = [(V.x - mm.e) / mm.a, (-V.y - mm.f) / mm.d]; }
  }
};
window.BP_L3 = API;
// nothing flushed for a moment (map, menus): wipe the overlay so no runner is left frozen on top of other screens
setInterval(() => { if (cv && cv._dirty && performance.now() - (API.t || 0) > 150) { for (const [s, o] of live) { scene.remove(o.holder); M[o.name].pool.push(o); } live.clear(); ren.clear(); cv._dirty = false; } }, 120);
