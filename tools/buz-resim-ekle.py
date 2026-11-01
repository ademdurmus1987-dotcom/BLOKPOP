#!/usr/bin/env python3
"""BLOKPOP Buz: buzun altina girecek yeni resimleri ekler.

Gorselleri (zip, klasor ya da tek tek dosya) alir ve beta/buz/resim/r001.webp, r002.webp ...
olarak 720x926 (7:9) kaydeder. Iki tur gorsel taninir:
  - Duz arka planli (beyaz ya da tek renk zemin uzerinde karakter/nesne, ornegin piksel resimler):
    ozne kesilir, tahtayi dolduracak sekilde buyutulur, zemin pastel renkli piksel desenle
    degistirilir (beyaz yuz/gobek gibi ozne icindeki acik renkler korunur).
  - Tam sahne (zemin her yerde farkli): ortadan 7:9 kesilir.
Ayni (ya da cok benzeyen) gorsel ikinci kez verilirse atlanir: beta/buz/resim/liste.json.
Sonunda kup renklerini yeniden uretir (buz-izgara.py).

Kullanim (repo kokunden):
    python3 tools/buz-resim-ekle.py resimler.zip [baska.zip klasor/ a.png ...]
    --izgarasiz : kup renklerini uretme (cok parcali eklemede son adimda calistir)
Kontrol: tools/out/buz-resim.png (eklenen resimlerin kucuk hali)
"""
import colorsys
import hashlib
import io
import json
import os
import subprocess
import sys
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'beta', 'buz', 'resim')
LIST = os.path.join(OUT, 'liste.json')
W, H = 720, 926   # 7:9
EXT = ('.png', '.jpg', '.jpeg', '.webp')
# pastel zeminler: oznenin baskin rengine en uzak olan secilir (kupler ozneden ayri renge duser)
PASTEL = ['#bfe3ff', '#c8f1cf', '#ffe0c0', '#ffd0e4', '#e0d3ff', '#fff0ad']


def inputs(args):
    for a in args:
        if os.path.isdir(a):
            for n in sorted(os.listdir(a)):
                if n.lower().endswith(EXT):
                    yield n, open(os.path.join(a, n), 'rb').read()
        elif a.lower().endswith('.zip'):
            with zipfile.ZipFile(a) as z:
                for n in z.namelist():
                    b = os.path.basename(n)
                    if b.lower().endswith(EXT) and not b.startswith('.'):
                        yield b, z.read(n)
        elif a.lower().endswith(EXT):
            yield os.path.basename(a), open(a, 'rb').read()


def hexrgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.float32)


def border_bg(a):
    """kenar pikselleri tek renkse o rengi dondur, degilse None"""
    h, w, _ = a.shape
    b = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]).astype(np.float32)
    med = np.median(b, axis=0)
    d = np.linalg.norm(b - med, axis=1)
    return med if (d < 30).mean() > 0.55 else None


def dhash(img):
    g = np.asarray(img.convert('L').resize((17, 16), Image.BILINEAR), dtype=np.int16)
    return ''.join('1' if v else '0' for v in (g[:, 1:] > g[:, :-1]).flatten())


def ham(a, b):
    return sum(x != y for x, y in zip(a, b))


