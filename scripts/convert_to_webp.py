"""Batch convert 350 walkthrough sequence frames from JPEG to WebP (quality 80) using Blender's image engine.
"""
import bpy
from pathlib import Path
import time

ROOT = Path('/Users/kairvinkukkar/Documents/ChatGPT/housing website')
SEQ_DIR = ROOT / 'renders/sequence'

s = bpy.context.scene
s.render.image_settings.file_format = 'WEBP'
s.render.image_settings.quality = 80

total_jpg_bytes = 0
total_webp_bytes = 0
converted_count = 0
t0 = time.time()

print("Starting batch WebP conversion for 350 frames...")

for i in range(1, 351):
    jpg_file = SEQ_DIR / f"frame_{i:04d}.jpg"
    webp_file = SEQ_DIR / f"frame_{i:04d}.webp"
    
    if not jpg_file.exists():
        print(f"Warning: {jpg_file.name} does not exist!")
        continue
        
    total_jpg_bytes += jpg_file.stat().st_size
    
    # Load and save via Blender image engine
    img = bpy.data.images.load(str(jpg_file.resolve()))
    img.save_render(str(webp_file.resolve()))
    bpy.data.images.remove(img)
    
    webp_size = webp_file.stat().st_size
    total_webp_bytes += webp_size
    converted_count += 1
    
    if i % 35 == 0 or i == 350:
        pct = round(i / 350 * 100)
        elapsed = round(time.time() - t0, 1)
        print(f"Progress: [{pct}%] ({i}/350 frames) - Elapsed: {elapsed}s")

elapsed_total = round(time.time() - t0, 2)
jpg_mb = round(total_jpg_bytes / (1024 * 1024), 2)
webp_mb = round(total_webp_bytes / (1024 * 1024), 2)
savings_pct = round((1 - total_webp_bytes / total_jpg_bytes) * 100, 1) if total_jpg_bytes > 0 else 0

print(f"\n✓ Successfully converted {converted_count} frames to WebP in {elapsed_total}s!")
print(f"  Original JPEG total: {jpg_mb} MB")
print(f"  New WebP total:      {webp_mb} MB")
print(f"  Size Reduction:      {savings_pct}%\n")
