#!/usr/bin/env node
// v3.10 engel sistemi hizli kontrol: her seviye acilir, mermi = kalan hasar denkligi ve engel dagilimi kontrol edilir.
// Kullanim: node tools/tests/ob-check.js [--from 1 --to 1000] [--dir beta] [--shots out_dir --levels 12,16,21]
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const A={};process.argv.slice(2).forEach((a,i,arr)=>{if(a.startsWith('--'))A[a.slice(2)]=arr[i+1]&&!arr[i+1].startsWith('--')?arr[i+1]:'true';});
const ROOT=path.resolve(__dirname,'..','..'),DIR=A.dir||'beta';
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.glb':'model/gltf-binary','.webm':'video/webm','.mp4':'video/mp4','.woff':'font/woff','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p.endsWith('/'))p+='index.html';const f=path.join(ROOT,p);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(b);});});
(async()=>{
await new Promise((res)=>srv.listen(0,'127.0.0.1',res));const base='http://127.0.0.1:'+srv.address().port;
const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:+(A.dpr||1),isMobile:true,hasTouch:true,locale:'tr-TR',serviceWorkers:'block'});
const pg=await ctx.newPage();const errs=[];pg.on('pageerror',(e)=>errs.push(e.message));pg.on('console',(m)=>{if(m.type()==='error')errs.push('console: '+m.text());});
await pg.goto(base+'/'+DIR+'/index.html'+(A.q||''),{waitUntil:'load'});
await pg.waitForFunction(()=>window.BP&&window.BlokpopUI&&document.querySelector('#btnPlay')&&!document.querySelector('#btnPlay').classList.contains('hidden'),null,{timeout:60000});
await pg.click('#btnPlay',{force:true});await pg.waitForSelector('[data-act="playCur"]',{state:'visible',timeout:30000});await pg.waitForTimeout(600);
await pg.click('[data-act="playCur"]',{force:true});await pg.waitForFunction(()=>window.BP&&BP.G&&BP.G.state,null,{timeout:30000});
if(A.shots){
  fs.mkdirSync(A.shots,{recursive:true});
  for(const L of A.levels.split(',').map(Number)){
    await pg.evaluate((L)=>{try{const S=BlokpopUI.S();S.seenOb={};}catch(e){}BlokpopUI.startLevel(L);},L);await pg.waitForTimeout(+(A.wait||2600));
    if(A.play){await pg.evaluate((n)=>{const g=BP.G;for(let k=0;k<n;k++){const ex=BP.exposed();for(let c=0;c<4;c++){const s=g.q[c][0];if(s&&(ex[s.c]>0||ex.any>0)&&!(s.frz>0)){BP.launchFromQueue(c);break;}}for(let j=0;j<12;j++)BP.update(0.05);}},+A.play);await pg.waitForTimeout(400);}
    await pg.screenshot({path:path.join(A.shots,'sv'+L+'.png'),timeout:180000});
  }
  console.log('ekran goruntuleri:',A.shots);
} else {
  const r=await pg.evaluate(([a,b])=>{
    const out={bad:[],kinds:{},none:[],combos:{},qk:{},err:[]};
    for(let L=a;L<=b;L++){try{BP.start(L);const g=BP.G;let am=0;g.q.forEach((c)=>c.forEach((s)=>{am+=s.a;}));
      if(am!==g.remPx)out.bad.push(L+':'+am+'/'+g.remPx);
      if(g.obOn){Object.keys(g.obKinds).forEach((k)=>{out.kinds[k]=(out.kinds[k]||0)+1;});const p=BP.obPlan(L);out.combos[p.key]=(out.combos[p.key]||0)+1;}else if(L>=12)out.none.push(L);
    }catch(e){out.err.push(L+':'+e.message);}}
    out.uniqueCombos=Object.keys(out.combos).length;delete out.combos;return out;},[+(A.from||1),+(A.to||1000)]);
  console.log(JSON.stringify(r,null,1));
}
if(errs.length)console.log('SAYFA HATALARI:',errs.slice(0,10));
await br.close();srv.close();
})();
