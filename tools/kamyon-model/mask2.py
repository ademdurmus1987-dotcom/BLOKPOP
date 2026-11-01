# Build tint texture: RGB = flat body blue * shade (keeps big darkening like windows, removes island blotches); A = tint mask
import cv2,numpy as np,sys
im=cv2.imread(sys.argv[1]); hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV).astype(np.float32)
H,S,V=hsv[...,0],hsv[...,1],hsv[...,2]
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
m=ss(30,70,S)*ss(70,110,V)*ss(80,95,H)*(1-ss(150,165,H))
m=cv2.GaussianBlur(m,(0,0),0.8)
lum=(0.3*im[...,2]+0.59*im[...,1]+0.11*im[...,0]).astype(np.float32)
avg=np.median(lum[m>0.8])
f=lum/avg
shade=np.where(f>0.78,1.0,np.clip(f/0.78,0.35,1.0))
shade=cv2.GaussianBlur(shade.astype(np.float32),(0,0),1.0)
flat=np.array([196,133,84],np.float32)  # BGR body blue
body=flat[None,None,:]*shade[...,None]
o=(im.astype(np.float32)*(1-m[...,None])+body*m[...,None]).clip(0,255).astype(np.uint8)
cv2.imwrite(sys.argv[2],np.dstack([o,(m*255).astype(np.uint8)]))
print('body frac',(m>0.5).mean(),'dark-body frac',((shade<0.9)&(m>0.5)).mean())