def subject_pic(a, bg, salt):
    """duz zeminli gorsel -> pastel zeminde, tahtayi dolduran ozne"""
    f = a.astype(np.float32)
    dist = np.linalg.norm(f - bg, axis=2)
    near = dist < 42
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bgm = np.isin(lab, list(edge))
    subj = ~bgm
    # kucuk kirintilari at (sikistirma lekesi), ozne kutusunu bul
    sl, sn = ndimage.label(subj)
    if sn == 0:
        return None, None
    sizes = ndimage.sum(subj, sl, range(1, sn + 1))
    hh, ww = a.shape[:2]
    objs = ndimage.find_objects(sl)
    def ok(i, s):
        if s < max(30, sizes.max() * 0.004):
            return False
        ys_, xs_ = objs[i]
        th = ys_.stop - ys_.start, xs_.stop - xs_.start
        edge = ys_.start <= 1 or xs_.start <= 1 or ys_.stop >= hh - 1 or xs_.stop >= ww - 1
        if edge and min(th) < 0.07 * min(hh, ww) and s < sizes.max() * 0.2:   # kenardaki ince serit
            return False
        band = th[0] >= 0.9 * hh or th[1] >= 0.9 * ww   # kenar boyu dolu renk bandi (arka plan parcasi)
        return not (edge and band and s > 0.9 * th[0] * th[1] and s < sizes.max() * 0.6)
    keep = np.isin(sl, [i + 1 for i, s in enumerate(sizes) if ok(i, s)])
    ys, xs = np.where(keep)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    if keep.sum() > 0.9 * (y1 - y0) * (x1 - x0) and (y1 - y0) * (x1 - x0) > 0.3 * hh * ww:   # cerceveli/tam dolu sahne
        return 'sahne', Image.fromarray(a[y0:y1, x0:x1])
    top, bot, lft, rgt = y0 <= 2, y1 >= hh - 2, x0 <= 2, x1 >= ww - 2   # ozne gorselin kenarinda kesilmis mi
    if top + bot + lft + rgt >= 3:   # resim her yani dolduruyor: sahne gibi kes
        return 'sahne', Image.fromarray(a[y0:y1, x0:x1])
    # kenar yumusatma: zemine yakin ozne pikselleri icin alfa
    alpha = np.clip((dist - 42) / 70.0, 0, 1)
    alpha[bgm] = 0
    alpha[keep & (dist >= 112)] = 1
    near_bg = ndimage.binary_dilation(bgm, iterations=2)
    alpha = np.where(near_bg | bgm, alpha, np.where(keep, 1.0, alpha))
    crop = a[y0:y1, x0:x1]
    al = alpha[y0:y1, x0:x1]
    ch, cw = crop.shape[:2]
    wmax = 0.95 if cw / ch > 1.4 else 0.86
    if bot:   # alttan kesik ozne tahtanin altina oturur
        s = min(W * 0.92 / cw, H * (1.0 if top else 0.86) / ch)
    else:
        s = min(W * wmax / cw, H * 0.8 / ch)
    nw, nh = max(1, round(cw * s)), max(1, round(ch * s))
    rs = Image.NEAREST if s > 1 else Image.LANCZOS
    sub = np.asarray(Image.fromarray(crop).resize((nw, nh), rs), dtype=np.float32)
    sal = np.asarray(Image.fromarray((al * 255).astype(np.uint8)).resize((nw, nh), rs), dtype=np.float32)[..., None] / 255
    # zemin rengi: hazir pastel zemin varsa onu, yoksa ozneye en uzak pastel
    if bg.mean() < 245 and bg.max() - bg.min() > 18:
        base = bg
    else:
        px = crop[al > 0.9].reshape(-1, 3).astype(np.float32) / 255
        hs = np.array([colorsys.rgb_to_hsv(*p) for p in px[:: max(1, len(px) // 4000)]])
        wgt = hs[:, 1] * hs[:, 2]
        ang = hs[:, 0] * 2 * np.pi
        mh = (np.arctan2((np.sin(ang) * wgt).sum(), (np.cos(ang) * wgt).sum()) / (2 * np.pi)) % 1
        def hd(hx):
            r, g, b = hexrgb(hx) / 255
            ph = colorsys.rgb_to_hsv(r, g, b)[0]
            d = abs(ph - mh)
            return min(d, 1 - d)
        order = sorted(range(len(PASTEL)), key=lambda i: -hd(PASTEL[i]))
        base = hexrgb(PASTEL[order[salt % 2]])
    # piksel desenli zemin: buyuk kareler hafif acik/koyu, ortasi aydinlik
    cell = 36
    yy, xx = np.mgrid[0:H, 0:W]
    chk = (((yy // cell) + (xx // cell)) % 2) * 2 - 1
    r = np.hypot((xx - W / 2) / W, (yy - H * 0.5) / H)
    light = 1.06 - r * 0.22 + chk * 0.025
    out = np.clip(base[None, None, :] * light[..., None], 0, 255)
    # golge: oznenin altinda koyu elips (piksel gibi basamakli)
    ox, oy = round((W - nw) / 2), round(H * 0.54 - nh / 2)
    oy = min(max(8, oy), H - nh - 8)
    if bot:
        oy = H - nh
    else:
        cx, cy = W / 2, oy + nh
        ex = ((xx // 12 * 12 - cx) / (nw * 0.42)) ** 2 + ((yy // 12 * 12 - cy) / max(18, nh * 0.06)) ** 2
        out[ex < 1] *= 0.86
    reg = out[oy:oy + nh, ox:ox + nw]
    out[oy:oy + nh, ox:ox + nw] = reg * (1 - sal) + sub * sal
    return Image.fromarray(out.astype(np.uint8)), Image.fromarray(crop)


def scene_pic(im):
    iw, ih = im.size
    if iw / ih > W / H:
        nw = round(ih * W / H)
        x0 = (iw - nw) // 2
        im = im.crop((x0, 0, x0 + nw, ih))
    else:
        nh = round(iw * H / W)
        y0 = max(0, min(ih - nh, (ih - nh) // 2 - round(ih * 0.01)))
        im = im.crop((0, y0, iw, y0 + nh))
    return im.resize((W, H), Image.LANCZOS)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        return
    os.makedirs(OUT, exist_ok=True)
    lst = json.load(open(LIST)) if os.path.exists(LIST) else {}
    nums = [int(n[1:4]) for n in os.listdir(OUT) if n.startswith('r') and n.endswith('.webp') and n[1:4].isdigit()]
    k = max(nums) if nums else 0
    added = []
    for name, data in inputs(args):
        try:
            im = Image.open(io.BytesIO(data)).convert('RGB')
        except Exception as e:  # bozuk dosya
            print('atlandi:', name, e)
            continue
        a = np.asarray(im)
        bg = border_bg(a)
        if bg is not None:
            pic, key = subject_pic(a, bg, k + 1)
            if pic is None:
                print('bos gorsel:', name)
                continue
            kind = 'ozne'
            if pic == 'sahne':
                pic, kind = scene_pic(key), 'sahne'
        else:
            pic, key, kind = scene_pic(im), im, 'sahne'
        h = dhash(key)
        dup = next((f for f, v in lst.items() if ham(v['h'], h) <= 22), None)
        if dup:
            print('benzeri var:', name, '->', dup)
            continue
        k += 1
        fn = 'r%03d.webp' % k
        pic.save(os.path.join(OUT, fn), 'WEBP', quality=86, method=6)
        lst[fn] = {'h': h, 'src': name, 'tur': kind}
        added.append(pic)
        print(name, '->', fn, kind)
    json.dump(lst, open(LIST, 'w'), indent=0, ensure_ascii=False)
    if not added:
        print('yeni resim yok')
        return
    tw, th = 112, 144
    cols = 10
    sheet = Image.new('RGB', (min(cols, len(added)) * (tw + 4) + 4, ((len(added) + cols - 1) // cols) * (th + 4) + 4), (255, 255, 255))
    for i, im in enumerate(added):
        sheet.paste(im.resize((tw, th)), (4 + (i % cols) * (tw + 4), 4 + (i // cols) * (th + 4)))
    os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'tools', 'out', 'buz-resim.png'))
    print('%d resim eklendi (toplam %d).' % (len(added), len(lst)))
    if '--izgarasiz' not in sys.argv:
        print('Kup renkleri yeniden uretiliyor...')
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'buz-izgara.py')], check=True)


if __name__ == '__main__':
    main()
