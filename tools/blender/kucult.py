# BLOKPOP Yapi - Adem'in yeni Tripo modellerini oyuna uygun hale getirir (GitHub Actions'ta calisir).
# Girdi: beta/yapi/model/kaynak/<ad>.glb (Adem'in orijinali, dokunulmaz)
# Cikti: beta/yapi/model/<ad>.glb  - ucgen sayisi ~hedefe indirilir; renk, doku ve malzeme aynen kalir.
#
#   blender -b --factory-startup -P tools/blender/kucult.py -- <kaynak_klasoru> <cikti_klasoru> [hedef_ucgen]

import bpy, bmesh, sys, os, glob

argv = sys.argv[sys.argv.index('--') + 1:]
SRC, DST = argv[0], argv[1]
TARGET = int(argv[2]) if len(argv) > 2 else 6000
os.makedirs(DST, exist_ok=True)

for path in sorted(glob.glob(os.path.join(SRC, '*.glb'))):
    name = os.path.splitext(os.path.basename(path))[0]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    tri0 = 0
    for o in meshes:
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bm.to_mesh(o.data); bm.free()
        tri0 += sum(len(p.vertices) - 2 for p in o.data.polygons)
    # korsan modunun buyuk modelleri (gemiler, kule adasi, sal) ekrani doldurdugu icin tam ayrintida kalir; sadece doku JPEG'e cevrilir
    hedef = 20000 if name in ('bizim_gemi', 'dusman_gemi', 'kule_ada', 'sal') else TARGET
    ratio = min(1.0, hedef / max(1, tri0))
    for o in meshes:
        if ratio < 1.0:
            m = o.modifiers.new('kucult', 'DECIMATE')
            m.ratio = ratio
            m.use_collapse_triangulate = True
    out = os.path.join(DST, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_apply=True, export_yup=True,
                              export_image_format='JPEG', export_jpeg_quality=90)
    print('KUCULT', name, tri0, '->', int(tri0 * ratio), 'ucgen,', round(os.path.getsize(out) / 1024), 'kb')
print('BITTI kucult')
