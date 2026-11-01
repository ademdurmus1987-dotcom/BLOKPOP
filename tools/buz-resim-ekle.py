#!/usr/bin/env python3
"""BLOKPOP Buz: buzun altina girecek yeni resimleri ekler.

Gemini'den gelen gorselleri (zip, klasor ya da tek tek dosya) alir, ortadan 7:9 oraninda
keser, 720x926 boyutuna getirir ve beta/buz/resim/r001.webp, r002.webp ... diye kaydeder.
Ayni gorsel ikinci kez verilirse atlanir. Sonunda kup renklerini yeniden uretir (buz-izgara.py).

Kullanim (repo kokunden):
    python3 tools/buz-resim-ekle.py resimler.zip
    python3 tools/buz-resim-ekle.py klasor/            (ya da: a.png b.jpg ...)
Kontrol: tools/out/buz-resim.png (eklenen resimlerin kucuk hali)
"""
import hashlib
import io
import os
import subprocess
import sys
import zipfile

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'beta', 'buz', 'resim')
W, H = 720, 926   # 7:9
EXT = ('.png', '.jpg', '.jpeg', '.webp')


def inputs(args):
    for a in args:
        if os.path.isdir(a):
            for n in sorted(os.listdir(a)):
                if n.lower().endswith(EXT):
                    p = os.path.join(a, n)
                    yield n, open(p, 'rb').read()
        elif a.lower().endswith('.zip'):
            with zipfile.ZipFile(a) as z:
                for n in sorted(z.namelist()):
                    if n.lower().endswith(EXT) and not os.path.basename(n).startswith('.'):
                        yield os.path.basename(n), z.read(n)
        elif a.lower().endswith(EXT):
            yield os.path.basename(a), open(a, 'rb').read()


def fit79(im):
    im = im.convert('RGB')
    iw, ih = im.size
    if iw / ih > W / H:   # genis: yanlardan kes
        nw = round(ih * W / H)
        x0 = (iw - nw) // 2
        im = im.crop((x0, 0, x0 + nw, ih))
    else:                 # uzun: alt ve ustten kes (biraz yukarida tut, ozne genelde ortada)
        nh = round(iw * H / W)
        y0 = max(0, min(ih - nh, (ih - nh) // 2 - round(ih * 0.01)))
        im = im.crop((0, y0, iw, y0 + nh))
    return im.resize((W, H), Image.LANCZOS)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    os.makedirs(OUT, exist_ok=True)
    have = {}
    for n in os.listdir(OUT):
        if n.endswith('.webp'):
            have[hashlib.md5(open(os.path.join(OUT, n), 'rb').read()).hexdigest()] = n
    nums = [int(n[1:4]) for n in os.listdir(OUT) if n.startswith('r') and n.endswith('.webp') and n[1:4].isdigit()]
    k = max(nums) if nums else 0
    added = []
    seen = set()
    for name, data in inputs(sys.argv[1:]):
        h0 = hashlib.md5(data).hexdigest()
        if h0 in seen:
            continue
        seen.add(h0)
        try:
            im = fit79(Image.open(io.BytesIO(data)))
        except Exception as e:  # bozuk dosya
            print('atlandi:', name, e)
            continue
        buf = io.BytesIO()
        im.save(buf, 'WEBP', quality=84, method=6)
        h = hashlib.md5(buf.getvalue()).hexdigest()
        if h in have:
            print('zaten var:', name, '->', have[h])
            continue
        k += 1
        fn = 'r%03d.webp' % k
        open(os.path.join(OUT, fn), 'wb').write(buf.getvalue())
        have[h] = fn
        added.append((name, fn, im))
        print(name, '->', fn)
    if not added:
        print('yeni resim yok')
        return
    # kontrol sayfasi
    tw, th = 140, 180
    sheet = Image.new('RGB', (min(8, len(added)) * (tw + 6) + 6, ((len(added) + 7) // 8) * (th + 6) + 6), (250, 250, 255))
    for i, (_, _, im) in enumerate(added):
        sheet.paste(im.resize((tw, th)), (6 + (i % 8) * (tw + 6), 6 + (i // 8) * (th + 6)))
    os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
    sheet.save(os.path.join(ROOT, 'tools', 'out', 'buz-resim.png'))
    print('%d resim eklendi. Kup renkleri yeniden uretiliyor...' % len(added))
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'buz-izgara.py')], check=True)


if __name__ == '__main__':
    main()
