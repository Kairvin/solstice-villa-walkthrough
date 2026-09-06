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

cam.animation_data_clear()
cam.data.animation_data_clear()
cam.rotation_mode = 'XYZ'
cam.data.clip_start = .06
cam.data.clip_end = 250
cam.data.dof.use_dof = False
s.camera = cam

# Retract the sliding door leaf on ground floor
for n in ['upright.006', 'upright.007', 'rail.006', 'rail.007', 'clear glass.003']:
    o = bpy.data.objects.get('S | Ground sliding door ' + n)
    if o:
        if 'walkthrough_original_location' not in o:
            o['walkthrough_original_location'] = list(o.location)
        o.location = Vector(o['walkthrough_original_location']) + Vector((-1.32, .065, 0))

# Ensure upper master bedroom door is partly open for walkthrough
door = bpy.data.objects.get('S | Oak interior door')
if door:
    door.rotation_euler.z = -0.55

keys = [
    # Act 1 & 2: Exterior Poolside approach and threshold entry (Frames 1-95)
    (1,   (11.4, -26.0, 2.70), (0, 1.0, 2.70), 44),
    (30,  (7.0,  -18.5, 2.65), (0, 1.8, 2.72), 40),
    (50,  (3.0,  -10.0, 2.55), (-.5, 2.5, 2.55), 34),
    (75,  (-.84, -2.40, 2.40), (-1.0, 3.3, 2.30), 27),
    (95,  (-.84, -0.35, 2.25), (-1.65, 3.5, 2.00), 25),

    # Act 3: Living Room (Frames 96-150)
    (115, (-.84,  1.30, 2.25), (-3.2, 3.65, 1.75), 23),
    (135, (-.88,  2.35, 2.25), (-4.3, 3.10, 1.65), 23),
    (150, (-.90,  2.95, 2.25), (-4.5, 2.90, 1.70), 23),

    # Act 4: Ground Floor Dining Salon (Frames 151-215)
    (170, (-0.30, 2.75, 2.20), (1.8, 2.20, 1.65), 24),
    (190, (0.80,  2.40, 2.10), (2.6, 2.10, 1.45), 24),
    (210, (1.65,  2.20, 2.00), (3.0, 2.40, 1.45), 24),

    # Act 5: Architectural Floating Staircase Ascent (Frames 216-285)
    (225, (2.30,  3.40, 1.95), (3.17, 5.80, 2.20), 24),
    (240, (3.17,  4.90, 2.20), (3.30, 7.50, 2.60), 23),
    (255, (3.80,  7.40, 2.95), (4.50, 6.80, 3.10), 23),
    (270, (4.94,  6.80, 3.40), (4.94, 4.40, 4.00), 24),
    (285, (4.94,  4.50, 4.80), (4.20, 3.20, 4.60), 24),

    # Act 6: Upper Level Lounge, Balcony, and Master Suite (Frames 286-350)
    (300, (3.80,  3.60, 5.15), (2.80, 2.20, 4.50), 24),
    (315, (2.20,  3.80, 5.15), (0.80, 2.40, 4.50), 24),
    (330, (0.50,  4.25, 5.15), (-2.0, 3.80, 4.80), 24),
    (340, (-0.90, 4.10, 5.15), (-3.2, 2.80, 4.50), 23),
    (350, (-1.85, 3.30, 5.10), (-3.8, 1.80, 4.30), 23),
]

previous = None
for frame, pos, target, lens in keys:
    cam.location = pos
    q = (Vector(target) - cam.location).to_track_quat('-Z', 'Y')
    rotation = q.to_euler('XYZ', previous) if previous else q.to_euler('XYZ')
    cam.rotation_euler = rotation
    previous = rotation.copy()
    cam.keyframe_insert(data_path='location', frame=frame)
    cam.keyframe_insert(data_path='rotation_euler', frame=frame)
    cam.data.lens = lens
    cam.data.shift_y = .01 * max(0, (95 - frame) / 94) if frame <= 95 else 0.0
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
            k.interpolation = 'BEZIER'
            k.handle_left_type = 'AUTO_CLAMPED'
            k.handle_right_type = 'AUTO_CLAMPED'
        fc.update()

s.frame_start = 1
s.frame_end = 350
s.render.fps = 30
s.render.engine = 'CYCLES'

prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'METAL'

s.cycles.device = 'GPU'
s.cycles.samples = 64
s.cycles.use_adaptive_sampling = True
s.cycles.adaptive_threshold = .035
s.cycles.adaptive_min_samples = 16
s.cycles.use_denoising = True
s.cycles.max_bounces = 8
s.cycles.diffuse_bounces = 4
s.cycles.glossy_bounces = 4
s.cycles.transmission_bounces = 8
s.cycles.transparent_max_bounces = 12
s.cycles.seed = 17
s.cycles.use_animated_seed = False
s.render.use_persistent_data = True
s.render.resolution_x = 1920
s.render.resolution_y = 1080
s.render.resolution_percentage = 100
s.render.image_settings.file_format = 'JPEG'
s.render.image_settings.quality = 90
s.render.image_settings.color_mode = 'RGB'
s.render.film_transparent = False
s.render.filepath = str(ROOT / 'renders/sequence/frame_')

cam.data.sensor_fit = 'HORIZONTAL'

points = []
for f in range(1, 351):
    s.frame_set(f)
    points.append({
        'frame': f,
        'position': [round(v, 4) for v in cam.location],
        'rotation': [round(v, 4) for v in cam.rotation_euler],
        'lens': round(cam.data.lens, 2)
    })

(ROOT / 'renders/camera-path.json').write_text(json.dumps(points, indent=2))
s.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'reference_villa/Solstice_Walkthrough.blend'), compress=True)
print('Extended walkthrough ready: 350 frames, 6 acts, Bezier curves, Cycles METAL 64s, saved to Solstice_Walkthrough.blend.')
