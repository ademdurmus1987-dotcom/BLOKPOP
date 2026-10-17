const C='blokpop-v558';const F=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./items3d.js','./runpofi.js','./sfx.js','./avatars.js','./LICENSES.txt','./splash.mp4'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F).then(()=>Promise.all(['./evo.mp4','./evo.jpg'].map(u=>fetch(u).then(r=>r.ok?c.put(u,r):0).catch(()=>0))))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// iOS Safari needs HTTP Range answers for <video>; serve them from the cache (206 slices)
async function videoResp(r){
  const c=await caches.open(C);let res=await c.match(r.url);
  if(!res){try{const n=await fetch(r.url);if(!n.ok)return n;await c.put(r.url,n.clone());res=n}catch(x){return Response.error()}}
  const h=r.headers.get('range');if(!h)return res;
  const buf=await res.arrayBuffer(),m=/bytes=(\d*)-(\d*)/.exec(h)||[];
  const s=m[1]?+m[1]:0;let en=m[2]?+m[2]:buf.byteLength-1;en=Math.min(en,buf.byteLength-1);
  return new Response(buf.slice(s,en+1),{status:206,statusText:'Partial Content',headers:{'Content-Type':'video/mp4','Content-Range':'bytes '+s+'-'+en+'/'+buf.byteLength,'Content-Length':String(en-s+1),'Accept-Ranges':'bytes'}});
}
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;
  if(new URL(r.url).pathname.endsWith('.mp4')){e.respondWith(videoResp(r));return}
  e.respondWith(caches.match(r).then(x=>x||fetch(r)))});
