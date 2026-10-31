#!/usr/bin/env python3
"""BLOKPOP: boyama galerisi icin resimlerin ASLINI (Gemini'den gelen orijinal gorselleri) oyuna ekler.

Kullanim (repo kokunden):
    python3 tools/orijinal-ekle.py resimler.zip
    python3 tools/orijinal-ekle.py klasor/ baska.zip tek_resim.png
    python3 tools/orijinal-ekle.py --dir . resimler.zip     # ana surume ekle (varsayilan: beta)

Dosya adlari onemli degil: her gorsel, oyundaki piksel resimlerle karsilastirilip en cok
benzeyenle eslestirilir. Sonuc:
    <surum>/orig/<resim_adi>.webp   (en fazla 720 piksel, kucuk boyut)
    <surum>/orig/list.json          (oyun galeride bunu okur)
    tools/out/orijinal-eslesme.png  (kontrol sayfasi: solda gelen gorsel, sagda eslestigi oyun resmi)
Gerekli: Pillow (pip install pillow)
"""
import argparse
import io
import json
import os
import re
import sys
import zipfile

try:
    from PIL import Image
except ImportError:
    sys.exit('Pillow gerekli: pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG_EXT = ('.png', '.jpg', '.jpeg', '.webp')
GRID = 12          # karsilastirma icin iki resim de 12x12'ye kucultulur
MAX_SIDE = 720     # kaydedilen orijinalin en uzun kenari


def load_lib(index_path):
    s = open(index_path, encoding='utf-8').read()
    m = re.search(r'const LIB=(\{.*?\});\s*\n', s, re.S)
    if not m:
        sys.exit('LIB bulunamadi: ' + index_path)
    lib = json.loads(m.group(1))
    pics = []
    for i, (name, n, pal, rle) in enumerate(lib['pics']):
        flat = []
        for ch, k in re.findall(r'([A-Z.])(\d*)', rle):
            flat.extend([None if ch == '.' else ord(ch) - 65] * (int(k) if k else 1))
        rgb = []
        for v in flat[:n * n]:
            if v is None or v >= len(pal):
                rgb.append((255, 255, 255))
            else:
                h = pal[v].lstrip('#')
                rgb.append((int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)))
        im = Image.new('RGB', (n, n))
        im.putdata(rgb)
        pics.append({'i': i, 'name': name, 'img': im})
    levels = {}
    for L, (pi, mir) in enumerate(lib['order'], start=1):
        levels.setdefault(lib['pics'][pi][0], []).append(L)
    return pics, levels


def square(im):
    w, h = im.size
    s = min(w, h)
    return im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s))


def small(im):
    b = square(im.convert('RGB')).resize((GRID, GRID), Image.BOX).tobytes()
    return [tuple(b[i:i + 3]) for i in range(0, len(b), 3)]


def dist(a, b):
    return sum((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2 for p, q in zip(a, b)) / len(a)


def collect(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            for dp, _, fs in os.walk(p):
                for f in sorted(fs):
                    if f.lower().endswith(IMG_EXT) and not f.startswith('.'):
                        out.append((f, open(os.path.join(dp, f), 'rb').read()))
        elif p.lower().endswith('.zip'):
            with zipfile.ZipFile(p) as z:
                for f in sorted(z.namelist()):
                    base = os.path.basename(f)
                    if base.lower().endswith(IMG_EXT) and not base.startswith('.') and '__MACOSX' not in f:
                        out.append((base, z.read(f)))
        elif p.lower().endswith(IMG_EXT):
            out.append((os.path.basename(p), open(p, 'rb').read()))
        else:
            print('  atlandi (resim/zip/klasor degil): ' + p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--dir', default='beta')
    ap.add_argument('--hepsi', action='store_true', help='tum oyun resimleriyle karsilastir (varsayilan: once px_ ve w2_ resimleri)')
    a = ap.parse_args()
    vdir = os.path.join(ROOT, a.dir)
    pics, levels = load_lib(os.path.join(vdir, 'index.html'))
    pref = [p for p in pics if a.hepsi or re.match(r'^(px_|w\d+_)', p['name'])] or pics
    for p in pref:
        p['s'] = small(p['img'])
    odir = os.path.join(vdir, 'orig')
    os.makedirs(odir, exist_ok=True)
    lst_path = os.path.join(odir, 'list.json')
    lst = json.load(open(lst_path)) if os.path.exists(lst_path) else {'v': 1, 'files': {}}
    files = collect(a.inputs)
    if not files:
        sys.exit('Resim bulunamadi.')
    pairs, unsure = [], []
    for fname, data in files:
        try:
            im = Image.open(io.BytesIO(data))
            im.load()
        except Exception as e:
            print('  okunamadi: %s (%s)' % (fname, e))
            continue
        sm = small(im)
        sc = sorted(((dist(sm, p['s']), p) for p in pref), key=lambda x: x[0])
        best, second = sc[0], sc[1] if len(sc) > 1 else (1e9, None)
        sure = best[0] < 2500 and best[0] < second[0] * 0.75
        p = best[1]
        out = square(im.convert('RGB')) if im.size[0] != im.size[1] else im.convert('RGB')
        if max(out.size) > MAX_SIDE:
            out = out.resize((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        fn = p['name'] + '.webp'
        out.save(os.path.join(odir, fn), 'WEBP', quality=80, method=6)
        lst['files'][p['name']] = fn
        pairs.append((fname, im, p, best[0], sure))
        if not sure:
            unsure.append(fname + ' -> ' + p['name'])
    json.dump(lst, open(lst_path, 'w'), ensure_ascii=False, indent=0, sort_keys=True)
    # kontrol sayfasi
    os.makedirs(os.path.join(ROOT, 'tools', 'out'), exist_ok=True)
    cell = 120
    sheet = Image.new('RGB', (cell * 2 + 30, max(1, len(pairs)) * (cell + 10) + 10), (240, 240, 250))
    for k, (fname, im, p, d, sure) in enumerate(pairs):
        y = 10 + k * (cell + 10)
        sheet.paste(square(im.convert('RGB')).resize((cell, cell)), (10, y))
        sheet.paste(p['img'].resize((cell, cell), Image.NEAREST), (cell + 20, y))
        if not sure:
            for x in range(cell * 2 + 30):
                sheet.putpixel((x, y + cell + 4), (255, 0, 0))
    sheet_path = os.path.join(ROOT, 'tools', 'out', 'orijinal-eslesme.png')
    sheet.save(sheet_path)
    # ozet
    print('%d gorsel eklendi -> %s/orig/' % (len(pairs), a.dir))
    for fname, im, p, d, sure in pairs:
        print('  %-40s -> %-22s seviye %-10s %s' % (fname[:40], p['name'], ','.join(map(str, levels.get(p['name'], [])[:4])) or '-', '' if sure else '(EMIN DEGIL)'))
    have = set(lst['files'])
    miss = [L for L in range(1, 101) for name, ls in levels.items() if L in ls and name not in have]
    print('Orijinali olan seviye sayisi (1-100): %d/100' % (100 - len(set(miss))))
    if miss:
        print('Orijinali eksik seviyeler (1-100): ' + ', '.join(map(str, sorted(set(miss)))))
    if unsure:
        print('Kontrol edilmesi gerekenler: ' + '; '.join(unsure))
    print('Kontrol sayfasi: ' + os.path.relpath(sheet_path, ROOT))


if __name__ == '__main__':
    main()
