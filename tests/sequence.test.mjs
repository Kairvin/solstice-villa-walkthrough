import test from 'node:test';
import assert from 'node:assert/strict';
import { SequenceCache, coverRect, frameFromProgress, frameUrl } from '../src/sequence.js';

test('scroll mapping includes both endpoints and clamps overscroll', () => {
  assert.equal(frameFromProgress(-.2), 1);
  assert.equal(frameFromProgress(0), 1);
  assert.equal(frameFromProgress(.5), 176);
  assert.equal(frameFromProgress(1), 350);
  assert.equal(frameFromProgress(1.5), 350);
  assert.equal(frameUrl(7, '/villa/'), '/villa/renders/sequence/frame_0007.webp?v=1');
});
test('canvas cover preserves aspect ratio for portrait, landscape, and retina-sized surfaces', () => {
  for (const [w, h] of [[390,844],[1440,900],[2880,1800],[1920,1080]]) {
    const rect = coverRect(1920,1080,w,h);
    assert.ok(rect.width >= w && rect.height >= h);
    assert.ok(Math.abs(rect.width / rect.height - 16 / 9) < 1e-10);
    assert.ok(Math.abs(rect.x * 2 + rect.width - w) < 1e-10);
  }
});
const blob = new Blob([new Uint8Array(1200)], { type: 'image/webp' });
const ok = () => ({ ok: true, blob: async () => blob });
test('preloads every compressed frame with bounded parallelism and reports completion', async () => {
  let active=0, peak=0, fetched=0, latest=0;
  const cache = new SequenceCache({ count: 150, fetcher: async () => {
    active++; peak=Math.max(peak, active); await new Promise(r => setTimeout(r, 1)); active--; fetched++; return ok();
  }});
  await cache.preload(loaded => { latest=loaded; });
  assert.equal(fetched,150); assert.equal(latest,150); assert.equal(cache.blobs.size,150); assert.ok(peak <= 6);
  cache.dispose();
});
test('supports progressive initial window streaming before background completion', async () => {
  let initialReadyFired = false;
  const cache = new SequenceCache({ count: 100, fetcher: async () => {
    await new Promise(r => setTimeout(r, 2)); return ok();
  }});
  await cache.preload({
    initialCount: 20,
    onInitialReady: () => { initialReadyFired = true; },
  });
  assert.equal(initialReadyFired, true);
  assert.ok(cache.blobs.size >= 20);
  cache.dispose();
});
test('retry preserves successful downloads and recovers missing frames without double-loading them', async () => {
  let fail=true; const calls=new Map();
  const cache=new SequenceCache({count:3,url:i=>i,fetcher:async i=>{
    calls.set(i,(calls.get(i)||0)+1);
    if(i===2 && fail) return {ok:false,status:503};
    return ok();
  }});
  await assert.rejects(cache.preload(), /503/);
  assert.equal(cache.blobs.size,2);
  fail=false; await cache.preload();
  assert.equal(cache.blobs.size,3); assert.equal(calls.get(1),1); assert.equal(calls.get(3),1); assert.equal(calls.get(2),4);
  cache.dispose();
});
test('fast scroll jumps prioritize the newest frame and bound decoded memory', async () => {
  let closed=0;
  const cache=new SequenceCache({count:150,capacity:8,decoder:async () => {
    await new Promise(r=>setTimeout(r,2));return {width:1920,height:1080,close(){closed++;}};
  }});
  for(let i=1;i<=150;i++)cache.blobs.set(i,blob);
  await cache.start(1); cache.request(70); cache.request(150);
  await new Promise(r=>setTimeout(r,100));
  assert.equal(cache.target,150); assert.ok(cache.images.has(150)); assert.ok(cache.images.size<=8);
  assert.ok(cache.pending.size<=3); assert.ok(closed>0);
  cache.request(1); await new Promise(r=>setTimeout(r,100));
  assert.ok(cache.images.has(1)); assert.ok(cache.images.size<=8);
  cache.dispose(); assert.equal(cache.images.size,0);assert.equal(cache.blobs.size,0);
});
test('dispose closes late decodes and prevents retained image resources',async()=>{
  let closed=false;
  const cache=new SequenceCache({count:1,decoder:async()=>{await new Promise(r=>setTimeout(r,10));return{close(){closed=true;}};}});
  cache.blobs.set(1,blob);const pending=cache.decode(1);cache.dispose();await pending;
  assert.equal(closed,true);assert.equal(cache.images.size,0);
});

import { CHAPTERS, chapterFromProgress, nextChapterDestination } from '../src/chapters.js';
test('each chapter navigation point lands on fully visible text and its own camera act',()=>{
  CHAPTERS.forEach((chapter,index)=>{
    assert.equal(chapterFromProgress(chapter.nav),index);
    if(index>0)assert.ok(chapter.nav>=chapter.start+.02);
    if(index<CHAPTERS.length-1)assert.ok(chapter.nav<=chapter.end-.025);
  });
  assert.equal(frameFromProgress(CHAPTERS[3].nav),202);
  assert.equal(frameFromProgress(CHAPTERS[5].nav),329);
});
test('a missing frame rejects the preload and is never replaced by a repeated still',async()=>{
  const cache=new SequenceCache({count:3,url:i=>i,fetcher:async i=>i===2?{ok:false,status:404}:ok()});
  await assert.rejects(cache.preload(),/404/);
  assert.equal(cache.blobs.has(2),false);assert.equal(cache.blobs.size,2);cache.dispose();
});

test('the explore button advances through all six chapters before the tour section',()=>{
  assert.deepEqual(CHAPTERS.map((_,index)=>nextChapterDestination(index)),['outdoors','living','dining','stairs','suite','visit']);
});
