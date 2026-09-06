import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { createReadStream } from 'node:fs';
import { stat, readdir, copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

// One canonical sequence on disk, served in dev and copied into the static build.
function sequenceAssets() {
  let isBuild = false;
  return {
    name: 'solstice-sequence',
    configResolved(config) { isBuild = config.command === 'build'; },
    configureServer(server) {
      server.middlewares.use('/renders/sequence', async (req, res, next) => {
        const name = req.url?.split('?')[0].replace(/^\//, '');
        if (!/^frame_\d{4}\.(webp|jpg)$/.test(name || '')) return next();
        const path = resolve('renders/sequence', name);
        try {
          const file = await stat(path);
          const isWebp = name.endsWith('.webp');
          res.setHeader('Content-Type', isWebp ? 'image/webp' : 'image/jpeg');
          res.setHeader('Content-Length', file.size);
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          createReadStream(path).pipe(res);
        } catch { res.statusCode = 404; res.end('Frame unavailable'); }
      });
    },
    async closeBundle() {
      if (!isBuild) return;
      const destination = resolve('dist/renders/sequence');
      await mkdir(destination, { recursive: true });
      for (const file of await readdir(resolve('renders/sequence'))) {
        if (/^frame_\d{4}\.webp$/.test(file)) await copyFile(resolve('renders/sequence', file), resolve(destination, file));
      }
    },
  };
}
export default defineConfig({
  base: './',
  plugins: [tailwindcss(), sequenceAssets()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022' },
});
