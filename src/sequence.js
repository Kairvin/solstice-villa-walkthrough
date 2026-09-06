export const FRAME_COUNT = 350;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const frameFromProgress = (progress) => Math.round(clamp(progress, 0, 1) * (FRAME_COUNT - 1)) + 1;
export const frameUrl = (index, base = import.meta.env?.BASE_URL || './', v = '1') => `${base}renders/sequence/frame_${String(index).padStart(4, '0')}.webp${v ? `?v=${v}` : ''}`;
export function coverRect(imageWidth, imageHeight, width, height, focus = .5) {
  const scale = Math.max(width / imageWidth, height / imageHeight);
  const w = imageWidth * scale, h = imageHeight * scale;
  return { x: (width - w) * clamp(focus, 0, 1), y: (height - h) * .5, width: w, height: h };
}

async function decodeBlob(blob) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image(); image.src = url; await image.decode(); return image;
  } finally { URL.revokeObjectURL(url); }
}

// All compressed WebPs stay cached. Only a small window occupies decoded GPU/CPU memory.
export class SequenceCache {
  constructor({ count = FRAME_COUNT, capacity = 16, fetcher = globalThis.fetch?.bind(globalThis), decoder = decodeBlob, url = frameUrl, onReady = () => {} } = {}) {
    Object.assign(this, { count, capacity, fetcher, decoder, url, onReady });
    this.blobs = new Map(); this.images = new Map(); this.pending = new Map();
    this.controller = new AbortController(); this.target = 1; this.direction = 1;
    this.active = false; this.disposed = false; this.failedDecodes = new Set();
  }
  async _fetchBatch(indices, onTick = () => {}) {
    if (!indices.length || this.disposed) return;
    let cursor = 0;
    const worker = async () => {
      while (cursor < indices.length && !this.disposed) {
        const index = indices[cursor++];
        if (this.blobs.has(index)) continue;
        let error;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(25000)]);
            const response = await this.fetcher(this.url(index), { signal, cache: 'force-cache' });
            if (!response.ok) {
              throw new Error(`Frame ${index} could not be loaded (${response.status}).`);
            }
            const blob = await response.blob();
            if (blob.size < 500 || !blob.type.startsWith('image/')) throw new Error(`Frame ${index} is not a valid image.`);
            this.blobs.set(index, blob);
            onTick(this.blobs.size);
            error = null;
            break;
          } catch (e) {
            error = e;
            if (this.disposed) throw e;
            if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
          }
        }
        if (error) throw error;
      }
    };
    const workers = Array.from({ length: Math.min(6, indices.length) }, worker);
    const results = await Promise.allSettled(workers);
    const failure = results.find(result => result.status === 'rejected');
    if (failure) throw failure.reason;
  }
  async preload(options = {}) {
    const onProgress = typeof options === 'function' ? options : (options.onProgress || (() => {}));
    const onInitialReady = typeof options === 'object' && options.onInitialReady ? options.onInitialReady : null;
    const initialTarget = Math.min(options.initialCount || (onInitialReady ? 40 : this.count), this.count);

    // Phase 1: Rapid arrival window
    const initialMissing = Array.from({ length: initialTarget }, (_, i) => i + 1).filter(i => !this.blobs.has(i));
    onProgress(this.blobs.size, this.count, Math.min(this.blobs.size, initialTarget), initialTarget);

    await this._fetchBatch(initialMissing, () => {
      onProgress(this.blobs.size, this.count, Math.min(this.blobs.size, initialTarget), initialTarget);
    });

    if (onInitialReady && !this.disposed) {
      try { onInitialReady(); } catch (err) { console.error('onInitialReady error:', err); }
    }

    // Phase 2: Background streaming for subsequent chapters
    if (initialTarget < this.count && !this.disposed) {
      const remainingMissing = Array.from({ length: this.count - initialTarget }, (_, i) => initialTarget + i + 1).filter(i => !this.blobs.has(i));
      const bgPromise = this._fetchBatch(remainingMissing, () => {
        onProgress(this.blobs.size, this.count, initialTarget, initialTarget);
      });
      if (!onInitialReady) {
        await bgPromise;
      }
    }

    onProgress(this.blobs.size, this.count, initialTarget, initialTarget);
  }
  async decode(index) {
    if (this.images.has(index)) return this.images.get(index);
    if (this.pending.has(index)) return this.pending.get(index);
    let blob = this.blobs.get(index);
    if (!blob && this.blobs.size > 0) {
      // Graceful nearest-available frame while scrubbing ahead of network
      const available = Array.from(this.blobs.keys());
      let closest = available[0];
      let minDiff = Math.abs(closest - index);
      for (let i = 1; i < available.length; i++) {
        const diff = Math.abs(available[i] - index);
        if (diff < minDiff) { minDiff = diff; closest = available[i]; }
      }
      blob = this.blobs.get(closest);
    }
    if (!blob) throw new Error(`Frame ${index} has not been downloaded.`);
    const promise = this.decoder(blob).then(image => {
      if (this.disposed) { image.close?.(); return null; }
      this.images.set(index, image); this.evict(); this.onReady(index); return image;
    }).finally(() => this.pending.delete(index));
    this.pending.set(index, promise);
    return promise;
  }
  async start(index = 1) {
    this.target = index;
    await this.decode(index);
    this.active = true; this.pump();
  }
  request(index) {
    index = clamp(Math.round(index), 1, this.count);
    if (index !== this.target) this.direction = Math.sign(index - this.target);
    this.target = index;
    if (this.active) this.pump();
    return this.images.get(index);
  }
  priorities() {
    const list = [this.target];
    for (let step = 1; list.length < this.capacity; step++) {
      for (const direction of [this.direction, -this.direction]) {
        const index = this.target + step * direction;
        if (index >= 1 && index <= this.count) list.push(index);
        if (list.length >= this.capacity) break;
      }
      if (step >= this.count) break;
    }
    return list;
  }
  pump() {
    if (!this.active || this.disposed) return;
    for (const index of this.priorities()) {
      if (this.pending.size >= 3) break;
      if (this.images.has(index) || this.pending.has(index) || this.failedDecodes.has(index)) continue;
      this.decode(index).catch(() => {
        this.failedDecodes.add(index);
        this.onDecodeError?.(index);
      }).finally(() => this.pump());
    }
  }
  evict() {
    const keep = new Set(this.priorities());
    const farthest = [...this.images.keys()].sort((a, b) => Number(keep.has(a)) - Number(keep.has(b)) || Math.abs(b - this.target) - Math.abs(a - this.target));
    while (this.images.size > this.capacity) {
      const index = farthest.shift(); this.images.get(index)?.close?.(); this.images.delete(index);
    }
  }
  dispose() {
    this.disposed = true; this.active = false; this.controller.abort();
    for (const image of this.images.values()) image.close?.();
    this.images.clear(); this.blobs.clear();
  }
}
