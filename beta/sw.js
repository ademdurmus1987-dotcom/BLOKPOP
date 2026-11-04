// BLOKPOP beta service worker (v2.77)
// - Internet varken: oyun dosyalari (html/js) her zaman agdan taze gelir, kopyasi saklanir.
// - Internet yokken: saklanan kopya kullanilir, oyun cevrimdisi acilir.
// - Gorseller, 3D modeller, videolar: once saklanan kopya, arka planda guncellenir.
// - Oyuncu kaydina (localStorage / IndexedDB) asla dokunmaz.
const C='blokpop-beta-v125';
// @@ASSETS-START (tools/gen-sw-manifest.js ile otomatik uretilir, elle duzenleme)
const CORE=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png","./runpofi.js","./items3d.js","./sfx.js","./avatars.js","./live3d.js","./three.module.min.js","./GLTFLoader.js","./SkeletonUtils.js","./BufferGeometryUtils.js"];
const EXTRA=["./LICENSES.txt","./bg/w01.webp","./bg/w02.webp","./bg/w03.webp","./bg/w04.webp","./bg/w05.webp","./bg/w06.webp","./bg/w07.webp","./bg/w08.webp","./bg/w09.webp","./bg/w10.webp","./bg/w11.webp","./bg/w12.webp","./bg/w13.webp","./bg/w14.webp","./bg/w15.webp","./bg/w16.webp","./bg/w17.webp","./bg/w18.webp","./bg/w19.webp","./bg/w20.webp","./buz/index.html","./buz/izgara.js","./buz/motor.js","./buz/oyun3d.js","./buz/resim/liste.json","./buz/resim/r001.webp","./buz/resim/r002.webp","./buz/resim/r003.webp","./buz/resim/r004.webp","./buz/resim/r005.webp","./buz/resim/r006.webp","./buz/resim/r007.webp","./buz/resim/r008.webp","./buz/resim/r009.webp","./buz/resim/r010.webp","./buz/resim/r011.webp","./buz/resim/r012.webp","./buz/resim/r013.webp","./buz/resim/r014.webp","./buz/resim/r015.webp","./buz/resim/r016.webp","./buz/resim/r017.webp","./buz/resim/r018.webp","./buz/resim/r019.webp","./buz/resim/r020.webp","./buz/resim/r021.webp","./buz/resim/r022.webp","./buz/resim/r023.webp","./buz/resim/r024.webp","./buz/resim/r025.webp","./buz/resim/r026.webp","./buz/resim/r027.webp","./buz/resim/r028.webp","./buz/resim/r029.webp","./buz/resim/r030.webp","./buz/resim/r031.webp","./buz/resim/r032.webp","./buz/resim/r033.webp","./buz/resim/r034.webp","./buz/resim/r035.webp","./buz/resim/r036.webp","./buz/resim/r037.webp","./buz/resim/r038.webp","./buz/resim/r039.webp","./buz/resim/r040.webp","./buz/resim/r041.webp","./buz/resim/r042.webp","./buz/resim/r043.webp","./buz/resim/r044.webp","./buz/resim/r045.webp","./buz/resim/r046.webp","./buz/resim/r047.webp","./buz/resim/r048.webp","./buz/resim/r049.webp","./buz/resim/r050.webp","./buz/resim/r051.webp","./buz/resim/r052.webp","./buz/resim/r053.webp","./buz/resim/r054.webp","./buz/resim/r055.webp","./buz/resim/r056.webp","./buz/resim/r057.webp","./buz/resim/r058.webp","./buz/resim/r059.webp","./buz/resim/r060.webp","./buz/resim/r061.webp","./buz/resim/r062.webp","./buz/resim/r063.webp","./buz/resim/r064.webp","./buz/resim/r065.webp","./buz/resim/r066.webp","./buz/resim/r067.webp","./buz/resim/r068.webp","./buz/resim/r069.webp","./buz/resim/r070.webp","./buz/resim/r071.webp","./buz/resim/r072.webp","./buz/resim/r073.webp","./buz/resim/r074.webp","./buz/resim/r075.webp","./buz/resim/r076.webp","./buz/resim/r077.webp","./buz/resim/r078.webp","./buz/resim/r079.webp","./buz/resim/r080.webp","./buz/resim/r081.webp","./buz/resim/r082.webp","./buz/resim/r083.webp","./buz/resim/r084.webp","./buz/resim/r085.webp","./buz/resim/r086.webp","./buz/resim/r087.webp","./buz/resim/r088.webp","./buz/resim/r089.webp","./buz/resim/r090.webp","./buz/resim/r091.webp","./buz/resim/r092.webp","./buz/resim/r093.webp","./buz/resim/r094.webp","./buz/resim/r095.webp","./buz/resim/r096.webp","./buz/resim/r097.webp","./buz/resim/r098.webp","./buz/resim/r099.webp","./buz/resim/r100.webp","./buz/resim/r101.webp","./buz/resim/r102.webp","./buz/resim/r103.webp","./buz/resim/r104.webp","./buz/resim/r105.webp","./buz/resim/r106.webp","./buz/resim/r107.webp","./cannon.min.js","./char_astronot.js","./char_ejderha.js","./char_super.js","./evo.jpg","./evo.mp4","./kamyon/index.html","./kamyon/kamyon.glb","./kamyon/motor.js","./kamyon/oyun.js","./live_astronot.glb","./live_ejderha.glb","./live_pofi.glb","./live_super.glb","./pofi_dance.webm","./pofi_dance_a.webm","./pofi_knock.webm","./pofi_knock_a.webm","./pofi_spray.webm","./pofi_spray_a.webm","./splash.mp4","./splash_a.webm","./yapi/doku/altin.webp","./yapi/doku/bomba.webp","./yapi/doku/buz.webp","./yapi/doku/cam.webp","./yapi/doku/celik.webp","./yapi/doku/fici_kapak.webp","./yapi/doku/fici_yan.webp","./yapi/doku/hediye.webp","./yapi/doku/jole.webp","./yapi/doku/plat/ahsap_ust.webp","./yapi/doku/plat/ahsap_yan.webp","./yapi/doku/plat/buz_ust.webp","./yapi/doku/plat/buz_yan.webp","./yapi/doku/plat/harabe_direk.webp","./yapi/doku/plat/harabe_ust.webp","./yapi/doku/plat/harabe_yan.webp","./yapi/doku/plat/mercan_ust.webp","./yapi/doku/plat/mercan_yan.webp","./yapi/doku/plat/neon_ust.webp","./yapi/doku/plat/neon_yan.webp","./yapi/doku/plat/seker_ust.webp","./yapi/doku/plat/seker_yan.webp","./yapi/doku/plat/tas_ust.webp","./yapi/doku/plat/tas_yan.webp","./yapi/doku/recel_etiket.webp","./yapi/doku/sandik.webp","./yapi/doku/tugla.webp","./yapi/doku/yildiz.webp","./yapi/fon/cayir1.webp","./yapi/fon/cayir2.webp","./yapi/fon/cayir3.webp","./yapi/fon/cayir4.webp","./yapi/fon/col.webp","./yapi/fon/deniz.webp","./yapi/fon/harabe.webp","./yapi/fon/kar1.webp","./yapi/fon/kar2.webp","./yapi/fon/orman.webp","./yapi/fon/sahil1.webp","./yapi/fon/sahil2.webp","./yapi/fon/seker.webp","./yapi/fon/uzay.webp","./yapi/index.html","./yapi/kup_yuz.webp","./yapi/model/fici.glb","./yapi/model/kup.glb","./yapi/model/kup_ahsap.glb","./yapi/model/kup_kirmizi.glb","./yapi/model/kup_metal.glb","./yapi/model/platform_ahsap.glb","./yapi/model/platform_sirk.glb","./yapi/model/platform_tas.glb","./yapi/model/sandik.glb","./yapi/model/top.glb","./yapi/model/top_arabasi.glb","./yapi/oyun.js"];
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
  // v2.99: tarayici onbellegini atla (GitHub Pages 10 dk saklar), her zaman sunucuya sor
  const net=fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>{if(r&&r.ok)c.put(k,r.clone()).catch(()=>0);return r});
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
