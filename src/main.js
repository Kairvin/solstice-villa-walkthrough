import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SequenceCache, frameFromProgress, coverRect } from './sequence.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (selector) => document.querySelector(selector);
const canvas = $('#walkthrough');
const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
const loader = $('#loader');
$('#main').inert = true; $('.masthead').inert = true;
const chapters = [...document.querySelectorAll('.chapter')];
const chapterLinks = [...document.querySelectorAll('[data-chapter-link]')];
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reducedMotion = motionPreference.matches;
const anchors = ['residence', 'outdoors', 'interiors'];
const chapterProgress = [0, .36, .74];
const chapterNames = ['The Solstice Villa', 'Outdoor Tranquility', 'Light-filled Interiors'];
const state = { progress: 0, requested: 1, displayed: 0, activeChapter: -1, ready: false };
let raf = 0, width = 0, height = 0, dpr = 1, animation, trigger, booting = false, skipped = false;
const cache = new SequenceCache({
  capacity: window.innerWidth < 768 ? 12 : 18,
  onReady: () => scheduleDraw(),
});

function scheduleDraw() {
  if (!raf) raf = requestAnimationFrame(draw);
}
function draw() {
  raf = 0;
  const image = cache.images.get(state.requested);
  // An old asynchronous decode must never overwrite the newest requested frame.
  if (!image || !context) return;
  const rect = coverRect(image.width, image.height, width, height, .5);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  state.displayed = state.requested;
  canvas.dataset.frame = String(state.displayed);
}
function resize() {
  width = window.innerWidth; height = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  // Preserve a complete image during resize even if the next frame is decoding.
  const last = cache.images.get(state.displayed);
  if (last && context) {
    const rect = coverRect(last.width, last.height, width, height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.drawImage(last, rect.x, rect.y, rect.width, rect.height);
  }
  scheduleDraw();
}
function updateView() {
  const p = state.progress;
  const chapter = p < .30 ? 0 : p < .65 ? 1 : 2;
  state.requested = reducedMotion ? [1, 45, 150][chapter] : frameFromProgress(p);
  cache.request(state.requested); scheduleDraw();
  $('.reading-progress span').style.transform = `scaleX(${p})`;
  if (chapter !== state.activeChapter) {
    state.activeChapter = chapter;
    chapters.forEach((element, index) => {
      element.setAttribute('aria-hidden', String(index !== chapter));
      element.inert = index !== chapter;
    });
    chapterLinks.forEach(link => {
      if (Number(link.dataset.chapterLink) === chapter) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    $('#chapter-status').textContent = chapterNames[chapter];
    $('#scroll-cue-label').textContent = chapter === 2 ? 'YOUR PRIVATE VISIT' : 'SCROLL TO EXPLORE';
    $('#explore').setAttribute('aria-label', chapter === 2 ? 'Continue to private tours' : `Explore ${chapter === 0 ? 'the outdoors' : 'the interiors'}`);
  }
}
function initJourney() {
  animation?.kill(); trigger?.kill();
  state.progress = 0;
  document.body.dataset.motion = reducedMotion ? 'reduced' : 'full';
  $('#motion-toggle').setAttribute('aria-pressed', String(!reducedMotion));
  $('#motion-label').textContent = reducedMotion ? 'Motion off' : 'Motion on';
  gsap.set(chapters, { autoAlpha: 0, y: 0 });
  if (reducedMotion) {
    trigger = ScrollTrigger.create({
      id: 'solstice-journey', trigger: '#journey', start: 'top top', end: 'bottom bottom',
      onUpdate(self) {
        state.progress = self.progress; updateView();
        gsap.set(chapters, { autoAlpha: 0 });
        gsap.set(chapters[state.activeChapter], { autoAlpha: 1 });
      },
    });
    state.progress = trigger.progress; updateView();
    gsap.set(chapters[state.activeChapter], { autoAlpha: 1 });
  } else {
    const timeline = gsap.timeline({
      scrollTrigger: { id: 'solstice-journey', trigger: '#journey', start: 'top top', end: 'bottom bottom', scrub: 1, invalidateOnRefresh: true },
    });
    timeline.fromTo(state, { progress: 0 }, { progress: 1, duration: 1, ease: 'none', onUpdate: updateView }, 0);
    timeline.set(chapters[0], { autoAlpha: 1 }, 0);
    timeline.to(chapters[0], { autoAlpha: 0, y: -16, duration: .055, ease: 'none' }, .195);
    timeline.fromTo(chapters[1], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .055, ease: 'none' }, .30);
    timeline.to(chapters[1], { autoAlpha: 0, y: -16, duration: .055, ease: 'none' }, .545);
    timeline.fromTo(chapters[2], { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: .055, ease: 'none' }, .65);
    animation = timeline; trigger = timeline.scrollTrigger;
    timeline.progress(trigger.progress);
    updateView();
  }
}
function scrollToDestination(id, focus = false) {
  if (id === 'visit' || id === 'tour-details') {
    const target = document.getElementById(id);
    target.scrollIntoView({ behavior: reducedMotion || skipped ? 'instant' : 'smooth', block: id === 'visit' ? 'start' : 'center' });
    if (focus) target.focus({ preventScroll: true });
  } else {
    const index = anchors.indexOf(id);
    if (index < 0) return;
    if (!trigger) {
      skipped = false; loader.hidden = false; loader.inert = false;
      gsap.set(loader, { autoAlpha: 1 }); document.body.classList.add('is-loading');
      $('#main').inert = true; $('.masthead').inert = true;
      boot(); return;
    }
    const top = trigger.start + (trigger.end - trigger.start) * chapterProgress[index];
    window.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' });
  }
}
function hideLoader() {
  document.body.classList.remove('is-loading');
  $('#main').inert = false; $('.masthead').inert = false;
  gsap.to(loader, { autoAlpha: 0, duration: reducedMotion ? 0 : .45, ease: 'power2.out', onComplete() { loader.hidden = true; loader.inert = true; } });
}
async function boot() {
  if (booting) return;
  booting = true; $('#retry').hidden = true;
  $('#loading-label').textContent = 'Preparing your arrival';
  $('#loading-detail').textContent = 'A moment, before you step inside.';
  try {
    if (!context) throw new Error('Canvas is unavailable.');
    cache.failedDecodes.clear();
    await cache.preload((loaded, total) => {
      const percent = Math.round(loaded / total * 100);
      $('#loading-number').textContent = `${percent}%`;
      $('#loading-progress').setAttribute('aria-valuenow', loaded);
      $('#loading-progress span').style.transform = `scaleX(${loaded / total})`;
    });
    resize();
    await cache.start(state.requested);
    state.ready = true;
    initJourney(); draw();
    if (!skipped) hideLoader();
    ScrollTrigger.refresh();
    const hash = location.hash.slice(1);
    if (hash && !skipped) scrollToDestination(hash);
  } catch (error) {
    console.error('Solstice walkthrough:', error);
    $('#loading-label').textContent = 'Your arrival is on hold';
    $('#loading-detail').textContent = 'Some images could not be loaded. Check your connection and try again, or continue to private tours.';
    $('#retry').hidden = false;
  } finally { booting = false; }
}

// No invented recipient or simulated booking: wire a real destination through the environment.
const booking = import.meta.env.VITE_TOUR_URL?.trim();
if (booking) {
  try {
    const url = new URL(booking);
    if (!['https:', 'mailto:'].includes(url.protocol)) throw new Error('Use an HTTPS booking link or mailto: address.');
    $('#booking-action').href = url.href;
    $('#booking-note').textContent = url.protocol === 'mailto:' ? ' Tell us when you would like to visit.' : ' Select a convenient appointment with our booking service.';
  } catch (error) { console.warn('Invalid VITE_TOUR_URL:', error.message); }
}

$('#retry').addEventListener('click', boot);
$('#loading-skip').addEventListener('click', event => {
  event.preventDefault(); skipped = true; hideLoader();
  scrollToDestination('visit', true);
});
$('.skip-link').addEventListener('click', event => {
  event.preventDefault(); skipped = true; hideLoader(); scrollToDestination('visit', true);
});
document.querySelectorAll('a[href^="#"]').forEach(link => {
  if (link.id === 'loading-skip' || link.classList.contains('skip-link')) return;
  link.addEventListener('click', event => {
    const id = link.getAttribute('href').slice(1);
    if (![...anchors, 'visit', 'tour-details'].includes(id)) return;
    event.preventDefault(); history.replaceState(null, '', `#${id}`);
    scrollToDestination(id, id === 'visit' || id === 'tour-details');
  });
});
$('#explore').addEventListener('click', () => scrollToDestination(state.activeChapter >= 2 ? 'visit' : anchors[state.activeChapter + 1]));
window.addEventListener('resize', resize, { passive: true });
motionPreference.addEventListener('change', event => { reducedMotion = event.matches; if (state.ready) initJourney(); });
$('#motion-toggle').addEventListener('click', () => { reducedMotion = !reducedMotion; initJourney(); });
window.addEventListener('pagehide', event => {
  if (!event.persisted) { cache.dispose(); cancelAnimationFrame(raf); animation?.kill(); trigger?.kill(); }
});
// The fixed scene remains behind the final opaque section; controls cannot intercept its links.
ScrollTrigger.create({ trigger: '#visit', start: 'top bottom', end: 'top top', onUpdate(self) {
  $('#editorial').style.opacity = String(1 - self.progress);
  $('#editorial').inert = self.progress > .5;
}});
cache.onDecodeError = (index) => {
  if (index === state.requested) console.error(`Unable to decode walkthrough frame ${index}.`);
};
resize(); boot();
