#!/usr/bin/env python3
"""BLOKPOP Buz: buzun arkasindaki resimleri kup izgarasina boler ve
her kupun oyun rengini cikarir -> beta/buz/izgara.js

Resimler: beta/buz/resim/r*.webp (Buz'a ozel, 7:9; tools/buz-resim-ekle.py ile eklenir)
ve beta/bg/w01..w20 (dunya arka planlari, ortadan 7:9 kesilir). Sira: iki ozel resim, bir arka plan.

Boyutlar (sutun x sira, hepsi 7:9 oraninda): 14x18, 21x27, 28x36.
Seviye ilerledikce kupler kuculur (kenar 1/2 -> 1/4).
Her kup, altindaki resim parcasinin ortalama rengine gore bir kumeye girer; her kume
canli ve birbirinden ayri bir oyun rengine esitlenir (gokyuzu mavi, cimen yesil gibi).
3, 4, 5 ve 6 renkli surumler ayri hesaplanir; seviye kac renk isterse onu kullanir.

Kullanim (repo kokunden):  python3 tools/buz-izgara.py
Kontrol sayfasi:           tools/out/buz-izgara.png
"""
import colorsys
import glob
import json
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = [(14, 18), (21, 27), (28, 36)]
# canli, birbirinden kolay ayrilan oyun renkleri (buz altinda da okunur)
GAME = ['#3d9bff', '#43c94f', '#ff8c2e', '#ff5fa8', '#9b5cff', '#ffc93d']


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def dist(a, b):
    r = (a[0] + b[0]) / 2
    return ((2 + r / 256) * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + (2 + (255 - r) / 256) * (a[2] - b[2]) ** 2) ** 0.5


def boost(c):
    # karanlik/soluk resim renklerini eslestirme icin canlandir
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c))
    l = 0.35 + l * 0.4
    s = min(1, 0.35 + s * 1.2)
    return tuple(int(v * 255) for v in colorsys.hls_to_rgb(h, l, s))


def kmeans(pts, k, seed=7):
    rnd = random.Random(seed)
    cent = [pts[rnd.randrange(len(pts))]]
    while len(cent) < k:
        d = [min(dist(p, c) for c in cent) ** 2 for p in pts]
        x = rnd.random() * (sum(d) or 1)
        for p, dd in zip(pts, d):
            x -= dd
            if x <= 0:
                cent.append(p)
                break
        else:
            cent.append(pts[-1])
    lab = [0] * len(pts)
    for _ in range(25):
        lab = [min(range(k), key=lambda j: dist(p, cent[j])) for p in pts]
        new = []
        for j in range(k):
            m = [p for p, l in zip(pts, lab) if l == j]
            new.append(tuple(sum(v[i] for v in m) / len(m) for i in range(3)) if m else pts[rnd.randrange(len(pts))])
        if new == cent:
            break
        cent = new
    return lab, cent


def smooth(lab, w, h, passes=2):
    # komsularinin cogunlugundan farkli tek kalan kupu cogunluga katar (cok daginik olmasin)
    for _ in range(passes):
        out = lab[:]
        for r in range(h):
            for c in range(w):
                i = r * w + c
                nb = [lab[rr * w + cc] for rr, cc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)) if 0 <= rr < h and 0 <= cc < w]
                if nb.count(lab[i]) >= 2:
                    continue
                best = max(set(nb), key=nb.count)
                if nb.count(best) >= 2:
                    out[i] = best
        lab = out
    return lab


def sources():
    own = sorted(glob.glob(os.path.join(ROOT, 'beta', 'buz', 'resim', 'r*.webp')))
    bg = sorted(glob.glob(os.path.join(ROOT, 'beta', 'bg', 'w*.webp')))
    out = []
    while own or bg:
        for _ in range(2):
            if own:
                out.append(('own', own.pop(0)))
        if bg:
            out.append(('bg', bg.pop(0)))
    return out


def main():
    files = sources()
    pics = []
    cell = 5
    sheet = Image.new('RGB', (len(files) * (28 * cell + 10), 180 + 3 * (36 * cell + 10)), (250, 250, 255))
    for fi, (kind, f) in enumerate(files):
        im = Image.open(f).convert('RGB')
        iw, ih = im.size
        ch = min(ih, round(iw * 9 / 7))
        y0 = 0 if kind == 'own' else min(max(0, (ih - ch) // 2 + round(ih * 0.03)), ih - ch)
        crop = im.crop((0, y0, iw, y0 + ch))
        name = os.path.basename(f)[:-5]
        src = ('resim/' if kind == 'own' else '../bg/') + name + '.webp'
        entry = {'f': name, 'src': src, 'dim': [iw, ih], 'crop': [0, y0, iw, y0 + ch], 's': {}}
        sx = fi * (28 * cell + 10) + 5
        sheet.paste(crop.resize((28 * cell, 170)), (sx, 5))
        for si, (W, H) in enumerate(SIZES):
            small = crop.resize((W, H), Image.BOX)
            cells = [small.getpixel((c, r)) for r in range(H) for c in range(W)]
            ks = {}
            for k in (3, 4, 5, 6):
                lab, cent = kmeans(cells, k)
                lab = smooth(lab, W, H)
                used = sorted(set(lab), key=lambda j: -lab.count(j))
                pal, free = {}, GAME[:]
                for j in used:
                    tgt = boost(cent[j])
                    g = min(free, key=lambda hx: dist(rgb(hx), tgt))
                    free.remove(g)
                    pal[j] = g
                order = list(pal.keys())
                ks[str(k)] = {'pal': [pal[j] for j in order], 'g': ''.join(str(order.index(l)) for l in lab)}
            entry['s'][str(W)] = ks
            # kontrol: 4 renkli izgara
            d = ImageDraw.Draw(sheet)
            e = ks['4']
            for i, ch_ in enumerate(e['g']):
                r, c = divmod(i, W)
                cs = 28 * cell // W
                x = sx + c * cs
                y = 180 + si * (36 * cell + 10) + r * cs
                d.rectangle([x, y, x + cs - 1, y + cs - 1], fill=rgb(e['pal'][int(ch_)]))
        pics.append(entry)
        print('.', end='', flush=True)
    data = {'v': 3, 'sizes': [list(s) for s in SIZES], 'pics': pics}
    out = '// Otomatik uretildi: python3 tools/buz-izgara.py (elle duzenleme)\nvar BZ_IZGARA=' + json.dumps(data, separators=(',', ':')) + ';\nif(typeof module==="object"&&module.exports)module.exports=BZ_IZGARA;\n'
    open(os.path.join(ROOT, 'beta', 'buz', 'izgara.js'), 'w').write(out)
    os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'tools', 'out', 'buz-izgara.png'))
    print('\n%d resim -> beta/buz/izgara.js (%d KB), kontrol: tools/out/buz-izgara.png' % (len(pics), len(out) // 1024))


if __name__ == '__main__':
    main()
