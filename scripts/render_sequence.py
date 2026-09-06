"""Resumable one-frame-per-timer Cycles render queue; run through Blender MCP.
MODE='review' renders representative checks, otherwise all 350 frames.
A renders/PAUSE file pauses between completed frames; remove it to resume.
"""
import bpy, json, time, traceback
from pathlib import Path

ROOT = Path('/Users/kairvinkukkar/Documents/ChatGPT/housing website')
MODE = globals().get('MODE', 'sequence')
s = bpy.context.scene
folder = ROOT / 'renders' / globals().get('FOLDER',MODE)
folder.mkdir(parents=True, exist_ok=True)

# Extended 350-frame sequence
REVIEW_FRAMES = [1, 75, 115, 150, 180, 210, 245, 275, 305, 335, 350]
frames = globals().get('FRAMES', REVIEW_FRAMES if MODE == 'review' else list(range(1, s.frame_end + 1)))

s.render.resolution_percentage = 40 if MODE == 'review' else 100
s.cycles.samples = 24 if MODE == 'review' else 64
s.cycles.adaptive_threshold = .05
s.render.image_settings.file_format = 'JPEG'
s.render.image_settings.quality = 90

started = time.time()
status = ROOT / 'renders' / f'{MODE}-status.json'
completed = []

for f in frames:
    p = folder / f'frame_{f:04d}.jpg'
    if p.exists() and p.stat().st_size > 10000:
        try:
            with p.open('rb') as file:
                file.seek(-2, 2)
                if file.read() == b'\xff\xd9':
                    completed.append(f)
        except Exception:
            pass

queue = [f for f in frames if f not in completed]

def report(state, frame=None, **extra):
    payload = {
        'state': state,
        'mode': MODE,
        'frame': frame,
        'completed': len(completed),
        'total': len(frames),
        'remaining': len(queue),
        'elapsedSeconds': round(time.time() - started, 1),
        'updatedAt': time.time(),
        **extra
    }
    tmp = status.with_suffix('.tmp')
    tmp.write_text(json.dumps(payload, indent=2))
    tmp.replace(status)

def render_next():
    if (ROOT / 'renders/PAUSE').exists():
        report('paused')
        return 2.0
    if not queue:
        s.render.resolution_percentage = 100
        s.cycles.samples = 64
        s.cycles.adaptive_threshold = .05
        s.frame_set(1)
        s.render.filepath = str(ROOT / 'renders/sequence/frame_')
        report('complete')
        print(f'{MODE} render complete!')
        return None
    frame = queue.pop(0)
    report('rendering', frame)
    try:
        s.frame_set(frame)
        s.render.filepath = str(folder / f'frame_{frame:04d}.jpg')
        t = time.time()
        bpy.ops.render.render(write_still=True)
        completed.append(frame)
        report('rendered', frame, lastFrameSeconds=round(time.time() - t, 2))
    except Exception:
        report('error', frame, error=traceback.format_exc())
        return None
    return 0.3

# Cancel any previous timer
old_timer = bpy.app.driver_namespace.get('WALKTHROUGH_RENDER')
if old_timer and bpy.app.timers.is_registered(old_timer):
    bpy.app.timers.unregister(old_timer)

bpy.app.driver_namespace['WALKTHROUGH_RENDER'] = render_next
report('queued')
bpy.app.timers.register(render_next, first_interval=0.5)
print(f'{MODE}: queued {len(queue)} frames, {len(completed)} already complete.')
