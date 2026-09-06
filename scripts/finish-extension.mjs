// Local completion watcher for this render job; no external services or publishing.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
let lastCount = -1;
const started = Date.now();
while (true) {
  const status = JSON.parse(await readFile('renders/sequence-status.json', 'utf8'));
  if (status.state === 'error') {
    await writeFile('renders/delivery-status.json', JSON.stringify({state:'render-error',...status},null,2));
    throw new Error(status.error);
  }
  if (status.completed !== lastCount) {
    lastCount = status.completed;
    console.log(`${new Date().toISOString()} — ${lastCount}/${status.total} frames rendered`);
  }
  if (status.state === 'complete' && status.completed === 350) break;
  await delay(30000);
}
await writeFile('renders/delivery-status.json', JSON.stringify({state:'building',startedAt:started},null,2));
const code = await new Promise(resolve => {
  const child = spawn('npm', ['run','build'], {stdio:'inherit'});
  child.on('exit',resolve);
});
await writeFile('renders/delivery-status.json', JSON.stringify({state:code === 0?'complete':'build-error',exitCode:code,finishedAt:Date.now()},null,2));
process.exitCode = code;
