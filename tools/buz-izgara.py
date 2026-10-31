#!/usr/bin/env python3
"""BLOKPOP Buz: buzun arkasindaki resimleri (beta/bg/w01..w20) 7x9 bloga boler ve
her blogun oyun rengini cikarir -> beta/buz/izgara.js

Her blok, altindaki resim parcasinin ortalama rengine gore bir kumeye girer; her kume
canli ve birbirinden ayri bir oyun rengine esitlenir (gokyuzu mavi, cimen yesil gibi).
3, 4, 5 ve 6 renkli surumler ayri ayri hesaplanir; seviye kac renk isterse onu kullanir.

Kullanim (repo kokunden):  python3 tools/buz-izgara.py
Kontrol sayfasi:           tools/out/buz-izgara.png
"""
import glob
import json
import os
import random

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W, H = 7, 9
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
    import colorsys
    h, l, s = colorsys.rgb_to_hls(*(v / 255 for v in c))
    l = 0.35 + l * 0.4
    s = min(1, 0.35 + s * 1.2)
    return tuple(int(v * 255) for v in colorsys.hls_to_rgb(h, l, s))


def kmeans(pts, k, seed=7):
    rnd = random.Random(seed)
    cent = [pts[rnd.randrange(len(pts))]]
    while len(cent) < k:
        d = [min(dist(p, c) for c in cent) ** 2 for p in pts]
        tot = sum(d) or 1
        x = rnd.random() * tot
        for p, dd in zip(pts, d):
            x -= dd
            if x <= 0:
                cent.append(p)
                break
        else:
            cent.append(pts[-1])
    lab = [0] * len(pts)
    for _ in range(30):
        lab = [min(range(k), key=lambda j: dist(p, cent[j])) for p in pts]
        new = []
        for j in range(k):
            m = [p for p, l in zip(pts, lab) if l == j]
            new.append(tuple(sum(v[i] for v in m) / len(m) for i in range(3)) if m else pts[rnd.randrange(len(pts))])
        if new == cent:
            break
        cent = new
    return lab, cent


def smooth(lab):
    # tek basina kalan blogu komsularinin cogunluguna katar (cok daginik olmasin)
    out = lab[:]
    for r in range(H):
        for c in range(W):
            i = r * W + c
            nb = [lab[rr * W + cc] for rr, cc in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)) if 0 <= rr < H and 0 <= cc < W]
            if lab[i] in nb:
                continue
            best = max(set(nb), key=nb.count)
            if nb.count(best) >= 2:
                out[i] = best
    return out


def main():
    files = sorted(glob.glob(os.path.join(ROOT, 'beta', 'bg', 'w*.webp')))
    pics = []
    sheet = Image.new('RGB', (len(files) * 150, 4 * 190 + 10), (250, 250, 255))
    for fi, f in enumerate(files):
        im = Image.open(f).convert('RGB')
        iw, ih = im.size
        ch = round(iw * H / W)
        y0 = max(0, (ih - ch) // 2 + round(ih * 0.03))
        y0 = min(y0, ih - ch)
        crop = im.crop((0, y0, iw, y0 + ch))
        small = crop.resize((W * 8, H * 8), Image.BOX)
        cells = []
        for r in range(H):
            for c in range(W):
                blk = small.crop((c * 8, r * 8, c * 8 + 8, r * 8 + 8)).resize((1, 1), Image.BOX).getpixel((0, 0))
                cells.append(blk)
        entry = {'f': os.path.basename(f)[:-5], 'crop': [0, y0, iw, y0 + ch], 'k': {}}
        for k in (3, 4, 5, 6):
            lab, cent = kmeans(cells, k)
            lab = smooth(lab)
            used = sorted(set(lab), key=lambda j: -lab.count(j))
            pal, free = {}, GAME[:]
            for j in used:
                tgt = boost(cent[j])
                g = min(free, key=lambda h: dist(rgb(h), tgt))
                free.remove(g)
                pal[j] = g
            order = list(pal.keys())
            entry['k'][str(k)] = {'pal': [pal[j] for j in order], 'g': ''.join(str(order.index(l)) for l in lab)}
        pics.append(entry)
        # kontrol sayfasi: resim + 4 ve 5 renkli izgara
        sheet.paste(crop.resize((140, 180)), (fi * 150 + 5, 5))
        for row, k in enumerate(('3', '4', '5')):
            d = ImageDraw.Draw(sheet)
            e = entry['k'][k]
            for i, ch_ in enumerate(e['g']):
                r, c = divmod(i, W)
                x = fi * 150 + 5 + c * 20
                y = 195 + row * 190 + r * 20
                d.rectangle([x, y, x + 18, y + 18], fill=rgb(e['pal'][int(ch_)]))
    out = '// Otomatik uretildi: python3 tools/buz-izgara.py (elle duzenleme)\nvar BZ_IZGARA=' + json.dumps({'v': 1, 'W': W, 'H': H, 'pics': pics}, separators=(',', ':')) + ';\nif(typeof module==="object"&&module.exports)module.exports=BZ_IZGARA;\n'
    open(os.path.join(ROOT, 'beta', 'buz', 'izgara.js'), 'w').write(out)
    os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'tools', 'out', 'buz-izgara.png'))
    print('%d resim -> beta/buz/izgara.js (%d KB), kontrol: tools/out/buz-izgara.png' % (len(pics), len(out) // 1024))


if __name__ == '__main__':
    main()
