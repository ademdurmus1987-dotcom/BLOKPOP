# BLOKPOP Yapi - blok modellerini parcalara bolen Blender scripti (GitHub Actions'ta calisir).
# Adem'in Tripo modelleri orijinal renk ve dokusuyla kalir; hicbir renk degistirilmez.
# Kirik (ic) yuzeyler: modelin kendi dokusunun ortalama renginin biraz koyusu.
#
# Kullanim:
#   blender -b --factory-startup -P tools/blender/parcala.py -- <girdi_klasoru> <cikti_klasoru> <onizleme_klasoru> <ad1,ad2,...> [parca_sayisi]
#
# Cikti: <ad>_parcali.glb (her parca ayri nesne: p00, p01, ...; her parcanin merkezi kendi ortasinda),
#        <onizleme>/<ad>.png (solda tam model, sagda patlamis gorunum), <cikti>/parcalar.json

import bpy, bmesh, sys, os, json, random, math, time
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
IN, OUT, PREV = argv[0], argv[1], argv[2]
NAMES = [n.strip() for n in argv[3].split(',') if n.strip()]
PIECES = int(argv[4]) if len(argv) > 4 else 12
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREV, exist_ok=True)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def select_only(objs, active=None):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


def load_model(path):
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)  # dikis yerlerinde acik kenar kalmasin
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    select_only(meshes)
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    if len(meshes) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    select_only([ob])
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for o in list(bpy.context.scene.objects):
        if o != ob:
            bpy.data.objects.remove(o, do_unlink=True)
    ob.name = 'model'
    # kalan cift noktalari birlestir, normalleri disa cevir (kapali govde = temiz kesim)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    # acik kenarlar (kapali olmayan modeller: sandik, ahsap kup 2) kapatilir ki kesim temiz olsun
    bound = [e for e in bm.edges if e.is_boundary]
    if bound:
        print('   acik kenar', len(bound), '-> kapatiliyor')
        bmesh.ops.holes_fill(bm, edges=bound, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data); bm.free()
    return ob


def bbox(ob):
    vs = [ob.matrix_world @ v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    return mn, mx


def avg_color(ob):
    # modelin dokusunun ortalama rengi (lineer), biraz koyulastirilmis
    for slot in ob.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image and n.image.size[0] > 0:
                img = n.image
                px = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
                img.pixels.foreach_get(px)
                px = px.reshape(-1, 4)[::7]
                px = px[px[:, 3] > 0.5]
                if len(px):
                    c = px[:, :3].mean(axis=0) * 0.72
                    return (float(c[0]), float(c[1]), float(c[2]), 1.0)
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            c = bsdf.inputs['Base Color'].default_value
            return (c[0] * 0.72, c[1] * 0.72, c[2] * 0.72, 1.0)
    return (0.3, 0.3, 0.3, 1.0)


def inner_material(col):
    m = bpy.data.materials.new('ic_yuzey')
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = 0.85
    return m


def voronoi_cell(center, others, mn, mx):
    # sinirlayici kutudan baslayip komsu noktalara gore orta duzlemlerle kesilen dis bukey hucre
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    size = mx - mn
    mid = (mn + mx) / 2
    for v in bm.verts:
        v.co = Vector((v.co.x * size.x, v.co.y * size.y, v.co.z * size.z)) + mid
    for o in others:
        d = o - center
        if d.length < 1e-6:
            continue
        geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
        bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(o + center) / 2, plane_no=d.normalized(),
                               clear_outer=True, dist=1e-6)
        if not bm.verts:
            break
        bound = [e for e in bm.edges if e.is_boundary]
        if bound:
            bmesh.ops.holes_fill(bm, edges=bound, sides=0)
    return bm


def fracture(ob, n, seed):
    mn, mx = bbox(ob)
    size = mx - mn
    rnd = random.Random(seed)
    # tohum noktalari: model hacminin icinde (kutunun %8 iceriden), biraz merkezden uzaga yayilmis
    pts = []
    while len(pts) < n:
        p = Vector((rnd.uniform(0.08, 0.92), rnd.uniform(0.08, 0.92), rnd.uniform(0.08, 0.92)))
        q = Vector((mn.x + p.x * size.x, mn.y + p.y * size.y, mn.z + p.z * size.z))
        if all((q - r).length > size.length * 0.12 for r in pts):
            pts.append(q)
    pad = size * 0.02
    cmn, cmx = mn - pad, mx + pad
    imat = inner_material(avg_color(ob))
    pieces = []
    for i, c in enumerate(pts):
        bm = voronoi_cell(c, [p for p in pts if p is not c], cmn, cmx)
        if len(bm.verts) < 4:
            bm.free()
            continue
        me = bpy.data.meshes.new('kesici')
        bm.to_mesh(me)
        bm.free()
        me.materials.append(imat)
        cut = bpy.data.objects.new('kesici', me)
        bpy.context.scene.collection.objects.link(cut)
        pc = ob.copy()
        pc.data = ob.data.copy()
        pc.name = 'p%02d' % len(pieces)
        bpy.context.scene.collection.objects.link(pc)
        mod = pc.modifiers.new('kes', 'BOOLEAN')
        mod.operation = 'INTERSECT'
        mod.solver = 'EXACT'
        try:
            mod.material_mode = 'TRANSFER'   # kirik yuzeyler kesicinin malzemesini alsin (siyah cikmasin)
        except Exception:
            pass
        mod.object = cut
        select_only([pc])
        try:
            bpy.ops.object.modifier_apply(modifier='kes')
        except Exception as e:
            print('  uyari: kesme basarisiz', pc.name, e)
        bpy.data.objects.remove(cut, do_unlink=True)
        if len(pc.data.polygons) < 4:
            bpy.data.objects.remove(pc, do_unlink=True)
            continue
        if imat.name not in [m.name for m in pc.data.materials if m]:
            pc.data.materials.append(imat)
        select_only([pc])
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
        pieces.append(pc)
    return pieces


