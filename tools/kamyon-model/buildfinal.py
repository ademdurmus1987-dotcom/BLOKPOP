# usage: buildfinal.py simplified.bin tint.webp out.glb
# Nodes: govde (body) + 4 wheel pivots (teker_on_sol...) whose meshes are centred on the axle so they can spin around local Z.
import json,struct,numpy as np,sys,os
inp,img,out=sys.argv[1:4]
d=open(inp,'rb').read(); nv,nt=struct.unpack('<ii',d[:8]); o=8
P=np.frombuffer(d[o:o+nv*12],np.float32).reshape(-1,3).astype(np.float64); o+=nv*12
F=np.frombuffer(d[o:o+nt*12],np.int32).reshape(-1,3); o+=nt*12
U=np.frombuffer(d[o:o+nt*24],np.float32).reshape(-1,3,2).copy()
fn=np.cross(P[F[:,1]]-P[F[:,0]],P[F[:,2]]-P[F[:,0]])
vn=np.zeros_like(P)
for k in range(3): np.add.at(vn,F[:,k],fn)
vn/=np.maximum(np.linalg.norm(vn,axis=1,keepdims=True),1e-12)
# wheels
WR=0.094; WY=0.089; WX={'on':-0.184,'arka':0.199}; ZIN=0.138
C=P[F].mean(1)
part=np.zeros(len(F),int)  # 0 body
wheels=[]
for nm,x in WX.items():
    for side,sz in (('sol',1),('sag',-1)):
        m=(np.hypot(C[:,0]-x,C[:,1]-WY)<WR)&(C[:,2]*sz>ZIN)
        wheels.append((f'teker_{nm}_{side}',np.array([x,WY,0.182*sz]),m))
        part[m]=len(wheels)
def build(mask,center):
    Fs=F[mask]; Us=U[mask]
    cv=Fs.reshape(-1); cuv=Us.reshape(-1,2).copy()
    TH=0.006; order=np.argsort(cv,kind='stable'); grp=np.empty(len(cv),np.int64); gid=-1; i=0
    while i<len(order):
        j=i
        while j<len(order) and cv[order[j]]==cv[order[i]]: j+=1
        cents=[];mem=[]
        for c in order[i:j]:
            for k,cu in enumerate(cents):
                if abs(cu[0]-cuv[c,0])+abs(cu[1]-cuv[c,1])<TH: mem[k].append(c); break
            else: cents.append(cuv[c].copy()); mem.append([c])
        for mm in mem: gid+=1; grp[mm]=gid; cuv[mm]=cuv[mm].mean(0)
        i=j
    first=np.zeros(gid+1,np.int64); first[grp]=np.arange(len(grp))
    pos=(P[cv[first]]-center).astype(np.float32)
    nor=np.round(vn[cv[first]]*127).astype(np.int8)
    nor4=np.zeros((len(nor),4),np.int8); nor4[:,:3]=nor
    uv=np.round(np.clip(cuv[first],0,1)*65535).astype(np.uint16)
    ind=grp.astype(np.uint16 if gid<65535 else np.uint32)
    return pos,nor4,uv,ind
prims=[('govde',np.zeros(3),part==0)]+[(n,c,m) for n,c,m in wheels]
buf=b''; bvs=[]; acc=[]
def add(b,target=None):
    global buf
    while len(buf)%4: buf+=b'\0'
    v={'buffer':0,'byteOffset':len(buf),'byteLength':len(b)}
    if target: v['target']=target
    bvs.append(v); buf+=b; return len(bvs)-1
meshes=[];nodes=[];total_v=0
for name,center,mask in prims:
    pos,nor,uv,ind=build(mask,center); total_v+=len(pos)
    a0=len(acc)
    acc.append({'bufferView':add(pos.tobytes(),34962),'componentType':5126,'count':len(pos),'type':'VEC3','min':pos.min(0).tolist(),'max':pos.max(0).tolist()})
    acc.append({'bufferView':add(nor.tobytes(),34962),'componentType':5120,'normalized':True,'count':len(pos),'type':'VEC3','byteOffset':0})
    bvs[-1]['byteStride']=4
    acc.append({'bufferView':add(uv.tobytes(),34962),'componentType':5123,'normalized':True,'count':len(pos),'type':'VEC2'})
    acc.append({'bufferView':add(ind.tobytes(),34963),'componentType':5123 if ind.dtype==np.uint16 else 5125,'count':len(ind),'type':'SCALAR'})
    meshes.append({'name':name,'primitives':[{'attributes':{'POSITION':a0,'NORMAL':a0+1,'TEXCOORD_0':a0+2},'indices':a0+3,'material':0}]})
    nodes.append({'name':name,'mesh':len(meshes)-1,'translation':[float(x) for x in center]})
    print(name,'verts',len(pos),'tris',len(ind)//3)
imv=add(open(img,'rb').read())
root={'name':'kamyon','children':list(range(1,len(nodes)+1))}
g={'asset':{'version':'2.0','generator':'blokpop-kamyon'},'scene':0,'scenes':[{'nodes':[0]}],
 'nodes':[root]+nodes,'meshes':meshes,
 'materials':[{'name':'kamyon','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':0.55}}],
 'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],
 'textures':[{'sampler':0,'extensions':{'EXT_texture_webp':{'source':0}}}],
 'images':[{'bufferView':imv,'mimeType':'image/webp'}],
 'accessors':acc,'bufferViews':bvs,'buffers':[{'byteLength':0}],
 'extensionsUsed':['EXT_texture_webp','KHR_mesh_quantization'],'extensionsRequired':['EXT_texture_webp','KHR_mesh_quantization'],
 'extras':{'not':'Her renkte boyamak icin dokunun alfa kanali govde maskesidir. Tekerlekler yerel Z ekseninde doner. On yon -X.'}}
for root_children in []: pass
# root children indices shift by 1 because root is node 0
while len(buf)%4: buf+=b'\0'
g['buffers'][0]['byteLength']=len(buf)
js=json.dumps(g,separators=(',',':'),ensure_ascii=True).encode()
while len(js)%4: js+=b' '
with open(out,'wb') as f:
    f.write(struct.pack('<III',0x46546C67,2,12+8+len(js)+8+len(buf))); f.write(struct.pack('<II',len(js),0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II',len(buf),0x004E4942)); f.write(buf)
print(out,os.path.getsize(out),'bytes; total verts',total_v)
