const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');

const pdfPath = process.argv[2];
if (!pdfPath) throw new Error('Usage: node scripts/smoke-electron.cjs <pdf-path>');

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });
}

async function waitForTarget() {
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await getJson('http://127.0.0.1:9222/json/list');
      const page = targets.find((target) => target.type === 'page' && target.url.includes('/index.html'));
      if (page) return page.webSocketDebuggerUrl;
    } catch (_) {}
    await sleep(500);
  }
  throw new Error('Electron DevTools target was not found');
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 1;
  socket.on('message', (raw) => {
    const message = JSON.parse(raw.toString());
    const resolve = pending.get(message.id);
    if (resolve) {
      pending.delete(message.id);
      resolve(message);
    }
  });
  const ready = new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  const command = (method, params = {}) => new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, ready, command };
}

(async () => {
  const cdp = connect(await waitForTarget());
  await cdp.ready;
  const root = await cdp.command('DOM.getDocument');
  const input = await cdp.command('DOM.querySelector', {
    nodeId: root.result.root.nodeId,
    selector: '#pdf-input',
  });
  await cdp.command('DOM.setFileInputFiles', {
    nodeId: input.result.nodeId,
    files: [fs.realpathSync(pdfPath)],
  });
  await cdp.command('Runtime.evaluate', {
    expression: "document.querySelector('#pdf-input').dispatchEvent(new Event('change', {bubbles:true}))",
  });
  await sleep(7000);
  const result = await cdp.command('Runtime.evaluate', {
    returnByValue: true,
    expression: `({
      pdfjsLoaded: Boolean(window.pdfjsLib),
      indicator: document.querySelector('#page-indicator')?.textContent,
      currentCanvas: [document.querySelector('#current-slide-canvas')?.width, document.querySelector('#current-slide-canvas')?.height],
      notesCanvas: [document.querySelector('#notes-canvas')?.width, document.querySelector('#notes-canvas')?.height],
      placeholder: document.querySelector('#notes-placeholder')?.textContent,
      notesStyle: [document.querySelector('#notes-canvas')?.style.width, document.querySelector('#notes-canvas')?.style.height],
      notesDisplay: [getComputedStyle(document.querySelector('#notes-canvas')).display, getComputedStyle(document.querySelector('#notes-placeholder')).display],
      notesInk: (() => { const c = document.querySelector('#notes-canvas'); if (!c || !c.width || !c.height) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; })(),
      presenterLinkCount: document.querySelectorAll('#presenter-link-overlay a').length,
      pdfLinkCount: document.querySelectorAll('#link-overlay a').length,
      thumbnails: document.querySelectorAll('.thumbnail-item').length,
    })`,
  });
  await cdp.command('Runtime.evaluate', {
    expression: "(() => { const input = document.querySelector('#slide-jump'); if (!input) return; input.value = '2'; input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); })()",
  });
  await sleep(1200);
  const pageTwo = await cdp.command('Runtime.evaluate', {
    returnByValue: true,
    expression: "({indicator:document.querySelector('#page-indicator')?.textContent, presenterLinkCount:document.querySelectorAll('#presenter-link-overlay a').length, pdfLinkCount:document.querySelectorAll('#link-overlay a').length})",
  });
  result.result.result.value.pageTwo = pageTwo.result?.result?.value;
  const openResult = await cdp.command('Runtime.evaluate', {
    returnByValue: true,
    expression: "(() => { document.querySelector('#start-presentation-btn')?.click(); return true; })()",
  });
  await sleep(500);
  const pickerShown = (await cdp.command('Runtime.evaluate', {
    returnByValue: true,
    expression: "Boolean(document.querySelector('#screen-picker-modal'))",
  })).result?.result?.value;
  if (pickerShown) {
    await cdp.command('Runtime.evaluate', {
      expression: "document.querySelector('.screen-option-btn')?.click()",
    });
  }
  await sleep(2000);
  const targets = await getJson('http://127.0.0.1:9222/json/list');
  const presentationWindow = targets.some((target) => target.type === 'page' && target.url.includes('/presentation.html'));
  const value = result.result.result.value;
  value.presentationWindow = presentationWindow;
  value.openResult = openResult.result?.result?.value;
  value.screenPicker = Boolean(pickerShown);
  const presentationTarget = targets.find((target) => target.type === 'page' && target.url.includes('/presentation.html'));
  if (presentationTarget) {
    const audience = connect(presentationTarget.webSocketDebuggerUrl);
    await audience.ready;
    await sleep(1200);
    const audienceState = await audience.command('Runtime.evaluate', {
      returnByValue: true,
      expression: "({linkCount:document.querySelectorAll('#link-overlay a').length, page:document.querySelector('#slide-canvas')?.width})",
    });
    value.audience = audienceState.result?.result?.value;
    audience.socket.close();
  }
  console.log(JSON.stringify(value));
  cdp.socket.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