def tri_count(objs):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in objs)


def to_gltf(v):  # Blender (Z yukari) -> glTF (Y yukari)
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def render_preview(orig, pieces, path):
    sc = bpy.context.scene
    mn, mx = bbox(orig)
    size = mx - mn
    w = max(size.x, size.y, size.z)
    mid = (mn + mx) / 2
    # sagda patlamis parcalar, solda tam model
    gap = w * 1.6
    orig.hide_render = False
    orig.location.x -= gap * 0.75
    for p in pieces:
        d = p.location - mid
        p.location = p.location + d * 0.95 + Vector((gap * 0.75, 0, 0))
    # isik
    sun = bpy.data.lights.new('gunes', 'SUN')
    sun.energy = 3.2
    sun.angle = math.radians(8)
    so = bpy.data.objects.new('gunes', sun)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
    sc.collection.objects.link(so)
    fill = bpy.data.lights.new('dolgu', 'AREA')
    fill.energy = 40 * w * w
    fill.size = w * 4
    fo = bpy.data.objects.new('dolgu', fill)
    fo.location = mid + Vector((-w * 2, -w * 3, w * 1.5))
    fo.rotation_euler = (math.radians(60), 0, math.radians(-35))
    sc.collection.objects.link(fo)
    # acik renkli fon + notr ortam isigi
    world = bpy.data.worlds.new('fon')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.86, 0.95, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    sc.world = world
    # kamera: onden, hafif yukaridan, ortografik
    cam = bpy.data.cameras.new('kamera')
    cam.type = 'ORTHO'
    cam.ortho_scale = gap * 1.5 + w * 1.6
    co = bpy.data.objects.new('kamera', cam)
    dirv = Vector((0.0, -1.0, 0.45)).normalized()
    co.location = mid + dirv * w * 8
    co.rotation_euler = (-dirv).to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(co)
    sc.camera = co
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    sc.cycles.use_denoising = True
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1080
    sc.view_settings.view_transform = 'Standard'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


summary = {}
for name in NAMES:
    t0 = time.time()
    src = os.path.join(IN, name + '.glb')
    if not os.path.exists(src):
        print('YOK:', src)
        continue
    print('== ', name)
    reset()
    ob = load_model(src)
    mn, mx = bbox(ob)
    orig = ob.copy()
    orig.data = ob.data.copy()
    orig.name = 'tam'
    bpy.context.scene.collection.objects.link(orig)
    orig.hide_render = True
    orig.hide_set(True)
    seed = sum(ord(ch) for ch in name)
    pieces = fracture(ob, PIECES, seed)
    bpy.data.objects.remove(ob, do_unlink=True)
    # disa aktar: sadece parcalar
    orig.hide_set(False)
    select_only(pieces)
    dst = os.path.join(OUT, name + '_parcali.glb')
    bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True,
                              export_yup=True, export_image_format='JPEG', export_jpeg_quality=90)
    summary[name] = {
        'parca': len(pieces),
        'ucgen': tri_count(pieces),
        'ucgen_orijinal': tri_count([orig]),
        'kb': round(os.path.getsize(dst) / 1024),
        'kutu_min': to_gltf(Vector((mn.x, mx.y, mn.z))),
        'kutu_max': to_gltf(Vector((mx.x, mn.y, mx.z))),
        'parcalar': {p.name: to_gltf(p.location) for p in pieces},
    }
    print('   parca', len(pieces), 'ucgen', summary[name]['ucgen'], 'kb', summary[name]['kb'])
    render_preview(orig, pieces, os.path.join(PREV, name + '.png'))
    print('   sure %.1f sn' % (time.time() - t0))

with open(os.path.join(OUT, 'parcalar.json'), 'w') as f:
    json.dump(summary, f, indent=1, ensure_ascii=False)
print('BITTI', len(summary), 'model')
