"""Extend the original 150 frames around real walls and up both stair flights."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/kairvinkukkar/Documents/ChatGPT/housing website')
# Reconstruct the original curves, retaining their exact handles through frame 150.
source=(ROOT/'scripts/setup_walkthrough.py').read_text()
source='\n'.join(line for line in source.splitlines() if not line.startswith('bpy.ops.wm.save_as_mainfile'))
ns={};exec(compile(source,'original_walkthrough','exec'),ns)
s=ns['s'];cam=ns['cam'];curves=ns['curves']
original={}
for id in [cam,cam.data]:
 for fc in curves(id):
  original[(id.name,fc.data_path,fc.array_index)]=[(tuple(k.co),tuple(k.handle_left),tuple(k.handle_right)) for k in fc.keyframe_points]
keys=[
 (150,(-.90,2.95,2.25),(-4.5,2.9,1.70),23),
 (162,(-.90,3.60,2.25),(-3.8,4.0,1.80),23),
 (175,(-.80,5.25,2.25),(-1.5,6.4,1.80),23),
 (186,(.40,5.60,2.25),(2.5,3.4,1.75),23),
 (200,(1.10,4.15,2.25),(2.7,2.1,1.60),23),
 (214,(2.05,3.85,2.25),(3.6,3.1,1.80),23),
 (225,(3.17,4.30,2.35),(3.17,6.7,3.00),23),
 (239,(3.17,6.30,3.38),(4.94,5.8,3.15),23),
 (251,(3.35,7.85,3.90),(4.94,5.2,3.5),23),
 (259,(4.65,7.90,3.90),(4.94,5.8,4.60),23),
 (271,(4.94,6.40,4.48),(4.94,4.4,5.25),23),
 (285,(4.94,4.50,5.50),(2.8,2.8,4.6),23),
 (292,(4.65,3.75,6.05),(3.0,2.5,4.85),23),
 (298,(4.55,2.70,5.95),(2.0,.5,4.8),23),
 (310,(3.75,1.95,5.50),(2.5,-3,3.80),23),
 (320,(3.75,1.00,5.50),(1,-5,1.50),23),
 (334,(3.60,.15,5.50),(-2.5,-7,.80),23),
 (350,(2.90,-.10,5.50),(-3,-8,.55),23),
]
s.frame_set(150);previous=cam.rotation_euler.copy()
for f,p,t,lens in keys[1:]:
 cam.location=p
 cam.rotation_euler=(Vector(t)-cam.location).to_track_quat('-Z','Y').to_euler('XYZ',previous)
 previous=cam.rotation_euler.copy()
 cam.keyframe_insert(data_path='location',frame=f);cam.keyframe_insert(data_path='rotation_euler',frame=f)
 cam.data.lens=lens;cam.data.shift_y=0
 cam.data.keyframe_insert(data_path='lens',frame=f);cam.data.keyframe_insert(data_path='shift_y',frame=f)
for id in [cam,cam.data]:
 for fc in curves(id):
  for k in fc.keyframe_points:
   k.interpolation='BEZIER';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
  fc.update()
  for k,(co,hl,hr) in zip(fc.keyframe_points,original[(id.name,fc.data_path,fc.array_index)]):
   k.handle_left_type='FREE';k.handle_right_type='FREE';k.handle_left=hl;k.handle_right=hr
  fc.update()
# Open the third upper sliding leaf and its corresponding operable timber screen.
opening=[]
for suffix in ['upright.004','upright.005','rail.004','rail.005','clear glass.002']:
 opening.append((bpy.data.objects['S | Balcony lounge doors '+suffix],Vector((-1.55,.07,0))))
for o in s.objects:
 if o.name.startswith('S | Vertical walnut brise soleil') and 2.66<o.location.x<4.22:
  opening.append((o,Vector((-1.55,.18,0))))
for o,shift in opening:
 if 'extension_original_location' not in o:o['extension_original_location']=list(o.location)
 o.animation_data_clear();base=Vector(o['extension_original_location'])
 for f,factor in [(1,0),(240,0),(295,1),(350,1)]:
  o.location=base+shift*factor;o.keyframe_insert(data_path='location',frame=f)
 for fc in curves(o):
  for k in fc.keyframe_points:k.interpolation='BEZIER';k.handle_left_type='AUTO_CLAMPED';k.handle_right_type='AUTO_CLAMPED'
door=bpy.data.objects.get('S | Oak interior door')
if door:door.rotation_euler.z=-.25
s.frame_end=350;s.cycles.adaptive_threshold=.05;s.cycles.samples=64
# Store evaluated path and inspect a 20 cm camera envelope against evaluated geometry.
points=[];hits=[]
for f in range(1,351):
 s.frame_set(f);points.append({'frame':f,'position':list(cam.location),'rotation':list(cam.rotation_euler),'lens':cam.data.lens})
for a,b in zip(points[149:],points[150:]):
 s.frame_set(a['frame']);dg=bpy.context.evaluated_depsgraph_get()
 start=Vector(a['position']);delta=Vector(b['position'])-start
 for offset in [Vector((0,0,0)),Vector((.1,0,0)),Vector((-.1,0,0)),Vector((0,.1,0)),Vector((0,-.1,0)),Vector((0,0,.1)),Vector((0,0,-.1))]:
  hit,loc,n,face,obj,m=s.ray_cast(dg,start+offset,delta.normalized(),distance=delta.length)
  if hit:hits.append({'frame':a['frame'],'object':obj.name,'position':list(loc)})
(ROOT/'renders/camera-path.json').write_text(json.dumps(points,indent=2))
(ROOT/'renders/extended-clearance.json').write_text(json.dumps({'segments':200,'raysPerSegment':7,'hits':hits},indent=2))
s.frame_set(1)
print(json.dumps({'frames':350,'hits':hits,'animatedDoorParts':len(opening)}))
