import json,struct,numpy as np,sys
d=open(sys.argv[1],'rb').read()
l=struct.unpack('<I',d[12:16])[0]; j=json.loads(d[20:20+l]); b0=20+l+8
def bv(i):
    v=j['bufferViews'][i]; o=b0+v.get('byteOffset',0); return d[o:o+v['byteLength']]
P=np.frombuffer(bv(0),np.float32).reshape(-1,3); UV=np.frombuffer(bv(2),np.float32).reshape(-1,2)
I=np.frombuffer(bv(3),np.uint32).reshape(-1,3).astype(np.int64)
inv=np.load('inv.npy'); n=inv.max()+1
Pw=np.zeros((n,3),np.float32); Pw[inv]=P
F=inv[I].astype(np.int32); U=UV[I].reshape(-1,6).astype(np.float32)
with open('in.bin','wb') as f:
    f.write(struct.pack('<ii',n,len(F))); f.write(Pw.tobytes()); f.write(F.tobytes()); f.write(U.tobytes())
for k in range(3):
    open(f'tex{k}.jpg','wb').write(bv(4+k))
