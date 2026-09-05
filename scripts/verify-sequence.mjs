import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) throw new Error('Invalid or incomplete JPEG');
  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) throw new Error('Invalid JPEG marker');
    while (buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2) throw new Error('Invalid JPEG segment');
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    offset += length;
  }
  throw new Error('JPEG dimensions not found');
}
export async function verifySequence(root = resolve('.')) {
  const frames = [], failures = [], hashes = new Set();
  for (let frame = 1; frame <= 150; frame++) {
    const name = `frame_${String(frame).padStart(4, '0')}.jpg`;
    try {
      const file = await readFile(resolve(root, 'renders/sequence', name));
      const dimensions = jpegDimensions(file);
      if (dimensions.width !== 1920 || dimensions.height !== 1080) throw new Error(`Expected 1920×1080, got ${dimensions.width}×${dimensions.height}`);
      const sha256 = createHash('sha256').update(file).digest('hex');
      if (hashes.has(sha256)) throw new Error('Duplicate frame content');
      hashes.add(sha256); frames.push({ frame, file: name, bytes: file.length, sha256 });
    } catch (error) { failures.push(`${name}: ${error.message}`); }
  }
  if (failures.length) throw new Error(`Sequence is incomplete or invalid (${failures.length} issues):\n${failures.join('\n')}`);
  const manifest = { count: 150, width: 1920, height: 1080, format: 'JPEG', quality: 90, totalBytes: frames.reduce((sum, frame) => sum + frame.bytes, 0), frames };
  await writeFile(resolve(root, 'public/sequence-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Verified all 150 unique JPEG frames at 1920×1080. ${(manifest.totalBytes / 1024 / 1024).toFixed(1)} MiB total.`);
  return manifest;
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifySequence().catch(error => { console.error(error.message); process.exitCode = 1; });
}
