const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [mode, out] = [process.argv[2], process.argv[3]];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.goto('file://' + path.resolve(__dirname, 'reklama.html'));
  await p.waitForTimeout(500);
  const fps = 30, dur = 30;
  const times = mode === 'preview' ? [1.5, 3, 6.5, 11, 16, 21, 25.5, 29.5] : Array.from({ length: fps * dur }, (_, i) => i / fps);
  for (let i = 0; i < times.length; i++) {
    await p.evaluate(t => render(t), times[i]);
    await p.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.${mode === 'preview' ? 'png' : 'jpg'}`, type: mode === 'preview' ? 'png' : 'jpeg', ...(mode === 'preview' ? {} : { quality: 92 }) });
  }
  await b.close();
})();
