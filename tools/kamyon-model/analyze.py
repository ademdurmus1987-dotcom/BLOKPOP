import json,struct,numpy as np,sys
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
d=open(sys.argv[1],'rb').read()
l=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+l]); b0=20+l+8
def bv(i):
    v=j['bufferViews'][i]; o=b0+v.get('byteOffset',0); return d[o:o+v['byteLength']]
P=np.frombuffer(bv(0),np.float32).reshape(-1,3)
ia=j['accessors'][3]; print(ia['componentType'])
I=np.frombuffer(bv(3),np.uint32 if ia['componentType']==5125 else np.uint16).reshape(-1,3)
q=np.round(P*1e5).astype(np.int64)
_,inv=np.unique(q,axis=0,return_inverse=True); inv=inv.ravel()
print('verts',len(P),'welded',inv.max()+1,'tris',len(I))
F=inv[I]
n=inv.max()+1
e=np.concatenate([F[:,[0,1]],F[:,[1,2]]])
g=coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(n,n))
nc,lab=connected_components(g,directed=False)
cnt=np.bincount(lab)
o=np.argsort(-cnt)
print('components',nc)
Pw=np.zeros((n,3)); Pw[inv]=P
for k in o[:15]:
    m=lab==k; pp=Pw[m]
    print(k,cnt[k],pp.min(0).round(3),pp.max(0).round(3))
np.save('/home/claude/work/lab.npy',lab); np.save('/home/claude/work/inv.npy',inv)
