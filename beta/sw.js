// BLOKPOP beta service worker (v2.77)
// - Internet varken: oyun dosyalari (html/js) her zaman agdan taze gelir, kopyasi saklanir.
// - Internet yokken: saklanan kopya kullanilir, oyun cevrimdisi acilir.
// - Gorseller, 3D modeller, videolar: once saklanan kopya, arka planda guncellenir.
// - Oyuncu kaydina (localStorage / IndexedDB) asla dokunmaz.
const C='blokpop-beta-v85';
// @@ASSETS-START (tools/gen-sw-manifest.js ile otomatik uretilir, elle duzenleme)
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./runpofi.js","./items3d.js","./sfx.js","./avatars.js","./live3d.js","./three.module.min.js","./GLTFLoader.js","./SkeletonUtils.js","./BufferGeometryUtils.js"];
const EXTRA=["./LICENSES.txt","./bg/w01.webp","./bg/w02.webp","./bg/w03.webp","./bg/w04.webp","./bg/w05.webp","./bg/w06.webp","./bg/w07.webp","./bg/w08.webp","./bg/w09.webp","./bg/w10.webp","./bg/w11.webp","./bg/w12.webp","./bg/w13.webp","./bg/w14.webp","./bg/w15.webp","./bg/w16.webp","./bg/w17.webp","./bg/w18.webp","./bg/w19.webp","./bg/w20.webp","./char_astronot.js","./char_ejderha.js","./char_super.js","./evo.jpg","./evo.mp4","./live_astronot.glb","./live_ejderha.glb","./live_pofi.glb","./live_super.glb","./pofi_dance.webm","./pofi_dance_a.webm","./pofi_knock.webm","./pofi_knock_a.webm","./pofi_spray.webm","./pofi_spray_a.webm","./splash.mp4","./splash_a.webm"];
// @@ASSETS-END
const PFX=C.replace(/\d+$/,'');
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE).then(()=>
  // ek dosyalar (arka planlar, 3D modeller, videolar) tek tek indirilir; biri inmezse atlanir, kurulum yine tamamlanir
  Promise.all(EXTRA.map(u=>fetch(u).then(r=>r.ok?c.put(u,r):0).catch(()=>0)))
)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C&&x.indexOf(PFX)===0).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// iOS Safari needs HTTP Range answers for <video>; serve them from the cache (206 slices)
async function videoResp(r){
  const c=await caches.open(C);let res=await c.match(r.url);
  if(!res){try{const n=await fetch(r.url);if(!n.ok)return n;await c.put(r.url,n.clone());res=n}catch(x){return Response.error()}}
  const h=r.headers.get('range');if(!h)return res;
  const buf=await res.arrayBuffer(),m=/bytes=(\d*)-(\d*)/.exec(h)||[];
  const s=m[1]?+m[1]:0;let en=m[2]?+m[2]:buf.byteLength-1;en=Math.min(en,buf.byteLength-1);
  return new Response(buf.slice(s,en+1),{status:206,statusText:'Partial Content',headers:{'Content-Type':/\.webm$/.test(r.url)?'video/webm':'video/mp4','Content-Range':'bytes '+s+'-'+en+'/'+buf.byteLength,'Content-Length':String(en-s+1),'Accept-Ranges':'bytes'}});
}
function key(r){const u=new URL(r.url);u.search='';return u.href}
// html/js: once ag (3.5 sn bekle), olmazsa saklanan kopya
async function networkFirst(e){
  const c=await caches.open(C),k=key(e.request);
  const net=fetch(e.request).then(r=>{if(r&&r.ok)c.put(k,r.clone()).catch(()=>0);return r});
  let timer;const slow=new Promise(res=>{timer=setTimeout(res,3500)});
  try{
    const r=await Promise.race([net,slow.then(()=>null)]);clearTimeout(timer);
    if(r&&r.ok)return r;
    const hit=await c.match(k);if(hit){e.waitUntil(net.catch(()=>0));return hit}
    return r||await net;
  }catch(x){clearTimeout(timer);const hit=await c.match(k)||(e.request.mode==='navigate'?await c.match('./index.html'):null);return hit||Response.error()}
}
// gorsel/model: saklanan kopya hemen, arka planda tazele
async function staleWhileRevalidate(e){
  const c=await caches.open(C),k=key(e.request),hit=await c.match(k);
  const net=fetch(e.request).then(r=>{if(r&&r.ok)c.put(k,r.clone()).catch(()=>0);return r}).catch(()=>null);
  if(hit){e.waitUntil(net);return hit}
  return (await net)||Response.error();
}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);if(u.origin!==self.location.origin)return;
  if(/\.(mp4|webm)$/.test(u.pathname)){e.respondWith(videoResp(r));return}
  if(r.mode==='navigate'||/(\/|\.html|\.js|\.webmanifest)$/.test(u.pathname)){e.respondWith(networkFirst(e));return}
  e.respondWith(staleWhileRevalidate(e))});
