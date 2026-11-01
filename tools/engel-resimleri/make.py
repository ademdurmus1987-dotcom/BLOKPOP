import sys, json, base64, io
import numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
def key(im):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    gr = g - np.maximum(r, b)
    al = np.clip(1 - (gr - 8) / 22, 0, 1)
    g2 = np.where(al < 1, np.minimum(g, np.maximum(r, b) + 4), g)
    return np.dstack([r, g2, b, al * 255])
def keyd(im, bgfix=None):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    bgc = np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0)
    if bgfix is not None: bgc = np.array(bgfix, np.float32)
    d = np.sqrt(((a - bgc) ** 2).sum(-1))
    al = np.clip((d - 13) / 18, 0, 1)
    return np.dstack([a, al * 255])
def trim(arr):
    ys, xs = np.where(arr[..., 3] > 20)
    return arr[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
def enc(arr, w):
    im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), 'RGBA')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    bio = io.BytesIO(); im.save(bio, 'WEBP', quality=86, method=6); im.save(out + '_' + str(w) + '_%d.png' % len(bio.getvalue()))
    return 'data:image/webp;base64,' + base64.b64encode(bio.getvalue()).decode()
res = {}
sheet = Image.open(src + '/2.jpg')
sys.path.insert(0, src + '/../ob'); sys.path.insert(0, __file__.rsplit('/', 1)[0] if '/' in __file__ else '.')
from boxes import B
for k, bx in B.items():
    arr = keyd(sheet.crop(bx), (57, 115, 76) if k == 'glass' else None); arr[:3, :, 3] = 0; arr[-3:, :, 3] = 0; arr[:, :3, 3] = 0; arr[:, -3:, 3] = 0
    res[k] = enc(trim(arr), 200)
cage = key(Image.open(src + '/1.jpg'))
r, g, b, al = cage[..., 0], cage[..., 1], cage[..., 2], cage[..., 3]
lum0 = 0.3 * r + 0.59 * g + 0.11 * b
mx = np.maximum(np.maximum(r, g), b)
wood = (r > g) & (g > b) & (r - b > 35) & ((mx - b) / (mx + 1) > 0.3) & (lum0 > 60) & (al > 200)
from PIL import ImageFilter, ImageDraw
poly = Image.new('L', (1600, 1600), 0); ImageDraw.Draw(poly).polygon([(800, 400), (1160, 560), (1160, 1090), (770, 1140), (445, 1090), (445, 580)], fill=1)
wood = wood & (np.asarray(poly) > 0)
wm = np.asarray(Image.fromarray((wood * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MinFilter(11)).filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
lum = (0.3 * r + 0.59 * g + 0.11 * b)
lv = np.clip(0.55 + (lum - 150) / 160, 0.35, 1.0) * 255
bars = cage.copy(); bars[..., 3] = al * (1 - wm)
fill = np.dstack([lv, lv, lv, wm * 255])
ys, xs = np.where(al > 20); bb = (slice(ys.min(), ys.max() + 1), slice(xs.min(), xs.max() + 1))
res['cage'] = enc(bars[bb], 340)
json.dump(res, open(out + '.json', 'w'))
print({k: len(v) for k, v in res.items()})
