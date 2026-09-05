"""Run inside the loaded reference villa with Blender MCP. Safe to rerun."""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT = Path('/Users/kairvinkukkar/Documents/ChatGPT/housing website')
s = bpy.context.scene
assert s.name == 'SOLSTICE | Reference Villa', s.name
name = 'S | 06 Solstice walkthrough'
cam = bpy.data.objects.get(name)
if not cam:
    cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
    bpy.data.collections['S | Cameras'].objects.link(cam)
cam.animation_data_clear(); cam.data.animation_data_clear()
cam.rotation_mode = 'XYZ'; cam.data.clip_start = .06; cam.data.clip_end = 250
cam.data.dof.use_dof = False
s.camera = cam
# Retract the right-hand leaf of the second bay onto its parallel sliding track.
for name in ['upright.006', 'upright.007', 'rail.006', 'rail.007', 'clear glass.003']:
    o = bpy.data.objects['S | Ground sliding door ' + name]
    if 'walkthrough_original_location' not in o:
        o['walkthrough_original_location'] = list(o.location)
    o.location = Vector(o['walkthrough_original_location']) + Vector((-1.32, .065, 0))
keys = [
    (1, (11.4,-26,2.70), (0,1,2.70),44),
    (30,(7.0,-18.5,2.65),(0,1.8,2.72),40),
    (50,(3.0,-10,2.55),(-.5,2.5,2.55),34),
    (75,(-.84,-2.4,2.40),(-1.0,3.3,2.30),27),
    (95,(-.84,-.35,2.25),(-1.65,3.5,2.00),25),
    (115,(-.84,1.30,2.25),(-3.2,3.65,1.75),23),
    (135,(-.88,2.35,2.25),(-4.3,3.1,1.65),23),
    (150,(-.90,2.95,2.25),(-4.5,2.9,1.70),23),
]
previous = None
for frame, pos, target, lens in keys:
    cam.location = pos
    q = (Vector(target)-cam.location).to_track_quat('-Z','Y')
    rotation = q.to_euler('XYZ', previous) if previous else q.to_euler('XYZ')
    cam.rotation_euler = rotation; previous = rotation.copy()
    cam.keyframe_insert(data_path='location', frame=frame)
    cam.keyframe_insert(data_path='rotation_euler', frame=frame)
    cam.data.lens = lens; cam.data.shift_y = .01 * max(0, (95-frame)/94)
    cam.data.keyframe_insert(data_path='lens', frame=frame)
    cam.data.keyframe_insert(data_path='shift_y', frame=frame)
def curves(id):
    ad = id.animation_data
    for layer in ad.action.layers:
        for strip in layer.strips:
            bag = strip.channelbag(ad.action_slot)
            if bag:
                yield from bag.fcurves
for id in (cam, cam.data):
    for fc in curves(id):
        for k in fc.keyframe_points:
            k.interpolation = 'BEZIER'; k.handle_left_type = 'AUTO_CLAMPED'; k.handle_right_type = 'AUTO_CLAMPED'
        fc.update()
s.frame_start = 1; s.frame_end = 150; s.render.fps = 30
s.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'; prefs.get_devices()
for d in prefs.devices: d.use = d.type == 'METAL'
s.cycles.device = 'GPU'; s.cycles.samples = 64
s.cycles.use_adaptive_sampling = True; s.cycles.adaptive_threshold = .035
s.cycles.adaptive_min_samples = 16
s.cycles.use_denoising = True
s.cycles.max_bounces = 8; s.cycles.diffuse_bounces = 4; s.cycles.glossy_bounces = 4
s.cycles.transmission_bounces = 8; s.cycles.transparent_max_bounces = 12
s.cycles.seed = 17; s.cycles.use_animated_seed = False
s.render.use_persistent_data = True
s.render.resolution_x = 1920; s.render.resolution_y = 1080; s.render.resolution_percentage = 100
s.render.image_settings.file_format = 'JPEG'; s.render.image_settings.quality = 90
s.render.image_settings.color_mode = 'RGB'; s.render.film_transparent = False
s.render.filepath = str(ROOT/'renders/sequence/frame_')
# Keep standard horizontal sensor fitting across the sequence.
cam.data.sensor_fit = 'HORIZONTAL'
s.frame_set(1)
points=[]
for f in range(1,151):
    s.frame_set(f)
    points.append({'frame':f,'position':list(cam.location),'rotation':list(cam.rotation_euler),'lens':cam.data.lens})
# Clearance around the sliding aperture and interior corridor.
for p in points:
    x,y,z = p['position']
    if -.20 < y < .20: assert -1.45 < x < -.24 and .85 < z < 3.35, p
    if y > 0: assert x < -.50 and z > 2.20, p
(ROOT/'renders/camera-path.json').write_text(json.dumps(points,indent=2))
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference_villa/Solstice_Walkthrough.blend'),compress=True)
print('Walkthrough ready: 150 frames, Bezier curves, retracted glass leaf, Cycles METAL, 64 samples, 1920x1080 JPEG90.')
