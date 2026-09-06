# The Solstice Villa

A Vite + Tailwind CSS + GSAP ScrollTrigger website driven by 350 genuine Cycles renders of the Solstice Blender scene. The experience moves from the poolside establishing view through a retracted sliding door into the furnished living room, around the media partition to the dining salon, up both floating stair flights, and through an operable screen onto the balcony.

## Run locally

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. For the production version:

```sh
npm test
npm run build
npm run preview
```

Open http://127.0.0.1:4173. The `dist/` directory is the complete static site, including fonts and all 350 JPEGs; it can be hosted at a domain root or under a subdirectory. No server-side runtime is needed. `npm run build` refuses to proceed if any frame is missing, incomplete, duplicated, or the wrong resolution. `npm run build:ui` is an explicitly unchecked development build.

## Deliverables

- `reference_villa/Solstice_Walkthrough.blend`: dedicated animated camera, open sliding-door leaf, packed scene assets. The original `Solstice_Reference_Villa.blend` is preserved.
- `renders/sequence/frame_0001.jpg` through `frame_0350.jpg`: 1920×1080 JPEG, quality 90. The generated manifest records the combined size.
- `renders/review/`: four preliminary, lower-resolution framing checks, excluded from the website.
- `renders/camera-path.json`: per-frame camera position, rotation, and lens data.
- `renders/clearance-report.json`: the original path check. `renders/extended-clearance.json` checks seven rays for each of 200 new path segments with no geometry intersections detected. This checks camera passage, not building-code compliance.
- `public/sequence-manifest.json`: dimensions, byte sizes, and SHA-256 hashes for the full-resolution frames.
- `scripts/setup_walkthrough.py`: repeatable animation setup, intended to run inside the loaded reference villa through Blender MCP.
- `scripts/refine_extended_walkthrough.py`: corrected extension around the media wall and stair landings, including the animated balcony door and timber screen. Preserves the original camera curves through frame 150.
- `scripts/render_sequence.py`: resumable Blender timer render queue. Existing complete JPEGs are skipped. Set `MODE='review'` for draft checks and optionally pass a `FRAMES` list and `FOLDER` name; use `MODE='sequence'` for the full export. A `renders/PAUSE` file pauses between frames; remove it to resume. Re-run the script after an interrupted Blender session, ensuring only one queue is active.

## Camera and rendering

Frames 1–350 at 30 fps, with Bezier animation for location, Euler rotation, focal length, and lens shift. The original frames 1–150 retain exactly the same camera values; frames 151–350 extend the journey. The camera retains the establishing position, gradually widens from 44 mm to 23 mm, lowers from 2.70 m to 2.25 m, passes through the second front sliding-door bay, and turns into the living room. Eye level indoors is 1.60 m above the finished floor.

Cycles uses the Apple M4 Metal GPU, 64 samples, adaptive noise threshold 0.035 for the original sequence and 0.05 for the extension, 16 minimum adaptive samples, denoising, persistent render data, and a stable random seed. The saved file uses 1920×1080 at 100%, JPEG90, and an output prefix pointing to `renders/sequence/frame_`. Render settings were checked through Blender MCP after the full sequence completed.

## Interaction and memory

The full-screen fixed canvas uses proportional cover fitting, so portrait screens crop the sides without stretching the architecture. Its backing resolution follows device pixel ratio, capped at 2 for a practical memory/performance balance.

All 350 compressed JPEGs preload with six simultaneous requests, progress feedback, request timeouts, and retries. Only 12 decoded images on mobile or 18 on larger displays are retained. Rapid scroll jumps prioritize the requested frame, keep the previous image visible until the new one is ready, and release distant decoded images.

GSAP ScrollTrigger uses `scrub: 1` and maps normalized progress directly to frames 1–350. `src/chapters.js` defines six synchronized chapters: residence, outdoors, living, dining, floating staircase, and private balcony. Each navigation destination falls after its heading has fully faded in. Native page scrolling remains in control; chapter links navigate to deliberate points in that same scroll range. The final tour section follows the last frame.

Reduced-motion preferences use six still views and immediate chapter changes. The visible Motion control lets visitors choose the continuous camera journey and remembers that explicit choice across reloads. Navigation is keyboard accessible, loading offers a skip action, and failed downloads can be retried without downloading successful frames again. JavaScript-free visitors retain the private-tour information.

## Connect private-tour bookings

Copy `.env.example` to `.env.local` and set the actual booking destination:

```dotenv
VITE_TOUR_URL=https://your-real-booking-service.example/your-calendar
```

An actual `mailto:` address also works. Rebuild after changing it. Without this value, the header CTA opens the appointment section, which explicitly says booking details are forthcoming. The site never simulates a successful reservation or sends visitor data to an invented endpoint.

## Verification

`npm test` covers endpoint/overscroll frame mapping, proportional canvas fitting, bounded preload concurrency, failed-request recovery, rapid direction changes, decoded-cache limits, disposal of late image decodes, chapter navigation timing, and rejection of missing frames without substituting repeated images. Browser checks covered loading completion, desktop and 390×844 mobile layouts, full-motion and reduced-motion navigation, chapter state, the private-tour anchor, and console errors.

The site is implemented and built locally. It has not been deployed, and the booking destination is not configured.

## Credits and implementation references

The villa's material and model sources are recorded in [the scene README](reference_villa/README.md). Typography uses self-hosted Manrope via Fontsource. GSAP and Tailwind are bundled locally; no CDN runtime dependency is required.

- [GSAP ScrollTrigger documentation](https://gsap.com/docs/v3/Plugins/ScrollTrigger/)
- [Tailwind's Vite integration](https://tailwindcss.com/docs/installation/using-vite)
- [Vite guide](https://vite.dev/guide/)

## Extended route

The dining camera travels around the north end of the media partition instead of crossing the wall. The ascent follows the two stair flights and their intermediate landing, maintaining clearance from the slab and balustrades. A gentle crane move clears the upper-lounge planting. The third balcony door leaf and its corresponding screen section slide aside between frames 240–295; the camera passes through the opening and settles on a poolside outlook. Previous incomplete extension renders are archived under `renders/previous-extension/` and are excluded from the site.
